import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { shapeContactFilterFields } from '@/modules/contacts/utils/contact-filter-link.utils';
import { CampaignContactResolverService } from '@/modules/marketing-campaigns/services/campaign-contact-resolver.service';
import { CampaignFiltersDto } from '@/modules/marketing-campaigns/dto/campaign-filters.dto';
import { CreateContactListDto } from './dto/create-contact-list.dto';
import { UpdateContactListDto } from './dto/update-contact-list.dto';
import { ListContactListsDto } from './dto/list-contact-lists.dto';
import { AddListContactsDto } from './dto/add-list-contacts.dto';
import { BulkAddListContactsDto } from './dto/bulk-add-list-contacts.dto';
import { ListContactListMembersDto } from './dto/list-contact-list-members.dto';

@Injectable()
export class ContactListsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly contactsService: ContactsService,
        private readonly campaignContactResolver: CampaignContactResolverService,
    ) {}

    private readonly listCountInclude = {
        _count: { select: { members: true, children: true } },
    } as const;

    private mapListWithCounts<
        T extends {
            _count: { members: number; children: number };
        },
    >(list: T) {
        return {
            ...list,
            contact_count: list._count.members,
            child_count: list._count.children,
        };
    }

    async create(organisation_uuid: string, dto: CreateContactListDto) {
        const parent_list_uuid = dto.parent_list_uuid ?? null;
        if (parent_list_uuid) {
            await this.assertValidParent(organisation_uuid, parent_list_uuid);
        }

        const list = await this.prisma.contactList.create({
            data: {
                organisation_uuid,
                title: dto.title.trim(),
                description: dto.description?.trim() || null,
                parent_list_uuid,
            },
            include: this.listCountInclude,
        });

        return this.mapListWithCounts(list);
    }

    async findAll(organisation_uuid: string, query: ListContactListsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: Prisma.ContactListWhereInput = { organisation_uuid };

        if (query.parent_list_uuid) {
            where.parent_list_uuid = query.parent_list_uuid;
        } else if (query.root_only) {
            where.parent_list_uuid = null;
        }

        if (query.search?.trim()) {
            const search = query.search.trim();
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.contactList.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updated_at: 'desc' },
                include: this.listCountInclude,
            }),
            this.prisma.contactList.count({ where }),
        ]);

        return {
            data: data.map((list) => this.mapListWithCounts(list)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const list = await this.prisma.contactList.findFirst({
            where: { uuid, organisation_uuid },
            include: this.listCountInclude,
        });

        if (!list) throw new NotFoundException('Contact list not found');

        return this.mapListWithCounts(list);
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateContactListDto) {
        await this.ensureListOwned(organisation_uuid, uuid);

        if (dto.parent_list_uuid) {
            await this.assertValidParent(organisation_uuid, dto.parent_list_uuid, uuid);
        }

        const parentData =
            dto.parent_list_uuid === undefined
                ? {}
                : { parent_list_uuid: dto.parent_list_uuid };

        const list = await this.prisma.contactList.update({
            where: { uuid },
            data: {
                ...(dto.title !== undefined && { title: dto.title.trim() }),
                ...(dto.description !== undefined && {
                    description: dto.description?.trim() || null,
                }),
                ...parentData,
            },
            include: this.listCountInclude,
        });

        return this.mapListWithCounts(list);
    }

    async remove(organisation_uuid: string, uuid: string) {
        await this.ensureListOwned(organisation_uuid, uuid);
        await this.prisma.contactList.delete({ where: { uuid } });
        return { uuid };
    }

    async findMembers(organisation_uuid: string, listUuid: string, query: ListContactListMembersDto) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const contactWhere = this.contactsService.buildWhereInput(organisation_uuid, query);

        const where: Prisma.ContactListMemberWhereInput = {
            list_uuid: listUuid,
            contact: contactWhere,
        };

        const [members, total] = await Promise.all([
            this.prisma.contactListMember.findMany({
                where,
                include: {
                    contact: {
                        include: {
                            tags: true,
                            lead: true,
                            filter: { select: { uuid: true, name: true } },
                            contact_filters: {
                                include: { filter: { select: { uuid: true, name: true } } },
                            },
                            contact_scores: {
                                include: {
                                    scoring_instruction: { select: { uuid: true, name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.contactListMember.count({ where }),
        ]);

        return {
            data: members.map((m) => {
                const { contact_filters, filter, tags, ...rest } = m.contact;
                const shaped = shapeContactFilterFields({
                    ...m.contact,
                    filter,
                    contact_filters,
                });
                return {
                    ...rest,
                    filter: shaped.filter,
                    also_found_by: shaped.also_found_by,
                    filters: shaped.filters,
                    tags: tags.map((t) => t.tag),
                    member_uuid: m.uuid,
                    added_at: m.created_at,
                };
            }),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async addContacts(organisation_uuid: string, listUuid: string, dto: AddListContactsDto) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const ownedContacts = await this.prisma.contact.findMany({
            where: {
                organisation_uuid,
                uuid: { in: dto.contact_uuids },
            },
            select: { uuid: true },
        });

        if (ownedContacts.length !== dto.contact_uuids.length) {
            throw new BadRequestException('One or more contacts were not found');
        }

        const result = await this.prisma.contactListMember.createMany({
            data: dto.contact_uuids.map((contact_uuid) => ({
                list_uuid: listUuid,
                contact_uuid,
            })),
            skipDuplicates: true,
        });

        await this.prisma.contactList.update({
            where: { uuid: listUuid },
            data: { updated_at: new Date() },
        });

        return { added: result.count };
    }

    async bulkAddContacts(organisation_uuid: string, listUuid: string, dto: BulkAddListContactsDto) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const existingMemberUuids = await this.getMemberContactUuids(listUuid);
        const filters: CampaignFiltersDto = {
            ...dto.filters,
            exclude_uuids: [
                ...new Set([
                    ...(dto.filters.exclude_uuids ?? []),
                    ...existingMemberUuids,
                ]),
            ],
        };

        const where = this.campaignContactResolver.buildWhereInput(organisation_uuid, filters, {
            mode: 'preview',
        });
        if (filters.contact_list_uuid) {
            await this.contactsService.applyContactListIncludeFilter(
                where,
                organisation_uuid,
                filters.contact_list_uuid,
            );
        }
        const matching = await this.prisma.contact.findMany({
            where,
            select: { uuid: true },
        });

        if (matching.length === 0) {
            return { added: 0 };
        }

        const result = await this.prisma.contactListMember.createMany({
            data: matching.map((c) => ({
                list_uuid: listUuid,
                contact_uuid: c.uuid,
            })),
            skipDuplicates: true,
        });

        await this.prisma.contactList.update({
            where: { uuid: listUuid },
            data: { updated_at: new Date() },
        });

        return { added: result.count };
    }

    async removeContact(organisation_uuid: string, listUuid: string, contactUuid: string) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const member = await this.prisma.contactListMember.findFirst({
            where: { list_uuid: listUuid, contact_uuid: contactUuid },
        });

        if (!member) throw new NotFoundException('Contact is not in this list');

        await this.prisma.contactListMember.delete({ where: { uuid: member.uuid } });

        await this.prisma.contactList.update({
            where: { uuid: listUuid },
            data: { updated_at: new Date() },
        });

        return { contact_uuid: contactUuid };
    }

    private belowScoreContactFilter(minScore: number): Prisma.ContactWhereInput {
        return {
            AND: [
                { contact_scores: { some: { score: { lt: minScore } } } },
                { contact_scores: { none: { score: { gte: minScore } } } },
            ],
        };
    }

    async removeContactsBelowScore(
        organisation_uuid: string,
        listUuid: string,
        minScore = 6,
    ) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const result = await this.prisma.contactListMember.deleteMany({
            where: {
                list_uuid: listUuid,
                contact: this.belowScoreContactFilter(minScore),
            },
        });

        if (result.count > 0) {
            await this.prisma.contactList.update({
                where: { uuid: listUuid },
                data: { updated_at: new Date() },
            });
        }

        return { removed: result.count };
    }

    async moveContactsBelowScore(
        organisation_uuid: string,
        listUuid: string,
        targetListUuid: string,
        minScore = 6,
    ) {
        if (listUuid === targetListUuid) {
            throw new BadRequestException('Source and destination lists must be different');
        }

        await Promise.all([
            this.ensureListOwned(organisation_uuid, listUuid),
            this.ensureListOwned(organisation_uuid, targetListUuid),
        ]);

        const members = await this.prisma.contactListMember.findMany({
            where: {
                list_uuid: listUuid,
                contact: this.belowScoreContactFilter(minScore),
            },
            select: { contact_uuid: true },
        });

        if (members.length === 0) {
            return { moved: 0 };
        }

        const contactUuids = members.map((m) => m.contact_uuid);

        await this.prisma.$transaction(async (tx) => {
            await tx.contactListMember.createMany({
                data: contactUuids.map((contact_uuid) => ({
                    list_uuid: targetListUuid,
                    contact_uuid,
                })),
                skipDuplicates: true,
            });

            await tx.contactListMember.deleteMany({
                where: {
                    list_uuid: listUuid,
                    contact_uuid: { in: contactUuids },
                },
            });

            const now = new Date();
            await Promise.all([
                tx.contactList.update({
                    where: { uuid: listUuid },
                    data: { updated_at: now },
                }),
                tx.contactList.update({
                    where: { uuid: targetListUuid },
                    data: { updated_at: now },
                }),
            ]);
        });

        return { moved: contactUuids.length };
    }

    async removeContacts(organisation_uuid: string, listUuid: string, contactUuids: string[]) {
        await this.ensureListOwned(organisation_uuid, listUuid);

        const unique = [...new Set(contactUuids)];
        const result = await this.prisma.contactListMember.deleteMany({
            where: {
                list_uuid: listUuid,
                contact_uuid: { in: unique },
            },
        });

        if (result.count === 0) {
            throw new NotFoundException('None of the contacts are in this list');
        }

        await this.prisma.contactList.update({
            where: { uuid: listUuid },
            data: { updated_at: new Date() },
        });

        return { removed: result.count };
    }

    async getMemberContactUuids(listUuid: string): Promise<string[]> {
        const rows = await this.prisma.contactListMember.findMany({
            where: { list_uuid: listUuid },
            select: { contact_uuid: true },
        });
        return rows.map((r) => r.contact_uuid);
    }

    private async ensureListOwned(organisation_uuid: string, uuid: string) {
        const list = await this.prisma.contactList.findFirst({
            where: { uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!list) throw new NotFoundException('Contact list not found');
        return list;
    }

    private async assertValidParent(
        organisation_uuid: string,
        parent_list_uuid: string,
        listUuid?: string,
    ) {
        if (listUuid && parent_list_uuid === listUuid) {
            throw new BadRequestException('A list cannot be its own parent');
        }

        const parent = await this.prisma.contactList.findFirst({
            where: { uuid: parent_list_uuid, organisation_uuid },
            select: { uuid: true, parent_list_uuid: true },
        });

        if (!parent) {
            throw new BadRequestException('Parent list not found');
        }

        if (!listUuid) return;

        let cursor: string | null = parent.parent_list_uuid;
        while (cursor) {
            if (cursor === listUuid) {
                throw new BadRequestException('Cannot set a descendant as parent');
            }
            const ancestor = await this.prisma.contactList.findFirst({
                where: { uuid: cursor, organisation_uuid },
                select: { parent_list_uuid: true },
            });
            cursor = ancestor?.parent_list_uuid ?? null;
        }
    }
}
