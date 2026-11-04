import { useState } from "react";
import { Button, Chip } from "@heroui/react";
import { History, Pause, Pencil, Play, ShieldAlert, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    useApplyDeliverabilityRecommendation,
    useDeleteDeliverabilitySchedule,
    useLiftDeliverabilityRestriction,
    useRunDeliverabilityScheduleNow,
    useUpdateDeliverabilitySchedule,
} from "@/features/deliverability/hooks/use-deliverability";
import type { DeliverabilitySchedule } from "@/features/deliverability/interfaces/deliverability.interface";
import { cn } from "@/lib/utils";
import {
    ACTION_MODE_OPTIONS,
    CHECK_OPTIONS,
    RISK_COLOR,
    RISK_LABEL,
    describeCadence,
    formatDateTime,
} from "../utils/deliverability.utils";

interface ScheduleCardProps {
    schedule: DeliverabilitySchedule;
    onEdit: (schedule: DeliverabilitySchedule) => void;
    onShowHistory: (schedule: DeliverabilitySchedule) => void;
}

const SCORE_TEXT: Record<string, string> = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
};

export function ScheduleCard({ schedule, onEdit, onShowHistory }: ScheduleCardProps) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const runNow = useRunDeliverabilityScheduleNow();
    const update = useUpdateDeliverabilitySchedule();
    const remove = useDeleteDeliverabilitySchedule();
    const lift = useLiftDeliverabilityRestriction();
    const applyCap = useApplyDeliverabilityRecommendation();

    const run = schedule.latest_run;
    const isRunning = run?.status === "RUNNING";
    const risk = run?.risk_level ?? null;
    const scoreColor = risk ? RISK_COLOR[risk] : "default";
    const canApplyCap =
        run?.status === "COMPLETED" &&
        run.recommended_daily_cap != null &&
        run.action_taken === "RECOMMENDED" &&
        schedule.integration_account_uuid != null;
    const actionLabel = ACTION_MODE_OPTIONS.find((o) => o.id === schedule.action_mode)?.label;

    return (
        <article
            className={cn(
                "rounded-xl border border-border bg-surface p-4 space-y-3",
                !schedule.is_active && "opacity-70",
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                            {schedule.label || schedule.domain}
                        </h3>
                        {!schedule.is_active ? (
                            <Chip size="sm" variant="soft">
                                <Chip.Label>Paused</Chip.Label>
                            </Chip>
                        ) : null}
                    </div>
                    <p className="text-xs text-muted font-mono truncate">
                        {schedule.domain}
                        {schedule.from_provider
                            ? ` · ${schedule.from_provider} ${schedule.from_account}`
                            : " · custom domain"}
                    </p>
                    <p className="text-xs text-muted">{describeCadence(schedule)}</p>
                </div>

                <div className="shrink-0 text-right">
                    {run?.score != null ? (
                        <>
                            <p className={cn("text-3xl font-semibold tabular-nums", SCORE_TEXT[scoreColor])}>
                                {run.score}
                            </p>
                            {risk ? (
                                <Chip size="sm" variant="soft" color={scoreColor}>
                                    <Chip.Label>{RISK_LABEL[risk]}</Chip.Label>
                                </Chip>
                            ) : null}
                        </>
                    ) : (
                        <p className="text-sm text-muted">{isRunning ? "Running…" : "No score yet"}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {schedule.checks.map((check) => (
                    <Chip key={check} size="sm" variant="soft">
                        <Chip.Label>{CHECK_OPTIONS.find((o) => o.id === check)?.label ?? check}</Chip.Label>
                    </Chip>
                ))}
                {actionLabel ? (
                    <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label>{actionLabel}</Chip.Label>
                    </Chip>
                ) : null}
            </div>

            {run?.status === "FAILED" ? (
                <p className="text-xs text-danger">Last run failed: {run.error_message}</p>
            ) : run?.summary ? (
                <p className="text-xs text-foreground/80">{run.summary}</p>
            ) : null}

            {schedule.guard ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                    <p className="flex items-center gap-2 text-xs text-foreground">
                        <ShieldAlert className="size-4 text-warning shrink-0" />
                        {schedule.guard.paused
                            ? "Sending from this domain is paused."
                            : `Sending is capped at ${schedule.guard.daily_cap} per day.`}
                    </p>
                    <Button
                        size="sm"
                        variant="tertiary"
                        isDisabled={lift.isPending}
                        onPress={() => lift.mutate(schedule.uuid)}
                    >
                        Lift restriction
                    </Button>
                </div>
            ) : canApplyCap ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary/40 px-3 py-2">
                    <p className="text-xs text-foreground">
                        Recommended: send at most{" "}
                        <span className="font-semibold">{run.recommended_daily_cap}</span> emails per day.
                    </p>
                    <Button
                        size="sm"
                        variant="secondary"
                        isDisabled={applyCap.isPending}
                        onPress={() => applyCap.mutate(run.uuid)}
                    >
                        Apply cap
                    </Button>
                </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted">Last run {formatDateTime(schedule.last_run_at)}</p>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="tertiary"
                        isDisabled={runNow.isPending || isRunning}
                        onPress={() => runNow.mutate(schedule.uuid)}
                    >
                        <Play className="size-3.5" />
                        Run now
                    </Button>
                    <Button size="sm" variant="tertiary" onPress={() => onShowHistory(schedule)}>
                        <History className="size-3.5" />
                        History
                    </Button>
                    <Button
                        size="sm"
                        variant="tertiary"
                        aria-label={schedule.is_active ? "Pause schedule" : "Resume schedule"}
                        isDisabled={update.isPending}
                        onPress={() =>
                            update.mutate({
                                uuid: schedule.uuid,
                                payload: { is_active: !schedule.is_active },
                            })
                        }
                    >
                        {schedule.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                        {schedule.is_active ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="tertiary" aria-label="Edit" onPress={() => onEdit(schedule)}>
                        <Pencil className="size-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="tertiary"
                        aria-label="Delete"
                        onPress={() => setConfirmingDelete(true)}
                    >
                        <Trash2 className="size-3.5 text-danger" />
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title="Delete this schedule?"
                description="Its run history is deleted, and any sending restriction it applied is lifted."
                confirmLabel="Delete"
                variant="danger"
                isPending={remove.isPending}
                onConfirm={async () => {
                    await remove.mutateAsync(schedule.uuid);
                }}
            />
        </article>
    );
}
