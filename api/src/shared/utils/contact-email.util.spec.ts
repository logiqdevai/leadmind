import { hasUsableContactEmail, normalizeContactEmail } from './contact-email.util';

describe('contact-email.util', () => {
    describe('normalizeContactEmail', () => {
        it('trims a plain single email', () => {
            expect(normalizeContactEmail('  person@example.com  ')).toBe('person@example.com');
        });

        it('returns null for empty/nullish input', () => {
            expect(normalizeContactEmail(null)).toBeNull();
            expect(normalizeContactEmail(undefined)).toBeNull();
            expect(normalizeContactEmail('   ')).toBeNull();
        });

        it('picks the first usable address out of a comma-joined multi-address field', () => {
            expect(
                normalizeContactEmail('sokratispapadopoulos@enimeris.com, sokratis.papadopoulos@enimeris.com'),
            ).toBe('sokratispapadopoulos@enimeris.com');
        });

        it('picks the first usable address out of a semicolon-joined multi-address field', () => {
            expect(normalizeContactEmail('a@example.com; b@example.com')).toBe('a@example.com');
        });

        it('skips a leading malformed candidate and picks the next usable one', () => {
            expect(normalizeContactEmail('not-an-email, b@example.com')).toBe('b@example.com');
        });

        it('falls back to the first candidate when none are individually usable', () => {
            expect(normalizeContactEmail('not-an-email, also not one')).toBe('not-an-email');
        });
    });

    describe('hasUsableContactEmail', () => {
        it('accepts a comma-joined field by validating the extracted candidate', () => {
            expect(hasUsableContactEmail('a@example.com, a.alt@example.com')).toBe(true);
        });

        it('rejects a field with no usable candidate', () => {
            expect(hasUsableContactEmail('not-an-email, also not one')).toBe(false);
        });
    });
});
