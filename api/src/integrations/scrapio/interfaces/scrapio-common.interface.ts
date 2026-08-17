export interface ScrapioPaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ScrapioPaginatedResponse<T> {
  data: T[];
  pagination: ScrapioPaginationMeta;
}

export interface ScrapioListQuery {
  page?: number;
  limit?: number;
}
