import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance } from './maintenance.entity';
import { AssetService } from '../asset/asset.service';
import { Schedule } from '../schedule/schedule.entity';
import { Store } from '../store/store.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance) private repo: Repository<Maintenance>,
    @InjectRepository(Schedule) private schedRepo: Repository<Schedule>,
    @InjectRepository(Store) private storeRepo: Repository<Store>,
    private readonly assetSvc: AssetService,
  ) {}

  async create(dto: Partial<Maintenance>) {
    // Jika datang dari jadwal, lakukan validasi agar hanya TS terkait yang boleh membuat pengajuan
    if ((dto as any).scheduleId) {
      const sid = Number((dto as any).scheduleId);
      if (!Number.isFinite(sid)) throw new BadRequestException('Invalid scheduleId');
      const sched = await this.schedRepo.findOne({ where: { id: sid } });
      if (!sched) throw new NotFoundException('Schedule not found');
      // Tidak boleh membuat maintenance jika jadwal sudah non-aktif (complete/cancelled)
      const sStat = String((sched as any).status || '').toLowerCase();
      const inactive = ['complete','completed','complate','done','selesai','cancelled','canceled'];
      if (inactive.includes(sStat)) {
        throw new ForbiddenException('Jadwal sudah selesai/dibatalkan');
      }
      const submittedBy = (dto as any).submittedBy as string | undefined;
      if (sched.assignedTs && submittedBy && submittedBy !== sched.assignedTs) {
        throw new ForbiddenException('Tidak boleh membuat maintenance untuk jadwal milik TS lain');
      }
      // Samakan store jika tersedia pada schedule
      if (sched.storeId) {
        if ((dto as any).storeId && Number((dto as any).storeId) !== sched.storeId) {
          throw new BadRequestException('Store pada jadwal tidak cocok');
        }
        (dto as any).storeId = sched.storeId;
      }
      // Normalisasi tanggal ke tanggal jadwal jika berbeda harinya
      // Hanya boleh memulai pada tanggal jadwal
      const now = new Date(); now.setHours(0,0,0,0);
      const ds = new Date(sched.start); ds.setHours(0,0,0,0);
      if (now.getTime() !== ds.getTime()) {
        throw new ForbiddenException('Maintenance hanya bisa dimulai pada tanggal jadwal');
      }
      // Samakan tanggal payload ke tanggal jadwal
      (dto as any).date = new Date(sched.start);
    }

    // Jika ada storeId namun storeName belum terisi, auto-isi dari tabel Store
    if ((dto as any).storeId && !(dto as any).storeName) {
      try {
        const store = await this.storeRepo.findOne({ where: { id: (dto as any).storeId } });
        if (store && store.name) {
          (dto as any).storeName = store.name;
        }
      } catch {}
    }

    // Parse detail items lebih awal untuk validasi (mis. duplikat SN)
    let parsedItems: any[] = [];
    try {
      const d = JSON.parse(String((dto as any).details || '{}'));
      parsedItems = Array.isArray(d?.items) ? d.items : [];
    } catch {}

    // Cegah duplikasi SN dalam satu form maintenance
    if (parsedItems && parsedItems.length > 0) {
      const map = new Map<string, number[]>(); // sn -> list no baris
      for (const it of parsedItems) {
        const raw = String(it?.sn || it?.serialNumber || '').trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        const no = Number(it?.no) || null;
        const arr = map.get(key) || [];
        arr.push(no || arr.length + 1);
        map.set(key, arr);
      }
      const dupLabels: string[] = [];
      for (const [sn, rows] of map.entries()) {
        if (rows.length > 1) {
          const rowStr = rows.filter((n) => n != null).join(', ');
          dupLabels.push(`${sn} (baris ${rowStr || rows.length})`);
        }
      }
      if (dupLabels.length > 0) {
        throw new BadRequestException('Terdapat SN duplikat dalam form maintenance: ' + dupLabels.join('; '));
      }
    }

    const m = this.repo.create(dto as any);
    const saved = await this.repo.save(m);
    // Upsert assets from items jika details tersedia
    try {
      const items: any[] = parsedItems || [];
      for (const it of items) {
        const name = String(it?.hardware || it?.name || '').trim();
        const serial = String(it?.sn || it?.serialNumber || '').trim();
        if (!name || !serial) continue; // hanya asset dengan SN yang diisi
        const kondisi = String(it?.kondisi || '').toLowerCase().trim();
        const status = kondisi === 'tidak' ? 'in_repair' : (kondisi === 'baik' ? 'active' : undefined);
        const asset = await this.assetSvc.upsertFromMaintenanceItem({
          name,
          category: name,
          serialNumber: serial,
          storeId: (dto as any).storeId ?? null,
          storeName: (dto as any).storeName ?? null,
          maintenanceDate: (dto as any).date ? new Date((dto as any).date) : new Date(),
          ageMonthsInput: (it && typeof it.usia === 'number') ? it.usia : null,
          status,
          maintenanceOrder: Number(it?.no) || null,
        });
        // History: simpan jika ada repairDate atau repairNote
        try {
          const hasHistory = !!(it?.repairDate || it?.repairNote);
          if (hasHistory) {
            const repairDate = it?.repairDate ? String(it.repairDate).slice(0,10) : null;
            const note = (it?.repairNote ? String(it.repairNote).trim() : '') || null;
            const date = repairDate || (dto as any)?.date || new Date().toISOString().slice(0,10);
            await this.assetSvc.addHistory((asset as any).id, {
              date: date,
              note: note || 'Perbaikan (form maintenance)',
              createdBy: (dto as any).technician || (dto as any).submittedBy || null,
            });
          }
        } catch {}
      }
    } catch {}
    return saved;
  }

  /**
   * Ambil nama store untuk sebuah maintenance.
   * Prioritas: field storeName di Maintenance, lalu lookup ke tabel Store via storeId.
   */
  async getStoreNameForMaintenance(m: Maintenance): Promise<string | null> {
    try {
      const fromSelf = (m as any).storeName as string | null | undefined;
      if (fromSelf && fromSelf.trim()) return fromSelf.trim();
      const sid = (m as any).storeId as number | null | undefined;
      if (!sid) return null;
      const store = await this.storeRepo.findOne({ where: { id: sid } });
      if (store && store.name && store.name.trim()) return store.name.trim();
    } catch {}
    return null;
  }

  findAll() {
    return this.repo.find({ order: { date: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async updateContent(id: number, body: any) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Maintenance not found');
    // Jika ada details (JSON), tambahkan penanda fixedAt agar UI lintas-perangkat bisa menyembunyikan tombol Perbaiki
    try {
      if (Object.prototype.hasOwnProperty.call(body, 'details') && body.details) {
        const obj = (()=>{ try { return JSON.parse(String(body.details)) } catch { return null } })();
        if (obj && typeof obj === 'object') {
          obj.fixedAt = new Date().toISOString();
          body.details = JSON.stringify(obj);
        }
      }
    } catch {}
    const allow: (keyof Maintenance)[] = ['title','details','date','storeName','technician','storeId'];
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        const v = (body as any)[k];
        if (v !== undefined) {
          (m as any)[k] = (k === 'date') ? new Date(v) : v;
        }
      }
    }
    const saved = await this.repo.save(m);
    try {
      const d = JSON.parse(String(saved.details || '{}'));
      const items: any[] = Array.isArray(d?.items) ? d.items : [];
      for (const it of items) {
        const name = String(it?.hardware || it?.name || '').trim();
        const serial = String(it?.sn || it?.serialNumber || '').trim();
        if (!name || !serial) continue; // hanya asset dengan SN yang diisi
        const kondisi = String(it?.kondisi || '').toLowerCase().trim();
        const status = kondisi === 'tidak' ? 'in_repair' : (kondisi === 'baik' ? 'active' : undefined);
        const asset = await this.assetSvc.upsertFromMaintenanceItem({
          name,
          category: name,
          serialNumber: serial,
          storeId: m.storeId ?? null,
          storeName: m.storeName ?? null,
          maintenanceDate: m.date ? new Date(m.date) : new Date(),
          ageMonthsInput: (it && typeof it.usia === 'number') ? it.usia : null,
          status,
          maintenanceOrder: Number(it?.no) || null,
        });
        try {
          const hasHistory = !!(it?.repairDate || it?.repairNote);
          if (hasHistory) {
            const repairDate = it?.repairDate ? String(it.repairDate).slice(0,10) : null;
            const note = (it?.repairNote ? String(it.repairNote).trim() : '') || null;
            const date = repairDate || (m as any)?.date || new Date().toISOString().slice(0,10);
            await this.assetSvc.addHistory((asset as any).id, {
              date,
              note: note || 'Perbaikan (form maintenance)',
              createdBy: (m as any).technician || (m as any).submittedBy || null,
            });
          }
        } catch {}
      }
    } catch {}
    return saved;
  }

  /**
   * Hitung nomor urutan maintenance (MTC) per store per tahun.
   * Contoh: maintenance pertama store A di 2026 => 1, kedua => 2, dst.
   * Jika storeId atau date tidak ada, kembalikan null.
   */
  async getYearlySequence(m: Maintenance): Promise<number | null> {
    if (!m.storeId || !m.date) return null;
    const d = new Date(m.date as any);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const yStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    const list = await this.repo
      .createQueryBuilder('x')
      .where('x.storeId = :sid', { sid: m.storeId })
      .andWhere('x.date >= :d0 AND x.date < :d1', { d0: yStart, d1: yEnd })
      .orderBy('x.date', 'ASC')
      .addOrderBy('x.id', 'ASC')
      .getMany();

    const idx = list.findIndex((row) => row.id === m.id);
    if (idx === -1) return null;
    return idx + 1;
  }

  async updateStatus(id: number, status: 'approved' | 'rejected', approvedBy?: string) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Maintenance not found');
    m.status = status;
    if (approvedBy) m.approvedBy = approvedBy;
    // Deteksi tiket perbaikan (fix_request) dan set window 1 jam saat approve
    let isFixRequest = false;
    try {
      const d = JSON.parse(String(m.details || '{}'));
      if (d && d.type === 'fix_request') {
        isFixRequest = true;
        if (status === 'approved') {
          const now = new Date();
          const expires = new Date(now.getTime() + 60 * 60 * 1000);
          d.approvedAt = now.toISOString();
          d.expiresAt = expires.toISOString();
          m.details = JSON.stringify(d);
        }
      }
    } catch {}
    const saved = await this.repo.save(m);

    // Jika maintenance disetujui â†’ tandai schedule selesai
    if (status === 'approved' && !isFixRequest) {
      if (m.scheduleId) {
        const sched = await this.schedRepo.findOne({ where: { id: m.scheduleId } });
        if (sched) {
          sched.status = 'complete';
          if (!sched.completedAt) sched.completedAt = new Date();
          await this.schedRepo.save(sched);
        }
      } else {
        // Fallback pencocokan bertahap: tanggal (rentang hari), storeId â†’ assignedTs â†’ title contains storeName
        const d0 = new Date(m.date); d0.setHours(0,0,0,0);
        const d1 = new Date(d0); d1.setDate(d1.getDate()+1);
        const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];

        // 1) By storeId (paling kuat)
        let match: Schedule | null = null;
        if (m.storeId) {
          match = await this.schedRepo.createQueryBuilder('s')
            .where('s.storeId = :sid', { sid: m.storeId })
            .andWhere('s.start >= :d0 AND s.start < :d1', { d0, d1 })
            .andWhere("LOWER(COALESCE(s.status,'')) NOT IN (:...inactive)", { inactive })
            .orderBy('s.start','ASC')
            .getOne();
        }
        // 2) By assignedTs (teknisi sama) jika belum ketemu
        if (!match && (m as any).technician) {
          match = await this.schedRepo.createQueryBuilder('s')
            .where('s.assignedTs = :ts', { ts: (m as any).technician })
            .andWhere('s.start >= :d0 AND s.start < :d1', { d0, d1 })
            .andWhere("LOWER(COALESCE(s.status,'')) NOT IN (:...inactive)", { inactive })
            .orderBy('s.start','ASC')
            .getOne();
        }
        // 3) By title contains storeName (case-insensitive)
        if (!match && m.storeName) {
          match = await this.schedRepo.createQueryBuilder('s')
            .where('LOWER(s.title) LIKE :kw', { kw: `%${String(m.storeName).toLowerCase()}%` })
            .andWhere('s.start >= :d0 AND s.start < :d1', { d0, d1 })
            .andWhere("LOWER(COALESCE(s.status,'')) NOT IN (:...inactive)", { inactive })
            .orderBy('s.start','ASC')
            .getOne();
        }
        if (match) {
          match.status = 'complete';
          match.completedAt = new Date();
          await this.schedRepo.save(match);
        }
      }
    }
    return saved;
  }

  /**
   * Ambil nama store untuk sebuah maintenance.
   * Prioritas:
   * 1) field storeName di Maintenance
   * 2) lookup tabel Store via storeId
   * 3) jika ada scheduleId, ambil Schedule lalu storeId->Store
   */
  async getStoreNameForMaintenance(m: Maintenance): Promise<string | null> {
    try {
      const fromSelf = (m as any).storeName as string | null | undefined;
      if (fromSelf && fromSelf.trim()) return fromSelf.trim();

      const sid = (m as any).storeId as number | null | undefined;
      if (sid) {
        const store = await this.storeRepo.findOne({ where: { id: sid } });
        if (store && store.name && store.name.trim()) return store.name.trim();
      }

      const schedId = (m as any).scheduleId as number | null | undefined;
      if (schedId) {
        const sched = await this.schedRepo.findOne({ where: { id: schedId } });
        if (sched && sched.storeId) {
          const store = await this.storeRepo.findOne({ where: { id: sched.storeId } });
          if (store && store.name && store.name.trim()) return store.name.trim();
        }
      }
    } catch {}
    return null;
  }
}



