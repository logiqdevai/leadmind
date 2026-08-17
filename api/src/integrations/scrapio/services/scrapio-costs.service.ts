import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  CostEntryItem,
  CostSummaryEntity,
  ScrapioCostsQuery,
  ScrapioCostsSummaryQuery,
} from '../interfaces/scrapio-costs.interface';

@Injectable()
export class ScrapioCostsService {
  constructor(private readonly client: ScrapioClient) {}

  /** Get cost totals, broken down by category. */
  async getSummary(
    organisation_uuid: string,
    query?: ScrapioCostsSummaryQuery,
  ): Promise<CostSummaryEntity> {
    return this.client.get<CostSummaryEntity>('/costs/summary', {
      organisation_uuid,
      params: query,
    });
  }

  /** List cost entries (paginated, filterable). */
  async findAll(
    organisation_uuid: string,
    query?: ScrapioCostsQuery,
  ): Promise<ScrapioPaginatedResponse<CostEntryItem>> {
    return this.client.get<ScrapioPaginatedResponse<CostEntryItem>>('/costs', {
      organisation_uuid,
      params: query,
    });
  }
}
