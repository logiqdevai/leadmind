import { useMemo, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarDays, Clock } from "lucide-react";
import { SearchSelect } from "@/components/ui/search-select";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { useAvailabilitySchedule } from "@/features/bookings/hooks/use-availability";
import { useOrganisationMembers } from "@/features/organisations/hooks/use-organisations";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { Routes } from "@/routes/routes";
import { useAuthStore } from "@/stores/auth";
import { BlockedPeriodsSection } from "./components/blocked-periods-section";
import { DateOverridesSection } from "./components/date-overrides-section";
import { WeeklyHoursCard } from "./components/weekly-hours-card";

const AvailabilityPage: FC = () => {
    useDashboardNavbarTitle("Availability");
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";
    const currentUserUuid = useAuthStore((s) => s.user_uuid) ?? "";
    const { data: members = [] } = useOrganisationMembers(organisationUuid);

    const [selectedUuid, setSelectedUuid] = useState<string>(currentUserUuid);
    const viewingSelf = !selectedUuid || selectedUuid === currentUserUuid;
    // The API treats "no user" as the signed-in member.
    const hookUserUuid = viewingSelf ? undefined : selectedUuid;
    const canEdit = viewingSelf || isAdmin;

    const { data: schedule, isLoading, isError, error } = useAvailabilitySchedule(hookUserUuid);

    const selectedMember = members.find((m) => m.user_uuid === (selectedUuid || currentUserUuid));
    const memberLabel = viewingSelf ? "you" : selectedMember?.full_name?.trim() || selectedMember?.email || "this member";

    const memberOptions = useMemo(
        () =>
            members.map((m) => ({
                id: m.user_uuid,
                label: `${m.full_name?.trim() || m.email}${m.user_uuid === currentUserUuid ? " (you)" : ""}`,
            })),
        [members, currentUserUuid],
    );

    return (
        <div className="max-w-4xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-foreground">Availability</h1>
                    <p className="max-w-2xl text-sm text-muted">
                        Working hours, date overrides and time off decide when each member can be booked. Durations, buffers, notice and
                        limits are set per{" "}
                        <Link to={Routes.dashboard.booking_pages} className="font-medium text-link hover:underline">
                            booking page
                        </Link>
                        .
                    </p>
                </div>
                {isAdmin && members.length > 1 ? (
                    <div className="flex w-full flex-col gap-1.5 sm:w-72">
                        <span className="text-xs text-muted">Member</span>
                        <SearchSelect
                            aria-label="Member"
                            options={memberOptions}
                            value={selectedUuid || currentUserUuid}
                            onChange={setSelectedUuid}
                            searchPlaceholder="Search members…"
                            fullWidth
                        />
                    </div>
                ) : null}
            </header>

            <div className="flex flex-wrap gap-2 text-xs">
                <Link
                    to={Routes.dashboard.booking_pages}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-muted hover:text-foreground"
                >
                    <CalendarCheck className="size-3.5" />
                    Scheduling rules per booking page
                </Link>
                <Link
                    to={Routes.dashboard.calendar}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-muted hover:text-foreground"
                >
                    <CalendarDays className="size-3.5" />
                    Calendar
                </Link>
                <Link
                    to={Routes.dashboard.calendar_integrations}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-muted hover:text-foreground"
                >
                    <Clock className="size-3.5" />
                    Google Calendar conflicts
                </Link>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <div className="h-96 rounded-2xl border border-border bg-surface animate-pulse" />
                    <div className="h-40 rounded-2xl border border-border bg-surface animate-pulse" />
                </div>
            ) : isError || !schedule ? (
                <p className="text-sm text-danger">{error instanceof Error ? error.message : "Could not load working hours."}</p>
            ) : (
                <div key={selectedUuid} className="space-y-4">
                    <WeeklyHoursCard schedule={schedule} userUuid={hookUserUuid} canEdit={canEdit} memberLabel={memberLabel} />
                    <DateOverridesSection schedule={schedule} userUuid={hookUserUuid} canEdit={canEdit} />
                    <BlockedPeriodsSection
                        timeZone={schedule.timezone}
                        userUuid={schedule.user_uuid || selectedUuid || currentUserUuid}
                        currentUserUuid={currentUserUuid}
                        isAdmin={isAdmin}
                        canEdit={canEdit}
                        members={members}
                    />
                </div>
            )}
        </div>
    );
};

export default AvailabilityPage;
