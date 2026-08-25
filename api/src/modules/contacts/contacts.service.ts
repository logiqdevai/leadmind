import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
    ApifyUsageOperation,
    BulkJobStatus,
    BulkJobType,
    CampaignContactStatus,
    Channel,
    Contact,
    EmailValidationStatus,
    Interaction,
    InteractionType,
    LeadStatus,
    OutreachMessage,
    Prisma,
    SourceType,
    WebsiteScrapeOperation,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ElasticsearchService } from '@/integrations/elasticsearch/elasticsearch.service';
import { ScrapioScrapeRequestService } from '@/integrations/scrapio/services/scrapio-scrape-request.service';
import { SCRAPIO_EMAIL_REGEX_FIELD } from '@/integrations/scrapio/scrapio.constants';
import { AI_PROCESS_QUEUE } from '@/core/queues/queues.constants';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import { resolveContactEnrichmentSources } from '@/modules/leads/utils/enrichment-sources.utils';
import { resolveEmailFieldsForWrite } from '@/shared/utils/email-domain-validation.util';
import { AddNoteDto } from './dto/add-note.dto';
import { AiDraftMessageDto } from './dto/ai-draft-message.dto';
import { BulkTriggerScoreDto } from './dto/bulk-trigger-score.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { EnrichContactDto } from './dto/enrich-contact.dto';
import { BulkDeleteContactsDto } from './dto/bulk-delete-contacts.dto';
import { BulkEnrichContactsDto } from './dto/bulk-enrich-contacts.dto';
import { BulkScrapeContactEmailsDto } from './dto/bulk-scrape-contact-emails.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { buildContactProfileFieldWhere } from './utils/contact-profile-field-filter.utils';
import { mergeContactWhereClauses } from './utils/contact-where-merge.utils';

export type ContactListFilterParams = Pick<
    ListContactsDto,
    | 'status'
    | 'tags'
    | 'search'
    | 'filter_uuid'
    | 'lead_uuid'
    | 'score_rules'
    | 'source_type'
    | 'profile_field'
    | 'has_profile_field'
>;
import { LogCallDto } from './dto/log-call.dto';
import { LogEmailDto } from './dto/log-email.dto';
import { LogMeetingDto } from './dto/log-meeting.dto';
import { LogSmsDto } from './dto/log-sms.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateTagsDto } from './dto/update-tags.dto';
import { CreateContactInfoDto } from './dto/create-contact-info.dto';
import { UpdateContactInfoDto } from './dto/update-contact-info.dto';
import { CONTACT_PROFILE_UPDATE_KEYS } from './constants/contact-profile.constants';
import { contactProfileFromLead } from './utils/contact-profile.utils';
import { ContactAiService } from './services/contact-ai.service';
import { ListEnrichmentsDto } from '@/modules/enrichment/dto/list-enrichments.dto';
import { EnrichmentQueryService } from '@/modules/enrichment/services/enrichment-query.service';
import { OutreachService } from '@/modules/outreach/outreach.service';
import { enqueueContactScoreJob } from './utils/contact-score-queue.utils';
import { enqueueContactEnrichmentJob } from './utils/contact-enrichment-queue.utils';
import { BulkAiDraftMessagesDto } from './dto/bulk-ai-draft-messages.dto';
import { EmailCredentialsService } from '@/modules/integrations/services/email-credentials.service';
import type { EmailProviderTarget } from '@/modules/integrations/interfaces/email-credentials.interface';
import { SenderProfilesService } from '@/modules/sender-profiles/sender-profiles.service';
import { mergeSenderProfileMetadata } from '@/modules/outreach/utils/sender-profile-metadata.util';
import {
    assignEmailProviders,
    buildEmailProviderMetadata,
    buildEqualAllocations,
    validateEmailProviderAllocations,
} from '@/modules/outreach/utils/email-provider-allocation.util';
import { WebsiteScraperService } from '@/integrations/website-scraper/website-scraper.service';
import type { CrawledPage } from '@/integrations/apify/website-content-crawler/website-content-crawler.interfaces';
import {
    buildWebsiteEmailCrawlUrls,
    extractEmailsFromCrawledPages,
    pickBestContactEmail,
} from './utils/contact-website-email.utils';
import {
    ensureContactFilterLink,
    findOwnedContactByEmail,
    linkContactToFilter,
    loadLinkedFiltersForScore,
    combineFiltersForScore,
    mergeContactsIntoCanonical,
    shapeContactFilterFields,
} from './utils/contact-filter-link.utils';

@Injectable()
export class ContactsService {
    private readonly logger = new Logger(ContactsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly elasticsearchService: ElasticsearchService,
        private readonly contactAiService: ContactAiService,
        private readonly enrichmentQueryService: EnrichmentQueryService,
        private readonly outreachService: OutreachService,
        private readonly emailCredentialsService: EmailCredentialsService,
        private readonly senderProfilesService: SenderProfilesService,
        private readonly websiteCrawler: WebsiteScraperService,
        private readonly scrapioScrapeRequestService: ScrapioScrapeRequestService,
        private readonly bulkJobsService: BulkJobsService,
        @InjectQueue(AI_PROCESS_QUEUE) private readonly aiProcessQueue: Queue,
    ) { }

    async create(organisation_uuid: string, dto: CreateContactDto) {
        const filter = await this.prisma.filter.findFirst({
            where: { uuid: dto.filter_uuid, organisation_uuid },
        });
        if (!filter) {
            throw new NotFoundException('Filter not found');
        }

        const emailFields = await resolveEmailFieldsForWrite(dto.email);

        if (emailFields) {
            const existing = await findOwnedContactByEmail(this.prisma, organisation_uuid, emailFields.email);
            if (existing) {
                await linkContactToFilter(this.prisma, existing, dto.filter_uuid);
                await this.applyManualCreateExtras(organisation_uuid, existing.uuid, dto);
                await this.reindexContact(existing.uuid);
                return this.findOne(organisation_uuid, existing.uuid);
            }
        }

        const lead = await this.prisma.lead.create({
            data: {
                source_type: SourceType.MANUAL,
                name: dto.name,
                phone: dto.phone,
                company: dto.company,
                website: dto.website,
                google_maps_url: dto.google_maps_url,
                title: dto.title,
                location: dto.location,
                linkedin_url: dto.linkedin_url,
                industry: dto.industry,
                description: dto.description,
                ...(emailFields ?? {}),
            },
        });

        const profile = contactProfileFromLead(lead);

        const contact = await this.prisma.contact.create({
            data: {
                organisation_uuid,
                lead_uuid: lead.uuid,
                filter_uuid: dto.filter_uuid,
                status: LeadStatus.NEW,
                notes: dto.notes,
                ...profile,
                email_validation_status: lead.email_validation_status,
                email_validation_reason: lead.email_validation_reason,
                email_validated_at: lead.email_validated_at,
                ...(dto.tags && dto.tags.length > 0
                    ? {
                        tags: {
                            create: dto.tags.map((tag) => ({ tag })),
                        },
                    }
                    : {}),
            },
        });

        await ensureContactFilterLink(this.prisma, contact.uuid, dto.filter_uuid);

        if (dto.notes) {
            await this.prisma.interaction.create({
                data: {
                    contact_uuid: contact.uuid,
                    organisation_uuid,
                    type: InteractionType.NOTE,
                    content: dto.notes,
                },
            });
        }

        await this.elasticsearchService.indexLead(lead);
        await this.reindexContact(contact.uuid);

        return this.findOne(organisation_uuid, contact.uuid);
    }

