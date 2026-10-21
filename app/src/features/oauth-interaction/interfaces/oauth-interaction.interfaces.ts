export interface OAuthInteractionDetails {
    uid: string;
    prompt: "login" | "consent";
    client?: {
        name: string;
        uri?: string;
    };
    organisationName?: string;
    userEmail?: string;
    scopeDescriptions?: string[];
}

export interface OAuthInteractionResult {
    redirect_to: string;
}
