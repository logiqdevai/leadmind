import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { TagFilterQuery, TagMatchMode } from "@/features/org-tags/interfaces/org-tag.interface";

export interface TagFilterState {
    tagUuids: string[];
    match: TagMatchMode;
    untagged: boolean;
}

/**
 * Tag filter state kept in the URL (`org_tags`, `tag_match`, `untagged`) like the rest of the list-page filters, so it
 * survives reloads and can be shared. Changing it resets `page`.
 */
export function useTagFilterParams() {
    const [searchParams, setSearchParams] = useSearchParams();

    const rawTags = searchParams.get("org_tags") ?? "";
    const rawMatch = searchParams.get("tag_match");
    const untagged = searchParams.get("untagged") === "true";

    const state = useMemo<TagFilterState>(
        () => ({
            tagUuids: rawTags ? rawTags.split(",").filter(Boolean) : [],
            match: rawMatch === "all" ? "all" : "any",
            untagged,
        }),
        [rawTags, rawMatch, untagged],
    );

    const setState = useCallback(
        (next: Partial<TagFilterState>) => {
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev);
                    const merged = { ...state, ...next };
                    // "Untagged" and specific tags are mutually exclusive.
                    const tagUuids = merged.untagged ? [] : merged.tagUuids;
                    if (tagUuids.length) params.set("org_tags", tagUuids.join(","));
                    else params.delete("org_tags");
                    if (merged.match === "all" && tagUuids.length > 1) params.set("tag_match", "all");
                    else params.delete("tag_match");
                    if (merged.untagged) params.set("untagged", "true");
                    else params.delete("untagged");
                    params.delete("page");
                    return params;
                },
                { replace: true },
            );
        },
        [setSearchParams, state],
    );

    const query = useMemo<TagFilterQuery>(
        () => ({
            tag_uuids: state.tagUuids.length ? state.tagUuids : undefined,
            tag_match: state.tagUuids.length > 1 && state.match === "all" ? "all" : undefined,
            untagged: state.untagged || undefined,
        }),
        [state],
    );

    return { state, setState, query, isActive: state.untagged || state.tagUuids.length > 0 };
}
