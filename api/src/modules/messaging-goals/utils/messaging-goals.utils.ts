import { DateTime } from 'luxon';
import { GoalPeriod } from '@/generated/prisma';

export type PeriodWindow = {
    period_key: string;
    starts_at: Date;
    ends_at: Date;
};

export function getPeriodWindow(
    period: GoalPeriod,
    timezone: string,
    at: Date = new Date(),
): PeriodWindow {
    const zone = timezone || 'UTC';
    const now = DateTime.fromJSDate(at, { zone });

    if (period === GoalPeriod.DAY) {
        const start = now.startOf('day');
        const end = now.endOf('day');
        return {
            period_key: start.toFormat('yyyy-MM-dd'),
            starts_at: start.toUTC().toJSDate(),
            ends_at: end.toUTC().toJSDate(),
        };
    }

    if (period === GoalPeriod.WEEK) {
        const start = now.startOf('week');
        const end = now.endOf('week');
        return {
            period_key: `${start.toFormat('yyyy')}-W${start.toFormat('WW')}`,
            starts_at: start.toUTC().toJSDate(),
            ends_at: end.toUTC().toJSDate(),
        };
    }

    const start = now.startOf('month');
    const end = now.endOf('month');
    return {
        period_key: start.toFormat('yyyy-MM'),
        starts_at: start.toUTC().toJSDate(),
        ends_at: end.toUTC().toJSDate(),
    };
}

export const SENT_MESSAGE_STATUSES = [
    'SENT',
    'DELIVERED',
    'OPENED',
    'CLICKED',
    'REPLIED',
] as const;

export const MILESTONE_THRESHOLDS = [
    { type: 'MILESTONE_25' as const, percent: 25 },
    { type: 'MILESTONE_50' as const, percent: 50 },
    { type: 'MILESTONE_75' as const, percent: 75 },
];
