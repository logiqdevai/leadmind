import { useEffect, useMemo, useState, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Chip, Input, Label, Modal } from "@heroui/react";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppDatePicker } from "@/components/ui/date-picker";
import { TimeOfDayField } from "@/components/bookings/booking-date-time-fields";
import { timeKeyInZone } from "@/components/bookings/utils/booking-display";
import { SearchSelect } from "@/components/ui/search-select";
import {
    useBookingBlocks,
    useCreateBookingBlock,
    useDeleteBookingBlock,
    useUpdateBookingBlock,
} from "@/features/bookings/hooks/use-availability";
import type { BookingBlock, CreateBookingBlockDto } from "@/features/bookings/interfaces/bookings.interfaces";
import { addDays, dateKeyInZone, formatDateTime, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { SettingSwitch, SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import {
    bookingBlockSchema,
    type BookingBlockFormValues,
} from "@/pages/dashboard/pages/availability/validation-schemas/availability.schema";

const EVERYONE = "";
const LOOKAHEAD_DAYS = 183;

const memberLabel = (m: Pick<OrganisationMember, "full_name" | "email">) => m.full_name?.trim() || m.email;

interface BlockModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    timeZone: string;
    defaultUserUuid: string;
    currentUserUuid: string;
    isAdmin: boolean;
    members: OrganisationMember[];
    /** When set the modal edits this block instead of creating one. */
    editing: BookingBlock | null;
}

/** Form values describing an existing block, in the schedule timezone. */
function valuesFromBlock(block: BookingBlock, timeZone: string): BookingBlockFormValues {
    const startDate = dateKeyInZone(block.start_at, timeZone);
    const startTime = timeKeyInZone(block.start_at, timeZone);
    const endDate = dateKeyInZone(block.end_at, timeZone);
    const endTime = timeKeyInZone(block.end_at, timeZone);
    // Whole-day blocks run midnight to midnight; the form shows the last included day.
    const allDay = startTime === "00:00" && endTime === "00:00" && endDate > startDate;
    return {
        user_uuid: block.user_uuid ?? EVERYONE,
        all_day: allDay,
        start_date: startDate,
        start_time: startTime,
        end_date: allDay ? addDays(endDate, -1) : endDate,
        end_time: endTime,
        reason: block.reason ?? "",
    };
}

const BlockModal: FC<BlockModalProps> = ({ isOpen, onOpenChange, timeZone, defaultUserUuid, currentUserUuid, isAdmin, members, editing }) => {
    const createBlock = useCreateBookingBlock();
    const updateBlock = useUpdateBookingBlock();
    const today = dateKeyInZone(new Date(), timeZone);
    const defaults = (): BookingBlockFormValues =>
        editing
            ? valuesFromBlock(editing, timeZone)
            : {
                  user_uuid: defaultUserUuid,
                  all_day: true,
                  start_date: today,
                  start_time: "09:00",
                  end_date: today,
                  end_time: "17:00",
                  reason: "",
              };
    const form = useForm<BookingBlockFormValues>({ resolver: zodResolver(bookingBlockSchema), defaultValues: defaults() });
    const { control, register, reset, setValue, formState, handleSubmit } = form;
    const allDay = useWatch({ control, name: "all_day" });
    const startDate = useWatch({ control, name: "start_date" });
    const endDate = useWatch({ control, name: "end_date" });

    useEffect(() => {
        if (isOpen) reset(defaults());
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the modal opens
    }, [isOpen, editing]);

    useEffect(() => {
        if (startDate && endDate && endDate < startDate) setValue("end_date", startDate);
    }, [startDate, endDate, setValue]);

    const userOptions = useMemo(
        // "Everyone" is the select's empty option (id "").
        () => members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) })),
        [members],
    );

    const isPending = createBlock.isPending || updateBlock.isPending;

    const onSubmit = handleSubmit((v) => {
        const start_at = zonedTimeToIso(v.start_date, v.all_day ? "00:00" : v.start_time, timeZone);
        const end_at = v.all_day
            ? zonedTimeToIso(addDays(v.end_date, 1), "00:00", timeZone)
            : zonedTimeToIso(v.end_date, v.end_time, timeZone);
        const close = { onSuccess: () => onOpenChange(false) };
        if (editing) {
            updateBlock.mutate({ uuid: editing.uuid, payload: { start_at, end_at, reason: v.reason.trim() } }, close);
            return;
        }
        const payload: CreateBookingBlockDto = { start_at, end_at, reason: v.reason.trim() || undefined };
        if (isAdmin && v.user_uuid === EVERYONE) payload.organisation_wide = true;
        else if (isAdmin && v.user_uuid !== currentUserUuid) payload.user_uuid = v.user_uuid;
        createBlock.mutate(payload, close);
    });

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{editing ? "Edit blocked time" : "Block time"}</Modal.Heading>
                        <p className="text-xs text-muted">Times are in {timeZone}.</p>
                    </Modal.Header>
                    <Modal.Body>
                        <form id="block-form" onSubmit={onSubmit} noValidate className="space-y-4">
                            {isAdmin && !editing ? (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Who</Label>
                                    <Controller
                                        control={control}
                                        name="user_uuid"
                                        render={({ field }) => (
                                            <SearchSelect
                                                aria-label="Who is unavailable"
                                                options={userOptions}
                                                value={field.value}
                                                emptyLabel="Everyone in the organisation"
                                                onChange={field.onChange}
                                                searchPlaceholder="Search members…"
                                                fullWidth
                                            />
                                        )}
                                    />
                                    <p className="text-xs text-muted">&quot;Everyone&quot; is for company holidays: no member can be booked.</p>
                                </div>
                            ) : null}
                            <Controller
                                control={control}
                                name="all_day"
                                render={({ field }) => <SettingSwitch label="All day" isSelected={field.value} onChange={field.onChange} />}
                            />
                            <div className="flex flex-col gap-1.5">
                                <Label>From</Label>
                                <div className={allDay ? "" : "grid gap-3 sm:grid-cols-2"}>
                                    <Controller
                                        control={control}
                                        name="start_date"
                                        render={({ field }) => (
                                            <AppDatePicker
                                                aria-label="Start date"
                                                value={field.value}
                                                onChange={field.onChange}
                                                minValue={editing ? undefined : today}
                                                className="w-full"
                                            />
                                        )}
                                    />
                                    {!allDay ? (
                                        <Controller
                                            control={control}
                                            name="start_time"
                                            render={({ field }) => <TimeOfDayField aria-label="Start time" value={field.value} onChange={field.onChange} />}
                                        />
                                    ) : null}
                                </div>
                                {formState.errors.start_date ? <p className="text-xs text-danger">{formState.errors.start_date.message}</p> : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Until</Label>
                                <div className={allDay ? "" : "grid gap-3 sm:grid-cols-2"}>
                                    <Controller
                                        control={control}
                                        name="end_date"
                                        render={({ field }) => (
                                            <AppDatePicker
                                                aria-label="End date"
                                                value={field.value}
                                                onChange={field.onChange}
                                                minValue={startDate || today}
                                                className="w-full"
                                            />
                                        )}
                                    />
                                    {!allDay ? (
                                        <Controller
                                            control={control}
                                            name="end_time"
                                            render={({ field }) => <TimeOfDayField aria-label="End time" value={field.value} onChange={field.onChange} />}
                                        />
                                    ) : null}
                                </div>
                                {formState.errors.end_date ? <p className="text-xs text-danger">{formState.errors.end_date.message}</p> : null}
                                {allDay ? <p className="text-xs text-muted">All-day blocks include the end date.</p> : null}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="block-reason">Reason</Label>
                                <Input id="block-reason" {...register("reason")} placeholder="e.g. Vacation, Public holiday" />
                            </div>
                        </form>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending type="submit" form="block-form" isPending={isPending} isDisabled={isPending}>
                            {editing ? "Save" : "Block time"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

interface BlockedPeriodsSectionProps {
    timeZone: string;
    /** Member whose blocks are listed. */
    userUuid: string;
    currentUserUuid: string;
    isAdmin: boolean;
    canEdit: boolean;
    members: OrganisationMember[];
}

export const BlockedPeriodsSection: FC<BlockedPeriodsSectionProps> = ({
    timeZone,
    userUuid,
    currentUserUuid,
    isAdmin,
    canEdit,
    members,
}) => {
    // Fixed window for the session so the query key stays stable.
    const [range] = useState(() => {
        const now = new Date();
        return { from: now.toISOString(), to: new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000).toISOString() };
    });
    const { data: blocks = [], isLoading } = useBookingBlocks({ ...range, user_uuid: userUuid });
    const deleteBlock = useDeleteBookingBlock();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<BookingBlock | null>(null);
    const [toDelete, setToDelete] = useState<BookingBlock | null>(null);

    const sorted = useMemo(() => [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at)), [blocks]);
    const canDelete = (b: BookingBlock) => isAdmin || (b.user_uuid != null && b.user_uuid === currentUserUuid);

    return (
        <SettingsSection
            title="Blocked time"
            description="Holidays, vacations and other time off in the next 6 months. Nobody can book a blocked period."
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
                        Block time
                    </Button>
                ) : null
            }
        >
            {isLoading ? (
                <DashboardListSkeleton />
            ) : sorted.length === 0 ? (
                <DashboardEmptyState icon={CalendarOff} title="No blocked time" body="Add vacations or company holidays so they can't be booked." />
            ) : (
                <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                    {sorted.map((b) => (
                        <li key={b.uuid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-foreground tabular-nums">
                                    {formatDateTime(b.start_at, timeZone)} to {formatDateTime(b.end_at, timeZone)}
                                </p>
                                {b.reason ? <p className="truncate text-xs text-muted">{b.reason}</p> : null}
                            </div>
                            {b.user_uuid == null ? (
                                <Chip size="sm" variant="soft" color="warning">
                                    <Chip.Label>Everyone</Chip.Label>
                                </Chip>
                            ) : null}
                            {canEdit && canDelete(b) ? (
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        aria-label="Edit blocked time"
                                        onPress={() => {
                                            setEditing(b);
                                            setModalOpen(true);
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button size="sm" variant="tertiary" aria-label="Remove blocked time" onPress={() => setToDelete(b)}>
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
                    <BlockModal
                        isOpen={modalOpen}
                        onOpenChange={setModalOpen}
                        timeZone={timeZone}
                        defaultUserUuid={userUuid}
                        currentUserUuid={currentUserUuid}
                        isAdmin={isAdmin}
                        members={members}
                        editing={editing}
                    />
                    <ConfirmDialog
                        isOpen={!!toDelete}
                        onOpenChange={(open) => {
                            if (!open) setToDelete(null);
                        }}
                        title="Remove this blocked time?"
                        description={toDelete?.user_uuid == null ? "This block applies to everyone in the organisation." : "The period becomes bookable again."}
                        confirmLabel="Remove"
                        variant="danger"
                        isPending={deleteBlock.isPending}
                        onConfirm={async () => {
                            if (!toDelete) return;
                            await deleteBlock.mutateAsync(toDelete.uuid);
                            setToDelete(null);
                        }}
                    />
                </>
            ) : null}
        </SettingsSection>
    );
};
