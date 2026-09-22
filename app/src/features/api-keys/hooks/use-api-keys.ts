import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    createApiKey,
    deleteApiKey,
    listApiKeys,
    revokeApiKey,
    updateApiKey,
} from "../services/api-keys.service";
import type { CreateApiKeyDto, UpdateApiKeyDto } from "../interfaces/api-key.interfaces";

export const apiKeyQueryKeys = {
    all: ["api-keys"] as const,
    list: ["api-keys", "list"] as const,
};

export function useApiKeys(enabled = true) {
    return useQuery({
        queryKey: apiKeyQueryKeys.list,
        queryFn: listApiKeys,
        enabled,
    });
}

export function useCreateApiKey() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (dto: CreateApiKeyDto) => createApiKey(dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
            toast({ title: "API key created", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not create API key",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useUpdateApiKey() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ uuid, dto }: { uuid: string; dto: UpdateApiKeyDto }) =>
            updateApiKey(uuid, dto),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
            toast({ title: "API key updated", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update API key",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useRevokeApiKey() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (uuid: string) => revokeApiKey(uuid),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
            toast({ title: "API key revoked", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not revoke API key",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useDeleteApiKey() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (uuid: string) => deleteApiKey(uuid),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
            toast({ title: "API key deleted", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete API key",
                description: error.message,
                variant: "error",
            });
        },
    });
}
