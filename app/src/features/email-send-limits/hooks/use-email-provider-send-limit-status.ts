import { useMemo } from "react";
import type { IntegrationProvider } from "@/features/integrations/interfaces/integrations.interface";
import { useEmailSendLimits } from "./use-email-send-limits";

export interface EmailProviderSendLimitStatus {
    reached: boolean;
    message: string | null;
}

const PERIOD_LABELS: Record<string, string> = {
    DAY: "Daily",
    WEEK: "Weekly",
    MONTH: "Monthly",
};

const PROVIDER_LABELS: Record<string, string> = {
    RESEND: "Resend",
    SMTP: "SMTP",
};

export function useEmailProviderSendLimitStatus(
    provider: IntegrationProvider | null | undefined,
): EmailProviderSendLimitStatus {
    const { data } = useEmailSendLimits();

    return useMemo(() => {
        if (!provider || !data) {
            return { reached: false, message: null };
        }
        const reachedLimit = data.find(
            (status) => status.provider === provider && status.reached,
        );
        if (!reachedLimit) {
            return { reached: false, message: null };
        }
        const periodLabel = PERIOD_LABELS[reachedLimit.period] ?? reachedLimit.period;
        const providerLabel = PROVIDER_LABELS[reachedLimit.provider] ?? reachedLimit.provider;
        return {
            reached: true,
            message: `${periodLabel} ${providerLabel} send limit reached (${reachedLimit.used}/${reachedLimit.limit}). Sending is paused until it resets.`,
        };
    }, [data, provider]);
}
