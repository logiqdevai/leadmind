import { useState, type FC, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Chip, Drawer, Dropdown, Tabs, TextArea } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import {
    CalendarClock,
    CalendarDays,
    Check,
    ChevronDown,
    ExternalLink,
    Mail,
    MailPlus,
    MoreHorizontal,
    Pencil,
    RefreshCcw,
    Trash2,
    UserRoundCheck,
    Video,
    XCircle,
} from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { Routes } from "@/routes/routes";
import {
    useBooking,
    useDeleteBooking,
    useResendBookingConfirmation,
    useSetBookingStatus,
    useSyncBookingCalendar,
    useUpdateBooking,
} from "@/features/bookings/hooks/use-bookings";
import { useBookingPage } from "@/features/bookings/hooks/use-booking-pages";
import { cn } from "@/lib/utils";
import { BOOKING_LOCATION_LABELS, BOOKING_STATUS_LABELS, CALENDAR_SYNC_LABELS } from "@/features/bookings/constants/booking-labels";
import {
    BookingLocationTypes,
    BookingSources,
    BookingStatuses,
    CalendarSyncStatuses,
    type BookingDetail,
    type BookingStatus,
    type CalendarSyncStatus,
    type SettableBookingStatus,
} from "@/features/bookings/interfaces/bookings.interfaces";
import {
    formatDateLong,
    formatDateTime,
    formatDuration,
    formatTimeRange,
    timeZoneOffsetLabel,
} from "@/features/bookings/utils/booking-time";
import {
    CancelBookingDialog,
    EditBookingModal,
    ReassignBookingModal,
    RescheduleBookingModal,
} from "./booking-action-modals";
import { BookingHistory } from "./booking-history";
import { BookingStatusChip, DetailRow } from "./booking-shared";
import { useBookingTimezone } from "./hooks/use-booking-context";
import { bookingDisplayName, contactDetailHref, hasBookingStarted, isBookingActive } from "./utils/booking-display";

