import { SequenceDelayUnit } from '@/generated/prisma';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export function addDelay(
    base: Date,
    value: number,
    unit: SequenceDelayUnit,
): Date {
    switch (unit) {
        case SequenceDelayUnit.HOURS:
            return new Date(base.getTime() + value * MS_PER_HOUR);
        case SequenceDelayUnit.DAYS:
            return new Date(base.getTime() + value * MS_PER_DAY);
        case SequenceDelayUnit.WEEKS:
            return new Date(base.getTime() + value * MS_PER_WEEK);
        case SequenceDelayUnit.MONTHS: {
            const result = new Date(base.getTime());
            result.setMonth(result.getMonth() + value);
            return result;
        }
        default:
            return new Date(base.getTime());
    }
}

const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Pins `result`'s wall-clock time (server-local) to `send_time` ("HH:MM", 24h),
 * rolling forward one calendar day if that pin would land at or before `base`.
 * No-op when send_time is null/undefined.
 */
export function applySendTime(
    result: Date,
    base: Date,
    send_time?: string | null,
): Date {
    if (!send_time) return result;
    const match = SEND_TIME_PATTERN.exec(send_time);
    if (!match) return result;
    const pinned = new Date(result.getTime());
    pinned.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (pinned.getTime() <= base.getTime()) {
        pinned.setDate(pinned.getDate() + 1);
    }
    return pinned;
}

/** addDelay + applySendTime composed - the function callers should use for step scheduling. */
export function resolveStepScheduledAt(
    base: Date,
    value: number,
    unit: SequenceDelayUnit,
    send_time?: string | null,
): Date {
    return applySendTime(addDelay(base, value, unit), base, send_time);
}
