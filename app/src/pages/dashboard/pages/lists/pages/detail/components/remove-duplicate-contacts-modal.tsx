import { Modal, Spinner } from "@heroui/react";
import { AlertTriangle, Users } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { Button } from "@heroui/react";
import {
    useDuplicateListContacts,
    useRemoveDuplicateListContacts,
} from "@/features/contact-lists/hooks/use-contact-lists";

interface RemoveDuplicateContactsModalProps {
    listUuid: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onRemoved?: () => void;
}

export function RemoveDuplicateContactsModal({
    listUuid,
    isOpen,
    onOpenChange,
    onRemoved,
}: RemoveDuplicateContactsModalProps) {
    const { data, isLoading } = useDuplicateListContacts(listUuid, isOpen);
    const removeDuplicates = useRemoveDuplicateListContacts();

    const total = data?.total ?? 0;
    const contacts = data?.contacts ?? [];
    const hiddenCount = Math.max(0, total - contacts.length);

    const handleConfirm = async () => {
        await removeDuplicates.mutateAsync({ listUuid });
        onOpenChange(false);
        onRemoved?.();
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl w-full">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Remove contacts that are in other lists</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="max-h-[60vh] overflow-y-auto space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Spinner size="md" />
                            </div>
                        ) : total === 0 ? (
                            <p className="text-sm text-muted">
                                No contacts in this list also belong to another list. There is
                                nothing to remove.
                            </p>
                        ) : (
                            <>
                                <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 p-3">
                                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-danger" />
                                    <p className="text-sm text-foreground">
                                        <span className="font-medium">
                                            {total} contact{total === 1 ? "" : "s"}
                                        </span>{" "}
                                        in this list also belong{total === 1 ? "s" : ""} to at
                                        least one other list. They will be removed from this list
                                        only — they stay in your CRM and in their other lists.
                                    </p>
                                </div>
                                <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                                    {contacts.map((contact) => (
                                        <div
                                            key={contact.uuid}
                                            className="flex items-start justify-between gap-3 p-3"
                                        >
                                            <div className="flex items-start gap-2.5 min-w-0">
                                                <Users className="size-4 shrink-0 mt-0.5 text-muted" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium text-foreground truncate">
                                                        {contact.name || "Unnamed contact"}
                                                    </span>
                                                    {contact.email ? (
                                                        <span className="text-xs text-muted truncate">
                                                            {contact.email}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-1 max-w-[45%]">
                                                {contact.lists.map((list) => (
                                                    <span
                                                        key={list.uuid}
                                                        className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted whitespace-nowrap"
                                                    >
                                                        {list.title}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {hiddenCount > 0 ? (
                                    <p className="text-xs text-muted">
                                        And {hiddenCount} more contact{hiddenCount === 1 ? "" : "s"}
                                        .
                                    </p>
                                ) : null}
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => onOpenChange(false)}
                            isDisabled={removeDuplicates.isPending}
                        >
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            variant="danger"
                            isDisabled={isLoading || total === 0 || removeDuplicates.isPending}
                            isPending={removeDuplicates.isPending}
                            onPress={handleConfirm}
                        >
                            Delete
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
