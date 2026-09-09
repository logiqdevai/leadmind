import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Chip } from "@heroui/react";
import { ArrowLeft, Plus, RefreshCcw, Workflow, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/profile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ComposeMessageModal } from "@/features/messaging/components/compose-message-modal";
import { EnrollInSequenceModal } from "@/features/sequences/components/enroll-in-sequence-modal";
import { useContact, useContactThreads } from "@/features/contacts/hooks/use-contacts";
import { useSendOutreachMessage } from "@/features/outreach/hooks/use-outreach";
import { useCancelEnrollment } from "@/features/sequences/hooks/use-sequences";
import { SequenceEnrollmentStatus } from "@/features/sequences/interfaces/sequence.interface";
import { MsgStatus, type ConversationThread } from "@/features/contacts/interfaces/contact.interface";
import { ORIGIN_COLOR, ORIGIN_LABEL } from "@/features/messaging/components/thread-conversation";

interface InboxThreadListProps {
    contactUuid: string;
    selectedThreadUuid: string | null;
    onSelectThread: (uuid: string) => void;
    onBack: () => void;
    onViewContact: () => void;
}

export function InboxThreadList({
    contactUuid,
    selectedThreadUuid,
    onSelectThread,
    onBack,
    onViewContact,
}: InboxThreadListProps) {
    const qc = useQueryClient();
    const { data: contact } = useContact(contactUuid);
    const { data: threads = [], isLoading } = useContactThreads(contactUuid);
    const sendMessage = useSendOutreachMessage();
    const cancelEnrollmentMut = useCancelEnrollment();
    const [composeOpen, setComposeOpen] = useState(false);
    const [enrollOpen, setEnrollOpen] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<ConversationThread | null>(null);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border p-3">
                <Button
                    size="sm"
                    variant="ghost"
                    className="min-w-7 h-7 shrink-0 px-1 md:hidden"
                    onPress={onBack}
                    aria-label="Back to contacts"
                >
                    <ArrowLeft className="size-4" />
                </Button>
                <button
                    type="button"
                    onClick={onViewContact}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[11px] font-medium text-foreground">
                        {initialsFromName(contact?.name)}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground hover:text-accent">
                        {contact?.name ?? "Contact"}
                    </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onPress={() => setEnrollOpen(true)}
                        aria-label="Enroll in sequence"
                    >
                        <Workflow className="size-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onPress={() => setComposeOpen(true)}
                        aria-label="New message"
                    >
                        <Plus className="size-3.5" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <ThreadListSkeleton />
                ) : threads.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted">No conversations with this contact yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {threads.map((thread) => (
                            <li key={thread.uuid}>
                                <button
                                    type="button"
                                    onClick={() => onSelectThread(thread.uuid)}
                                    className={cn(
                                        "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary/60",
                                        selectedThreadUuid === thread.uuid && "bg-accent/10",
                                    )}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Chip size="sm" variant="soft" color={ORIGIN_COLOR[thread.origin]}>
                                            <Chip.Label>{ORIGIN_LABEL[thread.origin]}</Chip.Label>
                                        </Chip>
                                        {thread.needs_reply ? (
                                            <span className="size-2 rounded-full bg-accent" aria-label="Needs reply" />
                                        ) : null}
                                        {thread.last_message_at ? (
                                            <span className="ml-auto shrink-0 text-[11px] text-muted">
                                                {formatDistanceToNow(new Date(thread.last_message_at), {
                                                    addSuffix: true,
                                                })}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="truncate text-sm text-foreground">
                                        {thread.subject || "(no subject)"}
                                    </span>
                                    <span className="flex items-center gap-2 text-[11px] text-muted">
                                        <span>
                                            {thread.message_count} message{thread.message_count === 1 ? "" : "s"}
                                        </span>
                                        {thread.last_message?.status === MsgStatus.FAILED ? (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    sendMessage.mutate({
                                                        uuid: thread.last_message!.uuid,
                                                        contact_uuid: contactUuid,
                                                    });
                                                }}
                                                className="inline-flex items-center gap-1 text-accent hover:underline"
                                            >
                                                <RefreshCcw className="size-3" />
                                                Resend
                                            </span>
                                        ) : null}
                                        {thread.sequence_enrollment?.status === SequenceEnrollmentStatus.ACTIVE ? (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCancelTarget(thread);
                                                }}
                                                className="inline-flex items-center gap-1 text-danger hover:underline"
                                            >
                                                <XCircle className="size-3" />
                                                Cancel sequence
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <ComposeMessageModal
                isOpen={composeOpen}
                onOpenChange={setComposeOpen}
                contactUuid={contactUuid}
                recipientEmail={contact?.email}
                recipientEmailValidationStatus={contact?.email_validation_status}
                recipientEmailValidationReason={contact?.email_validation_reason}
            />
            <EnrollInSequenceModal isOpen={enrollOpen} onOpenChange={setEnrollOpen} contactUuid={contactUuid} />

            <ConfirmDialog
                isOpen={!!cancelTarget}
                onOpenChange={(open) => !open && setCancelTarget(null)}
                title="Cancel sequence for this contact?"
                description={
                    cancelTarget
                        ? `${contact?.name ?? "This contact"} will not receive any further steps of "${cancelTarget.sequence_enrollment?.sequence.name}".`
                        : undefined
                }
                confirmLabel="Cancel sequence"
                variant="danger"
                isPending={cancelEnrollmentMut.isPending}
                onConfirm={async () => {
                    if (!cancelTarget?.sequence_enrollment) return;
                    await cancelEnrollmentMut.mutateAsync({
                        uuid: cancelTarget.sequence_enrollment.sequence.uuid,
                        enrollmentUuid: cancelTarget.sequence_enrollment.uuid,
                    });
                    qc.invalidateQueries({ queryKey: ["contact-threads", contactUuid] });
                    setCancelTarget(null);
                }}
            />
        </div>
    );
}

function ThreadListSkeleton() {
    return (
        <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-surface-secondary animate-pulse" />
            ))}
        </div>
    );
}
