import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import { WorkflowRun } from '../interfaces/scrapio-crawl-runs.interface';
import {
  CreateScraperDto,
  CreateScraperVersionDto,
  DeleteScrapersDto,
  Scraper,
  ScraperVersion,
  ScrapersListQuery,
  UpdateScraperDto,
} from '../interfaces/scrapio-scrapers.interface';

@Injectable()
export class ScrapioScrapersService {
  constructor(private readonly client: ScrapioClient) {}

  async findAll(
    organisation_uuid: string,
    query?: ScrapersListQuery,
  ): Promise<ScrapioPaginatedResponse<Scraper>> {
    return this.client.get<ScrapioPaginatedResponse<Scraper>>('/scrapers', {
      organisation_uuid,
      params: query,
    });
  }

  /** Create a scraper with an initial active version (version 1). */
  async create(
    organisation_uuid: string,
    dto: CreateScraperDto,
  ): Promise<Scraper> {
    return this.client.post<Scraper>('/scrapers', dto, { organisation_uuid });
  }

  async removeMany(
    organisation_uuid: string,
    dto: DeleteScrapersDto,
  ): Promise<void> {
    return this.client.post<void>('/scrapers/bulk-delete', dto, {
      organisation_uuid,
    });
  }

  /** Get one scraper with its active version. */
  async findOne(organisation_uuid: string, id: string): Promise<Scraper> {
    return this.client.get<Scraper>(`/scrapers/${id}`, { organisation_uuid });
  }

  /** Toggle self_healing_enabled and/or update validation_rules (creates a new version). */
  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateScraperDto,
  ): Promise<Scraper> {
    return this.client.patch<Scraper>(`/scrapers/${id}`, dto, {
      organisation_uuid,
    });
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/scrapers/${id}`, { organisation_uuid });
  }

  /** List a scraper's versions (newest first). */
  async listVersions(
    organisation_uuid: string,
    id: string,
  ): Promise<ScraperVersion[]> {
    return this.client.get<ScraperVersion[]>(`/scrapers/${id}/versions`, {
      organisation_uuid,
    });
  }

  /** Create a new scraper version (does not activate it). */
  async createVersion(
    organisation_uuid: string,
    id: string,
    dto: CreateScraperVersionDto,
  ): Promise<ScraperVersion> {
    return this.client.post<ScraperVersion>(`/scrapers/${id}/versions`, dto, {
      organisation_uuid,
    });
  }

  /** Activate a version (rollback or promote); un-breaks a BROKEN scraper. */
  async activateVersion(
    organisation_uuid: string,
    id: string,
    versionId: string,
  ): Promise<Scraper> {
    return this.client.post<Scraper>(
      `/scrapers/${id}/versions/${versionId}/activate`,
      undefined,
      { organisation_uuid },
    );
  }

  /** Manually trigger a crawl run. */
  async runNow(organisation_uuid: string, id: string): Promise<WorkflowRun> {
    return this.client.post<WorkflowRun>(`/scrapers/${id}/run-now`, undefined, {
      organisation_uuid,
    });
  }
}
