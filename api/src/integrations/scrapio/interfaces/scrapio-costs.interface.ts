export type ScrapioCostCategory =
  | 'STRUCTURED_EXTRACTION'
  | 'MARKDOWN_GENERATION'
  | 'EMBEDDING'
  | 'BROWSER_AGENT_RUN'
  | 'SCRAPER_GENERATION'
  | 'UI_GENERATION';

export interface CostSummaryByCategoryEntity {
  category: ScrapioCostCategory;
  /** Total cost for this category. */
  total_cost: number;
  /** Number of cost entries in this category. */
  entries_count: number;
}

export interface CostSummaryEntity {
  /** Total cost across all categories. */
  total_cost: number;
  currency: string;
  by_category: CostSummaryByCategoryEntity[];
}

export interface CostEntryItem {
  id: string;
  category: ScrapioCostCategory;
  provider?: string | null;
  model?: string | null;
  amount: number;
  currency: string;
  workflow_run_id?: string | null;
  created_at: string;
}

export interface ScrapioCostsSummaryQuery {
  date_from?: string;
  date_to?: string;
  /** Filter by user id (admin/support only). */
  user_id?: string;
  category?: ScrapioCostCategory;
}

export interface ScrapioCostsQuery {
  date_from?: string;
  date_to?: string;
  /** Filter by user id (admin/support only). */
  user_id?: string;
  category?: ScrapioCostCategory;
  /** Records per page (capped at 100). */
  limit?: number;
  /** Page number (1-indexed). */
  page?: number;
}
