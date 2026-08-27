import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes, randomUUID } from 'crypto';
import {
    BulkJobStatus,
    BulkJobType,
    CampaignStatus,
    OrganisationInviteStatus,
    Prisma,
    ReminderStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BulkJobsService } from '@/modules/bulk-jobs/bulk-jobs.service';
import { MailService } from '@/modules/internal/mail/mail.service';
import { EmailConfig } from '@/shared/config/email/index';
import {
    ORGANISATION_DATA_COPY_QUEUE,
    REMINDER_TRIGGER_QUEUE,
} from '@/core/queues/queues.constants';
import {
    ORGANISATION_COPY_CATEGORY_ORDER,
    OrganisationCopyCategory,
} from '../constants/organisation-copy-category.constants';

const INVITE_EXPIRY_DAYS = 7;
const CONTACT_BATCH_SIZE = 500;

export interface OrganisationDataCopyJobData {
    bulkJobUuid: string;
    sourceOrganisationUuid: string;
    targetOrganisationUuid: string;
    categories: OrganisationCopyCategory[];
    actorUserUuid: string;
}

interface CopyIdMaps {
    senderProfiles: Map<string, string>;
    templates: Map<string, string>;
    filters: Map<string, string>;
    scoringInstructions: Map<string, string>;
    contacts: Map<string, string>;
    lists: Map<string, string>;
    sequences: Map<string, string>;
    memberUsers: Set<string>;
}

function emptyIdMaps(): CopyIdMaps {
    return {
        senderProfiles: new Map(),
        templates: new Map(),
        filters: new Map(),
        scoringInstructions: new Map(),
        contacts: new Map(),
        lists: new Map(),
        sequences: new Map(),
        memberUsers: new Set(),
    };
}

@Injectable()
export class OrganisationDataCopyService {
    private readonly logger = new Logger(OrganisationDataCopyService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly bulkJobsService: BulkJobsService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        @InjectQueue(ORGANISATION_DATA_COPY_QUEUE) private readonly copyQueue: Queue,
        @InjectQueue(REMINDER_TRIGGER_QUEUE) private readonly reminderQueue: Queue,
    ) {}

    async enqueue(input: {
        sourceOrganisationUuid: string;
        targetOrganisationUuid: string;
        categories: OrganisationCopyCategory[];
        actorUserUuid: string;
    }): Promise<{ bulkJobUuid: string }> {
        const sourceOrg = await this.prisma.organisation.findUnique({
            where: { uuid: input.sourceOrganisationUuid },
        });
        if (!sourceOrg) {
            throw new NotFoundException('Source organisation not found');
        }

        const bulkJob = await this.bulkJobsService.create({
            organisation_uuid: input.targetOrganisationUuid,
            created_by_user_uuid: input.actorUserUuid,
            title: `Copy data from ${sourceOrg.name}`,
            type: BulkJobType.ORGANISATION_DATA_COPY,
            status: BulkJobStatus.QUEUED,
            progress_total: input.categories.length,
            queue_name: ORGANISATION_DATA_COPY_QUEUE,
            reference_type: 'organisation',
            reference_uuid: input.targetOrganisationUuid,
            metadata: {
                source_organisation_uuid: input.sourceOrganisationUuid,
                categories: input.categories,
            },
        });

        const jobData: OrganisationDataCopyJobData = {
            bulkJobUuid: bulkJob.uuid,
            sourceOrganisationUuid: input.sourceOrganisationUuid,
            targetOrganisationUuid: input.targetOrganisationUuid,
            categories: input.categories,
            actorUserUuid: input.actorUserUuid,
        };

        const queueJob = await this.copyQueue.add('copy', jobData, {
            jobId: `org-data-copy-${bulkJob.uuid}`,
            attempts: 1,
            removeOnComplete: { age: 86400 },
            removeOnFail: { age: 86400 },
        });

        await this.bulkJobsService.markRunning(bulkJob.uuid, {
            queue_job_id: String(queueJob.id),
        });

        return { bulkJobUuid: bulkJob.uuid };
    }

