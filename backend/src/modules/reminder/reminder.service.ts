import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from '../schedule/schedule.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { TelegramService } from '../telegram/telegram.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { User } from '../users/user.entity';
import { Store } from '../store/store.entity';
import Redis from 'ioredis';

@Injectable()
export class ReminderService implements OnModuleInit {
  private readonly log = new Logger('Reminder');
  private readonly redis: Redis;
  private readonly groupId = process.env.TELEGRAM_GROUP_CHAT_ID || '';
  private readonly appBase = (process.env.APP_PUBLIC_BASE || 'http://localhost:3012').replace(/\/$/, '');
  private readonly t1Hour = Number(process.env.REMINDER_T1_HOUR || 17);
  private readonly h0Hour = Number(process.env.REMINDER_H0_HOUR || 9);
  private readonly toleranceMin = Number(process.env.REMINDER_TOLERANCE_MINUTES || 15);
  private readonly autoApproveMin = Number(process.env.AUTO_APPROVE_MINUTES || 30);

  constructor(
    @InjectRepository(Schedule) private readonly schedules: Repository<Schedule>,
    @InjectRepository(Maintenance) private readonly maints: Repository<Maintenance>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    private readonly tg: TelegramService,
    private readonly maintSvc: MaintenanceService,
  ) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = Number(process.env.REDIS_PORT || 6379);
    this.redis = new Redis({ host, port, lazyConnect: false, maxRetriesPerRequest: 2 });
  }

  onModuleInit() {
    if (!this.tg.isEnabled() || !this.groupId) {
      this.log.log('Telegram reminder disabled (missing token or group id)');
      return;
    }
    // Run every 5 minutes
    setInterval(() => this.tick().catch(() => {}), 5 * 60 * 1000);
    // Run once after start (give DB a moment)
    setTimeout(() => this.tick().catch(() => {}), 15 * 1000);
  }

  private withinWindow(targetHour: number, now: Date) {
    const a = new Date(now);
    const b = new Date(now);
    b.setHours(targetHour, 0, 0, 0);
    const diffMin = Math.abs(a.getTime() - b.getTime()) / 60000;
    return diffMin <= this.toleranceMin;
  }

  private ymd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async dedupe(key: string, ttlSec = 7 * 24 * 3600) {
    try {
      const ok = await this.redis.set(key, '1', 'EX', ttlSec, 'NX');
      return ok === 'OK';
    } catch {
      return true; // if redis fails, allow once
    }
  }

  async tick(opts?: { force?: boolean; debug?: boolean }) {
    const force = !!(opts && opts.force);
    const debug = !!(opts && opts.debug);
    const dbg: any = debug ? { enabled: this.tg.isEnabled(), hasGroup: !!this.groupId, attempts: [] as any[] } : null;
    if (!this.tg.isEnabled() || !this.groupId) return debug ? dbg : undefined;
    const now = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    // Fetch schedules around today +/- 1 day to keep memory kecil
    const dStart = new Date(yesterday); dStart.setHours(0,0,0,0);
    const dEnd = new Date(tomorrow); dEnd.setDate(dEnd.getDate() + 1);
    const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];

    const list = await this.schedules.createQueryBuilder('s')
      .where('s.start >= :dStart AND s.start < :dEnd', { dStart, dEnd })
      .andWhere("LOWER(COALESCE(s.status,'')) NOT IN (:...inactive)", { inactive })
      .orderBy('s.start','ASC')
      .getMany();
    if (debug) dbg.count = list.length;

    for (const s of list) {
      const sDay = new Date(s.start); sDay.setHours(0,0,0,0);
      const title = s.title || 'Maintenance';
      const ymd = this.ymd(sDay);
      // Enrich display info
      let tsDisplay = s.assignedTs || '';
      if (tsDisplay) {
        try { const u = await this.users.findOne({ where: { username: tsDisplay } }); if (u && u.name) tsDisplay = `${u.name} (@${s.assignedTs})`; } catch {}
      }
      let storeName = '';
      if (s.storeId) {
        try { const st = await this.stores.findOne({ where: { id: s.storeId } }); if (st && st.name) storeName = st.name; } catch {}
      }

      // T-1 17:00
      if (sDay.getTime() === tomorrow.getTime() && (force || this.withinWindow(this.t1Hour, now))) {
        const key = `tg:sent:T1:${s.id}:${ymd}`;
        const canSend = await this.dedupe(key);
        if (debug) dbg.attempts.push({ id: s.id, ymd, type: 'T1', canSend, key });
        if (canSend) {
          const text = `\u23F0 <b>Pengingat</b>\nBesok (${ymd}) ada jadwal: <b>${title}</b>${storeName?`\nStore: <b>${storeName}</b>`:''}${tsDisplay?`\nTS: <b>${tsDisplay}</b>`:''}`;
          const buttons = [{ text: 'Lihat Jadwal', url: `${this.appBase}/user/jadwal` }];
          const ok = await this.tg.sendMessage(this.groupId, text, buttons);
          if (debug) dbg.attempts[dbg.attempts.length-1].sent = ok;
          if (!ok) { try { await this.redis.del(key) } catch {} }
        }
      }
      // H 09:00
      if (sDay.getTime() === today.getTime() && (force || this.withinWindow(this.h0Hour, now))) {
        const key = `tg:sent:H0:${s.id}:${ymd}`;
        const canSend = await this.dedupe(key);
        if (debug) dbg.attempts.push({ id: s.id, ymd, type: 'H0', canSend, key });
        if (canSend) {
          const formUrl = `${this.appBase}/maintenance-form.html?mode=user&scheduleId=${s.id}&storeId=${s.storeId ?? ''}&date=${ymd}`;
          const text = `\u2705 <b>Jadwal Hari Ini</b>\n${ymd}\n<b>${title}</b>${storeName?`\nStore: <b>${storeName}</b>`:''}${tsDisplay?`\nTS: <b>${tsDisplay}</b>`:''}`;
          const buttons = [
            { text: 'Mulai Maintenance', url: formUrl },
            { text: 'Lihat Jadwal', url: `${this.appBase}/user/jadwal` },
          ];
          const ok = await this.tg.sendMessage(this.groupId, text, buttons);
          if (debug) dbg.attempts[dbg.attempts.length-1].sent = ok;
          if (!ok) { try { await this.redis.del(key) } catch {} }
        }
      }
    }
    // Auto-approve maintenance older than threshold
    try {
      const cutoff = new Date(Date.now() - this.autoApproveMin * 60 * 1000);
      const pendings = await this.maints.createQueryBuilder('m')
        .where("LOWER(COALESCE(m.status,'')) = :st", { st: 'submitted' })
        .andWhere('m.createdAt < :cutoff', { cutoff })
        .orderBy('m.createdAt','ASC')
        .getMany();
      if (debug) dbg.autoApprove = { count: pendings.length };
      for (const m of pendings) {
        try {
          await this.maintSvc.updateStatus(m.id, 'approved', 'auto');
        } catch (e) {
          this.log.warn(`Auto-approve failed for maintenance ${m.id}: ${String((e as any)?.message || e)}`);
        }
      }
    } catch {}
    return debug ? dbg : undefined;
  }
}
