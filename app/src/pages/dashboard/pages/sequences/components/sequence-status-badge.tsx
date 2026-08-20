import { Chip } from "@heroui/react";
import { Archive, CheckCircle2, CircleDashed } from "lucide-react";
import { SequenceStatus } from "@/features/sequences/interfaces/sequence.interface";

const META: Record<
    SequenceStatus,
    {
        label: string;
        color: "default" | "accent" | "success" | "warning" | "danger";
        icon: React.ComponentType<{ className?: string }>;
    }
> = {
    DRAFT: { label: "Draft", color: "default", icon: CircleDashed },
    ACTIVE: { label: "Active", color: "success", icon: CheckCircle2 },
    ARCHIVED: { label: "Archived", color: "default", icon: Archive },
};

export function SequenceStatusBadge({ status }: { status: SequenceStatus }) {
    const meta = META[status];
    const Icon = meta.icon;
    return (
        <Chip size="sm" variant="soft" color={meta.color}>
            <Icon className="size-3" />
            <Chip.Label>{meta.label}</Chip.Label>
        </Chip>
    );
}