    buildWhereInput(organisation_uuid: string, query: ContactListFilterParams): Prisma.ContactWhereInput {
        const andClauses: Prisma.ContactWhereInput[] = [];

        if (query.score_rules && query.score_rules.length > 0) {
            andClauses.push(
                ...query.score_rules.map((rule) => ({
                    contact_scores: {
                        some: {
                            scoring_instruction_uuid: rule.scoring_instruction_uuid,
                            score: { gte: rule.min },
                        },
                    },
                })),
            );
        }

        if (query.profile_field && query.has_profile_field !== undefined) {
            andClauses.push(
                buildContactProfileFieldWhere(query.profile_field, query.has_profile_field),
            );
        }

        if (query.tags && query.tags.length > 0) {
            andClauses.push(
                ...query.tags.map((tag) => ({
                    tags: { some: { tag } },
                })),
            );
        }

        const base: Prisma.ContactWhereInput = {
            organisation_uuid,
            ...(query.status && { status: query.status }),
            ...(query.filter_uuid && {
                contact_filters: { some: { filter_uuid: query.filter_uuid } },
            }),
            ...(query.lead_uuid && { lead_uuid: query.lead_uuid }),
            ...(query.source_type && { lead: { source_type: query.source_type } }),
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { company: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };

        return mergeContactWhereClauses(base, andClauses);
    }

    applyAudienceFilters(
        where: Prisma.ContactWhereInput,
        query: Pick<
            ListContactsDto,
            | 'last_interaction_after'
            | 'last_interaction_before'
            | 'never_contacted'
            | 'include_unsubscribed'
            | 'exclude_list_uuid'
        >,
    ) {
        const audienceAnd: Prisma.ContactWhereInput[] = [];

        if (query.last_interaction_after) {
            audienceAnd.push({
                last_interaction_at: { gte: new Date(query.last_interaction_after) },
            });
        }
        if (query.last_interaction_before) {
            audienceAnd.push({
                last_interaction_at: { lte: new Date(query.last_interaction_before) },
            });
        }
        if (query.never_contacted) {
            audienceAnd.push({
                campaign_contacts: {
                    none: {
                        channel: { in: [Channel.EMAIL, Channel.SMS, Channel.LINKEDIN] },
                        status: {
                            in: [
                                CampaignContactStatus.SENT,
                                CampaignContactStatus.DELIVERED,
                                CampaignContactStatus.OPENED,
                                CampaignContactStatus.CLICKED,
                                CampaignContactStatus.REPLIED,
                                CampaignContactStatus.BOUNCED,
                                CampaignContactStatus.UNSUBSCRIBED,
                            ],
                        },
                    },
                },
            });
        }

        const applyUnsubscribedRule =
            query.exclude_list_uuid ||
            query.never_contacted ||
            query.include_unsubscribed !== undefined ||
            query.last_interaction_after !== undefined ||
            query.last_interaction_before !== undefined;

        if (applyUnsubscribedRule && !query.include_unsubscribed) {
            audienceAnd.push({ unsubscribed_at: null });
        }

        if (audienceAnd.length === 0) return;

        const merged = mergeContactWhereClauses(where, audienceAnd);
        Object.assign(where, merged);
    }

    async applyContactListIncludeFilter(
        where: Prisma.ContactWhereInput,
        organisation_uuid: string,
        contact_list_uuid: string,
    ): Promise<void> {
        const list = await this.prisma.contactList.findFirst({
            where: { uuid: contact_list_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!list) {
            throw new NotFoundException('Contact list not found');
        }

        const members = await this.prisma.contactListMember.findMany({
            where: { list_uuid: contact_list_uuid },
            select: { contact_uuid: true },
        });

        const memberUuids = members.map((member) => member.contact_uuid);
        const listConstraint: Prisma.ContactWhereInput =
            memberUuids.length === 0
                ? { uuid: { in: [] } }
                : { uuid: { in: memberUuids } };

        const merged = mergeContactWhereClauses(where, [listConstraint]);
        Object.assign(where, merged);
    }

    async findAll(organisation_uuid: string, query: ListContactsDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where = this.buildWhereInput(organisation_uuid, query);
        this.applyAudienceFilters(where, query);

        if (query.contact_list_uuid) {
            await this.applyContactListIncludeFilter(where, organisation_uuid, query.contact_list_uuid);
        }

        if (query.exclude_list_uuid) {
            const list = await this.prisma.contactList.findFirst({
                where: { uuid: query.exclude_list_uuid, organisation_uuid },
                select: { uuid: true },
            });
            if (!list) throw new NotFoundException('Contact list not found');

            const memberUuids = await this.prisma.contactListMember.findMany({
                where: { list_uuid: query.exclude_list_uuid },
                select: { contact_uuid: true },
            });

            if (memberUuids.length > 0) {
                const existingNotIn = where.uuid && typeof where.uuid === 'object' && 'notIn' in where.uuid
                    ? (where.uuid as Prisma.StringFilter).notIn ?? []
                    : [];
                where.uuid = {
                    notIn: [
                        ...memberUuids.map((m) => m.contact_uuid),
                        ...(Array.isArray(existingNotIn) ? existingNotIn : []),
                    ],
                };
            }
        }

        const [data, total] = await Promise.all([
            this.prisma.contact.findMany({
                where,
                include: {
                    tags: true,
                    lead: true,
                    filter: { select: { uuid: true, name: true } },
                    contact_filters: {
                        include: { filter: { select: { uuid: true, name: true } } },
                    },
                    contact_scores: {
                        include: { scoring_instruction: { select: { uuid: true, name: true } } },
                    },
                },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.contact.count({ where }),
        ]);

        return {
            data: data.map((c) => {
                const { contact_filters, filter, ...rest } = c;
                const shaped = shapeContactFilterFields({
                    ...c,
                    filter,
                    contact_filters,
                });
                return {
                    ...rest,
                    filter: shaped.filter,
                    also_found_by: shaped.also_found_by,
                    filters: shaped.filters,
                    tags: c.tags.map((t) => t.tag),
                };
            }),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid, organisation_uuid },
            include: {
                tags: true,
                contact_infos: {
                    orderBy: [{ type: 'asc' }, { created_at: 'asc' }],
                },
                lead: true,
                contact_scores: {
                    include: { scoring_instruction: { select: { uuid: true, name: true } } },
                },
                filter: {
                    include: {
                        filter_scoring_instructions: {
                            include: {
                                scoring_instruction: {
                                    select: { uuid: true, name: true, instructions: true },
                                },
                            },
                        },
                    },
                },
                contact_filters: {
                    include: {
                        filter: { select: { uuid: true, name: true } },
                    },
                },
                list_memberships: {
                    include: {
                        list: { select: { uuid: true, title: true } },
                    },
                    orderBy: { created_at: 'asc' },
                },
                interactions: {
                    orderBy: { created_at: 'desc' },
                    take: 20,
                    include: {
                        outreach_message: {
                            select: {
                                uuid: true,
                                subject: true,
                                channel: true,
                                status: true,
                                sent_at: true,
                            },
                        },
                    },
                },
                outreach_messages: {
                    orderBy: { created_at: 'desc' },
                },
            },
        });
        if (!contact) {
            throw new NotFoundException(`Contact ${uuid} not found`);
        }
        const { filter: rawFilter, contact_filters, list_memberships, ...rest } = contact;
        const filter = rawFilter
            ? (() => {
                  const { filter_scoring_instructions, ...frest } = rawFilter;
                  return {
                      ...frest,
                      scoring_instructions: filter_scoring_instructions.map(
                          (l) => l.scoring_instruction,
                      ),
                  };
              })()
            : null;
        const shaped = shapeContactFilterFields({
            ...contact,
            filter: rawFilter,
            contact_filters,
        });
        return {
            ...rest,
            filter,
            also_found_by: shaped.also_found_by,
            filters: shaped.filters,
            lists: list_memberships.map((m) => ({
                uuid: m.list.uuid,
                title: m.list.title,
            })),
            tags: contact.tags.map((t) => t.tag),
        };
    }

    async update(organisation_uuid: string, uuid: string, dto: UpdateContactDto) {
        await this.requireOwnedContact(organisation_uuid, uuid);

        let emailPatch: Prisma.ContactUpdateInput | undefined;
        if (dto.email !== undefined) {
            const trimmed = dto.email?.trim() || null;
            if (!trimmed) {
                emailPatch = {
                    email: null,
                    email_validation_status: EmailValidationStatus.UNKNOWN,
                    email_validation_reason: null,
                    email_validated_at: null,
                };
            } else {
                const fields = await resolveEmailFieldsForWrite(trimmed);
                if (fields) {
                    emailPatch = fields;
                }
            }
        }

        if (emailPatch?.email) {
            const existingByEmail = await findOwnedContactByEmail(
                this.prisma,
                organisation_uuid,
                emailPatch.email as string,
            );
            if (existingByEmail && existingByEmail.uuid !== uuid) {
                await mergeContactsIntoCanonical(
                    this.prisma,
                    this.elasticsearchService,
                    organisation_uuid,
                    uuid,
                    existingByEmail.uuid,
                );
                const data: Prisma.ContactUpdateInput = { ...emailPatch };
                if (dto.notes !== undefined) {
                    data.notes = dto.notes;
                }
                await this.prisma.contact.update({
                    where: { uuid: existingByEmail.uuid },
                    data,
                });
                if (dto.list_uuids !== undefined) {
                    await this.replaceContactListMemberships(
                        organisation_uuid,
                        existingByEmail.uuid,
                        dto.list_uuids,
                    );
                }
                await this.reindexContact(existingByEmail.uuid);
                return this.findOne(organisation_uuid, existingByEmail.uuid);
            }
        }

        return this.applyUpdateToContact(organisation_uuid, uuid, dto, emailPatch);
    }

    async resubscribe(organisation_uuid: string, uuid: string) {
        const contact = await this.requireOwnedContact(organisation_uuid, uuid);
        if (!contact.unsubscribed_at) {
            return this.findOne(organisation_uuid, uuid);
        }

        await this.prisma.$transaction([
            this.prisma.contact.update({
                where: { uuid: contact.uuid },
                data: { unsubscribed_at: null },
            }),
            this.prisma.interaction.create({
                data: {
                    contact_uuid: contact.uuid,
                    organisation_uuid,
                    type: InteractionType.NOTE,
                    content: 'Email preference restored to subscribed',
                },
            }),
        ]);

        return this.findOne(organisation_uuid, uuid);
    }

    private async applyUpdateToContact(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateContactDto,
        emailPatch?: Prisma.ContactUpdateInput,
    ) {
        const data: Prisma.ContactUpdateInput = {};
        if (dto.notes !== undefined) {
            data.notes = dto.notes;
        }
        if (emailPatch) {
            Object.assign(data, emailPatch);
        }
        for (const key of CONTACT_PROFILE_UPDATE_KEYS) {
            if (key === 'email') continue;
            if (dto[key] !== undefined) {
                data[key] = dto[key] as never;
            }
        }
        if (Object.keys(data).length > 0) {
            await this.prisma.contact.update({
                where: { uuid },
                data,
            });
        }
        if (dto.list_uuids !== undefined) {
            await this.replaceContactListMemberships(organisation_uuid, uuid, dto.list_uuids);
        }
        await this.reindexContact(uuid);
        return this.findOne(organisation_uuid, uuid);
    }

    private async replaceContactListMemberships(
        organisation_uuid: string,
        contact_uuid: string,
        list_uuids: string[],
    ): Promise<void> {
        const unique = [...new Set(list_uuids)];
        if (unique.length > 0) {
            const lists = await this.prisma.contactList.findMany({
                where: { organisation_uuid, uuid: { in: unique } },
                select: { uuid: true },
            });
            if (lists.length !== unique.length) {
                const found = new Set(lists.map((l) => l.uuid));
                const missing = unique.filter((id) => !found.has(id));
                throw new NotFoundException(`List(s) not found: ${missing.join(', ')}`);
            }
        }

        await this.prisma.contactListMember.deleteMany({
            where: {
                contact_uuid,
                ...(unique.length > 0 ? { list_uuid: { notIn: unique } } : {}),
            },
        });

        if (unique.length === 0) return;

        await this.prisma.contactListMember.createMany({
            data: unique.map((list_uuid) => ({
                list_uuid,
                contact_uuid,
            })),
            skipDuplicates: true,
        });
    }

    async remove(organisation_uuid: string, uuid: string): Promise<{ uuid: string }> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        await this.prisma.contact.delete({ where: { uuid } });
        await this.elasticsearchService.deleteContact(uuid);
        return { uuid };
    }

    async removeMany(
        organisation_uuid: string,
        dto: BulkDeleteContactsDto,
    ): Promise<{ deleted: number }> {
        const unique = [...new Set(dto.uuids)];
        const rows = await this.prisma.contact.findMany({
            where: { organisation_uuid, uuid: { in: unique } },
            select: { uuid: true },
        });
        if (rows.length !== unique.length) {
            const found = new Set(rows.map((r) => r.uuid));
            const missing = unique.filter((u) => !found.has(u));
            throw new NotFoundException(`Contact(s) not found: ${missing.join(', ')}`);
        }

        await this.prisma.contact.deleteMany({
            where: { organisation_uuid, uuid: { in: unique } },
        });

        await Promise.all(
            unique.map((uuid) => this.elasticsearchService.deleteContact(uuid)),
        );

        return { deleted: unique.length };
    }

    async updateStatus(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateStatusDto,
    ): Promise<Contact> {
        const existing = await this.requireOwnedContact(organisation_uuid, uuid);

        if (existing.status === dto.status) {
            return existing;
        }

        const noteTrimmed = dto.note?.trim();

        const [updated] = await this.prisma.$transaction([
            this.prisma.contact.update({
                where: { uuid },
                data: { status: dto.status },
            }),
            this.prisma.interaction.create({
                data: {
                    contact_uuid: uuid,
                    organisation_uuid,
                    type: InteractionType.STATUS_CHANGE,
                    content: noteTrimmed ?? null,
                    status_change: {
                        from: existing.status,
                        to: dto.status,
                    },
                },
            }),
        ]);

        await this.reindexContact(uuid);

        return updated;
    }

    buildPromoteToContactedIfNewOps(
        contact_uuid: string,
        organisation_uuid: string,
        trigger: string,
        currentStatus: LeadStatus,
    ): Prisma.PrismaPromise<unknown>[] {
        if (currentStatus !== LeadStatus.NEW) {
            return [];
        }

        return [
            this.prisma.contact.update({
                where: { uuid: contact_uuid },
                data: { status: LeadStatus.CONTACTED },
            }),
            this.prisma.interaction.create({
                data: {
                    contact_uuid,
                    organisation_uuid,
                    type: InteractionType.STATUS_CHANGE,
                    status_change: {
                        from: LeadStatus.NEW,
                        to: LeadStatus.CONTACTED,
                        auto: true,
                        trigger,
                    },
                },
            }),
        ];
    }

    async syncContactSearchIndex(contact_uuid: string): Promise<void> {
        await this.reindexContact(contact_uuid);
    }

    async updateTags(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateTagsDto,
    ): Promise<{ tags: string[] }> {
        await this.requireOwnedContact(organisation_uuid, uuid);

        const unique = Array.from(new Set(dto.tags));

        await this.prisma.$transaction([
            this.prisma.contactTag.deleteMany({ where: { contact_uuid: uuid } }),
            ...(unique.length > 0
                ? [
                    this.prisma.contactTag.createMany({
                        data: unique.map((tag) => ({ contact_uuid: uuid, tag })),
                    }),
                ]
                : []),
        ]);

        await this.reindexContact(uuid);

        return { tags: unique };
    }

    async listContactInfos(organisation_uuid: string, uuid: string) {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.prisma.contactInfo.findMany({
            where: { contact_uuid: uuid },
            orderBy: [{ type: 'asc' }, { created_at: 'asc' }],
        });
    }

    async createContactInfo(
        organisation_uuid: string,
        uuid: string,
        dto: CreateContactInfoDto,
    ) {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.prisma.contactInfo.create({
            data: {
                contact_uuid: uuid,
                type: dto.type,
                value: dto.value.trim(),
            },
        });
    }

    async updateContactInfo(
        organisation_uuid: string,
        uuid: string,
        infoUuid: string,
        dto: UpdateContactInfoDto,
    ) {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const existing = await this.prisma.contactInfo.findFirst({
            where: { uuid: infoUuid, contact_uuid: uuid },
        });
        if (!existing) {
            throw new NotFoundException(`Contact info ${infoUuid} not found`);
        }
        return this.prisma.contactInfo.update({
            where: { uuid: infoUuid },
            data: {
                ...(dto.type !== undefined && { type: dto.type }),
                ...(dto.value !== undefined && { value: dto.value.trim() }),
            },
        });
    }

    async removeContactInfo(
        organisation_uuid: string,
        uuid: string,
        infoUuid: string,
    ): Promise<{ uuid: string }> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const existing = await this.prisma.contactInfo.findFirst({
            where: { uuid: infoUuid, contact_uuid: uuid },
        });
        if (!existing) {
            throw new NotFoundException(`Contact info ${infoUuid} not found`);
        }
        await this.prisma.contactInfo.delete({ where: { uuid: infoUuid } });
        return { uuid: infoUuid };
    }

    async addNote(
        organisation_uuid: string,
        uuid: string,
        dto: AddNoteDto,
    ): Promise<Interaction> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.prisma.interaction.create({
            data: {
                contact_uuid: uuid,
                organisation_uuid,
                type: InteractionType.NOTE,
                content: dto.content,
            },
        });
    }

