import { useEffect, useState, type FC } from "react";
import type { Key } from "@react-types/shared";
import { Label, ListBox, Modal, Select } from "@heroui/react";
import { Button } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import type { Contact } from "@/features/contacts/interfaces/contact.interface";
import { useSequences, useBulkEnrollContacts } from "@/features/sequences/hooks/use-sequences";
import { SequenceStatus } from "@/features/sequences/interfaces/sequence.interface";
import { ContactSelectionTable } from "@/pages/dashboard/components/contact-selection-table";

type BulkEnrollStep = "recipients" | "sequence";

interface BulkEnrollInSequenceModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contacts: Contact[];
    onComplete?: () => void;
}

export const BulkEnrollInSequenceModal: FC<BulkEnrollInSequenceModalProps> = ({
    isOpen,
    onOpenChange,
    contacts,
    onComplete,
}) => {
    const { data: sequences = [], isLoading } = useSequences({ status: SequenceStatus.ACTIVE });
    const enrollMutation = useBulkEnrollContacts();
    const [step, setStep] = useState<BulkEnrollStep>("recipients");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setStep("recipients");
        setSelected(new Set(contacts.map((c) => c.uuid)));
        setSelectedUuid(null);
    }, [isOpen, contacts]);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setStep("recipients");
            setSelectedUuid(null);
        }
        onOpenChange(open);
    };

    const toggleSelect = (uuid: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const toggleAll = (uuids: string[], select: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of uuids) {
                if (select) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    };

    const handleChange = (value: Key | null) => {
        if (typeof value === "string") setSelectedUuid(value);
    };

    const selectedUuids = [...selected];
    const count = selectedUuids.length;

    const handleEnroll = async () => {
        if (!selectedUuid || count === 0) return;
        await enrollMutation.mutateAsync({ uuid: selectedUuid, contact_uuids: selectedUuids });
        setSelectedUuid(null);
        handleOpenChange(false);
        onComplete?.();
    };

    const placeholder = isLoading
        ? "Loading sequences…"
        : sequences.length === 0
          ? "No active sequences"
          : "Choose a sequence";

    const canRender = isOpen && contacts.length > 0;

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable={false}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    {canRender && step === "recipients" ? (
                        <>
                            <Modal.Header>
                                <Modal.Heading>Enroll in sequence</Modal.Heading>
                                <p className="text-sm text-muted mt-1">
                                    Review recipients before choosing a sequence.
                                </p>
                            </Modal.Header>
                            <Modal.Body>
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm text-muted">
                                        {selected.size} of {contacts.length} contact
                                        {contacts.length === 1 ? "" : "s"} selected
                                    </p>
                                    <ContactSelectionTable
                                        rows={contacts}
                                        selected={selected}
                                        onToggleSelect={toggleSelect}
                                        onToggleAll={toggleAll}
                                    />
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    slot="close"
                                    variant="secondary"
                                    type="button"
                                    onPress={() => handleOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    type="button"
                                    isDisabled={selected.size === 0}
                                    onPress={() => setStep("sequence")}
                                >
                                    Continue
                                </Button>
                            </Modal.Footer>
                        </>
                    ) : null}
                    {canRender && step === "sequence" ? (
                        <>
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
                                                    <ListBox.Item
                                                        key={sequence.uuid}
                                                        id={sequence.uuid}
                                                        textValue={sequence.name}
                                                    >
                                                        {sequence.name}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                ))}
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted">
                                    Each contact will be scheduled to receive the sequence's enabled
                                    steps at their configured delays and times of day, based on their
                                    own enrollment moment. Contacts already actively enrolled or
                                    unreachable on a step's channel are skipped individually.
                                </p>
                            </Modal.Body>
                            <Modal.Footer className="gap-2 justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => setStep("recipients")}
                                >
                                    Back
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => handleOpenChange(false)}
                                >
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
                        </>
                    ) : null}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};
