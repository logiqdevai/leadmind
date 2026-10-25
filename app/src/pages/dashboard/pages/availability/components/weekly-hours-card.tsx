import { useEffect, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Switch } from "@heroui/react";
import { Copy } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SearchSelect } from "@/components/ui/search-select";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { useSaveAvailabilitySchedule } from "@/features/bookings/hooks/use-availability";
import type { AvailabilitySchedule } from "@/features/bookings/interfaces/bookings.interfaces";
import { cn } from "@/lib/utils";
import { SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import {
    WEEKDAY_LABELS,
    daysToWeeklyHours,
    weeklyHoursToDays,
} from "@/pages/dashboard/pages/availability/utils/time-ranges";
import {
    weeklyScheduleSchema,
    type WeeklyScheduleFormValues,
} from "@/pages/dashboard/pages/availability/validation-schemas/availability.schema";
import { PeriodsEditor } from "./periods-editor";

const TIMEZONE_SELECT_OPTIONS = TimezoneOptions.map((o) => ({ id: o.value, label: o.label }));

const toFormValues = (schedule: AvailabilitySchedule): WeeklyScheduleFormValues => ({
    timezone: schedule.timezone,
    days: weeklyHoursToDays(schedule.weekly_hours),
});

interface WeeklyHoursCardProps {
    schedule: AvailabilitySchedule;
    /** undefined = the signed-in member. */
    userUuid: string | undefined;
    canEdit: boolean;
    memberLabel: string;
}

export const WeeklyHoursCard: FC<WeeklyHoursCardProps> = ({ schedule, userUuid, canEdit, memberLabel }) => {
    const saveSchedule = useSaveAvailabilitySchedule();
    const form = useForm<WeeklyScheduleFormValues>({
        resolver: zodResolver(weeklyScheduleSchema),
        defaultValues: toFormValues(schedule),
    });
    const { control, reset, setValue, getValues, formState, handleSubmit } = form;

    useEffect(() => {
        reset(toFormValues(schedule));
    }, [schedule, reset]);

    const days = useWatch({ control, name: "days" });

    const copyMondayToWeekdays = () => {
        const monday = getValues("days.0");
        for (let i = 1; i < 5; i += 1) {
            setValue(
                `days.${i}`,
                { day: i + 1, enabled: monday.enabled, periods: monday.periods.map((p) => ({ ...p })) },
                { shouldDirty: true, shouldValidate: formState.isSubmitted },
            );
        }
    };

    const onSubmit = handleSubmit((values) => {
        saveSchedule.mutate({
            payload: { timezone: values.timezone, weekly_hours: daysToWeeklyHours(values.days) },
            userUuid,
        });
    });

    return (
        <form onSubmit={onSubmit} noValidate>
            <SettingsSection
                title="Weekly working hours"
                description={`When ${memberLabel} can be booked. Booking pages only offer times inside these hours.`}
                actions={
                    canEdit ? (
                        <Button size="sm" variant="tertiary" onPress={copyMondayToWeekdays}>
                            <Copy className="size-3.5" />
                            Copy Monday to weekdays
                        </Button>
                    ) : null
                }
            >
                {schedule.is_default ? (
                    <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-foreground">
                        These are the default hours (Monday to Friday, 9:00 to 17:00). They apply until {memberLabel === "you" ? "you save" : "this schedule is saved"}.
                    </p>
                ) : null}

                <div className="flex flex-col gap-1.5 sm:max-w-md">
                    <span className="text-sm font-medium text-foreground">Timezone</span>
                    <Controller
                        control={control}
                        name="timezone"
                        render={({ field }) => (
                            <SearchSelect
                                aria-label="Timezone"
                                options={TIMEZONE_SELECT_OPTIONS}
                                value={field.value}
                                onChange={field.onChange}
                                searchPlaceholder="Search timezones…"
                                isDisabled={!canEdit}
                                fullWidth
                            />
                        )}
                    />
                    <p className="text-xs text-muted">Working hours, date overrides and blocked time below are in this timezone.</p>
                </div>

                <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                    {days.map((d, index) => {
                        const dayError = formState.errors.days?.[index]?.periods;
                        const message = dayError?.message ?? dayError?.root?.message;
                        return (
                            <li key={d.day} className="grid gap-2 px-3 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
                                <Controller
                                    control={control}
                                    name={`days.${index}.enabled`}
                                    render={({ field }) => (
                                        <Switch
                                            isSelected={field.value}
                                            onChange={(v) => field.onChange(typeof v === "boolean" ? v : !field.value)}
                                            isDisabled={!canEdit}
                                            aria-label={`${WEEKDAY_LABELS[d.day]} available`}
                                            className="pt-1"
                                        >
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                            <span className={cn("text-sm", field.value ? "text-foreground font-medium" : "text-muted")}>
                                                {WEEKDAY_LABELS[d.day]}
                                            </span>
                                        </Switch>
                                    )}
                                />
                                {d.enabled ? (
                                    <Controller
                                        control={control}
                                        name={`days.${index}.periods`}
                                        render={({ field }) => (
                                            <PeriodsEditor
                                                label={WEEKDAY_LABELS[d.day]}
                                                value={field.value}
                                                onChange={field.onChange}
                                                isDisabled={!canEdit}
                                                error={message}
                                            />
                                        )}
                                    />
                                ) : (
                                    <p className="pt-1.5 text-sm text-muted">Unavailable</p>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {canEdit ? (
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="tertiary"
                            isDisabled={!formState.isDirty || saveSchedule.isPending}
                            onPress={() => reset(toFormValues(schedule))}
                        >
                            Discard
                        </Button>
                        <ActionButtonWithPending
                            type="submit"
                            isPending={saveSchedule.isPending}
                            isDisabled={saveSchedule.isPending || (!formState.isDirty && !schedule.is_default)}
                        >
                            Save working hours
                        </ActionButtonWithPending>
                    </div>
                ) : null}
            </SettingsSection>
        </form>
    );
};
