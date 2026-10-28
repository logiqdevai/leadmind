import { useMemo, type FC } from "react";
import { CalendarCheck2, TriangleAlert } from "lucide-react";
import { useBookingCalendar } from "@/features/bookings/hooks/use-bookings";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatTimeRange, zonedDayRange, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import { bookingDisplayName } from "./utils/booking-display";

interface DayAvailabilityProps {
    timezone: string;
    /** "YYYY-MM-DD" */
    dateKey: string;
    /** "HH:MM" start of the planned booking. */
    time: string;
    durationMinutes: number;
    /** Member whose schedule is shown. */
    userUuid: string | null;
    memberName: (uuid: string | null | undefined) => string;
}

/** What is already taking up the member's day, so a clash is visible before the booking is submitted. */
export const DayAvailability: FC<DayAvailabilityProps> = ({ timezone, dateKey, time, durationMinutes, userUuid, memberName }) => {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && /^\d{1,2}:\d{2}$/.test(time);
    const range = useMemo(() => (valid ? zonedDayRange(dateKey, dateKey, timezone) : null), [valid, dateKey, timezone]);
    const { data } = useBookingCalendar({
        from: range?.from,
        to: range?.to,
        ...(userUuid && { assigned_user_uuid: userUuid }),
    });

    const busy = useMemo(() => {
        if (!data) return [];
        const bookings = data.bookings
            .filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status))
            .map((b) => ({ key: b.uuid, start: b.start_at, end: b.end_at, label: bookingDisplayName(b) }));
        const blocks = data.blocks.map((b) => ({ key: b.uuid, start: b.start_at, end: b.end_at, label: b.reason || "Blocked time" }));
        return [...bookings, ...blocks].sort((a, b) => a.start.localeCompare(b.start));
    }, [data]);

    if (!valid || !data) return null;

    const start = new Date(zonedTimeToIso(dateKey, time, timezone)).getTime();
    const end = start + durationMinutes * 60_000;
    const clashes = busy.filter((b) => new Date(b.start).getTime() < end && new Date(b.end).getTime() > start);

    return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-surface-secondary/40 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                {clashes.length ? (
                    <TriangleAlert className="size-3.5 text-warning" />
                ) : (
                    <CalendarCheck2 className="size-3.5 text-success" />
                )}
                {clashes.length
                    ? "This time overlaps something on " + memberName(userUuid) + "'s calendar"
                    : busy.length
                      ? `${memberName(userUuid)} is free at this time`
                      : `${memberName(userUuid)} has nothing else booked this day`}
            </p>
            {busy.length ? (
                <ul className="flex flex-col gap-0.5">
                    {busy.map((b) => (
                        <li key={b.key} className="flex items-center justify-between gap-3 text-xs text-muted">
                            <span className="truncate">{b.label}</span>
                            <span className="shrink-0 tabular-nums">{formatTimeRange(b.start, b.end, timezone)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
};
