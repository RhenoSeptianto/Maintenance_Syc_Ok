import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './store.entity';
import { CreateStoreDto } from './dto/create-store.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store) private repo: Repository<Store>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateStoreDto) {
    const s = this.repo.create(dto as any);
    try { return await this.repo.save(s); }
    catch (e: any) {
      if (String(e?.message || '').includes('duplicate') || String(e?.code) === '23505') {
        throw new ConflictException('Store code already exists');
      }
      throw e;
    }
  }

  findAll() {
    return this.repo.find();
  }

  findAllAssignedTo(username: string) {
    const uname = String(username || '');
    if (!uname) return this.repo.find({ where: { tsAssigned: null as any } });
    return this.repo.find({ where: { tsAssigned: uname } });
  }

  findByCode(code: string) {
    return this.repo.findOne({ where: { code } });
  }

  async findOne(id: number) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Store not found');
    return s;
  }

  async update(id: number, dto: Partial<CreateStoreDto>) {
    const s = await this.findOne(id);
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(id: number) {
    const s = await this.findOne(id);
    return this.repo.remove(s);
  }

  // ---------- Export / Import ----------
  exportTemplateCSV(): string {
    // Basic header for store master import
    return 'code,name,location,tsAssigned\n';
  }

  async exportCSV(): Promise<string> {
    const rows = await this.findAll();
    const header = 'id,code,name,location,tsAssigned\n';
    const body = rows.map(r => [r.id, r.code, r.name, r.location ?? '', r.tsAssigned ?? '']
      .map(v => this.csvEscape(String(v)))
      .join(',')).join('\n');
    return header + body + (body ? '\n' : '');
  }

  async importFromCSV(csv: string, opts?: { createUsers?: boolean; defaultPassword?: string; defaultRole?: 'admin'|'user'|'ts'; upsert?: boolean }): Promise<{created: number; updated: number; usersCreated: number; errors: Array<{line: number; error: string}>}> {
    const createUsers = !!opts?.createUsers;
    const defaultPassword = opts?.defaultPassword || 'pass123';
    const defaultRole = opts?.defaultRole || 'user';
    const upsert = opts?.upsert !== false; // default true
    const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // parse header
    let i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) return { created: 0, updated: 0, usersCreated: 0, errors: [] };
    const header = this.parseCsvLine(lines[i++]);
    const cols = header.map(h => h.trim().toLowerCase());
    const colIndex = (name: string) => cols.indexOf(name);
    const idx = {
      code: colIndex('code'), name: colIndex('name'), location: colIndex('location'), tsAssigned: colIndex('tsassigned'),
      role: colIndex('role'), password: colIndex('password'),
    };
    if (idx.code < 0 || idx.name < 0) {
      return { created: 0, updated: 0, usersCreated: 0, errors: [{ line: i, error: 'Missing required columns: code,name' }] };
    }
    let created = 0, updated = 0, usersCreated = 0;
    const errors: Array<{line: number; error: string}> = [];
    for (let ln = i; ln < lines.length; ln++) {
      const raw = lines[ln];
      if (!raw || raw.trim() === '') continue;
      const fields = this.parseCsvLine(raw);
      const get = (j: number) => j >= 0 && j < fields.length ? fields[j].trim() : '';
      const code = get(idx.code);
      const name = get(idx.name);
      const location = get(idx.location) || undefined;
      const tsAssigned = get(idx.tsAssigned) || undefined;
      const role = (get(idx.role) as 'admin'|'user'|'ts') || defaultRole;
      const password = get(idx.password) || defaultPassword;
      if (!code || !name) { errors.push({ line: ln + 1, error: 'code/name empty' }); continue; }
      try {
        const existing = await this.findByCode(code);
        if (existing) {
          if (upsert) {
            existing.name = name;
            existing.location = location ?? null;
            existing.tsAssigned = tsAssigned ?? null;
            await this.repo.save(existing);
            updated++;
          } else {
            // skip
          }
        } else {
          await this.create({ code, name, location, tsAssigned } as any);
          created++;
        }
        if (createUsers && tsAssigned) {
          // ensure user exists
          const user = await this.usersService.findByUsernameRole(tsAssigned, role).catch(() => null as any);
          if (!user) {
            await this.usersService.create({ username: tsAssigned, password, role, name: tsAssigned });
            usersCreated++;
          }
        }
      } catch (e: any) {
        errors.push({ line: ln + 1, error: String(e?.message || e) });
      }
    }
    return { created, updated, usersCreated, errors };
  }

  private csvEscape(s: string): string {
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQ = false; }
        } else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ''; }
        else if (ch === '"') { inQ = true; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }
}
