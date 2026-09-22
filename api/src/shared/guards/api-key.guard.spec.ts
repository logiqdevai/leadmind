/// <reference types="jest" />
import { OrganisationRole } from '@/generated/prisma';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
    function createContext(headers: Record<string, string>) {
        const request: any = { headers };
        return {
            switchToHttp: () => ({ getRequest: () => request }),
        } as any;
    }

    function createGuard(overrides?: { apiKey?: unknown }) {
        const prisma = {
            apiKey: {
                findUnique: jest.fn().mockResolvedValue(overrides?.apiKey ?? null),
                update: jest.fn().mockResolvedValue({}),
            },
        };
        return { guard: new ApiKeyGuard(prisma as any), prisma };
    }

    it('throws api_key_required when the header is missing', async () => {
        const { guard } = createGuard();
        const context = createContext({});

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'api_key_required' }),
        });
    });

    it('throws invalid_api_key when no key matches the hash', async () => {
        const { guard } = createGuard({ apiKey: null });
        const context = createContext({ 'x-api-key': 'lm_live_unknown' });

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'invalid_api_key' }),
        });
    });

    it('throws api_key_revoked when the key has been revoked', async () => {
        const { guard } = createGuard({
            apiKey: { uuid: 'k', organisation_uuid: 'o', organisation_role: OrganisationRole.MEMBER, revoked_at: new Date(), expires_at: null, created_by_user_uuid: 'u' },
        });
        const context = createContext({ 'x-api-key': 'lm_live_revoked' });

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'api_key_revoked' }),
        });
    });

    it('throws api_key_expired when the key has expired', async () => {
        const { guard } = createGuard({
            apiKey: {
                uuid: 'k',
                organisation_uuid: 'o',
                organisation_role: OrganisationRole.MEMBER,
                revoked_at: null,
                expires_at: new Date(Date.now() - 1000),
                created_by_user_uuid: 'u',
            },
        });
        const context = createContext({ 'x-api-key': 'lm_live_expired' });

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            response: expect.objectContaining({ code: 'api_key_expired' }),
        });
    });

    it('populates request.user and returns true for a valid key', async () => {
        const { guard, prisma } = createGuard({
            apiKey: {
                uuid: 'key-uuid',
                organisation_uuid: 'org-uuid',
                organisation_role: OrganisationRole.ADMIN,
                revoked_at: null,
                expires_at: null,
                created_by_user_uuid: 'creator-uuid',
            },
        });
        const context = createContext({ 'x-api-key': 'lm_live_valid' });

        await expect(guard.canActivate(context)).resolves.toBe(true);

        const request = context.switchToHttp().getRequest();
        expect(request.user).toEqual({
            uuid: null,
            role: null,
            organisation_uuid: 'org-uuid',
            organisation_role: OrganisationRole.ADMIN,
            api_key_uuid: 'key-uuid',
            acting_user_uuid: 'creator-uuid',
        });
        expect(prisma.apiKey.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { uuid: 'key-uuid' } }),
        );
    });
});
