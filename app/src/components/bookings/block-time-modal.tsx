import { useEffect, useMemo, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Label, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SearchSelect } from "@/components/ui/search-select";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { useCreateBookingBlock } from "@/features/bookings/hooks/use-availability";
import type { CreateBookingBlockDto } from "@/features/bookings/interfaces/bookings.interfaces";
import { addDays, dateKeyInZone, timeZoneOffsetLabel, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import { DateKeyPicker, TimeOfDayField } from "./booking-date-time-fields";
import { memberLabel, useBookingMembers, useBookingTimezone } from "./hooks/use-booking-context";
import { timeKeyInZone } from "./utils/booking-display";
import {
    BLOCK_ORGANISATION_WIDE,
    blockTimeFormSchema,
    type BlockTimeFormValues,
} from "./validation-schemas/booking-forms.schema";

interface BlockTimeModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Prefills the start (ISO instant); end defaults to one hour later. */
    initialStart?: string | null;
}

const FormError: FC<{ message?: string }> = ({ message }) =>
    message ? <p className="text-xs text-danger">{message}</p> : null;

/** Marks a period as unavailable for bookings (for yourself, a member, or the whole organisation). */
export const BlockTimeModal: FC<BlockTimeModalProps> = ({ isOpen, onOpenChange, initialStart }) => {
    const timezone = useBookingTimezone();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const { members, currentUserUuid, memberName } = useBookingMembers();
    const createBlock = useCreateBookingBlock();

    const buildDefaults = (): BlockTimeFormValues => {
        const start = initialStart ? new Date(initialStart) : null;
        const end = start ? new Date(start.getTime() + 60 * 60_000) : null;
        const today = dateKeyInZone(new Date(), timezone);
        return {
            start_date: start ? dateKeyInZone(start, timezone) : today,
            start_time: start ? timeKeyInZone(start, timezone) : "09:00",
            end_date: end ? dateKeyInZone(end, timezone) : today,
            end_time: end ? timeKeyInZone(end, timezone) : "17:00",
            reason: "",
            target: currentUserUuid ?? "",
        };
    };

    const form = useForm<BlockTimeFormValues>({
        resolver: zodResolver(blockTimeFormSchema),
        defaultValues: buildDefaults(),
    });
    const { control, reset, formState, setValue } = form;

    useEffect(() => {
        if (isOpen) reset(buildDefaults());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialStart, timezone, currentUserUuid]);

    const [startDate, endDate] = useWatch({ control, name: ["start_date", "end_date"] });

    const targetOptions = useMemo(() => {
        const options = [{ id: BLOCK_ORGANISATION_WIDE, label: "Everyone (organisation-wide)" }];
        for (const m of members) {
            options.push({ id: m.user_uuid, label: m.user_uuid === currentUserUuid ? `${memberLabel(m)} (me)` : memberLabel(m) });
        }
        return options;
    }, [members, currentUserUuid]);

    const onSubmit = form.handleSubmit((values) => {
        const payload: CreateBookingBlockDto = {
            start_at: zonedTimeToIso(values.start_date, values.start_time, timezone),
            end_at: zonedTimeToIso(values.end_date, values.end_time, timezone),
            reason: values.reason || undefined,
        };
        if (values.target === BLOCK_ORGANISATION_WIDE) payload.organisation_wide = true;
        else if (values.target && values.target !== currentUserUuid) payload.user_uuid = values.target;
        createBlock.mutate(payload, { onSuccess: () => onOpenChange(false) });
    });

    const errors = formState.errors;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Block time</Modal.Heading>
                        <p className="text-xs text-muted">
                            No bookings can be made in this period. Times in {timezone} ({timeZoneOffsetLabel(timezone)}).
                        </p>
                    </Modal.Header>
                    <Form onSubmit={onSubmit} className="contents">
                        <Modal.Body className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Controller
                                    control={control}
                                    name="start_date"
                                    render={({ field }) => (
                                        <DateKeyPicker
                                            label="Start date"
                                            isRequired
                                            value={field.value}
                                            onChange={(v) => {
                                                field.onChange(v);
                                                if (endDate < v) setValue("end_date", v);
                                            }}
                                        />
                                    )}
                                />
                                <Controller
                                    control={control}
                                    name="start_time"
                                    render={({ field }) => (
                                        <TimeOfDayField label="Start time" isRequired value={field.value} onChange={field.onChange} />
                                    )}
                                />
                                <Controller
                                    control={control}
                                    name="end_date"
                                    render={({ field }) => (
                                        <DateKeyPicker
                                            label="End date"
                                            isRequired
                                            value={field.value}
                                            minValue={startDate}
                                            onChange={field.onChange}
                                        />
                                    )}
                                />
                                <div className="flex flex-col gap-1.5">
                                    <Controller
                                        control={control}
                                        name="end_time"
                                        render={({ field }) => (
                                            <TimeOfDayField label="End time" isRequired value={field.value} onChange={field.onChange} />
                                        )}
                                    />
                                    <FormError message={errors.end_time?.message} />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => {
                                        setValue("start_time", "00:00");
                                        setValue("end_date", addDays(startDate, 1));
                                        setValue("end_time", "00:00");
                                    }}
                                >
                                    Whole day
                                </Button>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="block-reason">Reason</Label>
                                <Input id="block-reason" placeholder="e.g. Holiday, team offsite" {...form.register("reason")} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label>Unavailable</Label>
                                {isAdmin ? (
                                    <Controller
                                        control={control}
                                        name="target"
                                        render={({ field }) => (
                                            <SearchSelect
                                                aria-label="Who is unavailable"
                                                searchPlaceholder="Search members…"
                                                options={targetOptions}
                                                value={field.value}
                                                onChange={field.onChange}
                                                fullWidth
                                            />
                                        )}
                                    />
                                ) : (
                                    <p className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-foreground">
                                        {memberName(currentUserUuid)} (me)
                                    </p>
                                )}
                                <FormError message={errors.target?.message} />
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="justify-end gap-2">
                            <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                type="submit"
                                size="sm"
                                isDisabled={createBlock.isPending}
                                isPending={createBlock.isPending}
                            >
                                Block time
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
