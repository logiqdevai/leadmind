import { ExternalIntegrationProvider } from '@/generated/prisma';

export interface EmailProviderTarget {
    provider: typeof ExternalIntegrationProvider.RESEND | typeof ExternalIntegrationProvider.SMTP;
    account: string;
    /** RESEND only - which domain/from-email to send from. Falls back to the account default when omitted. */
    domain_uuid?: string;
}

export interface EmailProviderAllocation extends EmailProviderTarget {
    count: number;
}

export interface SmtpConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string | null;
}

export interface SendableEmailAccountDomain {
    uuid: string;
    from_email: string;
    from_name: string | null;
    is_default: boolean;
}

export interface SendableEmailAccount extends EmailProviderTarget {
    label: string;
    domains?: SendableEmailAccountDomain[];
}
