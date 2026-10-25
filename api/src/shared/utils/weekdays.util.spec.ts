import { isWeekdayAllowed, shiftToAllowedWeekday } from './weekdays.util';

const WEEKDAYS = [1, 2, 3, 4, 5];

describe('weekdays.util', () => {
    it('leaves allowed days untouched', () => {
        const friday = new Date('2026-10-23T10:30:00Z');
        expect(shiftToAllowedWeekday(friday, 'UTC', WEEKDAYS)).toEqual(friday);
    });

    it('shifts Saturday and Sunday to Monday at the same time of day', () => {
        const expected = new Date('2026-10-26T10:30:00Z');
        expect(
            shiftToAllowedWeekday(new Date('2026-10-24T10:30:00Z'), 'UTC', WEEKDAYS),
        ).toEqual(expected);
        expect(
            shiftToAllowedWeekday(new Date('2026-10-25T10:30:00Z'), 'UTC', WEEKDAYS),
        ).toEqual(expected);
    });

    it('evaluates the weekday in the given timezone', () => {
        // Friday 23:30 UTC is already Saturday 09:30 in Sydney.
        const at = new Date('2026-10-23T23:30:00Z');
        expect(isWeekdayAllowed(at, 'UTC', WEEKDAYS)).toBe(true);
        expect(isWeekdayAllowed(at, 'Australia/Sydney', WEEKDAYS)).toBe(false);
    });

    it('treats empty or full sets as unrestricted', () => {
        const saturday = new Date('2026-10-24T10:00:00Z');
        expect(shiftToAllowedWeekday(saturday, 'UTC', [])).toEqual(saturday);
        expect(shiftToAllowedWeekday(saturday, 'UTC', [1, 2, 3, 4, 5, 6, 7])).toEqual(
            saturday,
        );
    });
});
