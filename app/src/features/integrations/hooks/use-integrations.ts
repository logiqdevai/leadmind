import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    addAccountDomain,
    createIntegrationKey,
    createResendAccount,
    deleteIntegrationKey,
    listIntegrations,
    removeAccountDomain,
    setDefaultAccountDomain,
    setDefaultIntegrationAccount,
    updateAccountDomain,
    updateIntegrationAccount,
    updateIntegrationKey,
} from "../services/integrations.service";
import type {
    AddIntegrationAccountDomainPayload,
    CreateIntegrationKeyPayload,
    CreateResendAccountPayload,
    IntegrationProvider,
    SetDefaultIntegrationAccountPayload,
    UpdateIntegrationAccountDomainPayload,
    UpdateIntegrationAccountPayload,
    UpdateIntegrationKeyPayload,
} from "../interfaces/integrations.interface";

export const integrationsQueryKeys = {
    all: ["integrations"] as const,
    list: () => ["integrations", "list"] as const,
};

export function useIntegrations() {
    return useQuery({
        queryKey: integrationsQueryKeys.list(),
        queryFn: () => listIntegrations(),
    });
}

export function useCreateIntegrationKey(provider: IntegrationProvider) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateIntegrationKeyPayload) =>
            createIntegrationKey(provider, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Key saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save key",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useUpdateIntegrationKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: {
            uuid: string;
            payload: UpdateIntegrationKeyPayload;
        }) => updateIntegrationKey(vars.uuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Key updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update key",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useDeleteIntegrationKey() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteIntegrationKey(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Key deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete key",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useSetDefaultIntegrationAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: {
            provider: IntegrationProvider;
            payload: SetDefaultIntegrationAccountPayload;
        }) => setDefaultIntegrationAccount(vars.provider, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Default account updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not set default account",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useCreateResendAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateResendAccountPayload) =>
            createResendAccount(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Resend account saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save Resend account",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useAddAccountDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: {
            accountUuid: string;
            payload: AddIntegrationAccountDomainPayload;
        }) => addAccountDomain(vars.accountUuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Domain added", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not add domain",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useUpdateAccountDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: {
            domainUuid: string;
            payload: UpdateIntegrationAccountDomainPayload;
        }) => updateAccountDomain(vars.domainUuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Domain updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update domain",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useSetDefaultAccountDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (domainUuid: string) => setDefaultAccountDomain(domainUuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Default domain updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not set default domain",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useRemoveAccountDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (domainUuid: string) => removeAccountDomain(domainUuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Domain deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete domain",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}

export function useUpdateIntegrationAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: {
            provider: IntegrationProvider;
            account: string;
            payload: UpdateIntegrationAccountPayload;
        }) =>
            updateIntegrationAccount(
                vars.provider,
                vars.account,
                vars.payload,
            ),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: integrationsQueryKeys.all });
            toast({ title: "Account title updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update account title",
                description: error.message,
                variant: "error",
                duration: 4000,
            });
        },
    });
}
