import { useEffect, useMemo, useState, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Label, Modal, TextArea, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { SearchSelect } from "@/components/ui/search-select";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { useCreateBooking } from "@/features/bookings/hooks/use-bookings";
import { useBookingPages } from "@/features/bookings/hooks/use-booking-pages";
import { BOOKING_DURATION_PRESETS } from "@/features/bookings/constants/booking-labels";
import {
    BookingLocationTypes,
    type BookingPage,
    type CreateBookingDto,
} from "@/features/bookings/interfaces/bookings.interfaces";
import {
    dateKeyInZone,
    formatDateTime,
    formatDuration,
    timeZoneOffsetLabel,
    zonedTimeToIso,
} from "@/features/bookings/utils/booking-time";
import { isSlotUnavailableError } from "@/features/bookings/utils/booking-api-error";
import { DateKeyPicker, TimeOfDayField } from "./booking-date-time-fields";
import { BookingSlotPicker } from "./booking-slot-picker";
import { DayAvailability } from "./day-availability";
import { OptionSelect, SwitchRow } from "./booking-shared";
import { LOCATION_TYPE_OPTIONS, LOCATION_VALUE_PLACEHOLDERS } from "./utils/booking-options";
import { ContactSearchPicker, type PickedContact } from "./contact-search-picker";
import { memberLabel, useBookingMembers, useBookingTimezone } from "./hooks/use-booking-context";
import { timeKeyInZone } from "./utils/booking-display";
import {
    CreateBookingInviteeModes,
    CreateBookingTimeModes,
    createBookingFormSchema,
    type CreateBookingFormValues,
} from "./validation-schemas/booking-forms.schema";

const AUTOMATIC = "";

interface CreateBookingModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Prefills (and locks) the invitee to this contact. */
    contact?: PickedContact | null;
    /** Prefills a custom start time (e.g. from clicking an empty calendar cell). */
    initialStart?: string | null;
    /** Prefills the booking page. */
    initialPageUuid?: string | null;
    onCreated?: (bookingUuid: string) => void;
    /** Lets a taken slot in the picker open the booking that occupies it. */
    onOpenBooking?: (bookingUuid: string) => void;
}

const FormError: FC<{ message?: string }> = ({ message }) =>
    message ? <p className="text-xs text-danger">{message}</p> : null;

function buildDefaults(
    currentUserUuid: string | null | undefined,
    timezone: string,
    pages: BookingPage[],
    contact: PickedContact | null | undefined,
    initialStart: string | null | undefined,
    initialPageUuid: string | null | undefined,
): CreateBookingFormValues {
    const activePages = pages.filter((p) => p.is_active);
    const page =
        activePages.find((p) => p.uuid === initialPageUuid) ??
        (initialStart ? undefined : (activePages.find((p) => p.is_default) ?? undefined));
    const start = initialStart ? new Date(initialStart) : new Date(Date.now() + 60 * 60_000);
    return {
        invitee_mode: CreateBookingInviteeModes.CONTACT,
        contact_uuid: contact?.uuid ?? "",
        invitee_name: "",
        invitee_email: "",
        invitee_phone: "",
        booking_page_uuid: page?.uuid ?? "",
        time_mode: initialStart ? CreateBookingTimeModes.CUSTOM : CreateBookingTimeModes.SLOT,
        slot_start: "",
        slot_user_uuid: "",
        date: dateKeyInZone(start, timezone),
        time: initialStart ? timeKeyInZone(start, timezone) : "09:00",
        duration_minutes: page?.duration_minutes ?? 30,
        // Whoever is making the booking owns it unless they pick someone else.
        assigned_user_uuid: currentUserUuid ?? AUTOMATIC,
        ignore_availability: true,
        location_type: page?.location_type ?? BookingLocationTypes.NONE,
        location_value: page?.location_value ?? "",
        internal_notes: "",
        notify: true,
    };
}

