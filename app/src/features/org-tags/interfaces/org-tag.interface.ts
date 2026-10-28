export type OrgTagEntityType = "CONTACT_LIST" | "SEQUENCE" | "CAMPAIGN" | "FILTER" | "MESSAGE_TEMPLATE";

/** The slim tag shape embedded in lists, sequences, campaigns, filters and message templates. */
export interface OrgTagSummary {
    uuid: string;
    name: string;
    color: string | null;
}

export interface OrgTag extends OrgTagSummary {
    usage: Partial<Record<OrgTagEntityType, number>> & { total: number };
}

export interface CreateOrgTagPayload {
    name: string;
    color?: string;
}

export type UpdateOrgTagPayload = Partial<CreateOrgTagPayload>;

export interface BulkUpdateOrgTagsPayload {
    entity_type: OrgTagEntityType;
    entity_uuids: string[];
    add_tag_uuids?: string[];
    remove_tag_uuids?: string[];
}

export type TagMatchMode = "any" | "all";

/** Tag params every taggable list endpoint accepts. */
export interface TagFilterQuery {
    tag_uuids?: string[];
    tag_match?: TagMatchMode;
    untagged?: boolean;
}

export interface Paginated<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
