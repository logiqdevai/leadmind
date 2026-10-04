import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    createOAuthAccessToken,
    listOAuthConnections,
    revokeOAuthConnection,
} from "../services/oauth-connections.service";
import type { CreateAccessTokenDto } from "../interfaces/oauth-connection.interfaces";

export const oauthConnectionQueryKeys = {
    all: ["oauth-connections"] as const,
    list: ["oauth-connections", "list"] as const,
};

export function useOAuthConnections(enabled = true) {
    return useQuery({
        queryKey: oauthConnectionQueryKeys.list,
        queryFn: listOAuthConnections,
        enabled,
    });
}

export function useRevokeOAuthConnection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (uuid: string) => revokeOAuthConnection(uuid),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: oauthConnectionQueryKeys.all });
            toast({ title: "Access revoked", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not revoke access",
                description: error.message,
                variant: "error",
            });
        },
    });
}

export function useCreateOAuthAccessToken() {
    return useMutation({
        mutationFn: (dto: CreateAccessTokenDto) => createOAuthAccessToken(dto),
        onError: (error: Error) => {
            toast({
                title: "Could not create access token",
                description: error.message,
                variant: "error",
            });
        },
    });
}
