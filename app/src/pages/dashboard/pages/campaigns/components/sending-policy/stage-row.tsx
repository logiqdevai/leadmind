import { Button, Checkbox, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
    SendingPeriodUnit,
    type UpsertSendingPolicyStagePayload,
} from "@/features/sending-policy/interfaces/sending-policy.interface";

const PERIOD_OPTIONS: { id: SendingPeriodUnit; label: string }[] = [
    { id: SendingPeriodUnit.HOUR, label: "hour" },
    { id: SendingPeriodUnit.DAY, label: "day" },
    { id: SendingPeriodUnit.WEEK, label: "week" },
];

interface StageRowProps {
    index: number;
    total: number;
    value: UpsertSendingPolicyStagePayload;
    onChange: (value: UpsertSendingPolicyStagePayload) => void;
    onRemove: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    disabled?: boolean;
    /** Advisory feasibility warning for this stage (e.g. limit doesn't fit the window/interval). */
    warning?: string | null;
}

export function StageRow({
    index,
    total,
    value,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    disabled = false,
    warning = null,
}: StageRowProps) {
    const isFinal = value.duration_value === undefined;

    return (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={index === 0 || disabled}
                            onPress={onMoveUp}
                            aria-label="Move stage up"
                            className="h-5 w-5 min-w-0 p-0"
                        >
                            <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={index === total - 1 || disabled}
                            onPress={onMoveDown}
                            aria-label="Move stage down"
                            className="h-5 w-5 min-w-0 p-0"
                        >
                            <ChevronDown className="size-3.5" />
                        </Button>
                    </div>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted">
                        {index + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">Stage {index + 1}</span>
                </div>
                <span title={total <= 1 ? "A policy needs at least one stage" : undefined}>
                    <Button
                        size="sm"
                        variant="tertiary"
                        onPress={onRemove}
                        isDisabled={total <= 1 || disabled}
                        aria-label="Remove stage"
                    >
                        <Trash2 className="size-4 text-danger" />
                    </Button>
                </span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <TextField className="w-24">
                    <Label>Limit</Label>
                    <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 30"
                        value={String(value.limit)}
                        onChange={(e) =>
                            onChange({ ...value, limit: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })
                        }
                        disabled={disabled}
                    />
                </TextField>
                <div className="flex flex-col gap-1.5 min-w-[130px]">
                    <Label>Per</Label>
                    <Select
                        aria-label="Period unit"
                        value={value.period_unit}
                        onChange={(v) => {
                            if (typeof v === "string") onChange({ ...value, period_unit: v as SendingPeriodUnit });
                        }}
                        isDisabled={disabled}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {PERIOD_OPTIONS.map((opt) => (
                                    <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                        {opt.label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>

                <Checkbox
                    isSelected={isFinal}
                    onChange={(checked) =>
                        onChange(
                            checked
                                ? { limit: value.limit, period_unit: value.period_unit }
                                : {
                                      ...value,
                                      duration_value: 1,
                                      duration_unit: value.period_unit,
                                  },
                        )
                    }
                    isDisabled={disabled}
                    className="mb-2"
                >
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-sm text-foreground">Until campaign completes</span>
                </Checkbox>

                {!isFinal ? (
                    <>
                        <TextField className="w-20">
                            <Label>For</Label>
                            <Input
                                type="number"
                                min={1}
                                placeholder="e.g. 3"
                                value={String(value.duration_value ?? 1)}
                                onChange={(e) =>
                                    onChange({
                                        ...value,
                                        duration_value: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                                    })
                                }
                                disabled={disabled}
                            />
                        </TextField>
                        <div className="flex flex-col gap-1.5 min-w-[130px]">
                            <Label>&nbsp;</Label>
                            <Select
                                aria-label="Duration unit"
                                value={value.duration_unit ?? value.period_unit}
                                onChange={(v) => {
                                    if (typeof v === "string")
                                        onChange({ ...value, duration_unit: v as SendingPeriodUnit });
                                }}
                                isDisabled={disabled}
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {PERIOD_OPTIONS.map((opt) => (
                                            <ListBox.Item key={opt.id} id={opt.id} textValue={`${opt.label}s`}>
                                                {opt.label}s
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                    </>
                ) : null}
            </div>

            {warning ? (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>{warning}</span>
                </p>
            ) : null}
        </div>
    );
}
