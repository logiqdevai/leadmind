import { type ComponentType, useState } from "react";
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
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import {
    Channel,
    InteractionType,
    ThreadOrigin,
    type Interaction,
    type OutreachMessage,
} from "@/features/contacts/interfaces/contact.interface";
import { useAiDraftMessage, useReplyToContact } from "@/features/contacts/hooks/use-contacts";
import { useThreadDetail } from "@/features/outreach/hooks/use-outreach";
import {
    MessageComposer,
    type AiGenerateArgs,
    type MessageComposerValue,
} from "@/features/messaging/components/message-composer";
import { MessageTemplateSelect } from "@/features/messaging/components/message-template-select";
import { mergeTemplateIntoComposer } from "@/features/message-templates/utils/message-template-composer.utils";
import { isEmailHtmlEmpty, sanitizeEmailHtml } from "@/lib/sanitize-html";
import { MessageBodyPreview } from "./message-body-preview";

interface MessageThreadModalProps {
    threadUuid: string | null;
    contactUuid: string | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const ORIGIN_LABEL: Record<ThreadOrigin, string> = {
    [ThreadOrigin.MANUAL]: "Manual",
    [ThreadOrigin.SEQUENCE]: "Sequence",
    [ThreadOrigin.CAMPAIGN]: "Campaign",
};

function ThreadMessage({ message }: { message: OutreachMessage }) {
    return (
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
            <div className="mb-1.5 flex items-center gap-2">
                <Chip size="sm" variant="soft">
                    <Chip.Label>{message.channel}</Chip.Label>
                </Chip>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Send className="size-3" />
                    {message.sent_at ? new Date(message.sent_at).toLocaleString() : "Not sent"}
                </span>
            </div>
            {message.subject ? (
                <h4 className="mb-1 text-sm font-medium text-foreground">{message.subject}</h4>
            ) : null}
            <MessageBodyPreview channel={message.channel} content={message.content} />
        </div>
    );
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

function ReplyBox({
    contactUuid,
    outreachMessageUuid,
    defaultSubject,
    onSent,
}: {
    contactUuid: string;
    outreachMessageUuid: string;
    defaultSubject: string;
    onSent: () => void;
}) {
    const replyMut = useReplyToContact();
    const aiDraft = useAiDraftMessage();
    const [value, setValue] = useState<MessageComposerValue>({
        emailSubject: defaultSubject,
        emailContent: "",
        smsContent: "",
        callContent: "",
        linkedinContent: "",
    });

    const handleAiGenerate = async (args: AiGenerateArgs) => {
        const result = await aiDraft.mutateAsync({
            contact_uuid: contactUuid,
            channel: args.channel,
            action: args.action,
            prompt: args.prompt,
            language: args.language,
            current_subject: args.currentSubject,
            current_content: args.currentContent,
            outreach_message_uuid: outreachMessageUuid,
        });
        return { subject: result.subject, content: result.content };
    };

    const handleSend = () => {
        const trimmedContent = value.emailContent.trim();
        if (isEmailHtmlEmpty(trimmedContent)) return;
        replyMut.mutate(
            {
                uuid: contactUuid,
                payload: {
                    outreach_message_uuid: outreachMessageUuid,
                    subject: value.emailSubject.trim() || undefined,
                    content: trimmedContent,
                },
            },
            {
                onSuccess: () => {
                    setValue((prev) => ({ ...prev, emailContent: "" }));
                    onSent();
                },
            },
        );
    };

    return (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-3">
            <div className="mb-2 flex items-center gap-2">
                <MessageCircleReply className="size-3.5 text-muted" />
                <span className="text-sm font-medium text-foreground">Reply</span>
            </div>
            <div className="flex flex-col gap-3">
                <MessageTemplateSelect
                    allowedChannels={[Channel.EMAIL]}
                    disabled={replyMut.isPending}
                    onSelect={(template) =>
                        setValue((prev) => mergeTemplateIntoComposer(prev, template))
                    }
                />
                <MessageComposer
                    channels={[Channel.EMAIL]}
                    activeChannel={Channel.EMAIL}
                    onActiveChannelChange={() => {}}
                    value={value}
                    onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
                    onAiGenerate={handleAiGenerate}
                    isAiPending={aiDraft.isPending}
                    disabled={replyMut.isPending}
                />
                <div className="flex justify-end">
                    <ActionButtonWithPending
                        size="sm"
                        variant="secondary"
                        isDisabled={replyMut.isPending || isEmailHtmlEmpty(value.emailContent)}
                        isPending={replyMut.isPending}
                        onPress={handleSend}
                    >
                        Send reply
                    </ActionButtonWithPending>
                </div>
            </div>
        </div>
    );
}

export function MessageThreadModal({
    threadUuid,
    contactUuid,
    isOpen,
    onOpenChange,
}: MessageThreadModalProps) {
    const { data, isLoading } = useThreadDetail(isOpen ? threadUuid : null);

    // The most recent outbound email in the thread that has a reply on it - that's what a new
    // reply threads onto (In-Reply-To). Earlier messages may also have replies, but replying
    // continues the conversation from its latest point.
    const replyTarget = [...(data?.timeline ?? [])]
        .reverse()
        .find(
            (entry): entry is Extract<typeof entry, { kind: "outbound" }> =>
                entry.kind === "outbound" &&
                entry.message.channel === Channel.EMAIL &&
                Boolean(entry.message.replied_at),
        )?.message;
    const canReply = Boolean(contactUuid && replyTarget);

    return (
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger />
                    <Modal.Header>
                        <Modal.Heading>{data?.thread.subject || "Conversation"}</Modal.Heading>
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
                                <div>
                                    <Chip size="sm" variant="soft">
                                        <Chip.Label>{ORIGIN_LABEL[data.thread.origin]}</Chip.Label>
                                    </Chip>
                                </div>

                                {data.timeline.length === 0 ? (
                                    <p className="text-sm italic text-muted">No messages yet.</p>
                                ) : (
                                    <div className="flex flex-col gap-3 pl-1">
                                        {data.timeline.map((entry) =>
                                            entry.kind === "outbound" ? (
                                                <ThreadMessage key={entry.message.uuid} message={entry.message} />
                                            ) : (
                                                <ThreadEvent
                                                    key={entry.interaction.uuid}
                                                    interaction={entry.interaction}
                                                />
                                            ),
                                        )}
                                    </div>
                                )}

                                {canReply ? (
                                    <ReplyBox
                                        contactUuid={contactUuid!}
                                        outreachMessageUuid={replyTarget!.uuid}
                                        defaultSubject={
                                            replyTarget!.reply_subject || replyTarget!.subject
                                                ? `Re: ${(replyTarget!.reply_subject ?? replyTarget!.subject ?? "").replace(/^re:\s*/i, "")}`
                                                : ""
                                        }
                                        onSent={() => {}}
                                    />
                                ) : null}
                            </div>
                        )}
                    </Modal.Body>
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
}
