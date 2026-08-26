export const BulkJobStatus = {
    PENDING: "PENDING",
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
} as const;
export type BulkJobStatus = (typeof BulkJobStatus)[keyof typeof BulkJobStatus];

export const BulkJobType = {
    CONTACT_EMAIL_SCRAPE: "CONTACT_EMAIL_SCRAPE",
    FILTER_SCRAPE: "FILTER_SCRAPE",
    CONTACT_SCORE: "CONTACT_SCORE",
    CONTACT_ENRICH: "CONTACT_ENRICH",
    LEAD_ENRICH: "LEAD_ENRICH",
    AI_DRAFT_MESSAGES: "AI_DRAFT_MESSAGES",
    CAMPAIGN_DISPATCH: "CAMPAIGN_DISPATCH",
    CAMPAIGN_MESSAGE_SEND: "CAMPAIGN_MESSAGE_SEND",
    OPENAI_BATCH: "OPENAI_BATCH",
    ORGANISATION_DATA_COPY: "ORGANISATION_DATA_COPY",
    OTHER: "OTHER",
} as const;
export type BulkJobType = (typeof BulkJobType)[keyof typeof BulkJobType];

export interface BulkJob {
    id: number;
    uuid: string;
    organisation_uuid: string;
    created_by_user_uuid: string | null;
    title: string;
    type: BulkJobType;
    status: BulkJobStatus;
    error: string | null;
    retries: number;
    max_retries: number;
    progress_current: number;
    progress_total: number;
    queue_name: string | null;
    queue_job_id: string | null;
    reference_type: string | null;
    reference_uuid: string | null;
    metadata: Record<string, unknown> | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    organisation?: { uuid: string; name: string } | null;
}

export interface ListBulkJobsQuery {
    page?: number;
    limit?: number;
    status?: BulkJobStatus;
    type?: BulkJobType;
    active_only?: boolean;
}

export interface ListBulkJobsResult {
    data: BulkJob[];
    total: number;
    page: number;
    limit: number;
}

export interface BulkJobActionResult {
    uuid: string;
    ok: boolean;
    error?: string;
}
