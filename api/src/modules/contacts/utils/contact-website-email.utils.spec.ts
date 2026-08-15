import {
    buildWebsiteEmailCrawlUrls,
    extractEmailsFromCrawledPage,
    extractEmailsFromCrawledPages,
    pickBestContactEmail,
} from './contact-website-email.utils';

describe('buildWebsiteEmailCrawlUrls', () => {
    it('includes homepage and contact paths for a bare domain', () => {
        expect(buildWebsiteEmailCrawlUrls('acme.io')).toEqual([
            'https://acme.io/',
            'https://acme.io/contact',
            'https://acme.io/contact-us',
            'https://acme.io/contactus',
            'https://acme.io/get-in-touch',
            'https://acme.io/about',
            'https://acme.io/about-us',
            'https://acme.io/impressum',
            'https://acme.io/kontakt',
        ]);
    });

    it('keeps a deep original URL in addition to contact paths', () => {
        const urls = buildWebsiteEmailCrawlUrls('https://acme.io/services/web');
        expect(urls[0]).toBe('https://acme.io/services/web');
        expect(urls).toContain('https://acme.io/contact');
        expect(urls).toContain('https://acme.io/');
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

describe('pickBestContactEmail', () => {
    it('prefers personal local parts over generic ones', () => {
        expect(pickBestContactEmail(['info@acme.io', 'jane@acme.io'])).toBe('jane@acme.io');
    });

    it('falls back to generic when that is all we have', () => {
        expect(pickBestContactEmail(['info@acme.io', 'sales@acme.io'])).toBe('info@acme.io');
    });
});
