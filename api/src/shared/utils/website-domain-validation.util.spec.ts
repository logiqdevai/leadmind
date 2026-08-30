import { DomainValidationStatus } from '@/generated/prisma';

const resolve4 = jest.fn();
const resolve6 = jest.fn();
const resolveNs = jest.fn();
jest.mock('dns/promises', () => ({
    resolve4: (...args: unknown[]) => resolve4(...args),
    resolve6: (...args: unknown[]) => resolve6(...args),
    resolveNs: (...args: unknown[]) => resolveNs(...args),
}));

import {
    extractDomainHost,
    resolveWebsiteFieldsForWrite,
    validateWebsiteDomain,
} from './website-domain-validation.util';

function notFound(): NodeJS.ErrnoException {
    const error: NodeJS.ErrnoException = new Error('not found');
    error.code = 'ENOTFOUND';
    return error;
}

describe('extractDomainHost', () => {
    it('strips protocol, www, and trailing dot, and lowercases the host', () => {
        expect(extractDomainHost('https://www.Example.com/')).toBe('example.com');
        expect(extractDomainHost('example.com')).toBe('example.com');
        expect(extractDomainHost('WWW.EXAMPLE.COM.')).toBe('example.com');
    });

    it('returns null for empty/unparseable input', () => {
        expect(extractDomainHost(null)).toBeNull();
        expect(extractDomainHost(undefined)).toBeNull();
        expect(extractDomainHost('   ')).toBeNull();
    });
});

describe('validateWebsiteDomain', () => {
    beforeEach(() => {
        resolve4.mockReset();
        resolve6.mockReset();
        resolveNs.mockReset();
    });

    it('flags bad hostname syntax as invalid without doing a DNS lookup', async () => {
        const result = await validateWebsiteDomain('not a domain');
        expect(result).toEqual({ status: DomainValidationStatus.INVALID, reason: 'invalid_syntax' });
        expect(resolve4).not.toHaveBeenCalled();
    });

    it('marks a domain with an A record as valid', async () => {
        resolve4.mockResolvedValue(['1.2.3.4']);
        const result = await validateWebsiteDomain('https://example-valid-domain.com');
        expect(result).toEqual({ status: DomainValidationStatus.VALID, reason: null });
        expect(resolve6).not.toHaveBeenCalled();
    });

    it('falls back to AAAA when there is no A record', async () => {
        resolve4.mockRejectedValue(notFound());
        resolve6.mockResolvedValue(['::1']);
        const result = await validateWebsiteDomain('aaaa-only-domain.com');
        expect(result).toEqual({ status: DomainValidationStatus.VALID, reason: null });
    });

    it('falls back to NS when there is no A or AAAA record', async () => {
        resolve4.mockRejectedValue(notFound());
        resolve6.mockRejectedValue(notFound());
        resolveNs.mockResolvedValue(['ns1.registrar.com']);
        const result = await validateWebsiteDomain('parked-domain.com');
        expect(result).toEqual({ status: DomainValidationStatus.VALID, reason: null });
    });

    it('marks a domain with no records at all as invalid', async () => {
        resolve4.mockRejectedValue(notFound());
        resolve6.mockRejectedValue(notFound());
        resolveNs.mockRejectedValue(notFound());
        const result = await validateWebsiteDomain('no-such-domain.com');
        expect(result).toEqual({ status: DomainValidationStatus.INVALID, reason: 'domain_not_found' });
    });

    it('fails open to unknown on a transient DNS error', async () => {
        resolve4.mockRejectedValue(new Error('timeout'));
        const result = await validateWebsiteDomain('slow-dns-domain.com');
        expect(result).toEqual({ status: DomainValidationStatus.UNKNOWN, reason: 'dns_lookup_failed' });
    });
});

describe('resolveWebsiteFieldsForWrite', () => {
    beforeEach(() => {
        resolve4.mockReset();
        resolve6.mockReset();
        resolveNs.mockReset();
    });

    it('returns null when no website is given', async () => {
        expect(await resolveWebsiteFieldsForWrite(null)).toBeNull();
        expect(await resolveWebsiteFieldsForWrite(undefined)).toBeNull();
        expect(await resolveWebsiteFieldsForWrite('')).toBeNull();
        expect(resolve4).not.toHaveBeenCalled();
    });

    it('returns null when the domain fails validation', async () => {
        resolve4.mockRejectedValue(notFound());
        resolve6.mockRejectedValue(notFound());
        resolveNs.mockRejectedValue(notFound());
        const result = await resolveWebsiteFieldsForWrite('no-such-domain.com');
        expect(result).toBeNull();
    });

    it('returns the normalized fields to write when the domain is valid', async () => {
        resolve4.mockResolvedValue(['1.2.3.4']);
        const result = await resolveWebsiteFieldsForWrite(' https://www.Example-Valid-Domain.com/ ');
        expect(result).toMatchObject({
            website: 'example-valid-domain.com',
            website_validation_status: DomainValidationStatus.VALID,
            website_validation_reason: null,
        });
        expect(result?.website_validated_at).toBeInstanceOf(Date);
    });

    it('returns the fields to write when the domain could not be verified', async () => {
        resolve4.mockRejectedValue(new Error('timeout'));
        const result = await resolveWebsiteFieldsForWrite('slow-dns-domain.com');
        expect(result).toMatchObject({
            website: 'slow-dns-domain.com',
            website_validation_status: DomainValidationStatus.UNKNOWN,
            website_validation_reason: 'dns_lookup_failed',
        });
    });
});
