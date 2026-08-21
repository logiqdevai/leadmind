import { DateTime } from 'luxon';

export type PeriodWindow = {
  period_key: string;
  starts_at: Date;
  ends_at: Date;
};

/**
 * Generic period-bucketing type: superset of GoalPeriod ('DAY'|'WEEK'|'MONTH') plus
 * 'HOUR' for sending-policy/min-interval math. GoalPeriod values are assignable here
 * as-is, so this stays the single implementation for every period-window computation
 * in the app (EmailSendLimit display, sending-policy stage limits, usage counters).
 */
export type PeriodUnitLike = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';

export function getPeriodWindow(
  period: PeriodUnitLike,
  timezone: string,
  at: Date = new Date(),
): PeriodWindow {
  const zone = timezone || 'UTC';
  const now = DateTime.fromJSDate(at, { zone });

  if (period === 'HOUR') {
    const start = now.startOf('hour');
    const end = now.endOf('hour');
    return {
      period_key: start.toFormat("yyyy-MM-dd'T'HH"),
      starts_at: start.toUTC().toJSDate(),
      ends_at: end.toUTC().toJSDate(),
    };
  }

  if (period === 'DAY') {
    const start = now.startOf('day');
    const end = now.endOf('day');
    return {
      period_key: start.toFormat('yyyy-MM-dd'),
      starts_at: start.toUTC().toJSDate(),
      ends_at: end.toUTC().toJSDate(),
    };
  }

  if (period === 'WEEK') {
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
