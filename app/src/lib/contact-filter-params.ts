import type { ContactFilters } from "@/interfaces/contact-filters.interface";
import type { ListContactsQuery } from "@/features/contacts/interfaces/contact.interface";
import { isLeadStatus } from "@/features/contacts/constants/contacts.constants";
import { isContactProfileField } from "@/features/contacts/constants/contact-profile-fields.constants";
import { SourceType, type SourceType as SourceTypeValue } from "@/features/leads/interfaces/lead.interface";
import { parseScoreRulesParam, serializeScoreRulesParam } from "@/lib/contact-score-rules";

const isSourceType = (value: string | null): value is SourceTypeValue =>
    !!value && (Object.values(SourceType) as string[]).includes(value);

function parseTagsParam(searchParams: URLSearchParams): string[] {
    const repeated = searchParams.getAll("tags").flatMap((entry) =>
        entry
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
    );
    if (repeated.length > 0) return [...new Set(repeated)];

    const bracketed = searchParams.getAll("tags[]").map((tag) => tag.trim()).filter(Boolean);
    if (bracketed.length > 0) return [...new Set(bracketed)];

    return [];
}

function parseBooleanParam(value: string | null): boolean | undefined {
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}

export function parseContactFiltersFromSearchParams(
    searchParams: URLSearchParams,
): ContactFilters {
    const profileFieldParam = searchParams.get("profile_field");
    const profileField = isContactProfileField(profileFieldParam) ? profileFieldParam : undefined;
    const hasProfileField = profileField
        ? parseBooleanParam(searchParams.get("has_profile_field")) ?? true
        : undefined;
    const statusParam = searchParams.get("status");

    const tags = parseTagsParam(searchParams);

    const sourceTypeParam = searchParams.get("source_type");

    return {
        search: searchParams.get("search") || undefined,
        filter_uuid: searchParams.get("filter_uuid") || undefined,
        contact_list_uuid: searchParams.get("contact_list_uuid") || undefined,
        status: isLeadStatus(statusParam) ? statusParam : undefined,
        source_type: isSourceType(sourceTypeParam) ? sourceTypeParam : undefined,
        tags: tags.length > 0 ? tags : undefined,
        score_rules: (() => {
            const rules = parseScoreRulesParam(searchParams.get("score_rules"));
            return rules.length > 0 ? rules : undefined;
        })(),
        profile_field: profileField,
        has_profile_field: hasProfileField,
        last_interaction_after: searchParams.get("last_interaction_after") || undefined,
        last_interaction_before: searchParams.get("last_interaction_before") || undefined,
        never_contacted: parseBooleanParam(searchParams.get("never_contacted")),
        include_unsubscribed: parseBooleanParam(searchParams.get("include_unsubscribed")),
        has_email: parseBooleanParam(searchParams.get("has_email")),
        has_phone: parseBooleanParam(searchParams.get("has_phone")),
    };
}

export function serializeContactFiltersToSearchParams(
    filters: ContactFilters,
): Record<string, string | undefined> {
    const scoreRules = serializeScoreRulesParam(filters.score_rules ?? []);

    return {
        search: filters.search,
        filter_uuid: filters.filter_uuid,
        contact_list_uuid: filters.contact_list_uuid,
        status: filters.status,
        source_type: filters.source_type,
        tags: filters.tags?.length ? filters.tags.join(",") : undefined,
        score_rules: scoreRules,
        profile_field: filters.profile_field,
        has_profile_field:
            filters.profile_field && filters.has_profile_field !== undefined
                ? String(filters.has_profile_field)
                : undefined,
        last_interaction_after: filters.last_interaction_after,
        last_interaction_before: filters.last_interaction_before,
        never_contacted:
            filters.never_contacted !== undefined ? String(filters.never_contacted) : undefined,
        include_unsubscribed:
            filters.include_unsubscribed !== undefined
                ? String(filters.include_unsubscribed)
                : undefined,
        has_email: filters.has_email !== undefined ? String(filters.has_email) : undefined,
        has_phone: filters.has_phone !== undefined ? String(filters.has_phone) : undefined,
    };
}

export function contactFiltersToListQuery(
    filters: ContactFilters,
    pagination?: Pick<ListContactsQuery, "page" | "limit" | "exclude_list_uuid">,
): ListContactsQuery {
    return {
        ...filters,
        page: pagination?.page,
        limit: pagination?.limit,
        exclude_list_uuid: pagination?.exclude_list_uuid,
    };
}

