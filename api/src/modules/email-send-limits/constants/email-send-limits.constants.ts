import { ExternalIntegrationProvider, GoalPeriod } from '@/generated/prisma';

export const EMAIL_SEND_LIMIT_PROVIDERS: ExternalIntegrationProvider[] = [
    ExternalIntegrationProvider.RESEND,
    ExternalIntegrationProvider.SMTP,
];

export const EMAIL_SEND_LIMIT_PERIODS: GoalPeriod[] = [
    GoalPeriod.DAY,
    GoalPeriod.WEEK,
    GoalPeriod.MONTH,
];

export const EMAIL_SEND_LIMIT_PROVIDER_LABELS: Record<ExternalIntegrationProvider, string> = {
    [ExternalIntegrationProvider.RESEND]: 'Resend',
    [ExternalIntegrationProvider.SMTP]: 'SMTP',
} as Record<ExternalIntegrationProvider, string>;

export const EMAIL_SEND_LIMIT_PERIOD_LABELS: Record<GoalPeriod, string> = {
    [GoalPeriod.DAY]: 'Daily',
    [GoalPeriod.WEEK]: 'Weekly',
    [GoalPeriod.MONTH]: 'Monthly',
};
