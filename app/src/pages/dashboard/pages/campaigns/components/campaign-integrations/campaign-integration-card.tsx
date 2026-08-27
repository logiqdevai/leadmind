import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Chip, Switch } from "@heroui/react";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CampaignIntegration } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import { CampaignIntegrationStatus } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import {
    campaignIntegrationsQueryKeys,
    useCampaignIntegrationCapacity,
} from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { formatSendingPolicyStages } from "@/features/sending-policy/utils/format-sending-policy";
import type { ForecastDay } from "@/features/campaign-integrations/utils/sending-forecast.util";
import { EditSendingPolicyModal } from "../sending-policy/edit-sending-policy-modal";

interface CampaignIntegrationCardProps {
    campaignUuid: string;
    campaignIntegration: CampaignIntegration;
    /** Projected sends for the next couple of weeks, sharing the campaign's remaining contact
     * pool with every other active account - undefined while its forecast hasn't loaded yet. */
    forecast?: { days: ForecastDay[]; total: number };
    onToggleStatus: (status: "ACTIVE" | "PAUSED") => void;
    onRemove: () => void;
    isRemoving?: boolean;
    disabled?: boolean;
}

const FORECAST_DAY_LABEL = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatForecastDay(isoDate: string): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    return FORECAST_DAY_LABEL.format(new Date(year, month - 1, day));
}

export function CampaignIntegrationCard({
    campaignUuid,
    campaignIntegration: ci,
    forecast,
    onToggleStatus,
    onRemove,
    isRemoving = false,
    disabled = false,
}: CampaignIntegrationCardProps) {
    const qc = useQueryClient();
    const isActive = ci.status === CampaignIntegrationStatus.ACTIVE;
    const capacity = useCampaignIntegrationCapacity(campaignUuid, isActive ? ci.uuid : null);
    const [showEditPolicy, setShowEditPolicy] = useState(false);
    const [showConfirmRemove, setShowConfirmRemove] = useState(false);

    return (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                            {ci.integration_account.title}
                        </span>
                        <Chip size="sm" variant="soft">
                            <Chip.Label>{ci.integration_account.integration.provider}</Chip.Label>
                        </Chip>
                    </div>
                    {ci.integration_account_domain ? (
                        <p className="mt-0.5 text-xs text-muted truncate">
                            {ci.integration_account_domain.from_email}
                        </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted truncate">
                        {formatSendingPolicyStages(ci.sending_policy)}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                        isSelected={isActive}
                        onChange={(v) =>
                            onToggleStatus(
                                (typeof v === "boolean" ? v : !isActive) ? "ACTIVE" : "PAUSED",
                            )
                        }
                        isDisabled={disabled}
                        aria-label={isActive ? "Pause" : "Resume"}
                    >
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch>
                    <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => setShowEditPolicy(true)}
                        isDisabled={disabled}
                        aria-label="Edit sending schedule"
                    >
                        <Pencil className="size-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => setShowConfirmRemove(true)}
                        isDisabled={disabled}
                        aria-label="Remove integration"
                    >
                        <Trash2 className="size-4 text-danger" />
                    </Button>
                </div>
            </div>

            {isActive && capacity.data ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted border-t border-border pt-2">
                    {capacity.data.current_stage ? (
                        <span>
                            Sent {capacity.data.stage_used ?? 0}/{capacity.data.current_stage.limit} this{" "}
                            {capacity.data.current_stage.period_unit.toLowerCase()}
                        </span>
                    ) : (
                        <span>Not started yet</span>
                    )}
                    <span>
                        Next send:{" "}
                        {new Date(capacity.data.next_eligible_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
            ) : !isActive ? (
                <p className="text-xs text-muted border-t border-border pt-2">Paused</p>
            ) : null}

            {isActive && forecast && forecast.days.length > 0 ? (
                <div className="border-t border-border pt-2">
                    <p className="mb-1.5 text-xs text-muted">
                        Projected sends over the next {forecast.days.length} days — {forecast.total} total
                        (shares the campaign's remaining contacts with every other active account):
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                        {forecast.days.map((day) => (
                            <span
                                key={day.date}
                                className="shrink-0 rounded-md bg-surface-secondary px-1.5 py-1 text-[11px] text-foreground/90 tabular-nums"
                            >
                                {formatForecastDay(day.date)} · {day.count}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <EditSendingPolicyModal
                isOpen={showEditPolicy}
                onOpenChange={setShowEditPolicy}
                policy={ci.sending_policy}
                onSaved={() => {
                    void qc.invalidateQueries({ queryKey: campaignIntegrationsQueryKeys.list(campaignUuid) });
                }}
            />

            <ConfirmDialog
                isOpen={showConfirmRemove}
                onOpenChange={setShowConfirmRemove}
                title="Remove this sending integration?"
                description={
                    <>
                        <span className="font-medium text-foreground">{ci.integration_account.title}</span>{" "}
                        will stop sending for this campaign. This can't be undone, though you can add it back
                        later with a new schedule.
                    </>
                }
                confirmLabel="Remove"
                variant="danger"
                isPending={isRemoving}
                onConfirm={onRemove}
            />
        </div>
    );
}
