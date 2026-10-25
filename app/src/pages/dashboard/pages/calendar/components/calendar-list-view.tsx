import type { FC, ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/ui/table-pagination";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { BookingStatusChip } from "@/components/bookings/booking-shared";
import { bookingDisplayName } from "@/components/bookings/utils/booking-display";
import { useBookings } from "@/features/bookings/hooks/use-bookings";
import type { ListBookingsQuery } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDateShort, formatTimeRange } from "@/features/bookings/utils/booking-time";

export const LIST_PAGE_SIZE = 20;

interface CalendarListViewProps {
    query: ListBookingsQuery;
    timezone: string;
    onPageChange: (page: number) => void;
    onSelectBooking: (uuid: string) => void;
    emptyAction?: ReactNode;
}

/** Paginated booking list (upcoming or past) for the current filters. */
export const CalendarListView: FC<CalendarListViewProps> = ({ query, timezone, onPageChange, onSelectBooking, emptyAction }) => {
    const { data, isLoading, isFetching } = useBookings({ ...query, limit: LIST_PAGE_SIZE });
    const rows = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface">
            <div className="hidden grid-cols-[9rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-3 border-b border-border/60 bg-surface-secondary/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted md:grid">
                <span>When</span>
                <span>Invitee</span>
                <span>Booking type</span>
                <span>Team member</span>
                <span className="text-right">Status</span>
            </div>
            {isLoading ? (
                <DashboardListSkeleton />
            ) : rows.length === 0 ? (
                <DashboardEmptyState
                    icon={CalendarDays}
                    title="No bookings found"
                    body="Try another date range or adjust the filters."
                    action={emptyAction}
                />
            ) : (
                <ul className={cn("divide-y divide-border/40", isFetching && "opacity-70")}>
                    {rows.map((b) => (
                        <li key={b.uuid}>
                            <button
                                type="button"
                                onClick={() => onSelectBooking(b.uuid)}
                                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-secondary md:grid-cols-[9rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]"
                            >
                                <span className="flex flex-col text-xs tabular-nums md:text-sm">
                                    <span className="font-medium text-foreground">{formatDateShort(b.start_at, timezone)}</span>
                                    <span className="text-muted">{formatTimeRange(b.start_at, b.end_at, timezone)}</span>
                                </span>
                                <span className="order-first col-span-1 min-w-0 md:order-none">
                                    <span className="block truncate text-sm font-medium text-foreground">{bookingDisplayName(b)}</span>
                                    <span className="block truncate text-xs text-muted">{b.invitee_email}</span>
                                </span>
                                <span className="hidden truncate text-sm text-muted md:block">{b.booking_page?.name ?? "One-off meeting"}</span>
                                <span className="hidden truncate text-sm text-muted md:block">
                                    {b.assigned_user?.full_name ?? b.assigned_user?.email ?? "Unassigned"}
                                </span>
                                <span className="row-span-2 flex justify-end md:row-span-1">
                                    <BookingStatusChip status={b.status} />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {pagination && pagination.total > 0 ? (
                <div className="border-t border-border/60 px-2 py-1">
                    <TablePagination
                        page={pagination.page}
                        totalPages={Math.max(1, pagination.total_pages)}
                        total={pagination.total}
                        pageSize={pagination.limit}
                        onPageChange={onPageChange}
                        isFetching={isFetching}
                        isLoading={isLoading}
                        label="bookings"
                    />
                </div>
            ) : null}
        </div>
    );
};
