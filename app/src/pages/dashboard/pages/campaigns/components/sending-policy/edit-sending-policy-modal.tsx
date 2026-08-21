import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { toast } from "@/hooks/use-toast";
import type { SendingPolicy } from "@/features/sending-policy/interfaces/sending-policy.interface";
import { useSendingPolicyForm } from "@/features/sending-policy/hooks/use-sending-policy-form";
import {
    addSendingPolicyStage,
    removeSendingPolicyStage,
    reorderSendingPolicyStages,
    updateSendingPolicy,
} from "@/features/sending-policy/services/sending-policy.service";
import { sendingPoliciesQueryKeys } from "@/features/sending-policy/hooks/use-sending-policies";
import { SendingPolicyFields } from "./sending-policy-fields";

interface EditSendingPolicyModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    policy: SendingPolicy | null;
    onSaved?: (policy: SendingPolicy) => void;
}

export function EditSendingPolicyModal({
    isOpen,
    onOpenChange,
    policy,
    onSaved,
}: EditSendingPolicyModalProps) {
    const qc = useQueryClient();
    const form = useSendingPolicyForm(policy, isOpen);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!policy) return;
        if (!form.isValid) {
            toast({ title: "Name is required", variant: "error", duration: 3000 });
            return;
        }

        setIsSaving(true);
        try {
            await updateSendingPolicy(policy.uuid, form.toMeta());

            // Replace stages: add the desired set first (never dropping below one
            // stage), then remove the old ones, then apply the final order.
            const oldUuids = policy.stages.map((s) => s.uuid);
            const newUuids: string[] = [];
            for (const stage of form.stages) {
                const known = new Set([...oldUuids, ...newUuids]);
                const updated = await addSendingPolicyStage(policy.uuid, stage);
                const added = updated.stages.find((s) => !known.has(s.uuid));
                if (added) newUuids.push(added.uuid);
            }
            for (const uuid of oldUuids) {
                await removeSendingPolicyStage(policy.uuid, uuid);
            }
            const saved = await reorderSendingPolicyStages(policy.uuid, newUuids);

            await qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });
            toast({ title: "Policy updated", duration: 1500 });
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
                        <Modal.Heading>Edit sending policy</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="overflow-y-auto flex-1 pb-4">
                        {policy ? <SendingPolicyFields form={form} disabled={isSaving} /> : null}
                        <p className="mt-4 text-xs text-muted">
                            Campaigns already using this policy keep their own snapshot - these changes only
                            apply the next time it's assigned.
                        </p>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end shrink-0">
                        <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={isSaving || !form.isValid}
                            isPending={isSaving}
                            onPress={() => void handleSave()}
                        >
                            Save
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
