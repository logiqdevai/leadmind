export const SendingPeriodUnit = {
    HOUR: "HOUR",
    DAY: "DAY",
    WEEK: "WEEK",
} as const;

export type SendingPeriodUnit = (typeof SendingPeriodUnit)[keyof typeof SendingPeriodUnit];

export interface SendingPolicyStage {
    uuid: string;
    order_index: number;
    limit: number;
    period_unit: SendingPeriodUnit;
    duration_value: number | null;
    duration_unit: SendingPeriodUnit | null;
}

export interface SendingPolicy {
    uuid: string;
    organisation_uuid: string;
    name: string;
    description: string | null;
    is_template: boolean;
    source_policy_uuid: string | null;
    timezone: string;
    window_start_minute: number | null;
    window_end_minute: number | null;
    min_interval_seconds: number;
    min_interval_jitter_seconds: number;
    stages: SendingPolicyStage[];
    created_at: string;
    updated_at: string;
}

export interface UpsertSendingPolicyStagePayload {
    limit: number;
    period_unit: SendingPeriodUnit;
    duration_value?: number;
    duration_unit?: SendingPeriodUnit;
}

export interface CreateSendingPolicyPayload {
    name: string;
    description?: string;
    timezone?: string;
    window_start_minute?: number;
    window_end_minute?: number;
    min_interval_seconds?: number;
    min_interval_jitter_seconds?: number;
    stages: UpsertSendingPolicyStagePayload[];
}

export type UpdateSendingPolicyPayload = Partial<
    Omit<CreateSendingPolicyPayload, "stages">
>;

export interface SchedulePreviewEntry {
    stage_index: number;
    order_index: number;
    limit: number;
    period_unit: SendingPeriodUnit;
    starts_at: string;
    ends_at: string | null;
    is_final_stage: boolean;
    estimated_messages: number;
}

export interface SchedulePreviewResult {
    entries: SchedulePreviewEntry[];
    estimated_completion_at: string | null;
    total_contacts: number;
}
