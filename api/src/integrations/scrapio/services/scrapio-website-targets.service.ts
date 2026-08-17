import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  CreateWebsiteTargetDto,
  UpdateWebsiteTargetDto,
  WebsiteTarget,
  WebsiteTargetsListQuery,
} from '../interfaces/scrapio-website-targets.interface';

@Injectable()
export class ScrapioWebsiteTargetsService {
  constructor(private readonly client: ScrapioClient) {}

  async findAll(
    organisation_uuid: string,
    query?: WebsiteTargetsListQuery,
  ): Promise<ScrapioPaginatedResponse<WebsiteTarget>> {
    return this.client.get<ScrapioPaginatedResponse<WebsiteTarget>>(
      '/website-targets',
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  async create(
    organisation_uuid: string,
    dto: CreateWebsiteTargetDto,
  ): Promise<WebsiteTarget> {
    return this.client.post<WebsiteTarget>('/website-targets', dto, {
      organisation_uuid,
    });
  }

  /** Get one website target with block rules. */
  async findOne(organisation_uuid: string, id: string): Promise<WebsiteTarget> {
    return this.client.get<WebsiteTarget>(`/website-targets/${id}`, {
      organisation_uuid,
    });
  }

  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateWebsiteTargetDto,
  ): Promise<WebsiteTarget> {
    return this.client.patch<WebsiteTarget>(`/website-targets/${id}`, dto, {
      organisation_uuid,
    });
  }

  /** Delete a website target (only if no scrapers/crawl runs exist). */
  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/website-targets/${id}`, {
      organisation_uuid,
    });
  }
}
