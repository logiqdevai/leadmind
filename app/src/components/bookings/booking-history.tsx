import type { FC } from "react";
import { Chip } from "@heroui/react";
import { History, Mail } from "lucide-react";
import { DashboardEmptyState } from "@/pages/dashboard/components/dashboard-shared";
import {
    BookingEventTypes,
    type BookingDetail,
    type BookingEventType,
    type BookingNotification,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDateTime } from "@/features/bookings/utils/booking-time";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<BookingEventType, string> = {
    [BookingEventTypes.CREATED]: "Booked",
    [BookingEventTypes.CONFIRMED]: "Confirmed",
    [BookingEventTypes.ASSIGNED]: "Assigned",
    [BookingEventTypes.RESCHEDULED]: "Rescheduled",
    [BookingEventTypes.CANCELLED]: "Cancelled",
    [BookingEventTypes.STATUS_CHANGED]: "Status changed",
    [BookingEventTypes.UPDATED]: "Details updated",
    [BookingEventTypes.NOTE_UPDATED]: "Notes updated",
    [BookingEventTypes.NOTIFICATION_SENT]: "Email sent",
    [BookingEventTypes.NOTIFICATION_FAILED]: "Email failed",
    [BookingEventTypes.CALENDAR_SYNCED]: "Synced to Google Calendar",
    [BookingEventTypes.CALENDAR_SYNC_FAILED]: "Calendar sync failed",
};

const FAILED_EVENTS: BookingEventType[] = [BookingEventTypes.NOTIFICATION_FAILED, BookingEventTypes.CALENDAR_SYNC_FAILED];

const NOTIFICATION_KIND_LABELS: Record<BookingNotification["kind"], string> = {
    CONFIRMATION: "Confirmation",
    REMINDER: "Reminder",
    CANCELLATION: "Cancellation",
    RESCHEDULE: "Reschedule",
};

const NOTIFICATION_STATUS_COLORS: Record<BookingNotification["status"], "success" | "danger" | "default"> = {
    SENT: "success",
    FAILED: "danger",
    SKIPPED: "default",
};

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

export const BookingHistory: FC<{ booking: BookingDetail; timezone: string }> = ({ booking, timezone }) => {
    const events = [...booking.events].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const notifications = [...booking.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h4 className={sectionTitle}>Timeline</h4>
                {events.length === 0 ? (
                    <DashboardEmptyState icon={History} title="No history yet" body="Changes to this booking will show up here." />
                ) : (
                    <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                        {events.map((event) => {
                            const actor =
                                event.actor_type === "USER"
                                    ? (event.actor?.full_name ?? event.actor?.email ?? "Team member")
                                    : event.actor_type === "INVITEE"
                                      ? "Invitee"
                                      : "System";
                            const failed = FAILED_EVENTS.includes(event.type);
                            return (
                                <li key={event.uuid} className="relative">
                                    <span
                                        className={cn(
                                            "absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background",
                                            failed ? "bg-danger" : "bg-accent",
                                        )}
                                    />
                                    <p className={cn("text-sm font-medium", failed ? "text-danger" : "text-foreground")}>
                                        {EVENT_LABELS[event.type] ?? event.type}
                                    </p>
                                    {event.summary ? <p className="text-sm text-muted">{event.summary}</p> : null}
                                    <p className="mt-0.5 text-xs text-muted">
                                        {actor} · {formatDateTime(event.created_at, timezone)}
                                    </p>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            <section className="flex flex-col gap-3">
                <h4 className={sectionTitle}>Emails</h4>
                {notifications.length === 0 ? (
                    <DashboardEmptyState icon={Mail} title="No emails sent" body="Confirmation, reminder and change emails appear here." />
                ) : (
                    <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                        {notifications.map((n) => (
                            <li key={n.uuid} className="flex flex-col gap-1 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">{NOTIFICATION_KIND_LABELS[n.kind]}</span>
                                    <Chip size="sm" variant="soft" color={NOTIFICATION_STATUS_COLORS[n.status]}>
                                        <Chip.Label>{n.status.charAt(0) + n.status.slice(1).toLowerCase()}</Chip.Label>
                                    </Chip>
                                </div>
                                <p className="truncate text-xs text-muted">
                                    {n.recipient_email} · {formatDateTime(n.sent_at ?? n.created_at, timezone)}
                                </p>
                                {n.error ? <p className="text-xs text-danger">{n.error}</p> : null}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
