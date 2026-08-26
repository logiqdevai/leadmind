import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Checkbox, Label, ListBox, Modal, Select } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { listReadyEmailAccounts } from "@/features/integrations/utils/email-provider-utils";
import { createSendingPolicy } from "@/features/sending-policy/services/sending-policy.service";
import { sendingPoliciesQueryKeys, useSendingPolicies } from "@/features/sending-policy/hooks/use-sending-policies";
import { useSendingPolicyForm } from "@/features/sending-policy/hooks/use-sending-policy-form";
import { formatSendingPolicyStages } from "@/features/sending-policy/utils/format-sending-policy";
import {
    campaignIntegrationsQueryKeys,
    useAssignCampaignIntegration,
    useCampaignIntegrationsForOrganisation,
} from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { assignCampaignIntegration } from "@/features/campaign-integrations/services/campaign-integrations.service";
import { useQueryClient } from "@tanstack/react-query";
import { SendingPolicyFields } from "../sending-policy/sending-policy-fields";
import { EditSendingPolicyModal } from "../sending-policy/edit-sending-policy-modal";

interface AssignIntegrationModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaignUuid: string;
    assignedAccountUuids: Set<string>;
}

function extractErrorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : "Please try again.";
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

    const [policyMode, setPolicyMode] = useState<"existing" | "copy" | "new">("existing");
    const [policyUuid, setPolicyUuid] = useState<string | null>(null);
    const [selectedAccountKeys, setSelectedAccountKeys] = useState<Set<string>>(new Set());
    const [sourceCampaignUuid, setSourceCampaignUuid] = useState<string | null>(null);
    const [selectedCopyCiUuids, setSelectedCopyCiUuids] = useState<Set<string>>(new Set());
    const [accountUuid, setAccountUuid] = useState<string | null>(null);
    const [domainUuid, setDomainUuid] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const [showEditPolicy, setShowEditPolicy] = useState(false);
    const wasOpenRef = useRef(false);

    const templates = (policies ?? []).filter((p) => p.is_template);
    const copySources = useMemo(() => otherCampaignIntegrations ?? [], [otherCampaignIntegrations]);
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

    const sourceCampaigns = useMemo(() => {
        const map = new Map<string, { uuid: string; name: string; count: number }>();
        for (const ci of copySources) {
            const existing = map.get(ci.campaign.uuid);
            if (existing) existing.count += 1;
            else map.set(ci.campaign.uuid, { uuid: ci.campaign.uuid, name: ci.campaign.name, count: 1 });
        }
        return [...map.values()];
    }, [copySources]);

    const sourceCampaignRows = useMemo(
        () => copySources.filter((ci) => ci.campaign.uuid === sourceCampaignUuid),
        [copySources, sourceCampaignUuid],
    );

    const resetSelections = () => {
        setSelectedAccountKeys(new Set());
        setSourceCampaignUuid(null);
        setSelectedCopyCiUuids(new Set());
        setAccountUuid(null);
        setDomainUuid(undefined);
    };

    useLayoutEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            setShowEditPolicy(false);
            return;
        }
        if (!wasOpenRef.current) {
            resetSelections();
            setPolicyUuid(null);
            setPolicyMode(templates.length > 0 ? "existing" : copySources.length > 0 ? "copy" : "new");
        }
        wasOpenRef.current = isOpen;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const setMode = (mode: "existing" | "copy" | "new") => {
        setPolicyMode(mode);
        resetSelections();
    };

    const toggleAccountKey = (key: string) => {
        setSelectedAccountKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleCopyCiUuid = (uuid: string) => {
        setSelectedCopyCiUuids((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const selectionCount =
        policyMode === "existing"
            ? selectedAccountKeys.size
            : policyMode === "copy"
              ? selectedCopyCiUuids.size
              : accountUuid
                ? 1
                : 0;

    const canAssign =
        !isSaving &&
        (policyMode === "existing"
            ? selectedAccountKeys.size > 0 && !!policyUuid
            : policyMode === "copy"
              ? selectedCopyCiUuids.size > 0
              : !!accountUuid && newPolicyForm.isValid);

    const runBulkAssign = async (
        jobs: { integration_account_uuid: string; integration_account_domain_uuid?: string; sending_policy_uuid: string }[],
    ) => {
        const results = await Promise.allSettled(
            jobs.map((payload) => assignCampaignIntegration(campaignUuid, payload)),
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected",
        );

        if (succeeded > 0) {
            await qc.invalidateQueries({ queryKey: campaignIntegrationsQueryKeys.all(campaignUuid) });
        }

        if (failed.length === 0) {
            toast({
                title: `Assigned ${succeeded} sending integration${succeeded === 1 ? "" : "s"}`,
                duration: 1500,
            });
        } else if (succeeded > 0) {
            toast({
                title: `Assigned ${succeeded} of ${jobs.length} — ${failed.length} failed`,
                description: extractErrorMessage(failed[0].reason),
                variant: "warning",
                duration: 5000,
            });
        } else {
            toast({
                title: "Could not assign sending integrations",
                description: extractErrorMessage(failed[0].reason),
                variant: "error",
                duration: 5000,
            });
        }

        return succeeded > 0;
    };

    const handleAssign = async () => {
        setIsSaving(true);
        try {
            if (policyMode === "new") {
                if (!accountUuid || !newPolicyForm.isValid) return;
                const created = await createSendingPolicy({
                    ...newPolicyForm.toMeta(),
                    stages: newPolicyForm.stages,
                });
                await qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });

                await assignMutation.mutateAsync({
                    integration_account_uuid: accountUuid,
                    ...(domainUuid ? { integration_account_domain_uuid: domainUuid } : {}),
                    sending_policy_uuid: created.uuid,
                });
                resetSelections();
                onOpenChange(false);
                return;
            }

            if (policyMode === "existing") {
                if (!policyUuid || selectedAccountKeys.size === 0) return;
                const jobs = [...selectedAccountKeys]
                    .map((key) => availableAccounts.find((row) => rowKey(row) === key))
                    .filter((row): row is (typeof availableAccounts)[number] => !!row && !!row.uuid)
                    .map((row) => ({
                        integration_account_uuid: row.uuid as string,
                        ...(row.domain_uuid ? { integration_account_domain_uuid: row.domain_uuid } : {}),
                        sending_policy_uuid: policyUuid,
                    }));
                const anySucceeded = await runBulkAssign(jobs);
                if (anySucceeded) {
                    resetSelections();
                    onOpenChange(false);
                }
                return;
            }

            // policyMode === "copy"
            if (selectedCopyCiUuids.size === 0) return;
            const jobs = sourceCampaignRows
                .filter((ci) => selectedCopyCiUuids.has(ci.uuid))
                .map((ci) => ({
                    integration_account_uuid: ci.integration_account_uuid,
                    ...(ci.integration_account_domain
                        ? { integration_account_domain_uuid: ci.integration_account_domain.uuid }
                        : {}),
                    sending_policy_uuid: ci.sending_policy_uuid,
                }));
            const anySucceeded = await runBulkAssign(jobs);
            if (anySucceeded) {
                resetSelections();
                onOpenChange(false);
            }
        } catch (error: unknown) {
            toast({
                title: "Could not save policy",
                description: extractErrorMessage(error),
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
                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <Label>Sending policy</Label>
                                    {templates.length > 0 || copySources.length > 0 ? (
                                        <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-0.5">
                                            {templates.length > 0 ? (
                                                <Button
                                                    size="sm"
                                                    variant={policyMode === "existing" ? "primary" : "tertiary"}
                                                    onPress={() => setMode("existing")}
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
                                                    onPress={() => setMode("copy")}
                                                    isDisabled={isSaving}
                                                    className="h-7 px-2.5"
                                                >
                                                    Copy from campaign
                                                </Button>
                                            ) : null}
                                            <Button
                                                size="sm"
                                                variant={policyMode === "new" ? "primary" : "tertiary"}
                                                onPress={() => setMode("new")}
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
                                        <div className="space-y-4">
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

                                            <AccountChecklist
                                                accounts={availableAccounts}
                                                rowKey={rowKey}
                                                selectedKeys={selectedAccountKeys}
                                                onToggle={toggleAccountKey}
                                                onSelectAll={() =>
                                                    setSelectedAccountKeys(new Set(availableAccounts.map(rowKey)))
                                                }
                                                onDeselectAll={() => setSelectedAccountKeys(new Set())}
                                                disabled={isSaving}
                                            />
                                        </div>
                                    )
                                ) : policyMode === "copy" ? (
                                    <div className="space-y-3">
                                        {copySources.length === 0 ? (
                                            <p className="text-xs text-muted">
                                                No other campaigns have a sending integration configured yet.
                                            </p>
                                        ) : (
                                            <>
                                                <Select
                                                    aria-label="Copy sending schedule from campaign"
                                                    value={sourceCampaignUuid ?? undefined}
                                                    onChange={(v) => {
                                                        if (typeof v !== "string") return;
                                                        setSourceCampaignUuid(v);
                                                        setSelectedCopyCiUuids(
                                                            new Set(
                                                                copySources
                                                                    .filter(
                                                                        (ci) =>
                                                                            ci.campaign.uuid === v &&
                                                                            !assignedAccountUuids.has(
                                                                                ci.integration_account_uuid,
                                                                            ),
                                                                    )
                                                                    .map((ci) => ci.uuid),
                                                            ),
                                                        );
                                                    }}
                                                    placeholder="Choose a campaign…"
                                                    isDisabled={isSaving}
                                                >
                                                    <Select.Trigger>
                                                        <Select.Value />
                                                        <Select.Indicator />
                                                    </Select.Trigger>
                                                    <Select.Popover>
                                                        <ListBox>
                                                            {sourceCampaigns.map((campaign) => (
                                                                <ListBox.Item
                                                                    key={campaign.uuid}
                                                                    id={campaign.uuid}
                                                                    textValue={campaign.name}
                                                                >
                                                                    {campaign.name}
                                                                    <span className="text-muted"> · {campaign.count} account{campaign.count === 1 ? "" : "s"}</span>
                                                                    <ListBox.ItemIndicator />
                                                                </ListBox.Item>
                                                            ))}
                                                        </ListBox>
                                                    </Select.Popover>
                                                </Select>

                                                {sourceCampaignUuid ? (
                                                    <CopySourceChecklist
                                                        rows={sourceCampaignRows}
                                                        assignedAccountUuids={assignedAccountUuids}
                                                        selectedUuids={selectedCopyCiUuids}
                                                        onToggle={toggleCopyCiUuid}
                                                        onSelectAll={() =>
                                                            setSelectedCopyCiUuids(
                                                                new Set(
                                                                    sourceCampaignRows
                                                                        .filter(
                                                                            (ci) =>
                                                                                !assignedAccountUuids.has(
                                                                                    ci.integration_account_uuid,
                                                                                ),
                                                                        )
                                                                        .map((ci) => ci.uuid),
                                                                ),
                                                            )
                                                        }
                                                        onDeselectAll={() => setSelectedCopyCiUuids(new Set())}
                                                        disabled={isSaving}
                                                    />
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
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
                                        <div className="rounded-xl border border-border bg-surface-secondary/30 p-3">
                                            <SendingPolicyFields form={newPolicyForm} disabled={isSaving} />
                                        </div>
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
                                {selectionCount > 1 ? `Assign ${selectionCount} integrations` : "Assign"}
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

function AccountChecklist({
    accounts,
    rowKey,
    selectedKeys,
    onToggle,
    onSelectAll,
    onDeselectAll,
    disabled,
}: {
    accounts: ReturnType<typeof listReadyEmailAccounts>;
    rowKey: (row: { uuid: string | null; domain_uuid?: string }) => string;
    selectedKeys: Set<string>;
    onToggle: (key: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    disabled: boolean;
}) {
    if (accounts.length === 0) {
        return <p className="text-xs text-muted">No unassigned, ready email accounts found.</p>;
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label>Apply to accounts</Label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        onClick={onSelectAll}
                        disabled={disabled}
                    >
                        Select all
                    </button>
                    <button
                        type="button"
                        className="text-xs font-medium text-muted hover:underline disabled:opacity-50"
                        onClick={onDeselectAll}
                        disabled={disabled}
                    >
                        Deselect all
                    </button>
                </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {accounts.map((row) => {
                    const key = rowKey(row);
                    return (
                        <div
                            key={key}
                            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                        >
                            <Checkbox
                                isSelected={selectedKeys.has(key)}
                                onChange={() => onToggle(key)}
                                isDisabled={disabled}
                            >
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="text-sm text-foreground">
                                    {row.detail ? `${row.label} — ${row.detail}` : row.label}
                                </span>
                            </Checkbox>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CopySourceChecklist({
    rows,
    assignedAccountUuids,
    selectedUuids,
    onToggle,
    onSelectAll,
    onDeselectAll,
    disabled,
}: {
    rows: NonNullable<ReturnType<typeof useCampaignIntegrationsForOrganisation>["data"]>;
    assignedAccountUuids: Set<string>;
    selectedUuids: Set<string>;
    onToggle: (uuid: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    disabled: boolean;
}) {
    if (rows.length === 0) {
        return <p className="text-xs text-muted">This campaign has no sending integrations configured.</p>;
    }

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label>Accounts to copy</Label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        onClick={onSelectAll}
                        disabled={disabled}
                    >
                        Select all
                    </button>
                    <button
                        type="button"
                        className="text-xs font-medium text-muted hover:underline disabled:opacity-50"
                        onClick={onDeselectAll}
                        disabled={disabled}
                    >
                        Deselect all
                    </button>
                </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {rows.map((ci) => {
                    const alreadyAssigned = assignedAccountUuids.has(ci.integration_account_uuid);
                    const domainSuffix = ci.integration_account_domain
                        ? ` · ${ci.integration_account_domain.from_email}`
                        : "";
                    const label = `${ci.integration_account.title}${domainSuffix} (${ci.integration_account.integration.provider})`;

                    return (
                        <div
                            key={ci.uuid}
                            className={`rounded-lg border border-border px-3 py-2 ${alreadyAssigned ? "opacity-50" : ""}`}
                        >
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    isSelected={!alreadyAssigned && selectedUuids.has(ci.uuid)}
                                    onChange={() => onToggle(ci.uuid)}
                                    isDisabled={disabled || alreadyAssigned}
                                >
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <span className="text-sm text-foreground">{label}</span>
                                </Checkbox>
                                {alreadyAssigned ? (
                                    <span className="ml-auto text-xs text-muted">Already assigned</span>
                                ) : null}
                            </div>
                            <p className="mt-1 pl-7 text-xs text-muted">
                                <span className="font-medium text-foreground">{ci.sending_policy.name}</span>
                                {": "}
                                {formatSendingPolicyStages(ci.sending_policy)}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
