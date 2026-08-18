import type { IntegrationProvider } from "../interfaces/integrations.interface";

export const INTEGRATION_PROVIDER_OFFICIAL_URLS: Partial<
    Record<IntegrationProvider, string>
> = {
    OPENAI: "https://platform.openai.com/api-keys",
    ANTHROPIC: "https://console.anthropic.com/settings/keys",
    RESEND: "https://resend.com/api-keys",
    TWILIO: "https://console.twilio.com",
    APIFY: "https://console.apify.com/settings/integrations",
    SCRAPIO: "https://scrapio.logiqdev.com",
    HUBSPOT:
        "https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview",
};

export function getIntegrationOfficialUrl(
    provider: IntegrationProvider,
): string | undefined {
    return INTEGRATION_PROVIDER_OFFICIAL_URLS[provider];
}
