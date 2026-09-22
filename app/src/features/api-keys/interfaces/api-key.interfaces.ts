import type { OrganisationRole } from "@/features/organisations/interfaces/organisation.interfaces";

export interface ApiKey {
    uuid: string;
    name: string;
    key_prefix: string;
    last4: string;
    organisation_role: OrganisationRole;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
    created_by_user_uuid: string;
}

// Only returned once, immediately after POST /api-keys - never retrievable again.
export interface CreatedApiKey extends ApiKey {
    token: string;
}

export interface CreateApiKeyDto {
    name: string;
    organisation_role?: OrganisationRole;
    expires_at?: string;
}

export interface UpdateApiKeyDto {
    name?: string;
    organisation_role?: OrganisationRole;
    expires_at?: string;
}
