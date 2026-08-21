import {
    SendingPeriodUnit,
    type SendingPolicy,
    type UpsertSendingPolicyStagePayload,
} from "../interfaces/sending-policy.interface";

const UNIT_SECONDS: Record<SendingPeriodUnit, number> = {
    HOUR: 3600,
    DAY: 86400,
    WEEK: 604800,
};

const DAY_SECONDS = 86400;

/** Converts a stage's limit/period into an equivalent "per day" rate for comparison. */
export function normalizeDailyLimit(limit: number, periodUnit: SendingPeriodUnit): number {
    return (limit * DAY_SECONDS) / UNIT_SECONDS[periodUnit];
}

export interface ScheduleValidationResult {
    /** Blocking: window end must be after window start. */
    windowOrderError: string | null;
    /** Advisory, one entry per stage (same index) - null when that stage looks feasible. */
    stageWarnings: (string | null)[];
}

/**
 * Checks whether each stage's limit is actually achievable given the sending window and
 * minimum interval - e.g. a 40/day stage with a 2-hour window and a 10-minute interval can
 * only fit ~12 sends/day. This is advisory only (provider limits, failures, and pauses can
 * always affect real delivery), except for a plain window start/end ordering mistake.
 */
export function validateSendingSchedule(
    stages: UpsertSendingPolicyStagePayload[],
    windowStartMinute: number | undefined,
    windowEndMinute: number | undefined,
    minIntervalSeconds: number,
): ScheduleValidationResult {
    const hasWindow = windowStartMinute != null && windowEndMinute != null;

    if (hasWindow && (windowEndMinute as number) <= (windowStartMinute as number)) {
        return {
            windowOrderError: "Sending window end must be after the start time.",
            stageWarnings: stages.map(() => null),
        };
    }

    const windowSeconds = hasWindow
        ? ((windowEndMinute as number) - (windowStartMinute as number)) * 60
        : DAY_SECONDS;
    const maxPerDay =
        minIntervalSeconds > 0 ? Math.floor(windowSeconds / minIntervalSeconds) + 1 : Infinity;

    const stageWarnings = stages.map((stage) => {
        const dailyEquivalent = normalizeDailyLimit(stage.limit, stage.period_unit);
        if (dailyEquivalent <= maxPerDay) return null;

        const windowLabel = hasWindow
            ? `the ${(windowSeconds / 3600).toFixed(windowSeconds % 3600 === 0 ? 0 : 1)}h sending window`
            : "a full day";
        const intervalLabel =
            minIntervalSeconds >= 60
                ? `${Math.round(minIntervalSeconds / 60)}-minute`
                : `${minIntervalSeconds}-second`;
        return `${stage.limit}/${stage.period_unit.toLowerCase()} may not fit in ${windowLabel} at a ${intervalLabel} interval (max ~${maxPerDay}/day).`;
    });

    return { windowOrderError: null, stageWarnings };
}

/** Daily-equivalent capacity of a policy's first stage - a reasonable "starting pace" estimate. */
export function firstStageDailyCapacity(policy: SendingPolicy): number {
    const first = [...policy.stages].sort((a, b) => a.order_index - b.order_index)[0];
    if (!first) return 0;
    return normalizeDailyLimit(first.limit, first.period_unit);
}
