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

/**
 * Reverses getPeriodWindow's period_key encoding back into a calendar date
 * (yyyy-MM-dd), so per-day usage can be read out of SendingUsageCounter rows
 * regardless of which period unit was active when they were written. HOUR keys
 * collapse (and sum) onto their calendar day; WEEK keys attribute the whole
 * week's count to that ISO week's Monday. Returns null for an unrecognized key.
 */
export function periodKeyToDate(period_key: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period_key)) return period_key;

  const hourMatch = /^(\d{4}-\d{2}-\d{2})T\d{2}$/.exec(period_key);
  if (hourMatch) return hourMatch[1];

  const weekMatch = /^(\d{4})-W(\d{2})$/.exec(period_key);
  if (weekMatch) {
    const weekStart = DateTime.fromObject({
      weekYear: Number(weekMatch[1]),
      weekNumber: Number(weekMatch[2]),
      weekday: 1,
    });
    return weekStart.isValid ? weekStart.toFormat('yyyy-MM-dd') : null;
  }

  return null;
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
