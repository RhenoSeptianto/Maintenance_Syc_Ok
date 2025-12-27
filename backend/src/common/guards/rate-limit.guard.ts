import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  private limit = Number(process.env.RATE_LIMIT || 60);
  private windowMs = Number(process.env.RATE_TTL || 60) * 1000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const path: string = (req.originalUrl || req.url || '').toLowerCase();
    const method: string = String(req.method || '').toUpperCase();
    // Skip health and login (login has separate guard)
    if (path === '/' || path.startsWith('/auth/login')) return true;
    // Stabilitas UI: jangan rate-limit GET ringan untuk master data dan aset
    if (method === 'GET' && (path.startsWith('/users') || path.startsWith('/stores') || path.startsWith('/assets'))) return true;

    // Determine client IP. Only trust X-Forwarded-For when TRUST_PROXY is enabled.
    const trustProxy = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || ''));
    const ip = trustProxy
      ? ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown')
      : (req.ip || 'unknown');
    const key = `rl:${ip}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { resetAt: now + this.windowMs, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > this.limit) {
      throw new HttpException('Terlalu banyak request, coba lagi nanti.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
