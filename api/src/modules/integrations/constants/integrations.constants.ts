import { ExternalIntegrationProvider } from '@/generated/prisma';

export const INTEGRATION_PROVIDERS: ExternalIntegrationProvider[] = [
  ExternalIntegrationProvider.OPENAI,
  ExternalIntegrationProvider.RESEND,
  ExternalIntegrationProvider.SMTP,
  ExternalIntegrationProvider.TWILIO,
  ExternalIntegrationProvider.APIFY,
  ExternalIntegrationProvider.SCRAPIO,
  ExternalIntegrationProvider.MAILTESTER,
  ExternalIntegrationProvider.HUBSPOT,
];

export const DISABLED_INTEGRATION_PROVIDERS: ExternalIntegrationProvider[] = [
  ExternalIntegrationProvider.TWILIO,
  ExternalIntegrationProvider.HUBSPOT,
];

/**
 * Resolves the path segment of a provider's inbound webhook URL. Most providers use a
 * fixed path and resolve the organisation from the payload itself. Scrapio is multi-tenant
 * per connected account, so its webhook must be scoped by integration id — the resolver
 * returns null until the integration (and therefore its id) exists.
 */
export const INTEGRATION_WEBHOOK_PATHS: Partial<
  Record<
    ExternalIntegrationProvider,
    (integration_uuid: string | null) => string | null
  >
> = {
  [ExternalIntegrationProvider.OPENAI]: () => '/webhooks/openai',
  [ExternalIntegrationProvider.RESEND]: () => '/webhooks/resend',
  [ExternalIntegrationProvider.SCRAPIO]: (integration_uuid) =>
    integration_uuid ? `/webhooks/scrapio/${integration_uuid}` : null,
};

export const INTEGRATION_PROVIDER_LABELS: Record<
  ExternalIntegrationProvider,
  string
> = {
  [ExternalIntegrationProvider.OPENAI]: 'OpenAI',
  [ExternalIntegrationProvider.ANTHROPIC]: 'Anthropic',
  [ExternalIntegrationProvider.RESEND]: 'Resend',
  [ExternalIntegrationProvider.SMTP]: 'SMTP',
  [ExternalIntegrationProvider.TWILIO]: 'Twilio',
  [ExternalIntegrationProvider.APIFY]: 'Apify',
  [ExternalIntegrationProvider.SCRAPIO]: 'Scrapio',
  [ExternalIntegrationProvider.MAILTESTER]: 'MailTester',
  [ExternalIntegrationProvider.HUBSPOT]: 'HubSpot',
};

export const INTEGRATION_PROVIDER_DESCRIPTIONS: Record<
  ExternalIntegrationProvider,
  string
> = {
  [ExternalIntegrationProvider.OPENAI]:
    'GPT models for enrichment, scoring, and message drafting. Add your API key and webhook secret, then paste the webhook URL into the OpenAI dashboard.',
  [ExternalIntegrationProvider.ANTHROPIC]: 'Claude models for AI workflows.',
  [ExternalIntegrationProvider.RESEND]:
    'Transactional email and inbound webhooks. Add API key and from address per account, then paste the webhook URL into Resend and store the signing secret.',
  [ExternalIntegrationProvider.SMTP]:
    'Custom SMTP servers for outbound email. Add multiple accounts with host, port, username, password, and from address.',
  [ExternalIntegrationProvider.TWILIO]: 'SMS outreach credentials.',
  [ExternalIntegrationProvider.APIFY]:
    'Lead scraping from LinkedIn, Google Maps, and more.',
  [ExternalIntegrationProvider.SCRAPIO]:
    'AI-built web scrapers for your own sites. Add your Scrapio API key, then paste the webhook URL into your Scrapio account and store the signing secret it gives you.',
  [ExternalIntegrationProvider.MAILTESTER]:
    'Email verification via MailTester. Add your API key to validate contact emails.',
  [ExternalIntegrationProvider.HUBSPOT]: 'CRM sync and marketing automation.',
};
