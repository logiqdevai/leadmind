import { ScrapioListQuery } from './scrapio-common.interface';

export type ScraperStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DEPRECATED'
  | 'TESTING'
  | 'BROKEN';

export type ScraperHealth =
  | 'EXCELLENT'
  | 'GOOD'
  | 'WARNING'
  | 'CRITICAL'
  | 'BROKEN';

export type ScraperDiagnosticsMode = 'PRODUCTION' | 'TRACE' | 'FULL_DEBUG';

export type ScraperVersionCreatedBy = 'AI' | 'USER';

export interface ScraperVersion {
  id: string;
  scraper_id: string;
  version: number;
  /** Full scraper definition: start_url, listing_selector, fields, pagination, ... */
  config: Record<string, any>;
  created_by: ScraperVersionCreatedBy;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scraper {
  id: string;
  user_id: string;
  website_target_id: string;
  name: string;
  active_version_id: string | null;
  version_count: number;
  status: ScraperStatus;
  self_healing_enabled: boolean;
  /** Debugging depth for this scraper's crawl runs. */
  diagnostics_mode: ScraperDiagnosticsMode;
  health: ScraperHealth | null;
  success_rate: number | null;
  avg_runtime_ms: number | null;
  consecutive_failures: number;
  /** Cron expression when scheduled; null means manual only. */
  schedule_cron: string | null;
  schedule_timezone: string | null;
  /** Whether the cron schedule is active. */
  schedule_enabled: boolean;
  /** When false ("scrape and forget"), each run's result payload is deleted once a subscribed webhook endpoint confirms delivery. */
  persist_results: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
  /** Present on GET /scrapers/:id. */
  active_version?: ScraperVersion;
  /** Present on list/detail views. */
  website_target?: Record<string, any>;
}

export interface CreateScraperDto {
  /** Website target this scraper belongs to. */
  website_target_id: string;
  name: string;
  /** Cron schedule for automatic crawls. Null/omit for manual-only runs. */
  schedule_cron?: string;
  /** Initial scraper config (start_url, listing_selector, fields, pagination, ...). Omit to create the scraper without an initial version. */
  config?: Record<string, any>;
  /** Scrape-and-forget mode: set false to delete each run's result payload once a subscribed webhook endpoint confirms delivery, instead of keeping it. Requires an active webhook endpoint subscribed to a run-finished event. */
  persist_results?: boolean;
  /** Submit STRUCTURED_JSON extraction as an OpenAI batch job instead of running it immediately. */
  ai_batch_mode?: boolean;
}

export interface UpdateScraperDto {
  status?: ScraperStatus;
  self_healing_enabled?: boolean;
  diagnostics_mode?: ScraperDiagnosticsMode;
  schedule_cron?: string;
  /** Overwrites config.validation_rules on the active version. Stored via a new ScraperVersion — Scraper itself never holds config. */
  validation_rules?: Record<string, any>;
  persist_results?: boolean;
  ai_batch_mode?: boolean;
}

export interface CreateScraperVersionDto {
  /** Full scraper config for this version. Omit or leave empty to store an empty config object. */
  config?: Record<string, any>;
  /** Reason for the change / summary of what changed. */
  notes?: string;
}

export interface DeleteScrapersDto {
  scraper_ids: string[];
}

export interface ScrapersListQuery extends ScrapioListQuery {
  user_id?: string;
  website_target_id?: string;
  health?: ScraperHealth;
  status?: ScraperStatus;
  search?: string;
}
