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
    Channel,
    Contact,
    MsgStatus,
    OutreachSequenceStep,
    Prisma,
    SequenceDelayReference,
    SequenceEnrollment,
    SequenceEnrollmentStatus,
    SequenceStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OUTREACH_SEND_QUEUE } from '@/core/queues/queues.constants';
import { hasUsableContactEmail } from '@/shared/utils/contact-email.util';
import { addDelay } from '@/shared/utils/sequence-delay.util';

interface ScheduledStep {
    step: OutreachSequenceStep;
    scheduled_at: Date;
}

const BULK_ENROLL_CHUNK_SIZE = 200;

@Injectable()
export class SequenceEnrollmentService {
    private readonly logger = new Logger(SequenceEnrollmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(OUTREACH_SEND_QUEUE)
        private readonly outreachSendQueue: Queue,
    ) {}

    async enrollContact(
        organisation_uuid: string,
        sequence_uuid: string,
        contact_uuid: string,
        sent_by_user_uuid?: string,
        campaign_uuid?: string,
    ): Promise<SequenceEnrollment> {
        const sequence = await this.requireActiveSequence(
            organisation_uuid,
            sequence_uuid,
        );
        const contact = await this.requireOwnedContact(
            organisation_uuid,
            contact_uuid,
        );

        if (!campaign_uuid) {
            const duplicate = await this.prisma.sequenceEnrollment.findFirst({
                where: {
                    sequence_uuid,
                    contact_uuid,
                    campaign_uuid: null,
                    status: SequenceEnrollmentStatus.ACTIVE,
                },
            });
            if (duplicate) {
                throw new ConflictException(
                    'Contact is already actively enrolled in this sequence',
                );
            }
        }

        const enrolled_at = new Date();
        const scheduledSteps = this.computeSchedule(
            sequence.steps,
            enrolled_at,
        );
        if (scheduledSteps.length === 0) {
            throw new BadRequestException('Sequence has no enabled steps');
        }

        const enrollment = await this.prisma.$transaction(async (tx) => {
            const created = await tx.sequenceEnrollment.create({
                data: {
                    sequence_uuid,
                    contact_uuid,
                    campaign_uuid: campaign_uuid ?? null,
                    status: SequenceEnrollmentStatus.ACTIVE,
                    enrolled_at,
                },
            });

            for (const { step, scheduled_at } of scheduledSteps) {
                if (!this.contactCanReceiveChannel(contact, step.channel)) {
                    this.logger.warn(
                        `Skipping sequence step message: contact=${contact_uuid} channel=${step.channel} step=${step.uuid} enrollment=${created.uuid}`,
                    );
                    continue;
                }
                await tx.outreachMessage.create({
                    data: {
                        organisation_uuid,
                        contact_uuid,
                        sent_by_user_uuid: sent_by_user_uuid ?? null,
                        campaign_uuid: campaign_uuid ?? null,
                        channel: step.channel,
                        subject:
                            step.channel === Channel.EMAIL
                                ? step.email_subject
                                : null,
                        content:
                            step.channel === Channel.EMAIL
                                ? (step.email_content ?? '')
                                : (step.sms_content ?? ''),
                        status: MsgStatus.PENDING,
                        scheduled_at,
                        sequence_enrollment_uuid: created.uuid,
                        sequence_step_uuid: step.uuid,
                    },
                });
            }

            return created;
        });

        const messages = await this.prisma.outreachMessage.findMany({
            where: { sequence_enrollment_uuid: enrollment.uuid },
            select: { uuid: true, scheduled_at: true },
        });
        for (const message of messages) {
            await this.enqueueMessage(
                message.uuid,
                message.scheduled_at ?? undefined,
            );
        }

        return enrollment;
    }

