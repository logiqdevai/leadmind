import { useState } from "react";
import { Dropdown } from "@heroui/react";
import { Archive, MoreHorizontal, Play, Trash2 } from "lucide-react";
import {
    useActivateSequence,
    useArchiveSequence,
    useDeleteSequence,
} from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus, type OutreachSequence } from "@/features/sequences/interfaces/sequence.interface";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface SequenceActionsDropdownProps {
    sequence: OutreachSequence;
    onDeleted?: () => void;
}

export function SequenceActionsDropdown({ sequence, onDeleted }: SequenceActionsDropdownProps) {
    const activateMutation = useActivateSequence();
    const archiveMutation = useArchiveSequence();
    const deleteMutation = useDeleteSequence();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const enabledStepCount = sequence.steps.filter((s) => s.enabled).length;
    const canActivate = sequence.status !== SequenceStatus.ACTIVE && enabledStepCount > 0;
    const canArchive = sequence.status !== SequenceStatus.ARCHIVED;
    const canDelete = sequence.status !== SequenceStatus.ACTIVE;

    return (
        <>
            <Dropdown>
                <Dropdown.Trigger
                    aria-label="Sequence actions"
                    className="inline-flex items-center justify-center size-8 rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <MoreHorizontal className="size-4" />
                </Dropdown.Trigger>
                <Dropdown.Popover placement="bottom end">
                    <Dropdown.Menu
                        onAction={(key) => {
                            if (key === "activate") activateMutation.mutate(sequence.uuid);
                            if (key === "archive") archiveMutation.mutate(sequence.uuid);
                            if (key === "delete") setConfirmDelete(true);
                        }}
                    >
                        <Dropdown.Item
                            id="activate"
                            textValue={sequence.status === SequenceStatus.ARCHIVED ? "Reactivate" : "Activate"}
                            isDisabled={!canActivate}
                        >
                            <Play className="size-4" />
                            {sequence.status === SequenceStatus.ARCHIVED ? "Reactivate" : "Activate"}
                        </Dropdown.Item>
                        <Dropdown.Item id="archive" textValue="Archive" isDisabled={!canArchive}>
                            <Archive className="size-4" />
                            Archive
                        </Dropdown.Item>
                        <Dropdown.Item
                            id="delete"
                            textValue="Delete"
                            isDisabled={!canDelete}
                            className="text-danger"
                        >
                            <Trash2 className="size-4" />
                            Delete
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>

            <ConfirmDialog
                isOpen={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete this sequence?"
                description="This cannot be undone. Sequences with active enrollments or in-use campaigns cannot be deleted."
                confirmLabel="Delete"
                variant="danger"
                isPending={deleteMutation.isPending}
                onConfirm={async () => {
                    try {
                        await deleteMutation.mutateAsync(sequence.uuid);
                        setConfirmDelete(false);
                        onDeleted?.();
                    } catch {
                        // toast surfaced
                    }
                }}
            />
        </>
    );
}
