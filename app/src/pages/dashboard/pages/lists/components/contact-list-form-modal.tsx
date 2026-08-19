import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Label, Modal, TextArea } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useCreateContactList, useUpdateContactList } from "@/features/contact-lists/hooks/use-contact-lists";
import type { ContactList } from "@/features/contact-lists/interfaces/contact-list.interface";
import { Routes } from "@/routes/routes";
import { ParentListSelect } from "./parent-list-select";

interface ContactListFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ContactList | null;
  parentListUuid?: string;
  onCreated?: (list: ContactList) => void;
}

export function ContactListFormModal({
  isOpen,
  onOpenChange,
  editing,
  parentListUuid,
  onCreated,
}: ContactListFormModalProps) {
  const navigate = useNavigate();
  const createList = useCreateContactList();
  const updateList = useUpdateContactList();
  const isPending = createList.isPending || updateList.isPending;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedParentUuid, setSelectedParentUuid] = useState<string | null>(parentListUuid ?? null);
  const isSublist = !editing && !!selectedParentUuid;

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setSelectedParentUuid(editing.parent_list_uuid);
    } else {
      setTitle("");
      setDescription("");
      setSelectedParentUuid(parentListUuid ?? null);
    }
  }, [isOpen, editing, parentListUuid]);

  const handleConfirm = () => {
    if (editing) {
      updateList.mutate(
        { uuid: editing.uuid, payload: { title: title.trim(), description: description.trim() || undefined } },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    createList.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        ...(selectedParentUuid ? { parent_list_uuid: selectedParentUuid } : {}),
      },
      {
        onSuccess: (list) => {
          onOpenChange(false);
          if (onCreated) {
            onCreated(list);
            return;
          }
          navigate(Routes.dashboard.lists_detail.replace(":uuid", list.uuid));
        },
      },
    );
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {editing ? "Edit List" : isSublist ? "New Sublist" : "New List"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="list-title">
                Title <span className="text-danger">*</span>
              </Label>
              <Input
                id="list-title"
                placeholder="e.g. Accountants List"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="list-description">Description</Label>
              <TextArea
                id="list-description"
                placeholder="Optional notes about this list…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {editing ? null : (
              <ParentListSelect
                value={selectedParentUuid}
                onChange={setSelectedParentUuid}
                enabled={isOpen}
              />
            )}
          </Modal.Body>
          <Modal.Footer className="gap-2 justify-end">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <ActionButtonWithPending
              isPending={isPending}
              isDisabled={!title.trim() || isPending}
              onPress={handleConfirm}
            >
              {editing ? "Save" : isSublist ? "Create Sublist" : "Create List"}
            </ActionButtonWithPending>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
