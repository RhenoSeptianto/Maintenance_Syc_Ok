import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async ensureSeed() {
    const adminUsername = String(process.env.ADMIN_USERNAME || 'admin');
    const adminPassword = String(process.env.ADMIN_PASSWORD || 'admin123');
    const resetAdminPw = /^(1|true|yes)$/i.test(String(process.env.RESET_ADMIN_PASSWORD || ''));

    // Ensure an admin account exists
    let admin = await this.repo.createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.username = :username AND u.role = :role', { username: adminUsername, role: 'admin' })
      .getOne();

    if (!admin) {
      const hashed = bcrypt.hashSync(adminPassword, 12);
      admin = this.repo.create({ username: adminUsername, name: 'Administrator', role: 'admin', password: hashed });
      await this.repo.save(admin);
    } else if (resetAdminPw) {
      admin.password = bcrypt.hashSync(adminPassword, 12);
      await this.repo.save(admin);
    }

    // If database empty, also create a default non-admin user for convenience
    const count = await this.repo.count();
    if (count === 1) {
      const user = this.repo.create({ username: 'user', name: 'User', role: 'user', password: bcrypt.hashSync('user123', 12) });
      await this.repo.save(user);
    }
  }

  findAll() { return this.repo.find(); }

  findByUsernameRole(username: string, role: string) {
    return this.repo.createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.username = :username AND u.role = :role', { username, role })
      .getOne();
  }

  findByUsernameInsensitive(username: string) {
    return this.repo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('LOWER(u.username) = LOWER(:username)', { username })
      .getOne();
  }

  async create(dto: { username: string; password: string; role: string; name?: string }) {
    const u = this.repo.create({ username: dto.username, name: dto.name || null, role: dto.role, password: bcrypt.hashSync(dto.password, 12) });
    return this.repo.save(u);
  }

  async update(id: number, dto: Partial<{ username: string; password: string; role: string; name?: string }>) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    if (dto.username) u.username = dto.username;
    if (dto.name !== undefined) u.name = dto.name ?? null;
    if (dto.password) u.password = bcrypt.hashSync(dto.password, 12);
    if (dto.role) u.role = dto.role;
    return this.repo.save(u);
  }

  async remove(id: number) {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return this.repo.remove(u);
  }
}
