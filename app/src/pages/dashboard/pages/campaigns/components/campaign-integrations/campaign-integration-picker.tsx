import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { AlertTriangle, Info, Plus } from "lucide-react";
import {
    useCampaignIntegrations,
    useRemoveCampaignIntegration,
    useUpdateCampaignIntegrationStatus,
} from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { CampaignIntegrationStatus } from "@/features/campaign-integrations/interfaces/campaign-integration.interface";
import { firstStageDailyCapacity } from "@/features/sending-policy/utils/sending-policy-validation";
import { CampaignIntegrationCard } from "./campaign-integration-card";
import { AssignIntegrationModal } from "./assign-integration-modal";

/** Estimated days-to-complete above this is called out as a warning, not just an estimate. */
const SLOW_PACE_DAY_THRESHOLD = 60;

interface CampaignIntegrationPickerProps {
    campaignUuid: string;
    /** Contacts this campaign will email, if known, used to validate against combined capacity. */
    totalContacts?: number;
    disabled?: boolean;
}

export function CampaignIntegrationPicker({
    campaignUuid,
    totalContacts,
    disabled = false,
}: CampaignIntegrationPickerProps) {
    const { data: campaignIntegrations, isLoading } = useCampaignIntegrations(campaignUuid);
    const updateStatus = useUpdateCampaignIntegrationStatus(campaignUuid);
    const removeMutation = useRemoveCampaignIntegration(campaignUuid);
    const [showAssignModal, setShowAssignModal] = useState(false);

    const assignedAccountUuids = useMemo(
        () => new Set((campaignIntegrations ?? []).map((ci) => ci.integration_account_uuid)),
        [campaignIntegrations],
    );

    const capacityMessage = useMemo(() => {
        if (!totalContacts || totalContacts <= 0) return null;

        const active = (campaignIntegrations ?? []).filter(
            (ci) => ci.status === CampaignIntegrationStatus.ACTIVE,
        );
        if (active.length === 0) {
            return {
                variant: "warning" as const,
                text: `${totalContacts} contact${totalContacts === 1 ? "" : "s"} to send, but no active sending integration is assigned yet.`,
            };
        }

        const combinedDailyCapacity = active.reduce(
            (sum, ci) => sum + firstStageDailyCapacity(ci.sending_policy),
            0,
        );
        if (combinedDailyCapacity <= 0) {
            return {
                variant: "warning" as const,
                text: "Assigned integrations have no sending capacity configured — check their policy stages.",
            };
        }

        const roundedCapacity = Math.round(combinedDailyCapacity);
        const estimatedDays = Math.ceil(totalContacts / combinedDailyCapacity);
        return {
            variant: estimatedDays > SLOW_PACE_DAY_THRESHOLD ? ("warning" as const) : ("info" as const),
            text: `${totalContacts} contact${totalContacts === 1 ? "" : "s"} to send. Starting combined capacity: ~${roundedCapacity}/day across ${active.length} integration${active.length === 1 ? "" : "s"} — about ${estimatedDays} day${estimatedDays === 1 ? "" : "s"} to complete at this pace (ramps up as configured; provider limits, pauses, and failures can affect actual delivery).`,
        };
    }, [campaignIntegrations, totalContacts]);

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

            {capacityMessage ? (
                <p
                    className={`flex items-start gap-1.5 text-xs ${capacityMessage.variant === "warning" ? "text-warning" : "text-muted"}`}
                >
                    {capacityMessage.variant === "warning" ? (
                        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    ) : (
                        <Info className="size-3.5 shrink-0 mt-0.5" />
                    )}
                    <span>{capacityMessage.text}</span>
                </p>
            ) : null}

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
