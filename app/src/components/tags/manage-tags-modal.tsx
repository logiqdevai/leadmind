import { useState } from "react";
import { Button, Input, Modal } from "@heroui/react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    useCreateOrgTag,
    useDeleteOrgTag,
    useOrgTags,
    useUpdateOrgTag,
} from "@/features/org-tags/hooks/use-org-tags";
import type { OrgTag } from "@/features/org-tags/interfaces/org-tag.interface";
import { TAG_COLORS } from "@/features/org-tags/lib/tag-query";
import { cn } from "@/lib/utils";

interface ManageTagsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

function ColorDots({ value, onChange }: { value: string | null; onChange: (color: string) => void }) {
    return (
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Tag colour">
            {TAG_COLORS.map((color) => (
                <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={value === color}
                    aria-label={color}
                    onClick={() => onChange(color)}
                    className={cn(
                        "size-4 rounded-full border-2",
                        value === color ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    );
}

function usageSummary(tag: OrgTag) {
    const parts = [
        [tag.usage.CONTACT_LIST, "list"],
        [tag.usage.SEQUENCE, "sequence"],
        [tag.usage.CAMPAIGN, "campaign"],
        [tag.usage.FILTER, "filter"],
        [tag.usage.MESSAGE_TEMPLATE, "template"],
    ] as const;
    const text = parts
        .filter(([n]) => n)
        .map(([n, noun]) => `${n} ${noun}${n === 1 ? "" : "s"}`)
        .join(", ");
    return text || "Not used yet";
}

function TagRow({ tag, onDelete }: { tag: OrgTag; onDelete: (tag: OrgTag) => void }) {
    const updateTag = useUpdateOrgTag();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(tag.name);

    const save = () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === tag.name) {
            setEditing(false);
            setName(tag.name);
            return;
        }
        updateTag.mutate({ uuid: tag.uuid, name: trimmed }, { onSuccess: () => setEditing(false) });
    };

    return (
        <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
                {editing ? (
                    <>
                        <Input
                            value={name}
                            autoFocus
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") save();
                                if (e.key === "Escape") {
                                    setEditing(false);
                                    setName(tag.name);
                                }
                            }}
                            className="flex-1"
                        />
                        <Button size="sm" variant="secondary" isIconOnly aria-label="Save name" onPress={save}>
                            <Check className="size-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isIconOnly
                            aria-label="Cancel"
                            onPress={() => {
                                setEditing(false);
                                setName(tag.name);
                            }}
                        >
                            <X className="size-4" />
                        </Button>
                    </>
                ) : (
                    <>
                        <span
                            className="size-3 shrink-0 rounded-full bg-muted"
                            style={tag.color ? { backgroundColor: tag.color } : undefined}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {tag.name}
                        </span>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isIconOnly
                            aria-label={`Rename ${tag.name}`}
                            onPress={() => {
                                setName(tag.name);
                                setEditing(true);
                            }}
                        >
                            <Pencil className="size-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isIconOnly
                            aria-label={`Delete ${tag.name}`}
                            onPress={() => onDelete(tag)}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">{usageSummary(tag)}</span>
                <ColorDots
                    value={tag.color}
                    onChange={(color) => updateTag.mutate({ uuid: tag.uuid, color })}
                />
            </div>
        </li>
    );
}

/** Create, rename, recolour and delete the organisation's tags. */
export function ManageTagsModal({ isOpen, onOpenChange }: ManageTagsModalProps) {
    const { data: tags = [], isLoading } = useOrgTags(isOpen);
    const createTag = useCreateOrgTag();
    const deleteTag = useDeleteOrgTag();
    const [newName, setNewName] = useState("");
    const [pendingDelete, setPendingDelete] = useState<OrgTag | null>(null);

    const handleCreate = () => {
        const name = newName.trim();
        if (!name) return;
        createTag.mutate(
            { name, color: TAG_COLORS[tags.length % TAG_COLORS.length] },
            { onSuccess: () => setNewName("") },
        );
    };

    return (
        <>
            <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-lg">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Manage tags</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="space-y-4">
                            <p className="text-sm text-muted">
                                Tags group your lists, sequences, campaigns and filters, for example by industry.
                                They are shared across all four.
                            </p>
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="New tag, e.g. Accountants"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCreate();
                                    }}
                                    className="flex-1"
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={handleCreate}
                                    isDisabled={!newName.trim() || createTag.isPending}
                                >
                                    <Plus className="size-4" />
                                    Add
                                </Button>
                            </div>
                            {isLoading ? (
                                <p className="text-sm text-muted">Loading…</p>
                            ) : tags.length === 0 ? (
                                <p className="text-sm text-muted">No tags yet.</p>
                            ) : (
                                <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                                    {tags.map((tag) => (
                                        <TagRow key={tag.uuid} tag={tag} onDelete={setPendingDelete} />
                                    ))}
                                </ul>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="justify-end">
                            <Button variant="secondary" onPress={() => onOpenChange(false)}>
                                Done
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>

            <ConfirmDialog
                isOpen={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete tag?"
                variant="danger"
                confirmLabel="Delete tag"
                isPending={deleteTag.isPending}
                description={
                    pendingDelete ? (
                        <>
                            "{pendingDelete.name}" will be removed from everything it is attached to (
                            {usageSummary(pendingDelete)}). The items themselves are not deleted.
                        </>
                    ) : null
                }
                onConfirm={async () => {
                    if (pendingDelete) await deleteTag.mutateAsync(pendingDelete.uuid);
                    setPendingDelete(null);
                }}
            />
        </>
    );
}
