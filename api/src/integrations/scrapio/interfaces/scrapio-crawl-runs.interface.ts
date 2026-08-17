import { ScrapioListQuery } from './scrapio-common.interface';
import { JobLog } from './scrapio-jobs.interface';

export type WorkflowRunType = 'SCRAPER' | 'BROWSER_AGENT' | 'PLAIN_SCRAPE';

export type WorkflowRunTrigger = 'MANUAL' | 'SCHEDULED';

export type WorkflowRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_AI_BATCH'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type WorkflowRunExtractionScope = 'COMBINED' | 'PER_URL';

export type WorkflowRunOutputFormat = 'STRUCTURED_JSON' | 'MARKDOWN';

export type ExtractionValidationStatus = 'VALID' | 'INVALID' | 'FAILED';

export type DiagnosticsPackageMode = 'PRODUCTION' | 'TRACE' | 'FULL_DEBUG';

export type CrawlRunStepActionType =
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

export interface ExtractionResultEntity {
  id: string;
  /** Present only when STRUCTURED_JSON is one of the run output formats. */
  structured_status?: ExtractionValidationStatus | null;
  /** Validated structured output. Present only when STRUCTURED_JSON was requested. */
  structured_data?: Record<string, unknown> | null;
  /** Last raw model output, kept for debugging even on validation failure. Present only when STRUCTURED_JSON was requested. */
  structured_raw_ai_output?: Record<string, unknown> | null;
  structured_validation_errors?: Record<string, unknown> | null;
  /** Present only when STRUCTURED_JSON was requested. */
  structured_attempts?: number;
  /** Present only when MARKDOWN is one of the run output formats. */
  markdown_status?: ExtractionValidationStatus | null;
  /** Present only when MARKDOWN was requested. */
  markdown?: string | null;
  markdown_validation_errors?: Record<string, unknown> | null;
  /** Self-contained HTML+CSS document rendering structured_data as a visual interface, if generated. Present only when STRUCTURED_JSON was requested. */
  generated_ui_html?: string | null;
  ai_usage: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlRunPage {
  id: string;
  workflow_run_id: string;
  requested_url: string;
  final_url: string | null;
  http_status: number | null;
  success: boolean;
  raw_html: string | null;
  cleaned_content: string | null;
  title: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  /** Populated when the run's extraction_scope is PER_URL. */
  extraction_result: ExtractionResultEntity | null;
}

export interface CrawlRunExecutionTrace {
  id: string;
  workflow_config_id: string;
  workflow_run_id: string | null;
  /** Ordered list of computer-use steps taken. */
  steps: Record<string, unknown>;
  success: boolean;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrawlRunDiagnosticsPackageSummary {
  id: string;
  mode: DiagnosticsPackageMode;
}

export interface CrawlRunStep {
  id: string;
  scraper_generation_run_id: string | null;
  workflow_run_id: string | null;
  step_index: number;
  action_type: CrawlRunStepActionType;
  /** Raw action returned by the model. */
  action_payload: Record<string, unknown>;
  /** Resolved GCS url of the screenshot taken before this action. */
  screenshot_before_url: string | null;
  /** Resolved GCS url of the screenshot taken after this action. */
  screenshot_after_url: string | null;
  model_reasoning: string | null;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  user_id: string;
  type: WorkflowRunType;
  workflow_config_id: string;
  trigger: WorkflowRunTrigger;
  website_target_id: string | null;
  scraper_version_id: string | null;
  /** BROWSER_AGENT run target URL. */
  url: string | null;
  /** BROWSER_AGENT run step cap. */
  max_steps: number | null;
  /** BROWSER_AGENT run: URLs visited so far. */
  visited_urls: Record<string, unknown> | null;
  /** BROWSER_AGENT run: computer-use actions taken. */
  browser_actions: Record<string, unknown> | null;
  /** BROWSER_AGENT run: raw data collected during the run. */
  collected_data: Record<string, unknown> | null;
  /** Snapshotted from the config's capture_api at enqueue time. When true, captured_requests holds every recorded HTTP request/response and an OpenAPI spec is distilled from them on completion. */
  capture_api: boolean;
  /** BROWSER_AGENT run: recorded HTTP requests/responses, present only when capture_api is true. */
  captured_requests: Record<string, unknown> | null;
  /** Id of the generated OpenAPI spec Document, present only when capture_api is true. */
  openapi_spec_document_id: string | null;
  /** Signed, time-limited URL to download the generated OpenAPI spec. Present only on the get-one response, when capture_api is true. */
  openapi_spec_url?: string | null;
  /** PLAIN_SCRAPE run: URLs to scrape. */
  urls: string[];
  /** PLAIN_SCRAPE run: how multiple URLs are normalized. */
  extraction_scope: WorkflowRunExtractionScope | null;
  /** Snapshot of the config's output contract (BROWSER_AGENT + PLAIN_SCRAPE). */
  output_formats: WorkflowRunOutputFormat[];
  extraction_schema_version_id: string | null;
  /** AI token/cost usage for this run. */
  ai_usage: Record<string, unknown> | null;
  /** Free-form run metadata. */
  metadata: Record<string, unknown> | null;
  status: WorkflowRunStatus;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  /** Present on list/detail views. */
  website_target?: Record<string, unknown>;
  /** Present on list/detail views. */
  workflow_config?: Record<string, unknown>;
  /** SCRAPER/BROWSER_AGENT run result. Present only on the get-one response. */
  extraction_result?: ExtractionResultEntity | null;
  /** PLAIN_SCRAPE run: one entry per scraped URL. Present only on the get-one response. */
  pages?: CrawlRunPage[];
  /** SCRAPER run: execution traces. Present only on the get-one response. */
  execution_traces?: CrawlRunExecutionTrace[];
  /** Present only on the get-one response. */
  job_logs?: JobLog[];
  /** Present only on the get-one response. */
  diagnostics_package?: CrawlRunDiagnosticsPackageSummary | null;
  /** BROWSER_AGENT/SCRAPER run: computer-use steps taken. Present only on the get-one response. */
  steps?: CrawlRunStep[];
}

export interface ListCrawlRunsQuery extends ScrapioListQuery {
  date_to?: string;
  date_from?: string;
  user_id?: string;
  workflow_config_id?: string;
  website_target_id?: string;
  type?: WorkflowRunType;
  status?: WorkflowRunStatus;
}

export interface DeleteCrawlRunsDto {
  workflow_run_ids: string[];
}

export interface GenerateUiDto {
  /** Optional extra guidance for how the AI should render the interface. */
  instructions?: string;
}
