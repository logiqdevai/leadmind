import type { ComponentType } from "react";
import { Tooltip } from "@heroui/react";
import { Megaphone, PenLine, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThreadOrigin } from "@/features/contacts/interfaces/contact.interface";

const ORIGIN_LABEL: Record<ThreadOrigin, string> = {
    [ThreadOrigin.MANUAL]: "Manual",
    [ThreadOrigin.SEQUENCE]: "Sequence",
    [ThreadOrigin.CAMPAIGN]: "Campaign",
};

const ORIGIN_ICON: Record<ThreadOrigin, ComponentType<{ className?: string }>> = {
    [ThreadOrigin.MANUAL]: PenLine,
    [ThreadOrigin.SEQUENCE]: Workflow,
    [ThreadOrigin.CAMPAIGN]: Megaphone,
};

const ORIGIN_TONE: Record<ThreadOrigin, string> = {
    [ThreadOrigin.MANUAL]: "bg-surface-secondary text-muted",
    [ThreadOrigin.SEQUENCE]: "bg-accent/10 text-accent",
    [ThreadOrigin.CAMPAIGN]: "bg-warning/10 text-warning",
};

/**
 * Where a conversation/email came from - manual, sequence or campaign - as a small tinted icon
 * instead of a text chip, so dense lists and tables don't spend a word on it. The full label
 * (or a more specific `title`, e.g. "Sequence · Welcome · Step 2") is the tooltip and the
 * accessible name.
 */
export function OriginIcon({
    origin,
    title,
    className,
    withLabel = false,
}: {
    origin: ThreadOrigin;
    title?: string;
    className?: string;
    /** Also print the origin name next to the icon - for roomy spots like a conversation header. */
    withLabel?: boolean;
}) {
    const Icon = ORIGIN_ICON[origin];
    const label = title ?? ORIGIN_LABEL[origin];
    const icon = (
        <Tooltip>
            <Tooltip.Trigger>
                <span
                    role="img"
                    aria-label={label}
                    className={cn(
                        "inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-full",
                        ORIGIN_TONE[origin],
                        className,
                    )}
                >
                    <Icon className="size-3.5" />
                </span>
            </Tooltip.Trigger>
            <Tooltip.Content className="text-xs">{label}</Tooltip.Content>
        </Tooltip>
    );
    if (!withLabel) return icon;
    return (
        <span className="inline-flex items-center gap-1.5">
            {icon}
            {ORIGIN_LABEL[origin]}
        </span>
    );
}
