import { useState, type FC } from "react";
import { ListBox, Select, Tabs } from "@heroui/react";
import { Trophy } from "lucide-react";
import {
    useMessagingGoalsLeaderboard,
    useMyMessagingGoals,
} from "@/features/messaging-goals/hooks/use-messaging-goals";
import {
    GoalPeriods,
    type GoalPeriod,
} from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import { useOrganisationPermission } from "@/hooks/use-organisation-permission";
import { useAuthStore } from "@/stores/auth";
import { GoalProgressCard } from "./components/goal-progress-card";
import { GoalsLeaderboard } from "./components/goals-leaderboard";
import { GoalsManagePanel } from "./components/goals-manage-panel";
import { PERIOD_LABELS } from "./utils/goals-copy";

const TAB_CLASS =
    "px-3 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors text-muted hover:text-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap";

const GoalsPage: FC = () => {
    const canManage = useOrganisationPermission("org_manage_goals");
    const currentUserUuid = useAuthStore((s) => s.user_uuid);
    const [tab, setTab] = useState("progress");
    const [leaderboardPeriod, setLeaderboardPeriod] = useState<GoalPeriod>(GoalPeriods.DAY);

    const { data: myGoals = [], isLoading: myLoading } = useMyMessagingGoals();
    const { data: leaderboard = [], isLoading: boardLoading } =
        useMessagingGoalsLeaderboard(leaderboardPeriod);

    const tabs = [
        { id: "progress", label: "My Progress" },
        { id: "leaderboard", label: "Leaderboard" },
        ...(canManage ? [{ id: "manage", label: "Manage" }] : []),
    ];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
                <Trophy className="size-5 text-muted" />
                <h1 className="text-xl font-semibold text-foreground">Goals</h1>
            </div>

            <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
                <Tabs.List className="inline-flex gap-1 rounded-lg bg-surface-secondary p-1 border border-border overflow-x-auto max-w-full">
                    {tabs.map((t) => (
                        <Tabs.Tab key={t.id} id={t.id} className={TAB_CLASS}>
                            {t.label}
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs>

            {tab === "progress" && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                        Track your messaging targets in real time. Counts include 1:1 outreach you
                        send.
                    </p>
                    {myLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-36 rounded-xl bg-surface-secondary animate-pulse"
                                />
                            ))}
                        </div>
                    ) : myGoals.length === 0 ? (
                        <div className="rounded-xl border border-border bg-surface p-8 text-center">
                            <p className="text-sm text-muted">
                                No active goals assigned yet.
                                {canManage
                                    ? " Use Manage to set targets for your team."
                                    : " Ask an org admin to set your targets."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {myGoals.map((goal) => (
                                <GoalProgressCard key={goal.uuid} goal={goal} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === "leaderboard" && (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">
                            See how the team stacks up for the selected period.
                        </p>
                        <Select
                            aria-label="Leaderboard period"
                            value={leaderboardPeriod}
                            onChange={(key) =>
                                setLeaderboardPeriod(String(key) as GoalPeriod)
                            }
                            className="w-40"
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {(
                                        [
                                            GoalPeriods.DAY,
                                            GoalPeriods.WEEK,
                                            GoalPeriods.MONTH,
                                        ] as GoalPeriod[]
                                    ).map((p) => (
                                        <ListBox.Item key={p} id={p} textValue={PERIOD_LABELS[p]}>
                                            {PERIOD_LABELS[p]}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                    <GoalsLeaderboard
                        rows={leaderboard}
                        isLoading={boardLoading}
                        currentUserUuid={currentUserUuid}
                    />
                </div>
            )}

            {tab === "manage" && canManage && <GoalsManagePanel />}
        </div>
    );
};

export default GoalsPage;
