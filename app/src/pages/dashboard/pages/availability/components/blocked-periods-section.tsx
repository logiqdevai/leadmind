import { useEffect, useMemo, useState, type FC } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Chip, Input, Label, Modal } from "@heroui/react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppDatePicker } from "@/components/ui/date-picker";
import { SearchSelect } from "@/components/ui/search-select";
import { useBookingBlocks, useCreateBookingBlock, useDeleteBookingBlock } from "@/features/bookings/hooks/use-availability";
import type { BookingBlock, CreateBookingBlockDto } from "@/features/bookings/interfaces/bookings.interfaces";
import { addDays, dateKeyInZone, formatDateTime, zonedTimeToIso } from "@/features/bookings/utils/booking-time";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { SettingSwitch, SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import {
    bookingBlockSchema,
    type BookingBlockFormValues,
} from "@/pages/dashboard/pages/availability/validation-schemas/availability.schema";
import { TimeInput } from "./time-input";

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
}

const BlockModal: FC<BlockModalProps> = ({ isOpen, onOpenChange, timeZone, defaultUserUuid, currentUserUuid, isAdmin, members }) => {
    const createBlock = useCreateBookingBlock();
    const today = dateKeyInZone(new Date(), timeZone);
    const defaults = (): BookingBlockFormValues => ({
        user_uuid: defaultUserUuid,
        all_day: true,
        start_date: today,
        start_time: "09:00",
        end_date: today,
        end_time: "17:00",
        reason: "",
    });
    const form = useForm<BookingBlockFormValues>({ resolver: zodResolver(bookingBlockSchema), defaultValues: defaults() });
    const { control, register, reset, setValue, formState, handleSubmit } = form;
    const allDay = useWatch({ control, name: "all_day" });
    const startDate = useWatch({ control, name: "start_date" });
    const endDate = useWatch({ control, name: "end_date" });

    useEffect(() => {
        if (isOpen) reset(defaults());
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the modal opens
    }, [isOpen]);

    useEffect(() => {
        if (startDate && endDate && endDate < startDate) setValue("end_date", startDate);
    }, [startDate, endDate, setValue]);

    const userOptions = useMemo(
        // "Everyone" is the select's empty option (id "").
        () => members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) })),
        [members],
    );

    const onSubmit = handleSubmit((v) => {
        const start_at = zonedTimeToIso(v.start_date, v.all_day ? "00:00" : v.start_time, timeZone);
        const end_at = v.all_day
            ? zonedTimeToIso(addDays(v.end_date, 1), "00:00", timeZone)
            : zonedTimeToIso(v.end_date, v.end_time, timeZone);
        const payload: CreateBookingBlockDto = { start_at, end_at, reason: v.reason.trim() || undefined };
        if (isAdmin && v.user_uuid === EVERYONE) payload.organisation_wide = true;
        else if (isAdmin && v.user_uuid !== currentUserUuid) payload.user_uuid = v.user_uuid;
        createBlock.mutate(payload, { onSuccess: () => onOpenChange(false) });
    });

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Block time</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <form id="block-form" onSubmit={onSubmit} noValidate className="space-y-4">
                            {isAdmin ? (
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
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label>From</Label>
                                    <div className="flex items-center gap-2">
                                        <Controller
                                            control={control}
                                            name="start_date"
                                            render={({ field }) => (
                                                <AppDatePicker aria-label="Start date" value={field.value} onChange={field.onChange} minValue={today} className="w-40" />
                                            )}
                                        />
                                        {!allDay ? (
                                            <Controller
                                                control={control}
                                                name="start_time"
                                                render={({ field }) => <TimeInput aria-label="Start time" value={field.value} onChange={field.onChange} />}
                                            />
                                        ) : null}
                                    </div>
                                    {formState.errors.start_date ? <p className="text-xs text-danger">{formState.errors.start_date.message}</p> : null}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>Until</Label>
                                    <div className="flex items-center gap-2">
                                        <Controller
                                            control={control}
                                            name="end_date"
                                            render={({ field }) => (
                                                <AppDatePicker aria-label="End date" value={field.value} onChange={field.onChange} minValue={startDate || today} className="w-40" />
                                            )}
                                        />
                                        {!allDay ? (
                                            <Controller
                                                control={control}
                                                name="end_time"
                                                render={({ field }) => <TimeInput aria-label="End time" value={field.value} onChange={field.onChange} />}
                                            />
                                        ) : null}
                                    </div>
                                    {formState.errors.end_date ? <p className="text-xs text-danger">{formState.errors.end_date.message}</p> : null}
                                </div>
                            </div>
                            <p className="text-xs text-muted">
                                Times are in {timeZone}.{allDay ? " All-day blocks include the end date." : ""}
                            </p>
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
                        <ActionButtonWithPending type="submit" form="block-form" isPending={createBlock.isPending} isDisabled={createBlock.isPending}>
                            Block time
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
    const [toDelete, setToDelete] = useState<BookingBlock | null>(null);

    const sorted = useMemo(() => [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at)), [blocks]);
    const canDelete = (b: BookingBlock) => isAdmin || (b.user_uuid != null && b.user_uuid === currentUserUuid);

    return (
        <SettingsSection
            title="Blocked time"
            description="Holidays, vacations and other time off in the next 6 months. Nobody can book a blocked period."
            actions={
                canEdit ? (
                    <Button size="sm" variant="secondary" onPress={() => setModalOpen(true)}>
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
                                <Button size="sm" variant="tertiary" aria-label="Remove blocked time" onPress={() => setToDelete(b)}>
                                    <Trash2 className="size-4 text-danger" />
                                </Button>
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
