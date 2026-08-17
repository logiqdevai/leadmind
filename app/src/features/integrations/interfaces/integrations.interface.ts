export const IntegrationProviders = {
    OPENAI: "OPENAI",
    ANTHROPIC: "ANTHROPIC",
    RESEND: "RESEND",
    SMTP: "SMTP",
    TWILIO: "TWILIO",
    APIFY: "APIFY",
    SCRAPIO: "SCRAPIO",
    HUBSPOT: "HUBSPOT",
} as const;

export type IntegrationProvider =
    (typeof IntegrationProviders)[keyof typeof IntegrationProviders];

export const IntegrationKeyTypes = {
    API_KEY: "API_KEY",
    WEBHOOK_SECRET: "WEBHOOK_SECRET",
    ACCOUNT_SID: "ACCOUNT_SID",
    AUTH_TOKEN: "AUTH_TOKEN",
    ACCESS_TOKEN: "ACCESS_TOKEN",
    HOST: "HOST",
    PORT: "PORT",
    USERNAME: "USERNAME",
    PASSWORD: "PASSWORD",
    FROM_EMAIL: "FROM_EMAIL",
    FROM_NAME: "FROM_NAME",
} as const;

export type IntegrationKeyType =
    (typeof IntegrationKeyTypes)[keyof typeof IntegrationKeyTypes];

export interface IntegrationKeyTypeOption {
    key_type: IntegrationKeyType;
    label: string;
    placeholder: string;
}

export interface IntegrationKey {
    uuid: string;
    key_type: IntegrationKeyType;
    account: string;
    label: string;
    env_name: string;
    last4: string | null;
    display_value: string | null;
    created_at: string;
    updated_at: string;
}

export interface IntegrationAccountView {
    account: string;
    title: string;
}

export interface IntegrationProviderView {
    provider: IntegrationProvider;
    uuid: string | null;
    label: string;
    description: string;
    disabled?: boolean;
    allows_multiple_accounts?: boolean;
    supports_default_account_selection?: boolean;
    default_account: string | null;
    accounts?: IntegrationAccountView[];
    keyTypes: IntegrationKeyTypeOption[];
    keys: IntegrationKey[];
    webhook_url?: string | null;
}

export interface SetDefaultIntegrationAccountPayload {
    account: string;
}

export interface UpdateIntegrationAccountPayload {
    title: string;
}

export type EmailDeliveryProvider = "RESEND" | "SMTP";

export interface EmailProviderTarget {
    provider: EmailDeliveryProvider;
    account: string;
}

export interface EmailProviderAllocation extends EmailProviderTarget {
    count: number;
}

export interface CreateIntegrationKeyPayload {
    key_type: IntegrationKeyType;
    account: string;
    title?: string;
    secret: string;
}

export interface CreateSmtpAccountPayload {
    account: string;
    title: string;
    host: string;
    port: number;
    username: string;
    password: string;
    from_email: string;
    from_name?: string;
}

export interface UpdateIntegrationKeyPayload {
    secret: string;
}
