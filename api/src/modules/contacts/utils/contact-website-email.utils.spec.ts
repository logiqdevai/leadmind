import {
    buildWebsiteEmailCrawlUrls,
    extractEmailsFromCrawledPage,
    extractEmailsFromCrawledPages,
    filterJunkEmails,
    pickBestContactEmail,
} from './contact-website-email.utils';

// `buildWebsiteEmailCrawlUrls` probes the given host (and its www-toggled counterpart) with a
// real HEAD request before building the candidate list. Stub `fetch` so these tests stay
// hermetic and exercise both the "given host answers" and "falls back to www" branches.
const originalFetch = global.fetch;

describe('buildWebsiteEmailCrawlUrls', () => {
    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('includes homepage and contact paths for a bare domain that answers directly', () => {
        global.fetch = jest.fn().mockResolvedValue({ url: 'https://acme.io/' }) as unknown as typeof fetch;

        return buildWebsiteEmailCrawlUrls('acme.io').then((urls) => {
            expect(urls).toEqual([
                'https://acme.io/',
                'https://acme.io/contact',
                'https://acme.io/contact-us',
                'https://acme.io/about',
            ]);
        });
    });

    it('keeps a deep original URL in addition to contact paths', async () => {
        global.fetch = jest.fn().mockResolvedValue({ url: 'https://acme.io/' }) as unknown as typeof fetch;

        const urls = await buildWebsiteEmailCrawlUrls('https://acme.io/services/web');
        expect(urls[0]).toBe('https://acme.io/services/web');
        expect(urls).toContain('https://acme.io/contact');
        expect(urls).toContain('https://acme.io/');
    });

    it('falls back to the www host when the bare domain does not answer', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new Error('ENOTFOUND acme.io'))
            .mockResolvedValueOnce({ url: 'https://www.acme.io/' }) as unknown as typeof fetch;

        const urls = await buildWebsiteEmailCrawlUrls('acme.io');
        expect(urls).toEqual([
            'https://www.acme.io/',
            'https://www.acme.io/contact',
            'https://www.acme.io/contact-us',
            'https://www.acme.io/about',
        ]);
    });
});

describe('extractEmailsFromCrawledPage', () => {
    it('finds plain emails in markdown', () => {
        expect(
            extractEmailsFromCrawledPage({
                url: 'https://acme.io/contact',
                markdown: 'Reach us at sales@acme.io today.',
            }),
        ).toEqual(['sales@acme.io']);
    });

    it('finds mailto links and obfuscated emails in html', () => {
        expect(
            extractEmailsFromCrawledPage({
                url: 'https://acme.io/contact',
                html: '<a href="mailto:hello@acme.io">Email</a><p>info [at] acme [dot] io</p>',
            }),
        ).toEqual(expect.arrayContaining(['hello@acme.io', 'info@acme.io']));
    });

    it('filters placeholder junk domains', () => {
        expect(
            extractEmailsFromCrawledPage({
                url: 'https://acme.io',
                text: 'demo@example.com real@acme.io',
            }),
        ).toEqual(['real@acme.io']);
    });
});

describe('extractEmailsFromCrawledPages', () => {
    it('merges unique emails across pages', () => {
        expect(
            extractEmailsFromCrawledPages([
                { url: 'https://acme.io/', markdown: 'hello@acme.io' },
                { url: 'https://acme.io/contact', markdown: 'hello@acme.io sales@acme.io' },
            ]),
        ).toEqual(['hello@acme.io', 'sales@acme.io']);
    });
});

describe('filterJunkEmails', () => {
    it('drops retina image filenames that match provider regex extractors as "emails"', () => {
        // Scrapio's built-in `email` regex preset has no notion of junk and matches filenames
        // like "logo@2x.png" (from an <img srcset>) as if they were addresses.
        expect(
            filterJunkEmails(['logo@2x.png', 'logo-white@2x.png', 'info@cypruspropertyandhome.com']),
        ).toEqual(['info@cypruspropertyandhome.com']);
    });
});

describe('pickBestContactEmail', () => {
    it('prefers personal local parts over generic ones', () => {
        expect(pickBestContactEmail(['info@acme.io', 'jane@acme.io'])).toBe('jane@acme.io');
    });

    it('falls back to generic when that is all we have', () => {
        expect(pickBestContactEmail(['info@acme.io', 'sales@acme.io'])).toBe('info@acme.io');
    });
});
