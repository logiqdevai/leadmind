import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  DeleteJobLogsDto,
  JobLog,
  JobsListQuery,
} from '../interfaces/scrapio-jobs.interface';

@Injectable()
export class ScrapioJobsService {
  constructor(private readonly client: ScrapioClient) {}

  async findAll(
    organisation_uuid: string,
    query?: JobsListQuery,
  ): Promise<ScrapioPaginatedResponse<JobLog>> {
    return this.client.get<ScrapioPaginatedResponse<JobLog>>('/jobs', {
      organisation_uuid,
      params: query,
    });
  }

  async removeMany(
    organisation_uuid: string,
    dto: DeleteJobLogsDto,
  ): Promise<void> {
    return this.client.post<void>('/jobs/bulk-delete', dto, {
      organisation_uuid,
    });
  }

  async findOne(organisation_uuid: string, id: string): Promise<JobLog> {
    return this.client.get<JobLog>(`/jobs/${id}`, { organisation_uuid });
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/jobs/${id}`, { organisation_uuid });
  }

  /** Retry a failed or completed job. */
  async retry(organisation_uuid: string, id: string): Promise<JobLog> {
    return this.client.post<JobLog>(`/jobs/${id}/retry`, undefined, {
      organisation_uuid,
    });
  }

  /** Stop a queued or running job. */
  async stop(organisation_uuid: string, id: string): Promise<JobLog> {
    return this.client.post<JobLog>(`/jobs/${id}/stop`, undefined, {
      organisation_uuid,
    });
  }
}
