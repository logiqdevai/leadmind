import { Button, Chip, Switch } from "@heroui/react";
import { ChevronDown, ChevronUp, Mail, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Channel } from "@/features/contacts/interfaces/contact.interface";
import type { SequenceStep } from "@/features/sequences/interfaces/sequence.interface";
import { formatStepDelay } from "@/features/sequences/utils/sequence-delay.utils";
import { cn } from "@/lib/utils";

function stepPreviewText(step: SequenceStep): string {
    if (step.channel === Channel.EMAIL) {
        const stripped = (step.email_content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped) return stripped.slice(0, 140);
        return step.email_subject?.trim() || "Empty email";
    }
    return step.sms_content?.trim().slice(0, 140) || "Empty SMS";
}

interface StepCardProps {
    step: SequenceStep;
    index: number;
    isFirstEnabledStep: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onToggleEnabled: (enabled: boolean) => void;
    deleteDisabled: boolean;
}

export function StepCard({
    step,
    index,
    isFirstEnabledStep,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onEdit,
    onDelete,
    onToggleEnabled,
    deleteDisabled,
}: StepCardProps) {
    const Icon = step.channel === Channel.EMAIL ? Mail : MessageSquare;
    return (
        <div
            className={cn(
                "rounded-xl border border-border bg-surface p-4 flex flex-col gap-3",
                !step.enabled && "opacity-60",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={!canMoveUp}
                            onPress={onMoveUp}
                            aria-label="Move step up"
                            className="h-5 w-5 min-w-0 p-0"
                        >
                            <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={!canMoveDown}
                            onPress={onMoveDown}
                            aria-label="Move step down"
                            className="h-5 w-5 min-w-0 p-0"
                        >
                            <ChevronDown className="size-3.5" />
                        </Button>
                    </div>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted">
                        {index + 1}
                    </span>
                    <Icon className="size-4 text-muted shrink-0" />
                    <Chip size="sm" variant="soft">
                        <Chip.Label>{step.channel === Channel.EMAIL ? "Email" : "SMS"}</Chip.Label>
                    </Chip>
                    <span className="text-sm text-muted truncate">
                        {formatStepDelay(step, isFirstEnabledStep)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                        isSelected={step.enabled}
                        onChange={(v) => onToggleEnabled(typeof v === "boolean" ? v : !step.enabled)}
                        aria-label={step.enabled ? "Disable step" : "Enable step"}
                    >
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch>
                    <Button size="sm" variant="tertiary" onPress={onEdit} aria-label="Edit step">
                        <Pencil className="size-4" />
                    </Button>
                    <span
                        title={
                            deleteDisabled
                                ? "Disable this step instead — it can't be deleted once the sequence is active"
                                : undefined
                        }
                    >
                        <Button
                            size="sm"
                            variant="tertiary"
                            onPress={onDelete}
                            isDisabled={deleteDisabled}
                            aria-label="Delete step"
                        >
                            <Trash2 className="size-4 text-danger" />
                        </Button>
                    </span>
                </div>
            </div>
            <p className="text-sm text-muted line-clamp-2">{stepPreviewText(step)}</p>
        </div>
    );
}
