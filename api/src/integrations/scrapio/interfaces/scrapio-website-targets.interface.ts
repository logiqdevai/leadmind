import { ScrapioListQuery } from './scrapio-common.interface';

export type BlockRuleSignal = 'BLOCKED' | 'CHALLENGE';

export type BlockRuleSource =
  | 'TITLE'
  | 'TEXT'
  | 'HTML'
  | 'PATH'
  | 'SCRIPT_CONTENT'
  | 'SELECTOR';

export interface BlockRuleEntity {
  id: string;
  website_target_id: string;
  /** Human-readable name shown in the admin UI. */
  label: string | null;
  /** BLOCKED = stop immediately (hard error page). CHALLENGE = keep waiting for the page to clear itself. */
  signal: BlockRuleSignal;
  /** Which part of the page `pattern` is tested against. */
  source: BlockRuleSource;
  /** Substring (or regex source when is_regex is set) to match against `source`. CSS selector when source = SELECTOR. */
  pattern: string;
  is_regex: boolean;
  /** Regex flags, used only when is_regex is true. */
  regex_flags: string | null;
  /** Evaluation order (0-indexed). */
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BlockRuleDto {
  label?: string;
  signal: BlockRuleSignal;
  source: BlockRuleSource;
  pattern: string;
  is_regex?: boolean;
  regex_flags?: string;
}

export interface WebsiteTarget {
  id: string;
  /** Owning user id. */
  user_id: string;
  name: string;
  /** Root URL of the target website. */
  base_url: string;
  notes: string | null;
  /** Timestamp of the last successful crawl against this target. */
  last_success_at: string | null;
  /** Timestamp of the last failed crawl against this target. */
  last_failure_at: string | null;
  last_error_message: string | null;
  metadata: Record<string, any> | null;
  block_handling_wait_timeout_ms: number | null;
  block_handling_min_ready_body_length: number | null;
  /** Extra bot-block/challenge detection rules for this target. Present on GET /website-targets/:id. */
  block_rules?: BlockRuleEntity[];
  created_at: string;
  updated_at: string;
  /** Related record counts. Present on GET /website-targets/:id. */
  _count?: Record<string, number>;
}

export interface CreateWebsiteTargetDto {
  name: string;
  base_url: string;
  notes?: string;
  block_handling_wait_timeout_ms?: number;
  block_handling_min_ready_body_length?: number;
  block_rules?: BlockRuleDto[];
}

export interface UpdateWebsiteTargetDto {
  name?: string;
  base_url?: string;
  notes?: string;
  block_handling_wait_timeout_ms?: number;
  block_handling_min_ready_body_length?: number;
  block_rules?: BlockRuleDto[];
}

export interface WebsiteTargetsListQuery extends ScrapioListQuery {
  /** Filter by owning user id (admin/support only). */
  user_id?: string;
  /** Case-insensitive match against name or base_url. */
  search?: string;
}
