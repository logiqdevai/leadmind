import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  CreateGenerationRunDto,
  RejectGenerationRunDto,
  RetryGenerationRunDto,
  ScraperGenerationRun,
  ScraperGenerationRunsQuery,
  UpdateGenerationRunDto,
} from '../interfaces/scrapio-generation-runs.interface';

@Injectable()
export class ScrapioGenerationRunsService {
  constructor(private readonly client: ScrapioClient) {}

  /** List generation runs (paginated, filterable). */
  async findAll(
    organisation_uuid: string,
    query?: ScraperGenerationRunsQuery,
  ): Promise<ScrapioPaginatedResponse<ScraperGenerationRun>> {
    return this.client.get<ScrapioPaginatedResponse<ScraperGenerationRun>>(
      '/generation-runs',
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  /** Create a generation run. Pass start=true to queue immediately, or start=false to save as DRAFT. */
  async create(
    organisation_uuid: string,
    dto: CreateGenerationRunDto,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>('/generation-runs', dto, {
      organisation_uuid,
    });
  }

  /** Get one generation run with its steps. */
  async findOne(
    organisation_uuid: string,
    id: string,
  ): Promise<ScraperGenerationRun> {
    return this.client.get<ScraperGenerationRun>(`/generation-runs/${id}`, {
      organisation_uuid,
    });
  }

  /** Update a generation run. DRAFT/FAILED/CANCELLED: prompt, max_steps, output config. AWAITING_REVIEW: staged_config only. */
  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateGenerationRunDto,
  ): Promise<ScraperGenerationRun> {
    return this.client.patch<ScraperGenerationRun>(
      `/generation-runs/${id}`,
      dto,
      { organisation_uuid },
    );
  }

  /** Delete a generation run and its screenshot files from storage. */
  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/generation-runs/${id}`, {
      organisation_uuid,
    });
  }

  /** Start a DRAFT generation run. */
  async start(
    organisation_uuid: string,
    id: string,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>(
      `/generation-runs/${id}/start`,
      undefined,
      { organisation_uuid },
    );
  }

  /** Approve a staged config, promoting it into a new ScraperVersion. */
  async approve(
    organisation_uuid: string,
    id: string,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>(
      `/generation-runs/${id}/approve`,
      undefined,
      { organisation_uuid },
    );
  }

  /** Reject a generation run. */
  async reject(
    organisation_uuid: string,
    id: string,
    dto: RejectGenerationRunDto,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>(
      `/generation-runs/${id}/reject`,
      dto,
      { organisation_uuid },
    );
  }

  /** Cancel a QUEUED or RUNNING generation run. */
  async cancel(
    organisation_uuid: string,
    id: string,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>(
      `/generation-runs/${id}/cancel`,
      undefined,
      { organisation_uuid },
    );
  }

  /** Retry a failed or cancelled generation run from its last recorded step. */
  async retry(
    organisation_uuid: string,
    id: string,
    dto?: RetryGenerationRunDto,
  ): Promise<ScraperGenerationRun> {
    return this.client.post<ScraperGenerationRun>(
      `/generation-runs/${id}/retry`,
      dto,
      { organisation_uuid },
    );
  }
}
