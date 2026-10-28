import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addDays, dateKeyInZone, zonedDayRange } from "@/features/bookings/utils/booking-time";
import { addMonths, monthEndOf, monthStartOf } from "@/pages/booking/utils/booking-dates";

const MONTH_PARAM = "month";
const DATE_PARAM = "date";

interface UseBookingSlotPickerOptions {
    timezone: string;
    /** Bookable horizon in days from today; 0 / undefined means no extra limit. */
    maxAdvanceDays?: number;
    /** Mirrors the visible month and selected date to `?month=YYYY-MM&date=YYYY-MM-DD` so a refresh keeps them. */
    syncToUrl?: boolean;
}

const isValidDateKey = (value: string | null): value is string => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
};

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
export function useBookingSlotPicker({
    timezone,
    maxAdvanceDays,
    syncToUrl = false,
}: UseBookingSlotPickerOptions): BookingSlotPickerState {
    const today = dateKeyInZone(new Date(), timezone);
    const maxDate = maxAdvanceDays && maxAdvanceDays > 0 ? addDays(today, maxAdvanceDays) : null;

    const [searchParams, setSearchParams] = useSearchParams();
    // Read once: afterwards local state is the source and is written back to the URL.
    const [initial] = useState(() => {
        if (!syncToUrl) return { focused: null, selected: null };
        const dateParam = searchParams.get(DATE_PARAM);
        const monthParam = searchParams.get(MONTH_PARAM);
        const selected =
            isValidDateKey(dateParam) && dateParam >= today && (!maxDate || dateParam <= maxDate) ? dateParam : null;
        const monthStart = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : null;
        const focused =
            monthStart && isValidDateKey(monthStart) && monthEndOf(monthStart) >= today && (!maxDate || monthStart <= maxDate)
                ? monthStart
                : null;
        return { focused, selected };
    });

    const [focusedState, setFocusedDate] = useState<string | null>(initial.focused);
    const [selectedDate, setSelectedDate] = useState<string | null>(initial.selected);
    // A selected date wins over the month param so the two can never disagree on first render.
    const focusedDate = focusedState ?? selectedDate ?? today;
    const visibleMonth = monthStartOf(focusedDate);

    const hasInteracted = focusedState !== null || selectedDate !== null;
    useEffect(() => {
        if (!syncToUrl || !hasInteracted) return;
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set(MONTH_PARAM, visibleMonth.slice(0, 7));
                if (selectedDate) next.set(DATE_PARAM, selectedDate);
                else next.delete(DATE_PARAM);
                return next.toString() === prev.toString() ? prev : next;
            },
            { replace: true },
        );
    }, [syncToUrl, hasInteracted, visibleMonth, selectedDate, setSearchParams]);

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
