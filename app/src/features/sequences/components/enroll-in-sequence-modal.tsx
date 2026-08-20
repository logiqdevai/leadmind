import { useState, type FC } from "react";
import type { Key } from "@react-types/shared";
import { Label, ListBox, Modal, Select } from "@heroui/react";
import { Button } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useSequences, useEnrollContact } from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus } from "@/features/sequences/interfaces/sequence.interface";

interface EnrollInSequenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contactUuid: string;
}

export const EnrollInSequenceModal: FC<EnrollInSequenceModalProps> = ({
    isOpen,
    onOpenChange,
    contactUuid,
}) => {
    const { data: sequences = [], isLoading } = useSequences({ status: SequenceStatus.ACTIVE });
    const enrollMutation = useEnrollContact();
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    const handleChange = (value: Key | null) => {
        if (typeof value === "string") setSelectedUuid(value);
    };

    const handleEnroll = async () => {
        if (!selectedUuid) return;
        await enrollMutation.mutateAsync({ uuid: selectedUuid, contact_uuid: contactUuid });
        setSelectedUuid(null);
        onOpenChange(false);
    };

    const placeholder = isLoading
        ? "Loading sequences…"
        : sequences.length === 0
          ? "No active sequences"
          : "Choose a sequence";

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Enroll in sequence</Modal.Heading>
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
                            The contact will be scheduled to receive each enabled step at the configured
                            delay, starting now.
                        </p>
                    </Modal.Body>
                    <Modal.Footer className="gap-2 justify-end">
                        <Button type="button" size="sm" variant="tertiary" onPress={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            size="sm"
                            isDisabled={!selectedUuid || enrollMutation.isPending}
                            isPending={enrollMutation.isPending}
                            onPress={() => void handleEnroll()}
                        >
                            Enroll
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
