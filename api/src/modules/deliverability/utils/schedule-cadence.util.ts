import { DateTime } from 'luxon';
import { DeliverabilityFrequency } from '@/generated/prisma';

export interface CadenceInput {
  frequency: DeliverabilityFrequency;
  /** "HH:mm" in `timezone`. */
  time_of_day: string;
  /** ISO weekday 1 (Mon) - 7 (Sun); WEEKLY only. */
  weekday?: number | null;
  /** 1-28; MONTHLY only. */
  day_of_month?: number | null;
  /** EVERY_N_DAYS only. */
  interval_days?: number | null;
  timezone: string;
}

/** How BullMQ should repeat the job: a cron pattern, or a fixed interval anchored at a start date. */
export type RepeatSpec =
  | { kind: 'cron'; pattern: string; tz: string }
  | { kind: 'every'; every_ms: number; start_date: Date };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MAX_DAY_OF_MONTH = 28;
export const MAX_INTERVAL_DAYS = 90;

export function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`time_of_day must be HH:mm, got "${value}"`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}

/**
 * Converts the user-facing structured schedule into a BullMQ repeat spec.
 *
 * DAILY / WEEKLY / MONTHLY map to cron (evaluated in the schedule's timezone, so DST is handled).
 * EVERY_N_DAYS can't be expressed in cron without resetting at month boundaries, so it uses a
 * fixed interval anchored at the next occurrence of `time_of_day`; across a DST change it drifts
 * by an hour.
 */
export function buildRepeatSpec(
  input: CadenceInput,
  now: Date = new Date(),
): RepeatSpec {
  const { hour, minute } = parseTimeOfDay(input.time_of_day);
  const tz = input.timezone;

  switch (input.frequency) {
    case DeliverabilityFrequency.DAILY:
      return { kind: 'cron', pattern: `${minute} ${hour} * * *`, tz };

    case DeliverabilityFrequency.WEEKLY: {
      const weekday = input.weekday;
      if (weekday == null || weekday < 1 || weekday > 7) {
        throw new Error('weekday (1-7) is required for WEEKLY schedules');
      }
      // Cron uses 0-6 with Sunday = 0; ISO uses 7 for Sunday.
      return { kind: 'cron', pattern: `${minute} ${hour} * * ${weekday % 7}`, tz };
    }

    case DeliverabilityFrequency.MONTHLY: {
      const day = input.day_of_month;
      if (day == null || day < 1 || day > MAX_DAY_OF_MONTH) {
        throw new Error(
          `day_of_month (1-${MAX_DAY_OF_MONTH}) is required for MONTHLY schedules`,
        );
      }
      return { kind: 'cron', pattern: `${minute} ${hour} ${day} * *`, tz };
    }

    case DeliverabilityFrequency.EVERY_N_DAYS: {
      const days = input.interval_days;
      if (days == null || days < 1 || days > MAX_INTERVAL_DAYS) {
        throw new Error(
          `interval_days (1-${MAX_INTERVAL_DAYS}) is required for EVERY_N_DAYS schedules`,
        );
      }
      return {
        kind: 'every',
        every_ms: days * MS_PER_DAY,
        start_date: nextOccurrence(hour, minute, tz, now),
      };
    }
  }
}

/** The next wall-clock `hour:minute` in `tz` strictly after `now`. */
export function nextOccurrence(
  hour: number,
  minute: number,
  tz: string,
  now: Date,
): Date {
  const zoned = DateTime.fromJSDate(now, { zone: tz });
  let candidate = zoned.set({ hour, minute, second: 0, millisecond: 0 });
  if (candidate <= zoned) candidate = candidate.plus({ days: 1 });
  return candidate.toUTC().toJSDate();
}
