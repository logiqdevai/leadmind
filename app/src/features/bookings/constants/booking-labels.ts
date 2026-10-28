import {
    BookingLocationTypes,
    BookingStatuses,
    CalendarConnectionStatuses,
    CalendarSyncStatuses,
    type BookingLocationType,
    type BookingStatus,
    type CalendarConnectionStatus,
    type CalendarSyncStatus,
} from "../interfaces/bookings.interfaces";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    [BookingStatuses.PENDING]: "Pending",
    [BookingStatuses.CONFIRMED]: "Confirmed",
    [BookingStatuses.CANCELLED]: "Cancelled",
    [BookingStatuses.RESCHEDULED]: "Rescheduled",
    [BookingStatuses.COMPLETED]: "Completed",
    [BookingStatuses.NO_SHOW]: "No-show",
};

/** HeroUI Chip colors per status (visual distinction in lists and calendar). */
export const BOOKING_STATUS_CHIP_COLORS: Record<BookingStatus, "default" | "accent" | "success" | "warning" | "danger"> = {
    [BookingStatuses.PENDING]: "warning",
    [BookingStatuses.CONFIRMED]: "accent",
    [BookingStatuses.CANCELLED]: "danger",
    [BookingStatuses.RESCHEDULED]: "accent",
    [BookingStatuses.COMPLETED]: "success",
    [BookingStatuses.NO_SHOW]: "default",
};

/** Tailwind classes for calendar event blocks per status. */
export const BOOKING_STATUS_BLOCK_CLASSES: Record<BookingStatus, string> = {
    [BookingStatuses.PENDING]: "border-warning/60 bg-warning/15 text-foreground",
    [BookingStatuses.CONFIRMED]: "border-accent/60 bg-accent/15 text-foreground",
    [BookingStatuses.CANCELLED]: "border-danger/40 bg-danger/10 text-muted line-through",
    [BookingStatuses.RESCHEDULED]: "border-accent/60 bg-accent/10 text-foreground",
    [BookingStatuses.COMPLETED]: "border-success/50 bg-success/10 text-foreground",
    [BookingStatuses.NO_SHOW]: "border-border bg-surface-secondary text-muted",
};

export const BOOKING_LOCATION_LABELS: Record<BookingLocationType, string> = {
    [BookingLocationTypes.NONE]: "No location",
    [BookingLocationTypes.GOOGLE_MEET]: "Google Meet",
    [BookingLocationTypes.PHONE]: "Phone call",
    [BookingLocationTypes.IN_PERSON]: "In person",
    [BookingLocationTypes.CUSTOM]: "Custom",
};

export const CALENDAR_SYNC_LABELS: Record<CalendarSyncStatus, string> = {
    [CalendarSyncStatuses.NOT_SYNCED]: "Not in Google Calendar",
    [CalendarSyncStatuses.PENDING]: "Syncing…",
    [CalendarSyncStatuses.SYNCED]: "In Google Calendar",
    [CalendarSyncStatuses.FAILED]: "Sync failed",
};

export const CALENDAR_CONNECTION_STATUS_LABELS: Record<CalendarConnectionStatus, string> = {
    [CalendarConnectionStatuses.INITIATED]: "Connecting",
    [CalendarConnectionStatuses.ACTIVE]: "Connected",
    [CalendarConnectionStatuses.EXPIRED]: "Reconnect needed",
    [CalendarConnectionStatuses.FAILED]: "Connection failed",
    [CalendarConnectionStatuses.DISCONNECTED]: "Disconnected",
};

export const BOOKING_DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export const BOOKING_REMINDER_PRESETS = [
    { minutes: 1440, label: "24 hours before" },
    { minutes: 720, label: "12 hours before" },
    { minutes: 60, label: "1 hour before" },
    { minutes: 15, label: "15 minutes before" },
];

/** Variables available in booking notification templates and calendar event text. */
export const BOOKING_TEMPLATE_VARIABLES = [
    { key: "contact.first_name", label: "Invitee first name" },
    { key: "contact.last_name", label: "Invitee last name" },
    { key: "contact.full_name", label: "Invitee full name" },
    { key: "contact.email", label: "Invitee email" },
    { key: "contact.phone", label: "Invitee phone" },
    { key: "booking.title", label: "Meeting title" },
    { key: "booking.date", label: "Date" },
    { key: "booking.time", label: "Time range with timezone" },
    { key: "booking.start_time", label: "Start time" },
    { key: "booking.duration", label: "Duration" },
    { key: "booking.location", label: "Location" },
    { key: "booking.meeting_url", label: "Google Meet link" },
    { key: "booking.reschedule_url", label: "Reschedule link" },
    { key: "booking.cancel_url", label: "Cancel link" },
    { key: "booking.notes", label: "Invitee notes" },
    { key: "team_member.name", label: "Team member name" },
    { key: "team_member.email", label: "Team member email" },
    { key: "organisation.name", label: "Organisation name" },
    { key: "brand.name", label: "Brand name (booking page)" },
] as const;