    async runCopy(data: OrganisationDataCopyJobData): Promise<void> {
        const { bulkJobUuid, sourceOrganisationUuid, targetOrganisationUuid, categories, actorUserUuid } = data;
        const selected = new Set(categories);
        const idMaps = emptyIdMaps();
        const errors: Record<string, string> = {};
        let succeeded = 0;

        for (const category of ORGANISATION_COPY_CATEGORY_ORDER) {
            if (!selected.has(category)) continue;
            try {
                await this.copyCategory(
                    category,
                    sourceOrganisationUuid,
                    targetOrganisationUuid,
                    actorUserUuid,
                    idMaps,
                );
                succeeded++;
                await this.bulkJobsService.incrementProgress(bulkJobUuid);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(
                    `Copy category ${category} failed org=${targetOrganisationUuid}: ${message}`,
                    error instanceof Error ? error.stack : undefined,
                );
                errors[category] = message;
                await this.bulkJobsService.incrementFailure(bulkJobUuid);
            }
        }

        if (succeeded === 0) {
            await this.bulkJobsService.fail(bulkJobUuid, JSON.stringify(errors).slice(0, 4000));
            return;
        }

        const errorSummary = Object.keys(errors).length
            ? `Some categories failed: ${Object.keys(errors).join(', ')}`
            : undefined;
        await this.bulkJobsService.complete(bulkJobUuid, errorSummary ?? null);
    }

