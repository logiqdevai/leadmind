import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input, TextArea } from "@heroui/react";
import { BookingLocationTypes } from "@/features/bookings/interfaces/bookings.interfaces";
import { BOOKING_LOCATION_LABELS } from "@/features/bookings/constants/booking-labels";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { Field, SettingSwitch, SettingsSection, SimpleSelect } from "./form-fields";

const LOCATION_DESCRIPTIONS: Record<BookingPageFormValues["location_type"], string> = {
    [BookingLocationTypes.NONE]: "No location is shown or added to the invite.",
    [BookingLocationTypes.GOOGLE_MEET]: "A Google Meet link is created on the assigned member's calendar.",
    [BookingLocationTypes.PHONE]: "You call the invitee on the phone number they leave.",
    [BookingLocationTypes.IN_PERSON]: "Meet at an address you enter below.",
    [BookingLocationTypes.CUSTOM]: "Any other instructions, e.g. a Zoom link or dial-in.",
};

const LOCATION_OPTIONS = (Object.keys(BOOKING_LOCATION_LABELS) as BookingPageFormValues["location_type"][]).map(
    (id) => ({ id, label: BOOKING_LOCATION_LABELS[id], description: LOCATION_DESCRIPTIONS[id] }),
);

interface GeneralTabProps {
    readOnly: boolean;
}

export const GeneralTab: FC<GeneralTabProps> = ({ readOnly }) => {
    const { register, control, watch, formState } = useFormContext<BookingPageFormValues>();
    const { errors } = formState;
    const locationType = watch("location_type");
    const needsValue =
        locationType === BookingLocationTypes.IN_PERSON || locationType === BookingLocationTypes.CUSTOM;

    return (
        <div className="space-y-4">
            <SettingsSection title="Basics" description="How this appointment type is named internally and on the public page.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" htmlFor="bp-name" required error={errors.name?.message} description="Internal name, shown in lists and the calendar.">
                        <Input id="bp-name" {...register("name")} disabled={readOnly} fullWidth />
                    </Field>
                    <Field
                        label="Slug"
                        htmlFor="bp-slug"
                        required
                        error={errors.slug?.message}
                        description="Lowercase letters, numbers and dashes. Used in the page URL."
                    >
                        <Input id="bp-slug" {...register("slug")} disabled={readOnly} fullWidth className="font-mono" />
                    </Field>
                </div>
                <Field label="Public title" htmlFor="bp-title" error={errors.title?.message} description="Heading invitees see. Falls back to the name.">
                    <Input id="bp-title" {...register("title")} disabled={readOnly} fullWidth placeholder="e.g. 30 minute intro call" />
                </Field>
                <Field label="Description" htmlFor="bp-description" error={errors.description?.message}>
                    <TextArea id="bp-description" rows={3} {...register("description")} disabled={readOnly} fullWidth />
                </Field>
                <Field
                    label="Intro text"
                    htmlFor="bp-intro"
                    error={errors.intro_text?.message}
                    description="Short welcome text shown above the calendar."
                >
                    <TextArea id="bp-intro" rows={3} {...register("intro_text")} disabled={readOnly} fullWidth />
                </Field>
            </SettingsSection>

            <SettingsSection title="Status">
                <Controller
                    control={control}
                    name="is_active"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Published"
                            description={
                                field.value
                                    ? "Invitees can book through this page and its links."
                                    : "Deactivated: links show the page as unavailable and no new bookings are accepted."
                            }
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="is_default"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Default booking page"
                            description="Used for {{booking_link}} when an email or template picks no page. Only one page can be the default."
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
            </SettingsSection>

            <SettingsSection title="Location" description="Where the meeting happens. Shown on the page, in emails and in the calendar event.">
                <Field label="Location type">
                    <Controller
                        control={control}
                        name="location_type"
                        render={({ field }) => (
                            <SimpleSelect
                                aria-label="Location type"
                                options={LOCATION_OPTIONS}
                                value={field.value}
                                onChange={(v) => field.onChange(v as BookingPageFormValues["location_type"])}
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
                <p className="text-xs text-muted">{LOCATION_DESCRIPTIONS[locationType]}</p>
                {locationType !== BookingLocationTypes.NONE && locationType !== BookingLocationTypes.GOOGLE_MEET ? (
                    <Field
                        label={locationType === BookingLocationTypes.IN_PERSON ? "Address" : locationType === BookingLocationTypes.PHONE ? "Phone details" : "Location details"}
                        htmlFor="bp-location-value"
                        required={needsValue}
                        error={errors.location_value?.message}
                        description={locationType === BookingLocationTypes.PHONE ? "Optional, e.g. \"We will call you\" or a number to call." : undefined}
                    >
                        <Input id="bp-location-value" {...register("location_value")} disabled={readOnly} fullWidth />
                    </Field>
                ) : null}
            </SettingsSection>
        </div>
    );
};
