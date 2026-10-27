export type NotificationType =
    | "REMINDER_DUE"
    | "BOOKING_CREATED"
    | "BOOKING_REQUESTED"
    | "BOOKING_RESCHEDULED"
    | "BOOKING_CANCELLED"
    | "BOOKING_ASSIGNED";

/** Type-specific details; reminder and booking notifications each fill their own subset. */
export interface NotificationData {
    // Reminder
    reminder_type?: string;
    remind_at?: string;
    contact_uuid?: string | null;
    contact_name?: string | null;
    contact_company?: string | null;
    contact_email?: string | null;
    // Booking
    booking_status?: string;
    start_at?: string;
    end_at?: string;
    duration_minutes?: number;
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string | null;
    invitee_notes?: string | null;
    location_type?: string;
    location_value?: string | null;
    meeting_url?: string | null;
}

export interface AppNotification {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string;
    type: NotificationType;
    title: string;
    body: string | null;
    entity_type: "reminder" | "booking" | null;
    entity_uuid: string | null;
    data: NotificationData | null;
    read_at: string | null;
    created_at: string;
}

export interface ListNotificationsQuery {
    unread_only?: boolean;
    type?: NotificationType;
    page?: number;
    limit?: number;
}

export interface PaginatedNotifications {
    data: AppNotification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
