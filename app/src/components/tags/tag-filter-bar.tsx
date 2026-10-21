import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { Settings2, Tag } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useOrgTags } from "@/features/org-tags/hooks/use-org-tags";
import type { OrgTagEntityType } from "@/features/org-tags/interfaces/org-tag.interface";
import { cn } from "@/lib/utils";
import { ManageTagsModal } from "./manage-tags-modal";
import type { TagFilterState } from "./use-tag-filter-params";

interface TagFilterBarProps {
    entityType: OrgTagEntityType;
    value: TagFilterState;
    onChange: (next: Partial<TagFilterState>) => void;
    className?: string;
}

/** Filter control shared by the lists, sequences, campaigns and filters pages. */
export function TagFilterBar({ entityType, value, onChange, className }: TagFilterBarProps) {
    const { data: tags = [] } = useOrgTags();
    const [manageOpen, setManageOpen] = useState(false);

    const options = useMemo(
        () =>
            tags.map((t) => ({
                value: t.uuid,
                label: `${t.name} (${t.usage[entityType] ?? 0})`,
            })),
        [tags, entityType],
    );

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            <div className="w-full min-w-48 sm:w-64">
                <MultiSelect
                    options={options}
                    value={value.tagUuids}
                    onChange={(tagUuids) => onChange({ tagUuids, untagged: false })}
                    placeholder="Filter by tag"
                    searchPlaceholder="Search tags…"
                    aria-label="Filter by tag"
                />
            </div>

            {value.tagUuids.length > 1 && (
                <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs" role="group">
                    {(["any", "all"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={value.match === mode}
                            onClick={() => onChange({ match: mode })}
                            className={cn(
                                "px-2.5 py-1.5 capitalize",
                                value.match === mode
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-surface text-muted hover:text-foreground",
                            )}
                        >
                            {mode === "any" ? "Any tag" : "All tags"}
                        </button>
                    ))}
                </div>
            )}

            <Button
                size="sm"
                variant={value.untagged ? "primary" : "secondary"}
                onPress={() => onChange({ untagged: !value.untagged })}
            >
                <Tag className="size-3.5" />
                Untagged
            </Button>

            <Button size="sm" variant="tertiary" onPress={() => setManageOpen(true)}>
                <Settings2 className="size-3.5" />
                Manage tags
            </Button>

            <ManageTagsModal isOpen={manageOpen} onOpenChange={setManageOpen} />
        </div>
    );
}
