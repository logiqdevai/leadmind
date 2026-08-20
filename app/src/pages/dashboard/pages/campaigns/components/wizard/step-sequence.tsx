import type { Key } from "@react-types/shared";
import { Chip, Label, ListBox, Select } from "@heroui/react";
import { Mail, MessageSquare, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Channel } from "@/features/contacts/interfaces/contact.interface";
import { useSequences } from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus } from "@/features/sequences/interfaces/sequence.interface";
import { formatStepDelay } from "@/features/sequences/utils/sequence-delay.utils";
import { Routes } from "@/routes/routes";

interface StepSequenceProps {
    value: string | null;
    onChange: (sequence_uuid: string | null) => void;
}

export function StepSequence({ value, onChange }: StepSequenceProps) {
    const { data: sequences = [], isLoading } = useSequences({ status: SequenceStatus.ACTIVE });
    const selected = sequences.find((s) => s.uuid === value) ?? null;

    const handleChange = (key: Key | null) => {
        if (typeof key === "string") onChange(key);
    };

    const placeholder = isLoading
        ? "Loading sequences…"
        : sequences.length === 0
          ? "No active sequences — activate one first"
          : "Choose a sequence";

    const enabledSteps = selected ? [...selected.steps].filter((s) => s.enabled).sort((a, b) => a.order_index - b.order_index) : [];
    const firstEnabledUuid = enabledSteps[0]?.uuid;

    return (
        <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted">
                <Workflow className="size-4" />
                <p>
                    Contacts matched by your audience filter will be enrolled in this sequence when the
                    campaign starts, each receiving its steps on their configured delay.{" "}
                    <Link to={Routes.dashboard.sequences} className="text-accent hover:underline">
                        Manage sequences
                    </Link>
                    .
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Sequence</Label>
                <Select
                    aria-label="Sequence"
                    placeholder={placeholder}
                    value={value ?? undefined}
                    onChange={handleChange}
                    isDisabled={isLoading || sequences.length === 0}
                    fullWidth
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {sequences.map((sequence) => (
                                <ListBox.Item key={sequence.uuid} id={sequence.uuid} textValue={sequence.name}>
                                    {sequence.name}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            {selected && (
                <div className="rounded-xl border border-border bg-surface-secondary/30 p-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {enabledSteps.length} step{enabledSteps.length === 1 ? "" : "s"}
                    </p>
                    <ol className="space-y-2">
                        {enabledSteps.map((step, index) => {
                            const Icon = step.channel === Channel.EMAIL ? Mail : MessageSquare;
                            return (
                                <li key={step.uuid} className="flex items-center gap-2 text-sm">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-muted">
                                        {index + 1}
                                    </span>
                                    <Icon className="size-3.5 text-muted shrink-0" />
                                    <Chip size="sm" variant="soft">
                                        <Chip.Label>{step.channel === Channel.EMAIL ? "Email" : "SMS"}</Chip.Label>
                                    </Chip>
                                    <span className="text-muted truncate">
                                        {formatStepDelay(step, step.uuid === firstEnabledUuid)}
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
        </div>
    );
}
