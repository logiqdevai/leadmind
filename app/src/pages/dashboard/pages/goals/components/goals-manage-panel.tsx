import { useMemo, useState, type Key } from "react";
import { Button, Dropdown, Input, ListBox, Select, Tabs } from "@heroui/react";
import { ScrollableTabs, ScrollableTabsList, tabTriggerClassName } from "@/components/ui/scrollable-tabs";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
    useBulkUpsertMessagingGoals,
    useDeactivateMessagingGoal,
    useMessagingGoalsList,
    useUpdateMessagingGoal,
    useUpsertMessagingGoal,
} from "@/features/messaging-goals/hooks/use-messaging-goals";
import {
    GoalPeriods,
    type GoalPeriod,
    type MessagingGoalProgress,
} from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import {
    useCurrentOrganisation,
    useOrganisationMembers,
} from "@/features/organisations/hooks/use-organisations";
import { PERIOD_LABELS } from "../utils/goals-copy";

const PERIOD_OPTIONS = [
    { id: GoalPeriods.DAY, label: PERIOD_LABELS.DAY },
    { id: GoalPeriods.WEEK, label: PERIOD_LABELS.WEEK },
    { id: GoalPeriods.MONTH, label: PERIOD_LABELS.MONTH },
];

function memberLabel(member: {
    full_name: string | null;
    email: string;
}) {
    return member.full_name?.trim() || member.email;
}

function goalKey(userUuid: string, period: GoalPeriod) {
    return `${userUuid}:${period}`;
}

