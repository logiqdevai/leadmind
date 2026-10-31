import { useMemo, type FC } from "react";
import { Spinner, Tooltip } from "@heroui/react";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookingPageSlots } from "@/features/bookings/hooks/use-booking-pages";
import { useBookingCalendar } from "@/features/bookings/hooks/use-bookings";
import { ACTIVE_BOOKING_STATUSES, type BookingSlot } from "@/features/bookings/interfaces/bookings.interfaces";
import { dateKeyInZone, formatTime, zonedDayRange } from "@/features/bookings/utils/booking-time";
import { DateKeyPicker } from "./booking-date-time-fields";
import { bookingDisplayName } from "./utils/booking-display";

export interface SelectedSlot {
    start: string;
    /** Member the slot is booked with; undefined lets the page's assignment rules choose. */
    userUuid?: string;
}

interface BookingSlotPickerProps {
    pageUuid: string;
    timezone: string;
    dateKey: string;
    onDateChange: (dateKey: string) => void;
    durationMinutes?: number;
    excludeBookingUuid?: string;
    selected: SelectedSlot | null;
    onSelect: (slot: SelectedSlot) => void;
    memberName: (uuid: string) => string;
    /** When set, only this member's slots can be picked (plus "any available"). */
    restrictToUserUuid?: string | null;
    /** Called when a taken slot that is occupied by a booking is clicked. */
    onOpenBooking?: (bookingUuid: string) => void;
}

interface SlotGroup {
    key: string;
    userUuid?: string;
    title: string;
    slots: BookingSlot[];
}

/** Available slots of a booking page for one local date, grouped by the members free at each time. */
export const BookingSlotPicker: FC<BookingSlotPickerProps> = ({
    pageUuid,
    timezone,
    dateKey,
    onDateChange,
    durationMinutes,
    excludeBookingUuid,
    selected,
    onSelect,
    memberName,
    restrictToUserUuid,
    onOpenBooking,
}) => {
    const query = useMemo(() => {
        const range = zonedDayRange(dateKey, dateKey, timezone);
        return {
            from: range.from,
            to: range.to,
            timezone,
            duration: durationMinutes || undefined,
            exclude_booking_uuid: excludeBookingUuid,
            include_unavailable: true,
        };
    }, [dateKey, timezone, durationMinutes, excludeBookingUuid]);

    const { data, isLoading, isFetching } = useBookingPageSlots(pageUuid, query);

    // Existing bookings of the day, so a taken slot can name (and open) the booking that occupies it.
    const dayRange = useMemo(() => zonedDayRange(dateKey, dateKey, timezone), [dateKey, timezone]);
    const { data: calendar } = useBookingCalendar({ from: dayRange.from, to: dayRange.to });
    const dayBookings = useMemo(
        () => (calendar?.bookings ?? []).filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status)),
        [calendar],
    );
    const bookingAt = (slot: BookingSlot) =>
        dayBookings.find(
            (b) =>
                new Date(b.start_at).getTime() < new Date(slot.end).getTime() &&
                new Date(b.end_at).getTime() > new Date(slot.start).getTime(),
        );

    const groups = useMemo<SlotGroup[]>(() => {
        const all = data?.days?.[dateKey] ?? [];
        const slots = all.filter((slot) => slot.available);
        const taken = all.filter((slot) => !slot.available);
        const withTaken = (list: BookingSlot[]) =>
            [...list, ...taken].sort((a, b) => a.start.localeCompare(b.start));
        const byMember = new Map<string, BookingSlot[]>();
        for (const slot of slots) {
            for (const uuid of slot.user_uuids ?? []) {
                if (restrictToUserUuid && uuid !== restrictToUserUuid) continue;
                const list = byMember.get(uuid) ?? [];
                list.push(slot);
                byMember.set(uuid, list);
            }
        }
        const result: SlotGroup[] = [];
        // "Any available" lets the page's assignment rules pick; skip it when only one member is free all day.
        if (slots.length && (byMember.size !== 1 || restrictToUserUuid)) {
            result.push({ key: "any", title: "Any available member", slots: withTaken(slots) });
        }
        for (const [uuid, list] of byMember) {
            result.push({ key: uuid, userUuid: uuid, title: memberName(uuid), slots: withTaken(list) });
        }
        if (!result.length && slots.length) result.push({ key: "any", title: "Available times", slots: withTaken(slots) });
        return result;
    }, [data, dateKey, memberName, restrictToUserUuid]);

    const today = dateKeyInZone(new Date(), timezone);

    return (
        <div className="flex flex-col gap-3">
            <DateKeyPicker label="Date" value={dateKey} onChange={onDateChange} minValue={today} isRequired showDayStepper />
            <div className="rounded-xl border border-border/80 bg-surface-secondary/30 p-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <Spinner size="sm" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                        <CalendarX2 className="size-4 text-muted" />
                        <p className="text-sm text-foreground">No available times on this date</p>
                        <p className="text-xs text-muted">Pick another date or use a custom time.</p>
                    </div>
                ) : (
                    <div className={cn("flex max-h-64 flex-col gap-3 overflow-y-auto", isFetching && "opacity-70")}>
                        {groups.map((group) => (
                            <div key={group.key} className="flex flex-col gap-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                                    {group.title}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.slots.map((slot) => {
                                        if (!slot.available) {
                                            const booking = bookingAt(slot);
                                            const title = booking
                                                ? [booking.booking_page?.name, bookingDisplayName(booking)].filter(Boolean).join(" · ")
                                                : "Unavailable";
                                            return (
                                                <Tooltip key={`${group.key}-${slot.start}`}>
                                                    <Tooltip.Trigger>
                                                        <button
                                                            type="button"
                                                            aria-disabled
                                                            onClick={() => booking && onOpenBooking?.(booking.uuid)}
                                                            className={cn(
                                                                "h-8 rounded-lg border border-border/60 bg-surface-secondary/60 px-2.5 text-xs font-medium tabular-nums text-muted line-through opacity-60",
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                                booking && onOpenBooking ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed",
                                                            )}
                                                        >
                                                            {formatTime(slot.start, timezone)}
                                                        </button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Content className="max-w-xs text-xs">{title}</Tooltip.Content>
                                                </Tooltip>
                                            );
                                        }
                                        const isSelected =
                                            selected?.start === slot.start && selected?.userUuid === group.userUuid;
                                        return (
                                            <button
                                                key={`${group.key}-${slot.start}`}
                                                type="button"
                                                onClick={() => onSelect({ start: slot.start, userUuid: group.userUuid })}
                                                className={cn(
                                                    "h-8 rounded-lg border px-2.5 text-xs font-medium tabular-nums transition-colors duration-200",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                                    isSelected
                                                        ? "border-accent bg-accent text-accent-foreground"
                                                        : "border-border bg-surface text-foreground hover:bg-surface-secondary",
                                                )}
                                            >
                                                {formatTime(slot.start, timezone)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
