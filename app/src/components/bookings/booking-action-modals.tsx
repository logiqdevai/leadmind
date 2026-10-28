import { useEffect, useMemo, useState, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Label, Modal, TextArea } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import {
    useAssignBooking,
    useCancelBooking,
    useRescheduleBooking,
    useUpdateBooking,
} from "@/features/bookings/hooks/use-bookings";
import { BookingLocationTypes, type BookingDetail } from "@/features/bookings/interfaces/bookings.interfaces";
import {
    dateKeyInZone,
    formatDateTime,
    timeZoneOffsetLabel,
    zonedTimeToIso,
} from "@/features/bookings/utils/booking-time";
import { isSlotUnavailableError } from "@/features/bookings/utils/booking-api-error";
import { DateKeyPicker, TimeOfDayField } from "./booking-date-time-fields";
import { BookingSlotPicker, type SelectedSlot } from "./booking-slot-picker";
import { OptionSelect, SwitchRow } from "./booking-shared";
import { LOCATION_TYPE_OPTIONS, LOCATION_VALUE_PLACEHOLDERS } from "./utils/booking-options";
import { memberLabel, useBookingMembers } from "./hooks/use-booking-context";
import { bookingDisplayName, timeKeyInZone } from "./utils/booking-display";
import {
    cancelBookingFormSchema,
    editBookingFormSchema,
    type CancelBookingFormValues,
    type EditBookingFormValues,
} from "./validation-schemas/booking-forms.schema";

const FormError: FC<{ message?: string }> = ({ message }) =>
    message ? <p className="text-xs text-danger">{message}</p> : null;

