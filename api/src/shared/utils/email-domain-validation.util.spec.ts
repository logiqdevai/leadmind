import { EmailValidationStatus } from '@/generated/prisma';

const resolveMx = jest.fn();
jest.mock('dns/promises', () => ({
    resolveMx: (...args: unknown[]) => resolveMx(...args),
}));

import { resolveEmailFieldsForWrite, validateEmailAddress } from './email-domain-validation.util';

describe('email-domain-validation.util', () => {
    beforeEach(() => {
        resolveMx.mockReset();
    });

    it('flags bad syntax as invalid without doing a DNS lookup', async () => {
        const result = await validateEmailAddress('not-an-email');
        expect(result).toEqual({ status: EmailValidationStatus.INVALID, reason: 'invalid_syntax' });
        expect(resolveMx).not.toHaveBeenCalled();
    });

    it('flags known disposable domains as invalid without doing a DNS lookup', async () => {
        const result = await validateEmailAddress('someone@mailinator.com');
        expect(result).toEqual({ status: EmailValidationStatus.INVALID, reason: 'disposable_domain' });
        expect(resolveMx).not.toHaveBeenCalled();
    });

    it('marks a domain with MX records as valid', async () => {
        resolveMx.mockResolvedValue([{ exchange: 'mx.example-valid-domain.com', priority: 10 }]);
        const result = await validateEmailAddress('person@example-valid-domain.com');
        expect(result).toEqual({ status: EmailValidationStatus.VALID, reason: null });
    });

    it('marks a domain with no MX records as invalid', async () => {
        const error: NodeJS.ErrnoException = new Error('not found');
        error.code = 'ENOTFOUND';
        resolveMx.mockRejectedValue(error);
        const result = await validateEmailAddress('person@no-mx-domain.com');
        expect(result).toEqual({ status: EmailValidationStatus.INVALID, reason: 'no_mx_record' });
    });

    it('fails open to unknown on a transient DNS error', async () => {
        resolveMx.mockRejectedValue(new Error('mx_lookup_timeout'));
        const result = await validateEmailAddress('person@slow-dns-domain.com');
        expect(result).toEqual({ status: EmailValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' });
    });

    it('re-validates on every call — no caching between lookups', async () => {
        resolveMx.mockResolvedValue([{ exchange: 'mx.repeat-domain.com', priority: 10 }]);
        await validateEmailAddress('first@repeat-domain.com');
        await validateEmailAddress('second@repeat-domain.com');
        expect(resolveMx).toHaveBeenCalledTimes(2);
    });
});

describe('resolveEmailFieldsForWrite', () => {
    beforeEach(() => {
        resolveMx.mockReset();
    });

    it('returns null when no email is given', async () => {
        expect(await resolveEmailFieldsForWrite(null)).toBeNull();
        expect(await resolveEmailFieldsForWrite(undefined)).toBeNull();
        expect(await resolveEmailFieldsForWrite('')).toBeNull();
        expect(resolveMx).not.toHaveBeenCalled();
    });

    it('returns null when the email fails validation', async () => {
        const result = await resolveEmailFieldsForWrite('not-an-email');
        expect(result).toBeNull();
    });

    it('returns the fields to write when the email is valid', async () => {
        resolveMx.mockResolvedValue([{ exchange: 'mx.example-valid-domain.com', priority: 10 }]);
        const result = await resolveEmailFieldsForWrite(' Person@Example-Valid-Domain.com ');
        expect(result).toMatchObject({
            email: 'Person@Example-Valid-Domain.com',
            email_validation_status: EmailValidationStatus.VALID,
            email_validation_reason: null,
        });
        expect(result?.email_validated_at).toBeInstanceOf(Date);
    });

    it('returns the fields to write when the domain could not be verified', async () => {
        resolveMx.mockRejectedValue(new Error('mx_lookup_timeout'));
        const result = await resolveEmailFieldsForWrite('person@slow-dns-domain.com');
        expect(result).toMatchObject({
            email: 'person@slow-dns-domain.com',
            email_validation_status: EmailValidationStatus.UNKNOWN,
            email_validation_reason: 'dns_lookup_failed',
        });
    });
});
