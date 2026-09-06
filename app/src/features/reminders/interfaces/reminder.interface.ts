export type ReminderStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export type ReminderSource = "MANUAL" | "AI" | "SYSTEM";

export type ReminderType = "GENERAL" | "CALL" | "EMAIL" | "MEETING" | "TASK" | "FOLLOW_UP";

export interface ReminderContact {
    uuid: string;
    name: string | null;
    company: string | null;
    email: string | null;
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
}

export interface UpdateReminderPayload {
    title?: string | null;
    notes?: string | null;
    remind_at?: string;
    status?: ReminderStatus;
}

export interface ListRemindersQuery {
    contact_uuid?: string;
    status?: ReminderStatus;
    range?: "today" | "week" | "month" | "all" | "overdue";
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
