import { Modal } from "@heroui/react";
import { useThreadDetail } from "@/features/outreach/hooks/use-outreach";
import { ThreadConversation } from "@/features/messaging/components/thread-conversation";

interface MessageThreadModalProps {
    threadUuid: string | null;
    contactUuid: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MessageThreadModal({
    threadUuid,
    contactUuid,
    isOpen,
    onOpenChange,
}: MessageThreadModalProps) {
    const { data } = useThreadDetail(isOpen ? threadUuid : null);

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{data?.thread.subject || "Conversation"}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        <ThreadConversation
                            threadUuid={isOpen ? threadUuid : null}
                            contactUuid={contactUuid}
                        />
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
