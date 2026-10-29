import { useMemo, type FC } from "react";
import { Spinner } from "@heroui/react";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookingPageSlots } from "@/features/bookings/hooks/use-booking-pages";
import type { BookingSlot } from "@/features/bookings/interfaces/bookings.interfaces";
import { dateKeyInZone, formatTime, zonedDayRange } from "@/features/bookings/utils/booking-time";
import { DateKeyPicker } from "./booking-date-time-fields";

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
}) => {
    const query = useMemo(() => {
        const range = zonedDayRange(dateKey, dateKey, timezone);
        return {
            from: range.from,
            to: range.to,
            timezone,
            duration: durationMinutes || undefined,
            exclude_booking_uuid: excludeBookingUuid,
        };
    }, [dateKey, timezone, durationMinutes, excludeBookingUuid]);

    const { data, isLoading, isFetching } = useBookingPageSlots(pageUuid, query);

    const groups = useMemo<SlotGroup[]>(() => {
        const slots = data?.days?.[dateKey] ?? [];
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
            result.push({ key: "any", title: "Any available member", slots });
        }
        for (const [uuid, list] of byMember) {
            result.push({ key: uuid, userUuid: uuid, title: memberName(uuid), slots: list });
        }
        if (!result.length && slots.length) result.push({ key: "any", title: "Available times", slots });
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
