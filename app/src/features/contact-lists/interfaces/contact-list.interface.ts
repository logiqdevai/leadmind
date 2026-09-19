import type {
    Contact,
    LeadStatus,
    ListContactsQuery,
} from "@/features/contacts/interfaces/contact.interface";
import type { CampaignFilters } from "@/features/marketing-campaigns/interfaces/campaign.interface";

export interface ContactList {
    uuid: string;
    user_uuid: string;
    parent_list_uuid: string | null;
    title: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    contact_count?: number;
    child_count?: number;
    _count?: { members: number; children?: number };
}

export interface ListContactListsQuery {
    page?: number;
    limit?: number;
    search?: string;
    parent_list_uuid?: string;
    root_only?: boolean;
}

export interface PaginatedContactLists {
    data: ContactList[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CreateContactListPayload {
    title: string;
    description?: string;
    parent_list_uuid?: string;
}

export interface UpdateContactListPayload {
    title?: string;
    description?: string | null;
    parent_list_uuid?: string | null;
}

export type ListContactListMembersQuery = Omit<
    ListContactsQuery,
    "contact_list_uuid" | "exclude_list_uuid"
>;

export interface ListMember extends Contact {
    member_uuid: string;
    added_at: string;
    list_status: LeadStatus | null;
}

export interface PaginatedListMembers {
    data: ListMember[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface UpdateListMemberStatusPayload {
    status: LeadStatus;
}

export interface AddListContactsPayload {
    contact_uuids: string[];
}

export interface BulkAddListContactsPayload {
    filters: CampaignFilters;
}

export interface AddListContactsResult {
    added: number;
}

export interface RemoveListContactsResult {
    removed: number;
}

export interface MoveListContactsBelowScoreResult {
    moved: number;
}

export interface FilterListContactsByScorePayload {
    min_score: number;
}

export interface MoveListContactsBelowScorePayload {
    min_score: number;
    target_list_uuid: string;
}

export interface AddListContactsBelowScoreResult {
    added: number;
}

export interface DuplicateListContactRef {
    uuid: string;
    title: string;
}

export interface DuplicateListContact {
    uuid: string;
    name: string | null;
    email: string | null;
    lists: DuplicateListContactRef[];
}

export interface DuplicateListContactsPreview {
    total: number;
    contacts: DuplicateListContact[];
}
