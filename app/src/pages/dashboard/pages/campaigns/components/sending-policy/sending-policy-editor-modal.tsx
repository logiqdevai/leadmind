import { useLayoutEffect, useRef, useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import {
    SendingPeriodUnit,
    type CreateSendingPolicyPayload,
    type SendingPolicy,
    type UpsertSendingPolicyStagePayload,
} from "@/features/sending-policy/interfaces/sending-policy.interface";
import {
    addSendingPolicyStage,
    createSendingPolicy,
    removeSendingPolicyStage,
    reorderSendingPolicyStages,
    updateSendingPolicy,
} from "@/features/sending-policy/services/sending-policy.service";
import { useQueryClient } from "@tanstack/react-query";
import { sendingPoliciesQueryKeys } from "@/features/sending-policy/hooks/use-sending-policies";
import { StageRow } from "./stage-row";

const DEFAULT_STAGE: UpsertSendingPolicyStagePayload = {
    limit: 30,
    period_unit: SendingPeriodUnit.DAY,
};

function minutesToTime(minutes: number | null | undefined): string {
    if (minutes == null) return "";
    const h = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

function timeToMinutes(value: string): number | undefined {
    if (!value) return undefined;
    const [h, m] = value.split(":").map((v) => Number.parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
    return h * 60 + m;
}

interface SendingPolicyEditorModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    initial?: SendingPolicy | null;
    onSaved?: (policy: SendingPolicy) => void;
}

export function SendingPolicyEditorModal({
    isOpen,
    onOpenChange,
    initial = null,
    onSaved,
}: SendingPolicyEditorModalProps) {
    const qc = useQueryClient();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [timezone, setTimezone] = useState("UTC");
    const [windowStart, setWindowStart] = useState("");
    const [windowEnd, setWindowEnd] = useState("");
    const [minIntervalMinutes, setMinIntervalMinutes] = useState("0");
    const [stages, setStages] = useState<UpsertSendingPolicyStagePayload[]>([DEFAULT_STAGE]);
    const [isSaving, setIsSaving] = useState(false);
    const wasOpenRef = useRef(false);

    useLayoutEffect(() => {
        if (!isOpen) {
            wasOpenRef.current = false;
            return;
        }
        if (!wasOpenRef.current) {
            if (initial) {
                setName(initial.name);
                setDescription(initial.description ?? "");
                setTimezone(initial.timezone);
                setWindowStart(minutesToTime(initial.window_start_minute));
                setWindowEnd(minutesToTime(initial.window_end_minute));
                setMinIntervalMinutes(String(Math.round(initial.min_interval_seconds / 60)));
                setStages(
                    [...initial.stages]
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((s) => ({
                            limit: s.limit,
                            period_unit: s.period_unit,
                            duration_value: s.duration_value ?? undefined,
                            duration_unit: s.duration_unit ?? undefined,
                        })),
                );
            } else {
                setName("");
                setDescription("");
                setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
                setWindowStart("");
                setWindowEnd("");
                setMinIntervalMinutes("0");
                setStages([DEFAULT_STAGE]);
            }
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, initial]);

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

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ title: "Name is required", variant: "error", duration: 3000 });
            return;
        }
        if (stages.length === 0) {
            toast({ title: "Add at least one stage", variant: "error", duration: 3000 });
            return;
        }

        setIsSaving(true);
        try {
            const meta = {
                name: name.trim(),
                description: description.trim() || undefined,
                timezone: timezone.trim() || "UTC",
                window_start_minute: timeToMinutes(windowStart),
                window_end_minute: timeToMinutes(windowEnd),
                min_interval_seconds: Math.max(0, Number.parseInt(minIntervalMinutes, 10) || 0) * 60,
            };

            let saved: SendingPolicy;
            if (initial) {
                await updateSendingPolicy(initial.uuid, meta);
                // Replace stages: add the desired set first (never dropping below one
                // stage), then remove the old ones, then apply the final order.
                const oldUuids = initial.stages.map((s) => s.uuid);
                const newUuids: string[] = [];
                for (const stage of stages) {
                    const known = new Set([...oldUuids, ...newUuids]);
                    const updated = await addSendingPolicyStage(initial.uuid, stage);
                    const added = updated.stages.find((s) => !known.has(s.uuid));
                    if (added) newUuids.push(added.uuid);
                }
                for (const uuid of oldUuids) {
                    await removeSendingPolicyStage(initial.uuid, uuid);
                }
                saved = await reorderSendingPolicyStages(initial.uuid, newUuids);
            } else {
                const payload: CreateSendingPolicyPayload = { ...meta, stages };
                saved = await createSendingPolicy(payload);
            }

            await qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });
            toast({ title: initial ? "Policy updated" : "Policy created", duration: 1500 });
            onSaved?.(saved);
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
                        <Modal.Heading>{initial ? "Edit sending policy" : "New sending policy"}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-5 overflow-y-auto flex-1 pb-4">
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
                            <TextField>
                                <Label>Timezone</Label>
                                <Input
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    placeholder="e.g. Europe/Athens"
                                    disabled={isSaving}
                                />
                            </TextField>
                            <TextField>
                                <Label>Minimum interval between sends (minutes)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={minIntervalMinutes}
                                    onChange={(e) => setMinIntervalMinutes(e.target.value)}
                                    disabled={isSaving}
                                />
                            </TextField>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-foreground">Sending schedule</Label>
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
                                    />
                                ))}
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end shrink-0">
                        <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={isSaving}
                            isPending={isSaving}
                            onPress={() => void handleSave()}
                        >
                            {initial ? "Save" : "Create policy"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
