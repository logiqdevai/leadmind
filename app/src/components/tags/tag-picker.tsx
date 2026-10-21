import { useMemo, useState } from "react";
import { Button, Input, Label } from "@heroui/react";
import { Plus } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useCreateOrgTag, useOrgTags } from "@/features/org-tags/hooks/use-org-tags";
import { TAG_COLORS } from "@/features/org-tags/lib/tag-query";

interface TagPickerProps {
    /** Selected tag uuids. */
    value: string[];
    onChange: (next: string[]) => void;
    label?: string;
    disabled?: boolean;
}

/** Form field to attach organisation tags to an item, with inline creation of new tags. */
export function TagPicker({ value, onChange, label = "Tags", disabled }: TagPickerProps) {
    const { data: tags = [] } = useOrgTags();
    const createTag = useCreateOrgTag();
    const [newName, setNewName] = useState("");

    const options = useMemo(() => tags.map((t) => ({ value: t.uuid, label: t.name })), [tags]);

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) return;
        const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            if (!value.includes(existing.uuid)) onChange([...value, existing.uuid]);
            setNewName("");
            return;
        }
        createTag.mutate(
            { name, color: TAG_COLORS[tags.length % TAG_COLORS.length] },
            {
                onSuccess: (tag) => {
                    onChange([...value, tag.uuid]);
                    setNewName("");
                },
            },
        );
    };

    return (
        <div className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <MultiSelect
                options={options}
                value={value}
                onChange={onChange}
                placeholder="No tags"
                searchPlaceholder="Search tags…"
                disabled={disabled}
                aria-label={label}
            />
            <div className="flex items-center gap-2">
                <Input
                    placeholder="New tag, e.g. Real estate"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreate();
                        }
                    }}
                    disabled={disabled}
                    className="flex-1"
                />
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={handleCreate}
                    isDisabled={disabled || !newName.trim() || createTag.isPending}
                >
                    <Plus className="size-4" />
                    Add
                </Button>
            </div>
        </div>
    );
}
