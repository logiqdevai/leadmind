import { useState, type FC } from "react";
import type { Key } from "@react-types/shared";
import { Label, ListBox, Modal, Select } from "@heroui/react";
import { Button } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useSequences, useBulkEnrollContacts } from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus } from "@/features/sequences/interfaces/sequence.interface";

interface BulkEnrollInSequenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contactUuids: string[];
    onComplete?: () => void;
}

export const BulkEnrollInSequenceModal: FC<BulkEnrollInSequenceModalProps> = ({
    isOpen,
    onOpenChange,
    contactUuids,
    onComplete,
}) => {
    const { data: sequences = [], isLoading } = useSequences({ status: SequenceStatus.ACTIVE });
    const enrollMutation = useBulkEnrollContacts();
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    const handleChange = (value: Key | null) => {
        if (typeof value === "string") setSelectedUuid(value);
    };

    const handleEnroll = async () => {
        if (!selectedUuid || contactUuids.length === 0) return;
        await enrollMutation.mutateAsync({ uuid: selectedUuid, contact_uuids: contactUuids });
        setSelectedUuid(null);
        onOpenChange(false);
        onComplete?.();
    };

    const placeholder = isLoading
        ? "Loading sequences…"
        : sequences.length === 0
          ? "No active sequences"
          : "Choose a sequence";

    const count = contactUuids.length;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>
                            Enroll {count} contact{count === 1 ? "" : "s"} in sequence
                        </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="space-y-3">
                        <div className="flex flex-col gap-1.5">
                            <Label>Sequence</Label>
                            <Select
                                aria-label="Sequence"
                                placeholder={placeholder}
                                value={selectedUuid ?? undefined}
                                onChange={handleChange}
                                isDisabled={isLoading || sequences.length === 0}
                                fullWidth
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {sequences.map((sequence) => (
                                            <ListBox.Item key={sequence.uuid} id={sequence.uuid} textValue={sequence.name}>
                                                {sequence.name}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                        <p className="text-xs text-muted">
                            Each contact will be scheduled to receive the sequence's enabled steps at their
                            configured delays, starting now. Contacts already actively enrolled or unreachable
                            on a step's channel are skipped individually.
                        </p>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={!selectedUuid || count === 0 || enrollMutation.isPending}
                            isPending={enrollMutation.isPending}
                            onPress={() => void handleEnroll()}
                        >
                            Enroll {count} contact{count === 1 ? "" : "s"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
