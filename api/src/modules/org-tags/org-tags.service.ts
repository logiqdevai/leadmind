import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgTagEntityType, Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateOrgTagDto } from './dto/create-org-tag.dto';
import { UpdateOrgTagDto } from './dto/update-org-tag.dto';
import type { TagFilterQueryDto } from './dto/tag-filter-query.dto';

export interface OrgTagSummary {
    uuid: string;
    name: string;
    color: string | null;
}

@Injectable()
export class OrgTagsService {
    constructor(private readonly prisma: PrismaService) {}

    private toSummary(tag: { uuid: string; name: string; color: string | null }): OrgTagSummary {
        return { uuid: tag.uuid, name: tag.name, color: tag.color };
    }

    /** All tags of the organisation with how many items of each entity type carry them. */
    async findAll(organisation_uuid: string) {
        const [tags, grouped] = await Promise.all([
            this.prisma.orgTag.findMany({ where: { organisation_uuid }, orderBy: { name: 'asc' } }),
            this.prisma.orgTagAssignment.groupBy({
                by: ['tag_uuid', 'entity_type'],
                where: { organisation_uuid },
                _count: { _all: true },
            }),
        ]);

        const usage = new Map<string, Record<string, number>>();
        for (const row of grouped) {
            const counts = usage.get(row.tag_uuid) ?? {};
            counts[row.entity_type] = row._count._all;
            usage.set(row.tag_uuid, counts);
        }

        return tags.map((tag) => {
            const counts = usage.get(tag.uuid) ?? {};
            const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
            return { ...this.toSummary(tag), usage: { ...counts, total } };
        });
    }

    async create(organisation_uuid: string, dto: CreateOrgTagDto) {
        const name = dto.name.trim();
        await this.assertNameFree(organisation_uuid, name);
        const tag = await this.prisma.orgTag.create({
            data: { organisation_uuid, name, color: dto.color ?? null },
        });
        return this.toSummary(tag);
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateOrgTagDto) {
        await this.requireOwned(organisation_uuid, uuid);
        const data: Prisma.OrgTagUpdateInput = {};
        if (dto.name !== undefined) {
            const name = dto.name.trim();
            await this.assertNameFree(organisation_uuid, name, uuid);
            data.name = name;
        }
        if (dto.color !== undefined) data.color = dto.color;
        const tag = await this.prisma.orgTag.update({ where: { uuid }, data });
        return this.toSummary(tag);
    }

    /** Deleting a tag removes it from every item (assignments cascade). */
    async remove(organisation_uuid: string, uuid: string) {
        await this.requireOwned(organisation_uuid, uuid);
        await this.prisma.orgTag.delete({ where: { uuid } });
        return { success: true };
    }

    /** Replaces the full tag set of one entity. The caller must already have verified the entity belongs to the org. */
    async setTags(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        entity_uuid: string,
        tag_uuids: string[],
    ): Promise<OrgTagSummary[]> {
        const unique = [...new Set(tag_uuids)];
        const tags = await this.requireAllOwned(organisation_uuid, unique);

        await this.prisma.$transaction([
            this.prisma.orgTagAssignment.deleteMany({
                where: { organisation_uuid, entity_type, entity_uuid, tag_uuid: { notIn: unique } },
            }),
            this.prisma.orgTagAssignment.createMany({
                data: unique.map((tag_uuid) => ({ tag_uuid, organisation_uuid, entity_type, entity_uuid })),
                skipDuplicates: true,
            }),
        ]);

        return tags.map((t) => this.toSummary(t));
    }

    /** Adds and/or removes tags on many entities of one type at once (bulk tagging). */
    async bulkUpdate(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        entity_uuids: string[],
        add_tag_uuids: string[] = [],
        remove_tag_uuids: string[] = [],
    ) {
        await this.requireAllOwned(organisation_uuid, [...new Set([...add_tag_uuids, ...remove_tag_uuids])]);
        const entities = await this.ownedEntityUuids(organisation_uuid, entity_type, [...new Set(entity_uuids)]);

        await this.prisma.$transaction([
            ...(remove_tag_uuids.length
                ? [
                      this.prisma.orgTagAssignment.deleteMany({
                          where: {
                              organisation_uuid,
                              entity_type,
                              entity_uuid: { in: entities },
                              tag_uuid: { in: remove_tag_uuids },
                          },
                      }),
                  ]
                : []),
            ...(add_tag_uuids.length
                ? [
                      this.prisma.orgTagAssignment.createMany({
                          data: entities.flatMap((entity_uuid) =>
                              add_tag_uuids.map((tag_uuid) => ({ tag_uuid, organisation_uuid, entity_type, entity_uuid })),
                          ),
                          skipDuplicates: true,
                      }),
                  ]
                : []),
        ]);
        return { success: true, updated: entities.length };
    }

