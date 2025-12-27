import { Controller, Get, Query, Req } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { TelegramService } from '../telegram/telegram.service';
import { Public } from '../../common/decorators/public.decorator';
import type { Request } from 'express';

@Public()
@Controller('reminder')
export class ReminderController {
  private readonly testKey = process.env.REMINDER_TEST_KEY || '';
  private rlWindowMs = Number(process.env.REMINDER_TTL || 60) * 1000; // default 60s
  private rlLimit = Number(process.env.REMINDER_LIMIT || 10); // default 10 req/ttl

  private static buckets = new Map<string, { resetAt: number; count: number }>();
  private clientIp(req: Request) {
    const trustProxy = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || ''));
    const xff = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
    return trustProxy ? (xff || req.ip || 'unknown') : (req.ip || 'unknown');
  }
  private ratelimit(req: Request) {
    const ip = this.clientIp(req);
    const key = `rem:${ip}`;
    const now = Date.now();
    let b = ReminderController.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { resetAt: now + this.rlWindowMs, count: 0 };
      ReminderController.buckets.set(key, b);
    }
    b.count += 1;
    return b.count <= this.rlLimit;
  }
  private allow(req: Request, key?: string) {
    // Prefer header key for auth; fallback to query for kompatibilitas
    const headerKey = (req.headers['x-internal-key'] as string) || '';
    const provided = headerKey || (key || '');
    return !!this.testKey && provided === this.testKey;
  }

  constructor(
    private readonly reminder: ReminderService,
    private readonly tg: TelegramService,
  ) {}

  // GET /reminder/test?key=...&msg=Hello
  @Public()
  @Get('test')
  async test(@Req() req: Request, @Query('key') key?: string, @Query('msg') msg?: string, @Query('btn') btn?: string) {
    if (!this.allow(req, key)) return { ok: false, error: 'unauthorized' };
    if (!this.ratelimit(req)) return { ok: false, error: 'rate_limited' };
    if (!this.tg.isEnabled()) return { ok: false, error: 'telegram-disabled' };
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || '';
    const appBase = (process.env.APP_PUBLIC_BASE || 'http://localhost:3012').replace(/\/$/, '');
    const useBtn = typeof btn === 'string' && /^(1|true|yes)$/i.test(btn);
    const ok = await this.tg.sendMessage(chatId, msg || 'Test notification', useBtn ? [{ text: 'Open App', url: `${appBase}/user/jadwal` }] : undefined);
    return { ok };
  }

  // GET /reminder/tick?key=...
  @Public()
  @Get('tick')
  async tick(@Req() req: Request, @Query('key') key?: string, @Query('force') force?: string, @Query('debug') debug?: string) {
    if (!this.allow(req, key)) return { ok: false, error: 'unauthorized' };
    if (!this.ratelimit(req)) return { ok: false, error: 'rate_limited' };
    const f = typeof force === 'string' && /^(1|true|yes)$/i.test(force);
    const d = typeof debug === 'string' && /^(1|true|yes)$/i.test(debug);
    const info = await this.reminder.tick({ force: f, debug: d });
    return d ? { ok: true, info } : { ok: true };
  }
}
