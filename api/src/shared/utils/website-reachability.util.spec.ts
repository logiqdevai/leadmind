import { resolveReachableWebsiteUrl } from './website-reachability.util';

const originalFetch = global.fetch;

describe('resolveReachableWebsiteUrl', () => {
    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('returns the final (redirect-resolved) URL when the given host answers', async () => {
        global.fetch = jest.fn().mockResolvedValue({ url: 'https://acme.io/' }) as unknown as typeof fetch;

        await expect(resolveReachableWebsiteUrl('https://acme.io')).resolves.toBe('https://acme.io/');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to the www host when the bare domain fails to answer', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new Error('ENOTFOUND acme.io'))
            .mockResolvedValueOnce({ url: 'https://www.acme.io/' }) as unknown as typeof fetch;

        await expect(resolveReachableWebsiteUrl('https://acme.io')).resolves.toBe('https://www.acme.io/');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to the bare host when the www variant fails to answer', async () => {
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new Error('ENOTFOUND www.acme.io'))
            .mockResolvedValueOnce({ url: 'https://acme.io/' }) as unknown as typeof fetch;

        await expect(resolveReachableWebsiteUrl('https://www.acme.io')).resolves.toBe('https://acme.io/');
    });

    it('returns the original URL unchanged when neither host answers', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND')) as unknown as typeof fetch;

        await expect(resolveReachableWebsiteUrl('https://acme.io')).resolves.toBe('https://acme.io');
    });
});
