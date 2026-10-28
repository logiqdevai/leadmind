import { useMemo, useState, type FC } from "react";
import { Button, Spinner } from "@heroui/react";
import { CalendarX2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { SearchSelect } from "@/components/ui/search-select";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { useBookingPageSlots } from "@/features/bookings/hooks/use-booking-pages";
import { BookingUnavailableSlotsModes, type BookingPage } from "@/features/bookings/interfaces/bookings.interfaces";
import {
    addDays,
    dateKeyInZone,
    formatDateKey,
    formatDuration,
    formatTime,
    zonedDayRange,
} from "@/features/bookings/utils/booking-time";
import { useBookingTimezone } from "@/components/bookings/hooks/use-booking-context";
import { cn } from "@/lib/utils";
import { DashboardEmptyState } from "@/pages/dashboard/components/dashboard-shared";
import { SettingsSection, SimpleSelect } from "./form-fields";

const RANGE_OPTIONS = [
    { id: "7", label: "Week (7 days)" },
    { id: "30", label: "Month (30 days)" },
];

interface PreviewTabProps {
    page: BookingPage;
}

export const PreviewTab: FC<PreviewTabProps> = ({ page }) => {
    const organisationTimezone = useBookingTimezone();
    // Starts on the organisation's timezone; the picker only overrides it once the user chooses another.
    const [pickedTimeZone, setTimeZone] = useState<string | null>(null);
    const timeZone = pickedTimeZone ?? organisationTimezone;
    const timezoneOptions = useMemo(() => {
        const options = TimezoneOptions.map((o) => ({ id: o.value, label: o.label }));
        return options.some((o) => o.id === timeZone) ? options : [{ id: timeZone, label: timeZone }, ...options];
    }, [timeZone]);
    const [rangeDays, setRangeDays] = useState(7);
    const [offsetDays, setOffsetDays] = useState(0);
    const durations = useMemo(
        () => [...new Set([page.duration_minutes, ...(page.duration_options ?? [])])].sort((a, b) => a - b),
        [page.duration_minutes, page.duration_options],
    );
    const [duration, setDuration] = useState(page.duration_minutes);

    const today = dateKeyInZone(new Date(), timeZone);
    const startDate = addDays(today, offsetDays);
    const endDate = addDays(startDate, rangeDays - 1);
    // Mirror the public page: it lists unbookable times (disabled) only when the saved setting says so.
    const showDisabled = page.unavailable_slots_mode === BookingUnavailableSlotsModes.SHOW_DISABLED;
    const query = useMemo(
        () => ({
            ...zonedDayRange(startDate, endDate, timeZone),
            timezone: timeZone,
            duration,
            ...(showDisabled && { include_unavailable: true }),
        }),
        [startDate, endDate, timeZone, duration, showDisabled],
    );
    const { data, isLoading, isFetching, isError, error } = useBookingPageSlots(page.uuid, query);

    const memberNames = useMemo(
        () => new Map(page.members.map((m) => [m.user_uuid, m.user.full_name?.trim() || m.user.email])),
        [page.members],
    );

    const days = useMemo(() => {
        const list: string[] = [];
        for (let i = 0; i < rangeDays; i += 1) list.push(addDays(startDate, i));
        return list;
    }, [startDate, rangeDays]);

    const totalSlots = days.reduce((sum, d) => sum + (data?.days[d]?.filter((s) => s.available).length ?? 0), 0);
    // Nothing can be booked beyond the booking window, so stop paging there.
    const pastLimit = offsetDays + rangeDays >= page.max_advance_days;

    return (
        <div className="space-y-4">
            <SettingsSection
                title="Availability preview"
                description="The times invitees would be offered right now. It reflects every rule of this page, members' working hours, blocked time, Google Calendar conflicts and existing bookings."
                actions={
                    page.public_url ? (
                        <a
                            href={page.public_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-secondary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-tertiary"
                        >
                            <ExternalLink className="size-3.5" />
                            Open public page
                        </a>
                    ) : null
                }
            >
                {!page.is_active ? (
                    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                        This page is deactivated, so invitees can't book it. The preview shows what they would see once published.
                    </p>
                ) : null}
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted">Range</span>
                        <SimpleSelect
                            aria-label="Range"
                            options={RANGE_OPTIONS}
                            value={String(rangeDays)}
                            onChange={(v) => setRangeDays(Number(v))}
                            className="w-44 sm:w-44"
                        />
                    </div>
                    {durations.length > 1 ? (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-muted">Duration</span>
                            <SimpleSelect
                                aria-label="Duration"
                                options={durations.map((d) => ({ id: String(d), label: formatDuration(d) }))}
                                value={String(duration)}
                                onChange={(v) => setDuration(Number(v))}
                                className="w-36 sm:w-36"
                            />
                        </div>
                    ) : null}
                    <div className="flex min-w-60 flex-col gap-1.5">
                        <span className="text-xs text-muted">Timezone</span>
                        <SearchSelect
                            aria-label="Preview timezone"
                            options={timezoneOptions}
                            value={timeZone}
                            onChange={setTimeZone}
                            searchPlaceholder="Search timezones…"
                            className="w-72"
                        />
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="secondary"
                            aria-label="Previous period"
                            isDisabled={offsetDays === 0}
                            onPress={() => setOffsetDays((o) => Math.max(0, o - rangeDays))}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <span className="min-w-44 text-center text-xs text-muted">
                            {formatDateKey(startDate)} to {formatDateKey(endDate)}
                        </span>
                        <Button
                            size="sm"
                            variant="secondary"
                            aria-label="Next period"
                            isDisabled={pastLimit}
                            onPress={() => setOffsetDays((o) => o + rangeDays)}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>

                {isError ? (
                    <p className="text-sm text-danger">{error instanceof Error ? error.message : "Could not load slots."}</p>
                ) : isLoading ? (
                    <div className="flex justify-center py-10">
                        <Spinner size="sm" />
                    </div>
                ) : totalSlots === 0 ? (
                    <DashboardEmptyState
                        icon={CalendarX2}
                        title="No free slots in this period"
                        body="Check the members' working hours, blocked time, minimum notice and the booking window."
                    />
                ) : (
                    <div className={cn("space-y-3 transition-opacity duration-200", isFetching && "opacity-60")}>
                        <p className="text-xs text-muted">
                            {totalSlots} bookable slot{totalSlots === 1 ? "" : "s"} · times in {timeZone}
                            {showDisabled ? " · unbookable times are shown struck through, as visitors see them" : ""}
                        </p>
                        <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                            {days.map((day) => {
                                const slots = data?.days[day] ?? [];
                                const hasBookable = slots.some((s) => s.available);
                                return (
                                    <li key={day} className="grid gap-2 px-3 py-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                                        <p className={cn("text-sm", hasBookable ? "text-foreground font-medium" : "text-muted")}>
                                            {formatDateKey(day)}
                                        </p>
                                        {!hasBookable ? (
                                            <p className="text-xs text-muted">No availability</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {slots.map((slot) => {
                                                    const names = (slot.user_uuids ?? []).map((u) => memberNames.get(u) ?? "Member");
                                                    return (
                                                        <span
                                                            key={slot.start}
                                                            title={
                                                                slot.available
                                                                    ? names.length
                                                                        ? `Free: ${names.join(", ")}`
                                                                        : undefined
                                                                    : "Not bookable - shown disabled to visitors"
                                                            }
                                                            className={cn(
                                                                "inline-flex flex-col rounded-lg border border-border/80 bg-surface-secondary/30 px-2 py-1",
                                                                !slot.available && "opacity-45 line-through",
                                                            )}
                                                        >
                                                            <span className="text-xs font-medium tabular-nums text-foreground">
                                                                {formatTime(slot.start, timeZone)}
                                                            </span>
                                                            {names.length ? (
                                                                <span className="max-w-40 truncate text-[10px] text-muted">{names.join(", ")}</span>
                                                            ) : null}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </SettingsSection>
        </div>
    );
};
