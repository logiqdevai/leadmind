export type OAuthConnectionStatus = "ACTIVE" | "REVOKED";

export const ACCESS_TOKEN_EXPIRY_VALUES = ["7d", "30d", "90d", "1y", "never"] as const;
export type AccessTokenExpiry = (typeof ACCESS_TOKEN_EXPIRY_VALUES)[number];

export const ACCESS_TOKEN_SCOPE_VALUES = ["mcp:read", "mcp:write"] as const;
export type AccessTokenScope = (typeof ACCESS_TOKEN_SCOPE_VALUES)[number];

export interface CreateAccessTokenDto {
    expires_in: AccessTokenExpiry;
    scopes: AccessTokenScope[];
}

// Returned once, from POST /oauth/connections/access-tokens - never retrievable again.
export interface CreatedAccessToken {
    token: string;
    scope: string;
    organisation_uuid: string;
    expires_at: string | null;
}

export interface OAuthConnection {
    uuid: string;
    organisation_uuid: string;
    oauth_client_id: string;
    client_name: string | null;
    client_uri: string | null;
    scope: string;
    status: OAuthConnectionStatus;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
    granted_by: {
        uuid: string;
        email: string;
        full_name: string | null;
    };
}
