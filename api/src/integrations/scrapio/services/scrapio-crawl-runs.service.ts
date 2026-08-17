import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  DeleteCrawlRunsDto,
  GenerateUiDto,
  ListCrawlRunsQuery,
  WorkflowRun,
} from '../interfaces/scrapio-crawl-runs.interface';

@Injectable()
export class ScrapioCrawlRunsService {
  constructor(private readonly client: ScrapioClient) {}

  /** List crawl runs (paginated, filterable). */
  async findAll(
    organisation_uuid: string,
    query?: ListCrawlRunsQuery,
  ): Promise<ScrapioPaginatedResponse<WorkflowRun>> {
    return this.client.get<ScrapioPaginatedResponse<WorkflowRun>>(
      '/crawl-runs',
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  async removeMany(
    organisation_uuid: string,
    dto: DeleteCrawlRunsDto,
  ): Promise<void> {
    return this.client.post<void>('/crawl-runs/bulk-delete', dto, {
      organisation_uuid,
    });
  }

  /** Get one crawl run with execution traces and job logs. */
  async findOne(organisation_uuid: string, id: string): Promise<WorkflowRun> {
    return this.client.get<WorkflowRun>(`/crawl-runs/${id}`, {
      organisation_uuid,
    });
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/crawl-runs/${id}`, { organisation_uuid });
  }

  /** Re-enqueue a crawl run with the same attribution. */
  async rerun(organisation_uuid: string, id: string): Promise<WorkflowRun> {
    return this.client.post<WorkflowRun>(`/crawl-runs/${id}/rerun`, undefined, {
      organisation_uuid,
    });
  }

  /** Stop a queued or running crawl run. */
  async cancel(organisation_uuid: string, id: string): Promise<WorkflowRun> {
    return this.client.post<WorkflowRun>(
      `/crawl-runs/${id}/cancel`,
      undefined,
      { organisation_uuid },
    );
  }

  /** Generate (or regenerate) an AI-rendered HTML interface for a run's structured data. */
  async generateUi(
    organisation_uuid: string,
    id: string,
    dto: GenerateUiDto = {},
  ): Promise<void> {
    return this.client.post<void>(`/crawl-runs/${id}/generate-ui`, dto, {
      organisation_uuid,
    });
  }

  /** Generate (or regenerate) an AI-rendered HTML interface for one page's structured data. */
  async generateUiForPage(
    organisation_uuid: string,
    id: string,
    pageId: string,
    dto: GenerateUiDto = {},
  ): Promise<void> {
    return this.client.post<void>(
      `/crawl-runs/${id}/pages/${pageId}/generate-ui`,
      dto,
      { organisation_uuid },
    );
  }
}
