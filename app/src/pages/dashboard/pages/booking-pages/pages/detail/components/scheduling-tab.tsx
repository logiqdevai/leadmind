import type { FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { BOOKING_DURATION_PRESETS } from "@/features/bookings/constants/booking-labels";
import { BookingUnavailableSlotsModes } from "@/features/bookings/interfaces/bookings.interfaces";
import { formatDuration } from "@/features/bookings/utils/booking-time";
import { cn } from "@/lib/utils";
import type { BookingPageFormValues } from "@/pages/dashboard/pages/booking-pages/pages/detail/validation-schemas/booking-page.schema";
import { Field, NumberInput, SettingSwitch, SettingsSection } from "./form-fields";
import { MinutesSpanInput, PresetMultiPicker, PresetSinglePicker } from "./preset-pickers";

const DURATION_PRESETS = BOOKING_DURATION_PRESETS.map((m) => ({ value: m, label: formatDuration(m) }));
const ADVANCE_PRESETS = [30, 60, 90].map((d) => ({ value: d, label: `${d} days` }));
const NOTICE_PRESETS = [0, 60, 240, 1440, 2880].map((m) => ({
    value: m,
    label: m === 0 ? "None" : m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : `${m / 60} h`,
}));

const UNAVAILABLE_SLOT_MODES: { id: BookingPageFormValues["unavailable_slots_mode"]; label: string; description: string }[] = [
    {
        id: BookingUnavailableSlotsModes.HIDE,
        label: "Hide them",
        description:
            "Only bookable times are listed. Visitors can't tell which times are taken, so the team's schedule stays private.",
    },
    {
        id: BookingUnavailableSlotsModes.SHOW_DISABLED,
        label: "Show them disabled",
        description:
            "Taken times stay in the list, greyed out and not clickable. Visitors can see how busy the team is. Days with no bookable time stay unselectable.",
    },
];

interface NullableNumberProps {
    value: number | null;
    onChange: (v: number | null) => void;
    label: string;
    emptyLabel: string;
    suffix: string;
    minValue?: number;
    isDisabled: boolean;
}

/** Number that may be left empty (= no limit); shows what empty means. */
const NullableNumber: FC<NullableNumberProps> = ({ value, onChange, label, emptyLabel, suffix, minValue = 0, isDisabled }) => (
    <div className="flex flex-wrap items-center gap-2">
        <NumberInput aria-label={label} value={value} onChange={onChange} minValue={minValue} suffix={suffix} isDisabled={isDisabled} />
        {value == null ? <span className="text-xs text-muted">({emptyLabel})</span> : null}
    </div>
);

interface SchedulingTabProps {
    readOnly: boolean;
}

export const SchedulingTab: FC<SchedulingTabProps> = ({ readOnly }) => {
    const { control, watch, formState } = useFormContext<BookingPageFormValues>();
    const { errors } = formState;
    const duration = watch("duration_minutes");
    const allowCancellation = watch("allow_cancellation");
    const allowReschedule = watch("allow_reschedule");

    return (
        <div className="space-y-4">
            <SettingsSection title="Duration" description="How long meetings last. Offer extra durations to let invitees choose.">
                <Field label="Default duration" error={errors.duration_minutes?.message}>
                    <Controller
                        control={control}
                        name="duration_minutes"
                        render={({ field }) => (
                            <PresetSinglePicker
                                aria-label="Default duration"
                                presets={DURATION_PRESETS}
                                value={field.value}
                                onChange={field.onChange}
                                minValue={5}
                                maxValue={720}
                                suffix="minutes"
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
                <Field
                    label="Durations invitees can choose"
                    error={errors.duration_options?.message}
                    description="The default duration is always offered. Pick more to show a duration selector on the page."
                >
                    <Controller
                        control={control}
                        name="duration_options"
                        render={({ field }) => (
                            <PresetMultiPicker
                                aria-label="durations"
                                presets={DURATION_PRESETS}
                                value={[...new Set([duration, ...field.value])]}
                                onChange={(next) => field.onChange(next.filter((v) => v !== duration))}
                                lockedValue={duration}
                                formatLabel={formatDuration}
                                customSuffix="minutes"
                                minValue={5}
                                maxValue={720}
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
                <Field
                    label="Slot interval"
                    error={errors.slot_interval_minutes?.message}
                    description="How often start times are offered, e.g. every 15 minutes. Leave empty to use the meeting duration."
                >
                    <Controller
                        control={control}
                        name="slot_interval_minutes"
                        render={({ field }) => (
                            <NullableNumber
                                label="Slot interval"
                                value={field.value}
                                onChange={field.onChange}
                                minValue={5}
                                suffix="minutes"
                                emptyLabel="same as duration"
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
            </SettingsSection>

            <SettingsSection title="Booking window" description="When invitees can book, relative to now.">
                <Field label="Minimum notice" error={errors.min_notice_minutes?.message} description="Invitees can't book a slot that starts sooner than this.">
                    <Controller
                        control={control}
                        name="min_notice_minutes"
                        render={({ field }) => (
                            <PresetSinglePicker
                                aria-label="Minimum notice"
                                presets={NOTICE_PRESETS}
                                value={field.value}
                                onChange={field.onChange}
                                minValue={0}
                                suffix="minutes"
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
                <Field label="Book up to" error={errors.max_advance_days?.message} description="How far into the future the calendar is open.">
                    <Controller
                        control={control}
                        name="max_advance_days"
                        render={({ field }) => (
                            <PresetSinglePicker
                                aria-label="Maximum days in advance"
                                presets={ADVANCE_PRESETS}
                                value={field.value}
                                onChange={field.onChange}
                                minValue={1}
                                maxValue={730}
                                suffix="days ahead"
                                isDisabled={readOnly}
                            />
                        )}
                    />
                </Field>
            </SettingsSection>

            <SettingsSection title="Spacing and limits" description="Applied per team member, across all booking pages they take part in.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Buffer before" error={errors.buffer_before_minutes?.message} description="Free time kept before each meeting.">
                        <Controller
                            control={control}
                            name="buffer_before_minutes"
                            render={({ field }) => (
                                <NumberInput aria-label="Buffer before" value={field.value} onChange={(v) => field.onChange(v ?? 0)} suffix="minutes" isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                    <Field label="Buffer after" error={errors.buffer_after_minutes?.message} description="Free time kept after each meeting.">
                        <Controller
                            control={control}
                            name="buffer_after_minutes"
                            render={({ field }) => (
                                <NumberInput aria-label="Buffer after" value={field.value} onChange={(v) => field.onChange(v ?? 0)} suffix="minutes" isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                    <Field label="Minimum gap between meetings" error={errors.min_gap_minutes?.message}>
                        <Controller
                            control={control}
                            name="min_gap_minutes"
                            render={({ field }) => (
                                <NumberInput aria-label="Minimum gap" value={field.value} onChange={(v) => field.onChange(v ?? 0)} suffix="minutes" isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                    <Field
                        label="Maximum gap between meetings"
                        error={errors.max_gap_minutes?.message}
                        description="Only offer slots close to existing meetings that day, to keep the schedule compact."
                    >
                        <Controller
                            control={control}
                            name="max_gap_minutes"
                            render={({ field }) => (
                                <NullableNumber label="Maximum gap" value={field.value} onChange={field.onChange} suffix="minutes" emptyLabel="no limit" isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                    <Field label="Max bookings per day" error={errors.max_bookings_per_day?.message} description="Per team member.">
                        <Controller
                            control={control}
                            name="max_bookings_per_day"
                            render={({ field }) => (
                                <NullableNumber
                                    label="Max bookings per day"
                                    value={field.value}
                                    onChange={field.onChange}
                                    minValue={1}
                                    suffix="bookings"
                                    emptyLabel="no limit"
                                    isDisabled={readOnly}
                                />
                            )}
                        />
                    </Field>
                    <Field label="Seats per slot" error={errors.seats_per_slot?.message} description="More than 1 lets several invitees book the same time (group sessions).">
                        <Controller
                            control={control}
                            name="seats_per_slot"
                            render={({ field }) => (
                                <NumberInput aria-label="Seats per slot" value={field.value} onChange={(v) => field.onChange(v ?? 1)} minValue={1} suffix="invitees" isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                </div>
                <Controller
                    control={control}
                    name="requires_confirmation"
                    render={({ field }) => (
                        <SettingSwitch
                            label="Require confirmation"
                            description="New bookings stay pending until a team member confirms them. The slot is held meanwhile."
                            isSelected={field.value}
                            onChange={field.onChange}
                            isDisabled={readOnly}
                        />
                    )}
                />
            </SettingsSection>

            <SettingsSection
                title="Unavailable times"
                description="How the public booking page treats start times that are inside working hours but can't be booked (already booked, blocked, within a buffer, too soon, or the day is full)."
            >
                <Controller
                    control={control}
                    name="unavailable_slots_mode"
                    render={({ field }) => (
                        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Unavailable times">
                            {UNAVAILABLE_SLOT_MODES.map((mode) => {
                                const selected = field.value === mode.id;
                                return (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={readOnly}
                                        onClick={() => field.onChange(mode.id)}
                                        className={cn(
                                            "rounded-xl border p-3 text-left transition-colors duration-200",
                                            selected ? "border-accent/60 bg-accent/10" : "border-border bg-surface-secondary/20",
                                            !readOnly && !selected && "hover:bg-surface-secondary cursor-pointer",
                                        )}
                                    >
                                        <p className="text-sm font-semibold text-foreground">{mode.label}</p>
                                        <p className="mt-1 text-xs text-muted">{mode.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                />
            </SettingsSection>

            <SettingsSection title="Cancellation and rescheduling" description="What invitees can do from the link in their confirmation email.">
                <Controller
                    control={control}
                    name="allow_cancellation"
                    render={({ field }) => (
                        <SettingSwitch label="Invitees can cancel" isSelected={field.value} onChange={field.onChange} isDisabled={readOnly} />
                    )}
                />
                {allowCancellation ? (
                    <div className="space-y-3 pl-1">
                        <Field label="Cancellation deadline" error={errors.cancellation_deadline_minutes?.message} description="No self-service cancelling closer to the start than this. 0 = any time.">
                            <Controller
                                control={control}
                                name="cancellation_deadline_minutes"
                                render={({ field }) => (
                                    <MinutesSpanInput aria-label="Cancellation deadline" value={field.value} onChange={field.onChange} isDisabled={readOnly} />
                                )}
                            />
                        </Field>
                        <Controller
                            control={control}
                            name="require_cancellation_reason"
                            render={({ field }) => (
                                <SettingSwitch label="Ask for a cancellation reason" isSelected={field.value} onChange={field.onChange} isDisabled={readOnly} />
                            )}
                        />
                    </div>
                ) : null}
                <Controller
                    control={control}
                    name="allow_reschedule"
                    render={({ field }) => (
                        <SettingSwitch label="Invitees can reschedule" isSelected={field.value} onChange={field.onChange} isDisabled={readOnly} />
                    )}
                />
                {allowReschedule ? (
                    <Field label="Reschedule deadline" error={errors.reschedule_deadline_minutes?.message} description="No self-service rescheduling closer to the start than this. 0 = any time.">
                        <Controller
                            control={control}
                            name="reschedule_deadline_minutes"
                            render={({ field }) => (
                                <MinutesSpanInput aria-label="Reschedule deadline" value={field.value} onChange={field.onChange} isDisabled={readOnly} />
                            )}
                        />
                    </Field>
                ) : null}
            </SettingsSection>
        </div>
    );
};
