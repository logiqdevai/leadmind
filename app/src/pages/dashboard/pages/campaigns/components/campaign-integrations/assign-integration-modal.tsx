import { useMemo, useState } from "react";
import { Button, Label, ListBox, Modal, Select } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { listReadyEmailAccounts } from "@/features/integrations/utils/email-provider-utils";
import { useSendingPolicies } from "@/features/sending-policy/hooks/use-sending-policies";
import { useAssignCampaignIntegration } from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { SendingPolicyEditorModal } from "../sending-policy/sending-policy-editor-modal";

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
    const { data: integrations } = useIntegrations();
    const { data: policies } = useSendingPolicies();
    const assignMutation = useAssignCampaignIntegration(campaignUuid);
    const [accountUuid, setAccountUuid] = useState<string | null>(null);
    const [policyUuid, setPolicyUuid] = useState<string | null>(null);
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);

    const availableAccounts = useMemo(
        () =>
            listReadyEmailAccounts(integrations).filter(
                (row) => row.uuid && !assignedAccountUuids.has(row.uuid),
            ),
        [integrations, assignedAccountUuids],
    );

    const templates = (policies ?? []).filter((p) => p.is_template);

    const handleAssign = async () => {
        if (!accountUuid || !policyUuid) return;
        await assignMutation.mutateAsync({
            integration_account_uuid: accountUuid,
            sending_policy_uuid: policyUuid,
        });
        setAccountUuid(null);
        setPolicyUuid(null);
        onOpenChange(false);
    };

    return (
        <>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Add sending integration</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Email account</Label>
                                {availableAccounts.length === 0 ? (
                                    <p className="text-xs text-muted">
                                        No unassigned, ready email accounts found.
                                    </p>
                                ) : (
                                    <Select
                                        aria-label="Email account"
                                        value={accountUuid ?? undefined}
                                        onChange={(v) => {
                                            if (typeof v === "string") setAccountUuid(v);
                                        }}
                                        placeholder="Choose an account…"
                                    >
                                        <Select.Trigger>
                                            <Select.Value />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                {availableAccounts.map((row) => (
                                                    <ListBox.Item
                                                        key={row.uuid as string}
                                                        id={row.uuid as string}
                                                        textValue={row.label}
                                                    >
                                                        {row.label}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                    <Label>Sending policy</Label>
                                    <Button
                                        size="sm"
                                        variant="tertiary"
                                        onPress={() => setShowPolicyEditor(true)}
                                    >
                                        New policy
                                    </Button>
                                </div>
                                {templates.length === 0 ? (
                                    <p className="text-xs text-muted">
                                        No sending policy templates yet — create one to continue.
                                    </p>
                                ) : (
                                    <Select
                                        aria-label="Sending policy"
                                        value={policyUuid ?? undefined}
                                        onChange={(v) => {
                                            if (typeof v === "string") setPolicyUuid(v);
                                        }}
                                        placeholder="Choose a policy…"
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
                                )}
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="gap-2 justify-end">
                            <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <ActionButtonWithPending
                                size="sm"
                                isDisabled={!accountUuid || !policyUuid || assignMutation.isPending}
                                isPending={assignMutation.isPending}
                                onPress={() => void handleAssign()}
                            >
                                Assign
                            </ActionButtonWithPending>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <SendingPolicyEditorModal
                isOpen={showPolicyEditor}
                onOpenChange={setShowPolicyEditor}
                onSaved={(policy) => setPolicyUuid(policy.uuid)}
            />
        </>
    );
}
