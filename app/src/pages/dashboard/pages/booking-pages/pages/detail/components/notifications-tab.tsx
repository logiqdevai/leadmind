import { useMemo, useState, type FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Button, Input, TextArea } from "@heroui/react";
import { Plus, X } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { SearchSelect } from "@/components/ui/search-select";
import { BOOKING_REMINDER_PRESETS, BOOKING_TEMPLATE_VARIABLES } from "@/features/bookings/constants/booking-labels";
import { formatMinutesSpan } from "@/features/bookings/utils/booking-time";
import { Channel } from "@/features/contacts/interfaces/contact.interface";
import { useMessageTemplates } from "@/features/message-templates/hooks/use-message-templates";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { firstErrorMessage } from "@/pages/dashboard/pages/booking-pages/pages/detail/utils/booking-page-form";
import { Field, SettingSwitch, SettingsSection } from "./form-fields";
import { PresetMultiPicker, PresetSinglePicker } from "./preset-pickers";

const REMINDER_PRESETS = BOOKING_REMINDER_PRESETS.map((p) => ({ value: p.minutes, label: p.label }));
const TEAM_REMINDER_PRESETS = [
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 1440, label: "1 day before" },
];
const EMAIL_PATTERN =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TemplateField =
    | "confirmation_template_uuid"
    | "reminder_template_uuid"
    | "cancellation_template_uuid"
    | "reschedule_template_uuid";

const TEMPLATE_FIELDS: { name: TemplateField; label: string }[] = [
    { name: "confirmation_template_uuid", label: "Confirmation email" },
    { name: "reminder_template_uuid", label: "Reminder email" },
    { name: "cancellation_template_uuid", label: "Cancellation email" },
    { name: "reschedule_template_uuid", label: "Reschedule email" },
];

type BooleanField = {
    [K in keyof BookingPageFormValues]: BookingPageFormValues[K] extends boolean ? K : never;
}[keyof BookingPageFormValues];

interface RecipientsEditorProps {
    value: string[];
    onChange: (value: string[]) => void;
    readOnly: boolean;
}

const RecipientsEditor: FC<RecipientsEditorProps> = ({ value, onChange, readOnly }) => {
    const [draft, setDraft] = useState("");
    const trimmed = draft.trim().toLowerCase();
    const valid = EMAIL_PATTERN.test(trimmed);
    const add = () => {
        if (!valid) return;
        if (!value.includes(trimmed)) onChange([...value, trimmed]);
        setDraft("");
    };

    return (
        <div className="space-y-2">
            {value.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-md bg-accent/12 px-2 py-0.5 text-xs text-foreground">
                            {email}
                            {!readOnly ? (
                                <button
                                    type="button"
                                    aria-label={`Remove ${email}`}
                                    className="cursor-pointer text-muted hover:text-danger"
                                    onClick={() => onChange(value.filter((e) => e !== email))}
                                >
                                    <X className="size-3" />
                                </button>
                            ) : null}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-muted">No extra recipients.</p>
            )}
            {!readOnly ? (
                <div className="flex items-center gap-2">
                    <Input
                        aria-label="Add recipient email"
                        type="email"
                        placeholder="team@yourcompany.com"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                add();
                            }
                        }}
                        className="w-full sm:max-w-xs"
                    />
                    <Button size="sm" variant="secondary" isDisabled={!valid} onPress={add}>
                        <Plus className="size-3.5" />
                        Add
                    </Button>
                </div>
            ) : null}
        </div>
    );
};

interface NotificationsTabProps {
    readOnly: boolean;
}