    async bulkEnroll(
        organisation_uuid: string,
        sequence_uuid: string,
        contact_uuids: string[],
        campaign_uuid: string,
    ): Promise<{ enrolled: number; skipped: number; totalMessages: number }> {
        let enrolled = 0;
        let skipped = 0;
        let totalMessages = 0;

        for (let i = 0; i < contact_uuids.length; i += BULK_ENROLL_CHUNK_SIZE) {
            const chunk = contact_uuids.slice(i, i + BULK_ENROLL_CHUNK_SIZE);
            for (const contact_uuid of chunk) {
                try {
                    const enrollment = await this.enrollContact(
                        organisation_uuid,
                        sequence_uuid,
                        contact_uuid,
                        // Campaign-driven enrollments have no acting user; messages are unattributed.
                        undefined,
                        campaign_uuid,
                    );
                    enrolled += 1;
                    const count = await this.prisma.outreachMessage.count({
                        where: { sequence_enrollment_uuid: enrollment.uuid },
                    });
                    totalMessages += count;
                } catch (error) {
                    if (
                        error instanceof Prisma.PrismaClientKnownRequestError &&
                        error.code === 'P2002'
                    ) {
                        skipped += 1;
                        continue;
                    }
                    this.logger.warn(
                        `bulkEnroll failed for contact=${contact_uuid} sequence=${sequence_uuid}: ${error instanceof Error ? error.message : error}`,
                    );
                    skipped += 1;
                }
            }
        }

        return { enrolled, skipped, totalMessages };
    }

    async cancelEnrollment(
        organisation_uuid: string,
        enrollment_uuid: string,
    ): Promise<SequenceEnrollment> {
        const enrollment = await this.prisma.sequenceEnrollment.findFirst({
            where: { uuid: enrollment_uuid, sequence: { organisation_uuid } },
        });
        if (!enrollment) {
            throw new NotFoundException(
                `Sequence enrollment ${enrollment_uuid} not found`,
            );
        }
        if (enrollment.status !== SequenceEnrollmentStatus.ACTIVE) {
            return enrollment;
        }

        const pendingMessages = await this.prisma.outreachMessage.findMany({
            where: {
                sequence_enrollment_uuid: enrollment.uuid,
                status: MsgStatus.PENDING,
            },
            select: { uuid: true },
        });

        for (const message of pendingMessages) {
            await this.removeQueuedJob(message.uuid);
        }

        await this.prisma.$transaction([
            this.prisma.outreachMessage.updateMany({
                where: { uuid: { in: pendingMessages.map((m) => m.uuid) } },
                data: { status: MsgStatus.SKIPPED },
            }),
            this.prisma.sequenceEnrollment.update({
                where: { uuid: enrollment.uuid },
                data: {
                    status: SequenceEnrollmentStatus.CANCELLED,
                    cancelled_at: new Date(),
                },
            }),
            ...(enrollment.campaign_uuid && pendingMessages.length > 0
                ? [
                      this.prisma.marketingCampaign.update({
                          where: { uuid: enrollment.campaign_uuid },
                          data: {
                              skipped_count: {
                                  increment: pendingMessages.length,
                              },
                          },
                      }),
                  ]
                : []),
        ]);

        return this.prisma.sequenceEnrollment.findUniqueOrThrow({
            where: { uuid: enrollment.uuid },
        });
    }

    async cancelAllForCampaign(
        organisation_uuid: string,
        campaign_uuid: string,
    ): Promise<{ cancelled: number }> {
        const enrollments = await this.prisma.sequenceEnrollment.findMany({
            where: {
                campaign_uuid,
                status: SequenceEnrollmentStatus.ACTIVE,
                sequence: { organisation_uuid },
            },
            select: { uuid: true },
        });
        for (const enrollment of enrollments) {
            await this.cancelEnrollment(organisation_uuid, enrollment.uuid);
        }
        return { cancelled: enrollments.length };
    }