interface BookingDetailsDrawerProps {
    bookingUuid: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const DrawerTabs = { DETAILS: "details", HISTORY: "history" } as const;

const SYNC_CHIP_COLORS: Record<CalendarSyncStatus, "default" | "warning" | "success" | "danger"> = {
    [CalendarSyncStatuses.NOT_SYNCED]: "default",
    [CalendarSyncStatuses.PENDING]: "warning",
    [CalendarSyncStatuses.SYNCED]: "success",
    [CalendarSyncStatuses.FAILED]: "danger",
};

const ActionModals = {
    EDIT: "edit",
    RESCHEDULE: "reschedule",
    CANCEL: "cancel",
    REASSIGN: "reassign",
    DELETE: "delete",
} as const;
type ActionModal = (typeof ActionModals)[keyof typeof ActionModals];

const Panel: FC<{ title: string; children: ReactNode; action?: ReactNode }> = ({ title, children, action }) => (
    <section className="rounded-xl border border-border/80 bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-surface-secondary/40 px-4 py-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h4>
            {action}
        </div>
        <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
);

const InternalNotesEditor: FC<{ booking: BookingDetail }> = ({ booking }) => {
    const update = useUpdateBooking();
    // Remounted (keyed) by the parent whenever the saved notes change.
    const [notes, setNotes] = useState(booking.internal_notes ?? "");

    const dirty = notes.trim() !== (booking.internal_notes ?? "").trim();

    return (
        <div className="flex flex-col gap-2">
            <TextArea
                aria-label="Internal notes"
                rows={3}
                placeholder="Only visible to your team"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
            />
            {dirty ? (
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="tertiary" onPress={() => setNotes(booking.internal_notes ?? "")}>
                        Discard
                    </Button>
                    <ActionButtonWithPending
                        size="sm"
                        variant="secondary"
                        isPending={update.isPending}
                        isDisabled={update.isPending}
                        onPress={() => update.mutate({ uuid: booking.uuid, payload: { internal_notes: notes.trim() } })}
                    >
                        Save notes
                    </ActionButtonWithPending>
                </div>
            ) : null}
        </div>
    );
};

/** Every status, in lifecycle order. Cancelled goes through the cancel dialog (emails the invitee, frees the slot). */
const STATUS_MENU_ORDER = [
    BookingStatuses.PENDING,
    BookingStatuses.CONFIRMED,
    BookingStatuses.RESCHEDULED,
    BookingStatuses.COMPLETED,
    BookingStatuses.NO_SHOW,
    BookingStatuses.CANCELLED,
] as const;

/** Why a status can't be picked right now, or null when it can (mirrors BookingsService.setStatus). */
function statusBlockedReason(booking: BookingDetail, target: BookingStatus): string | null {
    if (target === booking.status) return "Current status";
    if (target === BookingStatuses.COMPLETED || target === BookingStatuses.NO_SHOW) {
        return hasBookingStarted(booking) ? null : "After the meeting starts";
    }
    return null;
}

const BookingStatusMenu: FC<{ booking: BookingDetail; onCancel: () => void }> = ({ booking, onCancel }) => {
    const setStatus = useSetBookingStatus();
    // Cancelled bookings are final: reopening one could double-book a slot that has since been taken.
    if (booking.status === BookingStatuses.CANCELLED) return <BookingStatusChip status={booking.status} />;

    return (
        <Dropdown>
            <Dropdown.Trigger>
                <Button
                    size="sm"
                    variant="tertiary"
                    aria-label={`Booking status: ${BOOKING_STATUS_LABELS[booking.status]}. Change status`}
                    isDisabled={setStatus.isPending}
                    className="h-auto min-w-0 gap-0.5 px-1 py-0.5"
                >
                    <BookingStatusChip status={booking.status} />
                    <ChevronDown className="size-3.5 text-muted" />
                </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover
                placement="bottom start"
                className="rounded-xl border border-border bg-surface p-1 shadow-xl outline-none backdrop-blur-none [backdrop-filter:none]"
            >
                <Dropdown.Menu
                    className="min-w-[13rem] bg-transparent p-0 outline-none"
                    onAction={(key) => {
                        const status = String(key) as BookingStatus;
                        if (status === BookingStatuses.CANCELLED) onCancel();
                        else setStatus.mutate({ uuid: booking.uuid, status: status as SettableBookingStatus });
                    }}
                >
                    {STATUS_MENU_ORDER.map((status) => {
                        const blocked = statusBlockedReason(booking, status);
                        const danger = status === BookingStatuses.CANCELLED;
                        return (
                            <Dropdown.Item
                                key={status}
                                id={status}
                                textValue={BOOKING_STATUS_LABELS[status]}
                                isDisabled={!!blocked}
                                variant={danger ? "danger" : undefined}
                            >
                                <span className={cn("flex w-full items-center justify-between gap-3", danger && "text-danger")}>
                                    {BOOKING_STATUS_LABELS[status]}
                                    {blocked ? <span className="text-xs text-muted">{blocked}</span> : null}
                                </span>
                            </Dropdown.Item>
                        );
                    })}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
};

const BookingDetailsBody: FC<{ booking: BookingDetail; timezone: string }> = ({ booking, timezone }) => {
    const sync = useSyncBookingCalendar();
    const { data: page } = useBookingPage(booking.answers ? booking.booking_page_uuid : null);
    const questionLabels = new Map((page?.questions ?? []).map((q) => [q.id, q.label]));

    const inviteeTz = booking.invitee_timezone;
    const showInviteeTime = !!inviteeTz && inviteeTz !== timezone;
    const answers = Object.entries(booking.answers ?? {});
    const canRetrySync =
        isBookingActive(booking) &&
        (booking.calendar_sync_status === CalendarSyncStatuses.FAILED ||
            booking.calendar_sync_status === CalendarSyncStatuses.NOT_SYNCED);

    return (
        <div className="flex flex-col gap-4">
            <Panel title="When">
                <div>
                    <p className="text-base font-semibold text-foreground">{formatDateLong(booking.start_at, timezone)}</p>
                    <p className="text-sm text-foreground tabular-nums">
                        {formatTimeRange(booking.start_at, booking.end_at, timezone)}{" "}
                        <span className="text-muted">
                            ({timeZoneOffsetLabel(timezone, new Date(booking.start_at))}) · {formatDuration(booking.duration_minutes)}
                        </span>
                    </p>
                    {showInviteeTime ? (
                        <p className="mt-1 text-xs text-muted">
                            Invitee time: {formatDateTime(booking.start_at, inviteeTz)} ({inviteeTz})
                        </p>
                    ) : null}
                    {booking.reschedule_count > 0 ? (
                        <p className="mt-1 text-xs text-muted">
                            Rescheduled {booking.reschedule_count} time{booking.reschedule_count === 1 ? "" : "s"}
                        </p>
                    ) : null}
                </div>
                {booking.status === BookingStatuses.CANCELLED ? (
                    <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-foreground">
                        Cancelled
                        {booking.cancelled_by ? ` by ${booking.cancelled_by === "INVITEE" ? "the invitee" : booking.cancelled_by === "USER" ? "your team" : "the system"}` : ""}
                        {booking.cancelled_at ? ` on ${formatDateTime(booking.cancelled_at, timezone)}` : ""}
                        {booking.cancellation_reason ? (
                            <p className="mt-1 text-xs text-muted">Reason: {booking.cancellation_reason}</p>
                        ) : null}
                    </div>
                ) : null}
            </Panel>

            <Panel title="Invitee">
                <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Name">
                        {booking.contact_uuid ? (
                            <Link
                                to={contactDetailHref(booking.contact_uuid)}
                                className="font-medium text-accent hover:underline"
                            >
                                {bookingDisplayName(booking)}
                            </Link>
                        ) : (
                            <span className="font-medium">{bookingDisplayName(booking)}</span>
                        )}
                        {booking.contact?.company ? <span className="block text-xs text-muted">{booking.contact.company}</span> : null}
                    </DetailRow>
                    <DetailRow label="Email">
                        {booking.invitee_email ? (
                            <span className="flex min-w-0 items-center gap-1">
                                <a href={`mailto:${booking.invitee_email}`} className="truncate hover:underline">
                                    {booking.invitee_email}
                                </a>
                                <CopyButton value={booking.invitee_email} label="email" />
                            </span>
                        ) : (
                            <span className="text-muted">Not provided</span>
                        )}
                    </DetailRow>
                    <DetailRow label="Phone">
                        {booking.invitee_phone ? (
                            <a href={`tel:${booking.invitee_phone}`} className="hover:underline">
                                {booking.invitee_phone}
                            </a>
                        ) : (
                            <span className="text-muted">Not provided</span>
                        )}
                    </DetailRow>
                    {booking.invitee_company ? <DetailRow label="Company">{booking.invitee_company}</DetailRow> : null}
                </div>
                {booking.invitee_notes ? (
                    <DetailRow label="Invitee notes">
                        <p className="whitespace-pre-line">{booking.invitee_notes}</p>
                    </DetailRow>
                ) : null}
                {answers.length ? (
                    <div className="flex flex-col gap-2">
                        {answers.map(([key, value]) => (
                            <DetailRow key={key} label={questionLabels.get(key) ?? key}>
                                {typeof value === "boolean" ? (value ? "Yes" : "No") : value || <span className="text-muted">No answer</span>}
                            </DetailRow>
                        ))}
                    </div>
                ) : null}
            </Panel>

            <Panel title="Booking">
                <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Assigned to">
                        {booking.assigned_user ? (booking.assigned_user.full_name ?? booking.assigned_user.email) : <span className="text-muted">Unassigned</span>}
                    </DetailRow>
                    <DetailRow label="Booking type">
                        {booking.booking_page ? (
                            <Link
                                to={Routes.dashboard.booking_pages_detail.replace(":uuid", booking.booking_page.uuid)}
                                className="text-accent hover:underline"
                            >
                                {booking.booking_page.name}
                            </Link>
                        ) : (
                            <span className="text-muted">One-off meeting</span>
                        )}
                    </DetailRow>
                    <DetailRow label="Source">
                        {booking.source === BookingSources.PUBLIC
                            ? "Booked online"
                            : booking.source === BookingSources.REMINDER
                              ? "From a reminder"
                              : "Created manually"}
                        {booking.created_by ? (
                            <span className="block text-xs text-muted">by {booking.created_by.full_name ?? booking.created_by.email}</span>
                        ) : null}
                        {booking.booking_link ? (
                            <span className="block text-xs text-muted">via link {booking.booking_link.label ?? booking.booking_link.code}</span>
                        ) : null}
                    </DetailRow>
                    <DetailRow label="Created">{formatDateTime(booking.created_at, timezone)}</DetailRow>
                </div>
            </Panel>

            <Panel title="Location">
                <DetailRow label={BOOKING_LOCATION_LABELS[booking.location_type]}>
                    {booking.location_value ? (
                        <span className="whitespace-pre-line">{booking.location_value}</span>
                    ) : booking.location_type === BookingLocationTypes.GOOGLE_MEET && !booking.meeting_url ? (
                        <span className="text-muted">The Meet link is created when the calendar event syncs.</span>
                    ) : booking.location_type === BookingLocationTypes.NONE ? (
                        <span className="text-muted">No location set</span>
                    ) : null}
                </DetailRow>
                {booking.meeting_url ? (
                    <div className="flex items-center gap-2">
                        <a
                            href={booking.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({ size: "sm", variant: "primary" })}
                        >
                            <Video className="size-3.5" />
                            Join Google Meet
                        </a>
                        <CopyButton value={booking.meeting_url} label="meeting link" />
                    </div>
                ) : null}
            </Panel>

            <Panel
                title="Google Calendar"
                action={
                    <Chip size="sm" variant="soft" color={SYNC_CHIP_COLORS[booking.calendar_sync_status]}>
                        <Chip.Label>{CALENDAR_SYNC_LABELS[booking.calendar_sync_status]}</Chip.Label>
                    </Chip>
                }
            >
                {booking.calendar_sync_error ? <p className="text-sm text-danger">{booking.calendar_sync_error}</p> : null}
                {booking.calendar_synced_at ? (
                    <p className="text-xs text-muted">Last synced {formatDateTime(booking.calendar_synced_at, timezone)}</p>
                ) : null}
                {!booking.calendar_html_link && !canRetrySync && !booking.calendar_sync_error ? (
                    <p className="text-xs text-muted">
                        {booking.calendar_sync_status === CalendarSyncStatuses.PENDING
                            ? "The event is being created."
                            : "Connect Google Calendar in Calendar integrations to sync bookings."}
                    </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                    {booking.calendar_html_link ? (
                        <a
                            href={booking.calendar_html_link}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({ size: "sm", variant: "secondary" })}
                        >
                            <ExternalLink className="size-3.5" />
                            Open in Google Calendar
                        </a>
                    ) : null}
                    {canRetrySync ? (
                        <ActionButtonWithPending
                            size="sm"
                            variant="secondary"
                            isPending={sync.isPending}
                            isDisabled={sync.isPending}
                            onPress={() => sync.mutate(booking.uuid)}
                        >
                            <RefreshCcw className="size-3.5" />
                            {booking.calendar_sync_status === CalendarSyncStatuses.FAILED ? "Retry sync" : "Sync now"}
                        </ActionButtonWithPending>
                    ) : null}
                </div>
            </Panel>

            <Panel title="Internal notes">
                <InternalNotesEditor key={`${booking.uuid}:${booking.internal_notes ?? ""}`} booking={booking} />
            </Panel>
        </div>
    );
};

const BookingDrawerSkeleton: FC = () => (
    <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-secondary animate-pulse" />
        ))}
    </div>
);

