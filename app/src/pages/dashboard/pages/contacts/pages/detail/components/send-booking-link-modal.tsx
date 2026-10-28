import { useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Label, Modal } from "@heroui/react";
import { Mail } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SearchSelect } from "@/components/ui/search-select";
import { defaultBookingPageUuid, useBookingPages } from "@/features/bookings/hooks/use-booking-pages";
import {
    useBookingInviteSettings,
    useSendBookingInvitation,
} from "@/features/bookings/hooks/use-booking-invitations";
import type { BookingInviteSettings, BookingLink } from "@/features/bookings/interfaces/bookings.interfaces";
import type { Contact } from "@/features/contacts/interfaces/contact.interface";
import { Routes } from "@/routes/routes";
import { SettingSwitch } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const describeReminder = (settings: BookingInviteSettings): string => {
    const unit = settings.reminder_delay_unit.toLowerCase().slice(0, -1);
    const after = plural(settings.reminder_delay_value, unit);
    const times = settings.max_reminders === 1 ? "one reminder" : `up to ${settings.max_reminders} reminders`;
    return `We'll send ${times}, ${after} apart, until they book.`;
};

interface SendBookingLinkModalProps {
    contact: Pick<Contact, "uuid" | "name" | "email" | "unsubscribed_at" | "bounced_at">;
    /** Send this existing personal link; otherwise a booking page is picked and the contact's link for it is used. */
    link?: BookingLink | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Emails a contact their personal booking link, optionally followed by reminders if they don't book. */
export const SendBookingLinkModal: FC<SendBookingLinkModalProps> = ({ contact, link, isOpen, onOpenChange }) => {
    const { data: pages = [] } = useBookingPages();
    const { data: settings } = useBookingInviteSettings();
    const send = useSendBookingInvitation();
    // "" = no explicit pick yet, so the default page applies.
    const [pageChoice, setPageChoice] = useState("");
    const [remindChoice, setRemindChoice] = useState<boolean | null>(null);

    const activePages = pages.filter((p) => p.is_active);
    const pageUuid = pageChoice || defaultBookingPageUuid(pages);
    const remind = remindChoice ?? settings?.reminder_enabled ?? true;
    const blocker = !contact.email
        ? "This contact has no email address."
        : contact.unsubscribed_at
          ? "This contact has unsubscribed from emails."
          : contact.bounced_at
            ? "Emails to this contact bounced earlier."
            : null;
    const hasTarget = !!link || !!pageUuid;

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setPageChoice("");
            setRemindChoice(null);
        }
        onOpenChange(open);
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Email booking link</Modal.Heading>
                        <p className="text-xs text-muted">
                            {contact.email ? `Sent to ${contact.email}. ` : ""}
                            Bookings made with the link are attached to this contact.
                        </p>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        {blocker ? (
                            <Alert status="warning">
                                <Alert.Indicator />
                                <Alert.Content>
                                    <Alert.Description>{blocker}</Alert.Description>
                                </Alert.Content>
                            </Alert>
                        ) : null}

                        {link ? (
                            <div className="flex flex-col gap-1">
                                <Label>Link</Label>
                                <p className="text-sm text-foreground">{link.label || link.booking_page?.name || "Booking link"}</p>
                                <p className="truncate font-mono text-xs text-muted">{link.url}</p>
                            </div>
                        ) : (
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
                                ) : (
                                    <p className="text-xs text-muted">
                                        Uses this contact&apos;s personal link for the page, creating it if needed.
                                    </p>
                                )}
                            </div>
                        )}

                        <SettingSwitch
                            label="Remind if they haven't booked"
                            description={
                                settings ? (
                                    <>
                                        {describeReminder(settings)}{" "}
                                        <Link to={Routes.dashboard.booking_pages} className="font-medium text-link hover:underline">
                                            Change defaults
                                        </Link>
                                    </>
                                ) : undefined
                            }
                            isSelected={remind}
                            onChange={setRemindChoice}
                        />
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                        <Button size="sm" variant="tertiary" onPress={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            idleLeading={<Mail className="size-3.5" />}
                            isDisabled={!hasTarget || !!blocker || send.isPending}
                            isPending={send.isPending}
                            onPress={() =>
                                send.mutate(
                                    {
                                        contact_uuid: contact.uuid,
                                        ...(link ? { booking_link_uuid: link.uuid } : { booking_page_uuid: pageUuid }),
                                        remind,
                                    },
                                    { onSuccess: () => handleOpenChange(false) },
                                )
                            }
                        >
                            Send link
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
