import { Injectable } from '@nestjs/common';
import { ScrapioClient } from '../scrapio.client';
import { ScrapioPaginatedResponse } from '../interfaces/scrapio-common.interface';
import {
  CreateWebhookEndpointDto,
  ListWebhookDeliveriesQuery,
  SendTestEventDto,
  UpdateWebhookEndpointDto,
  WebhookDeliveryEntity,
  WebhookEndpointEntity,
  WebhookEventCatalogEntry,
} from '../interfaces/scrapio-webhooks.interface';

@Injectable()
export class ScrapioWebhooksService {
  constructor(private readonly client: ScrapioClient) {}

  /** List available webhook event types, descriptions, and sample payloads. */
  async getEventCatalog(
    organisation_uuid: string,
  ): Promise<WebhookEventCatalogEntry[]> {
    return this.client.get<WebhookEventCatalogEntry[]>(
      '/webhooks/event-catalog',
      { organisation_uuid },
    );
  }

  /** List my webhook endpoints. */
  async findAll(organisation_uuid: string): Promise<WebhookEndpointEntity[]> {
    return this.client.get<WebhookEndpointEntity[]>('/webhooks', {
      organisation_uuid,
    });
  }

  async create(
    organisation_uuid: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpointEntity> {
    return this.client.post<WebhookEndpointEntity>('/webhooks', dto, {
      organisation_uuid,
    });
  }

  async findOne(
    organisation_uuid: string,
    id: string,
  ): Promise<WebhookEndpointEntity> {
    return this.client.get<WebhookEndpointEntity>(`/webhooks/${id}`, {
      organisation_uuid,
    });
  }

  async update(
    organisation_uuid: string,
    id: string,
    dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpointEntity> {
    return this.client.patch<WebhookEndpointEntity>(`/webhooks/${id}`, dto, {
      organisation_uuid,
    });
  }

  async remove(organisation_uuid: string, id: string): Promise<void> {
    return this.client.delete<void>(`/webhooks/${id}`, { organisation_uuid });
  }

  /** List delivery attempts for a webhook endpoint (paginated, filterable). */
  async findDeliveries(
    organisation_uuid: string,
    id: string,
    query?: ListWebhookDeliveriesQuery,
  ): Promise<ScrapioPaginatedResponse<WebhookDeliveryEntity>> {
    return this.client.get<ScrapioPaginatedResponse<WebhookDeliveryEntity>>(
      `/webhooks/${id}/deliveries`,
      {
        organisation_uuid,
        params: query,
      },
    );
  }

  /** Send a synthetic test event to a webhook endpoint. */
  async sendTestEvent(
    organisation_uuid: string,
    id: string,
    dto: SendTestEventDto,
  ): Promise<WebhookDeliveryEntity> {
    return this.client.post<WebhookDeliveryEntity>(
      `/webhooks/${id}/test`,
      dto,
      { organisation_uuid },
    );
  }
}