    private async copyCategory(
        category: OrganisationCopyCategory,
        sourceOrgUuid: string,
        targetOrgUuid: string,
        actorUserUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        switch (category) {
            case OrganisationCopyCategory.SENDER_PROFILES:
                return this.copySenderProfiles(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.TEMPLATES:
                return this.copyTemplates(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.INTEGRATIONS:
                return this.copyIntegrations(sourceOrgUuid, targetOrgUuid);
            case OrganisationCopyCategory.FILTERS:
                return this.copyFilters(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.CONTACTS:
                return this.copyContacts(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.LISTS:
                return this.copyLists(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.SEQUENCES:
                return this.copySequences(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.CAMPAIGNS:
                return this.copyCampaigns(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.FORMS:
                return this.copyForms(sourceOrgUuid, targetOrgUuid);
            case OrganisationCopyCategory.REMINDERS:
                return this.copyReminders(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.USERS:
                return this.copyUsers(sourceOrgUuid, targetOrgUuid, actorUserUuid, idMaps);
            case OrganisationCopyCategory.GOALS:
                return this.copyGoals(sourceOrgUuid, targetOrgUuid, idMaps);
            case OrganisationCopyCategory.INTEGRATION_GOALS:
                return this.copyIntegrationGoals(sourceOrgUuid, targetOrgUuid);
        }
    }

    private async copySenderProfiles(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const rows = await this.prisma.senderProfile.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        if (!rows.length) return;

        await this.prisma.senderProfile.createMany({
            data: rows.map((r) => {
                const newUuid = randomUUID();
                idMaps.senderProfiles.set(r.uuid, newUuid);
                return {
                    uuid: newUuid,
                    organisation_uuid: targetOrgUuid,
                    name: r.name,
                    company_name: r.company_name,
                    title: r.title,
                    first_name: r.first_name,
                    last_name: r.last_name,
                    email: r.email,
                    phone: r.phone,
                    website: r.website,
                    website_utm: r.website_utm ?? undefined,
                    address: r.address,
                    city: r.city,
                    country: r.country,
                    logo_url: r.logo_url,
                    booking_url: r.booking_url,
                    booking_utm: r.booking_utm ?? undefined,
                    sender_id: r.sender_id,
                    signature: r.signature,
                    business_description: r.business_description,
                    is_default: r.is_default,
                };
            }),
        });
    }

    private async copyTemplates(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const rows = await this.prisma.messageTemplate.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        if (!rows.length) return;

        await this.prisma.messageTemplate.createMany({
            data: rows.map((r) => {
                const newUuid = randomUUID();
                idMaps.templates.set(r.uuid, newUuid);
                return {
                    uuid: newUuid,
                    organisation_uuid: targetOrgUuid,
                    name: r.name,
                    channels: r.channels,
                    email_subject: r.email_subject,
                    email_content: r.email_content,
                    sms_content: r.sms_content,
                    source_campaign_uuid: null,
                    source_message_uuid: null,
                };
            }),
        });
    }

    private async copyIntegrations(sourceOrgUuid: string, targetOrgUuid: string): Promise<void> {
        const integrations = await this.prisma.integration.findMany({
            where: { organisation_uuid: sourceOrgUuid },
            include: { accounts: { include: { domains: true } }, keys: true },
        });
        if (!integrations.length) return;

        for (const integration of integrations) {
            const newIntegrationUuid = randomUUID();
            await this.prisma.integration.create({
                data: {
                    uuid: newIntegrationUuid,
                    organisation_uuid: targetOrgUuid,
                    provider: integration.provider,
                    title: integration.title,
                    default_account: integration.default_account,
                },
            });

            if (integration.keys.length) {
                await this.prisma.integrationKey.createMany({
                    data: integration.keys.map((k) => ({
                        uuid: randomUUID(),
                        integration_uuid: newIntegrationUuid,
                        key_type: k.key_type,
                        account: k.account,
                        secret: k.secret,
                        last4: k.last4,
                    })),
                });
            }

            for (const account of integration.accounts) {
                const newAccountUuid = randomUUID();
                await this.prisma.integrationAccount.create({
                    data: {
                        uuid: newAccountUuid,
                        integration_uuid: newIntegrationUuid,
                        account: account.account,
                        title: account.title,
                        max_messages_per_period: account.max_messages_per_period,
                        max_messages_period_unit: account.max_messages_period_unit,
                    },
                });

                if (account.domains.length) {
                    await this.prisma.integrationAccountDomain.createMany({
                        data: account.domains.map((d) => ({
                            uuid: randomUUID(),
                            integration_account_uuid: newAccountUuid,
                            from_email: d.from_email,
                            from_name: d.from_name,
                            is_default: d.is_default,
                        })),
                    });
                }
            }
        }
    }

    private async copyFilters(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const filters = await this.prisma.filter.findMany({
            where: { organisation_uuid: sourceOrgUuid },
            include: { filter_scoring_instructions: { include: { scoring_instruction: true } } },
        });
        if (!filters.length) return;

        for (const filter of filters) {
            const newFilterUuid = randomUUID();
            idMaps.filters.set(filter.uuid, newFilterUuid);
            await this.prisma.filter.create({
                data: {
                    uuid: newFilterUuid,
                    organisation_uuid: targetOrgUuid,
                    name: filter.name,
                    source_type: filter.source_type,
                    query_config: filter.query_config as Prisma.InputJsonValue,
                    enrichment_sources: filter.enrichment_sources,
                    enabled: filter.enabled,
                    cron_schedule: filter.cron_schedule,
                    channels: filter.channels,
                    outreach_instructions: filter.outreach_instructions,
                },
            });

            for (const link of filter.filter_scoring_instructions) {
                const src = link.scoring_instruction;
                let newInstructionUuid = idMaps.scoringInstructions.get(src.uuid);
                if (!newInstructionUuid) {
                    newInstructionUuid = randomUUID();
                    idMaps.scoringInstructions.set(src.uuid, newInstructionUuid);
                    await this.prisma.scoringInstruction.create({
                        data: {
                            uuid: newInstructionUuid,
                            organisation_uuid: targetOrgUuid,
                            name: src.name,
                            instructions: src.instructions,
                        },
                    });
                }
                await this.prisma.filterScoringInstruction.create({
                    data: {
                        filter_uuid: newFilterUuid,
                        scoring_instruction_uuid: newInstructionUuid,
                    },
                });
            }
        }
    }

    private async copyContacts(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const contacts = await this.prisma.contact.findMany({
            where: { organisation_uuid: sourceOrgUuid },
            include: { tags: true, contact_infos: true },
        });
        if (!contacts.length) return;

        for (let i = 0; i < contacts.length; i += CONTACT_BATCH_SIZE) {
            const chunk = contacts.slice(i, i + CONTACT_BATCH_SIZE);

            await this.prisma.contact.createMany({
                data: chunk.map((c) => {
                    const newUuid = randomUUID();
                    idMaps.contacts.set(c.uuid, newUuid);
                    return {
                        uuid: newUuid,
                        organisation_uuid: targetOrgUuid,
                        lead_uuid: c.lead_uuid,
                        filter_uuid: c.filter_uuid ? (idMaps.filters.get(c.filter_uuid) ?? null) : null,
                        status: c.status,
                        notes: c.notes,
                        name: c.name,
                        email: c.email,
                        phone: c.phone,
                        company: c.company,
                        website: c.website,
                        google_maps_url: c.google_maps_url,
                        linkedin_url: c.linkedin_url,
                        title: c.title,
                        location: c.location,
                        industry: c.industry,
                        description: c.description,
                        enrichment_summary: c.enrichment_summary,
                        enrichment_metadata: c.enrichment_metadata ?? undefined,
                        email_validation_status: c.email_validation_status,
                        email_validation_reason: c.email_validation_reason,
                        email_validated_at: c.email_validated_at,
                        unsubscribed_at: null,
                        unsubscribe_token: null,
                        last_interaction_at: null,
                    };
                }),
                skipDuplicates: true,
            });

            const tagData = chunk.flatMap((c) =>
                c.tags.map((t) => ({ contact_uuid: idMaps.contacts.get(c.uuid)!, tag: t.tag })),
            );
            if (tagData.length) {
                await this.prisma.contactTag.createMany({ data: tagData, skipDuplicates: true });
            }

            const infoData = chunk.flatMap((c) =>
                c.contact_infos.map((info) => ({
                    uuid: randomUUID(),
                    contact_uuid: idMaps.contacts.get(c.uuid)!,
                    type: info.type,
                    value: info.value,
                })),
            );
            if (infoData.length) {
                await this.prisma.contactInfo.createMany({ data: infoData });
            }
        }
    }

    private async copyLists(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const lists = await this.prisma.contactList.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        if (!lists.length) return;

        const remaining = [...lists];
        let guard = 0;
        while (remaining.length > 0 && guard <= lists.length) {
            guard++;
            for (let i = remaining.length - 1; i >= 0; i--) {
                const list = remaining[i];
                if (list.parent_list_uuid && !idMaps.lists.has(list.parent_list_uuid)) {
                    continue;
                }
                const newUuid = randomUUID();
                idMaps.lists.set(list.uuid, newUuid);
                await this.prisma.contactList.create({
                    data: {
                        uuid: newUuid,
                        organisation_uuid: targetOrgUuid,
                        parent_list_uuid: list.parent_list_uuid
                            ? (idMaps.lists.get(list.parent_list_uuid) ?? null)
                            : null,
                        title: list.title,
                        description: list.description,
                    },
                });
                remaining.splice(i, 1);
            }
        }
        // Any list whose parent chain wasn't fully resolved (shouldn't happen for
        // a consistent source org) is copied flat, without its parent link.
        for (const list of remaining) {
            const newUuid = randomUUID();
            idMaps.lists.set(list.uuid, newUuid);
            await this.prisma.contactList.create({
                data: {
                    uuid: newUuid,
                    organisation_uuid: targetOrgUuid,
                    parent_list_uuid: null,
                    title: list.title,
                    description: list.description,
                },
            });
        }

        if (idMaps.contacts.size === 0) return;

        const members = await this.prisma.contactListMember.findMany({
            where: { list_uuid: { in: lists.map((l) => l.uuid) } },
        });
        const memberData = members
            .filter((m) => idMaps.lists.has(m.list_uuid) && idMaps.contacts.has(m.contact_uuid))
            .map((m) => ({
                uuid: randomUUID(),
                list_uuid: idMaps.lists.get(m.list_uuid)!,
                contact_uuid: idMaps.contacts.get(m.contact_uuid)!,
            }));
        if (memberData.length) {
            await this.prisma.contactListMember.createMany({ data: memberData, skipDuplicates: true });
        }
    }

    private async copySequences(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const sequences = await this.prisma.outreachSequence.findMany({
            where: { organisation_uuid: sourceOrgUuid },
            include: { steps: true },
        });
        if (!sequences.length) return;

        for (const seq of sequences) {
            const newSeqUuid = randomUUID();
            idMaps.sequences.set(seq.uuid, newSeqUuid);
            await this.prisma.outreachSequence.create({
                data: {
                    uuid: newSeqUuid,
                    organisation_uuid: targetOrgUuid,
                    name: seq.name,
                    description: seq.description,
                    status: seq.status,
                },
            });

            if (seq.steps.length) {
                await this.prisma.outreachSequenceStep.createMany({
                    data: seq.steps.map((step) => ({
                        uuid: randomUUID(),
                        sequence_uuid: newSeqUuid,
                        order_index: step.order_index,
                        enabled: step.enabled,
                        channel: step.channel,
                        email_subject: step.email_subject,
                        email_content: step.email_content,
                        sms_content: step.sms_content,
                        message_template_uuid: step.message_template_uuid
                            ? (idMaps.templates.get(step.message_template_uuid) ?? null)
                            : null,
                        delay_value: step.delay_value,
                        delay_unit: step.delay_unit,
                        delay_reference: step.delay_reference,
                        send_time: step.send_time,
                    })),
                });
            }
        }
    }

    private async copyCampaigns(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const campaigns = await this.prisma.marketingCampaign.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        if (!campaigns.length) return;

        await this.prisma.marketingCampaign.createMany({
            data: campaigns.map((c) => ({
                uuid: randomUUID(),
                organisation_uuid: targetOrgUuid,
                name: c.name,
                description: c.description,
                status: CampaignStatus.DRAFT,
                campaign_type: c.campaign_type,
                channels: c.channels,
                filters_snapshot: c.filters_snapshot ?? undefined,
                email_subject: c.email_subject,
                email_content: c.email_content,
                sms_content: c.sms_content,
                linkedin_content: c.linkedin_content,
                ai_prompt: c.ai_prompt,
                use_openai_batch: false,
                draft_batch_id: null,
                sender_profile_uuid: c.sender_profile_uuid
                    ? (idMaps.senderProfiles.get(c.sender_profile_uuid) ?? null)
                    : null,
                email_provider_allocations: c.email_provider_allocations ?? undefined,
                sequence_uuid: c.sequence_uuid ? (idMaps.sequences.get(c.sequence_uuid) ?? null) : null,
                scheduled_at: null,
                started_at: null,
                completed_at: null,
                cancelled_at: null,
            })),
        });
    }

    private async copyForms(sourceOrgUuid: string, targetOrgUuid: string): Promise<void> {
        const forms = await this.prisma.form.findMany({
            where: { organisation_uuid: sourceOrgUuid },
            include: { fields: true },
        });
        if (!forms.length) return;

        for (const form of forms) {
            const newFormUuid = randomUUID();
            await this.prisma.form.create({
                data: {
                    uuid: newFormUuid,
                    organisation_uuid: targetOrgUuid,
                    name: form.name,
                    description: form.description,
                },
            });

            if (form.fields.length) {
                await this.prisma.formField.createMany({
                    data: form.fields.map((f) => ({
                        uuid: randomUUID(),
                        form_uuid: newFormUuid,
                        label: f.label,
                        field_type: f.field_type,
                        placeholder: f.placeholder,
                        help_text: f.help_text,
                        required: f.required,
                        default_value: f.default_value,
                        options: f.options ?? undefined,
                        order_index: f.order_index,
                        enabled: f.enabled,
                    })),
                });
            }
        }
    }

    private async copyReminders(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        if (idMaps.contacts.size === 0) return;

        const reminders = await this.prisma.reminder.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        const copyable = reminders.filter((r) => idMaps.contacts.has(r.contact_uuid));
        if (!copyable.length) return;

        const now = new Date();
        for (const reminder of copyable) {
            const newUuid = randomUUID();
            const shouldSchedule = reminder.status === ReminderStatus.PENDING && reminder.remind_at > now;
            const jobId = shouldSchedule ? `reminder-${newUuid}` : null;

            await this.prisma.reminder.create({
                data: {
                    uuid: newUuid,
                    organisation_uuid: targetOrgUuid,
                    contact_uuid: idMaps.contacts.get(reminder.contact_uuid)!,
                    title: reminder.title,
                    notes: reminder.notes,
                    remind_at: reminder.remind_at,
                    status: reminder.status,
                    job_id: jobId,
                },
            });

            if (shouldSchedule && jobId) {
                await this.reminderQueue.add(
                    'trigger',
                    { reminder_uuid: newUuid },
                    {
                        delay: Math.max(0, reminder.remind_at.getTime() - Date.now()),
                        jobId,
                        attempts: 1,
                        removeOnComplete: { age: 86400 },
                        removeOnFail: { age: 86400 },
                    },
                );
            }
        }
    }

    private async copyUsers(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        actorUserUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const members = await this.prisma.organisationMember.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });

        const toCreate = members.filter((m) => m.user_uuid !== actorUserUuid);
        if (toCreate.length) {
            await this.prisma.organisationMember.createMany({
                data: toCreate.map((m) => ({
                    uuid: randomUUID(),
                    organisation_uuid: targetOrgUuid,
                    user_uuid: m.user_uuid,
                    role: m.role,
                })),
                skipDuplicates: true,
            });
        }
        for (const m of members) idMaps.memberUsers.add(m.user_uuid);
        idMaps.memberUsers.add(actorUserUuid);

        const pendingInvitations = await this.prisma.organisationInvitation.findMany({
            where: { organisation_uuid: sourceOrgUuid, status: OrganisationInviteStatus.PENDING },
        });
        if (!pendingInvitations.length) return;

        const targetOrg = await this.prisma.organisation.findUnique({ where: { uuid: targetOrgUuid } });
        if (!targetOrg) return;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

        for (const invite of pendingInvitations) {
            const token = randomBytes(32).toString('hex');
            const created = await this.prisma.organisationInvitation.create({
                data: {
                    organisation_uuid: targetOrgUuid,
                    email: invite.email,
                    role: invite.role,
                    invited_by_user_uuid: actorUserUuid,
                    expires_at: expiresAt,
                    token,
                },
            });

            try {
                await this.sendInvitationEmail(targetOrg.name, created.email, created.token);
            } catch (error) {
                this.logger.warn(
                    `Failed to send copied invite to=${created.email} invitation=${created.uuid}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
    }

    private async copyGoals(
        sourceOrgUuid: string,
        targetOrgUuid: string,
        idMaps: CopyIdMaps,
    ): Promise<void> {
        const goals = await this.prisma.messagingGoal.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        const copyable = goals.filter((g) => idMaps.memberUsers.has(g.user_uuid));
        if (!copyable.length) return;

        await this.prisma.messagingGoal.createMany({
            data: copyable.map((g) => ({
                uuid: randomUUID(),
                organisation_uuid: targetOrgUuid,
                user_uuid: g.user_uuid,
                period: g.period,
                target_count: g.target_count,
                is_active: g.is_active,
            })),
            skipDuplicates: true,
        });
    }

    private async copyIntegrationGoals(sourceOrgUuid: string, targetOrgUuid: string): Promise<void> {
        const rows = await this.prisma.emailSendLimit.findMany({
            where: { organisation_uuid: sourceOrgUuid },
        });
        if (!rows.length) return;

        await this.prisma.emailSendLimit.createMany({
            data: rows.map((r) => ({
                uuid: randomUUID(),
                organisation_uuid: targetOrgUuid,
                provider: r.provider,
                period: r.period,
                max_count: r.max_count,
                is_active: r.is_active,
            })),
            skipDuplicates: true,
        });
    }

    private async sendInvitationEmail(organisationName: string, email: string, token: string): Promise<void> {
        const appUrl = (this.configService.get<string>('APP_URL') || 'http://localhost:5173').replace(
            /^["']|["']$/g,
            '',
        );
        const inviteUrl = `${appUrl}/auth/invite/${token}`;

        await this.mailService.create({
            to: email,
            from: `Leadmind <${EmailConfig.email_addresses.confirmation}>`,
            subject: `Join ${organisationName} on Leadmind`,
            text: `You have been invited to join ${organisationName}. Open this link to accept: ${inviteUrl}`,
            html: `<p>You have been invited to join <strong>${organisationName}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>`,
        });
    }
}
