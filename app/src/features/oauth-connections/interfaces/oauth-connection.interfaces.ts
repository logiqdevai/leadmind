export type OAuthConnectionStatus = "ACTIVE" | "REVOKED";

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
