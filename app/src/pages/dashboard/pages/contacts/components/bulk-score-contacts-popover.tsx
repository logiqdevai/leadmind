import { useEffect, useMemo, useState } from "react";
import { Checkbox, Label, Modal } from "@heroui/react";
import { Gauge } from "lucide-react";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useBulkTriggerContactScore } from "@/features/contacts/hooks/use-contacts";
import { useScoringInstructions } from "@/features/scoring-instructions/hooks/use-scoring-instructions";

interface BulkScoreContactsPopoverProps {
    selectedContactUuids: string[];
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onScoringComplete?: () => void;
}

export function BulkScoreContactsPopover({
    selectedContactUuids,
    isOpen,
    onOpenChange,
    onScoringComplete,
}: BulkScoreContactsPopoverProps) {
    const { data: instructions = [] } = useScoringInstructions();
    const bulkScore = useBulkTriggerContactScore();
    const [ruleUuids, setRuleUuids] = useState<string[]>([]);
    const [useBatch, setUseBatch] = useState(false);

    const ruleOptions: MultiSelectOption[] = useMemo(
        () => instructions.map((si) => ({ value: si.uuid, label: si.name })),
        [instructions],
    );

    useEffect(() => {
        if (!isOpen) {
            setRuleUuids([]);
            setUseBatch(false);
        }
    }, [isOpen]);

    const canSubmit =
        selectedContactUuids.length > 0 && ruleUuids.length > 0 && !bulkScore.isPending;

    const run = () => {
        if (!canSubmit) return;
        bulkScore.mutate(
            {
                contact_uuids: selectedContactUuids,
                scoring_instruction_uuids: ruleUuids,
                use_batch: useBatch,
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    onScoringComplete?.();
                },
            },
        );
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Bulk scoring</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-3">
                        <p className="text-[11px] text-muted leading-snug">
                            {selectedContactUuids.length} contact
                            {selectedContactUuids.length === 1 ? "" : "s"} selected. Choose scoring
                            rules to run on every selected contact.
                        </p>
                        <div>
                            <Label className="mb-1 block text-xs text-muted">Scoring rules</Label>
                            <MultiSelect
                                aria-label="Scoring rules"
                                options={ruleOptions}
                                value={ruleUuids}
                                onChange={setRuleUuids}
                                placeholder={
                                    ruleOptions.length === 0
                                        ? "No scoring rules yet"
                                        : "Select scoring rules…"
                                }
                                disabled={ruleOptions.length === 0}
                            />
                        </div>
                        <div>
                            <Checkbox
                                isSelected={useBatch}
                                onChange={(checked: boolean) => setUseBatch(checked)}
                                isDisabled={bulkScore.isPending}
                            >
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="text-xs text-muted">
                                    Use OpenAI Batch API (50% cheaper, results within 24h)
                                </span>
                            </Checkbox>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <ActionButtonWithPending
                            size="sm"
                            variant="tertiary"
                            onPress={() => onOpenChange(false)}
                            isDisabled={bulkScore.isPending}
                        >
                            Cancel
                        </ActionButtonWithPending>
                        <ActionButtonWithPending
                            size="sm"
                            variant="secondary"
                            isDisabled={!canSubmit}
                            isPending={bulkScore.isPending}
                            onPress={run}
                            idleLeading={<Gauge className="size-3.5" />}
                        >
                            Run scoring
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
