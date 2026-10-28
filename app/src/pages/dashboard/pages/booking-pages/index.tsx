import { useMemo, useState, type FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { CalendarCheck, Mail, Plus } from "lucide-react";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { useBookingPages } from "@/features/bookings/hooks/use-booking-pages";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { DashboardEmptyState } from "@/pages/dashboard/components/dashboard-shared";
import { Routes } from "@/routes/routes";
import { BookingPageCard } from "./components/booking-page-card";
import { CreateBookingPageModal } from "./components/create-booking-page-modal";
import { InviteSettingsModal } from "./components/invite-settings-modal";

const BookingPagesPage: FC = () => {
    useDashboardNavbarTitle("Booking pages");
    const navigate = useNavigate();
    const canManage = useOrganisationPermission("org_manage_bookings");
    const { data: pages = [], isLoading, isError, error } = useBookingPages();
    const [createOpen, setCreateOpen] = useState(false);
    const [inviteSettingsOpen, setInviteSettingsOpen] = useState(false);

    // Default first, then active, then by name.
    const sorted = useMemo(
        () =>
            [...pages].sort(
                (a, b) =>
                    Number(b.is_default) - Number(a.is_default) ||
                    Number(b.is_active) - Number(a.is_active) ||
                    a.name.localeCompare(b.name),
            ),
        [pages],
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-foreground">Booking pages</h1>
                    <p className="max-w-2xl text-sm text-muted">
                        Each page is an appointment type invitees can book: its duration, team, scheduling rules and emails. Members&apos;
                        working hours live in{" "}
                        <Link to={Routes.dashboard.availability} className="font-medium text-link hover:underline">
                            Availability
                        </Link>
                        ; Google Calendar sync in{" "}
                        <Link to={Routes.dashboard.calendar_integrations} className="font-medium text-link hover:underline">
                            Calendar integrations
                        </Link>
                        .
                        {!canManage ? " Only owners and admins can create or change booking pages." : ""}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onPress={() => setInviteSettingsOpen(true)}>
                        <Mail className="size-3.5" />
                        Invitation settings
                    </Button>
                    {canManage ? (
                        <Button variant="primary" size="sm" onPress={() => setCreateOpen(true)}>
                            <Plus className="size-3.5" />
                            New booking page
                        </Button>
                    ) : null}
                </div>
            </header>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-44 rounded-2xl border border-border bg-surface animate-pulse" />
                    ))}
                </div>
            ) : isError ? (
                <p className="text-sm text-danger">{error instanceof Error ? error.message : "Could not load booking pages."}</p>
            ) : sorted.length === 0 ? (
                <div className="rounded-2xl border border-border/80 bg-surface">
                    <DashboardEmptyState
                        icon={CalendarCheck}
                        title="No booking pages yet"
                        body={
                            canManage
                                ? "Create your first appointment type, then share its link or add {{booking_link}} to your emails."
                                : "An owner or admin needs to create the first booking page."
                        }
                        action={
                            canManage ? (
                                <Button size="sm" variant="primary" onPress={() => setCreateOpen(true)}>
                                    <Plus className="size-3.5" />
                                    New booking page
                                </Button>
                            ) : undefined
                        }
                    />
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {sorted.map((page) => (
                        <BookingPageCard
                            key={page.uuid}
                            page={page}
                            onOpen={() => navigate(Routes.dashboard.booking_pages_detail.replace(":uuid", page.uuid))}
                        />
                    ))}
                </div>
            )}

            {canManage ? <CreateBookingPageModal isOpen={createOpen} onOpenChange={setCreateOpen} /> : null}
            {inviteSettingsOpen ? (
                <InviteSettingsModal isOpen={inviteSettingsOpen} onOpenChange={setInviteSettingsOpen} readOnly={!canManage} />
            ) : null}
        </div>
    );
};

export default BookingPagesPage;
