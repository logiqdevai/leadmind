import { useMemo, useState, type FC } from "react";
import { Button, Chip, Input, Label, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchSelect } from "@/components/ui/search-select";
import { TimeOfDayField } from "@/components/bookings/booking-date-time-fields";
import {
    useCreateRecurringBlock,
    useDeleteRecurringBlock,
    useRecurringBlocks,
    useUpdateRecurringBlock,
} from "@/features/bookings/hooks/use-availability";
import type { RecurringBlock } from "@/features/bookings/interfaces/bookings.interfaces";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { DashboardEmptyState, DashboardListSkeleton } from "@/pages/dashboard/components/dashboard-shared";
import { SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import { ISO_WEEKDAYS, timeToMinutes, WEEKDAY_LABELS } from "@/pages/dashboard/pages/availability/utils/time-ranges";

const EVERYONE = "";
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];
const shortDay = (day: number) => WEEKDAY_LABELS[day].slice(0, 3);

const memberLabel = (m: Pick<OrganisationMember, "full_name" | "email">) => m.full_name?.trim() || m.email;

/** "Mon–Fri", "Mon, Wed, Fri", "Every day". */
function formatWeekdays(days: number[]): string {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return "Every day";
    const consecutive = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    if (consecutive) return `${shortDay(sorted[0])}–${shortDay(sorted[sorted.length - 1])}`;
    return sorted.map(shortDay).join(", ");
}

interface RecurringBlockModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editing: RecurringBlock | null;
    timeZone: string;
    defaultUserUuid: string;
    currentUserUuid: string;
    isAdmin: boolean;
    members: OrganisationMember[];
}

