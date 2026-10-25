import { useMemo, type FC } from "react";
import { cn } from "@/lib/utils";
import type { Booking, BookingBlock } from "@/features/bookings/interfaces/bookings.interfaces";
import { dateKeyInZone, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import { dayOfMonth, isSameMonth, segmentsForDay, weekdayShort } from "../utils/calendar-grid";
import { BlockedEvent, BookingEventButton } from "./calendar-event";

const MAX_PER_CELL = 3;
const DEFAULT_CREATE_TIME = "09:00";

interface CalendarMonthViewProps {
    days: string[];
    anchor: string;
    todayKey: string;
    timezone: string;
    bookings: Booking[];
    blocks: BookingBlock[];
    onSelectBooking: (uuid: string) => void;
    onSelectBlock: (block: BookingBlock) => void;
    onCreateAt: (startIso: string) => void;
    onOpenDay: (dateKey: string) => void;
}

/** Month grid (desktop). Each cell lists its first bookings and links to the day view for the rest. */
export const CalendarMonthView: FC<CalendarMonthViewProps> = ({
    days,
    anchor,
    todayKey,
    timezone,
    bookings,
    blocks,
    onSelectBooking,
    onSelectBlock,
    onCreateAt,
    onOpenDay,
}) => {
    const bookingsByDay = useMemo(() => {
        const map = new Map<string, Booking[]>();
        for (const b of bookings) {
            const key = dateKeyInZone(b.start_at, timezone);
            const list = map.get(key) ?? [];
            list.push(b);
            map.set(key, list);
        }
        for (const list of map.values()) list.sort((a, b) => a.start_at.localeCompare(b.start_at));
        return map;
    }, [bookings, timezone]);

    return (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface">
            <div className="grid grid-cols-7 border-b border-border/60 bg-surface-secondary/40">
                {days.slice(0, 7).map((day) => (
                    <div
                        key={day}
                        className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
                    >
                        {weekdayShort(day)}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((day, index) => {
                    const dayBookings = bookingsByDay.get(day) ?? [];
                    const dayBlocks = segmentsForDay(blocks, day, timezone);
                    const visible = dayBookings.slice(0, MAX_PER_CELL);
                    const hidden = dayBookings.length - visible.length;
                    const inMonth = isSameMonth(day, anchor);
                    const isToday = day === todayKey;
                    return (
                        <div
                            key={day}
                            role="presentation"
                            onClick={() => onCreateAt(zonedTimeToIso(day, DEFAULT_CREATE_TIME, timezone))}
                            className={cn(
                                "flex min-h-28 min-w-0 cursor-pointer flex-col gap-1 border-border/60 p-1.5 transition-colors duration-200 hover:bg-surface-secondary/40",
                                index % 7 !== 0 && "border-l",
                                index >= 7 && "border-t",
                                !inMonth && "bg-surface-secondary/20",
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDay(day);
                                    }}
                                    className={cn(
                                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-200",
                                        isToday
                                            ? "bg-accent text-accent-foreground"
                                            : inMonth
                                              ? "text-foreground hover:bg-surface-secondary"
                                              : "text-muted hover:bg-surface-secondary",
                                    )}
                                    aria-label={`Open ${day}`}
                                >
                                    {dayOfMonth(day)}
                                </button>
                            </div>
                            {dayBlocks.slice(0, 1).map((seg) => (
                                <BlockedEvent
                                    key={seg.item.uuid}
                                    block={seg.item}
                                    timezone={timezone}
                                    onSelect={onSelectBlock}
                                    compact
                                />
                            ))}
                            {dayBlocks.length > 1 ? (
                                <span className="px-1 text-[11px] text-muted">+{dayBlocks.length - 1} blocked</span>
                            ) : null}
                            {visible.map((b) => (
                                <BookingEventButton key={b.uuid} booking={b} timezone={timezone} onSelect={onSelectBooking} compact />
                            ))}
                            {hidden > 0 ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDay(day);
                                    }}
                                    className="self-start rounded px-1 text-[11px] font-medium text-muted hover:text-foreground"
                                >
                                    +{hidden} more
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