    async logCall(
        organisation_uuid: string,
        uuid: string,
        dto: LogCallDto,
    ): Promise<Interaction> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const metadata: Prisma.InputJsonValue = {
            outcome: dto.outcome,
            direction: dto.direction,
            ...(dto.duration_minutes !== undefined && { duration_minutes: dto.duration_minutes }),
            ...(dto.occurred_at && { occurred_at: dto.occurred_at }),
        };
        return this.prisma.interaction.create({
            data: {
                contact_uuid: uuid,
                organisation_uuid,
                type: InteractionType.CALL,
                content: dto.content?.trim() || null,
                metadata,
            },
        });
    }

    async logMeeting(
        organisation_uuid: string,
        uuid: string,
        dto: LogMeetingDto,
    ): Promise<Interaction> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const metadata: Prisma.InputJsonValue = {
            outcome: dto.outcome,
            occurred_at: dto.occurred_at,
            ...(dto.duration_minutes !== undefined && { duration_minutes: dto.duration_minutes }),
            ...(dto.location?.trim() && { location: dto.location.trim() }),
        };
        return this.prisma.interaction.create({
            data: {
                contact_uuid: uuid,
                organisation_uuid,
                type: InteractionType.MEETING,
                content: dto.content?.trim() || null,
                metadata,
            },
        });
    }

    async logEmail(
        organisation_uuid: string,
        uuid: string,
        dto: LogEmailDto,
    ): Promise<Interaction> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const metadata: Prisma.InputJsonValue = {
            direction: dto.direction,
            ...(dto.subject?.trim() && { subject: dto.subject.trim() }),
            ...(dto.occurred_at && { occurred_at: dto.occurred_at }),
        };
        return this.prisma.interaction.create({
            data: {
                contact_uuid: uuid,
                organisation_uuid,
                type: InteractionType.EMAIL,
                content: dto.content?.trim() || null,
                metadata,
            },
        });
    }

    async logSms(
        organisation_uuid: string,
        uuid: string,
        dto: LogSmsDto,
    ): Promise<Interaction> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const metadata: Prisma.InputJsonValue = {
            direction: dto.direction,
            ...(dto.occurred_at && { occurred_at: dto.occurred_at }),
        };
        return this.prisma.interaction.create({
            data: {
                contact_uuid: uuid,
                organisation_uuid,
                type: InteractionType.SMS,
                content: dto.content?.trim() || null,
                metadata,
            },
        });
    }

    async getInteractions(organisation_uuid: string, uuid: string) {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.prisma.interaction.findMany({
            where: { contact_uuid: uuid },
            orderBy: { created_at: 'desc' },
            include: {
                outreach_message: {
                    select: {
                        uuid: true,
                        subject: true,
                        channel: true,
                        status: true,
                        sent_at: true,
                        reply_subject: true,
                        reply_text: true,
                        reply_html: true,
                    },
                },
            },
        });
    }

    async convertFromLead(organisation_uuid: string, lead_uuid: string) {
        const lead = await this.prisma.lead.findUnique({ where: { uuid: lead_uuid } });
        if (!lead) {
            throw new NotFoundException(`Lead ${lead_uuid} not found`);
        }

        const existingByLead = await this.prisma.contact.findFirst({
            where: { organisation_uuid, lead_uuid },
        });
        if (existingByLead) {
            return this.findOne(organisation_uuid, existingByLead.uuid);
        }

        const email = lead.email?.trim();
        if (email) {
            const existingByEmail = await findOwnedContactByEmail(this.prisma, organisation_uuid, email);
            if (existingByEmail) {
                return this.findOne(organisation_uuid, existingByEmail.uuid);
            }
        }

        try {
            const contact = await this.prisma.contact.create({
                data: {
                    organisation_uuid,
                    lead_uuid,
                    status: LeadStatus.NEW,
                    ...contactProfileFromLead(lead),
                },
            });
            await this.reindexContact(contact.uuid);
            return this.findOne(organisation_uuid, contact.uuid);
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const raced = await this.prisma.contact.findFirst({
                    where: { organisation_uuid, lead_uuid },
                });
                if (raced) {
                    return this.findOne(organisation_uuid, raced.uuid);
                }
                throw new ConflictException(`Contact for lead ${lead_uuid} already exists`);
            }
            throw error;
        }
    }

    async triggerScore(
        organisation_uuid: string,
        uuid: string,
        dto?: { scoring_instruction_uuids?: string[] },
    ): Promise<{ jobId: string }> {
        const row = await this.prisma.contact.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!row) {
            throw new NotFoundException(`Contact ${uuid} not found`);
        }
        const linkedFilters = await loadLinkedFiltersForScore(this.prisma, uuid);
        const combined = combineFiltersForScore(linkedFilters);
        const allowed =
            combined?.filter_scoring_instructions.map((x) => x.scoring_instruction_uuid) ?? [];
        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            title: `Score contact (${uuid})`,
            type: BulkJobType.CONTACT_SCORE,
            status: BulkJobStatus.QUEUED,
            progress_total: 1,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'contact',
            reference_uuid: uuid,
        });
        const job = await enqueueContactScoreJob(
            this.aiProcessQueue,
            this.prisma,
            uuid,
            allowed,
            dto?.scoring_instruction_uuids,
            bulkJob.uuid,
        );
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: job.jobId });
        return job;
    }

    async triggerBulkScore(
        organisation_uuid: string,
        dto: BulkTriggerScoreDto,
    ): Promise<
        | { jobIds: string[]; queued: number; skipped_contacts: number; is_batch: false }
        | { batch_id: string; queued: number; skipped_contacts: number; is_batch: true }
    > {
        const contactUuids = [...new Set(dto.contact_uuids)];
        const ruleUuids = [...new Set(dto.scoring_instruction_uuids)];

        const instructions = await this.prisma.scoringInstruction.findMany({
            where: { organisation_uuid, uuid: { in: ruleUuids } },
            select: { uuid: true },
        });
        if (instructions.length !== ruleUuids.length) {
            const found = new Set(instructions.map((i) => i.uuid));
            const missing = ruleUuids.filter((u) => !found.has(u));
            throw new NotFoundException(`Scoring instruction(s) not found: ${missing.join(', ')}`);
        }

        const contacts = await this.prisma.contact.findMany({
            where: { organisation_uuid, uuid: { in: contactUuids } },
        });
        if (contacts.length !== contactUuids.length) {
            const found = new Set(contacts.map((c) => c.uuid));
            const missing = contactUuids.filter((u) => !found.has(u));
            throw new NotFoundException(`Contact(s) not found: ${missing.join(', ')}`);
        }

        const linkedFiltersByContact = await Promise.all(
            contacts.map(async (c) => ({
                contact_uuid: c.uuid,
                filters: await loadLinkedFiltersForScore(this.prisma, c.uuid),
            })),
        );
        const linkedMap = new Map(
            linkedFiltersByContact.map((row) => [row.contact_uuid, row.filters]),
        );

        const jobIds: string[] = [];
        const batchPlan: Array<{ contact_uuid: string; instruction_uuids: string[] }> = [];
        let skipped_contacts = 0;
        const scoreBulkJob = dto.use_batch
            ? null
            : await this.bulkJobsService.create({
                  organisation_uuid,
                  title: `Score contacts (${contacts.length})`,
                  type: BulkJobType.CONTACT_SCORE,
                  status: BulkJobStatus.QUEUED,
                  progress_total: contacts.length,
                  queue_name: AI_PROCESS_QUEUE,
                  reference_type: 'contacts',
                  metadata: { contact_uuids: contactUuids },
              });

        for (const c of contacts) {
            const combined = combineFiltersForScore(linkedMap.get(c.uuid) ?? []);
            const allowed =
                combined?.filter_scoring_instructions.map((x) => x.scoring_instruction_uuid) ?? [];
            const perContactRequested = ruleUuids.filter((id) => allowed.includes(id));
            if (perContactRequested.length === 0) {
                skipped_contacts += 1;
                continue;
            }

            if (dto.use_batch) {
                batchPlan.push({ contact_uuid: c.uuid, instruction_uuids: perContactRequested });
            } else {
                const job = await enqueueContactScoreJob(
                    this.aiProcessQueue,
                    this.prisma,
                    c.uuid,
                    allowed,
                    perContactRequested,
                    scoreBulkJob?.uuid,
                );
                jobIds.push(job.jobId);
            }
        }

        if (dto.use_batch) {
            if (batchPlan.length === 0) {
                throw new BadRequestException(
                    'None of the selected contacts use any of the chosen scoring rules on their linked filters.',
                );
            }
            const { batch_id, queued } = await this.contactAiService.submitBatchScore(organisation_uuid, batchPlan);
            return { batch_id, queued, skipped_contacts, is_batch: true as const };
        }

        if (jobIds.length === 0) {
            if (scoreBulkJob) {
                await this.bulkJobsService.cancel(scoreBulkJob.uuid, 'No eligible contacts to score');
            }
            throw new BadRequestException(
                'None of the selected contacts use any of the chosen scoring rules on their linked filters.',
            );
        }

        if (scoreBulkJob) {
            await this.prisma.bulkJob.update({
                where: { uuid: scoreBulkJob.uuid },
                data: { progress_total: jobIds.length },
            });
            await this.bulkJobsService.markRunning(scoreBulkJob.uuid, {
                queue_job_id: jobIds[0] ?? null,
            });
        }

        return { jobIds, queued: jobIds.length, skipped_contacts, is_batch: false as const };
    }

    async triggerBulkAiDraftMessages(
        organisation_uuid: string,
        dto: BulkAiDraftMessagesDto,
        sent_by_user_uuid: string,
    ): Promise<{ created: number; skipped: number; failed: number; queued?: number }> {
        const contactUuids = [...new Set(dto.contact_uuids)];
        const contacts = await this.prisma.contact.findMany({
            where: { organisation_uuid, uuid: { in: contactUuids } },
            include: { lead: true },
        });
        if (contacts.length !== contactUuids.length) {
            const found = new Set(contacts.map((c) => c.uuid));
            const missing = contactUuids.filter((u) => !found.has(u));
            throw new NotFoundException(`Contact(s) not found: ${missing.join(', ')}`);
        }

        const { generated, skipped, failed, message_uuids } =
            await this.contactAiService.draftBulkMessages(
                organisation_uuid,
                contacts,
                dto.channel,
                dto.prompt,
                dto.language,
                undefined,
                sent_by_user_uuid,
            );

        let queued = 0;
        if (dto.send && message_uuids.length > 0) {
            const messages = await this.prisma.outreachMessage.findMany({
                where: { uuid: { in: message_uuids }, organisation_uuid },
                select: { uuid: true, contact_uuid: true, channel: true },
            });

            let providerAssignments = new Map<string, EmailProviderTarget>();

            let senderProfileUuid: string | null = null;
            if (dto.send) {
                if (dto.sender_profile_uuid) {
                    await this.senderProfilesService.findOne(organisation_uuid, dto.sender_profile_uuid);
                    senderProfileUuid = dto.sender_profile_uuid;
                } else {
                    const defaultProfile = await this.senderProfilesService.findDefault(organisation_uuid);
                    senderProfileUuid = defaultProfile?.uuid ?? null;
                }
            }

            if (dto.channel === Channel.EMAIL) {
                const emailMessages = messages.filter((m) => m.channel === Channel.EMAIL);
                let allocations = dto.email_provider_allocations?.length
                    ? validateEmailProviderAllocations(
                          dto.email_provider_allocations,
                          emailMessages.length,
                      )
                    : null;

                if (!allocations?.length) {
                    const accounts =
                        await this.emailCredentialsService.resolveSendableAccounts(organisation_uuid);
                    allocations = buildEqualAllocations(accounts, emailMessages.length);
                }

                if (allocations?.length) {
                    for (const row of allocations) {
                        await this.emailCredentialsService.assertSendableAccount(
                            organisation_uuid,
                            row.provider,
                            row.account,
                        );
                    }
                    providerAssignments = assignEmailProviders(
                        emailMessages.map((m) => m.contact_uuid),
                        allocations,
                    );
                }
            }

            for (const message of messages) {
                try {
                    const assignment = providerAssignments.get(message.contact_uuid);
                    const metadataUpdates: Prisma.InputJsonValue | undefined = (() => {
                        let metadata: Record<string, unknown> = {};
                        if (assignment && message.channel === Channel.EMAIL) {
                            metadata = buildEmailProviderMetadata(assignment);
                        }
                        if (senderProfileUuid) {
                            metadata = mergeSenderProfileMetadata(metadata, senderProfileUuid);
                        }
                        return Object.keys(metadata).length > 0
                            ? (metadata as Prisma.InputJsonValue)
                            : undefined;
                    })();

                    if (metadataUpdates) {
                        await this.prisma.outreachMessage.update({
                            where: { uuid: message.uuid },
                            data: { metadata: metadataUpdates },
                        });
                    }
                    await this.outreachService.sendMessage(
                        organisation_uuid,
                        message.uuid,
                        {},
                        sent_by_user_uuid,
                    );
                    queued++;
                } catch (error) {
                    this.logger.error(
                        `Bulk AI draft send ${message.uuid} failed: ${error instanceof Error ? error.message : error}`,
                    );
                }
            }
        }

        return {
            created: generated,
            skipped,
            failed,
            ...(dto.send ? { queued } : {}),
        };
    }

    async triggerDraftMessages(
        organisation_uuid: string,
        uuid: string,
    ): Promise<{ jobId: string }> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            title: `Draft messages (${uuid})`,
            type: BulkJobType.AI_DRAFT_MESSAGES,
            status: BulkJobStatus.QUEUED,
            progress_total: 1,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'contact',
            reference_uuid: uuid,
        });
        const job = await this.aiProcessQueue.add(
            `contact-draft:${uuid}`,
            { contact_uuid: uuid, action: 'draft' as const, bulk_job_uuid: bulkJob.uuid },
            { removeOnComplete: 100, removeOnFail: 100 },
        );
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: String(job.id) });
        return { jobId: String(job.id) };
    }

    async draftAdHocMessage(
        organisation_uuid: string,
        dto: AiDraftMessageDto,
    ): Promise<{ subject: string | null; content: string }> {
        return this.contactAiService.draftAdHocMessage(organisation_uuid, dto);
    }

    async enrichContact(
        organisation_uuid: string,
        uuid: string,
        dto: EnrichContactDto,
        created_by_user_uuid?: string,
    ): Promise<{ jobId: string; bulk_job_uuid: string }> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        const row = await this.prisma.contact.findFirst({
            where: { uuid, organisation_uuid },
            include: { filter: true },
        });
        if (!row) {
            throw new NotFoundException(`Contact ${uuid} not found`);
        }
        const enrichment_sources = resolveContactEnrichmentSources(dto.sources, row.filter);
        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            created_by_user_uuid,
            title: `Enrich contact (${row.name || uuid})`,
            type: BulkJobType.CONTACT_ENRICH,
            status: BulkJobStatus.QUEUED,
            progress_total: 1,
            progress_current: 0,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'contact',
            reference_uuid: uuid,
            metadata: { contact_uuids: [uuid], sources: enrichment_sources },
        });
        const job = await enqueueContactEnrichmentJob(
            this.aiProcessQueue,
            uuid,
            enrichment_sources,
            bulkJob.uuid,
        );
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: job.jobId });
        return { jobId: job.jobId, bulk_job_uuid: bulkJob.uuid };
    }

    async triggerBulkEnrich(
        organisation_uuid: string,
        dto: BulkEnrichContactsDto,
        created_by_user_uuid?: string,
    ): Promise<{ jobIds: string[]; queued: number; bulk_job_uuid: string }> {
        const unique = [...new Set(dto.uuids)];
        const rows = await this.prisma.contact.findMany({
            where: { organisation_uuid, uuid: { in: unique } },
            include: { filter: true },
        });
        if (rows.length !== unique.length) {
            const found = new Set(rows.map((r) => r.uuid));
            const missing = unique.filter((u) => !found.has(u));
            throw new NotFoundException(`Contact(s) not found: ${missing.join(', ')}`);
        }

        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            created_by_user_uuid,
            title: `Enrich contacts (${rows.length})`,
            type: BulkJobType.CONTACT_ENRICH,
            status: BulkJobStatus.QUEUED,
            progress_total: rows.length,
            progress_current: 0,
            queue_name: AI_PROCESS_QUEUE,
            reference_type: 'contacts',
            metadata: { contact_uuids: rows.map((r) => r.uuid), sources: dto.sources ?? [] },
        });

        const jobs = await Promise.all(
            rows.map((row) => {
                const enrichment_sources = resolveContactEnrichmentSources(dto.sources, row.filter);
                return enqueueContactEnrichmentJob(
                    this.aiProcessQueue,
                    row.uuid,
                    enrichment_sources,
                    bulkJob.uuid,
                );
            }),
        );
        const jobIds = jobs.map((j) => j.jobId);
        await this.bulkJobsService.markRunning(bulkJob.uuid, { queue_job_id: jobIds[0] ?? null });
        return { jobIds, queued: jobIds.length, bulk_job_uuid: bulkJob.uuid };
    }

    async triggerBulkScrapeEmailsFromWebsites(
        organisation_uuid: string,
        dto: BulkScrapeContactEmailsDto,
        created_by_user_uuid?: string,
    ): Promise<{ queued: number; skipped: number; bulk_job_uuid: string | null }> {
        const hasUuids = Boolean(dto.contact_uuids?.length);
        const hasList = Boolean(dto.list_uuid);
        const hasFilters = dto.filters !== undefined && dto.filters !== null;

        if (!hasUuids && !hasList && !hasFilters) {
            throw new BadRequestException('Provide contact_uuids, list_uuid, or filters');
        }

        let candidateUuids: string[];

        if (hasUuids) {
            candidateUuids = [...new Set(dto.contact_uuids!)];
            const owned = await this.prisma.contact.findMany({
                where: { organisation_uuid, uuid: { in: candidateUuids } },
                select: { uuid: true },
            });
            if (owned.length !== candidateUuids.length) {
                const found = new Set(owned.map((r) => r.uuid));
                const missing = candidateUuids.filter((u) => !found.has(u));
                throw new NotFoundException(`Contact(s) not found: ${missing.join(', ')}`);
            }

            if (hasList) {
                const list = await this.prisma.contactList.findFirst({
                    where: { uuid: dto.list_uuid!, organisation_uuid },
                    select: { uuid: true },
                });
                if (!list) {
                    throw new NotFoundException('Contact list not found');
                }
                const members = await this.prisma.contactListMember.findMany({
                    where: {
                        list_uuid: dto.list_uuid!,
                        contact_uuid: { in: candidateUuids },
                    },
                    select: { contact_uuid: true },
                });
                const memberSet = new Set(members.map((m) => m.contact_uuid));
                const notInList = candidateUuids.filter((u) => !memberSet.has(u));
                if (notInList.length > 0) {
                    throw new BadRequestException(
                        `Contact(s) not in list: ${notInList.join(', ')}`,
                    );
                }
            }
        } else if (hasList) {
            const list = await this.prisma.contactList.findFirst({
                where: { uuid: dto.list_uuid!, organisation_uuid },
                select: { uuid: true },
            });
            if (!list) {
                throw new NotFoundException('Contact list not found');
            }
            const members = await this.prisma.contactListMember.findMany({
                where: { list_uuid: dto.list_uuid! },
                select: { contact_uuid: true },
            });
            candidateUuids = members.map((m) => m.contact_uuid);
        } else {
            const where = this.buildWhereInput(organisation_uuid, dto.filters!);
            this.applyAudienceFilters(where, dto.filters!);
            const rows = await this.prisma.contact.findMany({
                where,
                select: { uuid: true },
            });
            candidateUuids = rows.map((r) => r.uuid);
        }

        if (candidateUuids.length === 0) {
            return { queued: 0, skipped: 0, bulk_job_uuid: null };
        }

        const resolved = await this.prisma.contact.findMany({
            where: { organisation_uuid, uuid: { in: candidateUuids } },
            select: { uuid: true, website: true, email: true },
        });

        const eligible = resolved.filter(
            (row) =>
                row.website?.trim() &&
                (!row.email || row.email.trim() === ''),
        );

        const skipped = resolved.length - eligible.length;
        if (eligible.length === 0) {
            return { queued: 0, skipped, bulk_job_uuid: null };
        }

        const title = `Find emails from websites (${eligible.length})`;

        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid,
            created_by_user_uuid,
            title,
            type: BulkJobType.CONTACT_EMAIL_SCRAPE,
            status: BulkJobStatus.RUNNING,
            progress_total: eligible.length,
            progress_current: 0,
            reference_type: hasList ? 'contact_list' : 'contacts',
            reference_uuid: hasList ? dto.list_uuid! : undefined,
            metadata: {
                contact_count: eligible.length,
                skipped,
            },
            started_at: new Date(),
        });

        void this.runBulkWebsiteEmailScrape(organisation_uuid, bulkJob.uuid, eligible).catch(
            (error) => {
                this.logger.error(
                    `Bulk email scrape job ${bulkJob.uuid} failed: ${error instanceof Error ? error.message : error}`,
                );
            },
        );

        return {
            queued: eligible.length,
            skipped,
            bulk_job_uuid: bulkJob.uuid,
        };
    }

    private async runBulkWebsiteEmailScrape(
        organisation_uuid: string,
        bulk_job_uuid: string,
        eligible: Array<{ uuid: string; website: string | null }>,
    ): Promise<void> {
        await Promise.all(
            eligible.map(async (row) => {
                let outcome: 'completed' | 'deferred' = 'completed';
                let failed = false;
                try {
                    outcome = await this.scrapeAndSaveContactEmail(
                        organisation_uuid,
                        row.uuid,
                        row.website!.trim(),
                        bulk_job_uuid,
                    );
                } catch (error) {
                    failed = true;
                    this.logger.error(
                        `Contact ${row.uuid} website email scrape failed: ${error instanceof Error ? error.message : error}`,
                    );
                }
                // 'deferred' means a Scrapio run was kicked off — the webhook/timeout dispatcher
                // will call completeBulkEmailScrapeItem itself once that run resolves.
                if (outcome !== 'deferred') {
                    await this.completeBulkEmailScrapeItem(bulk_job_uuid, { failed });
                }
            }),
        );
    }

    /** Called once per contact, whichever path resolves it (sync Apify, or the async Scrapio dispatcher/timeout). */
    async completeBulkEmailScrapeItem(bulk_job_uuid: string, opts: { failed: boolean }): Promise<void> {
        if (opts.failed) {
            await this.bulkJobsService.incrementFailure(bulk_job_uuid);
        }
        const job = await this.bulkJobsService.incrementProgress(bulk_job_uuid);
        if (job.progress_current < job.progress_total) {
            return;
        }
        if (job.progress_failed >= job.progress_total) {
            await this.bulkJobsService.fail(
                bulk_job_uuid,
                `All ${job.progress_total} contact email scrapes failed`,
            );
            return;
        }
        await this.bulkJobsService.complete(
            bulk_job_uuid,
            job.progress_failed > 0 ? `${job.progress_failed}/${job.progress_total} contacts failed` : null,
        );
    }

    private async scrapeAndSaveContactEmail(
        organisation_uuid: string,
        contactUuid: string,
        website: string,
        bulk_job_uuid: string,
    ): Promise<'completed' | 'deferred'> {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: contactUuid, organisation_uuid },
            select: { uuid: true, lead_uuid: true },
        });
        if (!contact) {
            return 'completed';
        }

        const startUrls = buildWebsiteEmailCrawlUrls(website);

        if (this.websiteCrawler.getActiveProvider() === 'scrapio') {
            // Ask Scrapio to extract the email itself via its built-in regex preset
            // (combined across all candidate pages) instead of fetching raw content and
            // running our own regex over it.
            await this.scrapioScrapeRequestService.initiate({
                organisation_uuid,
                operation: WebsiteScrapeOperation.CONTACT_EMAIL_SCRAPE,
                reference_uuid: contactUuid,
                urls: startUrls,
                context: { bulk_job_uuid },
                extraction: {
                    extraction_scope: 'COMBINED',
                    output_formats: ['STRUCTURED_JSON'],
                    output_schema: { emails: SCRAPIO_EMAIL_REGEX_FIELD },
                },
            });
            return 'deferred';
        }

        const pages = await this.websiteCrawler.crawlPages(
            organisation_uuid,
            {
                start_urls: startUrls,
                max_crawl_depth: 0,
                max_crawl_pages: startUrls.length,
                max_results: startUrls.length,
                save_html: true,
                save_markdown: true,
                html_transformer: 'none',
                aggressive_prune: false,
            },
            {
                operation: ApifyUsageOperation.CONTACT_EMAIL_SCRAPE,
                reference_type: 'contact',
                reference_uuid: contactUuid,
            },
        );
        await this.finishContactEmailScrape(organisation_uuid, contactUuid, pages);
        return 'completed';
    }

    /**
     * Post-crawl logic for the synchronous Apify path (above): extracts emails from raw crawled
     * content ourselves, then delegates to `saveFoundContactEmail`.
     */
    async finishContactEmailScrape(
        organisation_uuid: string,
        contactUuid: string,
        pages: CrawledPage[],
    ): Promise<void> {
        const emails = extractEmailsFromCrawledPages(pages);
        const email = pickBestContactEmail(emails);
        if (!email) {
            this.logger.debug(
                `No email found for contact ${contactUuid} across ${pages.length} pages`,
            );
            return;
        }
        await this.saveFoundContactEmail(organisation_uuid, contactUuid, email);
    }

    /**
     * Async Scrapio dispatcher (`WebsiteScrapeDispatchService`, modules/webhooks) entry point:
     * Scrapio already extracted the email itself via its built-in regex preset, so there's no
     * page content to run our own extraction over — just save whatever it found (if anything).
     */
    async finishContactEmailScrapeWithEmail(
        organisation_uuid: string,
        contactUuid: string,
        email: string | null,
    ): Promise<void> {
        if (!email) {
            this.logger.debug(`No email found for contact ${contactUuid}`);
            return;
        }
        await this.saveFoundContactEmail(organisation_uuid, contactUuid, email);
    }

    private async saveFoundContactEmail(
        organisation_uuid: string,
        contactUuid: string,
        email: string,
    ): Promise<void> {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: contactUuid, organisation_uuid },
            select: { uuid: true, lead_uuid: true },
        });
        if (!contact) {
            return;
        }

        const emailFields = await resolveEmailFieldsForWrite(email);
        if (!emailFields) {
            return;
        }

        const existingByEmail = await findOwnedContactByEmail(this.prisma, organisation_uuid, emailFields.email);
        if (existingByEmail && existingByEmail.uuid !== contactUuid) {
            await mergeContactsIntoCanonical(
                this.prisma,
                this.elasticsearchService,
                organisation_uuid,
                contactUuid,
                existingByEmail.uuid,
            );
            await this.prisma.lead.update({
                where: { uuid: existingByEmail.lead_uuid },
                data: emailFields,
            });
            await this.prisma.contact.update({
                where: { uuid: existingByEmail.uuid },
                data: emailFields,
            });
            const lead = await this.prisma.lead.findUnique({
                where: { uuid: existingByEmail.lead_uuid },
            });
            if (lead) {
                await this.elasticsearchService.indexLead(lead);
            }
            await this.reindexContact(existingByEmail.uuid);
            return;
        }

        await this.prisma.$transaction([
            this.prisma.contact.update({
                where: { uuid: contactUuid },
                data: emailFields,
            }),
            this.prisma.lead.update({
                where: { uuid: contact.lead_uuid },
                data: emailFields,
            }),
        ]);

        const lead = await this.prisma.lead.findUnique({ where: { uuid: contact.lead_uuid } });
        if (lead) {
            await this.elasticsearchService.indexLead(lead);
        }
        await this.reindexContact(contactUuid);
    }

    async findEnrichmentsForContact(
        organisation_uuid: string,
        uuid: string,
        query: ListEnrichmentsDto,
    ) {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.enrichmentQueryService.findForTarget('contact', uuid, query);
    }

    async getUserTags(organisation_uuid: string): Promise<string[]> {
        const rows = await this.prisma.contactTag.findMany({
            where: { contact: { organisation_uuid } },
            distinct: ['tag'],
            select: { tag: true },
            orderBy: { tag: 'asc' },
        });
        return rows.map((r) => r.tag);
    }

    async listMessages(organisation_uuid: string, uuid: string): Promise<OutreachMessage[]> {
        await this.requireOwnedContact(organisation_uuid, uuid);
        return this.prisma.outreachMessage.findMany({
            where: { contact_uuid: uuid },
            orderBy: { created_at: 'desc' },
        });
    }

    private async applyManualCreateExtras(
        organisation_uuid: string,
        contact_uuid: string,
        dto: CreateContactDto,
    ): Promise<void> {
        if (dto.tags && dto.tags.length > 0) {
            const existingTags = await this.prisma.contactTag.findMany({
                where: { contact_uuid },
                select: { tag: true },
            });
            const have = new Set(existingTags.map((t) => t.tag));
            const missing = dto.tags.filter((tag) => !have.has(tag));
            if (missing.length > 0) {
                await this.prisma.contactTag.createMany({
                    data: missing.map((tag) => ({ contact_uuid, tag })),
                    skipDuplicates: true,
                });
            }
        }

        if (dto.notes?.trim()) {
            await this.prisma.interaction.create({
                data: {
                    contact_uuid,
                    organisation_uuid,
                    type: InteractionType.NOTE,
                    content: dto.notes.trim(),
                },
            });
        }
    }

    private async requireOwnedContact(organisation_uuid: string, uuid: string): Promise<Contact> {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!contact) {
            throw new NotFoundException(`Contact ${uuid} not found`);
        }
        return contact;
    }

    private async reindexContact(uuid: string): Promise<void> {
        const fresh = await this.prisma.contact.findUnique({
            where: { uuid },
            include: {
                lead: true,
                tags: true,
                contact_scores: {
                    include: { scoring_instruction: { select: { uuid: true, name: true } } },
                },
            },
        });
        if (fresh) {
            await this.elasticsearchService.indexContact(fresh);
        }
    }
}
