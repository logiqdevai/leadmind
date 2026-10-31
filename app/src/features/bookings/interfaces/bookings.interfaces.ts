export const BookingStatuses = {
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED",
    RESCHEDULED: "RESCHEDULED",
    COMPLETED: "COMPLETED",
    NO_SHOW: "NO_SHOW",
} as const;
export type BookingStatus = (typeof BookingStatuses)[keyof typeof BookingStatuses];

/** Statuses that still occupy their slot. */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
    BookingStatuses.PENDING,
    BookingStatuses.CONFIRMED,
    BookingStatuses.RESCHEDULED,
];

export const BookingSources = {
    PUBLIC: "PUBLIC",
    MANUAL: "MANUAL",
    REMINDER: "REMINDER",
} as const;
export type BookingSource = (typeof BookingSources)[keyof typeof BookingSources];

export const BookingLocationTypes = {
    NONE: "NONE",
    GOOGLE_MEET: "GOOGLE_MEET",
    PHONE: "PHONE",
    IN_PERSON: "IN_PERSON",
    CUSTOM: "CUSTOM",
} as const;
export type BookingLocationType = (typeof BookingLocationTypes)[keyof typeof BookingLocationTypes];

export const BookingAssignmentModes = {
    ROUND_ROBIN: "ROUND_ROBIN",
    LEAST_BUSY: "LEAST_BUSY",
} as const;
export type BookingAssignmentMode = (typeof BookingAssignmentModes)[keyof typeof BookingAssignmentModes];

export const BookingUnavailableSlotsModes = {
    HIDE: "HIDE",
    SHOW_DISABLED: "SHOW_DISABLED",
} as const;
export type BookingUnavailableSlotsMode =
    (typeof BookingUnavailableSlotsModes)[keyof typeof BookingUnavailableSlotsModes];

export const CalendarSyncStatuses = {
    NOT_SYNCED: "NOT_SYNCED",
    PENDING: "PENDING",
    SYNCED: "SYNCED",
    FAILED: "FAILED",
} as const;
export type CalendarSyncStatus = (typeof CalendarSyncStatuses)[keyof typeof CalendarSyncStatuses];

export const CalendarConnectionStatuses = {
    INITIATED: "INITIATED",
    ACTIVE: "ACTIVE",
    EXPIRED: "EXPIRED",
    FAILED: "FAILED",
    DISCONNECTED: "DISCONNECTED",
} as const;
export type CalendarConnectionStatus = (typeof CalendarConnectionStatuses)[keyof typeof CalendarConnectionStatuses];

export const BookingEventTypes = {
    CREATED: "CREATED",
    CONFIRMED: "CONFIRMED",
    ASSIGNED: "ASSIGNED",
    RESCHEDULED: "RESCHEDULED",
    CANCELLED: "CANCELLED",
    STATUS_CHANGED: "STATUS_CHANGED",
    UPDATED: "UPDATED",
    NOTE_UPDATED: "NOTE_UPDATED",
    NOTIFICATION_SENT: "NOTIFICATION_SENT",
    NOTIFICATION_FAILED: "NOTIFICATION_FAILED",
    CALENDAR_SYNCED: "CALENDAR_SYNCED",
    CALENDAR_SYNC_FAILED: "CALENDAR_SYNC_FAILED",
} as const;
export type BookingEventType = (typeof BookingEventTypes)[keyof typeof BookingEventTypes];

export const BookingQuestionTypes = {
    TEXT: "TEXT",
    TEXTAREA: "TEXTAREA",
    SELECT: "SELECT",
    CHECKBOX: "CHECKBOX",
} as const;
export type BookingQuestionType = (typeof BookingQuestionTypes)[keyof typeof BookingQuestionTypes];

export interface BookingUserRef {
    uuid: string;
    full_name: string | null;
    email: string;
}

export interface TimeRange {
    start: string;
    end: string;
}

/** ISO weekday ("1"=Mon .. "7"=Sun) -> working periods. */
export type WeeklyHours = Record<string, TimeRange[]>;

// --- Bookings ---------------------------------------------------------------

