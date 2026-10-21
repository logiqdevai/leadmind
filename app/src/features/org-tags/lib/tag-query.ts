import type { TagFilterQuery } from "../interfaces/org-tag.interface";

/**
 * Axios would serialize an array as `tag_uuids[]=a`; the API expects `tag_uuids=a,b`.
 * Spread the result into the request params of any taggable list endpoint.
 */
export function toTagParams<T extends TagFilterQuery>(query: T): Omit<T, "tag_uuids"> & { tag_uuids?: string } {
    const { tag_uuids, ...rest } = query;
    return { ...rest, tag_uuids: tag_uuids?.length ? tag_uuids.join(",") : undefined };
}

export const TAG_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#64748b",
] as const;
