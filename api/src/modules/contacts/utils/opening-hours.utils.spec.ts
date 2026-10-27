import { BadRequestException } from '@nestjs/common';
import {
    buildOpeningHoursWhere,
    normalizeOpeningHours,
    openingHoursFromRows,
    openingHoursToRows,
    parseGoogleMapsOpeningHours,
    parseHoursText,
} from './opening-hours.utils';

describe('parseHoursText', () => {
    it.each([
        ['9 AM to 5 PM', [{ open: '09:00', close: '17:00' }]],
        ['9:30 AM to 5:45 PM', [{ open: '09:30', close: '17:45' }]],
        ['9 AM to 12 PM, 2 to 6 PM', [{ open: '09:00', close: '12:00' }, { open: '14:00', close: '18:00' }]],
        ['9 to 5 PM', [{ open: '09:00', close: '17:00' }]],
        ['12 AM to 12 PM', [{ open: '00:00', close: '12:00' }]],
        ['6 PM to 2 AM', [{ open: '18:00', close: '02:00' }]],
        ['09:00–17:00', [{ open: '09:00', close: '17:00' }]],
        ['Open 24 hours', [{ open: '00:00', close: '24:00' }]],
        ['Closed', []],
    ])('parses %s', (text, expected) => {
        expect(parseHoursText(text)).toEqual(expected);
    });

    it('returns null for text it cannot read', () => {
        expect(parseHoursText('By appointment')).toBeNull();
        expect(parseHoursText('')).toBeNull();
    });
});

describe('parseGoogleMapsOpeningHours', () => {
    it('maps the scraper list to weekdays', () => {
        const hours = parseGoogleMapsOpeningHours([
            { day: 'Monday', hours: '9 AM to 5 PM' },
            { day: 'Tuesday', hours: '9 AM to 5 PM' },
            { day: 'Sunday', hours: 'Closed' },
        ]);
        expect(hours?.monday).toEqual([{ open: '09:00', close: '17:00' }]);
        expect(hours?.sunday).toEqual([]);
        expect(hours?.wednesday).toEqual([]);
    });

    it('returns null when nothing is usable', () => {
        expect(parseGoogleMapsOpeningHours(undefined)).toBeNull();
        expect(parseGoogleMapsOpeningHours([{ day: 'Monday', hours: 'Closed' }])).toBeNull();
        expect(parseGoogleMapsOpeningHours([{ day: 'Someday', hours: '9 AM to 5 PM' }])).toBeNull();
    });
});

describe('normalizeOpeningHours', () => {
    it('canonicalises and sorts intervals', () => {
        const hours = normalizeOpeningHours({
            Monday: [{ open: '14:00', close: '18:00' }, { open: '9:00', close: '12:00' }],
        });
        expect(hours?.monday).toEqual([{ open: '09:00', close: '12:00' }, { open: '14:00', close: '18:00' }]);
        expect(hours?.tuesday).toEqual([]);
    });

    it('treats empty input as no data', () => {
        expect(normalizeOpeningHours(null)).toBeNull();
        expect(normalizeOpeningHours({ monday: [] })).toBeNull();
    });

    it('rejects invalid input', () => {
        expect(() => normalizeOpeningHours({ funday: [] })).toThrow(BadRequestException);
        expect(() => normalizeOpeningHours({ monday: [{ open: '25:00', close: '26:00' }] })).toThrow(BadRequestException);
        expect(() => normalizeOpeningHours({ monday: [{ open: '09:00', close: '09:00' }] })).toThrow(BadRequestException);
        expect(() => normalizeOpeningHours([])).toThrow(BadRequestException);
    });
});

describe('rows round trip', () => {
    it('stores overnight intervals past 1440 and restores them', () => {
        const hours = normalizeOpeningHours({ friday: [{ open: '18:00', close: '02:00' }] })!;
        const rows = openingHoursToRows(hours);
        expect(rows).toEqual([{ day_of_week: 4, opens_minute: 1080, closes_minute: 1560 }]);
        expect(openingHoursFromRows(rows)).toEqual(hours);
    });
});

describe('buildOpeningHoursWhere', () => {
    it('returns null without any criteria', () => {
        expect(buildOpeningHoursWhere({})).toBeNull();
    });

    it('requires an interval covering the range on the day, or spilling over from the day before', () => {
        expect(buildOpeningHoursWhere({ open_day: 'tuesday', open_from: '10:00', open_to: '12:00' })).toEqual({
            opening_hours_rows: {
                some: {
                    OR: [
                        { day_of_week: 1, opens_minute: { lte: 600 }, closes_minute: { gte: 720 } },
                        { day_of_week: 0, closes_minute: { gte: 720 + 1440 } },
                    ],
                },
            },
        });
    });

    it('matches any open interval for a day-only filter', () => {
        expect(buildOpeningHoursWhere({ open_day: 'monday' })).toEqual({
            opening_hours_rows: { some: { day_of_week: 0 } },
        });
    });
});