export interface Booking {
    uuid: string;
    organisation_uuid: string;
    booking_page_uuid: string | null;
    booking_link_uuid: string | null;
    contact_uuid: string | null;
    assigned_user_uuid: string | null;
    created_by_user_uuid: string | null;
    source: BookingSource;
    status: BookingStatus;
    start_at: string;
    end_at: string;
    duration_minutes: number;
    invitee_timezone: string | null;
    invitee_name: string;
    invitee_email: string;
    invitee_phone: string | null;
    invitee_company: string | null;
    invitee_notes: string | null;
    answers: Record<string, string | boolean> | null;
    internal_notes: string | null;
    location_type: BookingLocationType;
    location_value: string | null;
    meeting_url: string | null;
    calendar_event_id: string | null;
    calendar_html_link: string | null;
    calendar_sync_status: CalendarSyncStatus;
    calendar_sync_error: string | null;
    calendar_synced_at: string | null;
    confirmed_at: string | null;
    /** The booking's link asked the invitee to confirm they will attend. */
    attendance_confirmation_required: boolean;
    attendance_confirmed_at: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    cancelled_by: "USER" | "INVITEE" | "SYSTEM" | null;
    reschedule_count: number;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    booking_page: { uuid: string; name: string; slug: string; primary_color: string | null } | null;
    contact: { uuid: string; name: string | null; email: string | null; phone: string | null; company: string | null } | null;
    assigned_user: BookingUserRef | null;
}

