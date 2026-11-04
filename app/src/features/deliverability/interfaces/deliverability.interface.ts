import type { EmailProviderTarget } from "@/features/integrations/interfaces/integrations.interface";

export type DeliverabilityFrequency = "DAILY" | "WEEKLY" | "EVERY_N_DAYS" | "MONTHLY";
export type DeliverabilityActionMode = "RECOMMEND" | "THROTTLE" | "PAUSE";
export type DeliverabilityRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type DeliverabilityRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DeliverabilityCheckType = "DNS" | "MAIL_TESTER";
export type DeliverabilityActionTaken =
    | "NONE"
    | "RECOMMENDED"
    | "THROTTLED"
    | "PAUSED"
    | "LIFTED"
    | "APPLIED";

export interface DeliverabilityRun {
    uuid: string;
    schedule_uuid: string;
    status: DeliverabilityRunStatus;
    score: number | null;
    risk_level: DeliverabilityRiskLevel | null;
    scored_by: "jev" | "rules" | null;
    jev_confidence: number | null;
    summary: string | null;
    mxtoolbox_check_uuid: string | null;
    mail_tester_test_uuid: string | null;
    recommended_daily_cap: number | null;
    action_taken: DeliverabilityActionTaken | null;
    error_message: string | null;
    created_at: string;
    finished_at: string | null;
}

export interface DeliverabilityGuard {
    daily_cap: number | null;
    paused: boolean;
    updated_at: string;
}

export interface DeliverabilitySchedule {
    uuid: string;
    label: string | null;
    domain: string;
    integration_account_uuid: string | null;
    integration_account_domain_uuid: string | null;
    from_provider: "RESEND" | "SMTP" | null;
    from_account: string | null;
    dkim_selector: string | null;
    frequency: DeliverabilityFrequency;
    time_of_day: string;
    weekday: number | null;
    day_of_month: number | null;
    interval_days: number | null;
    timezone: string;
    checks: DeliverabilityCheckType[];
    action_mode: DeliverabilityActionMode;
    warn_threshold: number;
    critical_threshold: number;
    is_active: boolean;
    last_run_at: string | null;
    latest_run: DeliverabilityRun | null;
    guard: DeliverabilityGuard | null;
}

/** Either an integration account (optionally one of its domains) or a free-form domain. */
export interface DeliverabilitySchedulePayload {
    label?: string;
    from?: EmailProviderTarget;
    custom_domain?: string;
    dkim_selector?: string;
    frequency: DeliverabilityFrequency;
    time_of_day: string;
    weekday?: number;
    day_of_month?: number;
    interval_days?: number;
    timezone: string;
    checks?: DeliverabilityCheckType[];
    action_mode?: DeliverabilityActionMode;
    warn_threshold?: number;
    critical_threshold?: number;
    is_active?: boolean;
}

export type UpdateDeliverabilitySchedulePayload = Partial<DeliverabilitySchedulePayload>;
