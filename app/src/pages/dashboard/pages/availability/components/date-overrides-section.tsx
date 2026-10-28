import { useEffect, useMemo, useState, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Chip, Input, Label, Modal } from "@heroui/react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppDatePicker } from "@/components/ui/date-picker";
import { useDeleteAvailabilityOverride, useSaveAvailabilityOverride } from "@/features/bookings/hooks/use-availability";
import type { AvailabilityOverride, AvailabilitySchedule } from "@/features/bookings/interfaces/bookings.interfaces";
import { dateKeyInZone, formatDateKey } from "@/features/bookings/utils/booking-time";
import { DashboardEmptyState } from "@/pages/dashboard/components/dashboard-shared";
import { SettingSwitch, SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import { DEFAULT_PERIOD, formatPeriods } from "@/pages/dashboard/pages/availability/utils/time-ranges";
import {
    dateOverrideSchema,
    type DateOverrideFormValues,
} from "@/pages/dashboard/pages/availability/validation-schemas/availability.schema";
import { PeriodsEditor } from "./periods-editor";

interface OverrideModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editing: AvailabilityOverride | null;
    userUuid: string | undefined;
    minDate: string;
}

const OverrideModal: FC<OverrideModalProps> = ({ isOpen, onOpenChange, editing, userUuid, minDate }) => {
    const saveOverride = useSaveAvailabilityOverride();
    const form = useForm<DateOverrideFormValues>({
        resolver: zodResolver(dateOverrideSchema),
        defaultValues: { date: "", unavailable: true, intervals: [{ ...DEFAULT_PERIOD }], reason: "" },
    });
    const { control, register, reset, formState, handleSubmit, setError } = form;
    const unavailable = useWatch({ control, name: "unavailable" });

    useEffect(() => {
        if (!isOpen) return;
        reset(
            editing
                ? {
                      date: editing.date.slice(0, 10),
                      unavailable: editing.intervals.length === 0,
                      intervals: editing.intervals.length ? editing.intervals : [{ ...DEFAULT_PERIOD }],
                      reason: editing.reason ?? "",
                  }
                : { date: "", unavailable: true, intervals: [{ ...DEFAULT_PERIOD }], reason: "" },
        );
    }, [isOpen, editing, reset]);

    const onSubmit = handleSubmit((v) => {
        // Checked here (not through the picker's min value) so a too-early date explains itself instead of just turning red.
        if (!editing && v.date < minDate) {
            setError("date", { message: "Pick today or a later date" });
            return;
        }
        saveOverride.mutate(
            {
                payload: { date: v.date, intervals: v.unavailable ? [] : v.intervals, reason: v.reason.trim() || undefined },
                userUuid,
            },
            { onSuccess: () => onOpenChange(false) },
        );
    });

    const intervalsError = formState.errors.intervals;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{editing ? "Edit date override" : "Add date override"}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <form id="override-form" onSubmit={onSubmit} noValidate className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Date</Label>
                                <Controller
                                    control={control}
                                    name="date"
                                    render={({ field }) => (
                                        <AppDatePicker
                                            aria-label="Override date"
                                            value={field.value}
                                            onChange={field.onChange}
                                            isDisabled={!!editing}
                                        />
                                    )}
                                />
                                {formState.errors.date ? <p className="text-xs text-danger">{formState.errors.date.message}</p> : null}
                            </div>
                            <Controller
                                control={control}
                                name="unavailable"
                                render={({ field }) => (
                                    <SettingSwitch
                                        label="Unavailable all day"
                                        description="Turn off to set different working hours for this date instead."
                                        isSelected={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                            {!unavailable ? (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Available</Label>
                                    <Controller
                                        control={control}
                                        name="intervals"
                                        render={({ field }) => (
                                            <PeriodsEditor
                                                label="Override"
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={intervalsError?.message ?? intervalsError?.root?.message}
                                            />
                                        )}
                                    />
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="override-reason">Reason</Label>
                                <Input id="override-reason" {...register("reason")} placeholder="e.g. Conference, half day" />
                                <p className="text-xs text-muted">Internal only.</p>
                            </div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending type="submit" form="override-form" isPending={saveOverride.isPending} isDisabled={saveOverride.isPending}>
                            Save
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

interface DateOverridesSectionProps {
    schedule: AvailabilitySchedule;
    userUuid: string | undefined;
    canEdit: boolean;
}

export const DateOverridesSection: FC<DateOverridesSectionProps> = ({ schedule, userUuid, canEdit }) => {
    const deleteOverride = useDeleteAvailabilityOverride();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AvailabilityOverride | null>(null);
    const [toDelete, setToDelete] = useState<AvailabilityOverride | null>(null);

    const today = dateKeyInZone(new Date(), schedule.timezone);
    const upcoming = useMemo(
        () =>
            schedule.overrides
                .filter((o) => o.date.slice(0, 10) >= today)
                .sort((a, b) => a.date.localeCompare(b.date)),
        [schedule.overrides, today],
    );

    return (
        <SettingsSection
            title="Date overrides"
            description="Change the hours for specific dates, e.g. a day off or a late start. Overrides replace the weekly hours for that date."
            actions={
                canEdit ? (
                    <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                            setEditing(null);
                            setModalOpen(true);
                        }}
                    >
                        <Plus className="size-3.5" />
                        Add override
                    </Button>
                ) : null
            }
        >
            {upcoming.length === 0 ? (
                <DashboardEmptyState icon={CalendarClock} title="No upcoming overrides" body="Every date follows the weekly hours." />
            ) : (
                <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                    {upcoming.map((o) => (
                        <li key={o.uuid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-foreground">{formatDateKey(o.date.slice(0, 10))}</p>
                                {o.reason ? <p className="text-xs text-muted truncate">{o.reason}</p> : null}
                            </div>
                            {o.intervals.length === 0 ? (
                                <Chip size="sm" variant="soft" color="danger">
                                    <Chip.Label>Unavailable</Chip.Label>
                                </Chip>
                            ) : (
                                <span className="text-xs text-foreground tabular-nums">{formatPeriods(o.intervals)}</span>
                            )}
                            {canEdit ? (
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        aria-label="Edit override"
                                        onPress={() => {
                                            setEditing(o);
                                            setModalOpen(true);
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button size="sm" variant="tertiary" aria-label="Delete override" onPress={() => setToDelete(o)}>
                                        <Trash2 className="size-4 text-danger" />
                                    </Button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}

            {canEdit ? (
                <>
                    <OverrideModal isOpen={modalOpen} onOpenChange={setModalOpen} editing={editing} userUuid={userUuid} minDate={today} />
                    <ConfirmDialog
                        isOpen={!!toDelete}
                        onOpenChange={(open) => {
                            if (!open) setToDelete(null);
                        }}
                        title="Remove this override?"
                        description="The date goes back to the weekly working hours."
                        confirmLabel="Remove"
                        variant="danger"
                        isPending={deleteOverride.isPending}
                        onConfirm={async () => {
                            if (!toDelete) return;
                            await deleteOverride.mutateAsync(toDelete.uuid);
                            setToDelete(null);
                        }}
                    />
                </>
            ) : null}
        </SettingsSection>
    );
};