export function GoalsManagePanel() {
    const { data: org } = useCurrentOrganisation();
    const { data: members = [], isLoading: membersLoading } = useOrganisationMembers(
        org?.uuid ?? "",
    );
    const { data: goals = [], isLoading: goalsLoading } = useMessagingGoalsList();
    const upsert = useUpsertMessagingGoal();
    const update = useUpdateMessagingGoal();
    const bulkUpsert = useBulkUpsertMessagingGoals();
    const deactivate = useDeactivateMessagingGoal();

    const [assignTab, setAssignTab] = useState("individual");
    const [selectedUserUuid, setSelectedUserUuid] = useState("");
    const [period, setPeriod] = useState<GoalPeriod>(GoalPeriods.DAY);
    const [targetCount, setTargetCount] = useState("20");
    const [editingUuid, setEditingUuid] = useState<string | null>(null);
    const [bulkPeriod, setBulkPeriod] = useState<GoalPeriod>(GoalPeriods.DAY);
    const [bulkTarget, setBulkTarget] = useState("20");

    const goalsByKey = useMemo(() => {
        const map = new Map<string, MessagingGoalProgress>();
        for (const goal of goals) {
            map.set(goalKey(goal.user_uuid, goal.period), goal);
        }
        return map;
    }, [goals]);

    const applySelection = (userUuid: string, nextPeriod: GoalPeriod) => {
        const existing = userUuid
            ? goalsByKey.get(goalKey(userUuid, nextPeriod))
            : undefined;
        if (existing) {
            setEditingUuid(existing.uuid);
            setTargetCount(String(existing.target_count));
        } else {
            setEditingUuid(null);
        }
    };

    const handleUserChange = (key: Key | null) => {
        const userUuid = String(key ?? "");
        setSelectedUserUuid(userUuid);
        applySelection(userUuid, period);
    };

    const handlePeriodChange = (key: Key | null) => {
        const nextPeriod = String(key) as GoalPeriod;
        setPeriod(nextPeriod);
        applySelection(selectedUserUuid, nextPeriod);
    };

    const handleEdit = (goal: MessagingGoalProgress) => {
        setAssignTab("individual");
        setSelectedUserUuid(goal.user_uuid);
        setPeriod(goal.period);
        setTargetCount(String(goal.target_count));
        setEditingUuid(goal.uuid);
    };

    const handleCancelEdit = () => {
        setEditingUuid(null);
        setSelectedUserUuid("");
        setPeriod(GoalPeriods.DAY);
        setTargetCount("20");
    };

    const handleSaveOne = () => {
        const count = Number(targetCount);
        if (!Number.isFinite(count) || count < 1) return;

        if (editingUuid) {
            update.mutate(
                { uuid: editingUuid, payload: { target_count: count } },
                {
                    onSuccess: () => {
                        setEditingUuid(null);
                        setSelectedUserUuid("");
                        setTargetCount("20");
                    },
                },
            );
            return;
        }

        if (!selectedUserUuid) return;
        upsert.mutate({
            user_uuid: selectedUserUuid,
            period,
            target_count: count,
        });
    };

    const handleBulkApply = () => {
        const count = Number(bulkTarget);
        if (!Number.isFinite(count) || count < 1 || members.length === 0) return;
        bulkUpsert.mutate({
            goals: members.map((m) => ({
                user_uuid: m.user_uuid,
                period: bulkPeriod,
                target_count: count,
            })),
        });
    };

    const isSaving = upsert.isPending || update.isPending;
    const isEditing = !!editingUuid;

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">
                            {assignTab === "bulk"
                                ? "Bulk apply"
                                : isEditing
                                  ? "Edit member goal"
                                  : "Set member goal"}
                        </h2>
                        <p className="text-xs text-muted mt-0.5">
                            {assignTab === "bulk"
                                ? "Set the same target for every organisation member."
                                : isEditing
                                  ? "Update the message target for this teammate and period."
                                  : "Assign a daily, weekly, or monthly message target to one teammate."}
                        </p>
                    </div>
                    <ScrollableTabs
                        selectedKey={assignTab}
                        onSelectionChange={(key) => setAssignTab(String(key))}
                    >
                        <ScrollableTabsList>
                            <Tabs.Tab id="individual" className={tabTriggerClassName}>
                                Individual
                            </Tabs.Tab>
                            <Tabs.Tab id="bulk" className={tabTriggerClassName}>
                                Bulk
                            </Tabs.Tab>
                        </ScrollableTabsList>
                    </ScrollableTabs>
                </div>

                {assignTab === "individual" ? (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Select
                                aria-label="Team member"
                                placeholder="Select member"
                                value={selectedUserUuid || null}
                                onChange={handleUserChange}
                                isDisabled={membersLoading}
                            >
                                <Select.Trigger className="w-full">
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {members.map((m) => (
                                            <ListBox.Item
                                                key={m.user_uuid}
                                                id={m.user_uuid}
                                                textValue={memberLabel(m)}
                                            >
                                                {memberLabel(m)}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                            <Select
                                aria-label="Period"
                                value={period}
                                onChange={handlePeriodChange}
                            >
                                <Select.Trigger className="w-full">
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {PERIOD_OPTIONS.map((opt) => (
                                            <ListBox.Item
                                                key={opt.id}
                                                id={opt.id}
                                                textValue={opt.label}
                                            >
                                                {opt.label}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                            <Input
                                aria-label="Target count"
                                type="number"
                                min={1}
                                value={targetCount}
                                onChange={(e) => setTargetCount(e.target.value)}
                                placeholder="Target"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onPress={handleSaveOne}
                                isDisabled={!selectedUserUuid || isSaving}
                            >
                                {isEditing ? "Update goal" : "Save goal"}
                            </Button>
                            {isEditing && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={handleCancelEdit}
                                    isDisabled={isSaving}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Select
                                aria-label="Bulk period"
                                value={bulkPeriod}
                                onChange={(key) => setBulkPeriod(String(key) as GoalPeriod)}
                            >
                                <Select.Trigger className="w-full">
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {PERIOD_OPTIONS.map((opt) => (
                                            <ListBox.Item
                                                key={opt.id}
                                                id={opt.id}
                                                textValue={opt.label}
                                            >
                                                {opt.label}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                            <Input
                                aria-label="Bulk target"
                                type="number"
                                min={1}
                                value={bulkTarget}
                                onChange={(e) => setBulkTarget(e.target.value)}
                            />
                        </div>
                        <div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onPress={handleBulkApply}
                                isDisabled={members.length === 0 || bulkUpsert.isPending}
                            >
                                Apply to all members
                            </Button>
                        </div>
                    </>
                )}
            </div>

            <div className="rounded-xl bg-surface overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                    <h2 className="text-sm font-semibold text-foreground">Active goals</h2>
                </div>
                {goalsLoading ? (
                    <div className="p-4 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-10 rounded-lg bg-surface-secondary animate-pulse" />
                        ))}
                    </div>
                ) : goals.length === 0 ? (
                    <p className="p-6 text-sm text-muted text-center">No active goals yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {goals.map((goal) => (
                            <li
                                key={goal.uuid}
                                className="px-4 py-3 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {goal.user.full_name?.trim() || goal.user.email}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {PERIOD_LABELS[goal.period]} · {goal.current_count}/
                                        {goal.target_count} ({goal.percent}%)
                                    </p>
                                </div>
                                <Dropdown>
                                    <Dropdown.Trigger
                                        aria-label="Goal options"
                                        className="inline-flex items-center justify-center size-8 rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Dropdown.Trigger>
                                    <Dropdown.Popover
                                        placement="bottom end"
                                        className="rounded-xl border border-border bg-surface p-1 shadow-xl outline-none backdrop-blur-none [backdrop-filter:none]"
                                    >
                                        <Dropdown.Menu
                                            className="min-w-[9rem] bg-transparent p-0 outline-none"
                                            onAction={(key) => {
                                                if (key === "edit") handleEdit(goal);
                                                if (key === "remove")
                                                    deactivate.mutate(goal.uuid);
                                            }}
                                        >
                                            <Dropdown.Item
                                                id="edit"
                                                textValue="Edit"
                                                isDisabled={isSaving}
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <Pencil
                                                        className="size-4 shrink-0 text-muted"
                                                        strokeWidth={2}
                                                    />
                                                    <span className="font-medium text-foreground">
                                                        Edit
                                                    </span>
                                                </span>
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                id="remove"
                                                textValue="Remove"
                                                isDisabled={deactivate.isPending}
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <Trash2
                                                        className="size-4 shrink-0 text-danger"
                                                        strokeWidth={2}
                                                    />
                                                    <span className="font-medium text-danger">
                                                        Remove
                                                    </span>
                                                </span>
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown.Popover>
                                </Dropdown>
                            </li>
                        ))}
                    </ul>
                )}
                {!goalsLoading && members.length > 0 && (
                    <div className="px-4 py-3 border-t border-border bg-surface-secondary/40">
                        <p className="text-xs text-muted">
                            {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
                            {goalsByKey.size} active goal assignment
                            {goalsByKey.size === 1 ? "" : "s"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
