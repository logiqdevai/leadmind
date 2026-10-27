export type ReminderStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export type ReminderSource = "MANUAL" | "AI" | "SYSTEM";

export type ReminderType = "GENERAL" | "CALL" | "EMAIL" | "MEETING" | "TASK" | "FOLLOW_UP";

export interface ReminderContact {
    uuid: string;
    name: string | null;
    company: string | null;
    email: string | null;
}

/** A member who receives the reminder. */
export interface ReminderAssignee {
    uuid: string;
    full_name: string | null;
    email: string;
}

export interface ReminderAiDraft {
    subject: string;
    body: string;
    generated_at: string;
}

export interface Reminder {
    uuid: string;
    user_uuid: string;
    contact_uuid: string;
    title: string | null;
    notes: string | null;
    remind_at: string;
    status: ReminderStatus;
    source: ReminderSource;
    type: ReminderType;
    job_id: string | null;
    outreach_message_uuid?: string | null;
    metadata?: { ai_draft?: ReminderAiDraft } | null;
    contact: ReminderContact;
    /** Members who get this reminder; empty means every member of the organisation. */
    assignees: ReminderAssignee[];
    created_at: string;
    updated_at: string;
}

export interface ReminderStats {
    pending: number;
    due_today: number;
    overdue: number;
    completed_this_week: number;
}

export interface CreateReminderPayload {
    contact_uuid: string;
    title?: string;
    notes?: string;
    remind_at: string;
    status?: ReminderStatus;
    /** Omitted: you. Empty array: everyone in the organisation. */
    assignee_user_uuids?: string[];
}

export interface UpdateReminderPayload {
    title?: string | null;
    notes?: string | null;
    remind_at?: string;
    status?: ReminderStatus;
    /** Replaces the assignees; empty array means everyone. */
    assignee_user_uuids?: string[];
}

export interface ListRemindersQuery {
    contact_uuid?: string;
    /** Reminders this member receives: assigned to them or to everyone. */
    for_user_uuid?: string;
    status?: ReminderStatus;
    range?: "today" | "week" | "month" | "all" | "overdue";
    sort?: "closest" | "remind_at_asc" | "remind_at_desc";
    /** IANA timezone for the "today" range. */
    timezone?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedReminders {
    data: Reminder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
