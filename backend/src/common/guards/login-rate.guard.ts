import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private limit = 5; // 5 attempts
  private windowMs = 60_000; // per minute

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const trustProxy = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || ''));
    const ip = trustProxy
      ? ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown')
      : (req.ip || 'unknown');
    const uname = (req.body && typeof req.body.username === 'string') ? String(req.body.username).trim().toLowerCase() : '';
    const key = `login:${ip}:${uname}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { resetAt: now + this.windowMs, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > this.limit) {
      throw new HttpException('Terlalu banyak percobaan login. Coba lagi sebentar.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
