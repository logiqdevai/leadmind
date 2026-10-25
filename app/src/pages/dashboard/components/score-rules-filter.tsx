import { Button, Label, Slider } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { ContactScoreRule } from "@/features/contacts/interfaces/contact.interface";
import { useScoringInstructions } from "@/features/scoring-instructions/hooks/use-scoring-instructions";
import { SearchSelect } from "@/components/ui/search-select";

interface ScoreRulesFilterProps {
    value: ContactScoreRule[];
    onChange: (next: ContactScoreRule[]) => void;
    disabled?: boolean;
}

export function ScoreRulesFilter({ value, onChange, disabled }: ScoreRulesFilterProps) {
    const { data: instructions = [], isLoading } = useScoringInstructions();

    const addRow = () => {
        const first = instructions.find((i) => !value.some((r) => r.scoring_instruction_uuid === i.uuid));
        if (!first) return;
        onChange([...value, { scoring_instruction_uuid: first.uuid, min: 5 }]);
    };

    const updateRow = (index: number, patch: Partial<ContactScoreRule>) => {
        const next = value.map((r, i) => (i === index ? { ...r, ...patch } : r));
        onChange(next);
    };

    const removeRow = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Score rules</Label>
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={addRow}
                    isDisabled={disabled || isLoading || instructions.length === 0}
                >
                    <Plus className="size-3.5" />
                    Add rule
                </Button>
            </div>
            <p className="text-xs text-muted">
                Contacts must meet every rule (same instruction as in AI scoring). Leave empty to ignore scores.
            </p>
            {value.length === 0 ? (
                <p className="text-xs text-muted">No score filters.</p>
            ) : (
                <div className="space-y-3">
                    {value.map((rule, index) => (
                        <div
                            key={`${rule.scoring_instruction_uuid}-${index}`}
                            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-secondary/30 p-3"
                        >
                            <div className="min-w-[200px] flex-1">
                                <div className="flex w-full flex-col gap-1.5">
                                    <Label className="text-xs">Instruction</Label>
                                    <SearchSelect
                                        aria-label="Scoring instruction"
                                        searchPlaceholder="Search instructions…"
                                        options={instructions.map((i) => ({ id: i.uuid, label: i.name }))}
                                        value={rule.scoring_instruction_uuid}
                                        onChange={(v) => updateRow(index, { scoring_instruction_uuid: v })}
                                        isDisabled={disabled || isLoading}
                                        fullWidth
                                    />
                                </div>
                            </div>
                            <div className="w-full sm:w-48">
                                <Slider
                                    className="w-full"
                                    minValue={1}
                                    maxValue={10}
                                    step={1}
                                    value={rule.min}
                                    onChange={(v) =>
                                        updateRow(index, { min: Array.isArray(v) ? v[0]! : v })
                                    }
                                    isDisabled={disabled}
                                >
                                    <Label className="text-xs">Min {rule.min}</Label>
                                    <Slider.Output />
                                    <Slider.Track>
                                        <Slider.Fill />
                                        <Slider.Thumb />
                                    </Slider.Track>
                                </Slider>
                            </div>
                            <Button
                                variant="tertiary"
                                size="sm"
                                onPress={() => removeRow(index)}
                                isDisabled={disabled}
                                aria-label="Remove rule"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
