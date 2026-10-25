import { useMemo, type FC, type ReactNode } from "react";
import { Alert, Button, Calendar, Skeleton, Spinner } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { Globe } from "lucide-react";
import type { BookingSlot, SlotsByDate } from "@/features/bookings/interfaces/bookings.interfaces";
import {
    formatDateKey,
    formatTime,
    timeZoneOffsetLabel,
} from "@/features/bookings/utils/booking-time";
import { cn } from "@/lib/utils";
import { formatMonthLabel } from "@/pages/booking/utils/booking-dates";
import type { BookingSlotPickerState } from "@/pages/booking/hooks/use-booking-slot-picker";
import { BookingTimezoneSelect } from "@/pages/booking/components/booking-timezone-select";

interface BookingSlotPickerProps {
    picker: BookingSlotPickerState;
    timezone: string;
    /** Shows the timezone dropdown when provided; otherwise the zone is only displayed. */
    onTimezoneChange?: (timezone: string) => void;
    slots: SlotsByDate | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    onRetry: () => void;
    selectedStart: string | null;
    onSelectSlot: (slot: BookingSlot) => void;
    /** Optional message above the picker (e.g. "that time was just taken"). */
    notice?: ReactNode;
}

const toCalendarDate = (key: string | null): DateValue | null => {
    if (!key) return null;
    try {
        return parseDate(key);
    } catch {
        return null;
    }
};

/** Date + time selection shared by the booking page and the reschedule flow. */
export const BookingSlotPicker: FC<BookingSlotPickerProps> = ({
    picker,
    timezone,
    onTimezoneChange,
    slots,
    isLoading,
    isFetching,
    isError,
    onRetry,
    selectedStart,
    onSelectSlot,
    notice,
}) => {
    // Slots are grouped by local date in the zone they were requested for; while a new zone
    // loads, the previous data stays consistent with its own zone.
    const slotZone = slots?.timezone ?? timezone;
    const days = useMemo(() => slots?.days ?? {}, [slots]);
    const monthPrefix = picker.visibleMonth.slice(0, 7);
    // Pages may also list unbookable times (shown disabled); only bookable ones make a date selectable.
    const hasBookableSlot = (key: string) => days[key]?.some((slot) => slot.available) ?? false;
    const monthHasSlots = Object.keys(days).some((key) => key.startsWith(monthPrefix) && hasBookableSlot(key));
    const daySlots = picker.selectedDate ? (days[picker.selectedDate] ?? []) : [];
    const showMonthEmpty = !isLoading && !isFetching && !isError && !monthHasSlots;

    const minValue = toCalendarDate(picker.today) ?? undefined;
    const maxValue = toCalendarDate(picker.maxDate) ?? undefined;

    return (
        <div className="flex flex-col gap-4">
            {notice}

            <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    <Globe className="size-3.5" aria-hidden />
                    Timezone
                </span>
                {onTimezoneChange ? (
                    <BookingTimezoneSelect value={timezone} onChange={onTimezoneChange} />
                ) : (
                    <span className="text-sm text-foreground">
                        {timezone.replace(/_/g, " ")} ({timeZoneOffsetLabel(timezone)})
                    </span>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                <section aria-label="Choose a date" className="relative flex flex-col gap-3">
                    <Calendar
                        aria-label="Available dates"
                        className="w-full max-w-sm"
                        value={toCalendarDate(picker.selectedDate)}
                        onChange={(date) => picker.setSelectedDate(date ? date.toString() : null)}
                        focusedValue={toCalendarDate(picker.focusedDate) ?? undefined}
                        onFocusChange={(date) => picker.setFocusedDate(date.toString())}
                        minValue={minValue}
                        maxValue={maxValue}
                        isDateUnavailable={(date) => !hasBookableSlot(date.toString())}
                    >
                        <Calendar.Header>
                            <Calendar.Heading />
                            <Calendar.NavButton slot="previous" aria-label="Previous month" />
                            <Calendar.NavButton slot="next" aria-label="Next month" />
                        </Calendar.Header>
                        <Calendar.Grid>
                            <Calendar.GridHeader>
                                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>
                                {(date) => (
                                    <Calendar.Cell
                                        date={date}
                                        className={({ isUnavailable, isDisabled, isSelected, isOutsideMonth }) =>
                                            cn(
                                                !isUnavailable &&
                                                    !isDisabled &&
                                                    !isSelected &&
                                                    !isOutsideMonth &&
                                                    "bg-accent-soft font-semibold text-accent hover:bg-accent-soft-hover",
                                            )
                                        }
                                    />
                                )}
                            </Calendar.GridBody>
                        </Calendar.Grid>
                    </Calendar>

                    {isFetching ? (
                        <span className="flex items-center gap-2 text-xs text-muted" role="status">
                            <Spinner size="sm" />
                            Checking availability…
                        </span>
                    ) : null}

                    {showMonthEmpty ? (
                        <div className="flex flex-col items-start gap-2 rounded-xl bg-surface-secondary/60 p-3">
                            <p className="text-sm text-muted">
                                No available times in {formatMonthLabel(picker.visibleMonth)}.
                            </p>
                            {picker.canGoToNextMonth ? (
                                <Button size="sm" variant="secondary" onPress={picker.goToNextMonth}>
                                    Show next month
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </section>

                <section aria-label="Choose a time" className="flex min-w-0 flex-col gap-3">
                    {isError ? (
                        <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>Could not load available times</Alert.Title>
                                <Alert.Description>Please check your connection and try again.</Alert.Description>
                            </Alert.Content>
                            <Button size="sm" variant="secondary" onPress={onRetry}>
                                Retry
                            </Button>
                        </Alert>
                    ) : isLoading ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2" aria-busy="true">
                            {Array.from({ length: 6 }, (_, i) => (
                                <Skeleton key={i} className="h-10 rounded-xl" />
                            ))}
                        </div>
                    ) : !picker.selectedDate ? (
                        <p className="rounded-xl bg-surface-secondary/60 p-4 text-sm text-muted">
                            Select a highlighted date to see available times.
                        </p>
                    ) : (
                        <>
                            <h3 className="text-sm font-semibold text-foreground">
                                {formatDateKey(picker.selectedDate)}
                            </h3>
                            {!daySlots.some((slot) => slot.available) ? (
                                <p className="rounded-xl bg-surface-secondary/60 p-4 text-sm text-muted">
                                    No times left on this day. Please pick another date.
                                </p>
                            ) : (
                                <ul
                                    className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-2"
                                    aria-label={`Available times on ${formatDateKey(picker.selectedDate)}`}
                                >
                                    {daySlots.map((slot) => {
                                        const isSelected = slot.start === selectedStart;
                                        return (
                                            <li key={slot.start}>
                                                <Button
                                                    fullWidth
                                                    variant={isSelected ? "primary" : "outline"}
                                                    aria-pressed={isSelected}
                                                    isDisabled={!slot.available}
                                                    aria-label={
                                                        slot.available
                                                            ? undefined
                                                            : `${formatTime(slot.start, slotZone)}, not available`
                                                    }
                                                    className={cn(!slot.available && "line-through opacity-50")}
                                                    onPress={() => onSelectSlot(slot)}
                                                >
                                                    {formatTime(slot.start, slotZone)}
                                                </Button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};
