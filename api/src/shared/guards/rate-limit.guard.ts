import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    Logger,
    Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/core/databases/redis/redis.constants';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

/**
 * Fixed-window per-IP limiter backed by Redis (shared across API instances).
 * Falls back to an in-process counter when Redis is not configured (local dev).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);
    private readonly memory = new Map<string, { count: number; reset_at: number }>();

    constructor(
        private readonly reflector: Reflector,
        @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!options) return true;

        const request = context.switchToHttp().getRequest();
        const key = `rate-limit:${options.bucket}:${clientIp(request)}`;
        const count = await this.increment(key, options.window_seconds);

        if (count > options.limit) {
            throw new HttpException(
                { message: 'Too many requests, please try again shortly.', code: 'rate_limited' },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
        return true;
    }

    private async increment(key: string, window_seconds: number): Promise<number> {
        if (this.redis) {
            try {
                const count = await this.redis.incr(key);
                if (count === 1) await this.redis.expire(key, window_seconds);
                return count;
            } catch (error) {
                this.logger.warn(`Rate limit Redis failure, falling back to memory: ${(error as Error).message}`);
            }
        }
        const now = Date.now();
        const entry = this.memory.get(key);
        if (!entry || entry.reset_at <= now) {
            this.memory.set(key, { count: 1, reset_at: now + window_seconds * 1000 });
            return 1;
        }
        entry.count += 1;
        return entry.count;
    }
}

function clientIp(request: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    return first || request.ip || 'unknown';
}
