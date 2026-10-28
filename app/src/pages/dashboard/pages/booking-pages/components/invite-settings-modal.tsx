import { useState, type FC } from "react";
import { Button, Input, Modal, TextArea } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    useBookingInviteSettings,
    useUpdateBookingInviteSettings,
} from "@/features/bookings/hooks/use-booking-invitations";
import {
    BookingInviteUnits,
    type BookingInviteSettings,
    type BookingInviteUnit,
} from "@/features/bookings/interfaces/bookings.interfaces";
import {
    Field,
    NumberInput,
    SettingSwitch,
    SimpleSelect,
} from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";

const UNIT_OPTIONS = [
    { id: BookingInviteUnits.HOURS, label: "Hours" },
    { id: BookingInviteUnits.DAYS, label: "Days" },
    { id: BookingInviteUnits.WEEKS, label: "Weeks" },
];

const MAX_DELAY_DAYS = 90;
const UNIT_DAYS: Record<BookingInviteUnit, number> = { HOURS: 1 / 24, DAYS: 1, WEEKS: 7 };

interface FormState {
    reminder_enabled: boolean;
    reminder_delay_value: number;
    reminder_delay_unit: BookingInviteUnit;
    max_reminders: number;
    invite_subject: string;
    invite_message: string;
    reminder_subject: string;
    reminder_message: string;
}

const toFormState = (settings: BookingInviteSettings): FormState => ({
    reminder_enabled: settings.reminder_enabled,
    reminder_delay_value: settings.reminder_delay_value,
    reminder_delay_unit: settings.reminder_delay_unit,
    max_reminders: settings.max_reminders,
    invite_subject: settings.invite_subject ?? "",
    invite_message: settings.invite_message ?? "",
    reminder_subject: settings.reminder_subject ?? "",
    reminder_message: settings.reminder_message ?? "",
});

const VARIABLES = "{{contact.first_name}}, {{booking.title}}, {{brand.name}}, {{sender.name}}, {{booking_link}}, {{booking_button}}";

interface FormProps {
    settings: BookingInviteSettings;
    readOnly: boolean;
    onClose: () => void;
}

