import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    confirmUnsubscribe,
    previewUnsubscribe,
    resubscribeByToken,
} from "../services/unsubscribe.services";

export function useUnsubscribePreview(token: string) {
    return useQuery({
        queryKey: ["unsubscribe", "preview", token],
        queryFn: () => previewUnsubscribe(token),
        enabled: !!token,
        retry: false,
        refetchOnWindowFocus: false,
    });
}

export function useConfirmUnsubscribe(token: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => confirmUnsubscribe(token),
        onSuccess: (data) => {
            queryClient.setQueryData(["unsubscribe", "preview", token], {
                email: data.email,
                already: true,
            });
            toast({
                title: "Unsubscribed",
                description: "You will no longer receive marketing emails.",
                duration: 2000,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not unsubscribe",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useResubscribeByToken(token: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resubscribeByToken(token),
        onSuccess: (data) => {
            queryClient.setQueryData(["unsubscribe", "preview", token], {
                email: data.email,
                already: false,
            });
            toast({
                title: "Subscribed",
                description: "You will receive marketing emails again.",
                duration: 2000,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not subscribe",
                description: error.message,
                variant: "error",
            });
        },
    });
}
