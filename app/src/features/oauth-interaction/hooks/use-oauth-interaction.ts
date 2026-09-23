import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    abortOAuthConsent,
    confirmOAuthConsent,
    getOAuthInteraction,
    submitOAuthLogin,
} from "../services/oauth-interaction.service";

export function useOAuthInteraction(uid: string, enabled = true) {
    return useQuery({
        queryKey: ["oauth-interaction", uid],
        queryFn: () => getOAuthInteraction(uid),
        enabled,
        retry: false,
    });
}

export function useSubmitOAuthLogin(uid: string) {
    return useMutation({
        mutationFn: (organisation_uuid: string) => submitOAuthLogin(uid, organisation_uuid),
        onError: (error: Error) => {
            toast({ title: "Could not continue", description: error.message, variant: "error" });
        },
    });
}

export function useConfirmOAuthConsent(uid: string) {
    return useMutation({
        mutationFn: () => confirmOAuthConsent(uid),
        onError: (error: Error) => {
            toast({ title: "Could not approve access", description: error.message, variant: "error" });
        },
    });
}

export function useAbortOAuthConsent(uid: string) {
    return useMutation({
        mutationFn: () => abortOAuthConsent(uid),
        onError: (error: Error) => {
            toast({ title: "Could not cancel", description: error.message, variant: "error" });
        },
    });
}
