import type { GoalPeriod } from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import type { IntegrationProvider } from "@/features/integrations/interfaces/integrations.interface";

export interface EmailSendLimitStatus {
    uuid: string | null;
    provider: IntegrationProvider;
    period: GoalPeriod;
    limit: number | null;
    is_active: boolean;
    used: number;
    remaining: number | null;
    reached: boolean;
    resets_at: string;
}

export interface UpsertEmailSendLimitPayload {
    provider: IntegrationProvider;
    period: GoalPeriod;
    max_count: number;
    is_active?: boolean;
}
