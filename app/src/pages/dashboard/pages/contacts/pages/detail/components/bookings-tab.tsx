import { useMemo, useState, type FC, type ReactNode } from "react";
import { Button, Chip, Label, Modal, Input } from "@heroui/react";
import { CalendarDays, Link2, Mail, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { SearchSelect } from "@/components/ui/search-select";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { BookingDetailsDrawer } from "@/components/bookings/booking-details-drawer";
import { CreateBookingModal } from "@/components/bookings/create-booking-modal";
import { BookingStatusChip } from "@/components/bookings/booking-shared";
import { useBookingTimezone } from "@/components/bookings/hooks/use-booking-context";
import type { PickedContact } from "@/components/bookings/contact-search-picker";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { useBookings } from "@/features/bookings/hooks/use-bookings";
import {
    defaultBookingPageUuid,
    useBookingLinks,
    useBookingPages,
    useCreateBookingLink,
    useDeleteBookingLink,
    useRegenerateBookingLink,
    useUpdateBookingLink,
} from "@/features/bookings/hooks/use-booking-pages";
import {
    useBookingInvitations,
    useResendBookingInvitation,
    useStopBookingInvitation,
} from "@/features/bookings/hooks/use-booking-invitations";
import {
    ACTIVE_BOOKING_STATUSES,
    BookingInvitationStatuses,
    BookingStatuses,
    type Booking,
    type BookingInvitation,
    type BookingLink,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { SendBookingLinkModal } from "@/pages/dashboard/pages/contacts/pages/detail/components/send-booking-link-modal";
import { formatDateShort, formatDateTime, formatTimeRange } from "@/features/bookings/utils/booking-time";
import type { Contact } from "@/features/contacts/interfaces/contact.interface";
import { cn } from "@/lib/utils";

interface BookingsTabProps {
    contact: Contact;
}

const SECTION_LIMIT = 50;

const Card: FC<{ title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }> = ({ title, icon, action, children }) => (
    <div className="rounded-2xl border border-border/80 bg-surface/80">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            {action}
        </div>
        {children}
    </div>
);

const BookingRow: FC<{ booking: Booking; timezone: string; onOpen: (uuid: string) => void }> = ({ booking, timezone, onOpen }) => (
    <li>
        <button
            type="button"
            onClick={() => onOpen(booking.uuid)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-secondary sm:px-5"
        >
            <span className="flex w-28 shrink-0 flex-col text-xs tabular-nums">
                <span className="font-medium text-foreground">{formatDateShort(booking.start_at, timezone)}</span>
                <span className="text-muted">{formatTimeRange(booking.start_at, booking.end_at, timezone)}</span>
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                    {booking.booking_page?.name ?? "One-off meeting"}
                </span>
                <span className="block truncate text-xs text-muted">
                    {booking.assigned_user?.full_name ?? booking.assigned_user?.email ?? "Unassigned"}
                </span>
            </span>
            <BookingStatusChip status={booking.status} />
        </button>
    </li>
);

const BookingSection: FC<{
    title: string;
    bookings: Booking[];
    isLoading: boolean;
    timezone: string;
    onOpen: (uuid: string) => void;
    emptyText: string;
}> = ({ title, bookings, isLoading, timezone, onOpen, emptyText }) => (
    <section>
        <h4 className="border-b border-border/40 bg-surface-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-5">
            {title}
            {!isLoading ? <span className="ml-1.5 tabular-nums">({bookings.length})</span> : null}
        </h4>
        {isLoading ? (
            <DashboardListSkeleton />
        ) : bookings.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted sm:px-5">{emptyText}</p>
        ) : (
            <ul className="divide-y divide-border/40">
                {bookings.map((b) => (
                    <BookingRow key={b.uuid} booking={b} timezone={timezone} onOpen={onOpen} />
                ))}
            </ul>
        )}
    </section>
);

// --- Booking links ------------------------------------------------------------

const CreateLinkModal: FC<{ contactUuid: string; isOpen: boolean; onOpenChange: (open: boolean) => void }> = ({
    contactUuid,
    isOpen,
    onOpenChange,
}) => {
    const { data: pages = [] } = useBookingPages();
    const create = useCreateBookingLink();
    // "" = no explicit pick yet, so the default page applies.
    const [pageChoice, setPageChoice] = useState("");
    const [label, setLabel] = useState("");
    const activePages = pages.filter((p) => p.is_active);
    const pageUuid = pageChoice || defaultBookingPageUuid(pages);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setPageChoice("");
            setLabel("");
        }
        onOpenChange(open);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Create booking link</Modal.Heading>
                        <p className="text-xs text-muted">A personal link: bookings made with it are attached to this contact.</p>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>
                                Booking page <span className="text-danger">*</span>
                            </Label>
                            <SearchSelect
                                aria-label="Booking page"
                                placeholder="Select a booking page"
                                searchPlaceholder="Search booking pages…"
                                options={activePages.map((p) => ({ id: p.uuid, label: p.is_default ? `${p.name} (default)` : p.name }))}
                                value={pageUuid}
                                onChange={setPageChoice}
                                fullWidth
                            />
                            {activePages.length === 0 ? (
                                <p className="text-xs text-muted">Create and activate a booking page first.</p>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="bl-label">Label (optional)</Label>
                            <Input
                                id="bl-label"
                                placeholder="e.g. Demo follow-up"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                maxLength={120}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                        <Button size="sm" variant="tertiary" onPress={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={!pageUuid || create.isPending}
                            isPending={create.isPending}
                            onPress={() =>
                                create.mutate(
                                    { booking_page_uuid: pageUuid, contact_uuid: contactUuid, label: label.trim() || undefined },
                                    { onSuccess: () => handleOpenChange(false) },
                                )
                            }
                        >
                            Create link
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

const InvitationRow: FC<{ invitation: BookingInvitation; timezone: string }> = ({ invitation, timezone }) => {
    const stop = useStopBookingInvitation();
    const resend = useResendBookingInvitation();
    const booked = invitation.has_booked || invitation.status === BookingInvitationStatuses.BOOKED;
    const waiting = !booked && invitation.status === BookingInvitationStatuses.ACTIVE;
    const remindersLeft = waiting && !!invitation.next_reminder_at;

    return (
        <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{invitation.booking_page.name}</span>
                    {booked ? (
                        <Chip size="sm" variant="soft" color="success">
                            <Chip.Label>Booked</Chip.Label>
                        </Chip>
                    ) : remindersLeft ? (
                        <Chip size="sm" variant="soft" color="warning">
                            <Chip.Label>Reminder due {formatDateTime(invitation.next_reminder_at!, timezone)}</Chip.Label>
                        </Chip>
                    ) : waiting ? (
                        <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>Waiting for a booking</Chip.Label>
                        </Chip>
                    ) : (
                        <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>Reminders ended</Chip.Label>
                        </Chip>
                    )}
                </div>
                <p className="text-xs text-muted">
                    Sent to {invitation.recipient_email} · {formatDateTime(invitation.sent_at, timezone)}
                    {invitation.max_reminders > 0 ? ` · ${invitation.reminders_sent} of ${invitation.max_reminders} reminders sent` : " · no reminders"}
                </p>
                {invitation.last_error ? <p className="text-xs text-danger">Last reminder failed: {invitation.last_error}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
                {!booked ? (
                    <ActionButtonWithPending
                        size="sm"
                        variant="tertiary"
                        idleLeading={<Mail className="size-3.5" />}
                        isPending={resend.isPending}
                        isDisabled={resend.isPending}
                        onPress={() => resend.mutate(invitation.uuid)}
                    >
                        Resend
                    </ActionButtonWithPending>
                ) : null}
                {remindersLeft ? (
                    <ActionButtonWithPending
                        size="sm"
                        variant="tertiary"
                        isPending={stop.isPending}
                        isDisabled={stop.isPending}
                        onPress={() => stop.mutate(invitation.uuid)}
                    >
                        Stop reminders
                    </ActionButtonWithPending>
                ) : null}
            </div>
        </li>
    );
};

const LinkRow: FC<{ link: BookingLink; timezone: string; isAdmin: boolean; onEmail: (link: BookingLink) => void }> = ({
    link,
    timezone,
    isAdmin,
    onEmail,
}) => {
    const update = useUpdateBookingLink();
    const regenerate = useRegenerateBookingLink();
    const remove = useDeleteBookingLink();
    const [confirm, setConfirm] = useState<"regenerate" | "delete" | null>(null);

    return (
        <li className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5", !link.is_active && "opacity-60")}>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                        {link.label || link.booking_page?.name || "Booking link"}
                    </span>
                    {!link.is_active ? (
                        <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>Inactive</Chip.Label>
                        </Chip>
                    ) : null}
                    {link.booking_page && !link.booking_page.is_active ? (
                        <Chip size="sm" variant="soft" color="warning">
                            <Chip.Label>Page inactive</Chip.Label>
                        </Chip>
                    ) : null}
                </div>
                <div className="flex min-w-0 items-center gap-1">
                    <a href={link.url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-muted hover:text-foreground">
                        {link.url}
                    </a>
                    <CopyButton value={link.url} label="booking link" />
                </div>
                <p className="text-xs text-muted">
                    {link.label && link.booking_page ? `${link.booking_page.name} · ` : ""}
                    {link._count?.bookings ?? 0} booking{(link._count?.bookings ?? 0) === 1 ? "" : "s"}
                    {link.last_used_at ? ` · last used ${formatDateTime(link.last_used_at, timezone)}` : ""}
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
                {link.is_active ? (
                    <Button size="sm" variant="tertiary" onPress={() => onEmail(link)} aria-label="Email link to contact">
                        <Mail className="size-3.5" />
                        Email
                    </Button>
                ) : null}
                <ActionButtonWithPending
                    size="sm"
                    variant="tertiary"
                    isPending={update.isPending}
                    isDisabled={update.isPending}
                    onPress={() => update.mutate({ uuid: link.uuid, payload: { is_active: !link.is_active } })}
                >
                    {link.is_active ? "Deactivate" : "Activate"}
                </ActionButtonWithPending>
                <Button size="sm" variant="tertiary" onPress={() => setConfirm("regenerate")} aria-label="Regenerate link">
                    <RefreshCcw className="size-3.5" />
                </Button>
                {isAdmin ? (
                    <Button size="sm" variant="tertiary" className="text-danger" onPress={() => setConfirm("delete")} aria-label="Delete link">
                        <Trash2 className="size-3.5" />
                    </Button>
                ) : null}
            </div>

            <ConfirmDialog
                isOpen={confirm === "regenerate"}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Generate a new URL?"
                description="The current URL stops accepting bookings. Existing bookings are kept."
                confirmLabel="Regenerate"
                isPending={regenerate.isPending}
                onConfirm={async () => {
                    try {
                        await regenerate.mutateAsync(link.uuid);
                    } catch {
                        // toast from hook
                    }
                }}
            />
            <ConfirmDialog
                isOpen={confirm === "delete"}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Delete this booking link?"
                description="The URL stops working. Bookings made with it are kept."
                confirmLabel="Delete"
                variant="danger"
                isPending={remove.isPending}
                onConfirm={async () => {
                    try {
                        await remove.mutateAsync(link.uuid);
                    } catch {
                        // toast from hook
                    }
                }}
            />
        </li>
    );
};

// --- Tab ----------------------------------------------------------------------

export const BookingsTab: FC<BookingsTabProps> = ({ contact }) => {
    const timezone = useBookingTimezone();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const [createOpen, setCreateOpen] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);
    const [emailOpen, setEmailOpen] = useState(false);
    // Set when emailing an existing link; null lets the modal pick a page instead.
    const [emailLink, setEmailLink] = useState<BookingLink | null>(null);
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Stable "now" per mount keeps query keys from changing on every render.
    const [nowIso] = useState(() => new Date().toISOString());
    const activeStatuses = ACTIVE_BOOKING_STATUSES.join(",");

    const upcoming = useBookings({
        contact_uuid: contact.uuid,
        from: nowIso,
        status: activeStatuses,
        order_by: "start_at",
        order_direction: "asc",
        limit: SECTION_LIMIT,
    });
    const past = useBookings({
        contact_uuid: contact.uuid,
        to: nowIso,
        status: [...ACTIVE_BOOKING_STATUSES, BookingStatuses.COMPLETED, BookingStatuses.NO_SHOW].join(","),
        order_by: "start_at",
        order_direction: "desc",
        limit: SECTION_LIMIT,
    });
    const cancelled = useBookings({
        contact_uuid: contact.uuid,
        status: BookingStatuses.CANCELLED,
        order_by: "start_at",
        order_direction: "desc",
        limit: SECTION_LIMIT,
    });
    const { data: links = [], isLoading: linksLoading } = useBookingLinks({ contact_uuid: contact.uuid, include_inactive: true });
    const { data: invitations = [] } = useBookingInvitations(contact.uuid);

    const openEmailModal = (link: BookingLink | null) => {
        setEmailLink(link);
        setEmailOpen(true);
    };

    const prefilledContact = useMemo<PickedContact>(
        () => ({ uuid: contact.uuid, name: contact.name, email: contact.email, phone: contact.phone, company: contact.company }),
        [contact.uuid, contact.name, contact.email, contact.phone, contact.company],
    );

    const total = (upcoming.data?.pagination.total ?? 0) + (past.data?.pagination.total ?? 0) + (cancelled.data?.pagination.total ?? 0);
    const allLoaded = !upcoming.isLoading && !past.isLoading && !cancelled.isLoading;
    const isRefreshing = upcoming.isFetching || past.isFetching || cancelled.isFetching;
    const refreshBookings = () => {
        void Promise.all([upcoming.refetch(), past.refetch(), cancelled.refetch()]);
    };

    return (
        <div className="flex flex-col gap-4">
            <Card
                title="Bookings"
                icon={<CalendarDays className="size-4 text-muted" />}
                action={
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={isRefreshing}
                            onPress={refreshBookings}
                            aria-label="Refresh bookings"
                            className="h-6 min-h-6 px-2"
                        >
                            <RefreshCcw className={cn("size-3.5", isRefreshing && "animate-spin")} />
                        </Button>
                        <Button size="sm" variant="secondary" onPress={() => setCreateOpen(true)} className="h-6 min-h-6 px-2.5 text-[13px]">
                            <Plus className="size-3.5" />
                            New booking
                        </Button>
                    </div>
                }
            >
                {allLoaded && total === 0 ? (
                    <DashboardEmptyState
                        icon={CalendarDays}
                        title="No bookings yet"
                        body="Book a meeting for this contact, or send them a personal booking link below."
                        action={
                            <Button size="sm" variant="secondary" className="mt-2" onPress={() => setCreateOpen(true)}>
                                <Plus className="size-3.5" />
                                New booking
                            </Button>
                        }
                    />
                ) : (
                    <div className="flex flex-col">
                        <BookingSection
                            title="Upcoming"
                            bookings={upcoming.data?.data ?? []}
                            isLoading={upcoming.isLoading}
                            timezone={timezone}
                            onOpen={setSelectedUuid}
                            emptyText="Nothing scheduled."
                        />
                        <BookingSection
                            title="Past"
                            bookings={past.data?.data ?? []}
                            isLoading={past.isLoading}
                            timezone={timezone}
                            onOpen={setSelectedUuid}
                            emptyText="No past meetings."
                        />
                        <BookingSection
                            title="Cancelled"
                            bookings={cancelled.data?.data ?? []}
                            isLoading={cancelled.isLoading}
                            timezone={timezone}
                            onOpen={setSelectedUuid}
                            emptyText="No cancelled bookings."
                        />
                    </div>
                )}
            </Card>

            <Card
                title="Booking links"
                icon={<Link2 className="size-4 text-muted" />}
                action={
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="primary" onPress={() => openEmailModal(null)} className="h-6 min-h-6 px-2.5 text-[13px]">
                            <Mail className="size-3.5" />
                            Email link
                        </Button>
                        <Button size="sm" variant="secondary" onPress={() => setLinkOpen(true)} className="h-6 min-h-6 px-2.5 text-[13px]">
                            <Plus className="size-3.5" />
                            Create link
                        </Button>
                    </div>
                }
            >
                {linksLoading ? (
                    <DashboardListSkeleton />
                ) : links.length === 0 ? (
                    <DashboardEmptyState
                        icon={Link2}
                        title="No personal links"
                        body="A personal link pre-fills this contact's details and attaches bookings to them. Email it straight to the contact, with reminders if they don't book."
                    />
                ) : (
                    <ul className="divide-y divide-border/40">
                        {links.map((link) => (
                            <LinkRow key={link.uuid} link={link} timezone={timezone} isAdmin={isAdmin} onEmail={openEmailModal} />
                        ))}
                    </ul>
                )}
                {invitations.length > 0 ? (
                    <section>
                        <h4 className="border-y border-border/40 bg-surface-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-5">
                            Sent by email
                            <span className="ml-1.5 tabular-nums">({invitations.length})</span>
                        </h4>
                        <ul className="divide-y divide-border/40">
                            {invitations.map((invitation) => (
                                <InvitationRow key={invitation.uuid} invitation={invitation} timezone={timezone} />
                            ))}
                        </ul>
                    </section>
                ) : null}
            </Card>

            <CreateBookingModal
                isOpen={createOpen}
                onOpenChange={setCreateOpen}
                contact={prefilledContact}
                onCreated={setSelectedUuid}
                onOpenBooking={setSelectedUuid}
            />
            <CreateLinkModal contactUuid={contact.uuid} isOpen={linkOpen} onOpenChange={setLinkOpen} />
            {emailOpen ? (
                <SendBookingLinkModal contact={contact} link={emailLink} isOpen={emailOpen} onOpenChange={setEmailOpen} />
            ) : null}
            <BookingDetailsDrawer
                bookingUuid={selectedUuid}
                isOpen={!!selectedUuid}
                onOpenChange={(open) => {
                    if (!open) setSelectedUuid(null);
                }}
            />
        </div>
    );
};
