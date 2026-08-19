import { ScrapioListQuery } from './scrapio-common.interface';

export type ScraperGenerationTrigger = 'MANUAL' | 'SELF_HEAL' | 'SCHEDULED';

export type ScraperGenerationStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_REVIEW'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type ScrapioGenerationOutputFormat = 'STRUCTURED_JSON' | 'MARKDOWN';

export type ComputerUseActionType =
  | 'CLICK'
  | 'DOUBLE_CLICK'
  | 'TYPE'
  | 'SCROLL'
  | 'SCROLL_UP'
  | 'SCROLL_DOWN'
  | 'NAVIGATE'
  | 'GO_BACK'
  | 'CLOSE_TAB'
  | 'WAIT'
  | 'KEYPRESS'
  | 'SCREENSHOT'
  | 'DRAG'
  | 'INSPECT_DOM'
  | 'PROBE_SELECTORS'
  | 'DONE';

export interface ComputerUseStep {
  id: string;
  scraper_generation_run_id: string;
  step_index: number;
  action_type: ComputerUseActionType;
  /** Raw action returned by the model. */
  action_payload: Record<string, any>;
  /** Resolved GCS url of the screenshot taken before this action. */
  screenshot_before_url: string | null;
  /** Resolved GCS url of the screenshot taken after this action. */
  screenshot_after_url: string | null;
  model_reasoning: string | null;
  created_at: string;
}

export interface ScraperGenerationRun {
  id: string;
  website_target_id: string;
  /** Set when this run is fixing/updating an existing scraper. */
  workflow_config_id: string | null;
  trigger: ScraperGenerationTrigger;
  status: ScraperGenerationStatus;
  prompt: string | null;
  /** Hard cap on computer-use steps for this run. Null means no limit. */
  max_steps: number | null;
  /** Output formats the generated scraper should produce. */
  output_formats: ScrapioGenerationOutputFormat[];
  /** App-level output schema definition this run was generated against; only present when STRUCTURED_JSON is included in output_formats. */
  output_schema: Record<string, any> | null;
  /** Draft config produced by the model, pending review. */
  staged_config: Record<string, any> | null;
  produced_version_id: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  /** Present on GET /generation-runs/:id, ordered by step_index asc. */
  steps?: ComputerUseStep[];
  /** Present on list/detail views. */
  website_target?: Record<string, any>;
  /** Present on list/detail views when workflow_config_id is set. */
  workflow_config?: Record<string, any>;
}

export interface ScraperGenerationRunsQuery extends ScrapioListQuery {
  user_id?: string;
  workflow_config_id?: string;
  website_target_id?: string;
  trigger?: ScraperGenerationTrigger;
  status?: ScraperGenerationStatus;
}

export interface CreateGenerationRunDto {
  /** Website target to generate/fix a scraper for. */
  website_target_id: string;
  /** Set when this run is fixing/updating an existing scraper. */
  scraper_id?: string;
  /** Goal/instructions given to the model. */
  prompt: string;
  /** Hard cap on computer-use steps for this run. Omit or null for no limit. */
  max_steps?: number | null;
  /** Output formats the generated scraper should produce. Omit or pass an empty array when generating Playwright config only. */
  output_formats?: ScrapioGenerationOutputFormat[];
  /** App-level output schema definition. Required when STRUCTURED_JSON is included in output_formats. */
  output_schema?: Record<string, any>;
  /** When true, queue the generation job immediately. When false, save as DRAFT without starting. */
  start: boolean;
}

export interface UpdateGenerationRunDto {
  /** Goal/instructions given to the model. */
  prompt?: string;
  /** Hard cap on computer-use steps. Null clears the limit. Omit to leave unchanged. */
  max_steps?: number | null;
  /** Output formats the generated scraper should produce. */
  output_formats?: ScrapioGenerationOutputFormat[];
  /** App-level output schema definition. Required when STRUCTURED_JSON is selected. */
  output_schema?: Record<string, any> | null;
  /** Staged scraper config pending review. Only allowed when status is AWAITING_REVIEW. */
  staged_config?: Record<string, any>;
}

export interface RejectGenerationRunDto {
  /** Why the run was rejected. */
  reason?: string;
}

export interface RetryGenerationRunDto {
  /** Failure context for the model. Defaults to the run stored error_message when omitted. */
  error?: string;
  /** Optional extra instructions appended to the run prompt before resuming. */
  prompt?: string;
  /** Optional override for max computer-use steps on retry. Omit to keep the run value; null clears the limit. */
  max_steps?: number | null;
}
