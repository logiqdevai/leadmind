import { useMemo, type FC } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardEmptyState } from "@/pages/dashboard/components/dashboard-shared";
import { BookingStatusChip } from "@/components/bookings/booking-shared";
import { bookingDisplayName } from "@/components/bookings/utils/booking-display";
import type { Booking, BookingBlock } from "@/features/bookings/interfaces/bookings.interfaces";
import { dateKeyInZone, formatDateKey, formatTimeRange } from "@/features/bookings/utils/booking-time";
import { segmentsForDay } from "../utils/calendar-grid";
import { BlockedEvent } from "./calendar-event";

interface CalendarAgendaProps {
    /** Local day keys to cover (only days with items are shown). */
    days: string[];
    todayKey: string;
    timezone: string;
    bookings: Booking[];
    blocks: BookingBlock[];
    onSelectBooking: (uuid: string) => void;
    onSelectBlock: (block: BookingBlock) => void;
    emptyAction?: React.ReactNode;
}

/** Day-grouped list of bookings and blocked periods (month view on small screens). */
export const CalendarAgenda: FC<CalendarAgendaProps> = ({
    days,
    todayKey,
    timezone,
    bookings,
    blocks,
    onSelectBooking,
    onSelectBlock,
    emptyAction,
}) => {
    const groups = useMemo(() => {
        const byDay = new Map<string, Booking[]>();
        for (const b of bookings) {
            const key = dateKeyInZone(b.start_at, timezone);
            const list = byDay.get(key) ?? [];
            list.push(b);
            byDay.set(key, list);
        }
        return days
            .map((day) => ({
                day,
                bookings: (byDay.get(day) ?? []).sort((a, b) => a.start_at.localeCompare(b.start_at)),
                blocks: segmentsForDay(blocks, day, timezone),
            }))
            .filter((g) => g.bookings.length || g.blocks.length);
    }, [days, bookings, blocks, timezone]);

    if (!groups.length) {
        return (
            <div className="rounded-2xl border border-border/80 bg-surface">
                <DashboardEmptyState
                    icon={CalendarDays}
                    title="Nothing scheduled"
                    body="No bookings or blocked time in this period."
                    action={emptyAction}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {groups.map((group) => (
                <section key={group.day} className="overflow-hidden rounded-2xl border border-border/80 bg-surface">
                    <h3
                        className={cn(
                            "border-b border-border/60 bg-surface-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]",
                            group.day === todayKey ? "text-accent" : "text-muted",
                        )}
                    >
                        {group.day === todayKey ? "Today · " : ""}
                        {formatDateKey(group.day)}
                    </h3>
                    {group.blocks.length ? (
                        <div className="flex flex-col gap-1.5 p-2">
                            {group.blocks.map((seg) => (
                                <BlockedEvent key={seg.item.uuid} block={seg.item} timezone={timezone} onSelect={onSelectBlock} />
                            ))}
                        </div>
                    ) : null}
                    <ul className="divide-y divide-border/40">
                        {group.bookings.map((b) => (
                            <li key={b.uuid}>
                                <button
                                    type="button"
                                    onClick={() => onSelectBooking(b.uuid)}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-200 hover:bg-surface-secondary"
                                >
                                    <span className="w-24 shrink-0 text-xs tabular-nums text-muted">
                                        {formatTimeRange(b.start_at, b.end_at, timezone)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-foreground">{bookingDisplayName(b)}</span>
                                        <span className="block truncate text-xs text-muted">
                                            {[b.booking_page?.name, b.assigned_user?.full_name ?? b.assigned_user?.email]
                                                .filter(Boolean)
                                                .join(" · ") || "One-off meeting"}
                                        </span>
                                    </span>
                                    <BookingStatusChip status={b.status} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
};
