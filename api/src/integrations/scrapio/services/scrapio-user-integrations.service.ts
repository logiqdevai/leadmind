import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  ConnectUserIntegrationDto,
  ListUserIntegrationsQuery,
  UpdateUserIntegrationDto,
  UserIntegration,
} from '../interfaces/scrapio-user-integrations.interface';

@Injectable()
export class ScrapioUserIntegrationsService {
  constructor(private readonly client: ScrapioClient) {}

  /** List user integrations (paginated, filterable). Non-privileged users only see their own integrations regardless of user_id. */
  async findAll(
    organisation_uuid: string,
    query?: ListUserIntegrationsQuery,
  ): Promise<ScrapioPaginatedResponse<UserIntegration>> {
    return this.client.get<ScrapioPaginatedResponse<UserIntegration>>(
      '/user-integrations',
      { organisation_uuid, params: query },
    );
  }

  /** Connect an integration with API key credentials. */
  async connect(
    organisation_uuid: string,
    dto: ConnectUserIntegrationDto,
  ): Promise<UserIntegration> {
    return this.client.post<UserIntegration>('/user-integrations', dto, {
      organisation_uuid,
    });
  }

  async findOne(
    organisation_uuid: string,
    id: string,
  ): Promise<UserIntegration> {
    return this.client.get<UserIntegration>(`/user-integrations/${id}`, {
      organisation_uuid,
    });
  }

  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateUserIntegrationDto,
  ): Promise<UserIntegration> {
    return this.client.patch<UserIntegration>(`/user-integrations/${id}`, dto, {
      organisation_uuid,
    });
  }

  /** Disconnect a user integration. */
  async disconnect(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/user-integrations/${id}`, {
      organisation_uuid,
    });
  }
}
