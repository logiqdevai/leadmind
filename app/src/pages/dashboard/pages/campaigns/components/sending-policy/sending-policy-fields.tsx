import { AlertTriangle } from "lucide-react";
import { Button, Input, Label, TextField } from "@heroui/react";
import type { SendingPolicyFormState } from "@/features/sending-policy/hooks/use-sending-policy-form";
import { StageRow } from "./stage-row";
import { SearchSelect } from "@/components/ui/search-select";

interface SendingPolicyFieldsProps {
    form: SendingPolicyFormState;
    disabled?: boolean;
}

export function SendingPolicyFields({ form, disabled = false }: SendingPolicyFieldsProps) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField className="sm:col-span-2">
                    <Label>Name</Label>
                    <Input
                        value={form.name}
                        onChange={(e) => form.setName(e.target.value)}
                        placeholder="e.g. Standard ramp-up"
                        disabled={disabled}
                    />
                </TextField>
                <TextField className="sm:col-span-2">
                    <Label>Description (optional)</Label>
                    <Input
                        value={form.description}
                        onChange={(e) => form.setDescription(e.target.value)}
                        placeholder="Optional notes about this policy"
                        disabled={disabled}
                    />
                </TextField>
                <TextField>
                    <Label>Sending window start (optional)</Label>
                    <Input
                        type="time"
                        value={form.windowStart}
                        onChange={(e) => form.setWindowStart(e.target.value)}
                        disabled={disabled}
                    />
                </TextField>
                <TextField>
                    <Label>Sending window end (optional)</Label>
                    <Input
                        type="time"
                        value={form.windowEnd}
                        onChange={(e) => form.setWindowEnd(e.target.value)}
                        disabled={disabled}
                    />
                </TextField>
                {form.windowOrderError ? (
                    <p className="sm:col-span-2 flex items-start gap-1.5 text-xs text-danger -mt-2">
                        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                        <span>{form.windowOrderError}</span>
                    </p>
                ) : null}
                <div className="flex flex-col gap-1.5">
                    <Label>Timezone</Label>
                    <SearchSelect
                        aria-label="Timezone"
                        searchPlaceholder="Search timezones…"
                        options={form.timezoneOptions.map((opt) => ({ id: opt.value, label: opt.label }))}
                        value={form.timezone}
                        onChange={form.setTimezone}
                        isDisabled={disabled}
                        fullWidth
                    />
                </div>
                <TextField>
                    <Label>Minimum interval between sends (minutes)</Label>
                    <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={form.minIntervalMinutes}
                        onChange={(e) => form.setMinIntervalMinutes(e.target.value)}
                        disabled={disabled}
                    />
                </TextField>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Stages</Label>
                    <Button size="sm" variant="tertiary" onPress={form.addStage} isDisabled={disabled}>
                        Add stage
                    </Button>
                </div>
                <div className="flex flex-col gap-3">
                    {form.stages.map((stage, index) => (
                        <StageRow
                            key={index}
                            index={index}
                            total={form.stages.length}
                            value={stage}
                            onChange={(v) => form.updateStage(index, v)}
                            onRemove={() => form.removeStage(index)}
                            onMoveUp={() => form.moveStage(index, -1)}
                            onMoveDown={() => form.moveStage(index, 1)}
                            disabled={disabled}
                            warning={form.stageWarnings[index]}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
