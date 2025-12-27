import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService, private readonly users: UsersService) {
    this.users.ensureSeed();
  }

  async login(loginDto: { username: string; password: string; role?: string }) {
    // Lookup by username only (case-insensitive); ignore provided role
    const user = await this.users.findByUsernameInsensitive(loginDto.username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: (user as any).name || null,
        role: user.role,
      },
    };
  }
}
