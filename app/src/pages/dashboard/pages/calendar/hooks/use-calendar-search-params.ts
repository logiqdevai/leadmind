import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookingStatuses, BookingSources, type BookingSource, type BookingStatus } from "@/features/bookings/interfaces/bookings.interfaces";
import { CalendarViews, ListScopes, isDateKey, type CalendarView, type ListScope } from "../utils/calendar-grid";

const VIEW_VALUES = Object.values(CalendarViews) as string[];
const STATUS_VALUES = Object.values(BookingStatuses) as string[];
const SOURCE_VALUES = Object.values(BookingSources) as string[];

export const CalendarParamKeys = {
    VIEW: "view",
    DATE: "date",
    MEMBER: "member",
    PAGE_TYPE: "type",
    STATUS: "status",
    SOURCE: "source",
    SEARCH: "q",
    LIST_FROM: "from",
    LIST_TO: "to",
    SCOPE: "scope",
    PAGE: "page",
} as const;

export interface CalendarParams {
    view: CalendarView;
    date: string;
    member: string;
    pageType: string;
    statuses: BookingStatus[];
    source: BookingSource | "";
    search: string;
    listFrom: string;
    listTo: string;
    scope: ListScope;
    page: number;
}

/** Calendar UI state bound to the URL so views and filters survive reloads and can be shared. */
export function useCalendarSearchParams(todayKey: string) {
    const [searchParams, setSearchParams] = useSearchParams();

    const params = useMemo<CalendarParams>(() => {
        const view = searchParams.get(CalendarParamKeys.VIEW) ?? "";
        const date = searchParams.get(CalendarParamKeys.DATE);
        const source = searchParams.get(CalendarParamKeys.SOURCE) ?? "";
        const listFrom = searchParams.get(CalendarParamKeys.LIST_FROM);
        const listTo = searchParams.get(CalendarParamKeys.LIST_TO);
        return {
            view: (VIEW_VALUES.includes(view) ? view : CalendarViews.WEEK) as CalendarView,
            date: isDateKey(date) ? date : todayKey,
            member: searchParams.get(CalendarParamKeys.MEMBER) ?? "",
            pageType: searchParams.get(CalendarParamKeys.PAGE_TYPE) ?? "",
            statuses: (searchParams.get(CalendarParamKeys.STATUS) ?? "")
                .split(",")
                .filter((s) => STATUS_VALUES.includes(s)) as BookingStatus[],
            source: (SOURCE_VALUES.includes(source) ? source : "") as BookingSource | "",
            search: searchParams.get(CalendarParamKeys.SEARCH) ?? "",
            listFrom: isDateKey(listFrom) ? listFrom : "",
            listTo: isDateKey(listTo) ? listTo : "",
            scope: searchParams.get(CalendarParamKeys.SCOPE) === ListScopes.PAST ? ListScopes.PAST : ListScopes.UPCOMING,
            page: Math.max(1, Number(searchParams.get(CalendarParamKeys.PAGE) ?? 1) || 1),
        };
    }, [searchParams, todayKey]);

    const update = useCallback(
        (next: Partial<Record<(typeof CalendarParamKeys)[keyof typeof CalendarParamKeys], string | null | undefined>>) => {
            setSearchParams(
                (prev) => {
                    const out = new URLSearchParams(prev);
                    for (const [key, value] of Object.entries(next)) {
                        if (value == null || value === "") out.delete(key);
                        else out.set(key, value);
                    }
                    return out;
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    const hasFilters =
        !!params.member || !!params.pageType || params.statuses.length > 0 || !!params.source || !!params.search;

    return { params, update, hasFilters };
}
