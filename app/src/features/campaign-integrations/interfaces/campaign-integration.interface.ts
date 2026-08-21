import type { SendingPolicy } from "@/features/sending-policy/interfaces/sending-policy.interface";

export const CampaignIntegrationStatus = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    REMOVED: "REMOVED",
} as const;

export type CampaignIntegrationStatus =
    (typeof CampaignIntegrationStatus)[keyof typeof CampaignIntegrationStatus];

export interface CampaignIntegrationAccountView {
    uuid: string;
    account: string;
    title: string;
    integration: {
        uuid: string;
        provider: string;
        title: string;
    };
}

export interface CampaignIntegration {
    uuid: string;
    campaign_uuid: string;
    integration_account_uuid: string;
    sending_policy_uuid: string;
    status: CampaignIntegrationStatus;
    campaign: { uuid: string; name: string };
    integration_account: CampaignIntegrationAccountView;
    sending_policy: SendingPolicy;
    created_at: string;
    updated_at: string;
}

export interface AssignCampaignIntegrationPayload {
    integration_account_uuid: string;
    sending_policy_uuid: string;
}

export interface UpdateCampaignIntegrationStatusPayload {
    status: "ACTIVE" | "PAUSED";
}

export interface SendingActivityDay {
    /** yyyy-MM-dd, in the sending policy's own timezone bucketing. */
    date: string;
    count: number;
}

export interface SendingActivitySeries {
    campaign_integration_uuid: string;
    status: CampaignIntegrationStatus;
    integration_account: { title: string; provider: string };
    /** Only days with at least one real send - sparse, sorted ascending by date. */
    days: SendingActivityDay[];
}

export interface CampaignIntegrationCapacity {
    campaign_integration_uuid: string;
    current_stage: {
        order_index: number;
        limit: number;
        period_unit: string;
        is_final_stage: boolean;
    } | null;
    stage_used: number | null;
    stage_remaining: number | null;
    account_limit: number | null;
    account_used: number | null;
    account_remaining: number | null;
    provider_limit: number | null;
    provider_used: number | null;
    provider_remaining: number | null;
    effective_limit: number | null;
    sending_window: { start_minute: number | null; end_minute: number | null; timezone: string };
    next_eligible_at: string;
}