    async listEnrollments(
        organisation_uuid: string,
        sequence_uuid: string,
        page = 1,
        limit = 20,
    ) {
        await this.requireOwnedSequence(organisation_uuid, sequence_uuid);
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.sequenceEnrollment.findMany({
                where: { sequence_uuid },
                include: {
                    contact: {
                        select: {
                            uuid: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                },
                orderBy: { enrolled_at: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.sequenceEnrollment.count({ where: { sequence_uuid } }),
        ]);
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    private computeSchedule(
        steps: OutreachSequenceStep[],
        enrolled_at: Date,
    ): ScheduledStep[] {
        const enabledSteps = [...steps]
            .filter((step) => step.enabled)
            .sort((a, b) => a.order_index - b.order_index);

        const scheduled: ScheduledStep[] = [];
        let firstScheduledAt: Date | null = null;
        let previousScheduledAt: Date | null = null;

        for (const step of enabledSteps) {
            const base =
                previousScheduledAt === null
                    ? enrolled_at
                    : step.delay_reference ===
                            SequenceDelayReference.FIRST_STEP &&
                        firstScheduledAt
                      ? firstScheduledAt
                      : previousScheduledAt;
            const scheduled_at = addDelay(
                base,
                step.delay_value,
                step.delay_unit,
            );
            scheduled.push({ step, scheduled_at });
            if (!firstScheduledAt) firstScheduledAt = scheduled_at;
            previousScheduledAt = scheduled_at;
        }

        return scheduled;
    }

    private contactCanReceiveChannel(
        contact: Contact,
        channel: Channel,
    ): boolean {
        if (channel === Channel.EMAIL)
            return hasUsableContactEmail(contact.email);
        if (channel === Channel.SMS) return Boolean(contact.phone?.trim());
        return true;
    }

    private async requireActiveSequence(
        organisation_uuid: string,
        sequence_uuid: string,
    ) {
        const sequence = await this.prisma.outreachSequence.findFirst({
            where: { uuid: sequence_uuid, organisation_uuid },
            include: { steps: true },
        });
        if (!sequence)
            throw new NotFoundException(`Sequence ${sequence_uuid} not found`);
        if (sequence.status !== SequenceStatus.ACTIVE) {
            throw new ConflictException(
                'Sequence must be ACTIVE to enroll contacts',
            );
        }
        return sequence;
    }

    private async requireOwnedSequence(
        organisation_uuid: string,
        sequence_uuid: string,
    ) {
        const sequence = await this.prisma.outreachSequence.findFirst({
            where: { uuid: sequence_uuid, organisation_uuid },
            select: { uuid: true },
        });
        if (!sequence)
            throw new NotFoundException(`Sequence ${sequence_uuid} not found`);
        return sequence;
    }

    private async requireOwnedContact(
        organisation_uuid: string,
        contact_uuid: string,
    ): Promise<Contact> {
        const contact = await this.prisma.contact.findFirst({
            where: { uuid: contact_uuid, organisation_uuid },
        });
        if (!contact)
            throw new NotFoundException(`Contact ${contact_uuid} not found`);
        return contact;
    }

    private async removeQueuedJob(message_uuid: string): Promise<void> {
        try {
            const job = await this.outreachSendQueue.getJob(message_uuid);
            if (!job) return;
            const state = await job.getState();
            if (state === 'active') {
                this.logger.warn(
                    `Not removing active outreach job message=${message_uuid}`,
                );
                return;
            }
            await job.remove();
        } catch (error) {
            this.logger.warn(
                `Failed removing outreach job message=${message_uuid}: ${error instanceof Error ? error.message : error}`,
            );
        }
    }

    private async enqueueMessage(message_uuid: string, scheduled_at?: Date) {
        await this.removeQueuedJob(message_uuid);
        const delay = scheduled_at
            ? Math.max(0, scheduled_at.getTime() - Date.now())
            : 0;
        const job = await this.outreachSendQueue.add(
            `outreach-send:${message_uuid}`,
            { message_uuid },
            {
                delay,
                jobId: message_uuid,
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        );
        this.logger.log(
            `Sequence step message queued message=${message_uuid} jobId=${job.id} delayMs=${delay}`,
        );
        return job;
    }
}
