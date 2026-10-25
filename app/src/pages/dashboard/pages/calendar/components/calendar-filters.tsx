import { useMemo, type FC } from "react";
import { Button, Input } from "@heroui/react";
import { Search, X } from "lucide-react";
import { MobileListFilters } from "@/components/ui/mobile-list-filters";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchSelect } from "@/components/ui/search-select";
import { OptionSelect } from "@/components/bookings/booking-shared";
import { memberLabel, useBookingMembers } from "@/components/bookings/hooks/use-booking-context";
import { useBookingPages } from "@/features/bookings/hooks/use-booking-pages";
import { BOOKING_STATUS_LABELS } from "@/features/bookings/constants/booking-labels";
import { BookingSources, BookingStatuses } from "@/features/bookings/interfaces/bookings.interfaces";
import type { CalendarParamKeys, CalendarParams } from "../hooks/use-calendar-search-params";

type UpdateParams = (
    next: Partial<Record<(typeof CalendarParamKeys)[keyof typeof CalendarParamKeys], string | null | undefined>>,
) => void;

const UNASSIGNED = "unassigned";

const STATUS_OPTIONS = Object.values(BookingStatuses).map((s) => ({ value: s, label: BOOKING_STATUS_LABELS[s] }));

const SOURCE_OPTIONS = [
    { id: "", label: "All sources" },
    { id: BookingSources.PUBLIC, label: "Booked online" },
    { id: BookingSources.MANUAL, label: "Created manually" },
];

interface CalendarFiltersProps {
    params: CalendarParams;
    update: UpdateParams;
    hasFilters: boolean;
}

export const CalendarFilters: FC<CalendarFiltersProps> = ({ params, update, hasFilters }) => {
    const { members } = useBookingMembers();
    const { data: pages = [] } = useBookingPages();

    const memberOptions = useMemo(
        () => [{ id: UNASSIGNED, label: "Unassigned" }, ...members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) }))],
        [members],
    );
    const pageOptions = useMemo(() => pages.map((p) => ({ id: p.uuid, label: p.name })), [pages]);

    return (
        <MobileListFilters
            search={
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                    <Input
                        aria-label="Search bookings"
                        className="w-full pl-9"
                        placeholder="Search invitee name, email, phone…"
                        value={params.search}
                        onChange={(e) => update({ q: e.target.value || null, page: null })}
                    />
                </div>
            }
            extras={
                <>
                    <SearchSelect
                        aria-label="Filter by team member"
                        emptyLabel="All members"
                        searchPlaceholder="Search members…"
                        options={memberOptions}
                        value={params.member}
                        onChange={(v) => update({ member: v || null, page: null })}
                        className="w-full sm:w-44"
                    />
                    <SearchSelect
                        aria-label="Filter by booking type"
                        emptyLabel="All booking types"
                        searchPlaceholder="Search booking pages…"
                        options={pageOptions}
                        value={params.pageType}
                        onChange={(v) => update({ type: v || null, page: null })}
                        className="w-full sm:w-48"
                    />
                    <MultiSelect
                        aria-label="Filter by status"
                        placeholder="All statuses"
                        searchPlaceholder="Search statuses…"
                        options={STATUS_OPTIONS}
                        value={params.statuses}
                        onChange={(next) => update({ status: next.join(",") || null, page: null })}
                        className="w-full sm:w-56"
                    />
                    <OptionSelect
                        aria-label="Filter by source"
                        options={SOURCE_OPTIONS}
                        value={params.source}
                        onChange={(v) => update({ source: v || null, page: null })}
                        className="w-full sm:w-40"
                    />
                    {hasFilters ? (
                        <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => update({ member: null, type: null, status: null, source: null, q: null, page: null })}
                        >
                            <X className="size-3.5" />
                            Clear
                        </Button>
                    ) : null}
                </>
            }
        />
    );
};
