import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip } from "@heroui/react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { Pencil, Plus, RefreshCcw, Send, Trash, Workflow } from "lucide-react";
import { Channel, type Contact } from "@/features/contacts/interfaces/contact.interface";
import { MsgStatus, type OutreachMessage } from "@/features/contacts/interfaces/contact.interface";
import { useDeleteOutreachMessage, useSendOutreachMessage } from "@/features/outreach/hooks/use-outreach";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditMessageModal } from "@/pages/dashboard/pages/leads/components/edit-message-modal";
import { cn } from "@/lib/utils";
import { ComposeMessageModal } from "@/features/messaging/components/compose-message-modal";
import { EnrollInSequenceModal } from "@/features/sequences/components/enroll-in-sequence-modal";
import { useIntegrations } from "@/features/integrations/hooks/use-integrations";
import { resolveDefaultEmailTarget } from "@/features/integrations/utils/email-provider-utils";
import { useEmailProviderSendLimitStatus } from "@/features/email-send-limits/hooks/use-email-provider-send-limit-status";
import { MessageBodyPreview } from "./message-body-preview";
import { Section } from "./section";
import { channelIcon } from "../utils/channel-icon";

interface OutreachTabProps {
  contact: Contact;
  highlightUuid?: string | null;
  onHighlightConsumed?: () => void;
  onNavigationLockChange?: (locked: boolean) => void;
}

