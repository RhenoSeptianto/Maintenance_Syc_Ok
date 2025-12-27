import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { Store } from '../store/store.entity';
import { Asset } from '../asset/asset.entity';
import { AssetHistory } from '../asset/asset-history.entity';
import { Schedule } from '../schedule/schedule.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { AssetService } from '../asset/asset.service';

type ColumnType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum';
type ColumnMeta = {
  key: string;
  label: string;
  type: ColumnType;
  readonly?: boolean;
  required?: boolean;
  nullable?: boolean;
  options?: string[];
  writeOnly?: boolean;
  helperText?: string;
};
type TableMeta = {
  name: string;
  label: string;
  primaryKey: string;
  columns: ColumnMeta[];
};
type TableConfig = TableMeta & {
  repository: Repository<any>;
  searchColumns?: string[];
  beforeWrite?: (payload: Record<string, any>, isUpdate: boolean) => Promise<void> | void;
};

@Injectable()
export class DbAdminService {
  private readonly tables: TableConfig[];

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Store) private readonly storesRepo: Repository<Store>,
    @InjectRepository(Asset) private readonly assetsRepo: Repository<Asset>,
    @InjectRepository(AssetHistory) private readonly assetHistoryRepo: Repository<AssetHistory>,
    @InjectRepository(Schedule) private readonly schedulesRepo: Repository<Schedule>,
    @InjectRepository(Maintenance) private readonly maintenanceRepo: Repository<Maintenance>,
    private readonly assetSvc: AssetService,
  ) {
    this.tables = [
      {
        name: 'users',
        label: 'Users',
        primaryKey: 'id',
        repository: this.usersRepo,
        searchColumns: ['username', 'name', 'role'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'username', label: 'Username', type: 'string', required: true },
          { key: 'name', label: 'Nama', type: 'string', nullable: true },
          { key: 'role', label: 'Role', type: 'enum', options: ['admin', 'user', 'ts'], required: true },
          { key: 'password', label: 'Password (set baru)', type: 'string', writeOnly: true },
        ],
        beforeWrite: (payload) => {
          if (payload.password) {
            payload.password = bcrypt.hashSync(payload.password, 12);
          } else {
            delete payload.password;
          }
        },
      },
      {
        name: 'stores',
        label: 'Stores',
        primaryKey: 'id',
        repository: this.storesRepo,
        searchColumns: ['code', 'name', 'location', 'tsAssigned'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'code', label: 'Kode', type: 'string', required: true },
          { key: 'name', label: 'Nama', type: 'string', required: true },
          { key: 'location', label: 'Lokasi', type: 'string', nullable: true },
          { key: 'tsAssigned', label: 'TS Assigned', type: 'string', nullable: true },
        ],
      },
      {
        name: 'assets',
        label: 'Assets',
        primaryKey: 'id',
        repository: this.assetsRepo,
        searchColumns: ['assetCode', 'name', 'category', 'serialNumber', 'storeName', 'status'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'assetCode', label: 'Kode Aset', type: 'string', required: true },
          { key: 'name', label: 'Nama', type: 'string', required: true },
          { key: 'category', label: 'Kategori', type: 'string', nullable: true },
          { key: 'serialNumber', label: 'Serial Number', type: 'string', nullable: true },
          { key: 'storeId', label: 'Store ID', type: 'number', nullable: true },
          { key: 'storeName', label: 'Nama Store', type: 'string', nullable: true },
          { key: 'status', label: 'Status', type: 'enum', options: ['active', 'in_repair', 'retired', 'lost', 'disposed'], required: true },
          { key: 'purchaseDate', label: 'Tanggal Beli', type: 'date', nullable: true },
          { key: 'ageSnapshotMonths', label: 'Usia (bulan)', type: 'number', nullable: true },
          { key: 'lastMaintenanceDate', label: 'Maintenance Terakhir', type: 'datetime', nullable: true },
          { key: 'createdAt', label: 'Dibuat', type: 'datetime', readonly: true },
          { key: 'updatedAt', label: 'Diupdate', type: 'datetime', readonly: true },
        ],
      },
      {
        name: 'maintenances',
        label: 'Maintenance',
        primaryKey: 'id',
        repository: this.maintenanceRepo,
        searchColumns: ['title', 'storeName', 'technician', 'status', 'submittedBy', 'approvedBy'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'title', label: 'Judul', type: 'string', required: true },
          { key: 'details', label: 'Deskripsi', type: 'text', nullable: true },
          { key: 'date', label: 'Tanggal', type: 'datetime', required: true },
          { key: 'storeId', label: 'Store ID', type: 'number', nullable: true },
          { key: 'storeName', label: 'Nama Store', type: 'string', nullable: true },
          { key: 'technician', label: 'Teknisi', type: 'string', nullable: true },
          { key: 'status', label: 'Status', type: 'string', nullable: true },
          { key: 'submittedBy', label: 'Diajukan Oleh', type: 'string', nullable: true },
          { key: 'approvedBy', label: 'Disetujui Oleh', type: 'string', nullable: true },
          { key: 'scheduleId', label: 'Schedule ID', type: 'number', nullable: true },
          { key: 'createdAt', label: 'Dibuat', type: 'datetime', readonly: true },
          { key: 'updatedAt', label: 'Diupdate', type: 'datetime', readonly: true },
        ],
      },
      {
        name: 'schedules',
        label: 'Jadwal',
        primaryKey: 'id',
        repository: this.schedulesRepo,
        searchColumns: ['title', 'status', 'assignedTs'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'title', label: 'Judul', type: 'string', required: true },
          { key: 'start', label: 'Mulai', type: 'datetime', required: true },
          { key: 'end', label: 'Selesai', type: 'datetime', nullable: true },
          { key: 'status', label: 'Status', type: 'string', nullable: true },
          { key: 'assignedTs', label: 'TS', type: 'string', nullable: true },
          { key: 'storeId', label: 'Store ID', type: 'number', nullable: true },
          { key: 'completedAt', label: 'Selesai Pada', type: 'datetime', nullable: true },
        ],
      },
      {
        name: 'asset-history',
        label: 'Riwayat Aset',
        primaryKey: 'id',
        repository: this.assetHistoryRepo,
        searchColumns: ['note', 'createdBy'],
        columns: [
          { key: 'id', label: 'ID', type: 'number', readonly: true },
          { key: 'assetId', label: 'Asset ID', type: 'number', required: true },
          { key: 'date', label: 'Tanggal', type: 'date', required: true },
          { key: 'note', label: 'Catatan', type: 'text', required: true },
          { key: 'createdBy', label: 'Dibuat Oleh', type: 'string', nullable: true },
          { key: 'createdAt', label: 'Dibuat', type: 'datetime', readonly: true },
          { key: 'updatedAt', label: 'Diupdate', type: 'datetime', readonly: true },
        ],
      },
    ];
  }

  /**
   * Rebuild assets from existing maintenance records.
   * Aman karena hanya melakukan upsert (create/update) asset berdasarkan SN,
   * tidak menghapus asset yang sudah ada.
   */
  async rebuildAssetsFromMaintenances(opts: { storeId?: number; fromDate?: string; toDate?: string; dryRun?: boolean }) {
    const { storeId, fromDate, toDate } = opts || {};
    const dryRun = !!opts?.dryRun;

    const qb = this.maintenanceRepo.createQueryBuilder('m');
    if (storeId != null && Number.isFinite(Number(storeId))) {
      qb.andWhere('m.storeId = :sid', { sid: Number(storeId) });
    }
    if (fromDate) {
      const d0 = new Date(fromDate);
      if (isNaN(d0.getTime())) throw new BadRequestException('fromDate tidak valid');
      qb.andWhere('m.date >= :d0', { d0 });
    }
    if (toDate) {
      const d1 = new Date(toDate);
      if (isNaN(d1.getTime())) throw new BadRequestException('toDate tidak valid');
      qb.andWhere('m.date <= :d1', { d1 });
    }
    qb.orderBy('m.date', 'ASC').addOrderBy('m.id', 'ASC');
    const maints = await qb.getMany();

    let totalItems = 0;
    let totalItemsWithSn = 0;
    let upsertCalls = 0;

    for (const m of maints) {
      let items: any[] = [];
      try {
        const d = JSON.parse(String((m as any).details || '{}'));
        items = Array.isArray(d?.items) ? d.items : [];
      } catch {
        items = [];
      }
      if (!items || items.length === 0) continue;
      totalItems += items.length;

      for (const it of items) {
        const name = String(it?.hardware || it?.name || '').trim();
        const serial = String(it?.sn || it?.serialNumber || '').trim();
        if (!name || !serial) continue;
        totalItemsWithSn++;
        if (dryRun) continue;
        const kondisi = String(it?.kondisi || '').toLowerCase().trim();
        const status = kondisi === 'tidak' ? 'in_repair' : (kondisi === 'baik' ? 'active' : undefined);
        await this.assetSvc.upsertFromMaintenanceItem({
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
        upsertCalls++;
      }
    }

    return {
      dryRun,
      storeId: storeId != null ? Number(storeId) : null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      maintenancesProcessed: maints.length,
      totalItems,
      totalItemsWithSn,
      upsertCalls: dryRun ? 0 : upsertCalls,
    };
  }

  listTables(): TableMeta[] {
    return this.tables.map(({ repository, beforeWrite, searchColumns, ...meta }) => meta);
  }

  private getTable(tableName: string): TableConfig {
    const t = this.tables.find((tbl) => tbl.name === tableName);
    if (!t) throw new BadRequestException('Tabel tidak diizinkan');
    return t;
  }

  async list(tableName: string, opts: { page?: number; pageSize?: number; search?: string }) {
    const table = this.getTable(tableName);
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(opts.pageSize) || 20));
    const search = (opts.search || '').trim();
    const skip = (page - 1) * pageSize;

    const qb = table.repository.createQueryBuilder('t');
    const selectCols = table.columns.filter((c) => !c.writeOnly).map((c) => `t.${c.key}`);
    qb.select(selectCols);
    if (search) {
      const sc = (table.searchColumns && table.searchColumns.length > 0
        ? table.searchColumns
        : table.columns.filter((c) => ['string', 'text'].includes(c.type)).map((c) => c.key)
      ).filter(Boolean);
      if (sc.length > 0) {
        qb.andWhere(new Brackets((wq) => {
          sc.forEach((col, idx) => {
            const param = `q${idx}`;
            wq.orWhere(`LOWER(COALESCE(t.${col}, '')) LIKE :${param}`, { [param]: `%${search.toLowerCase()}%` });
          });
        }));
      }
    }
    qb.orderBy(`t.${table.primaryKey}`, 'DESC');
    qb.skip(skip).take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((r) => this.stripRow(r, table.columns)),
      total,
      page,
      pageSize,
    };
  }

  async create(tableName: string, payload: Record<string, any>) {
    const table = this.getTable(tableName);
    const data = await this.preparePayload(table, payload, false);
    const entity = table.repository.create(data as any);
    const saved = await table.repository.save(entity);
    return this.stripRow(saved, table.columns);
  }

  async update(tableName: string, id: number, payload: Record<string, any>) {
    const table = this.getTable(tableName);
    const pk = table.primaryKey;
    const existing = await table.repository.findOne({ where: { [pk]: id } as any });
    if (!existing) throw new NotFoundException('Data tidak ditemukan');
    const data = await this.preparePayload(table, payload, true);
    await table.repository.update({ [pk]: id } as any, data as any);
    const refreshed = await table.repository.findOne({ where: { [pk]: id } as any });
    return this.stripRow(refreshed, table.columns);
  }

  async remove(tableName: string, id: number) {
    const table = this.getTable(tableName);
    const pk = table.primaryKey;
    const existing = await table.repository.findOne({ where: { [pk]: id } as any });
    if (!existing) throw new NotFoundException('Data tidak ditemukan');
    await table.repository.delete({ [pk]: id } as any);
    return { success: true };
  }

  private stripRow(row: any, columns: ColumnMeta[]) {
    if (!row) return row;
    const allowed = columns.filter((c) => !c.writeOnly).map((c) => c.key);
    const out: Record<string, any> = {};
    allowed.forEach((k) => { if (row[k] !== undefined) out[k] = (row as any)[k]; });
    return out;
  }

  private async preparePayload(table: TableConfig, payload: Record<string, any>, isUpdate: boolean) {
    const clean: Record<string, any> = {};
    const requiredMissing: string[] = [];
    for (const col of table.columns) {
      if (col.readonly) continue;
      if (!(col.key in payload)) {
        if (!isUpdate && col.required) requiredMissing.push(col.label);
        continue;
      }
      let val = payload[col.key];
      if (val === '') val = null;
      if (val === undefined) continue;
      if (val === null && !col.nullable && col.required) requiredMissing.push(col.label);
      switch (col.type) {
        case 'number':
          if (val === null) { clean[col.key] = null; break; }
          const num = Number(val);
          if (isNaN(num)) throw new BadRequestException(`${col.label} harus berupa angka`);
          clean[col.key] = num;
          break;
        case 'boolean':
          if (val === null) { clean[col.key] = null; break; }
          if (typeof val === 'string') val = val.toLowerCase();
          clean[col.key] = val === true || val === 'true' || val === '1' || val === 1;
          break;
        case 'date':
          if (val === null) { clean[col.key] = null; break; }
          if (typeof val !== 'string') throw new BadRequestException(`${col.label} harus berupa tanggal (YYYY-MM-DD)`);
          clean[col.key] = val;
          break;
        case 'datetime':
          if (val === null) { clean[col.key] = null; break; }
          const d = new Date(val);
          if (isNaN(d.getTime())) throw new BadRequestException(`${col.label} harus berupa datetime yang valid`);
          clean[col.key] = d;
          break;
        case 'enum':
          if (val === null) { clean[col.key] = null; break; }
          if (col.options && !col.options.includes(val)) {
            throw new BadRequestException(`${col.label} tidak valid`);
          }
          clean[col.key] = val;
          break;
        default:
          clean[col.key] = val ?? null;
      }
    }
    if (!isUpdate && requiredMissing.length > 0) {
      throw new BadRequestException(`Field wajib: ${requiredMissing.join(', ')}`);
    }
    if (table.beforeWrite) await table.beforeWrite(clean, isUpdate);
    return clean;
  }
}
