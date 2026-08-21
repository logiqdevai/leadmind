import { Button, Chip, Switch } from "@heroui/react";
import { Trash2 } from "lucide-react";
import type { CampaignIntegration } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import { CampaignIntegrationStatus } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import { useCampaignIntegrationCapacity } from "@/features/campaign-integrations/hooks/use-campaign-integrations";

function formatStages(policy: CampaignIntegration["sending_policy"]): string {
    const ordered = [...policy.stages].sort((a, b) => a.order_index - b.order_index);
    return ordered
        .map((stage) => {
            const rate = `${stage.limit}/${stage.period_unit.toLowerCase()}`;
            if (stage.duration_value == null || stage.duration_unit == null) return rate;
            return `${rate} × ${stage.duration_value} ${stage.duration_unit.toLowerCase()}${stage.duration_value === 1 ? "" : "s"}`;
        })
        .join(" → ");
}

interface CampaignIntegrationCardProps {
    campaignUuid: string;
    campaignIntegration: CampaignIntegration;
    onToggleStatus: (status: "ACTIVE" | "PAUSED") => void;
    onRemove: () => void;
    disabled?: boolean;
}

export function CampaignIntegrationCard({
    campaignUuid,
    campaignIntegration: ci,
    onToggleStatus,
    onRemove,
    disabled = false,
}: CampaignIntegrationCardProps) {
    const isActive = ci.status === CampaignIntegrationStatus.ACTIVE;
    const capacity = useCampaignIntegrationCapacity(campaignUuid, isActive ? ci.uuid : null);

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
                    <p className="mt-1 text-xs text-muted truncate">{formatStages(ci.sending_policy)}</p>
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
                        onPress={onRemove}
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
        </div>
    );
}
