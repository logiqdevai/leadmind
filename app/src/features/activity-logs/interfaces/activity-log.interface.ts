export interface ActivityLogActor {
    uuid: string;
    full_name: string | null;
    email: string;
}

export interface ActivityLogFieldChange {
    from: unknown;
    to: unknown;
}

export interface ActivityLog {
    uuid: string;
    organisation_uuid: string;
    actor_user_uuid: string | null;
    entity_type: string;
    entity_uuid: string | null;
    action: string;
    summary: string | null;
    metadata: Record<string, unknown> | null;
    changes: Record<string, ActivityLogFieldChange> | null;
    created_at: string;
    actor: ActivityLogActor | null;
}

export interface ListActivityLogsQuery {
    page?: number;
    limit?: number;
    entity_type?: string;
    action?: string;
    actor_user_uuid?: string;
    search?: string;
    from?: string;
    to?: string;
}

export interface ListActivityLogsResult {
    data: ActivityLog[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}