/** Everything about one booking, with the actions a team member can take on it. */
export const BookingDetailsDrawer: FC<BookingDetailsDrawerProps> = ({ bookingUuid, isOpen, onOpenChange }) => {
    const timezone = useBookingTimezone();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const { data: booking, isLoading, isError } = useBooking(isOpen ? bookingUuid : null);
    const setStatus = useSetBookingStatus();
    const deleteBooking = useDeleteBooking();
    const resendConfirmation = useResendBookingConfirmation();
    const navigate = useNavigate();

    const [tab, setTab] = useState<string>(DrawerTabs.DETAILS);
    const [modal, setModal] = useState<ActionModal | null>(null);

    // Back to the Details tab whenever another booking is opened (state adjusted during render).
    const openedKey = isOpen ? bookingUuid : null;
    const [tabFor, setTabFor] = useState<string | null>(openedKey);
    if (tabFor !== openedKey) {
        setTabFor(openedKey);
        setTab(DrawerTabs.DETAILS);
    }

    const active = booking ? isBookingActive(booking) : false;
    const closeModal = (open: boolean) => {
        if (!open) setModal(null);
    };

    return (
        <>
            <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Drawer.Content placement="right">
                    <Drawer.Dialog className="w-full sm:max-w-lg lg:max-w-xl">
                        <Drawer.CloseTrigger />
                        <Drawer.Header>
                            {booking ? (
                                <div className="flex min-w-0 flex-col gap-1 pr-8">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <Drawer.Heading className="truncate">{bookingDisplayName(booking)}</Drawer.Heading>
                                        <BookingStatusMenu booking={booking} onCancel={() => setModal(ActionModals.CANCEL)} />
                                    </div>
                                    <p className="flex items-center gap-1.5 text-xs text-muted">
                                        <CalendarDays className="size-3.5" />
                                        {booking.booking_page?.name ?? "One-off meeting"} · {formatDateTime(booking.start_at, timezone)}
                                    </p>
                                </div>
                            ) : (
                                <Drawer.Heading>
                                    {isLoading ? (
                                        <span className="inline-block h-6 w-40 animate-pulse rounded-md bg-surface-secondary align-middle" />
                                    ) : (
                                        "Booking"
                                    )}
                                </Drawer.Heading>
                            )}
                        </Drawer.Header>
                        <Drawer.Body className="flex flex-col gap-4">
                            {booking ? (
                                <>
                                    <ScrollableTabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
                                        <ScrollableTabsList>
                                            <Tabs.Tab id={DrawerTabs.DETAILS} className={tabTriggerClassName}>
                                                Details
                                            </Tabs.Tab>
                                            <Tabs.Tab id={DrawerTabs.HISTORY} className={tabTriggerClassName}>
                                                History
                                            </Tabs.Tab>
                                        </ScrollableTabsList>
                                    </ScrollableTabs>
                                    {tab === DrawerTabs.DETAILS ? (
                                        <BookingDetailsBody booking={booking} timezone={timezone} />
                                    ) : (
                                        <BookingHistory booking={booking} timezone={timezone} />
                                    )}
                                </>
                            ) : isError ? (
                                <p className="text-sm text-muted">This booking could not be loaded.</p>
                            ) : (
                                <BookingDrawerSkeleton />
                            )}
                        </Drawer.Body>
                        {booking ? (
                            <Drawer.Footer className="flex flex-wrap justify-end gap-2">
                                {booking.status === BookingStatuses.PENDING ? (
                                    <ActionButtonWithPending
                                        size="sm"
                                        isPending={setStatus.isPending}
                                        isDisabled={setStatus.isPending}
                                        onPress={() => setStatus.mutate({ uuid: booking.uuid, status: BookingStatuses.CONFIRMED })}
                                    >
                                        <Check className="size-3.5" />
                                        Confirm
                                    </ActionButtonWithPending>
                                ) : null}
                                {active ? (
                                    <Button size="sm" variant="secondary" onPress={() => setModal(ActionModals.RESCHEDULE)}>
                                        <CalendarClock className="size-3.5" />
                                        Reschedule
                                    </Button>
                                ) : null}
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <Button size="sm" variant="secondary" aria-label="More booking actions">
                                            <MoreHorizontal className="size-4" />
                                            More
                                        </Button>
                                    </Dropdown.Trigger>
                                    <Dropdown.Popover
                                        placement="top end"
                                        className="rounded-xl border border-border bg-surface p-1 shadow-xl outline-none backdrop-blur-none [backdrop-filter:none]"
                                    >
                                        <Dropdown.Menu
                                            className="min-w-[12rem] bg-transparent p-0 outline-none"
                                            onAction={(key) => {
                                                if (key === "edit") setModal(ActionModals.EDIT);
                                                if (key === "reassign") setModal(ActionModals.REASSIGN);
                                                if (key === "cancel") setModal(ActionModals.CANCEL);
                                                if (key === "delete") setModal(ActionModals.DELETE);
                                                if (key === "recontact") {
                                                    if (booking.contact_uuid) navigate(contactDetailHref(booking.contact_uuid));
                                                    else if (booking.invitee_email) window.location.href = `mailto:${booking.invitee_email}`;
                                                }
                                                if (key === "resend_confirmation") resendConfirmation.mutate(booking.uuid);
                                            }}
                                        >
                                            {booking.contact_uuid || booking.invitee_email ? (
                                                <Dropdown.Item id="recontact" textValue="Recontact">
                                                    <span className="flex items-center gap-2.5">
                                                        <MailPlus className="size-4 text-muted" />
                                                        Recontact
                                                    </span>
                                                </Dropdown.Item>
                                            ) : null}
                                            {active && booking.status !== BookingStatuses.PENDING && booking.invitee_email ? (
                                                <Dropdown.Item
                                                    id="resend_confirmation"
                                                    textValue="Resend confirmation email"
                                                    isDisabled={resendConfirmation.isPending}
                                                >
                                                    <span className="flex items-center gap-2.5">
                                                        <Mail className="size-4 text-muted" />
                                                        Resend confirmation email
                                                    </span>
                                                </Dropdown.Item>
                                            ) : null}
                                            <Dropdown.Item id="edit" textValue="Edit details">
                                                <span className="flex items-center gap-2.5">
                                                    <Pencil className="size-4 text-muted" />
                                                    Edit details
                                                </span>
                                            </Dropdown.Item>
                                            {isAdmin && active ? (
                                                <Dropdown.Item id="reassign" textValue="Reassign">
                                                    <span className="flex items-center gap-2.5">
                                                        <UserRoundCheck className="size-4 text-muted" />
                                                        Reassign
                                                    </span>
                                                </Dropdown.Item>
                                            ) : null}
                                            {active ? (
                                                <Dropdown.Item id="cancel" variant="danger" textValue="Cancel booking">
                                                    <span className="flex items-center gap-2.5 text-danger">
                                                        <XCircle className="size-4" />
                                                        Cancel booking
                                                    </span>
                                                </Dropdown.Item>
                                            ) : null}
                                            {isAdmin ? (
                                                <Dropdown.Item id="delete" variant="danger" textValue="Delete booking">
                                                    <span className="flex items-center gap-2.5 text-danger">
                                                        <Trash2 className="size-4" />
                                                        Delete booking
                                                    </span>
                                                </Dropdown.Item>
                                            ) : null}
                                        </Dropdown.Menu>
                                    </Dropdown.Popover>
                                </Dropdown>
                            </Drawer.Footer>
                        ) : null}
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>

            {booking ? (
                <>
                    <EditBookingModal
                        booking={booking}
                        timezone={timezone}
                        isOpen={modal === ActionModals.EDIT}
                        onOpenChange={closeModal}
                    />
                    {modal === ActionModals.RESCHEDULE ? (
                        <RescheduleBookingModal booking={booking} timezone={timezone} isOpen onOpenChange={closeModal} />
                    ) : null}
                    <CancelBookingDialog
                        booking={booking}
                        timezone={timezone}
                        isOpen={modal === ActionModals.CANCEL}
                        onOpenChange={closeModal}
                    />
                    {isAdmin ? (
                        <ConfirmDialog
                            isOpen={modal === ActionModals.DELETE}
                            onOpenChange={closeModal}
                            title="Delete this booking permanently?"
                            description="The booking, its history and its Google Calendar event are removed. No email is sent. To keep a record, cancel it instead."
                            confirmLabel="Delete"
                            variant="danger"
                            isPending={deleteBooking.isPending}
                            onConfirm={async () => {
                                try {
                                    await deleteBooking.mutateAsync(booking.uuid);
                                    setModal(null);
                                    onOpenChange(false);
                                } catch {
                                    // toast from hook
                                }
                            }}
                        />
                    ) : null}
                    {isAdmin && modal === ActionModals.REASSIGN ? (
                        <ReassignBookingModal booking={booking} timezone={timezone} isOpen onOpenChange={closeModal} />
                    ) : null}
                </>
            ) : null}
        </>
    );
};