export function OutreachTab({ contact, highlightUuid, onHighlightConsumed, onNavigationLockChange }: OutreachTabProps) {
  const sendMessage = useSendOutreachMessage();
  const deleteMessage = useDeleteOutreachMessage();
  const { data: integrations = [] } = useIntegrations();
  const defaultEmailTarget = useMemo(
    () => resolveDefaultEmailTarget(integrations),
    [integrations],
  );
  const emailLimitStatus = useEmailProviderSendLimitStatus(defaultEmailTarget?.provider ?? null);

  const [editingMessage, setEditingMessage] = useState<OutreachMessage | null>(null);
  const [draftPendingDelete, setDraftPendingDelete] = useState<OutreachMessage | null>(null);
  const [draftPendingSend, setDraftPendingSend] = useState<OutreachMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [ringedUuid, setRingedUuid] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!highlightUuid) return;
    const el = cardRefs.current.get(highlightUuid);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setRingedUuid(highlightUuid);
    const fadeT = window.setTimeout(() => setRingedUuid(null), 1500);
    const clearT = window.setTimeout(() => onHighlightConsumed?.(), 1600);
    return () => {
      window.clearTimeout(fadeT);
      window.clearTimeout(clearT);
    };
  }, [highlightUuid, onHighlightConsumed]);

  useEffect(() => {
    const locked =
      composeOpen ||
      enrollOpen ||
      editingMessage !== null ||
      draftPendingDelete !== null ||
      draftPendingSend !== null;
    onNavigationLockChange?.(locked);
  }, [composeOpen, enrollOpen, draftPendingDelete, draftPendingSend, editingMessage, onNavigationLockChange]);

  const setCardRef = (uuid: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(uuid, el);
    else cardRefs.current.delete(uuid);
  };

  const { drafts, sentHistory } = useMemo(() => {
    const messages = contact.outreach_messages ?? [];
    const drafts = messages.filter((m) => m.status === MsgStatus.PENDING);
    const sentHistory = messages
      .filter((m) => m.status === MsgStatus.SENT || m.status === MsgStatus.FAILED)
      .sort((a, b) => {
        const at = a.sent_at ?? a.updated_at;
        const bt = b.sent_at ?? b.updated_at;
        return bt.localeCompare(at);
      });
    return { drafts, sentHistory };
  }, [contact.outreach_messages]);

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={`Drafted outreach (${drafts.length})`}
        action={
          <>
            <Button size="sm" variant="tertiary" className="w-full justify-center sm:w-auto" onPress={() => setEnrollOpen(true)}>
              <Workflow className="size-3.5" />
              Enroll in sequence
            </Button>
            <Button size="sm" variant="primary" className="w-full justify-center sm:w-auto" onPress={() => setComposeOpen(true)}>
              <Plus className="size-3.5" />
              New message
            </Button>
          </>
        }
        emptyText="No pending drafts. Click New message to compose one."
      >
        <div className="flex flex-col gap-3">
          {drafts.map((m) => {
            const Icon = channelIcon(m.channel);
            return (
              <article
                key={m.uuid}
                ref={setCardRef(m.uuid)}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/80 p-4 sm:p-5 transition-shadow",
                  ringedUuid === m.uuid && "ring-2 ring-accent ring-offset-1 ring-offset-background",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip size="sm" variant="soft">
                          <Chip.Label>{m.channel}</Chip.Label>
                        </Chip>
                      </div>
                      {m.subject ? (
                        <h4 className="text-sm font-medium leading-snug text-foreground">{m.subject}</h4>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:shrink-0">
                    <Button size="sm" variant="tertiary" onPress={() => setEditingMessage(m)} aria-label="Edit draft">
                      <Pencil className="size-3.5 text-blue-400" />
                    </Button>
                    <ActionButtonWithPending
                      size="sm"
                      variant="tertiary"
                      isDisabled={
                        sendMessage.isPending ||
                        (m.channel === Channel.EMAIL && emailLimitStatus.reached)
                      }
                      isPending={sendMessage.isPending}
                      onPress={() => setDraftPendingSend(m)}
                      aria-label={
                        m.channel === Channel.EMAIL && emailLimitStatus.reached
                          ? emailLimitStatus.message ?? "Send limit reached"
                          : "Send draft"
                      }
                      idleLeading={<Send className="size-3.5 text-emerald-400" />}
                    >
                      {null}
                    </ActionButtonWithPending>
                    <ActionButtonWithPending
                      size="sm"
                      variant="tertiary"
                      isDisabled={deleteMessage.isPending}
                      isPending={deleteMessage.isPending}
                      onPress={() => setDraftPendingDelete(m)}
                      aria-label="Delete draft"
                      idleLeading={<Trash className="size-3.5 text-red-400" />}
                    >
                      {null}
                    </ActionButtonWithPending>
                  </div>
                </div>
                <MessageBodyPreview channel={m.channel} content={m.content} />
              </article>
            );
          })}
        </div>
      </Section>

      <Section title={`Sent history (${sentHistory.length})`} emptyText="No messages have been sent yet.">
        <div className="flex flex-col gap-3">
          {sentHistory.map((m) => (
            <article
              key={m.uuid}
              ref={setCardRef(m.uuid)}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/60 p-4 sm:p-5 transition-shadow",
                ringedUuid === m.uuid && "ring-2 ring-accent ring-offset-1 ring-offset-background",
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip size="sm" color={m.status === MsgStatus.SENT ? "success" : "danger"} variant="soft">
                      <Chip.Label>{m.status}</Chip.Label>
                    </Chip>
                    <Chip size="sm" variant="soft">
                      <Chip.Label>{m.channel}</Chip.Label>
                    </Chip>
                  </div>
                  {m.subject ? (
                    <h4 className="text-sm font-medium leading-snug text-foreground">{m.subject}</h4>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                  {m.status === MsgStatus.FAILED ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center sm:w-auto"
                      isDisabled={
                        sendMessage.isPending ||
                        (m.channel === Channel.EMAIL && emailLimitStatus.reached)
                      }
                      aria-label={
                        m.channel === Channel.EMAIL && emailLimitStatus.reached
                          ? emailLimitStatus.message ?? "Send limit reached"
                          : "Resend"
                      }
                      onPress={() =>
                        sendMessage.mutate({
                          uuid: m.uuid,
                          contact_uuid: contact.uuid,
                        })
                      }
                    >
                      <RefreshCcw className="size-3.5" />
                      Resend
                    </Button>
                  ) : null}
                  <time className="text-xs tabular-nums text-muted">
                    {m.sent_at ? new Date(m.sent_at).toLocaleString() : "—"}
                  </time>
                </div>
              </div>
              <MessageBodyPreview channel={m.channel} content={m.content} />
            </article>
          ))}
        </div>
      </Section>

      <EditMessageModal
        message={editingMessage}
        isOpen={editingMessage !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMessage(null);
        }}
        contact_uuid={contact.uuid}
      />

      <ComposeMessageModal
        isOpen={composeOpen}
        onOpenChange={setComposeOpen}
        contactUuid={contact.uuid}
        recipientEmail={contact.email}
        recipientEmailValidationStatus={contact.email_validation_status}
        recipientEmailValidationReason={contact.email_validation_reason}
      />

      <EnrollInSequenceModal isOpen={enrollOpen} onOpenChange={setEnrollOpen} contactUuid={contact.uuid} />

      <ConfirmDialog
        isOpen={draftPendingSend !== null}
        onOpenChange={(open) => {
          if (!open) setDraftPendingSend(null);
        }}
        title="Send this message?"
        description={
          draftPendingSend
            ? `This will queue the ${draftPendingSend.channel} message for delivery to ${contact.name ?? "this contact"}. You won't be able to edit it after sending.`
            : undefined
        }
        confirmLabel="Send"
        cancelLabel="Cancel"
        variant="default"
        isPending={sendMessage.isPending}
        onConfirm={async () => {
          if (!draftPendingSend) return;
          try {
            await sendMessage.mutateAsync({
              uuid: draftPendingSend.uuid,
              contact_uuid: contact.uuid,
            });
            setDraftPendingSend(null);
          } catch {
            return;
          }
        }}
      />

      <ConfirmDialog
        isOpen={draftPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDraftPendingDelete(null);
        }}
        title="Delete this draft?"
        description={
          draftPendingDelete
            ? `This removes the pending ${draftPendingDelete.channel} draft.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isPending={deleteMessage.isPending}
        onConfirm={async () => {
          if (!draftPendingDelete) return;
          try {
            await deleteMessage.mutateAsync({
              uuid: draftPendingDelete.uuid,
              contact_uuid: contact.uuid,
            });
            setDraftPendingDelete(null);
          } catch {
            return;
          }
        }}
      />
    </div>
  );
}