export const CreateBookingModal: FC<CreateBookingModalProps> = ({
    isOpen,
    onOpenChange,
    contact,
    initialStart,
    initialPageUuid,
    onCreated,
    onOpenBooking,
}) => {
    const timezone = useBookingTimezone();
    const isAdmin = useOrganisationPermission("org_manage_bookings");
    const { members, memberName, currentUserUuid } = useBookingMembers();
    const { data: pages = [] } = useBookingPages();
    const createBooking = useCreateBooking();

    const form = useForm<CreateBookingFormValues>({
        resolver: zodResolver(createBookingFormSchema),
        defaultValues: buildDefaults(currentUserUuid, timezone, pages, contact, initialStart, initialPageUuid),
    });
    const { control, setValue, formState, reset, setError } = form;

    const pickedContactValue = contact ?? null;
    const contactPrefilled = !!pickedContactValue;

    useEffect(() => {
        if (!isOpen) return;
        reset(buildDefaults(currentUserUuid, timezone, pages, contact, initialStart, initialPageUuid));
        // Pages load async; only re-seed when the modal opens or its prefills change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, contact?.uuid, initialStart, initialPageUuid, timezone, currentUserUuid]);

    const [inviteeMode, pageUuid, timeMode, date, time, duration, slotStart, slotUserUuid, locationType, assignedUserUuid] = useWatch({
        control,
        name: [
            "invitee_mode",
            "booking_page_uuid",
            "time_mode",
            "date",
            "time",
            "duration_minutes",
            "slot_start",
            "slot_user_uuid",
            "location_type",
            "assigned_user_uuid",
        ],
    });

    const activePages = useMemo(() => pages.filter((p) => p.is_active), [pages]);
    const selectedPage = activePages.find((p) => p.uuid === pageUuid) ?? null;
    const usesSlots = !!selectedPage && timeMode === CreateBookingTimeModes.SLOT;

    const durationOptions = useMemo(() => {
        const values = new Set<number>([...BOOKING_DURATION_PRESETS, duration]);
        if (selectedPage) {
            values.add(selectedPage.duration_minutes);
            for (const d of selectedPage.duration_options ?? []) values.add(d);
        }
        return [...values].filter((d) => d > 0).sort((a, b) => a - b).map((d) => ({ id: String(d), label: formatDuration(d) }));
    }, [duration, selectedPage]);

    const memberOptions = useMemo(() => {
        if (isAdmin) return members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) }));
        return currentUserUuid ? [{ id: currentUserUuid, label: `${memberName(currentUserUuid)} (me)` }] : [];
    }, [isAdmin, members, currentUserUuid, memberName]);

    const handlePageChange = (uuid: string) => {
        setValue("booking_page_uuid", uuid);
        setValue("slot_start", "");
        setValue("slot_user_uuid", "");
        const page = activePages.find((p) => p.uuid === uuid);
        if (page) {
            setValue("duration_minutes", page.duration_minutes);
            setValue("location_type", page.location_type);
            setValue("location_value", page.location_value ?? "");
        } else {
            setValue("time_mode", CreateBookingTimeModes.CUSTOM);
        }
    };

    const clearSlot = () => {
        setValue("slot_start", "");
        setValue("slot_user_uuid", "");
    };

    const onSubmit = form.handleSubmit((values) => {
        const payload: CreateBookingDto = {
            booking_page_uuid: values.booking_page_uuid || undefined,
            start_at: usesSlots ? values.slot_start : zonedTimeToIso(values.date, values.time, timezone),
            duration_minutes: values.duration_minutes,
            assigned_user_uuid: (usesSlots ? values.slot_user_uuid : values.assigned_user_uuid) || undefined,
            location_type: values.location_type,
            location_value: values.location_value || undefined,
            internal_notes: values.internal_notes || undefined,
            ignore_availability: usesSlots ? false : values.ignore_availability,
            notify: values.notify,
        };
        if (values.invitee_mode === CreateBookingInviteeModes.CONTACT) {
            payload.contact_uuid = values.contact_uuid;
        } else {
            payload.invitee_name = values.invitee_name;
            payload.invitee_email = values.invitee_email || undefined;
            payload.invitee_phone = values.invitee_phone || undefined;
        }
        createBooking.mutate(payload, {
            onSuccess: (booking) => {
                onOpenChange(false);
                onCreated?.(booking.uuid);
            },
            onError: (error) => {
                if (isSlotUnavailableError(error)) {
                    if (usesSlots) clearSlot();
                    setError(usesSlots ? "slot_start" : "time", {
                        message: "That time was just taken. Pick another time.",
                    });
                }
            },
        });
    });

    const errors = formState.errors;
    const locationPlaceholder = LOCATION_VALUE_PLACEHOLDERS[locationType];

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container scroll="outside">
                <Modal.Dialog className="sm:max-w-xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>New booking</Modal.Heading>
                        <p className="text-xs text-muted">
                            Times in {timezone} ({timeZoneOffsetLabel(timezone)})
                        </p>
                    </Modal.Header>
                    <Form onSubmit={onSubmit} className="contents">
                        <Modal.Body className="space-y-5">
                            {/* Invitee */}
                            <section className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Label>
                                        Invitee <span className="text-danger">*</span>
                                    </Label>
                                    {!contactPrefilled ? (
                                        <ToggleButtonGroup
                                            size="sm"
                                            selectionMode="single"
                                            disallowEmptySelection
                                            selectedKeys={new Set([inviteeMode])}
                                            onSelectionChange={(keys) => {
                                                const next = [...keys][0];
                                                if (next) setValue("invitee_mode", next as CreateBookingFormValues["invitee_mode"]);
                                            }}
                                            aria-label="Invitee type"
                                        >
                                            <ToggleButton id={CreateBookingInviteeModes.CONTACT}>Existing contact</ToggleButton>
                                            <ToggleButton id={CreateBookingInviteeModes.VISITOR}>New visitor</ToggleButton>
                                        </ToggleButtonGroup>
                                    ) : null}
                                </div>
                                {inviteeMode === CreateBookingInviteeModes.CONTACT ? (
                                    <Controller
                                        control={control}
                                        name="contact_uuid"
                                        render={({ field }) => (
                                            <ContactSearchPickerField
                                                prefilled={pickedContactValue}
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                                            <Label htmlFor="cb-name">Name</Label>
                                            <Input id="cb-name" placeholder="Full name" {...form.register("invitee_name")} />
                                            <FormError message={errors.invitee_name?.message} />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="cb-email">Email</Label>
                                            <Input id="cb-email" type="email" placeholder="name@company.com" {...form.register("invitee_email")} />
                                            <FormError message={errors.invitee_email?.message} />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="cb-phone">Phone</Label>
                                            <Input id="cb-phone" type="tel" placeholder="+30 …" {...form.register("invitee_phone")} />
                                        </div>
                                    </div>
                                )}
                                <FormError message={errors.contact_uuid?.message} />
                            </section>

                            {/* Booking page + time */}
                            <section className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Label>Booking type</Label>
                                    <SearchSelect
                                        aria-label="Booking page"
                                        emptyLabel="No booking page (one-off meeting)"
                                        searchPlaceholder="Search booking pages…"
                                        options={activePages.map((p) => ({ id: p.uuid, label: p.name }))}
                                        value={pageUuid}
                                        onChange={handlePageChange}
                                        fullWidth
                                    />
                                </div>

                                {selectedPage ? (
                                    <ToggleButtonGroup
                                        size="sm"
                                        selectionMode="single"
                                        disallowEmptySelection
                                        selectedKeys={new Set([timeMode])}
                                        onSelectionChange={(keys) => {
                                            const next = [...keys][0];
                                            if (next) setValue("time_mode", next as CreateBookingFormValues["time_mode"]);
                                        }}
                                        aria-label="Time selection"
                                        className="self-start"
                                    >
                                        <ToggleButton id={CreateBookingTimeModes.SLOT}>Available slots</ToggleButton>
                                        <ToggleButton id={CreateBookingTimeModes.CUSTOM}>Custom time</ToggleButton>
                                    </ToggleButtonGroup>
                                ) : null}

                                {usesSlots && selectedPage ? (
                                    <>
                                        <BookingSlotPicker
                                            pageUuid={selectedPage.uuid}
                                            timezone={timezone}
                                            dateKey={date}
                                            onDateChange={(next) => {
                                                setValue("date", next);
                                                clearSlot();
                                            }}
                                            durationMinutes={duration}
                                            selected={slotStart ? { start: slotStart, userUuid: slotUserUuid || undefined } : null}
                                            onSelect={(slot) => {
                                                setValue("slot_start", slot.start, { shouldValidate: true });
                                                setValue("slot_user_uuid", slot.userUuid ?? "");
                                            }}
                                            memberName={memberName}
                                            restrictToUserUuid={assignedUserUuid || (isAdmin ? null : currentUserUuid)}
                                            onOpenBooking={onOpenBooking}
                                        />
                                        {slotStart ? (
                                            <p className="text-xs text-muted">
                                                {formatDateTime(slotStart, timezone)} with{" "}
                                                {slotUserUuid ? memberName(slotUserUuid) : "the next available member"}
                                            </p>
                                        ) : null}
                                        <FormError message={errors.slot_start?.message} />
                                    </>
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="flex flex-col gap-1.5">
                                                <Controller
                                                    control={control}
                                                    name="date"
                                                    render={({ field }) => (
                                                        <DateKeyPicker label="Date" isRequired showDayStepper value={field.value} onChange={field.onChange} />
                                                    )}
                                                />
                                                <FormError message={errors.date?.message} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Controller
                                                    control={control}
                                                    name="time"
                                                    render={({ field }) => (
                                                        <TimeOfDayField label="Start time" isRequired value={field.value} onChange={field.onChange} />
                                                    )}
                                                />
                                                <FormError message={errors.time?.message} />
                                            </div>
                                        </div>
                                        <DayAvailability
                                            timezone={timezone}
                                            dateKey={date}
                                            time={time}
                                            durationMinutes={duration}
                                            userUuid={assignedUserUuid || currentUserUuid || null}
                                            memberName={memberName}
                                        />
                                        <Controller
                                            control={control}
                                            name="ignore_availability"
                                            render={({ field }) => (
                                                <SwitchRow
                                                    label="Ignore availability"
                                                    description="Book even outside working hours or over other bookings."
                                                    isSelected={field.value}
                                                    onChange={field.onChange}
                                                />
                                            )}
                                        />
                                    </>
                                )}
                            </section>

                            {/* Duration + member */}
                            <section className="grid gap-3 sm:grid-cols-2">
                                <Controller
                                    control={control}
                                    name="duration_minutes"
                                    render={({ field }) => (
                                        <OptionSelect
                                            aria-label="Duration"
                                            label="Duration"
                                            options={durationOptions}
                                            value={String(field.value)}
                                            onChange={(v) => {
                                                field.onChange(Number(v) || 30);
                                                clearSlot();
                                            }}
                                        />
                                    )}
                                />
                                <div className="flex flex-col gap-1.5">
                                        <Label>Assigned to</Label>
                                        <Controller
                                            control={control}
                                            name="assigned_user_uuid"
                                            render={({ field }) => (
                                                <SearchSelect
                                                    aria-label="Assigned member"
                                                    emptyLabel="Automatic"
                                                    searchPlaceholder="Search members…"
                                                    options={memberOptions}
                                                    value={field.value}
                                                    onChange={(v) => {
                                                        field.onChange(v);
                                                        // Slots belong to a member; offer the new member's times.
                                                        if (usesSlots) clearSlot();
                                                    }}
                                                    fullWidth
                                                />
                                            )}
                                        />
                                </div>
                            </section>

                            {/* Location */}
                            <section className="grid gap-3 sm:grid-cols-2">
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
                                        <Label htmlFor="cb-location">Location details</Label>
                                        <Input id="cb-location" placeholder={locationPlaceholder} {...form.register("location_value")} />
                                    </div>
                                ) : null}
                            </section>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cb-notes">Internal notes</Label>
                                <TextArea
                                    id="cb-notes"
                                    rows={3}
                                    placeholder="Only visible to your team"
                                    {...form.register("internal_notes")}
                                />
                            </div>

                            <Controller
                                control={control}
                                name="notify"
                                render={({ field }) => (
                                    <SwitchRow
                                        label="Send confirmation email"
                                        description="Notify the invitee (and assignee, per page settings)."
                                        isSelected={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </Modal.Body>
                        <Modal.Footer className="justify-end gap-2">
                            <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                type="submit"
                                size="sm"
                                isDisabled={createBooking.isPending}
                                isPending={createBooking.isPending}
                            >
                                Create booking
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Form>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

/** Keeps the picked contact object for display while the form stores only its uuid. */
const ContactSearchPickerField: FC<{
    prefilled: PickedContact | null;
    value: string;
    onChange: (uuid: string) => void;
}> = ({ prefilled, value, onChange }) => {
    const [picked, setPicked] = useState<PickedContact | null>(prefilled);
    const shown = prefilled && prefilled.uuid === value ? prefilled : picked && picked.uuid === value ? picked : null;
    return (
        <ContactSearchPicker
            value={shown}
            isLocked={!!prefilled}
            onChange={(next) => {
                setPicked(next);
                onChange(next?.uuid ?? "");
            }}
        />
    );
};
