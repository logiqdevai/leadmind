import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useBulkUpdateOrgTags } from "@/features/org-tags/hooks/use-org-tags";
import type { OrgTagEntityType, OrgTagSummary } from "@/features/org-tags/interfaces/org-tag.interface";
import { TagPicker } from "./tag-picker";

interface EditTagsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    entityType: OrgTagEntityType;
    entityUuid: string;
    entityName: string;
    currentTags?: OrgTagSummary[];
}

type EditTagsBodyProps = Omit<EditTagsModalProps, "isOpen">;

/** Mounted only while the dialog is open, so its state starts from the item's current tags on every open. */
function EditTagsBody({ onOpenChange, entityType, entityUuid, entityName, currentTags }: EditTagsBodyProps) {
    const bulkUpdate = useBulkUpdateOrgTags();
    const [tagUuids, setTagUuids] = useState<string[]>(() => (currentTags ?? []).map((t) => t.uuid));

    const handleSave = () => {
        const before = (currentTags ?? []).map((t) => t.uuid);
        const add = tagUuids.filter((u) => !before.includes(u));
        const remove = before.filter((u) => !tagUuids.includes(u));
        if (!add.length && !remove.length) {
            onOpenChange(false);
            return;
        }
        bulkUpdate.mutate(
            {
                entity_type: entityType,
                entity_uuids: [entityUuid],
                add_tag_uuids: add,
                remove_tag_uuids: remove,
            },
            { onSuccess: () => onOpenChange(false) },
        );
    };

    return (
        <>
            <Modal.Header>
                <Modal.Heading>Edit tags</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
                <p className="truncate text-sm text-muted">{entityName}</p>
                <TagPicker value={tagUuids} onChange={setTagUuids} />
            </Modal.Body>
            <Modal.Footer className="justify-end gap-2">
                <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <ActionButtonWithPending isPending={bulkUpdate.isPending} onPress={handleSave}>
                    Save
                </ActionButtonWithPending>
            </Modal.Footer>
        </>
    );
}

/** Edits the tags of one existing item without opening its full edit form (works in any campaign status). */
export function EditTagsModal({ isOpen, ...body }: EditTagsModalProps) {
    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={body.onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <EditTagsBody {...body} />
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
