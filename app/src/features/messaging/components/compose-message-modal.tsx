import { useState } from "react";
import { Modal } from "@heroui/react";
import {
    ComposeMessageForm,
    type ComposeMessageMode,
} from "@/features/messaging/components/compose-message-form";
import type { EmailValidationStatus } from "@/features/contacts/interfaces/contact.interface";

export interface ComposeMessageModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    mode?: ComposeMessageMode;
    contactUuid?: string;
    contactUuids?: string[];
    recipientEmail?: string | null;
    recipientEmailValidationStatus?: EmailValidationStatus;
    recipientEmailValidationReason?: string | null;
    onBulkComplete?: () => void;
}

export function ComposeMessageModal({
    isOpen,
    onOpenChange,
    mode = "single",
    contactUuid,
    contactUuids,
    recipientEmail,
    recipientEmailValidationStatus,
    recipientEmailValidationReason,
    onBulkComplete,
}: ComposeMessageModalProps) {
    const [mountKey, setMountKey] = useState(0);

    const handleOpenChange = (open: boolean) => {
        if (open) setMountKey((k) => k + 1);
        onOpenChange(open);
    };

    const canRender =
        isOpen &&
        (mode === "bulk" ? (contactUuids?.length ?? 0) > 0 : Boolean(contactUuid));

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable={false}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    {canRender ? (
                        <ComposeMessageForm
                            key={mountKey}
                            mode={mode}
                            contactUuid={contactUuid}
                            contactUuids={contactUuids}
                            recipientEmail={recipientEmail}
                            recipientEmailValidationStatus={recipientEmailValidationStatus}
                            recipientEmailValidationReason={recipientEmailValidationReason}
                            onClose={() => onOpenChange(false)}
                            onBulkComplete={onBulkComplete}
                        />
                    ) : null}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
