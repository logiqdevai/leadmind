import type { ComponentType } from "react";
import { Chip, Modal } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import {
    Mail,
    MailOpen,
    MessageCircleReply,
    MousePointerClick,
    Send,
    XCircle,
} from "lucide-react";
import {
    InteractionType,
    MsgStatus,
    type Interaction,
} from "@/features/contacts/interfaces/contact.interface";
import { useOutreachMessageThread } from "@/features/outreach/hooks/use-outreach";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";
import { MessageBodyPreview } from "./message-body-preview";

interface MessageThreadModalProps {
    messageUuid: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const EVENT_ICON: Partial<Record<InteractionType, ComponentType<{ className?: string }>>> = {
    [InteractionType.EMAIL_DELIVERED]: Mail,
    [InteractionType.EMAIL_OPENED]: MailOpen,
    [InteractionType.LINK_CLICKED]: MousePointerClick,
    [InteractionType.REPLY_RECEIVED]: MessageCircleReply,
    [InteractionType.EMAIL_BOUNCED]: XCircle,
    [InteractionType.EMAIL_FAILED]: XCircle,
};

const EVENT_LABEL: Partial<Record<InteractionType, string>> = {
    [InteractionType.EMAIL_DELIVERED]: "Delivered",
    [InteractionType.EMAIL_OPENED]: "Opened",
    [InteractionType.LINK_CLICKED]: "Link clicked",
    [InteractionType.REPLY_RECEIVED]: "Reply",
    [InteractionType.EMAIL_BOUNCED]: "Bounced",
    [InteractionType.EMAIL_FAILED]: "Failed",
};

function replySubject(interaction: Interaction): string | null {
    const meta = interaction.metadata;
    if (!meta || typeof meta !== "object") return null;
    const subject = (meta as Record<string, unknown>).subject;
    return typeof subject === "string" && subject.trim() ? subject : null;
}

function replyHtml(interaction: Interaction): string | null {
    const meta = interaction.metadata;
    if (!meta || typeof meta !== "object") return null;
    const html = (meta as Record<string, unknown>).html;
    return typeof html === "string" && html.trim() ? html : null;
}

function ThreadEvent({ interaction }: { interaction: Interaction }) {
    const Icon = EVENT_ICON[interaction.type];
    const label = EVENT_LABEL[interaction.type];
    if (!Icon || !label) return null;

    if (interaction.type === InteractionType.REPLY_RECEIVED) {
        const html = replyHtml(interaction);
        const subject = replySubject(interaction);
        return (
            <div className="flex gap-3">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                    <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-border/80 bg-surface/60 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Reply</span>
                        <span
                            className="text-xs text-muted"
                            title={new Date(interaction.created_at).toLocaleString()}
                        >
                            {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    {subject ? <p className="mb-1 text-xs text-muted break-words">{subject}</p> : null}
                    {html ? (
                        <div
                            className="max-w-prose text-sm leading-relaxed text-foreground [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(html) }}
                        />
                    ) : interaction.content?.trim() ? (
                        <p className="whitespace-pre-line break-words text-sm text-foreground">
                            {interaction.content}
                        </p>
                    ) : (
                        <p className="text-sm italic text-muted">(no content)</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-secondary text-muted">
                <Icon className="size-3.5" />
            </span>
            <span className="text-sm text-foreground">{label}</span>
            <span
                className="text-xs text-muted"
                title={new Date(interaction.created_at).toLocaleString()}
            >
                {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true })}
            </span>
        </div>
    );
}

export function MessageThreadModal({ messageUuid, isOpen, onOpenChange }: MessageThreadModalProps) {
    const { data, isLoading } = useOutreachMessageThread(isOpen ? messageUuid : null);

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>Conversation</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body>
                        {isLoading || !data ? (
                            <div className="flex flex-col gap-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-12 rounded-xl bg-surface-secondary animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <Chip size="sm" variant="soft">
                                            <Chip.Label>{data.message.channel}</Chip.Label>
                                        </Chip>
                                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                                            <Send className="size-3" />
                                            {data.message.sent_at
                                                ? new Date(data.message.sent_at).toLocaleString()
                                                : "Not sent"}
                                        </span>
                                    </div>
                                    {data.message.subject ? (
                                        <h4 className="mb-1 text-sm font-medium text-foreground">
                                            {data.message.subject}
                                        </h4>
                                    ) : null}
                                    <MessageBodyPreview
                                        channel={data.message.channel}
                                        content={data.message.content}
                                    />
                                </div>

                                {data.interactions.length === 0 ? (
                                    <p className="text-sm italic text-muted">
                                        No delivery events yet
                                        {data.message.status === MsgStatus.PENDING ? " — this message hasn't been sent." : "."}
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-3 pl-1">
                                        {data.interactions.map((interaction) => (
                                            <ThreadEvent key={interaction.uuid} interaction={interaction} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
