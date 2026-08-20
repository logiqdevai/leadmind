import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    Channel,
    CampaignStatus,
    OutreachSequence,
    OutreachSequenceStep,
    SequenceEnrollmentStatus,
    SequenceStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
    isEmailHtmlEmpty,
    sanitizeEmailHtml,
} from '@/shared/utils/sanitize-html.util';
import { CreateSequenceDto } from '../dto/create-sequence.dto';
import { UpdateSequenceDto } from '../dto/update-sequence.dto';
import { CreateSequenceStepDto } from '../dto/create-sequence-step.dto';
import { UpdateSequenceStepDto } from '../dto/update-sequence-step.dto';
import { ReorderSequenceStepsDto } from '../dto/reorder-sequence-steps.dto';
import { ListSequencesDto } from '../dto/list-sequences.dto';

function normalizeStepContent(
    channel: Channel | undefined,
    email_subject: string | null | undefined,
    email_content: string | null | undefined,
    sms_content: string | null | undefined,
): {
    email_subject: string | null;
    email_content: string | null;
    sms_content: string | null;
} {
    const emailSubject = email_subject?.trim() || null;
    const emailContent =
        email_content && !isEmailHtmlEmpty(email_content)
            ? sanitizeEmailHtml(email_content)
            : null;
    const smsContent = sms_content?.trim() || null;

    if (channel === Channel.EMAIL && !emailContent) {
        throw new BadRequestException(
            'Email content is required for an EMAIL step',
        );
    }
    if (channel === Channel.SMS && !smsContent) {
        throw new BadRequestException(
            'SMS content is required for an SMS step',
        );
    }

    return {
        email_subject: emailSubject,
        email_content: emailContent,
        sms_content: smsContent,
    };
}

@Injectable()
export class SequencesService {
    constructor(private readonly prisma: PrismaService) {}

    async create(
        organisation_uuid: string,
        dto: CreateSequenceDto,
    ): Promise<OutreachSequence> {
        return this.prisma.outreachSequence.create({
            data: {
                organisation_uuid,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                status: SequenceStatus.DRAFT,
            },
        });
    }

    async findAll(organisation_uuid: string, filters: ListSequencesDto) {
        return this.prisma.outreachSequence.findMany({
            where: {
                organisation_uuid,
                ...(filters.status && { status: filters.status }),
            },
            include: { steps: { orderBy: { order_index: 'asc' } } },
            orderBy: { created_at: 'desc' },
        });
    }

    async findOne(organisation_uuid: string, uuid: string) {
        const sequence = await this.prisma.outreachSequence.findFirst({
            where: { uuid, organisation_uuid },
            include: { steps: { orderBy: { order_index: 'asc' } } },
        });
        if (!sequence)
            throw new NotFoundException(`Sequence ${uuid} not found`);
        return sequence;
    }

