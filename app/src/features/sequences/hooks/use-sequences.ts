import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    activateSequence,
    addSequenceStep,
    archiveSequence,
    bulkEnrollContactsInSequence,
    cancelSequenceEnrollment,
    createSequence,
    deleteSequence,
    deleteSequenceStep,
    enrollContactInSequence,
    getSequence,
    listSequenceEnrollments,
    listSequences,
    reorderSequenceSteps,
    updateSequence,
    updateSequenceStep,
} from "../services/sequences.service";
import type {
    CreateSequencePayload,
    CreateSequenceStepPayload,
    ListSequencesQuery,
    UpdateSequencePayload,
    UpdateSequenceStepPayload,
} from "../interfaces/sequence.interface";
import { toast } from "@/hooks/use-toast";
import { contactsQueryKeys } from "@/features/contacts/hooks/use-contacts";

export const sequencesQueryKeys = {
    all: ["sequences"] as const,
    list: (query: ListSequencesQuery = {}) => ["sequences", "list", query] as const,
    detail: (uuid: string) => ["sequences", "detail", uuid] as const,
    enrollments: (uuid: string, query: { page?: number; limit?: number } = {}) =>
        ["sequences", "enrollments", uuid, query] as const,
};

export function useSequences(query: ListSequencesQuery = {}) {
    return useQuery({
        queryKey: sequencesQueryKeys.list(query),
        queryFn: () => listSequences(query),
        staleTime: 30_000,
    });
}

export function useSequence(uuid: string | null | undefined) {
    return useQuery({
        queryKey: uuid ? sequencesQueryKeys.detail(uuid) : ["sequences", "detail", "none"],
        queryFn: () => getSequence(uuid as string),
        enabled: !!uuid,
    });
}

export function useSequenceEnrollments(
    uuid: string | null | undefined,
    query: { page?: number; limit?: number } = {},
) {
    return useQuery({
        queryKey: uuid ? sequencesQueryKeys.enrollments(uuid, query) : ["sequences", "enrollments", "none"],
        queryFn: () => listSequenceEnrollments(uuid as string, query),
        enabled: !!uuid,
        placeholderData: (prev) => prev,
    });
}

export function useCreateSequence() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateSequencePayload) => createSequence(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.all });
            toast({ title: "Sequence created", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not create sequence",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useUpdateSequence() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpdateSequencePayload }) =>
            updateSequence(vars.uuid, vars.payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(vars.uuid) });
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.all });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save sequence",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useDeleteSequence() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteSequence(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.all });
            toast({ title: "Sequence deleted", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete sequence",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useActivateSequence() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => activateSequence(uuid),
        onSuccess: (_data, uuid) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(uuid) });
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.all });
            toast({ title: "Sequence activated", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not activate sequence",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useArchiveSequence() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => archiveSequence(uuid),
        onSuccess: (_data, uuid) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(uuid) });
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.all });
            toast({ title: "Sequence archived", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not archive sequence",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useAddSequenceStep() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: CreateSequenceStepPayload }) =>
            addSequenceStep(vars.uuid, vars.payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(vars.uuid) });
            toast({ title: "Step added", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not add step",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useUpdateSequenceStep() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; stepUuid: string; payload: UpdateSequenceStepPayload }) =>
            updateSequenceStep(vars.uuid, vars.stepUuid, vars.payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(vars.uuid) });
            toast({ title: "Step saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save step",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useDeleteSequenceStep() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; stepUuid: string }) => deleteSequenceStep(vars.uuid, vars.stepUuid),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(vars.uuid) });
            toast({ title: "Step deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete step",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useReorderSequenceSteps() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; step_uuids: string[] }) =>
            reorderSequenceSteps(vars.uuid, vars.step_uuids),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.detail(vars.uuid) });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not reorder steps",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useEnrollContact() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; contact_uuid: string }) =>
            enrollContactInSequence(vars.uuid, vars.contact_uuid),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.enrollments(vars.uuid) });
            qc.invalidateQueries({ queryKey: contactsQueryKeys.detail(vars.contact_uuid) });
            toast({ title: "Contact enrolled", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not enroll contact",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useBulkEnrollContacts() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; contact_uuids: string[] }) =>
            bulkEnrollContactsInSequence(vars.uuid, vars.contact_uuids),
        onSuccess: (data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.enrollments(vars.uuid) });
            qc.invalidateQueries({ queryKey: contactsQueryKeys.all });
            toast({
                title: "Contacts enrolled",
                description:
                    data.skipped > 0
                        ? `${data.enrolled} enrolled, ${data.skipped} skipped (already enrolled or unreachable).`
                        : `${data.enrolled} contact${data.enrolled === 1 ? "" : "s"} enrolled.`,
                duration: 3000,
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not enroll contacts",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}

export function useCancelEnrollment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; enrollmentUuid: string }) =>
            cancelSequenceEnrollment(vars.uuid, vars.enrollmentUuid),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: sequencesQueryKeys.enrollments(vars.uuid) });
            toast({ title: "Enrollment cancelled", duration: 2000 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not cancel enrollment",
                description: error.message,
                variant: "error",
                duration: 3000,
            });
        },
    });
}
