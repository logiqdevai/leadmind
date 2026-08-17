import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  BrowserAgentConfig,
  BrowserAgentConfigsListQuery,
  CreateBrowserAgentConfigDto,
  DeleteBrowserAgentConfigsDto,
  UpdateBrowserAgentConfigDto,
} from '../interfaces/scrapio-browser-agent-configs.interface';

@Injectable()
export class ScrapioBrowserAgentConfigsService {
  constructor(private readonly client: ScrapioClient) {}

  async findAll(
    organisation_uuid: string,
    query?: BrowserAgentConfigsListQuery,
  ): Promise<ScrapioPaginatedResponse<BrowserAgentConfig>> {
    return this.client.get<ScrapioPaginatedResponse<BrowserAgentConfig>>(
      '/browser-agent-configs',
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  async create(
    organisation_uuid: string,
    dto: CreateBrowserAgentConfigDto,
  ): Promise<BrowserAgentConfig> {
    return this.client.post<BrowserAgentConfig>('/browser-agent-configs', dto, {
      organisation_uuid,
    });
  }

  async removeMany(
    organisation_uuid: string,
    dto: DeleteBrowserAgentConfigsDto,
  ): Promise<void> {
    return this.client.post<void>('/browser-agent-configs/bulk-delete', dto, {
      organisation_uuid,
    });
  }

  async findOne(
    organisation_uuid: string,
    id: string,
  ): Promise<BrowserAgentConfig> {
    return this.client.get<BrowserAgentConfig>(`/browser-agent-configs/${id}`, {
      organisation_uuid,
    });
  }

  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateBrowserAgentConfigDto,
  ): Promise<BrowserAgentConfig> {
    return this.client.patch<BrowserAgentConfig>(
      `/browser-agent-configs/${id}`,
      dto,
      { organisation_uuid },
    );
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/browser-agent-configs/${id}`, {
      organisation_uuid,
    });
  }

  /** Manually trigger a browser agent run. */
  async runNow(organisation_uuid: string, id: string): Promise<void> {
    return this.client.post<void>(
      `/browser-agent-configs/${id}/run-now`,
      undefined,
      { organisation_uuid },
    );
  }
}