export const NotificationsTab: FC<NotificationsTabProps> = ({ readOnly }) => {
    const { control, register, watch, formState } = useFormContext<BookingPageFormValues>();
    const { errors } = formState;
    const sendReminders = watch("send_reminder_emails");
    const createTeamReminder = watch("create_team_reminder");
    const { data: templates = [], isLoading: templatesLoading } = useMessageTemplates();

    const templateOptions = useMemo(
        () =>
            templates
                .filter((t) => t.channels.includes(Channel.EMAIL) || !!t.email_content)
                .map((t) => ({ id: t.uuid, label: t.name })),
        [templates],
    );

    const renderSwitch = (name: BooleanField, label: string, description?: string) => (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <SettingSwitch
                    label={label}
                    description={description}
                    isSelected={!!field.value}
                    onChange={field.onChange}
                    isDisabled={readOnly}
                />
            )}
        />
    );

    return (
        <div className="space-y-4">
            <SettingsSection title="Invitee emails" description="Sent to the invitee from your default email account.">
                {renderSwitch("send_confirmation_email", "Confirmation email", "Sent right after booking (or after you confirm, when confirmation is required).")}
                {renderSwitch("send_reminder_emails", "Reminder emails")}
                {sendReminders ? (
                    <Field label="Send reminders" error={errors.reminder_offsets_minutes?.message}>
                        <Controller
                            control={control}
                            name="reminder_offsets_minutes"
                            render={({ field }) => (
                                <PresetMultiPicker
                                    aria-label="reminder times"
                                    presets={REMINDER_PRESETS}
                                    value={field.value}
                                    onChange={field.onChange}
                                    formatLabel={(m) => `${formatMinutesSpan(m)} before`}
                                    customSuffix="hours before"
                                    customFactor={60}
                                    minValue={1}
                                    maxValue={720}
                                    sort="desc"
                                    isDisabled={readOnly}
                                />
                            )}
                        />
                    </Field>
                ) : null}
                {renderSwitch("send_cancellation_email", "Cancellation email")}
                {renderSwitch("send_reschedule_email", "Reschedule email")}
                {renderSwitch("include_meeting_link", "Include the meeting link", "Adds the Google Meet (or custom) link to emails.")}
                {renderSwitch("include_calendar_details", "Include calendar details", "Attaches an .ics invite and add-to-calendar links.")}
            </SettingsSection>

            <SettingsSection title="Team notifications">
                {renderSwitch("notify_assignee", "Notify the assigned member", "Email the team member when a booking is made, rescheduled or cancelled.")}
                <Field label="Additional recipients" error={firstErrorMessage(errors.additional_recipients) ?? undefined} description="Also copied on team notifications.">
                    <Controller
                        control={control}
                        name="additional_recipients"
                        render={({ field }) => <RecipientsEditor value={field.value} onChange={field.onChange} readOnly={readOnly} />}
                    />
                </Field>
                {renderSwitch(
                    "create_team_reminder",
                    "Add a reminder to Reminders",
                    "Creates a Meeting reminder on the contact for each confirmed booking and assigns it to the member who has the meeting, so only they are notified. It moves with rescheduled or reassigned bookings and is cancelled with cancelled, completed or no-show ones. Bookings without a contact don't get one, and bookings made before you turn this on aren't added.",
                )}
                {createTeamReminder ? (
                    <Field label="Remind the team" error={errors.team_reminder_offset_minutes?.message}>
                        <Controller
                            control={control}
                            name="team_reminder_offset_minutes"
                            render={({ field }) => (
                                <PresetSinglePicker
                                    aria-label="Team reminder lead time"
                                    presets={TEAM_REMINDER_PRESETS}
                                    value={field.value}
                                    onChange={field.onChange}
                                    minValue={5}
                                    maxValue={20160}
                                    suffix="minutes before"
                                    isDisabled={readOnly}
                                />
                            )}
                        />
                    </Field>
                ) : null}
            </SettingsSection>

            <SettingsSection
                title="Email templates"
                description="Pick one of your message templates per email, or keep the built-in default. Templates can use the variables listed below."
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {TEMPLATE_FIELDS.map((tf) => (
                        <Field key={tf.name} label={tf.label}>
                            <Controller
                                control={control}
                                name={tf.name}
                                render={({ field }) => (
                                    <SearchSelect
                                        aria-label={tf.label}
                                        options={templateOptions}
                                        value={field.value}
                                        onChange={field.onChange}
                                        emptyLabel="Default template"
                                        searchPlaceholder="Search templates…"
                                        isDisabled={readOnly || templatesLoading}
                                        fullWidth
                                    />
                                )}
                            />
                        </Field>
                    ))}
                </div>
            </SettingsSection>

            <SettingsSection title="Calendar event" description="Text of the event added to the assigned member's Google Calendar. Leave empty for the default.">
                <Field label="Event title" htmlFor="bp-cal-title" error={errors.calendar_event_title?.message}>
                    <Input
                        id="bp-cal-title"
                        {...register("calendar_event_title")}
                        disabled={readOnly}
                        fullWidth
                        placeholder="{{booking.title}} with {{contact.full_name}}"
                    />
                </Field>
                <Field label="Event description" htmlFor="bp-cal-desc" error={errors.calendar_event_description?.message}>
                    <TextArea
                        id="bp-cal-desc"
                        rows={4}
                        {...register("calendar_event_description")}
                        disabled={readOnly}
                        fullWidth
                        placeholder={"Name: {{contact.full_name}}\nEmail: {{contact.email}}\nNotes: {{booking.notes}}"}
                    />
                </Field>
            </SettingsSection>

            <SettingsSection
                title="Template variables"
                description={
                    <>
                        Write variables in double braces, e.g. <span className="font-mono">{"{{contact.first_name}}"}</span> or{" "}
                        <span className="font-mono">{"{{booking.date}}"}</span>. They work in message templates used for booking emails and in the
                        calendar event text, and are filled in for each booking.
                    </>
                }
            >
                <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {BOOKING_TEMPLATE_VARIABLES.map((v) => {
                        const token = `{{${v.key}}}`;
                        return (
                            <li key={v.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-secondary/40">
                                <div className="min-w-0">
                                    <p className="font-mono text-xs text-foreground truncate">{token}</p>
                                    <p className="text-[11px] text-muted">{v.label}</p>
                                </div>
                                <CopyButton value={token} label={token} />
                            </li>
                        );
                    })}
                </ul>
            </SettingsSection>
        </div>
    );
};
