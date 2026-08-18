import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_OPTIONS } from './redis.constants';
import type { RedisOptions } from 'ioredis';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_OPTIONS,
            useFactory: (configService: ConfigService): RedisOptions | null => {
                const logger = new Logger('RedisModule');

                const redisUrl = configService.get<string>('REDIS_URL');

                if (!redisUrl) {
                    logger.warn('REDIS not initialized');
                    return null;
                }

                const url = new URL(redisUrl);
                return {
                    host: url.hostname,
                    port: parseInt(url.port, 10) || 6379,
                    password: url.password || undefined,
                    username: url.username || undefined,
                    maxRetriesPerRequest: null,
                    reconnectOnError: () => false,
                };
            },
            inject: [ConfigService],
        },
        {
            provide: REDIS_CLIENT,
            useFactory: (redisOptions: RedisOptions | null): Redis | null => {
                const logger = new Logger('RedisModule');

                if (!redisOptions) {
                    logger.warn('REDIS_CLIENT not initialized');
                    return null;
                }

                return new Redis(redisOptions);
            },
            inject: [REDIS_OPTIONS],
        },
    ],
    exports: [REDIS_OPTIONS, REDIS_CLIENT],
})
export class RedisModule { }
