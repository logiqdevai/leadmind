import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type {
    CreateSendingPolicyPayload,
    UpdateSendingPolicyPayload,
    UpsertSendingPolicyStagePayload,
} from "../interfaces/sending-policy.interface";
import {
    addSendingPolicyStage,
    createSendingPolicy,
    deleteSendingPolicy,
    getSendingPolicy,
    listSendingPolicies,
    previewSendingPolicy,
    removeSendingPolicyStage,
    reorderSendingPolicyStages,
    updateSendingPolicy,
    updateSendingPolicyStage,
} from "../services/sending-policy.service";

export const sendingPoliciesQueryKeys = {
    all: ["sending-policies"] as const,
    list: ["sending-policies", "list"] as const,
    detail: (uuid: string) => ["sending-policies", "detail", uuid] as const,
};

export function useSendingPolicies() {
    return useQuery({
        queryKey: sendingPoliciesQueryKeys.list,
        queryFn: listSendingPolicies,
    });
}

export function useSendingPolicy(uuid: string | null) {
    return useQuery({
        queryKey: sendingPoliciesQueryKeys.detail(uuid ?? ""),
        queryFn: () => getSendingPolicy(uuid as string),
        enabled: Boolean(uuid),
    });
}

function useInvalidateSendingPolicies() {
    const qc = useQueryClient();
    return () => qc.invalidateQueries({ queryKey: sendingPoliciesQueryKeys.all });
}

export function useCreateSendingPolicy() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (payload: CreateSendingPolicyPayload) => createSendingPolicy(payload),
        onSuccess: () => {
            invalidate();
            toast({ title: "Sending policy created", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({ title: "Could not create policy", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useUpdateSendingPolicy() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpdateSendingPolicyPayload }) =>
            updateSendingPolicy(vars.uuid, vars.payload),
        onSuccess: () => {
            invalidate();
            toast({ title: "Sending policy updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({ title: "Could not update policy", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useDeleteSendingPolicy() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (uuid: string) => deleteSendingPolicy(uuid),
        onSuccess: () => {
            invalidate();
            toast({ title: "Sending policy deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({ title: "Could not delete policy", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useAddSendingPolicyStage() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpsertSendingPolicyStagePayload }) =>
            addSendingPolicyStage(vars.uuid, vars.payload),
        onSuccess: () => invalidate(),
        onError: (error: Error) => {
            toast({ title: "Could not add stage", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useUpdateSendingPolicyStage() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (vars: { uuid: string; stageUuid: string; payload: UpsertSendingPolicyStagePayload }) =>
            updateSendingPolicyStage(vars.uuid, vars.stageUuid, vars.payload),
        onSuccess: () => invalidate(),
        onError: (error: Error) => {
            toast({ title: "Could not update stage", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useRemoveSendingPolicyStage() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (vars: { uuid: string; stageUuid: string }) =>
            removeSendingPolicyStage(vars.uuid, vars.stageUuid),
        onSuccess: () => invalidate(),
        onError: (error: Error) => {
            toast({ title: "Could not remove stage", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function useReorderSendingPolicyStages() {
    const invalidate = useInvalidateSendingPolicies();
    return useMutation({
        mutationFn: (vars: { uuid: string; stage_uuids: string[] }) =>
            reorderSendingPolicyStages(vars.uuid, vars.stage_uuids),
        onSuccess: () => invalidate(),
        onError: (error: Error) => {
            toast({ title: "Could not reorder stages", description: error.message, variant: "error", duration: 4000 });
        },
    });
}

export function usePreviewSendingPolicy() {
    return useMutation({
        mutationFn: (vars: { uuid: string; contact_count: number }) =>
            previewSendingPolicy(vars.uuid, vars.contact_count),
    });
}
