import { Chip, Modal } from "@heroui/react";
import { Link } from "react-router-dom";
import { useDeliverabilityRuns } from "@/features/deliverability/hooks/use-deliverability";
import type { DeliverabilitySchedule } from "@/features/deliverability/interfaces/deliverability.interface";
import { Routes } from "@/routes/routes";
import {
    ACTION_TAKEN_LABEL,
    RISK_COLOR,
    RISK_LABEL,
    formatDateTime,
} from "../utils/deliverability.utils";

interface RunHistoryModalProps {
    schedule: DeliverabilitySchedule | null;
    onOpenChange: (open: boolean) => void;
}

export function RunHistoryModal({ schedule, onOpenChange }: RunHistoryModalProps) {
    const { data: runs, isLoading } = useDeliverabilityRuns(schedule?.uuid ?? null);

    return (
        <Modal.Backdrop isOpen={schedule != null} onOpenChange={onOpenChange}>
            <Modal.Container scroll="inside">
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Run history · {schedule?.label || schedule?.domain}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-3">
                        {isLoading ? (
                            <div className="h-32 animate-pulse rounded-lg bg-surface-secondary/40" />
                        ) : !runs?.length ? (
                            <p className="py-6 text-center text-sm text-muted">No runs yet.</p>
                        ) : (
                            runs.map((run) => (
                                <div key={run.uuid} className="rounded-lg border border-border p-3 space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-muted">{formatDateTime(run.created_at)}</p>
                                        {run.status === "COMPLETED" && run.risk_level ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-semibold tabular-nums text-foreground">
                                                    {run.score}
                                                </span>
                                                <Chip size="sm" variant="soft" color={RISK_COLOR[run.risk_level]}>
                                                    <Chip.Label>{RISK_LABEL[run.risk_level]}</Chip.Label>
                                                </Chip>
                                            </div>
                                        ) : (
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                color={run.status === "FAILED" ? "danger" : "default"}
                                            >
                                                <Chip.Label>
                                                    {run.status === "FAILED" ? "Failed" : "Running"}
                                                </Chip.Label>
                                            </Chip>
                                        )}
                                    </div>
                                    {run.error_message ? (
                                        <p className="text-xs text-danger">{run.error_message}</p>
                                    ) : null}
                                    {run.summary ? (
                                        <p className="text-xs text-foreground/80">{run.summary}</p>
                                    ) : null}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                                        {run.action_taken ? <span>{ACTION_TAKEN_LABEL[run.action_taken]}</span> : null}
                                        {run.recommended_daily_cap != null ? (
                                            <span>Suggested cap {run.recommended_daily_cap}/day</span>
                                        ) : null}
                                        {run.scored_by ? (
                                            <span>
                                                Scored by {run.scored_by === "jev" ? "Jev" : "rules"}
                                                {run.jev_confidence != null
                                                    ? ` (${Math.round(run.jev_confidence * 100)}% confident)`
                                                    : ""}
                                            </span>
                                        ) : null}
                                        {run.mxtoolbox_check_uuid ? (
                                            <Link to={Routes.dashboard.mxtoolbox} className="text-accent hover:underline">
                                                Domain health
                                            </Link>
                                        ) : null}
                                        {run.mail_tester_test_uuid ? (
                                            <Link to={Routes.dashboard.mail_tester} className="text-accent hover:underline">
                                                Spam test
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
