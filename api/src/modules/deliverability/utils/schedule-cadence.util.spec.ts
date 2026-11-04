import { isValidCron } from 'cron-validator';
import { DeliverabilityFrequency } from '@/generated/prisma';
import {
  buildRepeatSpec,
  isValidTimezone,
  nextOccurrence,
  parseTimeOfDay,
} from './schedule-cadence.util';

const base = { time_of_day: '12:00', timezone: 'UTC' };

describe('buildRepeatSpec', () => {
  it('maps DAILY to a daily cron at the given time', () => {
    const spec = buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.DAILY });
    expect(spec).toEqual({ kind: 'cron', pattern: '0 12 * * *', tz: 'UTC' });
  });

  it('maps WEEKLY and converts ISO Sunday (7) to cron 0', () => {
    const monday = buildRepeatSpec({ ...base, time_of_day: '15:30', frequency: DeliverabilityFrequency.WEEKLY, weekday: 1 });
    const sunday = buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.WEEKLY, weekday: 7 });
    expect(monday).toMatchObject({ pattern: '30 15 * * 1' });
    expect(sunday).toMatchObject({ pattern: '0 12 * * 0' });
  });

  it('maps MONTHLY to a day-of-month cron', () => {
    const spec = buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.MONTHLY, day_of_month: 15 });
    expect(spec).toMatchObject({ pattern: '0 12 15 * *' });
  });

  it('produces valid cron expressions', () => {
    const specs = [
      buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.DAILY }),
      buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.WEEKLY, weekday: 3 }),
      buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.MONTHLY, day_of_month: 28 }),
    ];
    for (const spec of specs) {
      expect(spec.kind === 'cron' && isValidCron(spec.pattern)).toBe(true);
    }
  });

  it('maps EVERY_N_DAYS to a fixed interval anchored at the next time of day', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    const spec = buildRepeatSpec(
      { ...base, time_of_day: '04:00', frequency: DeliverabilityFrequency.EVERY_N_DAYS, interval_days: 3 },
      now,
    );
    expect(spec).toEqual({
      kind: 'every',
      every_ms: 3 * 24 * 60 * 60 * 1000,
      start_date: new Date('2026-11-05T04:00:00Z'),
    });
  });

  it('rejects missing or out-of-range cadence fields', () => {
    expect(() => buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.WEEKLY })).toThrow();
    expect(() => buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.MONTHLY, day_of_month: 31 })).toThrow();
    expect(() => buildRepeatSpec({ ...base, frequency: DeliverabilityFrequency.EVERY_N_DAYS, interval_days: 0 })).toThrow();
  });
});

describe('nextOccurrence', () => {
  it('rolls to tomorrow when today\'s time has passed, in the given timezone', () => {
    // 2026-11-04 12:00 UTC is 14:00 in Athens (UTC+2); 12:00 Athens already passed.
    const next = nextOccurrence(12, 0, 'Europe/Athens', new Date('2026-11-04T12:00:00Z'));
    expect(next).toEqual(new Date('2026-11-05T10:00:00Z'));
  });

  it('uses today when the time is still ahead', () => {
    const next = nextOccurrence(15, 0, 'UTC', new Date('2026-11-04T12:00:00Z'));
    expect(next).toEqual(new Date('2026-11-04T15:00:00Z'));
  });
});

describe('parseTimeOfDay / isValidTimezone', () => {
  it('parses HH:mm and rejects anything else', () => {
    expect(parseTimeOfDay('04:05')).toEqual({ hour: 4, minute: 5 });
    expect(() => parseTimeOfDay('4:05')).toThrow();
    expect(() => parseTimeOfDay('24:00')).toThrow();
  });

  it('validates IANA timezones', () => {
    expect(isValidTimezone('Europe/Athens')).toBe(true);
    expect(isValidTimezone('Mars/Phobos')).toBe(false);
  });
});
