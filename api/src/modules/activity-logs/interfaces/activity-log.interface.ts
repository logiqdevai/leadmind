export interface CreateActivityLogInput {
    organisation_uuid: string;
    actor_user_uuid?: string | null;
    entity_type: string;
    entity_uuid?: string | null;
    action: string;
    summary?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface ActivityLogActor {
    uuid: string;
    full_name: string | null;
    email: string;
}

export interface ActivityLogRecord {
    uuid: string;
    organisation_uuid: string;
    actor_user_uuid: string | null;
    entity_type: string;
    entity_uuid: string | null;
    action: string;
    summary: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    actor: ActivityLogActor | null;
}
