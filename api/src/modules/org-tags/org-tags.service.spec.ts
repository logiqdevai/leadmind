import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrgTagEntityType } from '@/generated/prisma';
import { OrgTagsService } from './org-tags.service';

const ORG = 'org-1';

function createService() {
    const prisma = {
        orgTag: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        orgTagAssignment: {
            findMany: jest.fn(),
            groupBy: jest.fn(),
            deleteMany: jest.fn().mockReturnValue('deleteMany-op'),
            createMany: jest.fn().mockReturnValue('createMany-op'),
        },
        contactList: { findMany: jest.fn() },
        $transaction: jest.fn().mockResolvedValue([]),
    };
    return { prisma, service: new OrgTagsService(prisma as any) };
}

describe('OrgTagsService', () => {
    describe('create / update', () => {
        it('rejects a case-insensitive duplicate name', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findFirst.mockResolvedValue({ uuid: 'existing' });
            await expect(service.create(ORG, { name: ' Real Estate ' })).rejects.toBeInstanceOf(ConflictException);
            expect(prisma.orgTag.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ name: { equals: 'Real Estate', mode: 'insensitive' } }),
                }),
            );
        });

        it('trims the name and stores the colour', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findFirst.mockResolvedValue(null);
            prisma.orgTag.create.mockResolvedValue({ uuid: 't1', name: 'Lawyers', color: '#fff000' });
            await service.create(ORG, { name: ' Lawyers ', color: '#fff000' });
            expect(prisma.orgTag.create).toHaveBeenCalledWith({
                data: { organisation_uuid: ORG, name: 'Lawyers', color: '#fff000' },
            });
        });

        it('404s when updating a tag from another organisation', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findFirst.mockResolvedValue(null);
            await expect(service.update(ORG, 't1', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('setTags', () => {
        it('rejects tags that do not belong to the organisation', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findMany.mockResolvedValue([{ uuid: 'a', name: 'A', color: null }]);
            await expect(
                service.setTags(ORG, OrgTagEntityType.SEQUENCE, 'seq-1', ['a', 'b']),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('replaces the tag set: removes the others and adds the new ones, deduplicated', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findMany.mockResolvedValue([{ uuid: 'a', name: 'A', color: null }]);
            const result = await service.setTags(ORG, OrgTagEntityType.SEQUENCE, 'seq-1', ['a', 'a']);
            expect(result).toEqual([{ uuid: 'a', name: 'A', color: null }]);
            expect(prisma.orgTagAssignment.deleteMany).toHaveBeenCalledWith({
                where: {
                    organisation_uuid: ORG,
                    entity_type: OrgTagEntityType.SEQUENCE,
                    entity_uuid: 'seq-1',
                    tag_uuid: { notIn: ['a'] },
                },
            });
            expect(prisma.orgTagAssignment.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        tag_uuid: 'a',
                        organisation_uuid: ORG,
                        entity_type: OrgTagEntityType.SEQUENCE,
                        entity_uuid: 'seq-1',
                    },
                ],
                skipDuplicates: true,
            });
        });

        it('an empty array clears every tag', async () => {
            const { prisma, service } = createService();
            await service.setTags(ORG, OrgTagEntityType.FILTER, 'f1', []);
            expect(prisma.orgTagAssignment.deleteMany).toHaveBeenCalledWith({
                where: expect.objectContaining({ tag_uuid: { notIn: [] } }),
            });
        });
    });

    describe('bulkUpdate', () => {
        it('refuses items that are not in the organisation', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findMany.mockResolvedValue([{ uuid: 'a', name: 'A', color: null }]);
            prisma.contactList.findMany.mockResolvedValue([{ uuid: 'l1' }]);
            await expect(
                service.bulkUpdate(ORG, OrgTagEntityType.CONTACT_LIST, ['l1', 'foreign'], ['a']),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('adds the tag to every owned item', async () => {
            const { prisma, service } = createService();
            prisma.orgTag.findMany.mockResolvedValue([{ uuid: 'a', name: 'A', color: null }]);
            prisma.contactList.findMany.mockResolvedValue([{ uuid: 'l1' }, { uuid: 'l2' }]);
            const result = await service.bulkUpdate(ORG, OrgTagEntityType.CONTACT_LIST, ['l1', 'l2'], ['a']);
            expect(result).toEqual({ success: true, updated: 2 });
            expect(prisma.orgTagAssignment.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: [
                        expect.objectContaining({ tag_uuid: 'a', entity_uuid: 'l1' }),
                        expect.objectContaining({ tag_uuid: 'a', entity_uuid: 'l2' }),
                    ],
                }),
            );
        });
    });

    describe('buildWhere', () => {
        it('returns undefined without any tag params', async () => {
            const { prisma, service } = createService();
            expect(await service.buildWhere(ORG, OrgTagEntityType.CAMPAIGN, {})).toBeUndefined();
            expect(prisma.orgTagAssignment.findMany).not.toHaveBeenCalled();
        });

        it('"any" matches items with at least one of the tags', async () => {
            const { prisma, service } = createService();
            prisma.orgTagAssignment.findMany.mockResolvedValue([
                { entity_uuid: 'x', tag_uuid: 'a' },
                { entity_uuid: 'x', tag_uuid: 'b' },
                { entity_uuid: 'y', tag_uuid: 'b' },
            ]);
            const where = await service.buildWhere(ORG, OrgTagEntityType.CAMPAIGN, { tag_uuids: ['a', 'b'] });
            expect(where).toEqual({ uuid: { in: ['x', 'y'] } });
        });

        it('"all" matches only items carrying every tag', async () => {
            const { prisma, service } = createService();
            prisma.orgTagAssignment.findMany.mockResolvedValue([
                { entity_uuid: 'x', tag_uuid: 'a' },
                { entity_uuid: 'x', tag_uuid: 'b' },
                { entity_uuid: 'y', tag_uuid: 'b' },
            ]);
            const where = await service.buildWhere(ORG, OrgTagEntityType.CAMPAIGN, {
                tag_uuids: ['a', 'b'],
                tag_match: 'all',
            });
            expect(where).toEqual({ uuid: { in: ['x'] } });
        });

        it('yields an empty match (not "no filter") when nothing carries the tag', async () => {
            const { prisma, service } = createService();
            prisma.orgTagAssignment.findMany.mockResolvedValue([]);
            const where = await service.buildWhere(ORG, OrgTagEntityType.FILTER, { tag_uuids: ['a'] });
            expect(where).toEqual({ uuid: { in: [] } });
        });

        it('"untagged" excludes every item that has an assignment and ignores tag_uuids', async () => {
            const { prisma, service } = createService();
            prisma.orgTagAssignment.findMany.mockResolvedValue([{ entity_uuid: 'x' }, { entity_uuid: 'y' }]);
            const where = await service.buildWhere(ORG, OrgTagEntityType.SEQUENCE, {
                untagged: true,
                tag_uuids: ['a'],
            });
            expect(where).toEqual({ uuid: { notIn: ['x', 'y'] } });
        });
    });

    describe('withTags', () => {
        it('attaches tags per item with a single query and defaults to an empty array', async () => {
            const { prisma, service } = createService();
            prisma.orgTagAssignment.findMany.mockResolvedValue([
                { entity_uuid: 'x', tag: { uuid: 'a', name: 'A', color: null } },
            ]);
            const result = await service.withTags(ORG, OrgTagEntityType.SEQUENCE, [{ uuid: 'x' }, { uuid: 'y' }]);
            expect(result).toEqual([
                { uuid: 'x', tags: [{ uuid: 'a', name: 'A', color: null }] },
                { uuid: 'y', tags: [] },
            ]);
            expect(prisma.orgTagAssignment.findMany).toHaveBeenCalledTimes(1);
        });
    });
});
