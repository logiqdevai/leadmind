import { useState, type FC } from "react";
import { Button, Chip, Input, Label, Modal } from "@heroui/react";
import { ExternalLink, Link2, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import {
    useBookingLinks,
    useCreateBookingLink,
    useDeleteBookingLink,
    useRegenerateBookingLink,
    useUpdateBookingLink,
} from "@/features/bookings/hooks/use-booking-pages";
import type { BookingLink } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDateTime } from "@/features/bookings/utils/booking-time";
import { getBrowserTimezone } from "@/lib/timezone";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { SettingSwitch, SettingsSection } from "./form-fields";

interface LinkFormModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    bookingPageUuid: string;
    editing: BookingLink | null;
}

const LinkFormModal: FC<LinkFormModalProps> = ({ isOpen, onOpenChange, bookingPageUuid, editing }) => {
    const createLink = useCreateBookingLink();
    const updateLink = useUpdateBookingLink();
    // The parent remounts this modal (key) for every open, so initial state is enough.
    const [label, setLabel] = useState(editing?.label ?? "");
    const [autoCreate, setAutoCreate] = useState(editing?.auto_create_contact ?? true);
    const [requireConfirmation, setRequireConfirmation] = useState(editing?.require_attendance_confirmation ?? false);
    const isPending = createLink.isPending || updateLink.isPending;

    const submit = () => {
        const done = { onSuccess: () => onOpenChange(false) };
        if (editing) {
            updateLink.mutate({ uuid: editing.uuid, payload: { label: label.trim(), auto_create_contact: autoCreate, require_attendance_confirmation: requireConfirmation } }, done);
        } else {
            createLink.mutate(
                {
                    booking_page_uuid: bookingPageUuid,
                    label: label.trim() || undefined,
                    auto_create_contact: autoCreate,
                    require_attendance_confirmation: requireConfirmation,
                },
                done,
            );
        }
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{editing ? "Edit link" : "New link"}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="bl-label">Label</Label>
                            <Input
                                id="bl-label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="e.g. Website, LinkedIn profile, Newsletter"
                                autoFocus
                            />
                            <p className="text-xs text-muted">Internal, so you can tell links apart and see where bookings came from.</p>
                        </div>
                        <SettingSwitch
                            label="Create or match a contact"
                            description="Finds the contact by the invitee's email, or creates one from their booking details."
                            isSelected={autoCreate}
                            onChange={setAutoCreate}
                        />
                        <SettingSwitch
                            label="Ask invitees to confirm attendance"
                            description="Confirmation emails for bookings from this link include a button to confirm the details and that they will attend. Applies to new bookings."
                            isSelected={requireConfirmation}
                            onChange={setRequireConfirmation}
                        />
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending isPending={isPending} isDisabled={isPending} onPress={submit}>
                            {editing ? "Save" : "Create link"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

interface LinksTabProps {
    bookingPageUuid: string;
    canManage: boolean;
}

export const LinksTab: FC<LinksTabProps> = ({ bookingPageUuid, canManage }) => {
    const timeZone = getBrowserTimezone() ?? "UTC";
    const { data: links = [], isLoading } = useBookingLinks({
        booking_page_uuid: bookingPageUuid,
        generic_only: true,
        include_inactive: true,
    });
    const { data: activeLinks = [] } = useBookingLinks({ booking_page_uuid: bookingPageUuid, include_inactive: false });
    const contactLinkCount = activeLinks.filter((l) => l.contact_uuid != null).length;

    const updateLink = useUpdateBookingLink();
    const regenerateLink = useRegenerateBookingLink();
    const deleteLink = useDeleteBookingLink();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<BookingLink | null>(null);
    const [toRegenerate, setToRegenerate] = useState<BookingLink | null>(null);
    const [toDelete, setToDelete] = useState<BookingLink | null>(null);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    return (
        <div className="space-y-4">
            <SettingsSection
                title="Shareable links"
                description="Generic links anyone can use, e.g. on your website or in a signature. Each link tracks its own bookings."
                actions={
                    canManage ? (
                        <Button size="sm" variant="primary" onPress={openCreate}>
                            <Plus className="size-3.5" />
                            New link
                        </Button>
                    ) : null
                }
            >
                {isLoading ? (
                    <DashboardListSkeleton />
                ) : links.length === 0 ? (
                    <DashboardEmptyState icon={Link2} title="No links yet" body="Create a link to share this booking page." />
                ) : (
                    <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                        {links.map((link) => (
                            <li key={link.uuid} className="space-y-2 px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">{link.label || "Untitled link"}</p>
                                    <Chip size="sm" variant="soft" color={link.is_active ? "success" : "default"}>
                                        <Chip.Label>{link.is_active ? "Active" : "Inactive"}</Chip.Label>
                                    </Chip>
                                    {link.auto_create_contact ? (
                                        <Chip size="sm" variant="soft" color="accent">
                                            <Chip.Label>Creates contacts</Chip.Label>
                                        </Chip>
                                    ) : null}
                                    {link.require_attendance_confirmation ? (
                                        <Chip size="sm" variant="soft" color="warning">
                                            <Chip.Label>Asks to confirm</Chip.Label>
                                        </Chip>
                                    ) : null}
                                    <span className="ml-auto text-xs text-muted">
                                        {link._count?.bookings ?? 0} booking{(link._count?.bookings ?? 0) === 1 ? "" : "s"}
                                        {link.last_used_at ? ` · last used ${formatDateTime(link.last_used_at, timeZone)}` : ""}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 rounded-lg bg-surface-secondary/40 px-2 py-1">
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={link.url}>
                                        {link.url}
                                    </span>
                                    <CopyButton value={link.url} label="link" />
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label="Open link"
                                        className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:text-foreground"
                                    >
                                        <ExternalLink className="size-3.5" />
                                    </a>
                                </div>
                                {canManage ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="grid flex-1 gap-2 sm:grid-cols-2">
                                            <SettingSwitch
                                                label="Active"
                                                isSelected={link.is_active}
                                                onChange={(v) => updateLink.mutate({ uuid: link.uuid, payload: { is_active: v } })}
                                                isDisabled={updateLink.isPending}
                                            />
                                            <SettingSwitch
                                                label="Create or match contact"
                                                isSelected={link.auto_create_contact}
                                                onChange={(v) => updateLink.mutate({ uuid: link.uuid, payload: { auto_create_contact: v } })}
                                                isDisabled={updateLink.isPending}
                                            />
                                            <SettingSwitch
                                                label="Ask to confirm attendance"
                                                isSelected={link.require_attendance_confirmation}
                                                onChange={(v) => updateLink.mutate({ uuid: link.uuid, payload: { require_attendance_confirmation: v } })}
                                                isDisabled={updateLink.isPending}
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant="tertiary"
                                                aria-label="Edit link"
                                                onPress={() => {
                                                    setEditing(link);
                                                    setFormOpen(true);
                                                }}
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button size="sm" variant="tertiary" aria-label="Regenerate link" onPress={() => setToRegenerate(link)}>
                                                <RefreshCw className="size-4" />
                                            </Button>
                                            <Button size="sm" variant="tertiary" aria-label="Delete link" onPress={() => setToDelete(link)}>
                                                <Trash2 className="size-4 text-danger" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted">
                    &quot;Create or match a contact&quot; looks up the contact by the invitee&apos;s email and creates one from their details
                    when none exists, so the booking appears on the contact&apos;s timeline.
                </p>
            </SettingsSection>

            <SettingsSection title="Contact-specific links">
                <div className="flex items-start gap-3">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Users className="size-4" />
                    </span>
                    <div>
                        <p className="text-sm text-foreground">
                            {contactLinkCount} active personal link{contactLinkCount === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-muted">
                            Created per contact automatically when an email uses {"{{booking_link}}"}, or from a contact&apos;s page. They prefill
                            the invitee&apos;s details and attach the booking to that contact.
                        </p>
                    </div>
                </div>
            </SettingsSection>

            {canManage ? (
                <>
                    <LinkFormModal
                        key={`${editing?.uuid ?? "new"}-${formOpen ? "open" : "closed"}`}
                        isOpen={formOpen} onOpenChange={setFormOpen} bookingPageUuid={bookingPageUuid} editing={editing} />
                    <ConfirmDialog
                        isOpen={!!toRegenerate}
                        onOpenChange={(open) => {
                            if (!open) setToRegenerate(null);
                        }}
                        title="Generate a new URL?"
                        description="The current URL stops working immediately. Anyone with the old link will need the new one. Existing bookings are kept."
                        confirmLabel="Regenerate"
                        isPending={regenerateLink.isPending}
                        onConfirm={async () => {
                            if (!toRegenerate) return;
                            await regenerateLink.mutateAsync(toRegenerate.uuid);
                            setToRegenerate(null);
                        }}
                    />
                    <ConfirmDialog
                        isOpen={!!toDelete}
                        onOpenChange={(open) => {
                            if (!open) setToDelete(null);
                        }}
                        title={`Delete "${toDelete?.label || "this link"}"?`}
                        description="The URL stops accepting bookings. Bookings already made through it are kept."
                        confirmLabel="Delete"
                        variant="danger"
                        isPending={deleteLink.isPending}
                        onConfirm={async () => {
                            if (!toDelete) return;
                            await deleteLink.mutateAsync(toDelete.uuid);
                            setToDelete(null);
                        }}
                    />
                </>
            ) : null}
        </div>
    );
};
