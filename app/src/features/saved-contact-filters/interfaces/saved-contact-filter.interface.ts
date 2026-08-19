import type { ContactFilters } from "@/interfaces/contact-filters.interface";

export interface SavedContactFilter {
    uuid: string;
    name: string;
    filters: ContactFilters;
    created_at: string;
    updated_at: string;
}

export interface CreateSavedContactFilterPayload {
    name: string;
    filters: ContactFilters;
}

export type UpdateSavedContactFilterPayload = Partial<CreateSavedContactFilterPayload>;
