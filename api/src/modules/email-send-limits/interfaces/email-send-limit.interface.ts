import { ExternalIntegrationProvider, GoalPeriod } from '@/generated/prisma';

export interface EmailSendLimitStatus {
    uuid: string | null;
    provider: ExternalIntegrationProvider;
    period: GoalPeriod;
    limit: number | null;
    is_active: boolean;
    used: number;
    remaining: number | null;
    reached: boolean;
    resets_at: string;
}
