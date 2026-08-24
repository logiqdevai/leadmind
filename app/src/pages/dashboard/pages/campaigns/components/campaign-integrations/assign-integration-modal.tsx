import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Label, ListBox, Modal, Select } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { listReadyEmailAccounts } from "@/features/integrations/utils/email-provider-utils";
import { createSendingPolicy } from "@/features/sending-policy/services/sending-policy.service";
import { sendingPoliciesQueryKeys, useSendingPolicies } from "@/features/sending-policy/hooks/use-sending-policies";
import { useSendingPolicyForm } from "@/features/sending-policy/hooks/use-sending-policy-form";
import { formatSendingPolicyStages } from "@/features/sending-policy/utils/format-sending-policy";
import {
    useAssignCampaignIntegration,
    useCampaignIntegrationsForOrganisation,
} from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { useQueryClient } from "@tanstack/react-query";
import { SendingPolicyFields } from "../sending-policy/sending-policy-fields";
import { EditSendingPolicyModal } from "../sending-policy/edit-sending-policy-modal";

interface AssignIntegrationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaignUuid: string;
    assignedAccountUuids: Set<string>;
}

export function AssignIntegrationModal({
    isOpen,
    onOpenChange,
    campaignUuid,
    assignedAccountUuids,
}: AssignIntegrationModalProps) {
    const qc = useQueryClient();
    const { data: integrations } = useIntegrations();
    const { data: policies } = useSendingPolicies();
    const { data: otherCampaignIntegrations } = useCampaignIntegrationsForOrganisation(campaignUuid);
    const assignMutation = useAssignCampaignIntegration(campaignUuid);

    const [accountUuid, setAccountUuid] = useState<string | null>(null);
    const [domainUuid, setDomainUuid] = useState<string | undefined>(undefined);
    const [policyMode, setPolicyMode] = useState<"existing" | "copy" | "new">("existing");
    const [policyUuid, setPolicyUuid] = useState<string | null>(null);
    const [copiedCiUuid, setCopiedCiUuid] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showEditPolicy, setShowEditPolicy] = useState(false);
    const wasOpenRef = useRef(false);

    const templates = (policies ?? []).filter((p) => p.is_template);
    const copySources = otherCampaignIntegrations ?? [];
    const selectedTemplate = templates.find((p) => p.uuid === policyUuid) ?? null;

    const newPolicyForm = useSendingPolicyForm(null, isOpen);

    const availableAccounts = useMemo(
        () =>
            listReadyEmailAccounts(integrations).filter(
                (row) => row.uuid && !assignedAccountUuids.has(row.uuid),
            ),
        [integrations, assignedAccountUuids],
    );

    const rowKey = (row: { uuid: string | null; domain_uuid?: string }) =>
        `${row.uuid ?? ""}::${row.domain_uuid ?? ""}`;
    const selectedRowKey =
        accountUuid !== null ? rowKey({ uuid: accountUuid, domain_uuid: domainUuid }) : undefined;

    useLayoutEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            setShowEditPolicy(false);
            return;
        }
        if (!wasOpenRef.current) {
            setAccountUuid(null);
            setDomainUuid(undefined);
            setPolicyUuid(null);
            setCopiedCiUuid(null);
            setPolicyMode(templates.length > 0 ? "existing" : copySources.length > 0 ? "copy" : "new");
        }
        wasOpenRef.current = isOpen;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const canAssign =
        !!accountUuid &&
        (policyMode === "existing"
            ? !!policyUuid
            : policyMode === "copy"
              ? !!copiedCiUuid
              : newPolicyForm.isValid) &&
        !isSaving;

    const handleAssign = async () => {
        if (!accountUuid) return;

        let resolvedPolicyUuid = policyMode === "copy" ? null : policyUuid;
        setIsSaving(true);
        try {
            if (policyMode === "new") {
                if (!newPolicyForm.isValid) return;
                const created = await createSendingPolicy({
                    ...newPolicyForm.toMeta(),
                    stages: newPolicyForm.stages,
                });
                resolvedPolicyUuid = created.uuid;
                await qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });
            } else if (policyMode === "copy") {
                // The backend clones whatever policy uuid it's given on assign, so
                // "copying" is just assigning with the source campaign integration's
                // (already-cloned) policy - it gets cloned again, fresh, for this one.
                const source = copySources.find((ci) => ci.uuid === copiedCiUuid);
                if (!source) return;
                resolvedPolicyUuid = source.sending_policy_uuid;
            }

            if (!resolvedPolicyUuid) return;

            await assignMutation.mutateAsync({
                integration_account_uuid: accountUuid,
                ...(domainUuid ? { integration_account_domain_uuid: domainUuid } : {}),
                sending_policy_uuid: resolvedPolicyUuid,
            });
            setAccountUuid(null);
            setDomainUuid(undefined);
            setPolicyUuid(null);
            setCopiedCiUuid(null);
            onOpenChange(false);
        } catch (error: unknown) {
            toast({
                title: "Could not save policy",
                description: error instanceof Error ? error.message : "Please try again.",
                variant: "error",
                duration: 4000,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Modal.Container size="lg">
                    <Modal.Dialog className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Add sending integration</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-5 overflow-y-auto flex-1 pb-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Email account</Label>
                                {availableAccounts.length === 0 ? (
                                    <p className="text-xs text-muted">No unassigned, ready email accounts found.</p>
                                ) : (
                                    <Select
                                        aria-label="Email account"
                                        value={selectedRowKey}
                                        onChange={(v) => {
                                            if (typeof v !== "string") return;
                                            const row = availableAccounts.find((item) => rowKey(item) === v);
                                            if (!row) return;
                                            setAccountUuid(row.uuid);
                                            setDomainUuid(row.domain_uuid);
                                        }}
                                        placeholder="Choose an account…"
                                        isDisabled={isSaving}
                                    >
                                        <Select.Trigger>
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                {availableAccounts.map((row) => (
                                                    <ListBox.Item
                                                        key={rowKey(row)}
                                                        id={rowKey(row)}
                                                        textValue={row.label}
                                                    >
                                                        {row.detail ? `${row.label} — ${row.detail}` : row.label}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <Label>Sending policy</Label>
                                    {templates.length > 0 || copySources.length > 0 ? (
                                        <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-0.5">
                                            {templates.length > 0 ? (
                                                <Button
                                                    size="sm"
                                                    variant={policyMode === "existing" ? "primary" : "tertiary"}
                                                    onPress={() => setPolicyMode("existing")}
                                                    isDisabled={isSaving}
                                                    className="h-7 px-2.5"
                                                >
                                                    Use existing
                                                </Button>
                                            ) : null}
                                            {copySources.length > 0 ? (
                                                <Button
                                                    size="sm"
                                                    variant={policyMode === "copy" ? "primary" : "tertiary"}
                                                    onPress={() => setPolicyMode("copy")}
                                                    isDisabled={isSaving}
                                                    className="h-7 px-2.5"
                                                >
                                                    Copy from campaign
                                                </Button>
                                            ) : null}
                                            <Button
                                                size="sm"
                                                variant={policyMode === "new" ? "primary" : "tertiary"}
                                                onPress={() => setPolicyMode("new")}
                                                isDisabled={isSaving}
                                                className="h-7 px-2.5"
                                            >
                                                Create new
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>

                                {policyMode === "existing" ? (
                                    templates.length === 0 ? (
                                        <p className="text-xs text-muted">No sending policy templates yet — create one below.</p>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Select
                                                aria-label="Sending policy"
                                                value={policyUuid ?? undefined}
                                                onChange={(v) => {
                                                    if (typeof v === "string") setPolicyUuid(v);
                                                }}
                                                placeholder="Choose a policy…"
                                                isDisabled={isSaving}
                                                className="flex-1"
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {templates.map((policy) => (
                                                            <ListBox.Item
                                                                key={policy.uuid}
                                                                id={policy.uuid}
                                                                textValue={policy.name}
                                                            >
                                                                {policy.name}
                                                                <ListBox.ItemIndicator />
                                                            </ListBox.Item>
                                                        ))}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>
                                            <Button
                                                size="sm"
                                                variant="tertiary"
                                                onPress={() => setShowEditPolicy(true)}
                                                isDisabled={!selectedTemplate || isSaving}
                                                aria-label="Edit sending policy"
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                        </div>
                                    )
                                ) : policyMode === "copy" ? (
                                    <div className="space-y-2">
                                        {copySources.length === 0 ? (
                                            <p className="text-xs text-muted">
                                                No other campaigns have a sending integration configured yet.
                                            </p>
                                        ) : (
                                            <Select
                                                aria-label="Copy sending policy from campaign"
                                                value={copiedCiUuid ?? undefined}
                                                onChange={(v) => {
                                                    if (typeof v === "string") setCopiedCiUuid(v);
                                                }}
                                                placeholder="Choose a campaign's schedule…"
                                                isDisabled={isSaving}
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {copySources.map((ci) => {
                                                            const domainSuffix = ci.integration_account_domain
                                                                ? ` · ${ci.integration_account_domain.from_email}`
                                                                : "";
                                                            const label = `${ci.campaign.name} — ${ci.integration_account.title}${domainSuffix} (${ci.integration_account.integration.provider})`;
                                                            return (
                                                                <ListBox.Item key={ci.uuid} id={ci.uuid} textValue={label}>
                                                                    {label}
                                                                    <ListBox.ItemIndicator />
                                                                </ListBox.Item>
                                                            );
                                                        })}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>
                                        )}
                                        {(() => {
                                            const selected = copySources.find((ci) => ci.uuid === copiedCiUuid);
                                            if (!selected) return null;
                                            return (
                                                <p className="text-xs text-muted rounded-lg border border-border bg-surface-secondary/40 px-3 py-2">
                                                    <span className="font-medium text-foreground">
                                                        {selected.sending_policy.name}
                                                    </span>
                                                    {": "}
                                                    {formatSendingPolicyStages(selected.sending_policy)}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border bg-surface-secondary/30 p-3">
                                        <SendingPolicyFields form={newPolicyForm} disabled={isSaving} />
                                    </div>
                                )}
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="gap-2 justify-end shrink-0">
                            <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                size="sm"
                                isDisabled={!canAssign}
                                isPending={isSaving}
                                onPress={() => void handleAssign()}
                            >
                                Assign
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <EditSendingPolicyModal
                isOpen={showEditPolicy}
                onOpenChange={setShowEditPolicy}
                policy={selectedTemplate}
            />
        </>
    );
}
