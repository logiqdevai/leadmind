import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Input, TextArea } from "@heroui/react";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { Field, SettingSwitch, SettingsSection } from "./form-fields";
import { QuestionsEditor } from "./questions-editor";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = "#2563EB";

interface BrandingTabProps {
    readOnly: boolean;
}

export const BrandingTab: FC<BrandingTabProps> = ({ readOnly }) => {
    const { control, register, watch, formState } = useFormContext<BookingPageFormValues>();
    const { errors } = formState;
    const logoUrl = watch("logo_url");

    return (
        <div className="space-y-4">
            <SettingsSection title="Look" description="How the public booking page and emails present your brand.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Brand name" htmlFor="bp-brand" error={errors.brand_name?.message} description="Shown above the title on the public page. Leave empty to show nothing.">
                        <Input id="bp-brand" {...register("brand_name")} disabled={readOnly} fullWidth placeholder="e.g. logiqdev" />
                    </Field>
                    <Field label="Primary color" error={errors.primary_color?.message} description="Buttons and highlights on the page and in emails.">
                        <Controller
                            control={control}
                            name="primary_color"
                            render={({ field }) => (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        aria-label="Pick primary color"
                                        value={HEX_COLOR.test(field.value) ? field.value : FALLBACK_COLOR}
                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                        disabled={readOnly}
                                        className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-field-border bg-field-background p-1 disabled:cursor-default"
                                    />
                                    <Input
                                        aria-label="Primary color hex"
                                        value={field.value}
                                        onChange={(e) => field.onChange(e.target.value.trim())}
                                        onBlur={field.onBlur}
                                        placeholder="#2563EB"
                                        disabled={readOnly}
                                        className="font-mono w-32"
                                    />
                                </div>
                            )}
                        />
                    </Field>
                </div>
                <Field label="Logo URL" htmlFor="bp-logo" error={errors.logo_url?.message} description="Public image URL (PNG or SVG). Shown at the top of the page.">
                    <div className="flex items-center gap-3">
                        <Input id="bp-logo" {...register("logo_url")} disabled={readOnly} fullWidth placeholder="https://…/logo.png" />
                        {logoUrl && /^https?:\/\//i.test(logoUrl) ? (
                            <img src={logoUrl} alt="Logo preview" className="h-9 max-w-24 shrink-0 rounded-md border border-border object-contain bg-surface-secondary" />
                        ) : null}
                    </div>
                </Field>
                <Field label="Email button label" htmlFor="bp-cta" error={errors.cta_label?.message} description="Text of the booking button added to emails, e.g. &quot;Book a call&quot;.">
                    <Input id="bp-cta" {...register("cta_label")} disabled={readOnly} fullWidth placeholder="Book a call" />
                </Field>
            </SettingsSection>

            <SettingsSection title="After booking">
                <Field label="Confirmation message" htmlFor="bp-confirm-msg" error={errors.confirmation_message?.message} description="Shown on the page once the booking is made.">
                    <TextArea
                        id="bp-confirm-msg"
                        rows={3}
                        {...register("confirmation_message")}
                        disabled={readOnly}
                        fullWidth
                        placeholder="e.g. Thanks for booking! We will send you the details by email shortly."
                    />
                </Field>
                <Field label="Redirect URL" htmlFor="bp-redirect" error={errors.redirect_url?.message} description="Optional. Send invitees to this page after booking instead of the confirmation screen.">
                    <Input id="bp-redirect" {...register("redirect_url")} disabled={readOnly} fullWidth placeholder="https://yourcompany.com/thanks" />
                </Field>
            </SettingsSection>

            <SettingsSection title="Page options">
                <Controller
                    control={control}
                    name="show_team_member"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Show the team member"
                            description="Tell invitees who they will meet once a time is picked."
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="show_timezone"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Show timezone selector"
                            description="Times are shown in the invitee's detected timezone; this lets them change it."
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="require_phone"
                    render={({ field }) => (
                        <SettingSwitch label="Require a phone number" isSelected={field.value} onChange={field.onChange} isDisabled={readOnly} />
                    )}
                />
            </SettingsSection>

            <SettingsSection
                title="Booking questions"
                description="Extra questions on the booking form. Answers are saved on the booking and shown to your team."
            >
                <QuestionsEditor readOnly={readOnly} />
            </SettingsSection>
        </div>
    );
};
