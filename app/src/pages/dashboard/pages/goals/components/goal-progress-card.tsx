import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessagingGoalProgress } from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import { PERIOD_LABELS } from "../utils/goals-copy";

const PERIOD_ICONS = {
    DAY: Calendar,
    WEEK: CalendarDays,
    MONTH: CalendarRange,
} as const;

interface GoalProgressCardProps {
    goal: MessagingGoalProgress;
}

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
    const Icon = PERIOD_ICONS[goal.period];
    const complete = goal.percent >= 100;

    return (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                            {PERIOD_LABELS[goal.period]} goal
                        </p>
                        <p className="text-xs text-muted truncate">{goal.period_key}</p>
                    </div>
                </div>
                <span
                    className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-md",
                        complete
                            ? "bg-green-500/10 text-green-600"
                            : "bg-surface-secondary text-muted",
                    )}
                >
                    {complete ? "Complete" : `${goal.percent}%`}
                </span>
            </div>

            <div className="flex items-end justify-between gap-2">
                <p className="text-2xl font-bold tabular-nums text-foreground leading-none">
                    {goal.current_count}
                    <span className="text-sm font-medium text-muted"> / {goal.target_count}</span>
                </p>
                <p className="text-xs text-muted">messages sent</p>
            </div>

            <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-500",
                        complete ? "bg-green-500" : "bg-accent",
                    )}
                    style={{ width: `${Math.min(100, goal.percent)}%` }}
                />
            </div>
        </div>
    );
}
