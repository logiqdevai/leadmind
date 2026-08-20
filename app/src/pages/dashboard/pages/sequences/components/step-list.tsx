import type { SequenceStep } from "@/features/sequences/interfaces/sequence.interface";
import { StepCard } from "./step-card";

interface StepListProps {
    steps: SequenceStep[];
    canDeleteSteps: boolean;
    onReorder: (step_uuids: string[]) => void;
    onEdit: (step: SequenceStep) => void;
    onDelete: (step: SequenceStep) => void;
    onToggleEnabled: (step: SequenceStep, enabled: boolean) => void;
}

export function StepList({ steps, canDeleteSteps, onReorder, onEdit, onDelete, onToggleEnabled }: StepListProps) {
    const ordered = [...steps].sort((a, b) => a.order_index - b.order_index);
    const firstEnabledUuid = ordered.find((s) => s.enabled)?.uuid;

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= ordered.length) return;
        const next = [...ordered];
        [next[index], next[target]] = [next[target], next[index]];
        onReorder(next.map((s) => s.uuid));
    };

    if (ordered.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary/30 p-10 text-center text-sm text-muted">
                No steps yet. Add a step to start building this sequence.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {ordered.map((step, index) => (
                <StepCard
                    key={step.uuid}
                    step={step}
                    index={index}
                    isFirstEnabledStep={step.uuid === firstEnabledUuid}
                    canMoveUp={index > 0}
                    canMoveDown={index < ordered.length - 1}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    onEdit={() => onEdit(step)}
                    onDelete={() => onDelete(step)}
                    onToggleEnabled={(enabled) => onToggleEnabled(step, enabled)}
                    deleteDisabled={!canDeleteSteps}
                />
            ))}
        </div>
    );
}
