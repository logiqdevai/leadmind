import { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useUpdateContactList } from "@/features/contact-lists/hooks/use-contact-lists";
import type { ContactList } from "@/features/contact-lists/interfaces/contact-list.interface";
import { ParentListSelect } from "./parent-list-select";

interface MoveContactListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  list: ContactList;
}

export function MoveContactListModal({ isOpen, onOpenChange, list }: MoveContactListModalProps) {
  const updateList = useUpdateContactList();
  const [selectedParentUuid, setSelectedParentUuid] = useState<string | null>(list.parent_list_uuid);
  const hasChanged = selectedParentUuid !== list.parent_list_uuid;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedParentUuid(list.parent_list_uuid);
  }, [isOpen, list.parent_list_uuid, list.uuid]);

  const handleConfirm = () => {
    if (!hasChanged) return;
    updateList.mutate(
      { uuid: list.uuid, payload: { parent_list_uuid: selectedParentUuid } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Move list</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-sm text-muted">
              Nest <span className="font-medium text-foreground">{list.title}</span> under another
              list, or keep it at the top level.
            </p>
            <ParentListSelect
              value={selectedParentUuid}
              onChange={setSelectedParentUuid}
              enabled={isOpen}
              excludeUuid={list.uuid}
            />
          </Modal.Body>
          <Modal.Footer className="gap-2 justify-end">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <ActionButtonWithPending
              isPending={updateList.isPending}
              isDisabled={!hasChanged || updateList.isPending}
              onPress={handleConfirm}
            >
              Move
            </ActionButtonWithPending>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
