import { useState, type FC, type Key } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Chip, Tabs } from "@heroui/react";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { useDashboardNavbarTitle } from "@/components/providers/dashboard-navbar-provider";
import { useBookingPage, useDeleteBookingPage } from "@/features/bookings/hooks/use-booking-pages";
import { useOrganisationMembers } from "@/features/organisations/hooks/use-organisations";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { BookingPageTabIds, Routes } from "@/routes/routes";
import { useAuthStore } from "@/stores/auth";
import { BookingPageEditor } from "./components/booking-page-editor";

const TABS = [
    { id: BookingPageTabIds.GENERAL, label: "General" },
    { id: BookingPageTabIds.SCHEDULING, label: "Scheduling" },
    { id: BookingPageTabIds.TEAM, label: "Team" },
    { id: BookingPageTabIds.NOTIFICATIONS, label: "Notifications" },
    { id: BookingPageTabIds.BRANDING, label: "Branding" },
    { id: BookingPageTabIds.LINKS, label: "Links" },
    { id: BookingPageTabIds.PREVIEW, label: "Preview" },
] as const;

const BookingPageDetailPage: FC = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const canManage = useOrganisationPermission("org_manage_bookings");
    const organisationUuid = useAuthStore((s) => s.organisation_uuid) ?? "";

    const { data: page, isLoading, isError } = useBookingPage(uuid);
    const { data: members = [] } = useOrganisationMembers(organisationUuid);
    const deletePage = useDeleteBookingPage();
    const [deleteOpen, setDeleteOpen] = useState(false);

    useDashboardNavbarTitle(page?.name ?? "Booking page");

    const tabIds = new Set<string>(TABS.map((t) => t.id));
    const rawTab = searchParams.get(Routes.dashboard.booking_pages_detail_tab_query);
    const currentTab = rawTab && tabIds.has(rawTab) ? rawTab : BookingPageTabIds.GENERAL;

    const setTab = (key: Key) => {
        const next = new URLSearchParams(searchParams);
        next.set(Routes.dashboard.booking_pages_detail_tab_query, String(key));
        setSearchParams(next, { replace: true });
    };

    const handleDelete = async () => {
        if (!page) return;
        await deletePage.mutateAsync(page.uuid);
        setDeleteOpen(false);
        navigate(Routes.dashboard.booking_pages);
    };

    const backButton = (
        <Button size="sm" variant="tertiary" onPress={() => navigate(Routes.dashboard.booking_pages)} aria-label="Back to booking pages">
            <ArrowLeft className="size-4" />
        </Button>
    );

    if (isError || (!isLoading && !page)) {
        return (
            <div className="flex items-start gap-3">
                {backButton}
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Booking page not found</h1>
                    <p className="mt-1 text-sm text-muted">It may have been deleted.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    {backButton}
                    <div className="min-w-0">
                        {!page ? (
                            <div className="space-y-2">
                                <div className="h-6 w-48 rounded bg-surface-secondary animate-pulse" />
                                <div className="h-4 w-72 rounded bg-surface-secondary/70 animate-pulse" />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="truncate text-xl font-semibold text-foreground">{page.name}</h1>
                                    <Chip size="sm" variant="soft" color={page.is_active ? "success" : "default"}>
                                        <Chip.Label>{page.is_active ? "Active" : "Inactive"}</Chip.Label>
                                    </Chip>
                                    {page.is_default ? (
                                        <Chip size="sm" variant="soft" color="accent">
                                            <Chip.Label>Default</Chip.Label>
                                        </Chip>
                                    ) : null}
                                </div>
                                {page.public_url ? (
                                    <div className="mt-1 flex min-w-0 items-center gap-1">
                                        <span className="truncate font-mono text-xs text-muted" title={page.public_url}>
                                            {page.public_url}
                                        </span>
                                        <CopyButton value={page.public_url} label="booking link" />
                                        <a
                                            href={page.public_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label="Open public page"
                                            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-foreground"
                                        >
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>
                {canManage && page ? (
                    <Button size="sm" variant="tertiary" className="text-danger" onPress={() => setDeleteOpen(true)}>
                        <Trash2 className="size-4" />
                        Delete
                    </Button>
                ) : null}
            </div>

            {!canManage ? (
                <p className="max-w-4xl rounded-lg bg-surface-secondary/40 px-3 py-2 text-xs text-muted">
                    View only. Owners and admins can change booking pages.
                </p>
            ) : null}

            <ScrollableTabs selectedKey={currentTab} onSelectionChange={setTab}>
                <ScrollableTabsList mobileColumns={3}>
                    {TABS.map((t) => (
                        <Tabs.Tab key={t.id} id={t.id} className={tabTriggerClassName}>
                            {t.label}
                        </Tabs.Tab>
                    ))}
                </ScrollableTabsList>
            </ScrollableTabs>

            {page ? (
                <BookingPageEditor
                    key={page.uuid}
                    page={page}
                    currentTab={currentTab}
                    onTabChange={setTab}
                    canManage={canManage}
                    members={members}
                />
            ) : (
                <div className="h-64 max-w-4xl rounded-2xl border border-border bg-surface animate-pulse" />
            )}

            {page ? (
                <ConfirmDialog
                    isOpen={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    title={`Delete "${page.name}"?`}
                    description="Its links stop accepting bookings immediately. Existing bookings stay in the calendar."
                    confirmLabel="Delete"
                    variant="danger"
                    isPending={deletePage.isPending}
                    onConfirm={handleDelete}
                />
            ) : null}
        </div>
    );
};

export default BookingPageDetailPage;
