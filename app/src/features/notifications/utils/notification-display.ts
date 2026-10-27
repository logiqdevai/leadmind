import { Bell, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, UserCheck, type LucideIcon } from "lucide-react";
import type { AppNotification, NotificationType } from "../interfaces/notification.interface";

export const NOTIFICATION_TYPE_META: Record<NotificationType, { label: string; icon: LucideIcon; tone: string }> = {
    REMINDER_DUE: { label: "Reminder", icon: Bell, tone: "text-accent bg-accent/10" },
    BOOKING_CREATED: { label: "New booking", icon: CalendarCheck, tone: "text-success bg-success/10" },
    BOOKING_REQUESTED: { label: "Booking request", icon: CalendarPlus, tone: "text-warning bg-warning/10" },
    BOOKING_RESCHEDULED: { label: "Rescheduled", icon: CalendarClock, tone: "text-accent bg-accent/10" },
    BOOKING_CANCELLED: { label: "Cancelled", icon: CalendarX, tone: "text-danger bg-danger/10" },
    BOOKING_ASSIGNED: { label: "Assigned", icon: UserCheck, tone: "text-accent bg-accent/10" },
};

export const NOTIFICATION_FILTER_OPTIONS: { id: "" | NotificationType; label: string }[] = [
    { id: "", label: "All types" },
    ...(Object.entries(NOTIFICATION_TYPE_META) as [NotificationType, { label: string }][]).map(([id, meta]) => ({
        id,
        label: meta.label,
    })),
];

export const formatNotificationDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export const formatNotificationTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const formatNotificationDateTime = (iso: string, timeZone?: string): string =>
    new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
    });

/** Short "5m ago" style label for the bell menu; falls back to the date for anything older than a week. */
export function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatNotificationDate(iso);
}

export const isBookingNotification = (n: Pick<AppNotification, "entity_type">): boolean => n.entity_type === "booking";
