import type { OrgTagSummary } from "@/features/org-tags/interfaces/org-tag.interface";
import { cn } from "@/lib/utils";

export function TagChip({ tag, className }: { tag: OrgTagSummary; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex max-w-40 items-center gap-1.5 rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-foreground",
                className,
            )}
        >
            <span
                className="size-2 shrink-0 rounded-full bg-muted"
                style={tag.color ? { backgroundColor: tag.color } : undefined}
                aria-hidden
            />
            <span className="truncate">{tag.name}</span>
        </span>
    );
}

interface TagChipsProps {
    tags?: OrgTagSummary[];
    /** How many chips to show before collapsing the rest into "+N". */
    max?: number;
    className?: string;
}

export function TagChips({ tags, max = 3, className }: TagChipsProps) {
    if (!tags?.length) return null;
    const shown = tags.slice(0, max);
    const hidden = tags.slice(max);
    return (
        <div className={cn("flex flex-wrap items-center gap-1", className)}>
            {shown.map((tag) => (
                <TagChip key={tag.uuid} tag={tag} />
            ))}
            {hidden.length > 0 && (
                <span
                    className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-muted"
                    title={hidden.map((t) => t.name).join(", ")}
                >
                    +{hidden.length}
                </span>
            )}
        </div>
    );
}