    /** One query for a whole page of entities (avoids N+1 in list endpoints). */
    async getTagsForEntities(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        entity_uuids: string[],
    ): Promise<Map<string, OrgTagSummary[]>> {
        const result = new Map<string, OrgTagSummary[]>();
        if (!entity_uuids.length) return result;

        const rows = await this.prisma.orgTagAssignment.findMany({
            where: { organisation_uuid, entity_type, entity_uuid: { in: entity_uuids } },
            include: { tag: true },
            orderBy: { tag: { name: 'asc' } },
        });
        for (const row of rows) {
            const list = result.get(row.entity_uuid) ?? [];
            list.push(this.toSummary(row.tag));
            result.set(row.entity_uuid, list);
        }
        return result;
    }

    /** Adds `tags` to each item of a list/page response. */
    async withTags<T extends { uuid: string }>(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        items: T[],
    ): Promise<Array<T & { tags: OrgTagSummary[] }>> {
        const map = await this.getTagsForEntities(
            organisation_uuid,
            entity_type,
            items.map((i) => i.uuid),
        );
        return items.map((item) => ({ ...item, tags: map.get(item.uuid) ?? [] }));
    }

    /**
     * Prisma `where` fragment (on the entity's `uuid`) for the tag query params, or undefined when no tag filter
     * was requested. Spread it into the entity's `where`.
     */
    async buildWhere(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        query: TagFilterQueryDto,
    ): Promise<{ uuid: Prisma.StringFilter } | undefined> {
        if (query.untagged) {
            const tagged = await this.prisma.orgTagAssignment.findMany({
                where: { organisation_uuid, entity_type },
                select: { entity_uuid: true },
                distinct: ['entity_uuid'],
            });
            return { uuid: { notIn: tagged.map((t) => t.entity_uuid) } };
        }

        const tag_uuids = [...new Set(query.tag_uuids ?? [])];
        if (!tag_uuids.length) return undefined;

        const rows = await this.prisma.orgTagAssignment.findMany({
            where: { organisation_uuid, entity_type, tag_uuid: { in: tag_uuids } },
            select: { entity_uuid: true, tag_uuid: true },
        });

        if (query.tag_match === 'all') {
            const seen = new Map<string, Set<string>>();
            for (const row of rows) {
                const set = seen.get(row.entity_uuid) ?? new Set<string>();
                set.add(row.tag_uuid);
                seen.set(row.entity_uuid, set);
            }
            const matching = [...seen.entries()].filter(([, set]) => set.size === tag_uuids.length).map(([id]) => id);
            return { uuid: { in: matching } };
        }

        return { uuid: { in: [...new Set(rows.map((r) => r.entity_uuid))] } };
    }

    async deleteForEntities(entity_type: OrgTagEntityType, entity_uuids: string[]) {
        if (!entity_uuids.length) return;
        await this.prisma.orgTagAssignment.deleteMany({ where: { entity_type, entity_uuid: { in: entity_uuids } } });
    }

    /** Keeps only the uuids that really belong to the organisation, so bulk tagging can't touch other orgs' items. */
    private async ownedEntityUuids(
        organisation_uuid: string,
        entity_type: OrgTagEntityType,
        uuids: string[],
    ): Promise<string[]> {
        const where = { organisation_uuid, uuid: { in: uuids } };
        const select = { uuid: true };
        let rows: Array<{ uuid: string }>;
        switch (entity_type) {
            case OrgTagEntityType.CONTACT_LIST:
                rows = await this.prisma.contactList.findMany({ where, select });
                break;
            case OrgTagEntityType.SEQUENCE:
                rows = await this.prisma.outreachSequence.findMany({ where, select });
                break;
            case OrgTagEntityType.CAMPAIGN:
                rows = await this.prisma.marketingCampaign.findMany({ where, select });
                break;
            case OrgTagEntityType.FILTER:
                rows = await this.prisma.filter.findMany({ where, select });
                break;
        }
        if (rows.length !== uuids.length) throw new NotFoundException('One or more items were not found');
        return rows.map((r) => r.uuid);
    }

    private async assertNameFree(organisation_uuid: string, name: string, exceptUuid?: string) {
        const existing = await this.prisma.orgTag.findFirst({
            where: {
                organisation_uuid,
                name: { equals: name, mode: 'insensitive' },
                ...(exceptUuid ? { uuid: { not: exceptUuid } } : {}),
            },
            select: { uuid: true },
        });
        if (existing) throw new ConflictException(`A tag named "${name}" already exists`);
    }

    private async requireOwned(organisation_uuid: string, uuid: string) {
        const tag = await this.prisma.orgTag.findFirst({ where: { uuid, organisation_uuid } });
        if (!tag) throw new NotFoundException('Tag not found');
        return tag;
    }

    /** Throws 400 unless every uuid is a tag of this organisation. */
    async assertTagsOwned(organisation_uuid: string, tag_uuids: string[]) {
        await this.requireAllOwned(organisation_uuid, [...new Set(tag_uuids)]);
    }

    private async requireAllOwned(organisation_uuid: string, tag_uuids: string[]) {
        if (!tag_uuids.length) return [];
        const tags = await this.prisma.orgTag.findMany({ where: { organisation_uuid, uuid: { in: tag_uuids } } });
        if (tags.length !== tag_uuids.length) throw new BadRequestException('One or more tags do not exist');
        return tags;
    }
}
