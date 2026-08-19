import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { UpsertEmailSendLimitPayload } from "../interfaces/email-send-limits.interfaces";
import {
    deleteEmailSendLimit,
    listEmailSendLimits,
    upsertEmailSendLimit,
} from "../services/email-send-limits.services";

export const emailSendLimitsQueryKeys = {
    all: ["email-send-limits"] as const,
    list: ["email-send-limits", "list"] as const,
};

export function useEmailSendLimits() {
    return useQuery({
        queryKey: emailSendLimitsQueryKeys.list,
        queryFn: listEmailSendLimits,
        staleTime: 10_000,
    });
}

export function useUpsertEmailSendLimit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpsertEmailSendLimitPayload) => upsertEmailSendLimit(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: emailSendLimitsQueryKeys.all });
            toast({ title: "Send limit saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save send limit",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useDeleteEmailSendLimit() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteEmailSendLimit(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: emailSendLimitsQueryKeys.all });
            toast({ title: "Send limit removed", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not remove send limit",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}
