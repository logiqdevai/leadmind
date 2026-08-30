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
import { resolveStepScheduledAt } from '@/shared/utils/sequence-delay.util';

const BULK_ENROLL_CHUNK_SIZE = 200;

interface EnrollmentRef {
  uuid: string;
  contact_uuid: string;
  campaign_uuid: string | null;
  organisation_uuid: string;
}

@Injectable()
export class SequenceEnrollmentService {
  private readonly logger = new Logger(SequenceEnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OUTREACH_SEND_QUEUE)
    private readonly outreachSendQueue: Queue,
  ) {}

  /**
   * Enrolls a contact and materializes ONLY the first deliverable step's message
   * (lazily - see advanceEnrollment for how later steps get created). This keeps
   * step gaps correct relative to when steps actually send rather than an idealized
   * upfront schedule, which matters once campaign-linked enrollments are paced by
   * a CampaignIntegration (a paced send can land later than an eagerly-precomputed
   * "scheduled_at" would have assumed).
   */
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

    const enabledSteps = this.sortEnabledSteps(sequence.steps);
    if (enabledSteps.length === 0) {
      throw new BadRequestException('Sequence has no enabled steps');
    }

    const enrolled_at = new Date();
    // Campaign-linked enrollments bypass the first step's own delay/time entirely -
    // the campaign's actual dispatch moment (== enrolled_at here) is the send time.
    const firstStepAt = campaign_uuid
      ? enrolled_at
      : resolveStepScheduledAt(
          enrolled_at,
          enabledSteps[0].delay_value,
          enabledSteps[0].delay_unit,
          enabledSteps[0].send_time,
        );

    const { enrollment, materializedIndex } = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.sequenceEnrollment.create({
          data: {
            sequence_uuid,
            contact_uuid,
            campaign_uuid: campaign_uuid ?? null,
            status: SequenceEnrollmentStatus.ACTIVE,
            enrolled_at,
            first_step_sent_at: firstStepAt,
          },
        });

        const ref: EnrollmentRef = {
          uuid: created.uuid,
          contact_uuid,
          campaign_uuid: campaign_uuid ?? null,
          organisation_uuid,
        };
        const materializedIndex = await this.materializeFromIndex(
          tx,
          ref,
          contact,
          enabledSteps,
          0,
          enrolled_at,
          firstStepAt,
        );

        if (materializedIndex === -1) {
          await tx.sequenceEnrollment.update({
            where: { uuid: created.uuid },
            data: {
              status: SequenceEnrollmentStatus.COMPLETED,
              completed_at: new Date(),
            },
          });
        }

        return { enrollment: created, materializedIndex };
      },
    );

    if (materializedIndex >= 0 && !campaign_uuid) {
      // Standalone (non-campaign) enrollments have no CampaignIntegration pacing -
      // keep sending them immediately via the existing delayed BullMQ job.
      await this.enqueueMaterializedStep(
        enrollment.uuid,
        enabledSteps[materializedIndex].uuid,
      );
    }
    // Campaign-linked enrollments: message stays PENDING for the sending-engine tick.

    void sent_by_user_uuid; // retained in signature for API compatibility / future attribution

    return enrollment;
  }

  /**
   * Called once a sequence-step message reaches a terminal state (SENT or FAILED -
   * a failed step does not halt the enrollment, matching prior behavior). Materializes
   * the next deliverable step, if any, computing its scheduled_at from the ACTUAL
   * completion time rather than an idealized upfront estimate.
   */
  async advanceEnrollment(
    enrollment_uuid: string,
    completed_step_uuid: string,
    completed_at: Date = new Date(),
  ): Promise<void> {
    const enrollment = await this.prisma.sequenceEnrollment.findUnique({
      where: { uuid: enrollment_uuid },
    });
    if (!enrollment || enrollment.status !== SequenceEnrollmentStatus.ACTIVE) {
      return;
    }

    const sequence = await this.prisma.outreachSequence.findUnique({
      where: { uuid: enrollment.sequence_uuid },
      include: { steps: true },
    });
    if (!sequence) return;

    const enabledSteps = this.sortEnabledSteps(sequence.steps);
    const completedIndex = enabledSteps.findIndex(
      (step) => step.uuid === completed_step_uuid,
    );
    if (completedIndex === -1) return;

    const contact = await this.prisma.contact.findUnique({
      where: { uuid: enrollment.contact_uuid },
    });
    if (!contact) return;

    const firstStepAt = enrollment.first_step_sent_at ?? completed_at;
    const ref: EnrollmentRef = {
      uuid: enrollment.uuid,
      contact_uuid: enrollment.contact_uuid,
      campaign_uuid: enrollment.campaign_uuid,
      organisation_uuid: contact.organisation_uuid,
    };

    const materializedIndex = await this.prisma.$transaction((tx) =>
      this.materializeFromIndex(
        tx,
        ref,
        contact,
        enabledSteps,
        completedIndex + 1,
        completed_at,
        firstStepAt,
      ),
    );

    if (materializedIndex === -1) {
      await this.prisma.sequenceEnrollment.update({
        where: { uuid: enrollment.uuid },
        data: {
          status: SequenceEnrollmentStatus.COMPLETED,
          completed_at: new Date(),
        },
      });
      return;
    }

    if (!enrollment.campaign_uuid) {
      await this.enqueueMaterializedStep(
        enrollment.uuid,
        enabledSteps[materializedIndex].uuid,
      );
    }
  }

  async bulkEnroll(
    organisation_uuid: string,
    sequence_uuid: string,
    contact_uuids: string[],
    campaign_uuid?: string,
    sent_by_user_uuid?: string,
  ): Promise<{
    enrolled: number;
    skipped: number;
    enabled_step_count: number;
  }> {
    const sequence = await this.requireActiveSequence(
      organisation_uuid,
      sequence_uuid,
    );
    const enabled_step_count = this.sortEnabledSteps(sequence.steps).length;

    let enrolled = 0;
    let skipped = 0;

    for (let i = 0; i < contact_uuids.length; i += BULK_ENROLL_CHUNK_SIZE) {
      const chunk = contact_uuids.slice(i, i + BULK_ENROLL_CHUNK_SIZE);
      for (const contact_uuid of chunk) {
        try {
          await this.enrollContact(
            organisation_uuid,
            sequence_uuid,
            contact_uuid,
            // Campaign-driven bulk enrollments have no acting user; direct bulk enrolls attribute to the caller.
            sent_by_user_uuid,
            campaign_uuid,
          );
          enrolled += 1;
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

    return { enrolled, skipped, enabled_step_count };
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

    // Steps beyond the in-flight one were never materialized at all - back-fill
    // skipped_count for those too so the campaign's static total_messages bound
    // (enrolled * enabled_step_count) still resolves via checkCompletion.
    let neverMaterializedCount = 0;
    if (enrollment.campaign_uuid) {
      const sequence = await this.prisma.outreachSequence.findUnique({
        where: { uuid: enrollment.sequence_uuid },
        include: { steps: true },
      });
      if (sequence) {
        const enabledSteps = this.sortEnabledSteps(sequence.steps);
        const position = enabledSteps.findIndex(
          (step) => step.order_index === enrollment.current_step_order_index,
        );
        if (position >= 0) {
          neverMaterializedCount = enabledSteps.length - (position + 1);
        }
      }
    }

    const totalSkipped = pendingMessages.length + neverMaterializedCount;

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
      ...(enrollment.campaign_uuid && totalSkipped > 0
        ? [
            this.prisma.marketingCampaign.update({
              where: { uuid: enrollment.campaign_uuid },
              data: {
                skipped_count: {
                  increment: totalSkipped,
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

  /**
   * Cancels every ACTIVE enrollment a contact currently has, across all sequences -
   * used when a contact opts out entirely (unsubscribe / spam complaint), as opposed
   * to cancelEnrollment's single-enrollment scope.
   */
  async cancelAllForContact(
    organisation_uuid: string,
    contact_uuid: string,
  ): Promise<{ cancelled: number }> {
    const enrollments = await this.prisma.sequenceEnrollment.findMany({
      where: {
        contact_uuid,
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

  /**
   * Walks enabledSteps from startIndex, creating the message for the first step the
   * contact can receive. Steps skipped for channel mismatch don't get a message row
   * (they never happened) but still advance the PREVIOUS_STEP delay anchor, matching
   * the schedule a fully-eager computation would have produced, and - when campaign-
   * linked - increment skipped_count so the campaign's static total_messages bound
   * still balances out. Returns the materialized step's index, or -1 if none of the
   * remaining steps are deliverable to this contact (enrollment is then COMPLETED).
   */
  private async materializeFromIndex(
    tx: Prisma.TransactionClient,
    enrollment: EnrollmentRef,
    contact: Contact,
    enabledSteps: OutreachSequenceStep[],
    startIndex: number,
    previousStepAt: Date,
    firstStepAt: Date,
  ): Promise<number> {
    let prevAt = previousStepAt;

    for (let i = startIndex; i < enabledSteps.length; i++) {
      const step = enabledSteps[i];
      // Step 0 is never re-derived from its own delay/time here - firstStepAt is
      // already the fully-resolved value (bypassed for campaigns, time-pinned
      // otherwise) computed by the caller. Re-deriving it via delay_reference/
      // addDelay would silently undo the campaign bypass and double-apply the
      // delay when delay_reference is (degenerately) FIRST_STEP on step 0 itself.
      const scheduled_at =
        i === 0
          ? firstStepAt
          : resolveStepScheduledAt(
              step.delay_reference === SequenceDelayReference.FIRST_STEP
                ? firstStepAt
                : prevAt,
              step.delay_value,
              step.delay_unit,
              step.send_time,
            );

      if (this.contactCanReceiveChannel(contact, step.channel)) {
        await tx.outreachMessage.create({
          data: {
            organisation_uuid: enrollment.organisation_uuid,
            contact_uuid: enrollment.contact_uuid,
            campaign_uuid: enrollment.campaign_uuid,
            channel: step.channel,
            subject: step.channel === Channel.EMAIL ? step.email_subject : null,
            content:
              step.channel === Channel.EMAIL
                ? (step.email_content ?? '')
                : (step.sms_content ?? ''),
            status: MsgStatus.PENDING,
            scheduled_at,
            sequence_enrollment_uuid: enrollment.uuid,
            sequence_step_uuid: step.uuid,
          },
        });
        await tx.sequenceEnrollment.update({
          where: { uuid: enrollment.uuid },
          data: { current_step_order_index: step.order_index },
        });
        return i;
      }

      this.logger.warn(
        `Skipping sequence step message: contact=${enrollment.contact_uuid} channel=${step.channel} step=${step.uuid} enrollment=${enrollment.uuid}`,
      );
      if (enrollment.campaign_uuid) {
        await tx.marketingCampaign.update({
          where: { uuid: enrollment.campaign_uuid },
          data: { skipped_count: { increment: 1 } },
        });
      }
      prevAt = scheduled_at;
    }

    return -1;
  }

  private async enqueueMaterializedStep(
    enrollment_uuid: string,
    step_uuid: string,
  ): Promise<void> {
    const message = await this.prisma.outreachMessage.findFirst({
      where: {
        sequence_enrollment_uuid: enrollment_uuid,
        sequence_step_uuid: step_uuid,
      },
      select: { uuid: true, scheduled_at: true },
    });
    if (message) {
      await this.enqueueMessage(
        message.uuid,
        message.scheduled_at ?? undefined,
      );
    }
  }

  private sortEnabledSteps(
    steps: OutreachSequenceStep[],
  ): OutreachSequenceStep[] {
    return [...steps]
      .filter((step) => step.enabled)
      .sort((a, b) => a.order_index - b.order_index);
  }

  private contactCanReceiveChannel(
    contact: Contact,
    channel: Channel,
  ): boolean {
    if (channel === Channel.EMAIL) return hasUsableContactEmail(contact.email);
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
      throw new ConflictException('Sequence must be ACTIVE to enroll contacts');
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
