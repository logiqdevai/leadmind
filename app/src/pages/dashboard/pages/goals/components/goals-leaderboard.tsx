import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";

interface GoalsLeaderboardProps {
    rows: LeaderboardRow[];
    isLoading: boolean;
    currentUserUuid?: string | null;
}

function displayName(row: LeaderboardRow) {
    return row.user.full_name?.trim() || row.user.email;
}

export function GoalsLeaderboard({
    rows,
    isLoading,
    currentUserUuid,
}: GoalsLeaderboardProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-surface-secondary animate-pulse" />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
                <p className="text-sm text-muted">
                    No active goals for this period yet. Set targets in Manage to start the board.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {rows.map((row) => {
                const isMe = row.user.uuid === currentUserUuid;
                const isFirst = row.rank === 1;
                return (
                    <div
                        key={row.goal_uuid}
                        className={cn(
                            "rounded-xl border bg-surface p-3.5 flex items-center gap-3",
                            isMe ? "border-accent/40" : "border-border",
                            isFirst && "ring-1 ring-amber-400/30",
                        )}
                    >
                        <div
                            className={cn(
                                "size-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold tabular-nums",
                                isFirst
                                    ? "bg-amber-500/15 text-amber-600"
                                    : "bg-surface-secondary text-muted",
                            )}
                        >
                            {isFirst ? <Crown className="size-4" /> : row.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {displayName(row)}
                                </p>
                                {isMe && (
                                    <span className="text-[10px] uppercase tracking-wide text-accent font-semibold">
                                        You
                                    </span>
                                )}
                            </div>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full",
                                        row.percent >= 100 ? "bg-green-500" : "bg-accent",
                                    )}
                                    style={{ width: `${Math.min(100, row.percent)}%` }}
                                />
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                                {row.current_count}/{row.target_count}
                            </p>
                            <p className="text-xs text-muted tabular-nums">{row.percent}%</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
