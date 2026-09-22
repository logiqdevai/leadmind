/// <reference types="jest" />
import { NotFoundException } from '@nestjs/common';
import { OrganisationRole } from '@/generated/prisma';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
    const organisation_uuid = 'org-uuid';
    const created_by_user_uuid = 'user-uuid';

    function createService(overrides?: { apiKey?: unknown }) {
        const prisma = {
            apiKey: {
                create: jest.fn().mockResolvedValue({
                    uuid: 'key-uuid',
                    name: 'Zapier',
                    key_prefix: 'lm_live_AbCdEfGh',
                    last4: 'wxyz',
                    organisation_role: OrganisationRole.MEMBER,
                    last_used_at: null,
                    expires_at: null,
                    revoked_at: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    created_by_user_uuid,
                }),
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue(overrides?.apiKey ?? null),
                update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ uuid: 'key-uuid', ...data })),
                delete: jest.fn().mockResolvedValue({ uuid: 'key-uuid' }),
            },
        };
        return { service: new ApiKeysService(prisma as any), prisma };
    }

    it('create() persists the hash and returns the raw token only in the response', async () => {
        const { service, prisma } = createService();

        const result = await service.create(organisation_uuid, created_by_user_uuid, { name: 'Zapier' });

        expect(result.token).toBeDefined();
        expect(prisma.apiKey.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    organisation_uuid,
                    created_by_user_uuid,
                    key_hash: expect.any(String),
                }),
            }),
        );
        const createCallData = prisma.apiKey.create.mock.calls[0][0].data;
        expect(createCallData).not.toHaveProperty('token');
    });

    it('findAll() scopes the query to the organisation', async () => {
        const { service, prisma } = createService();

        await service.findAll(organisation_uuid);

        expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { organisation_uuid } }),
        );
    });

    it('findOne() throws NotFoundException when the key does not belong to the organisation', async () => {
        const { service } = createService({ apiKey: null });

        await expect(service.findOne(organisation_uuid, 'missing-uuid')).rejects.toThrow(NotFoundException);
    });

    it('revoke() sets revoked_at', async () => {
        const { service, prisma } = createService({ apiKey: { uuid: 'key-uuid' } });

        await service.revoke(organisation_uuid, 'key-uuid');

        expect(prisma.apiKey.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { uuid: 'key-uuid' },
                data: expect.objectContaining({ revoked_at: expect.any(Date) }),
            }),
        );
    });

    it('remove() hard-deletes the key', async () => {
        const { service, prisma } = createService({ apiKey: { uuid: 'key-uuid' } });

        const result = await service.remove(organisation_uuid, 'key-uuid');

        expect(prisma.apiKey.delete).toHaveBeenCalledWith({ where: { uuid: 'key-uuid' } });
        expect(result).toEqual({ uuid: 'key-uuid' });
    });
});