    async update(
        organisation_uuid: string,
        uuid: string,
        dto: UpdateSequenceDto,
    ): Promise<OutreachSequence> {
        await this.requireOwned(organisation_uuid, uuid);
        return this.prisma.outreachSequence.update({
            where: { uuid },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
                ...(dto.description !== undefined && {
                    description: dto.description?.trim() || null,
                }),
            },
        });
    }

    async activate(
        organisation_uuid: string,
        uuid: string,
    ): Promise<OutreachSequence> {
        const sequence = await this.findOne(organisation_uuid, uuid);
        if (sequence.status === SequenceStatus.ARCHIVED) {
            throw new ConflictException(
                'Archived sequences cannot be activated; create a new one instead',
            );
        }
        const enabledSteps = sequence.steps.filter((step) => step.enabled);
        if (enabledSteps.length === 0) {
            throw new BadRequestException(
                'Sequence must have at least one enabled step to activate',
            );
        }
        return this.prisma.outreachSequence.update({
            where: { uuid },
            data: { status: SequenceStatus.ACTIVE },
        });
    }

    async archive(
        organisation_uuid: string,
        uuid: string,
    ): Promise<OutreachSequence> {
        await this.requireOwned(organisation_uuid, uuid);
        await this.assertNoBlockingCampaigns(uuid);
        return this.prisma.outreachSequence.update({
            where: { uuid },
            data: { status: SequenceStatus.ARCHIVED },
        });
    }

    async remove(
        organisation_uuid: string,
        uuid: string,
    ): Promise<{ uuid: string }> {
        const sequence = await this.requireOwned(organisation_uuid, uuid);
        if (sequence.status === SequenceStatus.ACTIVE) {
            throw new ConflictException(
                'Archive an active sequence before deleting it',
            );
        }
        const activeEnrollments = await this.prisma.sequenceEnrollment.count({
            where: {
                sequence_uuid: uuid,
                status: SequenceEnrollmentStatus.ACTIVE,
            },
        });
        if (activeEnrollments > 0) {
            throw new ConflictException(
                'Sequence has active enrollments and cannot be deleted',
            );
        }
        await this.assertNoBlockingCampaigns(uuid);
        await this.prisma.outreachSequence.delete({ where: { uuid } });
        return { uuid };
    }

    async addStep(
        organisation_uuid: string,
        sequence_uuid: string,
        dto: CreateSequenceStepDto,
    ): Promise<OutreachSequenceStep> {
        await this.requireOwned(organisation_uuid, sequence_uuid);
        const { email_subject, email_content, sms_content } =
            normalizeStepContent(
                dto.channel,
                dto.email_subject,
                dto.email_content,
                dto.sms_content,
            );
        if (dto.message_template_uuid) {
            await this.assertOwnedTemplate(
                organisation_uuid,
                dto.message_template_uuid,
            );
        }

        const last = await this.prisma.outreachSequenceStep.findFirst({
            where: { sequence_uuid },
            orderBy: { order_index: 'desc' },
            select: { order_index: true },
        });

        return this.prisma.outreachSequenceStep.create({
            data: {
                sequence_uuid,
                order_index: (last?.order_index ?? -1) + 1,
                enabled: dto.enabled ?? true,
                channel: dto.channel,
                email_subject,
                email_content,
                sms_content,
                message_template_uuid: dto.message_template_uuid ?? null,
                delay_value: dto.delay_value,
                delay_unit: dto.delay_unit,
                delay_reference: dto.delay_reference,
            },
        });
    }

    async updateStep(
        organisation_uuid: string,
        sequence_uuid: string,
        step_uuid: string,
        dto: UpdateSequenceStepDto,
    ): Promise<OutreachSequenceStep> {
        await this.requireOwned(organisation_uuid, sequence_uuid);
        const existing = await this.requireOwnedStep(sequence_uuid, step_uuid);

        const channel = dto.channel ?? existing.channel;
        const { email_subject, email_content, sms_content } =
            normalizeStepContent(
                channel,
                dto.email_subject !== undefined
                    ? dto.email_subject
                    : existing.email_subject,
                dto.email_content !== undefined
                    ? dto.email_content
                    : existing.email_content,
                dto.sms_content !== undefined
                    ? dto.sms_content
                    : existing.sms_content,
            );
        if (dto.message_template_uuid) {
            await this.assertOwnedTemplate(
                organisation_uuid,
                dto.message_template_uuid,
            );
        }

        return this.prisma.outreachSequenceStep.update({
            where: { uuid: step_uuid },
            data: {
                ...(dto.channel !== undefined && { channel: dto.channel }),
                email_subject,
                email_content,
                sms_content,
                ...(dto.message_template_uuid !== undefined && {
                    message_template_uuid: dto.message_template_uuid ?? null,
                }),
                ...(dto.delay_value !== undefined && {
                    delay_value: dto.delay_value,
                }),
                ...(dto.delay_unit !== undefined && {
                    delay_unit: dto.delay_unit,
                }),
                ...(dto.delay_reference !== undefined && {
                    delay_reference: dto.delay_reference,
                }),
                ...(dto.enabled !== undefined && { enabled: dto.enabled }),
            },
        });
    }

    async removeStep(
        organisation_uuid: string,
        sequence_uuid: string,
        step_uuid: string,
    ): Promise<{ uuid: string }> {
        const sequence = await this.requireOwned(
            organisation_uuid,
            sequence_uuid,
        );
        await this.requireOwnedStep(sequence_uuid, step_uuid);
        if (sequence.status !== SequenceStatus.DRAFT) {
            throw new ConflictException(
                'Steps can only be deleted while the sequence is a draft; disable the step instead',
            );
        }
        await this.prisma.outreachSequenceStep.delete({
            where: { uuid: step_uuid },
        });
        return { uuid: step_uuid };
    }

    async reorderSteps(
        organisation_uuid: string,
        sequence_uuid: string,
        dto: ReorderSequenceStepsDto,
    ): Promise<OutreachSequenceStep[]> {
        await this.requireOwned(organisation_uuid, sequence_uuid);
        const steps = await this.prisma.outreachSequenceStep.findMany({
            where: { sequence_uuid },
            select: { uuid: true },
        });
        const existingUuids = new Set(steps.map((step) => step.uuid));
        const submittedUuids = new Set(dto.step_uuids);
        if (
            existingUuids.size !== submittedUuids.size ||
            [...existingUuids].some((uuid) => !submittedUuids.has(uuid))
        ) {
            throw new BadRequestException(
                "step_uuids must contain exactly the sequence's current steps",
            );
        }

        await this.prisma.$transaction(
            dto.step_uuids.map((uuid, index) =>
                this.prisma.outreachSequenceStep.update({
                    where: { uuid },
                    data: { order_index: index },
                }),
            ),
        );

        return this.prisma.outreachSequenceStep.findMany({
            where: { sequence_uuid },
            orderBy: { order_index: 'asc' },
        });
    }

    private async requireOwned(
        organisation_uuid: string,
        uuid: string,
    ): Promise<OutreachSequence> {
        const sequence = await this.prisma.outreachSequence.findFirst({
            where: { uuid, organisation_uuid },
        });
        if (!sequence)
            throw new NotFoundException(`Sequence ${uuid} not found`);
        return sequence;
    }

    private async requireOwnedStep(
        sequence_uuid: string,
        step_uuid: string,
    ): Promise<OutreachSequenceStep> {
        const step = await this.prisma.outreachSequenceStep.findFirst({
            where: { uuid: step_uuid, sequence_uuid },
        });
        if (!step)
            throw new NotFoundException(`Sequence step ${step_uuid} not found`);
        return step;
    }

    private async assertOwnedTemplate(
        organisation_uuid: string,
        uuid: string,
    ): Promise<void> {
        const template = await this.prisma.messageTemplate.findFirst({
            where: { uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!template)
            throw new NotFoundException(`Message template ${uuid} not found`);
    }

    private async assertNoBlockingCampaigns(
        sequence_uuid: string,
    ): Promise<void> {
        const blocking = await this.prisma.marketingCampaign.count({
            where: {
                sequence_uuid,
                status: {
                    notIn: [
                        CampaignStatus.DRAFT,
                        CampaignStatus.CANCELLED,
                        CampaignStatus.COMPLETED,
                        CampaignStatus.FAILED,
                    ],
                },
            },
        });
        if (blocking > 0) {
            throw new ConflictException(
                'Sequence is in use by an active campaign',
            );
        }
    }
}