/** Human-readable summary of the active filters, for report headers. */
export function describeContactFilters(filters: ContactFilters): string[] {
    const parts: string[] = [];

    if (filters.search) parts.push(`search "${filters.search}"`);
    if (filters.status) parts.push(`status ${filters.status.toLowerCase()}`);
    if (filters.source_type) parts.push(`source ${filters.source_type.toLowerCase()}`);
    if (filters.tags?.length) parts.push(`tags ${filters.tags.join(" / ")}`);
    if (filters.score_rules?.length) parts.push(`${filters.score_rules.length} score rule(s)`);
    if (filters.profile_field) {
        parts.push(
            `${filters.has_profile_field === false ? "missing" : "has"} ${filters.profile_field.toLowerCase()}`,
        );
    }
    if (filters.has_email !== undefined) parts.push(filters.has_email ? "has email" : "no email");
    if (filters.has_phone !== undefined) parts.push(filters.has_phone ? "has phone" : "no phone");
    if (filters.never_contacted) parts.push("never contacted");
    if (filters.include_unsubscribed) parts.push("including unsubscribed");
    if (filters.last_interaction_after) {
        parts.push(`last interaction after ${filters.last_interaction_after.slice(0, 10)}`);
    }
    if (filters.last_interaction_before) {
        parts.push(`last interaction before ${filters.last_interaction_before.slice(0, 10)}`);
    }

    return parts;
}

export function hasActiveContactFilters(filters: ContactFilters): boolean {
    const serialized = serializeContactFiltersToSearchParams(filters);
    return Object.values(serialized).some((value) => value != null && value !== "");
}

export const CONTACT_FILTER_KEYS: (keyof ContactFilters)[] = [
    "search",
    "filter_uuid",
    "contact_list_uuid",
    "source_type",
    "status",
    "tags",
    "score_rules",
    "profile_field",
    "has_profile_field",
    "last_interaction_after",
    "last_interaction_before",
    "never_contacted",
    "include_unsubscribed",
    "has_email",
    "has_phone",
];

export function toFullContactFiltersPatch(
    filters: Partial<ContactFilters> = {},
): Partial<ContactFilters> {
    const patch: Partial<ContactFilters> = {};
    for (const key of CONTACT_FILTER_KEYS) {
        (patch as Record<string, unknown>)[key] = filters[key] ?? undefined;
    }
    return patch;
}

export function contactFiltersToBulkScrapePayload(
    filters: ContactFilters,
): Omit<ListContactsQuery, "page" | "limit"> {
    const { page: _page, limit: _limit, ...rest } = contactFiltersToListQuery(filters);
    return rest;
}

export function buildContactListApiParams(
    query: ListContactsQuery = {},
): Record<string, string | number | undefined> {
    const params: Record<string, string | number | undefined> = {};

    if (query.page !== undefined) params.page = query.page;
    if (query.limit !== undefined) params.limit = query.limit;
    if (query.search) params.search = query.search;
    if (query.status) params.status = query.status;
    if (query.source_type) params.source_type = query.source_type;
    if (query.filter_uuid) params.filter_uuid = query.filter_uuid;
    if (query.lead_uuid) params.lead_uuid = query.lead_uuid;
    if (query.exclude_list_uuid) params.exclude_list_uuid = query.exclude_list_uuid;
    if (query.contact_list_uuid) params.contact_list_uuid = query.contact_list_uuid;
    if (query.include_sublists !== undefined) params.include_sublists = String(query.include_sublists);
    if (query.campaign_uuid) params.campaign_uuid = query.campaign_uuid;
    if (query.profile_field) params.profile_field = query.profile_field;
    if (query.last_interaction_after) params.last_interaction_after = query.last_interaction_after;
    if (query.last_interaction_before) params.last_interaction_before = query.last_interaction_before;

    if (query.tags?.length) params.tags = query.tags.join(",");
    if (query.score_rules?.length) params.score_rules = JSON.stringify(query.score_rules);

    if (query.has_profile_field !== undefined) {
        params.has_profile_field = String(query.has_profile_field);
    }
    if (query.never_contacted !== undefined) params.never_contacted = String(query.never_contacted);
    if (query.include_unsubscribed !== undefined) {
        params.include_unsubscribed = String(query.include_unsubscribed);
    }

    return params;
}
