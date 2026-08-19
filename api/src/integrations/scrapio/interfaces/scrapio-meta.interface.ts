export type ScrapioHealthStatus = 'ok' | 'error' | 'down';

export interface ScrapioApiHealth {
  service: 'api';
  status: ScrapioHealthStatus;
  timestamp: string;
  uptime_ms: number;
}

export interface ScrapioDependencyHealth {
  service: 'postgres' | 'redis';
  status: ScrapioHealthStatus;
  timestamp: string;
  ms?: number;
  message?: string;
}

export type ScrapioHealth = ScrapioApiHealth | ScrapioDependencyHealth;
