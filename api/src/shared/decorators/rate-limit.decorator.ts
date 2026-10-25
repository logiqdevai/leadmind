import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
    /** Bucket name - requests are counted per bucket per client IP. */
    bucket: string;
    /** Requests allowed per window. */
    limit: number;
    window_seconds: number;
}

/** Throttles an unauthenticated endpoint per client IP. Use together with `RateLimitGuard`. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
