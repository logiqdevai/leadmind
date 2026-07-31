import { useEffect, useState } from "react";
import { Button, Input, Label, ListBox, Modal, Select } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    CONTACT_INFO_TYPE_OPTIONS,
    ContactInfoType,
} from "@/features/contacts/constants/contact-info-types.constants";
import type { ContactInfo } from "@/features/contacts/interfaces/contact.interface";
import {
    useCreateContactInfo,
    useUpdateContactInfo,
} from "@/features/contacts/hooks/use-contacts";

interface ContactInfoFormModalProps {
    contactUuid: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    editing?: ContactInfo | null;
}

const VALUE_PLACEHOLDERS: Record<ContactInfoType, string> = {
    EMAIL: "info@azioweb.com",
    PHONE: "+30 210 000 0000",
    SMS: "+30 690 000 0000",
    WEBSITE: "https://example.com",
    LINKEDIN: "https://linkedin.com/in/…",
    FACEBOOK: "https://facebook.com/…",
    INSTAGRAM: "https://instagram.com/…",
    TWITTER: "https://x.com/…",
    WHATSAPP: "+30 690 000 0000",
    TELEGRAM: "@username",
    YOUTUBE: "https://youtube.com/@…",
    GOOGLE_MAPS: "https://maps.google.com/…",
    OTHER: "Value",
};

export function ContactInfoFormModal({
    contactUuid,
    isOpen,
    onOpenChange,
    editing = null,
}: ContactInfoFormModalProps) {
    const createInfo = useCreateContactInfo(contactUuid);
    const updateInfo = useUpdateContactInfo(contactUuid);
    const isPending = createInfo.isPending || updateInfo.isPending;

    const [type, setType] = useState<ContactInfoType>(ContactInfoType.EMAIL);
    const [value, setValue] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        if (editing) {
            setType(editing.type);
            setValue(editing.value);
            return;
        }
        setType(ContactInfoType.EMAIL);
        setValue("");
    }, [isOpen, editing]);

    const canSubmit = value.trim().length > 0 && !isPending;

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed) return;

        if (editing) {
            updateInfo.mutate(
                { infoUuid: editing.uuid, payload: { type, value: trimmed } },
                { onSuccess: () => onOpenChange(false) },
            );
            return;
        }

        createInfo.mutate(
            { type, value: trimmed },
            { onSuccess: () => onOpenChange(false) },
        );
    };

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>
                            {editing ? "Edit contact info" : "Add contact info"}
                        </Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="p-6 space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Type</Label>
                            <Select
                                aria-label="Contact info type"
                                value={type}
                                onChange={(v) => {
                                    if (v) setType(v as ContactInfoType);
                                }}
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover className="max-h-72">
                                    <ListBox>
                                        {CONTACT_INFO_TYPE_OPTIONS.map((opt) => (
                                            <ListBox.Item
                                                key={opt.value}
                                                id={opt.value}
                                                textValue={opt.label}
                                            >
                                                {opt.label}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="contact-info-value">Value</Label>
                            <Input
                                id="contact-info-value"
                                placeholder={VALUE_PLACEHOLDERS[type]}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && canSubmit) {
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            slot="close"
                            variant="secondary"
                            isDisabled={isPending}
                        >
                            Cancel
                        </Button>
                        <ActionButtonWithPending
                            isDisabled={!canSubmit}
                            isPending={isPending}
                            onPress={handleSubmit}
                        >
                            {editing ? "Save" : "Add"}
                        </ActionButtonWithPending>
                    </Modal.Footer>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
