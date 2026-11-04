import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import {
    listReadyEmailAccounts,
    resolveDefaultEmailTarget,
} from "@/features/integrations/utils/email-provider-utils";
import { useDeliverabilitySchedules } from "@/features/deliverability/hooks/use-deliverability";
import type { DeliverabilitySchedule } from "@/features/deliverability/interfaces/deliverability.interface";
import { Routes } from "@/routes/routes";
import { RunHistoryModal } from "./components/run-history-modal";
import { ScheduleCard } from "./components/schedule-card";
import { ScheduleFormModal } from "./components/schedule-form-modal";

export default function DeliverabilityMonitorPage() {
    const { data: integrations } = useIntegrations();
    const { data: schedules, isLoading } = useDeliverabilitySchedules();

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<DeliverabilitySchedule | null>(null);
    const [historyUuid, setHistoryUuid] = useState<string | null>(null);

    const accounts = useMemo(() => listReadyEmailAccounts(integrations), [integrations]);
    const defaultTarget = useMemo(() => resolveDefaultEmailTarget(integrations), [integrations]);

    // Look up by uuid so the open modals reflect refetched data.
    const historySchedule = schedules?.find((row) => row.uuid === historyUuid) ?? null;

    const hasIntegration = (provider: string) =>
        Boolean(integrations?.find((row) => row.provider === provider)?.keys.length);
    const missing = [
        !hasIntegration("MXTOOLBOX") && "MxToolbox (DNS checks)",
        !hasIntegration("MAILTESTER") && "Mail-Tester (spam test)",
    ].filter(Boolean);
    const hasJev = hasIntegration("TYPESAFE");

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEdit = (schedule: DeliverabilitySchedule) => {
        setEditing(schedule);
        setFormOpen(true);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold text-foreground">Deliverability monitor</h1>
                    <p className="text-sm text-muted max-w-2xl">
                        Run DNS, blacklist and spam checks on a schedule. Each run produces a 0–100 score
                        you can use to cap or pause sending before reputation damage sticks.
                    </p>
                </div>
                <Button size="sm" variant="secondary" onPress={openCreate}>
                    <Plus className="size-4" />
                    New check
                </Button>
            </header>

            {missing.length > 0 || !hasJev ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-4 text-sm text-muted space-y-1">
                    {missing.length > 0 ? (
                        <p>
                            Connect {missing.join(" and ")} under{" "}
                            <Link to={Routes.dashboard.integrations} className="text-accent hover:underline">
                                Integrations
                            </Link>{" "}
                            for those checks to run.
                        </p>
                    ) : null}
                    {!hasJev ? (
                        <p>
                            Add a TypeSafe key to have Jev judge the results. Without it, a rule-based
                            score is used.
                        </p>
                    ) : null}
                </div>
            ) : null}

            {isLoading ? (
                <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
            ) : !schedules?.length ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-8 text-center text-sm text-muted">
                    No scheduled checks yet. Create one to start monitoring a domain.
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {schedules.map((schedule) => (
                        <ScheduleCard
                            key={schedule.uuid}
                            schedule={schedule}
                            onEdit={openEdit}
                            onShowHistory={(row) => setHistoryUuid(row.uuid)}
                        />
                    ))}
                </div>
            )}

            {formOpen ? (
                <ScheduleFormModal
                    key={editing?.uuid ?? "new"}
                    isOpen
                    onOpenChange={setFormOpen}
                    accounts={accounts}
                    defaultTarget={defaultTarget}
                    schedule={editing}
                />
            ) : null}
            <RunHistoryModal
                schedule={historySchedule}
                onOpenChange={(open) => {
                    if (!open) setHistoryUuid(null);
                }}
            />
        </div>
    );
}
