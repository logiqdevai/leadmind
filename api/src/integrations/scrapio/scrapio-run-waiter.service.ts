import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/core/databases/redis/redis.constants';

export interface ScrapioRunResultEnvelope {
  status: string;
  pages: unknown[];
}

const RESULT_KEY_PREFIX = 'scrapio:run:result:';
const CHANNEL_PREFIX = 'scrapio:run:chan:';
const RESULT_TTL_SECONDS = 120;

/**
 * Correlates an in-flight Scrapio plain-scrape request with the async webhook delivery
 * that carries its result, via Redis (so it works across horizontally-scaled API instances).
 */
@Injectable()
export class ScrapioRunWaiterService {
  private readonly logger = new Logger(ScrapioRunWaiterService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  /** Called from the Scrapio webhook controller once a run's result has been fetched. */
  async publishResult(
    workflow_run_id: string,
    envelope: ScrapioRunResultEnvelope,
  ): Promise<void> {
    if (!this.redis) {
      this.logger.warn(
        `Redis not configured, cannot publish Scrapio run result for ${workflow_run_id}`,
      );
      return;
    }
    const payload = JSON.stringify(envelope);
    await this.redis.set(
      RESULT_KEY_PREFIX + workflow_run_id,
      payload,
      'EX',
      RESULT_TTL_SECONDS,
    );
    await this.redis.publish(CHANNEL_PREFIX + workflow_run_id, '1');
  }

  /** Called from the Scrapio website-crawler adapter after triggering a run-now. */
  async waitForResult(
    workflow_run_id: string,
    timeoutMs: number,
  ): Promise<ScrapioRunResultEnvelope> {
    const redis = this.redis;
    if (!redis) {
      throw new Error('Redis not configured, cannot wait for Scrapio run result');
    }

    const resultKey = RESULT_KEY_PREFIX + workflow_run_id;
    const channel = CHANNEL_PREFIX + workflow_run_id;

    const existing = await redis.get(resultKey);
    if (existing) {
      return JSON.parse(existing) as ScrapioRunResultEnvelope;
    }

    const subscriber = redis.duplicate();
    try {
      await subscriber.subscribe(channel);

      return await new Promise<ScrapioRunResultEnvelope>((resolve, reject) => {
        const timer = setTimeout(() => {
          subscriber.removeListener('message', onMessage);
          reject(new Error(`Timed out waiting for Scrapio run ${workflow_run_id}`));
        }, timeoutMs);

        const onMessage = (receivedChannel: string) => {
          if (receivedChannel !== channel) return;
          clearTimeout(timer);
          subscriber.removeListener('message', onMessage);
          redis
            .get(resultKey)
            .then((raw) => {
              if (!raw) {
                reject(
                  new Error(`Scrapio run ${workflow_run_id} result missing after notification`),
                );
                return;
              }
              resolve(JSON.parse(raw) as ScrapioRunResultEnvelope);
            })
            .catch(reject);
        };

        subscriber.on('message', onMessage);
      });
    } finally {
      await subscriber.unsubscribe().catch(() => undefined);
      subscriber.disconnect();
    }
  }
}
