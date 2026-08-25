import { Chip, Modal } from "@heroui/react";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import type { SendHistoryMessage } from "@/features/outreach/interfaces/send-history.interface";
import { MessageBodyPreview } from "@/pages/dashboard/pages/contacts/pages/detail/components/message-body-preview";
import {
    formatSendHistoryDate,
    getContactDestination,
    getSendIntegrationLabel,
    getSendSourceLabel,
} from "../utils/send-history.utils";
import { STATUS_COLOR } from "./send-history-table";

interface SendHistoryMessageModalProps {
    message: SendHistoryMessage | null;
    onOpenChange: (open: boolean) => void;
}

export function SendHistoryMessageModal({ message, onOpenChange }: SendHistoryMessageModalProps) {
    const { data: integrations } = useIntegrations();

    return (
        <Modal.Backdrop isOpen={message !== null} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    {message ? (
                        <>
                            <Modal.Header>
                                <Modal.Heading>
                                    {message.contact.name ?? "Unnamed contact"}
                                </Modal.Heading>
                                <p className="text-xs text-muted">{getContactDestination(message)}</p>
                            </Modal.Header>
                            <Modal.Body className="space-y-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Chip size="sm" variant="soft" color={STATUS_COLOR[message.status]}>
                                        <Chip.Label>{message.status}</Chip.Label>
                                    </Chip>
                                    <Chip size="sm" variant="soft" color="default">
                                        <Chip.Label>{message.channel}</Chip.Label>
                                    </Chip>
                                    <Chip size="sm" variant="soft" color="default">
                                        <Chip.Label>{getSendSourceLabel(message)}</Chip.Label>
                                    </Chip>
                                </div>

                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div>
                                        <dt className="text-muted">Integration</dt>
                                        <dd className="text-foreground/90">
                                            {getSendIntegrationLabel(message, integrations)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted">Sent by</dt>
                                        <dd className="text-foreground/90">
                                            {message.sent_by?.full_name?.trim() ||
                                                message.sent_by?.email ||
                                                "—"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-muted">Date</dt>
                                        <dd className="text-foreground/90">
                                            {formatSendHistoryDate(message.sent_at ?? message.created_at)}
                                        </dd>
                                    </div>
                                </dl>

                                {message.channel === "EMAIL" && message.subject ? (
                                    <div>
                                        <div className="mb-1 text-xs text-muted uppercase tracking-wide">
                                            Subject
                                        </div>
                                        <div className="text-sm font-medium text-foreground">
                                            {message.subject}
                                        </div>
                                    </div>
                                ) : null}

                                <div>
                                    <div className="mb-1 text-xs text-muted uppercase tracking-wide">
                                        Message
                                    </div>
                                    <div className="rounded-lg border border-border bg-surface-secondary/30 p-3">
                                        <MessageBodyPreview
                                            channel={message.channel}
                                            content={message.content}
                                            className="max-w-none"
                                        />
                                    </div>
                                </div>
                            </Modal.Body>
                        </>
                    ) : null}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