const RecurringBlockModal: FC<RecurringBlockModalProps> = ({
    isOpen,
    onOpenChange,
    editing,
    timeZone,
    defaultUserUuid,
    currentUserUuid,
    isAdmin,
    members,
}) => {
    const create = useCreateRecurringBlock();
    const update = useUpdateRecurringBlock();
    const [who, setWho] = useState(defaultUserUuid);
    const [days, setDays] = useState<number[]>(WEEKDAYS_ONLY);
    const [startTime, setStartTime] = useState("12:00");
    const [endTime, setEndTime] = useState("13:00");
    const [reason, setReason] = useState("");

    // Re-seed the form each time the modal opens (state adjusted during render, not in an effect).
    const seedKey = isOpen ? (editing?.uuid ?? "new") : null;
    const [seededFor, setSeededFor] = useState<string | null>(null);
    if (seededFor !== seedKey) {
        setSeededFor(seedKey);
        if (seedKey) {
            setWho(editing ? (editing.user_uuid ?? EVERYONE) : defaultUserUuid);
            setDays(editing ? editing.weekdays : WEEKDAYS_ONLY);
            setStartTime(editing?.start_time ?? "12:00");
            setEndTime(editing?.end_time ?? "13:00");
            setReason(editing?.reason ?? "");
        }
    }

    const userOptions = useMemo(() => members.map((m) => ({ id: m.user_uuid, label: memberLabel(m) })), [members]);

    const error =
        days.length === 0
            ? "Pick at least one day"
            : timeToMinutes(endTime) <= timeToMinutes(startTime)
              ? "The end must be after the start"
              : null;
    const isPending = create.isPending || update.isPending;

    const submit = () => {
        if (error) return;
        const close = { onSuccess: () => onOpenChange(false) };
        if (editing) {
            update.mutate(
                { uuid: editing.uuid, payload: { weekdays: days, start_time: startTime, end_time: endTime, reason: reason.trim() } },
                close,
            );
            return;
        }
        create.mutate(
            {
                weekdays: days,
                start_time: startTime,
                end_time: endTime,
                timezone: timeZone,
                reason: reason.trim() || undefined,
                ...(isAdmin && who === EVERYONE
                    ? { organisation_wide: true }
                    : isAdmin && who !== currentUserUuid
                      ? { user_uuid: who }
                      : {}),
            },
            close,
        );
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-lg">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{editing ? "Edit recurring block" : "Block a time slot every week"}</Modal.Heading>
                        <p className="text-xs text-muted">Repeats on the chosen days until you remove it. Times are in {timeZone}.</p>
                    </Modal.Header>
                    <Modal.Body className="space-y-4">
                        {isAdmin && !editing ? (
                            <div className="flex flex-col gap-1.5">
                                <Label>Who</Label>
                                <SearchSelect
                                    aria-label="Who is unavailable"
                                    options={userOptions}
                                    value={who}
                                    emptyLabel="Everyone in the organisation"
                                    onChange={setWho}
                                    searchPlaceholder="Search members…"
                                    fullWidth
                                />
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Days</Label>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="tertiary" onPress={() => setDays(WEEKDAYS_ONLY)}>
                                        Weekdays
                                    </Button>
                                    <Button size="sm" variant="tertiary" onPress={() => setDays([...ISO_WEEKDAYS])}>
                                        Every day
                                    </Button>
                                </div>
                            </div>
                            <ToggleButtonGroup
                                size="sm"
                                selectionMode="multiple"
                                aria-label="Days of the week"
                                selectedKeys={new Set(days.map(String))}
                                onSelectionChange={(keys) => setDays([...keys].map(Number).sort((a, b) => a - b))}
                                className="flex-wrap self-start"
                            >
                                {ISO_WEEKDAYS.map((day) => (
                                    <ToggleButton key={day} id={String(day)}>
                                        {shortDay(day)}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <TimeOfDayField label="From" isRequired value={startTime} onChange={setStartTime} />
                            <TimeOfDayField label="Until" isRequired value={endTime} onChange={setEndTime} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="recurring-reason">Reason</Label>
                            <Input
                                id="recurring-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                maxLength={200}
                                placeholder="e.g. Lunch break, Admin time"
                            />
                        </div>
                        {error ? <p className="text-xs text-danger">{error}</p> : null}
                    </Modal.Body>
                    <Modal.Footer className="justify-end gap-2">
                        <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending isPending={isPending} isDisabled={isPending || !!error} onPress={submit}>
                            {editing ? "Save" : "Block time"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

interface RecurringBlocksSectionProps {
    timeZone: string;
    userUuid: string;
    /** Passed to the API; omitted for the signed-in member. */
    hookUserUuid: string | undefined;
    currentUserUuid: string;
    isAdmin: boolean;
    canEdit: boolean;
    members: OrganisationMember[];
}

/** Time windows that are blocked every week (e.g. lunch), independent of any date range. */
export const RecurringBlocksSection: FC<RecurringBlocksSectionProps> = ({
    timeZone,
    userUuid,
    hookUserUuid,
    currentUserUuid,
    isAdmin,
    canEdit,
    members,
}) => {
    const { data: blocks = [], isLoading } = useRecurringBlocks(hookUserUuid);
    const remove = useDeleteRecurringBlock();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RecurringBlock | null>(null);
    const [toDelete, setToDelete] = useState<RecurringBlock | null>(null);

    const canManage = (b: RecurringBlock) => canEdit && (isAdmin || (b.user_uuid != null && b.user_uuid === currentUserUuid));

    return (
        <SettingsSection
            title="Recurring blocked time"
            description='Permanently block a time window on chosen weekdays, e.g. lunch. Blocked times follow the booking page setting for unavailable slots: hidden, or shown disabled.'
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
                        Block weekly slot
                    </Button>
                ) : null
            }
        >
            {isLoading ? (
                <DashboardListSkeleton />
            ) : blocks.length === 0 ? (
                <DashboardEmptyState icon={Repeat} title="No recurring blocks" body="Block lunch breaks or other weekly time that should never be bookable." />
            ) : (
                <ul className="divide-y divide-border/60 rounded-xl border border-border/80">
                    {blocks.map((b) => (
                        <li key={b.uuid} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm tabular-nums text-foreground">
                                    {formatWeekdays(b.weekdays)} · {b.start_time}–{b.end_time}
                                </p>
                                {b.reason ? <p className="truncate text-xs text-muted">{b.reason}</p> : null}
                            </div>
                            {b.user_uuid == null ? (
                                <Chip size="sm" variant="soft" color="warning">
                                    <Chip.Label>Everyone</Chip.Label>
                                </Chip>
                            ) : null}
                            {canManage(b) ? (
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        aria-label="Edit recurring block"
                                        onPress={() => {
                                            setEditing(b);
                                            setModalOpen(true);
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button size="sm" variant="tertiary" aria-label="Remove recurring block" onPress={() => setToDelete(b)}>
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
                    <RecurringBlockModal
                        isOpen={modalOpen}
                        onOpenChange={setModalOpen}
                        editing={editing}
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
                        title="Remove this recurring block?"
                        description="The time becomes bookable again every week."
                        confirmLabel="Remove"
                        variant="danger"
                        isPending={remove.isPending}
                        onConfirm={async () => {
                            if (!toDelete) return;
                            await remove.mutateAsync(toDelete.uuid);
                            setToDelete(null);
                        }}
                    />
                </>
            ) : null}
        </SettingsSection>
    );
};
