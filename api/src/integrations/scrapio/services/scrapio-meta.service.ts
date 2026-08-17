import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import {
  ScrapioApiHealth,
  ScrapioDependencyHealth,
  ScrapioHealth,
} from '../interfaces/scrapio-meta.interface';

@Injectable()
export class ScrapioMetaService {
  constructor(private readonly client: ScrapioClient) {}

  /** Root health check — returns a plain "reachable" string. */
  async getRoot(): Promise<string> {
    return this.client.get<string>('/', { skip_auth: true });
  }

  /** Overall API health (no query params). */
  async getHealth(): Promise<ScrapioApiHealth> {
    return this.client.get<ScrapioApiHealth>('/health', { skip_auth: true });
  }

  /** Postgres-only health check. */
  async getPostgresHealth(): Promise<ScrapioDependencyHealth> {
    return this.client.get<ScrapioDependencyHealth>('/health', {
      params: { postgres: true },
      skip_auth: true,
    });
  }

  /** Redis-only health check. */
  async getRedisHealth(): Promise<ScrapioDependencyHealth> {
    return this.client.get<ScrapioDependencyHealth>('/health', {
      params: { redis: true },
      skip_auth: true,
    });
  }

  /** Generic entry point mirroring the API's `?postgres=` / `?redis=` toggle. */
  async health(target?: 'postgres' | 'redis'): Promise<ScrapioHealth> {
    if (target === 'postgres') return this.getPostgresHealth();
    if (target === 'redis') return this.getRedisHealth();
    return this.getHealth();
  }
}