export interface BookingEvent {
    uuid: string;
    type: BookingEventType;
    actor_type: "USER" | "INVITEE" | "SYSTEM";
    actor: BookingUserRef | null;
    summary: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface BookingNotification {
    uuid: string;
    kind: "CONFIRMATION" | "REMINDER" | "CANCELLATION" | "RESCHEDULE";
    recipient_email: string;
    status: "SENT" | "FAILED" | "SKIPPED";
    error: string | null;
    sent_at: string | null;
    created_at: string;
}

export interface BookingDetail extends Booking {
    booking_link: { uuid: string; code: string; label: string | null; contact_uuid: string | null } | null;
    created_by: BookingUserRef | null;
    events: BookingEvent[];
    notifications: BookingNotification[];
}

export interface BookingFilters {
    from?: string;
    to?: string;
    /** Comma separated statuses. */
    status?: string;
    /** Member uuid or "unassigned". */
    assigned_user_uuid?: string;
    booking_page_uuid?: string;
    contact_uuid?: string;
    source?: BookingSource;
    search?: string;
}

export interface ListBookingsQuery extends BookingFilters {
    page?: number;
    limit?: number;
    order_by?: "start_at" | "created_at";
    order_direction?: "asc" | "desc";
}

export interface PaginatedBookings {
    data: Booking[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

export interface BookingBlock {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string | null;
    start_at: string;
    end_at: string;
    reason: string | null;
    created_at: string;
    user?: BookingUserRef | null;
}

export interface BookingCalendarData {
    bookings: Booking[];
    blocks: BookingBlock[];
}

export interface BookingStats {
    total: number;
    by_status: Partial<Record<BookingStatus, number>>;
    by_source: Partial<Record<BookingSource, number>>;
    by_page: { booking_page_uuid: string | null; count: number }[];
    by_member: { assigned_user_uuid: string | null; count: number }[];
}

export interface CreateBookingDto {
    booking_page_uuid?: string;
    contact_uuid?: string;
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string;
    invitee_notes?: string;
    invitee_timezone?: string;
    start_at: string;
    duration_minutes?: number;
    assigned_user_uuid?: string;
    location_type?: BookingLocationType;
    location_value?: string;
    internal_notes?: string;
    ignore_availability?: boolean;
    notify?: boolean;
    answers?: Record<string, string | boolean>;
}

export interface UpdateBookingDto {
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string;
    invitee_notes?: string;
    internal_notes?: string;
    location_type?: BookingLocationType;
    location_value?: string;
}

export interface RescheduleBookingDto {
    start_at: string;
    assigned_user_uuid?: string;
    ignore_availability?: boolean;
    notify?: boolean;
}

export interface CancelBookingDto {
    reason?: string;
    notify?: boolean;
}

export type SettableBookingStatus =
    | typeof BookingStatuses.PENDING
    | typeof BookingStatuses.CONFIRMED
    | typeof BookingStatuses.RESCHEDULED
    | typeof BookingStatuses.COMPLETED
    | typeof BookingStatuses.NO_SHOW;

export interface AssignBookingDto {
    assigned_user_uuid: string;
    ignore_availability?: boolean;
}

// --- Booking pages ----------------------------------------------------------

export interface BookingQuestion {
    id: string;
    label: string;
    type: BookingQuestionType;
    required?: boolean;
    options?: string[];
}

export interface BookingPageMember {
    id: number;
    booking_page_uuid: string;
    user_uuid: string;
    priority: number;
    last_assigned_at: string | null;
    user: BookingUserRef;
}

export interface BookingPage {
    uuid: string;
    organisation_uuid: string;
    name: string;
    slug: string;
    is_active: boolean;
    is_default: boolean;
    title: string | null;
    description: string | null;
    intro_text: string | null;
    expectations: string[];
    brand_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    confirmation_message: string | null;
    redirect_url: string | null;
    cta_label: string | null;
    show_team_member: boolean;
    show_timezone: boolean;
    questions: BookingQuestion[] | null;
    require_phone: boolean;
    duration_minutes: number;
    duration_options: number[];
    slot_interval_minutes: number | null;
    min_notice_minutes: number;
    max_advance_days: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    min_gap_minutes: number;
    max_gap_minutes: number | null;
    max_bookings_per_day: number | null;
    seats_per_slot: number;
    assignment_mode: BookingAssignmentMode;
    allow_invitee_member_choice: boolean;
    requires_confirmation: boolean;
    /** Marking a booking completed logs a COMPLETED meeting on its contact. */
    auto_log_meeting: boolean;
    /** How public pages show times that are inside working hours but not bookable. */
    unavailable_slots_mode: BookingUnavailableSlotsMode;
    location_type: BookingLocationType;
    location_value: string | null;
    allow_cancellation: boolean;
    allow_reschedule: boolean;
    cancellation_deadline_minutes: number;
    reschedule_deadline_minutes: number;
    require_cancellation_reason: boolean;
    send_confirmation_email: boolean;
    send_reminder_emails: boolean;
    reminder_offsets_minutes: number[];
    send_cancellation_email: boolean;
    send_reschedule_email: boolean;
    notify_assignee: boolean;
    additional_recipients: string[];
    include_meeting_link: boolean;
    include_calendar_details: boolean;
    /** Create a Meeting reminder on the contact's Reminders for confirmed bookings. */
    create_team_reminder: boolean;
    team_reminder_offset_minutes: number;
    /** Templates offered per email type; the one matching the invitee's language is sent. */
    confirmation_template_uuids: string[];
    reminder_template_uuids: string[];
    cancellation_template_uuids: string[];
    reschedule_template_uuids: string[];
    calendar_event_title: string | null;
    calendar_event_description: string | null;
    created_at: string;
    updated_at: string;
    members: BookingPageMember[];
    _count: { bookings: number; links: number };
    /** Generic shareable URL of the page. */
    public_url: string | null;
}

/** Every editable field of a page; all optional on update. */
export type BookingPageInput = Partial<
    Omit<
        BookingPage,
        "uuid" | "organisation_uuid" | "created_at" | "updated_at" | "members" | "_count" | "public_url" | "questions"
    >
> & {
    questions?: BookingQuestion[];
    members?: { user_uuid: string; priority?: number }[];
};

export type CreateBookingPageDto = BookingPageInput & { name: string };
export type UpdateBookingPageDto = BookingPageInput;

export interface SlotsQuery {
    from: string;
    to: string;
    timezone?: string;
    duration?: number;
    member_uuid?: string;
    exclude_booking_uuid?: string;
    /** Internal previews only: also list unbookable times (flagged `available: false`). */
    include_unavailable?: boolean;
}

export interface BookingSlot {
    start: string;
    end: string;
    /** False only for times a page chose to show disabled (see `unavailable_slots_mode`). */
    available: boolean;
    /** Internal previews only: members free at this slot. */
    user_uuids?: string[];
}

export interface SlotsByDate {
    timezone: string;
    duration_minutes: number;
    /** Local date "YYYY-MM-DD" (in `timezone`) -> slots. */
    days: Record<string, BookingSlot[]>;
}

// --- Booking links ----------------------------------------------------------

export interface BookingLink {
    uuid: string;
    code: string;
    url: string;
    organisation_uuid: string;
    booking_page_uuid: string;
    contact_uuid: string | null;
    label: string | null;
    auto_create_contact: boolean;
    require_attendance_confirmation: boolean;
    is_active: boolean;
    deactivated_at: string | null;
    last_used_at: string | null;
    created_at: string;
    booking_page?: { uuid: string; name: string; slug: string; is_active: boolean };
    contact?: { uuid: string; name: string | null; email: string | null } | null;
    _count?: { bookings: number };
}

export interface ListBookingLinksQuery {
    booking_page_uuid?: string;
    contact_uuid?: string;
    generic_only?: boolean;
    include_inactive?: boolean;
}

export interface CreateBookingLinkDto {
    booking_page_uuid: string;
    contact_uuid?: string;
    label?: string;
    auto_create_contact?: boolean;
    require_attendance_confirmation?: boolean;
}

export interface UpdateBookingLinkDto {
    label?: string;
    auto_create_contact?: boolean;
    require_attendance_confirmation?: boolean;
    is_active?: boolean;
}

// --- Availability -----------------------------------------------------------

export interface AvailabilityOverride {
    uuid: string;
    schedule_uuid: string;
    date: string;
    intervals: TimeRange[];
    reason: string | null;
}

export interface AvailabilitySchedule {
    uuid: string | null;
    organisation_uuid: string;
    user_uuid: string;
    timezone: string;
    weekly_hours: WeeklyHours;
    overrides: AvailabilityOverride[];
    /** True until the member saves their own schedule (Mon-Fri 9-17 default). */
    is_default: boolean;
}

export interface UpsertScheduleDto {
    timezone: string;
    weekly_hours: WeeklyHours;
}

export interface UpsertOverrideDto {
    date: string;
    intervals: TimeRange[];
    reason?: string;
}

export interface CreateBookingBlockDto {
    user_uuid?: string;
    organisation_wide?: boolean;
    start_at: string;
    end_at: string;
    reason?: string;
}

export interface UpdateBookingBlockDto {
    start_at?: string;
    end_at?: string;
    reason?: string;
}

export interface RecurringBlock {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string | null;
    /** ISO weekdays: 1 = Monday .. 7 = Sunday. */
    weekdays: number[];
    /** "HH:MM" wall-clock times in `timezone`. */
    start_time: string;
    end_time: string;
    timezone: string;
    reason: string | null;
    created_at: string;
    user?: BookingUserRef | null;
}

export interface CreateRecurringBlockDto {
    user_uuid?: string;
    organisation_wide?: boolean;
    weekdays: number[];
    start_time: string;
    end_time: string;
    timezone: string;
    reason?: string;
}

export interface UpdateRecurringBlockDto {
    weekdays?: number[];
    start_time?: string;
    end_time?: string;
    reason?: string;
}

export interface ListBlocksQuery {
    from: string;
    to: string;
    user_uuid?: string;
}

// --- Calendar connections ---------------------------------------------------

export interface CalendarConnection {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string;
    provider: "GOOGLE";
    status: CalendarConnectionStatus;
    account_email: string | null;
    calendar_id: string;
    calendar_name: string | null;
    check_conflicts: boolean;
    last_error: string | null;
    connected_at: string | null;
    created_at: string;
    updated_at: string;
    user: BookingUserRef;
}

export interface CalendarConnectionsResponse {
    /** False when the workspace has no Composio credentials yet. */
    configured: boolean;
    connections: CalendarConnection[];
}

export interface GoogleCalendarItem {
    id: string;
    summary: string;
    primary: boolean;
    access_role: string;
    time_zone: string | null;
}

export interface UpdateCalendarConnectionDto {
    calendar_id?: string;
    check_conflicts?: boolean;
}

// --- Public booking pages (unauthenticated) ---------------------------------

/** A public page is addressed by a link's short code, or by organisation + page slug (the page's general URL). */
export type PublicPageRef = { code: string } | { organisation: string; slug: string };

export interface PublicBookingPage {
    /** Null when the page was opened by slug (no link involved). */
    code: string | null;
    default_timezone: string;
    page: {
        title: string;
        description: string | null;
        intro_text: string | null;
        expectations: string[];
        brand_name: string;
        logo_url: string | null;
        primary_color: string | null;
        show_timezone: boolean;
        durations: number[];
        default_duration: number;
        max_advance_days: number;
        location_type: BookingLocationType;
        location_details: string | null;
        questions: BookingQuestion[];
        require_phone: boolean;
        requires_confirmation: boolean;
        team: { name: string }[];
        allow_member_choice: boolean;
        members: { uuid: string; name: string }[];
    };
    /** Set on contact-specific links. */
    invitee: { name: string; email_hint: string | null } | null;
}

export interface PublicBookingSummary {
    status: BookingStatus;
    attendance_confirmation_required: boolean;
    attendance_confirmed_at: string | null;
    title: string;
    brand_name: string | null;
    start_at: string;
    end_at: string;
    duration_minutes: number;
    timezone: string;
    invitee_name: string;
    team_member: string | null;
    location_type: BookingLocationType;
    location_details: string | null;
    meeting_url: string | null;
    primary_color: string | null;
    logo_url: string | null;
}

export interface PublicCreateBookingDto {
    start_at: string;
    duration_minutes?: number;
    timezone: string;
    /** Language of the booking page the invitee used (ISO 639-1). */
    language?: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    notes?: string;
    answers?: Record<string, string | boolean>;
    member_uuid?: string;
}

export interface PublicBookingResult {
    booking: PublicBookingSummary;
    manage_url: string;
    confirmation_message: string | null;
    redirect_url: string | null;
}

export interface PublicBookingPolicy {
    can_cancel: boolean;
    can_reschedule: boolean;
    require_cancellation_reason: boolean;
    cancellation_deadline_minutes: number;
    reschedule_deadline_minutes: number;
    reason: string | null;
    /** Booking window of the page (null for bookings without a page). */
    max_advance_days: number | null;
    show_timezone: boolean;
}

export interface PublicManagedBooking {
    booking: PublicBookingSummary;
    policy: PublicBookingPolicy;
}

// --- Emailed booking links (invitations) ---------------------------------------

export const BookingInviteUnits = { HOURS: "HOURS", DAYS: "DAYS", WEEKS: "WEEKS" } as const;
export type BookingInviteUnit = (typeof BookingInviteUnits)[keyof typeof BookingInviteUnits];

export const BookingInvitationStatuses = { ACTIVE: "ACTIVE", BOOKED: "BOOKED", STOPPED: "STOPPED" } as const;
export type BookingInvitationStatus = (typeof BookingInvitationStatuses)[keyof typeof BookingInvitationStatuses];

/** Organisation-wide defaults for booking links emailed to contacts. */
export interface BookingInviteSettings {
    reminder_enabled: boolean;
    reminder_delay_value: number;
    reminder_delay_unit: BookingInviteUnit;
    max_reminders: number;
    /** Null = built-in default text. */
    invite_subject: string | null;
    invite_message: string | null;
    reminder_subject: string | null;
    reminder_message: string | null;
    /** Message templates offered per email, one per language; the contact's language picks one. Empty = text above. */
    invite_template_uuids: string[];
    reminder_template_uuids: string[];
    defaults: {
        invite_subject: string;
        invite_message: string;
        reminder_subject: string;
        reminder_message: string;
    };
}

export type UpdateBookingInviteSettingsDto = Partial<Omit<BookingInviteSettings, "defaults">>;

export interface BookingInvitation {
    uuid: string;
    status: BookingInvitationStatus;
    recipient_email: string;
    sent_at: string;
    reminder_enabled: boolean;
    reminders_sent: number;
    max_reminders: number;
    next_reminder_at: string | null;
    last_error: string | null;
    has_booked: boolean;
    booking_page: { uuid: string; name: string };
    booking_link: { uuid: string; url: string };
}

export interface SendBookingInvitationDto {
    contact_uuid: string;
    booking_page_uuid?: string;
    booking_link_uuid?: string;
    /** Omit to follow the organisation default. */
    remind?: boolean;
}
