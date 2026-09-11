import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    bulkResendOutreachMessages,
    createAndSendMessage,
    createDraftMessage,
    deleteOutreachMessage,
    getOutreachMessageThread,
    getThreadDetail,
    listInboxContacts,
    sendOutreachMessage,
    updateOutreachMessage,
} from "../services/outreach.service";
import type {
    CreateMessagePayload,
    SendMessagePayload,
    UpdateMessagePayload,
} from "@/features/contacts/interfaces/contact.interface";
import type { ListInboxContactsQuery } from "@/features/outreach/interfaces/send-history.interface";
import { contactsQueryKeys } from "@/features/contacts/hooks/use-contacts";
import { sendHistoryQueryKeys } from "@/features/outreach/hooks/use-send-history";
import { syncCachesAfterOutreachSend } from "@/features/outreach/utils/sync-contact-caches-after-send";
import { toast } from "@/hooks/use-toast";

interface MessageMutationContext {
    contact_uuid?: string;
    campaign_uuid?: string;
}

const invalidateAfterMessageChange = (
    qc: ReturnType<typeof useQueryClient>,
    vars: MessageMutationContext,
) => {
    qc.invalidateQueries({ queryKey: contactsQueryKeys.all });
    qc.invalidateQueries({ queryKey: sendHistoryQueryKeys.all });
    if (vars.contact_uuid) {
        qc.invalidateQueries({ queryKey: contactsQueryKeys.detail(vars.contact_uuid) });
        qc.invalidateQueries({ queryKey: contactsQueryKeys.messages(vars.contact_uuid) });
        qc.invalidateQueries({ queryKey: contactsQueryKeys.threads(vars.contact_uuid) });
    }
    if (vars.campaign_uuid) {
        qc.invalidateQueries({ queryKey: ["marketing-campaigns", "draft-messages", vars.campaign_uuid] });
        qc.invalidateQueries({ queryKey: ["marketing-campaigns", "detail", vars.campaign_uuid] });
    }
};

export function useUpdateOutreachMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpdateMessagePayload } & MessageMutationContext) =>
            updateOutreachMessage(vars.uuid, vars.payload),
        onSuccess: (_data, vars) => {
            invalidateAfterMessageChange(qc, vars);
            toast({ title: "Draft saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save draft",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useSendOutreachMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload?: SendMessagePayload } & MessageMutationContext) =>
            sendOutreachMessage(vars.uuid, vars.payload),
        onSuccess: async (_data, vars) => {
            await syncCachesAfterOutreachSend(qc, vars);
            toast({
                title: "Message queued for send",
                description: "We'll update its status when delivery completes.",
                duration: 2500,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not send message",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useBulkResendOutreachMessages() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuids: string[]; contact_uuids?: string[] }) =>
            bulkResendOutreachMessages(vars.uuids),
        onSuccess: async (data, vars) => {
            await syncCachesAfterOutreachSend(qc, { contact_uuids: vars.contact_uuids });
            toast({
                title:
                    data.failed === 0
                        ? `${data.succeeded} message${data.succeeded === 1 ? "" : "s"} queued for resend`
                        : `${data.succeeded} queued, ${data.failed} failed`,
                duration: 3000,
                variant: data.failed > 0 ? "error" : undefined,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not resend messages",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useCreateDraftMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateMessagePayload) => createDraftMessage(payload),
        onSuccess: (_data, payload) => {
            invalidateAfterMessageChange(qc, { contact_uuid: payload.contact_uuid });
            toast({ title: "Draft saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save draft",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useCreateAndSendMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateMessagePayload) => createAndSendMessage(payload),
        onSuccess: async (_data, payload) => {
            await syncCachesAfterOutreachSend(qc, { contact_uuid: payload.contact_uuid });
            toast({
                title: "Message queued for send",
                description: "We'll update its status when delivery completes.",
                duration: 2500,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not send message",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useOutreachMessageThread(uuid: string | null | undefined) {
    return useQuery({
        queryKey: ["outreach-message-thread", uuid],
        queryFn: () => getOutreachMessageThread(uuid as string),
        enabled: !!uuid,
    });
}

export function useThreadDetail(threadUuid: string | null | undefined) {
    return useQuery({
        queryKey: ["thread-detail", threadUuid],
        queryFn: () => getThreadDetail(threadUuid as string),
        enabled: !!threadUuid,
    });
}

export const inboxContactsQueryKeys = {
    all: ["inbox-contacts"] as const,
    list: (query: ListInboxContactsQuery) => ["inbox-contacts", "list", query] as const,
};

export function useInboxContacts(query: ListInboxContactsQuery) {
    return useQuery({
        queryKey: inboxContactsQueryKeys.list(query),
        queryFn: () => listInboxContacts(query),
        placeholderData: (prev) => prev,
    });
}

export function useDeleteOutreachMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string } & MessageMutationContext) =>
            deleteOutreachMessage(vars.uuid),
        onSuccess: (_data, vars) => {
            invalidateAfterMessageChange(qc, vars);
            toast({ title: "Draft deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete draft",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}
