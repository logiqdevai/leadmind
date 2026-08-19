import { ScrapioListQuery } from './scrapio-common.interface';

export type WebhookEventType =
  | 'WORKFLOW_RUN_QUEUED'
  | 'WORKFLOW_RUN_RUNNING'
  | 'WORKFLOW_RUN_AI_BATCH_SUBMITTED'
  | 'WORKFLOW_RUN_SUCCEEDED'
  | 'WORKFLOW_RUN_PARTIAL_SUCCESS'
  | 'WORKFLOW_RUN_FAILED'
  | 'WORKFLOW_RUN_CANCELLED';

export type WebhookDeliveryStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface WebhookEndpointEntity {
  id: string;
  name: string | null;
  url: string;
  subscribed_events: WebhookEventType[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookEndpointDto {
  name?: string;
  url: string;
  /** Secret you choose, used to HMAC-sign outgoing payloads so you can verify they came from us. Minimum 16 characters. */
  secret: string;
  subscribed_events: WebhookEventType[];
}

export interface UpdateWebhookEndpointDto {
  name?: string;
  url?: string;
  /** Rotate the signing secret. Omit to keep the current one. Minimum 16 characters. */
  secret?: string;
  /** Replaces the current subscription list. */
  subscribed_events?: WebhookEventType[];
  is_active?: boolean;
}

export interface WebhookDeliveryEntity {
  id: string;
  event_type: WebhookEventType;
  /** ID of the workflow run that triggered this delivery, if any (null for synthetic test events). */
  workflow_run_id: string | null;
  is_test: boolean;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  http_status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  /** Which attempt this was (1 for the first try). */
  attempt_number: number;
  duration_ms: number | null;
  created_at: string;
}

export interface SendTestEventDto {
  /** Which event type to simulate. A sample payload for this type is delivered to the endpoint. */
  event_type: WebhookEventType;
}

export interface ListWebhookDeliveriesQuery extends ScrapioListQuery {
  event_type?: WebhookEventType;
  status?: WebhookDeliveryStatus;
}

export interface WebhookEventCatalogEntry {
  event_type: WebhookEventType;
  name: string;
  label: string;
  description: string;
  sample_payload: Record<string, any>;
}
