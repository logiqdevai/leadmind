import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    createSavedContactFilter,
    deleteSavedContactFilter,
    listSavedContactFilters,
    updateSavedContactFilter,
} from "../services/saved-contact-filters.service";
import type {
    CreateSavedContactFilterPayload,
    UpdateSavedContactFilterPayload,
} from "../interfaces/saved-contact-filter.interface";

export const savedContactFiltersQueryKeys = {
    all: ["saved-contact-filters"] as const,
    list: () => ["saved-contact-filters", "list"] as const,
    detail: (uuid: string) => ["saved-contact-filters", "detail", uuid] as const,
};

export function useSavedContactFilters() {
    return useQuery({
        queryKey: savedContactFiltersQueryKeys.list(),
        queryFn: () => listSavedContactFilters(),
    });
}

export function useCreateSavedContactFilter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateSavedContactFilterPayload) =>
            createSavedContactFilter(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: savedContactFiltersQueryKeys.all });
            toast({ title: "Filter saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save filter",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useUpdateSavedContactFilter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpdateSavedContactFilterPayload }) =>
            updateSavedContactFilter(vars.uuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: savedContactFiltersQueryKeys.all });
            toast({ title: "Filter updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update filter",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useDeleteSavedContactFilter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deleteSavedContactFilter(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: savedContactFiltersQueryKeys.all });
            toast({ title: "Filter deleted", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not delete filter",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}
