import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import {
    useCampaignIntegrations,
    useRemoveCampaignIntegration,
    useUpdateCampaignIntegrationStatus,
} from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { CampaignIntegrationCard } from "./campaign-integration-card";
import { AssignIntegrationModal } from "./assign-integration-modal";

interface CampaignIntegrationPickerProps {
    campaignUuid: string;
    disabled?: boolean;
}

export function CampaignIntegrationPicker({ campaignUuid, disabled = false }: CampaignIntegrationPickerProps) {
    const { data: campaignIntegrations, isLoading } = useCampaignIntegrations(campaignUuid);
    const updateStatus = useUpdateCampaignIntegrationStatus(campaignUuid);
    const removeMutation = useRemoveCampaignIntegration(campaignUuid);
    const [showAssignModal, setShowAssignModal] = useState(false);

    const assignedAccountUuids = useMemo(
        () => new Set((campaignIntegrations ?? []).map((ci) => ci.integration_account_uuid)),
        [campaignIntegrations],
    );

    if (isLoading) {
        return (
            <div className="space-y-2 animate-pulse" aria-hidden>
                <div className="h-20 rounded-xl bg-surface-secondary" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-foreground">Sending schedule</p>
                    <p className="text-xs text-muted">
                        Assign one or more email accounts, each with its own sending policy. The campaign
                        sends gradually according to each account's schedule.
                    </p>
                </div>
                <Button size="sm" variant="tertiary" onPress={() => setShowAssignModal(true)} isDisabled={disabled}>
                    <Plus className="size-4" /> Add
                </Button>
            </div>

            {!campaignIntegrations?.length ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-6 text-center text-sm text-muted">
                    No sending integrations assigned yet. Add at least one to start this campaign.
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {campaignIntegrations.map((ci) => (
                        <CampaignIntegrationCard
                            key={ci.uuid}
                            campaignUuid={campaignUuid}
                            campaignIntegration={ci}
                            disabled={disabled || updateStatus.isPending || removeMutation.isPending}
                            onToggleStatus={(status) => updateStatus.mutate({ ciUuid: ci.uuid, payload: { status } })}
                            onRemove={() => removeMutation.mutate(ci.uuid)}
                        />
                    ))}
                </div>
            )}

            <AssignIntegrationModal
                isOpen={showAssignModal}
                onOpenChange={setShowAssignModal}
                campaignUuid={campaignUuid}
                assignedAccountUuids={assignedAccountUuids}
            />
        </div>
    );
}