const SettingsForm: FC<FormProps> = ({ settings, readOnly, onClose }) => {
    const update = useUpdateBookingInviteSettings();
    const [form, setForm] = useState<FormState>(() => toFormState(settings));
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

    const delayDays = form.reminder_delay_value * UNIT_DAYS[form.reminder_delay_unit];
    const delayError =
        delayDays > MAX_DELAY_DAYS ? `The delay can be at most ${MAX_DELAY_DAYS} days.` : undefined;

    const save = () =>
        update.mutate(
            {
                reminder_enabled: form.reminder_enabled,
                reminder_delay_value: form.reminder_delay_value,
                reminder_delay_unit: form.reminder_delay_unit,
                max_reminders: form.max_reminders,
                invite_subject: form.invite_subject,
                invite_message: form.invite_message,
                reminder_subject: form.reminder_subject,
                reminder_message: form.reminder_message,
            },
            { onSuccess: onClose },
        );

    return (
        <>
            <Modal.Body className="max-h-[70vh] space-y-5 overflow-y-auto">
                <SettingSwitch
                    label="Remind contacts who have not booked"
                    description="Sent automatically after you email a contact their booking link. Individual sends can still turn it off."
                    isSelected={form.reminder_enabled}
                    onChange={(v) => set("reminder_enabled", v)}
                    isDisabled={readOnly}
                />

                {form.reminder_enabled ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Remind after" error={delayError} description="Counted from the previous email.">
                            <div className="flex items-center gap-2">
                                <NumberInput
                                    aria-label="Reminder delay"
                                    value={form.reminder_delay_value}
                                    onChange={(v) => set("reminder_delay_value", v ?? 1)}
                                    minValue={1}
                                    maxValue={365}
                                    isDisabled={readOnly}
                                />
                                <SimpleSelect
                                    aria-label="Reminder delay unit"
                                    options={UNIT_OPTIONS}
                                    value={form.reminder_delay_unit}
                                    onChange={(v) => set("reminder_delay_unit", v as BookingInviteUnit)}
                                    isDisabled={readOnly}
                                    className="sm:max-w-[8rem]"
                                />
                            </div>
                        </Field>
                        <Field label="Number of reminders" description="Stops early as soon as the contact books.">
                            <NumberInput
                                aria-label="Number of reminders"
                                value={form.max_reminders}
                                onChange={(v) => set("max_reminders", v ?? 1)}
                                minValue={1}
                                maxValue={5}
                                isDisabled={readOnly}
                            />
                        </Field>
                    </div>
                ) : null}

                <div className="space-y-4 border-t border-border/60 pt-4">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Email text</h3>
                        <p className="text-xs text-muted">
                            Leave a field empty to use the default shown in it. Variables: {VARIABLES}. The booking
                            button is added automatically when your message has neither link variable.
                        </p>
                    </div>
                    <Field label="Booking link email: subject" htmlFor="bis-invite-subject">
                        <Input
                            id="bis-invite-subject"
                            value={form.invite_subject}
                            onChange={(e) => set("invite_subject", e.target.value)}
                            placeholder={settings.defaults.invite_subject}
                            disabled={readOnly}
                            maxLength={200}
                            fullWidth
                        />
                    </Field>
                    <Field label="Booking link email: message" htmlFor="bis-invite-message">
                        <TextArea
                            id="bis-invite-message"
                            rows={6}
                            value={form.invite_message}
                            onChange={(e) => set("invite_message", e.target.value)}
                            placeholder={settings.defaults.invite_message}
                            disabled={readOnly}
                            maxLength={5000}
                            fullWidth
                        />
                    </Field>
                    <Field label="Reminder email: subject" htmlFor="bis-reminder-subject">
                        <Input
                            id="bis-reminder-subject"
                            value={form.reminder_subject}
                            onChange={(e) => set("reminder_subject", e.target.value)}
                            placeholder={settings.defaults.reminder_subject}
                            disabled={readOnly}
                            maxLength={200}
                            fullWidth
                        />
                    </Field>
                    <Field label="Reminder email: message" htmlFor="bis-reminder-message">
                        <TextArea
                            id="bis-reminder-message"
                            rows={6}
                            value={form.reminder_message}
                            onChange={(e) => set("reminder_message", e.target.value)}
                            placeholder={settings.defaults.reminder_message}
                            disabled={readOnly}
                            maxLength={5000}
                            fullWidth
                        />
                    </Field>
                </div>
            </Modal.Body>
            <Modal.Footer className="justify-end gap-2">
                <Button size="sm" variant="tertiary" onPress={onClose}>
                    {readOnly ? "Close" : "Cancel"}
                </Button>
                {!readOnly ? (
                    <ActionButtonWithPending
                        size="sm"
                        isPending={update.isPending}
                        isDisabled={update.isPending || !!delayError}
                        onPress={save}
                    >
                        Save settings
                    </ActionButtonWithPending>
                ) : null}
            </Modal.Footer>
        </>
    );
};

interface InviteSettingsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    readOnly: boolean;
}

/** Organisation-wide defaults for booking links emailed to contacts and their no-booking reminders. */
export const InviteSettingsModal: FC<InviteSettingsModalProps> = ({ isOpen, onOpenChange, readOnly }) => {
    const { data: settings, isLoading } = useBookingInviteSettings();

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Invitation settings</Modal.Heading>
                        <p className="text-xs text-muted">
                            Defaults for personal booking links you email to contacts. They apply to every send, so you
                            don&apos;t have to set them each time.
                        </p>
                    </Modal.Header>
                    {isLoading || !settings ? (
                        <Modal.Body>
                            <p className="py-6 text-sm text-muted">Loading…</p>
                        </Modal.Body>
                    ) : (
                        <SettingsForm settings={settings} readOnly={readOnly} onClose={() => onOpenChange(false)} />
                    )}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
