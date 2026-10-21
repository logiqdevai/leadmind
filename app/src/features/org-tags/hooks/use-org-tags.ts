import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
    bulkUpdateOrgTags,
    createOrgTag,
    deleteOrgTag,
    listOrgTags,
    updateOrgTag,
} from "../services/org-tags.service";
import type {
    BulkUpdateOrgTagsPayload,
    CreateOrgTagPayload,
    UpdateOrgTagPayload,
} from "../interfaces/org-tag.interface";

export const orgTagQueryKeys = {
    all: ["org-tags"] as const,
};

/** Every tag reaches the four taggable entities, so their cached lists go stale when tags change. */
const TAGGABLE_QUERY_ROOTS = ["contact-lists", "sequences", "marketing-campaigns", "filters"] as const;

function useInvalidateTaggables() {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: orgTagQueryKeys.all });
        for (const root of TAGGABLE_QUERY_ROOTS) {
            queryClient.invalidateQueries({ queryKey: [root] });
        }
    };
}

export function useOrgTags(enabled = true) {
    return useQuery({
        queryKey: orgTagQueryKeys.all,
        queryFn: listOrgTags,
        staleTime: 30_000,
        enabled,
    });
}

export function useCreateOrgTag() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateOrgTagPayload) => createOrgTag(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: orgTagQueryKeys.all }),
        onError: (error: Error) =>
            toast({ title: "Could not create tag", description: error.message, duration: 3000, variant: "error" }),
    });
}

export function useUpdateOrgTag() {
    const invalidate = useInvalidateTaggables();
    return useMutation({
        mutationFn: ({ uuid, ...payload }: UpdateOrgTagPayload & { uuid: string }) =>
            updateOrgTag(uuid, payload),
        onSuccess: invalidate,
        onError: (error: Error) =>
            toast({ title: "Could not update tag", description: error.message, duration: 3000, variant: "error" }),
    });
}

export function useDeleteOrgTag() {
    const invalidate = useInvalidateTaggables();
    return useMutation({
        mutationFn: (uuid: string) => deleteOrgTag(uuid),
        onSuccess: invalidate,
        onError: (error: Error) =>
            toast({ title: "Could not delete tag", description: error.message, duration: 3000, variant: "error" }),
    });
}

export function useBulkUpdateOrgTags() {
    const invalidate = useInvalidateTaggables();
    return useMutation({
        mutationFn: (payload: BulkUpdateOrgTagsPayload) => bulkUpdateOrgTags(payload),
        onSuccess: invalidate,
        onError: (error: Error) =>
            toast({ title: "Could not update tags", description: error.message, duration: 3000, variant: "error" }),
    });
}
