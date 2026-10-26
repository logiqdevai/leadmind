import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { Composio } from '@composio/core';
import { ComposioRequestError } from '../interfaces/composio.interface';
import { ComposioService } from './composio.service';

jest.mock('@composio/core', () => ({ Composio: jest.fn() }));

const rejectedKey = () =>
    Object.assign(new Error('401 {"error":{"message":"Invalid API key: ck_**jpT5"}}'), {
        status: 401,
        requestId: 'req-1',
        details: { slug: 'APIKey_InvalidAPIKey' },
    });

function setup(env: Record<string, string | undefined> = { COMPOSIO_API_KEY: 'ck_valid' }) {
    const client = {
        authConfigs: { list: jest.fn(), create: jest.fn() },
        connectedAccounts: { link: jest.fn(), get: jest.fn(), delete: jest.fn() },
        tools: { proxyExecute: jest.fn() },
    };
    (Composio as unknown as jest.Mock).mockImplementation(() => client);
    const service = new ComposioService({ get: (key: string) => env[key] } as never);
    return { service, client };
}

describe('ComposioService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('API key', () => {
        it('is configured only when a non-blank key is set', () => {
            expect(setup({ COMPOSIO_API_KEY: 'ck_valid' }).service.isConfigured()).toBe(true);
            expect(setup({ COMPOSIO_API_KEY: '   ' }).service.isConfigured()).toBe(false);
            expect(setup({}).service.isConfigured()).toBe(false);
        });

        it.each([[' ck_abc \n'], ['"ck_abc"'], [" 'ck_abc' "]])('trims whitespace and quotes from %j', async (raw) => {
            const { service, client } = setup({ COMPOSIO_API_KEY: raw, COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID: 'ac_1' });
            client.connectedAccounts.link.mockResolvedValue({ id: 'ca_1', redirectUrl: 'https://google' });
            await service.linkGoogleCalendar('user', 'https://app/cb');
            expect(Composio).toHaveBeenCalledWith({ apiKey: 'ck_abc' });
        });
    });

    describe('when Composio rejects the API key', () => {
        it('turns it into a clear service error without leaking SDK details', async () => {
            const { service, client } = setup();
            client.authConfigs.list.mockRejectedValue(rejectedKey());
            const error = await service.linkGoogleCalendar('user', 'https://app/cb').catch((e) => e);
            expect(error).toBeInstanceOf(ServiceUnavailableException);
            expect(error.message).toContain('COMPOSIO_API_KEY');
            expect(error.message).not.toContain('ck_');
        });

        it('retries the lookup next time instead of caching the failure', async () => {
            const { service, client } = setup();
            client.authConfigs.list.mockRejectedValueOnce(rejectedKey());
            await expect(service.linkGoogleCalendar('user', 'cb')).rejects.toBeInstanceOf(ServiceUnavailableException);

            client.authConfigs.list.mockResolvedValue({ items: [{ id: 'ac_managed', status: 'ENABLED' }] });
            client.connectedAccounts.link.mockResolvedValue({ id: 'ca_1', redirectUrl: 'https://google' });
            await expect(service.linkGoogleCalendar('user', 'cb')).resolves.toEqual({
                connected_account_id: 'ca_1',
                redirect_url: 'https://google',
            });
            expect(client.authConfigs.list).toHaveBeenCalledTimes(2);
        });

        it('never tells a member to reconnect Google because of it', async () => {
            const { service, client } = setup();
            client.tools.proxyExecute.mockRejectedValue(rejectedKey());
            const error = await service
                .proxy({ connected_account_id: 'ca_1', endpoint: '/calendars/primary', method: 'GET' })
                .catch((e) => e);
            expect(error).toBeInstanceOf(ComposioRequestError);
            expect(error.requires_reconnect).toBe(false);
            expect(error.message).toContain('COMPOSIO_API_KEY');
        });
    });

    it('reports other Composio failures as a bad gateway', async () => {
        const { service, client } = setup({ COMPOSIO_API_KEY: 'ck_valid', COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID: 'ac_1' });
        client.connectedAccounts.link.mockRejectedValue(new Error('upstream exploded'));
        await expect(service.linkGoogleCalendar('user', 'cb')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('still flags a real expired Google connection as needing a reconnect', async () => {
        const { service, client } = setup();
        client.tools.proxyExecute.mockRejectedValue(new Error('Connected account is expired'));
        const error = await service
            .proxy({ connected_account_id: 'ca_1', endpoint: '/calendars/primary', method: 'GET' })
            .catch((e) => e);
        expect(error.requires_reconnect).toBe(true);
    });
});
