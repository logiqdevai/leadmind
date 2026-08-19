import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  CreatePlainScrapeConfigDto,
  DeletePlainScrapeConfigsDto,
  PlainScrapeConfig,
  PlainScrapeConfigsListQuery,
  UpdatePlainScrapeConfigDto,
} from '../interfaces/scrapio-plain-scrape-configs.interface';

@Injectable()
export class ScrapioPlainScrapeConfigsService {
  constructor(private readonly client: ScrapioClient) {}

  async findAll(
    organisation_uuid: string,
    query?: PlainScrapeConfigsListQuery,
  ): Promise<ScrapioPaginatedResponse<PlainScrapeConfig>> {
    return this.client.get<ScrapioPaginatedResponse<PlainScrapeConfig>>(
      '/plain-scrape-configs',
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  async create(
    organisation_uuid: string,
    dto: CreatePlainScrapeConfigDto,
  ): Promise<PlainScrapeConfig> {
    return this.client.post<PlainScrapeConfig>('/plain-scrape-configs', dto, {
      organisation_uuid,
    });
  }

  async removeMany(
    organisation_uuid: string,
    dto: DeletePlainScrapeConfigsDto,
  ): Promise<void> {
    return this.client.post<void>('/plain-scrape-configs/bulk-delete', dto, {
      organisation_uuid,
    });
  }

  async findOne(
    organisation_uuid: string,
    id: string,
  ): Promise<PlainScrapeConfig> {
    return this.client.get<PlainScrapeConfig>(`/plain-scrape-configs/${id}`, {
      organisation_uuid,
    });
  }

  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdatePlainScrapeConfigDto,
  ): Promise<PlainScrapeConfig> {
    return this.client.patch<PlainScrapeConfig>(
      `/plain-scrape-configs/${id}`,
      dto,
      { organisation_uuid },
    );
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/plain-scrape-configs/${id}`, {
      organisation_uuid,
    });
  }

  /** Manually trigger a plain scrape run. */
  async runNow(organisation_uuid: string, id: string): Promise<void> {
    return this.client.post<void>(
      `/plain-scrape-configs/${id}/run-now`,
      undefined,
      { organisation_uuid },
    );
  }
}