interface BookingActionModalProps {
    booking: BookingDetail;
    timezone: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

// --- Edit details -------------------------------------------------------------

export const EditBookingModal: FC<BookingActionModalProps> = ({ booking, isOpen, onOpenChange }) => {
    const update = useUpdateBooking();
    const form = useForm<EditBookingFormValues>({
        resolver: zodResolver(editBookingFormSchema),
        defaultValues: {
            invitee_name: "",
            invitee_email: "",
            invitee_phone: "",
            invitee_notes: "",
            location_type: BookingLocationTypes.NONE,
            location_value: "",
        },
    });
    const { reset, control, formState } = form;

    useEffect(() => {
        if (!isOpen) return;
        reset({
            invitee_name: booking.invitee_name ?? "",
            invitee_email: booking.invitee_email ?? "",
            invitee_phone: booking.invitee_phone ?? "",
            invitee_notes: booking.invitee_notes ?? "",
            location_type: booking.location_type,
            location_value: booking.location_value ?? "",
        });
    }, [isOpen, booking, reset]);

    const locationPlaceholder = LOCATION_VALUE_PLACEHOLDERS[useWatch({ control, name: "location_type" })];

    const onSubmit = form.handleSubmit((values) => {
        update.mutate(
            {
                uuid: booking.uuid,
                payload: {
                    invitee_name: values.invitee_name,
                    invitee_email: values.invitee_email,
                    invitee_phone: values.invitee_phone,
                    invitee_notes: values.invitee_notes,
                    location_type: values.location_type,
                    location_value: values.location_value,
                },
            },
            { onSuccess: () => onOpenChange(false) },
        );
    });

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Edit booking details</Modal.Heading>
                    </Modal.Header>
                    <Form onSubmit={onSubmit} className="contents">
                        <Modal.Body className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <Label htmlFor="eb-name">Invitee name</Label>
                                    <Input id="eb-name" placeholder="e.g. Jane Smith" {...form.register("invitee_name")} />
                                    <FormError message={formState.errors.invitee_name?.message} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="eb-email">Email</Label>
                                    <Input id="eb-email" type="email" placeholder="name@company.com" {...form.register("invitee_email")} />
                                    <FormError message={formState.errors.invitee_email?.message} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="eb-phone">Phone</Label>
                                    <Input id="eb-phone" type="tel" placeholder="+1 555 123 4567" {...form.register("invitee_phone")} />
                                </div>
                                <Controller
                                    control={control}
                                    name="location_type"
                                    render={({ field }) => (
                                        <OptionSelect
                                            aria-label="Location"
                                            label="Location"
                                            options={LOCATION_TYPE_OPTIONS}
                                            value={field.value}
                                            onChange={(v) => field.onChange(v || BookingLocationTypes.NONE)}
                                        />
                                    )}
                                />
                                {locationPlaceholder ? (
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="eb-location">Location details</Label>
                                        <Input id="eb-location" placeholder={locationPlaceholder} {...form.register("location_value")} />
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="eb-notes">Invitee notes</Label>
                                <TextArea id="eb-notes" rows={3} placeholder="Anything the invitee shared or wants discussed…" {...form.register("invitee_notes")} />
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="justify-end gap-2">
                            <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending type="submit" size="sm" isDisabled={update.isPending} isPending={update.isPending}>
                                Save
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

// --- Reschedule -------------------------------------------------------------

export const RescheduleBookingModal: FC<BookingActionModalProps> = ({ booking, timezone, isOpen, onOpenChange }) => {
    const reschedule = useRescheduleBooking();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const { memberName, currentUserUuid } = useBookingMembers();
    const hasPage = !!booking.booking_page_uuid;

    const [ignoreAvailability, setIgnoreAvailability] = useState(!hasPage);
    const [notify, setNotify] = useState(true);
    const [dateKey, setDateKey] = useState(() => dateKeyInZone(booking.start_at, timezone));
    const [time, setTime] = useState(() => timeKeyInZone(booking.start_at, timezone));
    const [slot, setSlot] = useState<SelectedSlot | null>(null);
    const [error, setError] = useState<string | null>(null);
    // State seeds from props on mount: callers mount this modal only while it is open.

    const usesSlots = hasPage && !ignoreAvailability;
    const canSubmit = usesSlots ? !!slot : !!dateKey && !!time;

    const submit = () => {
        setError(null);
        const startAt = usesSlots ? slot!.start : zonedTimeToIso(dateKey, time, timezone);
        reschedule.mutate(
            {
                uuid: booking.uuid,
                payload: {
                    start_at: startAt,
                    assigned_user_uuid: usesSlots ? slot?.userUuid : undefined,
                    ignore_availability: !usesSlots,
                    notify,
                },
            },
            {
                onSuccess: () => onOpenChange(false),
                onError: (err) => {
                    if (isSlotUnavailableError(err)) {
                        setSlot(null);
                        setError("That time was just taken. Pick another time.");
                    }
                },
            },
        );
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container scroll="outside">
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Reschedule booking</Modal.Heading>
                        <p className="text-xs text-muted">
                            Currently {formatDateTime(booking.start_at, timezone)} · times in {timezone} (
                            {timeZoneOffsetLabel(timezone)})
                        </p>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        {usesSlots && booking.booking_page_uuid ? (
                            <BookingSlotPicker
                                pageUuid={booking.booking_page_uuid}
                                timezone={timezone}
                                dateKey={dateKey}
                                onDateChange={(next) => {
                                    setDateKey(next);
                                    setSlot(null);
                                }}
                                durationMinutes={booking.duration_minutes}
                                excludeBookingUuid={booking.uuid}
                                selected={slot}
                                onSelect={setSlot}
                                memberName={memberName}
                                restrictToUserUuid={isAdmin ? null : currentUserUuid}
                            />
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <DateKeyPicker label="New date" isRequired value={dateKey} onChange={setDateKey} />
                                <TimeOfDayField label="New start time" isRequired value={time} onChange={setTime} />
                            </div>
                        )}
                        {slot ? (
                            <p className="text-xs text-muted">
                                New time: {formatDateTime(slot.start, timezone)}
                                {slot.userUuid ? ` with ${memberName(slot.userUuid)}` : ""}
                            </p>
                        ) : null}
                        <FormError message={error ?? undefined} />
                        {hasPage ? (
                            <SwitchRow
                                label="Ignore availability"
                                description="Pick any date and time, even outside working hours."
                                isSelected={ignoreAvailability}
                                onChange={(v) => {
                                    setIgnoreAvailability(v);
                                    setSlot(null);
                                }}
                            />
                        ) : null}
                        <SwitchRow
                            label="Notify invitee"
                            description="Email the new time to the invitee."
                            isSelected={notify}
                            onChange={setNotify}
                        />
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                        <Button size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={!canSubmit || reschedule.isPending}
                            isPending={reschedule.isPending}
                            onPress={submit}
                        >
                            Reschedule
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

// --- Cancel -------------------------------------------------------------------

export const CancelBookingDialog: FC<BookingActionModalProps> = ({ booking, isOpen, onOpenChange }) => {
    const cancel = useCancelBooking();
    const form = useForm<CancelBookingFormValues>({
        resolver: zodResolver(cancelBookingFormSchema),
        defaultValues: { reason: "", notify: true },
    });

    useEffect(() => {
        if (isOpen) form.reset({ reason: "", notify: true });
    }, [isOpen, form]);

    const confirm = async () => {
        await form.handleSubmit(async (values) => {
            try {
                await cancel.mutateAsync({
                    uuid: booking.uuid,
                    payload: { reason: values.reason || undefined, notify: values.notify },
                });
            } catch {
                // The mutation hook already shows the error toast.
            }
        })();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            title={`Cancel the booking with ${bookingDisplayName(booking)}?`}
            variant="danger"
            confirmLabel="Cancel booking"
            cancelLabel="Keep booking"
            isPending={cancel.isPending}
            onConfirm={confirm}
            description={
                <div className="flex flex-col gap-3 text-left">
                    <p>The time slot is released and the calendar event is removed.</p>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cancel-reason">Reason (optional)</Label>
                        <TextArea id="cancel-reason" rows={3} placeholder="Shared with the invitee" {...form.register("reason")} />
                    </div>
                    <Controller
                        control={form.control}
                        name="notify"
                        render={({ field }) => (
                            <SwitchRow label="Notify invitee" isSelected={field.value} onChange={field.onChange} />
                        )}
                    />
                </div>
            }
        />
    );
};

// --- Reassign -------------------------------------------------------------

export const ReassignBookingModal: FC<BookingActionModalProps> = ({ booking, isOpen, onOpenChange }) => {
    const assign = useAssignBooking();
    const { members } = useBookingMembers();
    // State seeds from props on mount: callers mount this modal only while it is open.
    const [userUuid, setUserUuid] = useState(booking.assigned_user_uuid ?? "");
    const [ignoreAvailability, setIgnoreAvailability] = useState(false);

    const options = useMemo(() => members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) })), [members]);
    const canSubmit = !!userUuid && userUuid !== booking.assigned_user_uuid;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Reassign booking</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Team member</Label>
                            <SearchSelect
                                aria-label="Team member"
                                placeholder="Select a member"
                                searchPlaceholder="Search members…"
                                options={options}
                                value={userUuid}
                                onChange={setUserUuid}
                                fullWidth
                            />
                        </div>
                        <SwitchRow
                            label="Ignore availability"
                            description="Assign even if the member is busy or outside working hours."
                            isSelected={ignoreAvailability}
                            onChange={setIgnoreAvailability}
                        />
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                        <Button size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={!canSubmit || assign.isPending}
                            isPending={assign.isPending}
                            onPress={() =>
                                assign.mutate(
                                    {
                                        uuid: booking.uuid,
                                        payload: { assigned_user_uuid: userUuid, ignore_availability: ignoreAvailability },
                                    },
                                    { onSuccess: () => onOpenChange(false) },
                                )
                            }
                        >
                            Reassign
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
