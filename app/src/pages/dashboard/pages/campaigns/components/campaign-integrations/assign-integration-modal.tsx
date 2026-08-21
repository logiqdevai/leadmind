import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button, Input, Label, ListBox, Modal, Select, TextField } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { listReadyEmailAccounts } from "@/features/integrations/utils/email-provider-utils";
import {
    SendingPeriodUnit,
    type CreateSendingPolicyPayload,
    type UpsertSendingPolicyStagePayload,
} from "@/features/sending-policy/interfaces/sending-policy.interface";
import { createSendingPolicy } from "@/features/sending-policy/services/sending-policy.service";
import { sendingPoliciesQueryKeys, useSendingPolicies } from "@/features/sending-policy/hooks/use-sending-policies";
import { validateSendingSchedule } from "@/features/sending-policy/utils/sending-policy-validation";
import { useAssignCampaignIntegration } from "@/features/campaign-integrations/hooks/use-campaign-integrations";
import { StageRow } from "../sending-policy/stage-row";

const DEFAULT_STAGE: UpsertSendingPolicyStagePayload = {
    limit: 30,
    period_unit: SendingPeriodUnit.DAY,
};

function timeToMinutes(value: string): number | undefined {
    if (!value) return undefined;
    const [h, m] = value.split(":").map((v) => Number.parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
    return h * 60 + m;
}

const KNOWN_TIMEZONES: Set<string> = new Set(TimezoneOptions.map((o) => o.value));

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
    const assignMutation = useAssignCampaignIntegration(campaignUuid);

    const [accountUuid, setAccountUuid] = useState<string | null>(null);
    const [policyMode, setPolicyMode] = useState<"existing" | "new">("existing");
    const [policyUuid, setPolicyUuid] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [timezone, setTimezone] = useState("UTC");
    const [windowStart, setWindowStart] = useState("");
    const [windowEnd, setWindowEnd] = useState("");
    const [minIntervalMinutes, setMinIntervalMinutes] = useState("0");
    const [stages, setStages] = useState<UpsertSendingPolicyStagePayload[]>([DEFAULT_STAGE]);
    const [isSaving, setIsSaving] = useState(false);
    const wasOpenRef = useRef(false);

    const templates = (policies ?? []).filter((p) => p.is_template);

    const availableAccounts = useMemo(
        () =>
            listReadyEmailAccounts(integrations).filter(
                (row) => row.uuid && !assignedAccountUuids.has(row.uuid),
            ),
        [integrations, assignedAccountUuids],
    );

    useLayoutEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        if (!wasOpenRef.current) {
            setAccountUuid(null);
            setPolicyUuid(null);
            setPolicyMode(templates.length > 0 ? "existing" : "new");
            setName("");
            setDescription("");
            const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setTimezone(browserTimezone && KNOWN_TIMEZONES.has(browserTimezone) ? browserTimezone : "UTC");
            setWindowStart("");
            setWindowEnd("");
            setMinIntervalMinutes("0");
            setStages([DEFAULT_STAGE]);
        }
        wasOpenRef.current = isOpen;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const updateStage = (index: number, value: UpsertSendingPolicyStagePayload) => {
        setStages((prev) => prev.map((s, i) => (i === index ? value : s)));
    };

    const removeStage = (index: number) => {
        setStages((prev) => prev.filter((_, i) => i !== index));
    };

    const moveStage = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= stages.length) return;
        setStages((prev) => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const addStage = () => {
        setStages((prev) => [...prev, { limit: prev[prev.length - 1]?.limit ?? 30, period_unit: SendingPeriodUnit.DAY }]);
    };

    const windowStartMinute = timeToMinutes(windowStart);
    const windowEndMinute = timeToMinutes(windowEnd);
    const minIntervalSeconds = Math.max(0, Number.parseInt(minIntervalMinutes, 10) || 0) * 60;
    const { windowOrderError, stageWarnings } = useMemo(
        () => validateSendingSchedule(stages, windowStartMinute, windowEndMinute, minIntervalSeconds),
        [stages, windowStartMinute, windowEndMinute, minIntervalSeconds],
    );

    const timezoneOptions = useMemo(
        () => (KNOWN_TIMEZONES.has(timezone) ? TimezoneOptions : [{ value: timezone, label: timezone }, ...TimezoneOptions]),
        [timezone],
    );

    const isNewPolicyValid = policyMode === "new" && name.trim().length > 0 && stages.length > 0 && !windowOrderError;
    const canAssign =
        !!accountUuid && (policyMode === "existing" ? !!policyUuid : isNewPolicyValid) && !isSaving;

    const handleAssign = async () => {
        if (!accountUuid) return;

        let resolvedPolicyUuid = policyUuid;
        setIsSaving(true);
        try {
            if (policyMode === "new") {
                if (!isNewPolicyValid) return;
                const payload: CreateSendingPolicyPayload = {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    timezone: timezone.trim() || "UTC",
                    window_start_minute: windowStartMinute,
                    window_end_minute: windowEndMinute,
                    min_interval_seconds: minIntervalSeconds,
                    stages,
                };
                const created = await createSendingPolicy(payload);
                resolvedPolicyUuid = created.uuid;
                await qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });
            }

            if (!resolvedPolicyUuid) return;

            await assignMutation.mutateAsync({
                integration_account_uuid: accountUuid,
                sending_policy_uuid: resolvedPolicyUuid,
            });
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
                                    value={accountUuid ?? undefined}
                                    onChange={(v) => {
                                        if (typeof v === "string") setAccountUuid(v);
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

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Sending policy</Label>
                                {templates.length > 0 ? (
                                    <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-0.5">
                                        <Button
                                            size="sm"
                                            variant={policyMode === "existing" ? "primary" : "tertiary"}
                                            onPress={() => setPolicyMode("existing")}
                                            isDisabled={isSaving}
                                            className="h-7 px-2.5"
                                        >
                                            Use existing
                                        </Button>
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
                                    <Select
                                        aria-label="Sending policy"
                                        value={policyUuid ?? undefined}
                                        onChange={(v) => {
                                            if (typeof v === "string") setPolicyUuid(v);
                                        }}
                                        placeholder="Choose a policy…"
                                        isDisabled={isSaving}
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
                                )
                            ) : (
                                <div className="space-y-4 rounded-xl border border-border bg-surface-secondary/30 p-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <TextField className="sm:col-span-2">
                                            <Label>Name</Label>
                                            <Input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g. Standard ramp-up"
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                        <TextField className="sm:col-span-2">
                                            <Label>Description (optional)</Label>
                                            <Input
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Optional notes about this policy"
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                        <TextField>
                                            <Label>Sending window start (optional)</Label>
                                            <Input
                                                type="time"
                                                value={windowStart}
                                                onChange={(e) => setWindowStart(e.target.value)}
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                        <TextField>
                                            <Label>Sending window end (optional)</Label>
                                            <Input
                                                type="time"
                                                value={windowEnd}
                                                onChange={(e) => setWindowEnd(e.target.value)}
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                        {windowOrderError ? (
                                            <p className="sm:col-span-2 flex items-start gap-1.5 text-xs text-danger -mt-2">
                                                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                                                <span>{windowOrderError}</span>
                                            </p>
                                        ) : null}
                                        <div className="flex flex-col gap-1.5">
                                            <Label>Timezone</Label>
                                            <Select
                                                aria-label="Timezone"
                                                value={timezone}
                                                onChange={(v) => {
                                                    if (typeof v === "string") setTimezone(v);
                                                }}
                                                isDisabled={isSaving}
                                            >
                                                <Select.Trigger>
                                                    <Select.Value />
                                                    <Select.Indicator />
                                                </Select.Trigger>
                                                <Select.Popover>
                                                    <ListBox>
                                                        {timezoneOptions.map((opt) => (
                                                            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                                                                {opt.label}
                                                                <ListBox.ItemIndicator />
                                                            </ListBox.Item>
                                                        ))}
                                                    </ListBox>
                                                </Select.Popover>
                                            </Select>
                                        </div>
                                        <TextField>
                                            <Label>Minimum interval between sends (minutes)</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                value={minIntervalMinutes}
                                                onChange={(e) => setMinIntervalMinutes(e.target.value)}
                                                disabled={isSaving}
                                            />
                                        </TextField>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-foreground">Stages</Label>
                                            <Button size="sm" variant="tertiary" onPress={addStage} isDisabled={isSaving}>
                                                Add stage
                                            </Button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {stages.map((stage, index) => (
                                                <StageRow
                                                    key={index}
                                                    index={index}
                                                    total={stages.length}
                                                    value={stage}
                                                    onChange={(v) => updateStage(index, v)}
                                                    onRemove={() => removeStage(index)}
                                                    onMoveUp={() => moveStage(index, -1)}
                                                    onMoveDown={() => moveStage(index, 1)}
                                                    disabled={isSaving}
                                                    warning={stageWarnings[index]}
                                                />
                                            ))}
                                        </div>
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
                            Assign
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
