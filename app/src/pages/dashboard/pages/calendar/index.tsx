import { useEffect, useMemo, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@heroui/react";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookingDetailsDrawer } from "@/components/bookings/booking-details-drawer";
import { BlockTimeModal } from "@/components/bookings/block-time-modal";
import { CreateBookingModal } from "@/components/bookings/create-booking-modal";
import { useBookingTimezone } from "@/components/bookings/hooks/use-booking-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useBookingCalendar, useBookingStats, useExportBookings } from "@/features/bookings/hooks/use-bookings";
import { useDeleteBookingBlock } from "@/features/bookings/hooks/use-availability";
import type { BookingBlock, BookingFilters, ListBookingsQuery } from "@/features/bookings/interfaces/bookings.interfaces";
import {
    dateKeyInZone,
    formatTimeRange,
    formatDateShort,
    timeZoneOffsetLabel,
    zonedDayRange,
} from "@/features/bookings/utils/booking-time";
import { useCalendarSearchParams } from "./hooks/use-calendar-search-params";
import { CalendarAgenda } from "./components/calendar-agenda";
import { CalendarFilters } from "./components/calendar-filters";
import { CalendarListView, LIST_PAGE_SIZE } from "./components/calendar-list-view";
import { CalendarMonthView } from "./components/calendar-month-view";
import { CalendarStatsRow } from "./components/calendar-stats-row";
import { CalendarTimeGrid } from "./components/calendar-time-grid";
import { CalendarToolbar } from "./components/calendar-toolbar";
import { CalendarViews, ListScopes, monthDays, shiftAnchor, visibleDays } from "./utils/calendar-grid";
import { blockLabel } from "./utils/calendar-blocks";

const CalendarPage: FC = () => {
    useDashboardNavbarTitle("Calendar");
    const timezone = useBookingTimezone();
    const todayKey = dateKeyInZone(new Date(), timezone);
    const { params, update, hasFilters } = useCalendarSearchParams(todayKey);
    const debouncedSearch = useDebouncedValue(params.search.trim(), 300);

    // Notifications link here with ?booking=<uuid>; open that booking once, then drop the param.
    const [linkParams, setLinkParams] = useSearchParams();
    const [selectedBookingUuid, setSelectedBookingUuid] = useState<string | null>(() => linkParams.get("booking"));
    useEffect(() => {
        if (!linkParams.has("booking")) return;
        const next = new URLSearchParams(linkParams);
        next.delete("booking");
        setLinkParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [createState, setCreateState] = useState<{ open: boolean; start: string | null }>({ open: false, start: null });
    const [blockOpen, setBlockOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [blockToDelete, setBlockToDelete] = useState<BookingBlock | null>(null);
    const deleteBlock = useDeleteBookingBlock();
    const exportBookings = useExportBookings();

    const isList = params.view === CalendarViews.LIST;
    // Fixed per mount so list/stat query keys stay stable between renders.
    const [nowIso] = useState(() => new Date().toISOString());

    const filters = useMemo<BookingFilters>(
        () => ({
            status: params.statuses.length ? params.statuses.join(",") : undefined,
            assigned_user_uuid: params.member || undefined,
            booking_page_uuid: params.pageType || undefined,
            source: params.source || undefined,
            search: debouncedSearch || undefined,
        }),
        [params.statuses, params.member, params.pageType, params.source, debouncedSearch],
    );

    const days = useMemo(() => (isList ? [] : visibleDays(params.view, params.date)), [isList, params.view, params.date]);

    /** Range for list view: open-ended towards the future (upcoming) or the past, capped at "now". */
    const listRange = useMemo(() => {
        const from = params.listFrom ? zonedDayRange(params.listFrom, params.listFrom, timezone).from : undefined;
        const to = params.listTo ? zonedDayRange(params.listTo, params.listTo, timezone).to : undefined;
        if (params.scope === ListScopes.PAST) {
            return { from, to: to && to < nowIso ? to : nowIso };
        }
        return { from: from && from > nowIso ? from : nowIso, to };
    }, [params.scope, params.listFrom, params.listTo, timezone, nowIso]);

    const gridRange = useMemo(
        () => (days.length ? zonedDayRange(days[0], days[days.length - 1], timezone) : { from: "", to: "" }),
        [days, timezone],
    );

    const rangeFilters = useMemo<BookingFilters>(
        () => ({ ...filters, ...(isList ? listRange : gridRange) }),
        [filters, isList, listRange, gridRange],
    );

    const calendarQuery = useMemo<BookingFilters>(() => ({ ...filters, ...gridRange }), [filters, gridRange]);
    const { data: calendarData, isFetching: calendarFetching } = useBookingCalendar(calendarQuery);
    const { data: stats, isLoading: statsLoading } = useBookingStats(rangeFilters);

    const listQuery = useMemo<ListBookingsQuery>(
        () => ({
            ...filters,
            ...listRange,
            page: params.page,
            limit: LIST_PAGE_SIZE,
            order_by: "start_at",
            order_direction: params.scope === ListScopes.PAST ? "desc" : "asc",
        }),
        [filters, listRange, params.page, params.scope],
    );

    const bookings = calendarData?.bookings ?? [];
    const blocks = calendarData?.blocks ?? [];
    const { first: monthFirst, last: monthLast } = monthDays(params.date);
    const agendaDays = useMemo(() => days.filter((d) => d >= monthFirst && d <= monthLast), [days, monthFirst, monthLast]);

    const openCreate = (start: string | null = null) => setCreateState({ open: true, start });
    const openDay = (date: string) => update({ view: CalendarViews.DAY, date });
    const timezoneLabel = `${timezone} (${timeZoneOffsetLabel(timezone)})`;

    const newBookingAction = (
        <Button size="sm" variant="secondary" className="mt-2" onPress={() => openCreate()}>
            <Plus className="size-3.5" />
            New booking
        </Button>
    );

    return (
        <div className="flex flex-col gap-4">
            <CalendarToolbar
                view={params.view}
                anchor={params.date}
                timezoneLabel={timezoneLabel}
                onViewChange={(view) => update({ view, page: null })}
                onPrev={() => update({ date: shiftAnchor(params.view, params.date, -1) })}
                onNext={() => update({ date: shiftAnchor(params.view, params.date, 1) })}
                onToday={() => update({ date: null })}
                scope={params.scope}
                onScopeChange={(scope) => update({ scope: scope === ListScopes.UPCOMING ? null : scope, page: null })}
                listFrom={params.listFrom}
                listTo={params.listTo}
                onListRangeChange={(from, to) => update({ from: from || null, to: to || null, page: null })}
                onNewBooking={() => openCreate()}
                onBlockTime={() => setBlockOpen(true)}
                onExport={() => exportBookings.mutate(rangeFilters)}
                isExporting={exportBookings.isPending}
            />

            <div className="flex flex-col gap-4">
                <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    aria-expanded={filtersOpen}
                    onPress={() => setFiltersOpen((open) => !open)}
                >
                    <SlidersHorizontal className="size-3.5" />
                    Filters
                    {hasFilters && <span className="size-1.5 rounded-full bg-accent" aria-label="Filters active" />}
                    <ChevronDown className={`size-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </Button>

                {filtersOpen && (
                    <>
                        <CalendarFilters params={params} update={update} hasFilters={hasFilters} />
                        <CalendarStatsRow stats={stats} isLoading={statsLoading} />
                    </>
                )}
            </div>

            {isList ? (
                <CalendarListView
                    query={listQuery}
                    timezone={timezone}
                    onPageChange={(page) => update({ page: page > 1 ? String(page) : null })}
                    onSelectBooking={setSelectedBookingUuid}
                    emptyAction={newBookingAction}
                />
            ) : params.view === CalendarViews.MONTH ? (
                <div className={calendarFetching ? "opacity-80 transition-opacity duration-200" : undefined}>
                    <div className="hidden md:block">
                        <CalendarMonthView
                            days={days}
                            anchor={params.date}
                            todayKey={todayKey}
                            timezone={timezone}
                            bookings={bookings}
                            blocks={blocks}
                            onSelectBooking={setSelectedBookingUuid}
                            onSelectBlock={setBlockToDelete}
                            onCreateAt={openCreate}
                            onOpenDay={openDay}
                        />
                    </div>
                    <div className="md:hidden">
                        <CalendarAgenda
                            days={agendaDays}
                            todayKey={todayKey}
                            timezone={timezone}
                            bookings={bookings}
                            blocks={blocks}
                            onSelectBooking={setSelectedBookingUuid}
                            onSelectBlock={setBlockToDelete}
                            emptyAction={newBookingAction}
                        />
                    </div>
                </div>
            ) : (
                <div className={calendarFetching ? "opacity-80 transition-opacity duration-200" : undefined}>
                    <CalendarTimeGrid
                        days={days}
                        todayKey={todayKey}
                        timezone={timezone}
                        bookings={bookings}
                        blocks={blocks}
                        onSelectBooking={setSelectedBookingUuid}
                        onSelectBlock={setBlockToDelete}
                        onCreateAt={openCreate}
                        onOpenDay={openDay}
                    />
                </div>
            )}

            <BookingDetailsDrawer
                bookingUuid={selectedBookingUuid}
                isOpen={!!selectedBookingUuid}
                onOpenChange={(open) => {
                    if (!open) setSelectedBookingUuid(null);
                }}
            />
            <CreateBookingModal
                isOpen={createState.open}
                onOpenChange={(open) => setCreateState((s) => ({ ...s, open }))}
                initialStart={createState.start}
                onCreated={setSelectedBookingUuid}
            />
            <BlockTimeModal isOpen={blockOpen} onOpenChange={setBlockOpen} />
            <ConfirmDialog
                isOpen={!!blockToDelete}
                onOpenChange={(open) => {
                    if (!open) setBlockToDelete(null);
                }}
                title="Remove blocked time?"
                description={
                    blockToDelete ? (
                        <>
                            {blockLabel(blockToDelete)}
                            <br />
                            {formatDateShort(blockToDelete.start_at, timezone)},{" "}
                            {formatTimeRange(blockToDelete.start_at, blockToDelete.end_at, timezone)}
                            <br />
                            The period becomes bookable again.
                        </>
                    ) : null
                }
                confirmLabel="Remove"
                variant="danger"
                isPending={deleteBlock.isPending}
                onConfirm={async () => {
                    if (!blockToDelete) return;
                    try {
                        await deleteBlock.mutateAsync(blockToDelete.uuid);
                    } catch {
                        // Error toast comes from the mutation hook.
                    }
                    setBlockToDelete(null);
                }}
            />
        </div>
    );
};

export default CalendarPage;
