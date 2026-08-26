import type { Contact } from "@/features/contacts/interfaces/contact.interface";
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

export interface ListContactListMembersQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: Contact["status"];
    tags?: string[];
    filter_uuid?: string;
}

export interface PaginatedListMembers {
    data: Contact[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
