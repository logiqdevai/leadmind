import { ScrapioListQuery } from './scrapio-common.interface';

export type BrowserAgentConfigType =
  | 'SCRAPER'
  | 'BROWSER_AGENT'
  | 'PLAIN_SCRAPE';

export type BrowserAgentOutputFormat = 'STRUCTURED_JSON' | 'MARKDOWN';

export interface BrowserAgentExtractionSchemaVersion {
  id: string;
  version: number;
  definition: Record<string, any>;
}

export interface BrowserAgentConfig {
  id: string;
  user_id: string;
  type: BrowserAgentConfigType;
  name: string;
  description?: string | null;
  url: string;
  /** Max computer-use steps before the run is stopped. */
  max_steps: number | null;
  /** When true, every HTTP request/response the agent's browser makes during the run is recorded and, on completion, distilled into a downloadable OpenAPI spec. */
  capture_api: boolean;
  output_formats: BrowserAgentOutputFormat[];
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
  extraction_schema_version?: BrowserAgentExtractionSchemaVersion;
}

export interface CreateBrowserAgentConfigDto {
  name: string;
  /** Optional extra instructions to guide the browsing agent. */
  description?: string | null;
  /** Website URL the agent should explore. */
  url: string;
  /** Hard cap on computer-use steps for runs of this config. */
  max_steps: number;
  /** STRUCTURED_JSON and/or MARKDOWN. At least one is required for a browser agent run. */
  output_formats?: BrowserAgentOutputFormat[];
  /** Required when output_formats includes STRUCTURED_JSON. Field-name to type-descriptor map. */
  output_schema?: Record<string, any>;
  /** Cron schedule for automatic runs. Null/omit for manual-only runs. */
  schedule_cron?: string | null;
  /** Scrape-and-forget mode: set false to delete each run's result payload once a subscribed webhook endpoint confirms delivery, instead of keeping it. Requires an active webhook endpoint subscribed to a run-finished event. */
  persist_results?: boolean;
  /** Submit STRUCTURED_JSON extraction as an OpenAI batch job instead of running it immediately. */
  ai_batch_mode?: boolean;
  /** When true, every HTTP request/response the agent's browser makes during the run is recorded and, on completion, distilled into a downloadable OpenAPI spec. */
  capture_api?: boolean;
}

export interface UpdateBrowserAgentConfigDto {
  name?: string;
  description?: string | null;
  url?: string;
  max_steps?: number;
  output_formats?: BrowserAgentOutputFormat[];
  output_schema?: Record<string, any>;
  /** Cron schedule for automatic runs. Null/empty disables scheduling. */
  schedule_cron?: string | null;
  persist_results?: boolean;
  ai_batch_mode?: boolean;
  capture_api?: boolean;
}

export interface DeleteBrowserAgentConfigsDto {
  /** IDs of the browser agent configs to delete. */
  workflow_config_ids: string[];
}

export interface BrowserAgentConfigsListQuery extends ScrapioListQuery {
  /** Filter by owning user id (admin/support only). */
  user_id?: string;
  /** Case-insensitive match against name. */
  search?: string;
}
