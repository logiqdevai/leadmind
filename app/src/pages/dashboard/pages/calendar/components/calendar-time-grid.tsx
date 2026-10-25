import { useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import type { Booking, BookingBlock } from "@/features/bookings/interfaces/bookings.interfaces";
import { zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import { minutesOfDayInZone } from "@/components/bookings/utils/booking-display";
import {
    HOUR_HEIGHT,
    MINUTES_PER_DAY,
    SLOT_SNAP_MINUTES,
    dayOfMonth,
    layoutSegments,
    minutesToTimeKey,
    segmentsForDay,
    weekdayShort,
} from "../utils/calendar-grid";
import { BlockedEvent, BookingEventButton } from "./calendar-event";

interface CalendarTimeGridProps {
    days: string[];
    todayKey: string;
    timezone: string;
    bookings: Booking[];
    blocks: BookingBlock[];
    onSelectBooking: (uuid: string) => void;
    onSelectBlock: (block: BookingBlock) => void;
    onCreateAt: (startIso: string) => void;
    onOpenDay: (dateKey: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GRID_HEIGHT = HOUR_HEIGHT * 24;
const SCROLL_TO_HOUR = 7;

const pxFromMinutes = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

function useNowMinute(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(id);
    }, []);
    return now;
}

/** Week / day hour grid; bookings and blocked periods are positioned by wall-clock time in `timezone`. */
export const CalendarTimeGrid: FC<CalendarTimeGridProps> = ({
    days,
    todayKey,
    timezone,
    bookings,
    blocks,
    onSelectBooking,
    onSelectBlock,
    onCreateAt,
    onOpenDay,
}) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const now = useNowMinute();
    const nowMinute = minutesOfDayInZone(now, timezone);
    const isSingleDay = days.length === 1;

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
    }, [days.length]);

    const columns = useMemo(
        () =>
            days.map((day) => ({
                day,
                bookings: layoutSegments(segmentsForDay(bookings, day, timezone)),
                blocks: segmentsForDay(blocks, day, timezone),
            })),
        [days, bookings, blocks, timezone],
    );

    const gridCols = isSingleDay ? "grid-cols-[3.5rem_minmax(0,1fr)]" : "grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

    const handleColumnClick = (day: string) => (event: MouseEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const minutes = ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
        const snapped = Math.min(
            MINUTES_PER_DAY - SLOT_SNAP_MINUTES,
            Math.max(0, Math.floor(minutes / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES),
        );
        onCreateAt(zonedTimeToIso(day, minutesToTimeKey(snapped), timezone));
    };

    return (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface">
            <div className={cn(isSingleDay ? "min-w-0" : "min-w-[720px]")}>
                {/* Day headers */}
                <div className={cn("grid border-b border-border/60 bg-surface-secondary/40", gridCols)}>
                    <div />
                    {days.map((day) => {
                        const isToday = day === todayKey;
                        return (
                            <button
                                key={day}
                                type="button"
                                onClick={() => onOpenDay(day)}
                                className="flex flex-col items-center gap-0.5 border-l border-border/60 py-2 transition-colors duration-200 hover:bg-surface-secondary"
                            >
                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                                    {weekdayShort(day)}
                                </span>
                                <span
                                    className={cn(
                                        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                                        isToday ? "bg-accent text-accent-foreground" : "text-foreground",
                                    )}
                                >
                                    {dayOfMonth(day)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Hour grid */}
                <div ref={scrollRef} className="max-h-[calc(100dvh-22rem)] min-h-[24rem] overflow-y-auto">
                    <div className={cn("relative grid", gridCols)}>
                        <div className="relative" style={{ height: GRID_HEIGHT }}>
                            {HOURS.map((h) =>
                                h === 0 ? null : (
                                    <span
                                        key={h}
                                        className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted"
                                        style={{ top: h * HOUR_HEIGHT }}
                                    >
                                        {minutesToTimeKey(h * 60)}
                                    </span>
                                ),
                            )}
                        </div>
                        {columns.map((col) => (
                            <div
                                key={col.day}
                                role="presentation"
                                onClick={handleColumnClick(col.day)}
                                className={cn(
                                    "relative cursor-pointer border-l border-border/60",
                                    // Hour lines; the 48px step must match HOUR_HEIGHT.
                                    "bg-[linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[100%_48px]",
                                    col.day === todayKey && "bg-accent/[0.03]",
                                )}
                                style={{ height: GRID_HEIGHT }}
                            >
                                {col.blocks.map((seg) => (
                                    <div
                                        key={`block-${seg.item.uuid}`}
                                        className="absolute inset-x-0.5"
                                        style={{
                                            top: pxFromMinutes(seg.startMinute),
                                            height: Math.max(12, pxFromMinutes(seg.endMinute - seg.startMinute)),
                                        }}
                                    >
                                        <BlockedEvent
                                            block={seg.item}
                                            timezone={timezone}
                                            onSelect={onSelectBlock}
                                            className="h-full opacity-90"
                                        />
                                    </div>
                                ))}
                                {col.bookings.map((seg) => {
                                    const height = Math.max(20, pxFromMinutes(seg.endMinute - seg.startMinute) - 2);
                                    return (
                                        <div
                                            key={seg.item.uuid}
                                            className="absolute z-[1] px-0.5"
                                            style={{
                                                top: pxFromMinutes(seg.startMinute) + 1,
                                                height,
                                                left: `${(seg.column / seg.columns) * 100}%`,
                                                width: `${100 / seg.columns}%`,
                                            }}
                                        >
                                            {/* Opaque base so translucent status colours don't show the hour lines. */}
                                            <div className="h-full rounded-md bg-surface">
                                                <BookingEventButton
                                                    booking={seg.item}
                                                    timezone={timezone}
                                                    onSelect={onSelectBooking}
                                                    compact={height < 36}
                                                    showMember={isSingleDay || seg.columns === 1}
                                                    className="h-full justify-start"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {col.day === todayKey ? (
                                    <div
                                        className="pointer-events-none absolute inset-x-0 z-[2] h-px bg-danger"
                                        style={{ top: pxFromMinutes(nowMinute) }}
                                    >
                                        <span className="absolute -left-1 -top-1 size-2 rounded-full bg-danger" />
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
