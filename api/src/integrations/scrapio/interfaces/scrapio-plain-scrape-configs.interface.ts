import { ScrapioListQuery } from './scrapio-common.interface';

export type PlainScrapeConfigType =
  | 'SCRAPER'
  | 'BROWSER_AGENT'
  | 'PLAIN_SCRAPE';

export type PlainScrapeExtractionScope = 'COMBINED' | 'PER_URL';

export type PlainScrapeOutputFormat = 'STRUCTURED_JSON' | 'MARKDOWN';

export interface PlainScrapeExtractionSchemaVersion {
  id: string;
  version: number;
  definition: Record<string, any>;
}

export interface PlainScrapeConfig {
  id: string;
  user_id: string;
  type: PlainScrapeConfigType;
  name: string;
  description?: string | null;
  urls: string[];
  /** How multiple URLs are normalized into output. */
  extraction_scope: PlainScrapeExtractionScope;
  output_formats: PlainScrapeOutputFormat[];
  /** Active extraction schema version id, when output includes STRUCTURED_JSON. */
  extraction_schema_version_id: string | null;
  /** Cron expression for scheduled runs. */
  schedule_cron: string | null;
  schedule_timezone: string | null;
  schedule_enabled: boolean;
  /** When false ("scrape and forget"), each run's result payload is deleted once a subscribed webhook endpoint confirms delivery. */
  persist_results: boolean;
  created_at: string;
  updated_at: string;
  /** Present on the get-one response. */
  extraction_schema_version?: PlainScrapeExtractionSchemaVersion;
}

export interface CreatePlainScrapeConfigDto {
  name: string;
  description?: string | null;
  /** URLs to fetch as plain HTML. */
  urls: string[];
  /** How multiple URLs are normalized when output_formats is non-empty: COMBINED merges all pages into one result, PER_URL produces one result per page. */
  extraction_scope?: PlainScrapeExtractionScope;
  /** Leave empty to return raw HTML only (no AI). Include STRUCTURED_JSON and/or MARKDOWN to run the extraction pipeline. */
  output_formats?: PlainScrapeOutputFormat[];
  /** Required when output_formats includes STRUCTURED_JSON. Field-name to type-descriptor map. */
  output_schema?: Record<string, any>;
  /** Cron schedule for automatic runs. Null/omit for manual-only runs. */
  schedule_cron?: string | null;
  /** Scrape-and-forget mode: set false to delete each run's result payload once a subscribed webhook endpoint confirms delivery, instead of keeping it. Requires an active webhook endpoint subscribed to a run-finished event. */
  persist_results?: boolean;
  /** Submit STRUCTURED_JSON extraction as an OpenAI batch job instead of running it immediately. */
  ai_batch_mode?: boolean;
}

export interface UpdatePlainScrapeConfigDto {
  name?: string;
  description?: string | null;
  urls?: string[];
  extraction_scope?: PlainScrapeExtractionScope;
  output_formats?: PlainScrapeOutputFormat[];
  output_schema?: Record<string, any>;
  /** Cron schedule for automatic runs. Null/empty disables scheduling. */
  schedule_cron?: string | null;
  persist_results?: boolean;
  ai_batch_mode?: boolean;
}

export interface DeletePlainScrapeConfigsDto {
  /** IDs of the plain scrape configs to delete. */
  workflow_config_ids: string[];
}

export interface PlainScrapeConfigsListQuery extends ScrapioListQuery {
  /** Filter by owning user id (admin/support only). */
  user_id?: string;
  /** Case-insensitive match against name. */
  search?: string;
}
