import { EmailValidationStatus } from '@/generated/prisma';

const resolveMx = jest.fn();
jest.mock('dns/promises', () => ({
    resolveMx: (...args: unknown[]) => resolveMx(...args),
}));

import { validateEmailAddress } from './email-domain-validation.util';

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

    it('caches the result per domain so repeat lookups skip DNS', async () => {
        resolveMx.mockResolvedValue([{ exchange: 'mx.cached-domain.com', priority: 10 }]);
        await validateEmailAddress('first@cached-domain.com');
        await validateEmailAddress('second@cached-domain.com');
        expect(resolveMx).toHaveBeenCalledTimes(1);
    });
});
