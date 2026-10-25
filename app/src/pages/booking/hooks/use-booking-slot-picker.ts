import { useMemo, useState } from "react";
import { addDays, dateKeyInZone, zonedDayRange } from "@/features/bookings/utils/booking-time";
import { addMonths, monthEndOf, monthStartOf } from "@/pages/booking/utils/booking-dates";

interface UseBookingSlotPickerOptions {
    timezone: string;
    /** Bookable horizon in days from today; 0 / undefined means no extra limit. */
    maxAdvanceDays?: number;
}

export interface BookingSlotPickerState {
    today: string;
    maxDate: string | null;
    /** Date the calendar keeps focus on; its month is the visible month. */
    focusedDate: string;
    setFocusedDate: (date: string) => void;
    visibleMonth: string;
    selectedDate: string | null;
    setSelectedDate: (date: string | null) => void;
    /** Whole-day UTC range of the visible month (clamped to today / max date), or null if nothing is bookable. */
    range: { from: string; to: string } | null;
    canGoToNextMonth: boolean;
    goToNextMonth: () => void;
}

/**
 * UI state of the date/time picker (no API calls). The visible month drives the slots query:
 * the API caps ranges at 62 days, so one calendar month is fetched at a time.
 */
export function useBookingSlotPicker({ timezone, maxAdvanceDays }: UseBookingSlotPickerOptions): BookingSlotPickerState {
    const today = dateKeyInZone(new Date(), timezone);
    const maxDate = maxAdvanceDays && maxAdvanceDays > 0 ? addDays(today, maxAdvanceDays) : null;

    const [focusedState, setFocusedDate] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const focusedDate = focusedState ?? selectedDate ?? today;
    const visibleMonth = monthStartOf(focusedDate);

    const monthEnd = monthEndOf(visibleMonth);
    const rangeStart = visibleMonth < today ? today : visibleMonth;
    const rangeEnd = maxDate && monthEnd > maxDate ? maxDate : monthEnd;

    const range = useMemo(
        () => (rangeStart <= rangeEnd ? zonedDayRange(rangeStart, rangeEnd, timezone) : null),
        [rangeStart, rangeEnd, timezone],
    );

    const nextMonth = addMonths(visibleMonth, 1);
    const canGoToNextMonth = !maxDate || nextMonth <= maxDate;

    return {
        today,
        maxDate,
        focusedDate,
        setFocusedDate,
        visibleMonth,
        selectedDate,
        setSelectedDate,
        range,
        canGoToNextMonth,
        goToNextMonth: () => setFocusedDate(nextMonth),
    };
}
