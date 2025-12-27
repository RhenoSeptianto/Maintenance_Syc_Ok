import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './schedule.entity';

@Injectable()
export class ScheduleService {
  constructor(@InjectRepository(Schedule) private repo: Repository<Schedule>) {}

  async create(dto: Partial<Schedule>) {
    if (!dto.storeId) {
      throw new BadRequestException('storeId wajib diisi untuk membuat jadwal');
    }
    // Normalisasi
    const start = new Date(dto.start as any);
    // Set ke tengah hari (12:00) agar tidak bergeser hari karena timezone
    if (!isNaN(start.getTime())) start.setHours(12, 0, 0, 0);
    const assignedTs = dto.assignedTs || null;
    const storeId = dto.storeId || null;

    // Cek bentrok: TS yang sama pada tanggal yang sama (all-day), dan store yang sama pada tanggal yang sama
    if (assignedTs) {
      const clashTs = await this.repo
        .createQueryBuilder('s')
        .where('s.assignedTs = :ts', { ts: assignedTs })
        .andWhere('DATE(s.start) = DATE(:start)', { start })
        .getCount();
      if (clashTs > 0) throw new ConflictException('TS tersebut sudah terjadwal pada tanggal ini');
    }
    if (storeId) {
      const clashStore = await this.repo
        .createQueryBuilder('s')
        .where('s.storeId = :sid', { sid: storeId })
        .andWhere('DATE(s.start) = DATE(:start)', { start })
        .getCount();
      if (clashStore > 0) throw new ConflictException('Store ini sudah memiliki jadwal pada tanggal ini');
    }

    const e = this.repo.create({ ...dto, start } as any);
    return this.repo.save(e);
  }

  findAll() {
    return this.repo.find();
  }

  findByStatus(status: string) {
    return this.repo.find({ where: { status } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async findUpcoming() {
    const d0 = new Date(); d0.setHours(0,0,0,0);
    const d1 = new Date(d0); d1.setDate(d1.getDate()+30); // 30 hari ke depan (aman untuk indeks rentang)
    const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];
    return this.repo
      .createQueryBuilder('s')
      .where('s.start >= :d0 AND s.start < :d1', { d0, d1 })
      .andWhere('LOWER(COALESCE(s.status, \'\')) NOT IN (:...inactive)', { inactive })
      .orderBy('s.start', 'ASC')
      .getMany();
  }

  async findOverdue() {
    const d0 = new Date(); d0.setHours(0,0,0,0);
    const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];
    return this.repo
      .createQueryBuilder('s')
      .where('s.start < :d0', { d0 })
      .andWhere('LOWER(COALESCE(s.status, \'\')) NOT IN (:...inactive)', { inactive })
      .orderBy('s.start', 'ASC')
      .getMany();
  }

  async reschedule(id: number, newStart: Date) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Schedule not found');
    // Normalize to local noon to avoid timezone date shift issues
    const nd = new Date(newStart);
    nd.setHours(12, 0, 0, 0);
    s.start = nd;
    // When rescheduled from overdue, keep it active and clear completion if any
    if (s.completedAt) s.completedAt = null;
    return this.repo.save(s);
  }

  async update(id: number, dto: Partial<Schedule>) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Schedule not found');
    const nextStart: Date = dto.start ? (()=>{ const d=new Date(dto.start as any); if(!isNaN(d.getTime())) d.setHours(12,0,0,0); return d })() : s.start;
    const nextTs: string | null = (dto.assignedTs ?? s.assignedTs) || null;
    const nextStore: number | null = (dto.storeId ?? s.storeId) || null;

    if (nextTs) {
      const clashTs = await this.repo
        .createQueryBuilder('x')
        .where('x.id <> :id', { id })
        .andWhere('x.assignedTs = :ts', { ts: nextTs })
        .andWhere('DATE(x.start) = DATE(:start)', { start: nextStart })
        .getCount();
      if (clashTs > 0) throw new ConflictException('TS tersebut sudah terjadwal pada tanggal ini');
    }
    if (nextStore) {
      const clashStore = await this.repo
        .createQueryBuilder('x')
        .where('x.id <> :id', { id })
        .andWhere('x.storeId = :sid', { sid: nextStore })
        .andWhere('DATE(x.start) = DATE(:start)', { start: nextStart })
        .getCount();
      if (clashStore > 0) throw new ConflictException('Store ini sudah memiliki jadwal pada tanggal ini');
    }

    // status normalization + completedAt handling
    let nextStatus = (dto.status ?? s.status) as string;
    if (typeof nextStatus === 'string') nextStatus = nextStatus.toLowerCase();
    const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];

    Object.assign(s, { ...dto, start: nextStart, status: nextStatus });
    if (nextStatus && inactive.includes(nextStatus)) {
      if (!s.completedAt) s.completedAt = new Date();
    } else {
      // moving back to active clears completion timestamp
      if (s.completedAt) s.completedAt = null;
    }
    return this.repo.save(s);
  }

  async remove(id: number) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Schedule not found');
    return this.repo.remove(s);
  }
}
