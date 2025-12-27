import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './asset.entity';
import { AssetHistory } from './asset-history.entity';
import { Store } from '../store/store.entity';

export interface AssetQuery {
  q?: string;
  storeId?: number;
  category?: string;
  status?: string;
  oldOnly?: string | boolean;
  ageMin?: number; // months
  ageMax?: number; // months
}

function monthsDiff(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset) private readonly repo: Repository<Asset>,
    @InjectRepository(AssetHistory) private readonly histRepo: Repository<AssetHistory>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
  ) {}

  async list(query: AssetQuery, user?: { role?: string; username?: string }) {
    const qb = this.repo.createQueryBuilder('a');
    if (query.q) {
      const kw = `%${String(query.q).toLowerCase()}%`;
      qb.andWhere('LOWER(a.name) LIKE :kw OR LOWER(a.category) LIKE :kw OR LOWER(a.serialNumber) LIKE :kw OR LOWER(a.storeName) LIKE :kw OR LOWER(a.assetCode) LIKE :kw', { kw });
    }
    if (query.storeId != null && Number.isFinite(Number(query.storeId))) qb.andWhere('a.storeId = :sid', { sid: Number(query.storeId) });
    if (query.category) qb.andWhere('LOWER(COALESCE(a.category, \'\')) = :cat', { cat: String(query.category).toLowerCase() });
    if (query.status) qb.andWhere('LOWER(a.status) = :st', { st: String(query.status).toLowerCase() });
    // If role=user or ts, restrict to stores assigned to that username
    if (user && (user.role === 'user' || user.role === 'ts')) {
      const stores = await this.storeRepo.find({ where: { tsAssigned: user.username || '' } });
      const ids = stores.map(s => s.id).filter(Boolean);
      if (ids.length === 0) return [] as any;
      qb.andWhere('a.storeId IN (:...ids)', { ids });
    }
    // Pagination & sane defaults to prevent huge payloads
    const limitRaw = (query as any).limit;
    const offsetRaw = (query as any).offset;
    const limit = Math.min(Math.max(Number(limitRaw || 300), 1), 1000); // default 300, max 1000
    const offset = Math.max(Number(offsetRaw || 0), 0);

    const list = await qb
      .orderBy('a.lastMaintenanceOrder','ASC', 'NULLS LAST')
      .addOrderBy('a.updatedAt','DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    // Ambil history terbaru per asset (jika ada) sekali saja
    let latestById = new Map<number, AssetHistory>();
    if (list.length > 0) {
      const ids = list.map(a => a.id);
      const rows = await this.histRepo.createQueryBuilder('h')
        .where('h.assetId IN (:...ids)', { ids })
        .orderBy('h.assetId','ASC')
        .addOrderBy('h.date','DESC')
        .addOrderBy('h.id','DESC')
        .getMany();
      for (const h of rows) {
        if (!latestById.has(h.assetId)) latestById.set(h.assetId, h);
      }
    }

    const thresholdYears = Number(process.env.ASSET_OLD_THRESHOLD_YEARS) || 5;
    const now = new Date();
    const mapped = list.map(a => {
      let ageMonths: number | null = null;
      if (a.purchaseDate) {
        const p = new Date(a.purchaseDate + 'T00:00:00Z');
        ageMonths = monthsDiff(p, now);
      } else if (a.ageSnapshotMonths != null) {
        ageMonths = a.ageSnapshotMonths;
      }
      const isOld = ageMonths != null ? ageMonths >= thresholdYears * 12 : false;
      const lastHist = latestById.get(a.id);
      return {
        ...a,
        ageMonths,
        isOld,
        lastHistoryDate: lastHist ? lastHist.date : null,
        lastHistoryNote: lastHist ? lastHist.note : null,
      } as any;
    });

    // client-side filtering for age since it's computed here
    let filtered = mapped;
    const ageMin = query.ageMin != null ? Number(query.ageMin) : null;
    const ageMax = query.ageMax != null ? Number(query.ageMax) : null;
    if (ageMin != null && Number.isFinite(ageMin)) filtered = filtered.filter(a => a.ageMonths != null && a.ageMonths >= ageMin);
    if (ageMax != null && Number.isFinite(ageMax)) filtered = filtered.filter(a => a.ageMonths != null && a.ageMonths <= ageMax);
    const oldOnly = String(query.oldOnly || '').toLowerCase();
    if (oldOnly === '1' || oldOnly === 'true' || oldOnly === 'yes') filtered = filtered.filter(a => a.isOld);
    return filtered;
  }

  get(id: number) { return this.repo.findOne({ where: { id } }); }

  async countByStore(storeIds: number[], user?: { role?: string; username?: string }) {
    if (!Array.isArray(storeIds) || storeIds.length === 0) return {}
    let ids = storeIds.filter((n)=> Number.isFinite(Number(n))).map(n=> Number(n))
    if (ids.length === 0) return {}
    // Restrict for TS user
    if (user && user.role === 'user') {
      const stores = await this.storeRepo.find({ where: { tsAssigned: user.username || '' } })
      const allowed = new Set(stores.map(s=>s.id))
      ids = ids.filter(id => allowed.has(id))
      if (ids.length === 0) return {}
    }
    const rows = await this.repo.createQueryBuilder('a')
      .select('a.storeId', 'storeId')
      .addSelect('COUNT(*)', 'count')
      .where('a.storeId IN (:...ids)', { ids })
      .groupBy('a.storeId')
      .getRawMany()
    const map: Record<number, number> = {}
    for (const r of rows) { map[Number(r.storeId)] = Number(r.count) }
    return map
  }

  async create(body: Partial<Asset>) {
    const a = this.repo.create(body as any) as unknown as Asset;
    if (!a.assetCode) a.assetCode = 'AST-' + Math.random().toString(36).slice(2,8).toUpperCase();
    return this.repo.save(a);
  }

  async update(id: number, body: Partial<Asset>) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) return null;
    Object.assign(a, body);
    return this.repo.save(a);
  }

  async remove(id: number) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) return null;
    await this.repo.remove(a);
    return { ok: true };
  }

  // Upsert dari item maintenance
  async upsertFromMaintenanceItem(params: { storeId?: number|null; storeName?: string|null; name: string; category?: string|null; serialNumber?: string|null; maintenanceDate?: Date|null; ageMonthsInput?: number|null; status?: string|null; maintenanceOrder?: number|null; }) {
    const serial = (params.serialNumber||'').trim();
    const cat = (params.category||params.name||'').trim();
    // Jika storeId kosong tapi storeName ada, coba cari storeId berdasar nama/code
    let sid = params.storeId ?? null;
    let storeNameResolved = params.storeName ?? null;
    try {
      if ((sid == null || !Number.isFinite(Number(sid))) && storeNameResolved) {
        const nameLc = storeNameResolved.trim().toLowerCase();
        const found = await this.storeRepo.createQueryBuilder('s')
          .where('LOWER(s.name) = :nm OR LOWER(COALESCE(s.code,\'\')) = :nm', { nm: nameLc })
          .getOne();
        if (found) { sid = found.id; storeNameResolved = found.name || storeNameResolved; }
      }
    } catch {}
    let existing: Asset | null = null;
    if (serial) {
      existing = await this.repo.createQueryBuilder('a')
        .where('LOWER(COALESCE(a.serialNumber, \'\')) = :sn', { sn: serial.toLowerCase() })
        .andWhere(sid != null ? 'a.storeId = :sid' : '1=1', { sid })
        .getOne();
    } else {
      // Hanya fallback nama+category jika memang tidak ada serial number
      existing = await this.repo.createQueryBuilder('a')
        .where('LOWER(a.name) = :nm AND LOWER(COALESCE(a.category, \'\')) = :cat AND a.storeId IS NOT DISTINCT FROM :sid', { nm: params.name.toLowerCase(), cat: cat.toLowerCase(), sid })
        .getOne();
    }
    const estimatePurchase = (() => {
      if (params.maintenanceDate && params.ageMonthsInput != null && Number.isFinite(params.ageMonthsInput)){
        const d = new Date(params.maintenanceDate);
        const months = params.ageMonthsInput as number;
        const year = d.getFullYear();
        const month = d.getMonth() - months;
        const calc = new Date(year, month, 1);
        return `${calc.getFullYear()}-${String(calc.getMonth()+1).padStart(2,'0')}-01`;
      }
      return null;
    })();

    if (!existing) {
      const created = this.repo.create({
        assetCode: 'AST-' + Math.random().toString(36).slice(2,8).toUpperCase(),
        name: params.name,
        category: cat || null,
        serialNumber: serial || null,
        storeId: sid,
        storeName: storeNameResolved,
        status: params.status ? String(params.status) : 'active',
        purchaseDate: estimatePurchase,
        ageSnapshotMonths: params.ageMonthsInput ?? null,
        lastMaintenanceDate: params.maintenanceDate ?? null,
        lastMaintenanceOrder: params.maintenanceOrder ?? null,
      });
      return this.repo.save(created);
    } else {
      existing.name = params.name || existing.name;
      existing.category = cat || existing.category;
      if (serial) existing.serialNumber = serial;
      existing.storeId = sid;
      existing.storeName = storeNameResolved ?? existing.storeName;
      existing.lastMaintenanceDate = params.maintenanceDate ?? existing.lastMaintenanceDate;
      if (params.status) existing.status = String(params.status);
      if (!existing.purchaseDate && estimatePurchase) existing.purchaseDate = estimatePurchase;
      if (params.ageMonthsInput != null) existing.ageSnapshotMonths = params.ageMonthsInput;
      if (params.maintenanceOrder != null) existing.lastMaintenanceOrder = params.maintenanceOrder;
      return this.repo.save(existing);
    }
  }

  // History ops
  listHistory(assetId: number) { return this.histRepo.find({ where: { assetId }, order: { date: 'DESC', id: 'DESC' } as any }); }
  async addHistory(assetId: number, body: { date: string; note: string; createdBy?: string|null }) {
    const rec = this.histRepo.create({ assetId, date: body.date, note: body.note, createdBy: body.createdBy ?? null });
    return this.histRepo.save(rec);
  }
  async updateHistory(assetId: number, id: number, body: { date?: string; note?: string }) {
    const rec = await this.histRepo.findOne({ where: { id, assetId } });
    if (!rec) return null;
    if (body.date) rec.date = body.date;
    if (body.note !== undefined) rec.note = body.note;
    return this.histRepo.save(rec);
  }
  async removeHistory(assetId: number, id: number) {
    const rec = await this.histRepo.findOne({ where: { id, assetId } });
    if (!rec) return null;
    await this.histRepo.remove(rec);
    return { ok: true };
  }
}



