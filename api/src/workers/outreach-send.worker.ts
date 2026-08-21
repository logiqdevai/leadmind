import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  Channel,
  InteractionType,
  LeadStatus,
  MsgStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OUTREACH_SEND_QUEUE } from '@/core/queues/queues.constants';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { MessageSendService } from '@/modules/outreach/services/message-send.service';
import { MessagingGoalsService } from '@/modules/messaging-goals/messaging-goals.service';
import { CampaignMessageSendService } from '@/modules/marketing-campaigns/services/campaign-message-send.service';
import { SequenceEnrollmentService } from '@/modules/sequences/services/sequence-enrollment.service';
import { SendingCapacityService } from '@/modules/sending-capacity/services/sending-capacity.service';
import { hasUsableContactEmail } from '@/shared/utils/contact-email.util';

interface OutreachSendJobData {
  message_uuid: string;
}

@Processor(OUTREACH_SEND_QUEUE, { concurrency: 10 })
export class OutreachSendWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OutreachSendWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageSendService: MessageSendService,
    private readonly contactsService: ContactsService,
    private readonly messagingGoalsService: MessagingGoalsService,
    private readonly campaignMessageSendService: CampaignMessageSendService,
    private readonly sequenceEnrollmentService: SequenceEnrollmentService,
    private readonly sendingCapacityService: SendingCapacityService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.logger.log(
      `Outreach send worker listening on queue="${OUTREACH_SEND_QUEUE}"`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OutreachSendJobData> | undefined, error: Error): void {
    this.logger.error(
      `Outreach send worker event failed job=${job?.id ?? 'unknown'} message=${job?.data?.message_uuid ?? 'unknown'}: ${error.message}`,
      error.stack,
    );
  }

  async process(job: Job<OutreachSendJobData>): Promise<void> {
    this.logger.log(
      `Outreach send job started jobId=${job.id} message=${job.data.message_uuid}`,
    );
    const message = await this.prisma.outreachMessage.findUnique({
      where: { uuid: job.data.message_uuid },
      include: { contact: true },
    });
    if (!message) {
      this.logger.warn(`Outreach message ${job.data.message_uuid} not found`);
      return;
    }
    if (message.campaign_uuid && !message.sequence_step_uuid) {
      await this.failSkippedMessage(message, {
        error_message: `Campaign message must be sent via the campaign worker (campaign ${message.campaign_uuid})`,
        triggerAdvance: false,
      });
      return;
    }
    if (
      message.status !== MsgStatus.PENDING &&
      message.status !== MsgStatus.QUEUED
    ) {
      // Already terminal (or otherwise unexpected) - advancement, if any, already
      // happened the first time this message resolved; don't double-advance.
      await this.failSkippedMessage(message, {
        error_message: `Message is ${message.status} and cannot be sent`,
        triggerAdvance: false,
      });
      return;
    }

    if (
      message.channel === Channel.EMAIL &&
      !hasUsableContactEmail(message.contact.email)
    ) {
      await this.failSkippedMessage(message, {
        error_message: 'Contact has no email',
        triggerAdvance: true,
      });
      return;
    }
    if (message.channel === Channel.SMS && !message.contact.phone?.trim()) {
      await this.failSkippedMessage(message, {
        error_message: 'Contact has no phone',
        triggerAdvance: true,
      });
      return;
    }

    await this.prisma.outreachMessage.update({
      where: { uuid: message.uuid },
      data: { status: MsgStatus.QUEUED },
    });

    try {
      this.logger.log(
        `Outreach send delivering message=${message.uuid} channel=${message.channel}`,
      );
      const { provider_message_id, integration_metadata } =
        await this.messageSendService.deliverOutreachMessage(message);

      const shouldPromoteOnSend =
        message.channel === Channel.EMAIL &&
        message.contact.status === LeadStatus.NEW;

      await this.prisma.$transaction([
        this.messageSendService.messageSentOperation(
          message.uuid,
          provider_message_id,
          message.metadata,
          integration_metadata,
        ),
        this.messageSendService.interactionCreateOperation({
          contact_uuid: message.contact_uuid,
          organisation_uuid: message.organisation_uuid,
          type: this.toInteractionType(message.channel),
          outreach_message_uuid: message.uuid,
        }),
        this.messageSendService.contactInteractedOperation(
          message.contact_uuid,
        ),
        ...(shouldPromoteOnSend
          ? this.contactsService.buildPromoteToContactedIfNewOps(
              message.contact_uuid,
              message.organisation_uuid,
              'email_sent',
              message.contact.status,
            )
          : []),
      ]);

      if (shouldPromoteOnSend) {
        await this.contactsService.syncContactSearchIndex(message.contact_uuid);
      }

      if (message.campaign_uuid && message.sequence_step_uuid) {
        await this.prisma.marketingCampaign.update({
          where: { uuid: message.campaign_uuid },
          data: { sent_count: { increment: 1 } },
        });
        await this.campaignMessageSendService.checkCompletion(
          message.campaign_uuid,
        );
      }

      if (message.sequence_enrollment_uuid && message.sequence_step_uuid) {
        await this.sequenceEnrollmentService.advanceEnrollment(
          message.sequence_enrollment_uuid,
          message.sequence_step_uuid,
          new Date(),
        );
      }

      if (message.sent_by_user_uuid) {
        setImmediate(() => {
          void this.messagingGoalsService.onMessageSent({
            organisation_uuid: message.organisation_uuid,
            user_uuid: message.sent_by_user_uuid!,
            sent_at: new Date(),
          });
        });
      }

      this.logger.log(
        `Outreach send succeeded message=${message.uuid} providerMessageId=${provider_message_id}`,
      );
    } catch (error) {
      const error_message =
        error instanceof Error ? error.message : 'Unknown error';
      await this.messageSendService.messageFailedOperationPreservingProvider(
        message.uuid,
        error_message,
        message.metadata,
      );
      if (message.campaign_integration_uuid) {
        await this.sendingCapacityService.releaseSlot(message.uuid);
      }
      if (message.campaign_uuid && message.sequence_step_uuid) {
        await this.prisma.marketingCampaign.update({
          where: { uuid: message.campaign_uuid },
          data: { failed_count: { increment: 1 } },
        });
        await this.campaignMessageSendService.checkCompletion(
          message.campaign_uuid,
        );
      }
      if (message.sequence_enrollment_uuid && message.sequence_step_uuid) {
        // Failed steps don't halt the enrollment - it advances to the next step anyway.
        await this.sequenceEnrollmentService.advanceEnrollment(
          message.sequence_enrollment_uuid,
          message.sequence_step_uuid,
          new Date(),
        );
      }
      this.logger.error(
        `Failed sending outreach message ${message.uuid}: ${error_message} (status set to FAILED)`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async failSkippedMessage(
    message: {
      uuid: string;
      metadata: unknown;
      campaign_uuid: string | null;
      campaign_integration_uuid: string | null;
      sequence_enrollment_uuid: string | null;
      sequence_step_uuid: string | null;
    },
    options: { error_message: string; triggerAdvance: boolean },
  ): Promise<void> {
    await this.messageSendService.messageFailedOperationPreservingProvider(
      message.uuid,
      options.error_message,
      message.metadata,
    );
    if (message.campaign_integration_uuid) {
      await this.sendingCapacityService.releaseSlot(message.uuid);
    }
    if (message.campaign_uuid && message.sequence_step_uuid) {
      await this.prisma.marketingCampaign.update({
        where: { uuid: message.campaign_uuid },
        data: { failed_count: { increment: 1 } },
      });
      await this.campaignMessageSendService.checkCompletion(
        message.campaign_uuid,
      );
    }
    if (
      options.triggerAdvance &&
      message.sequence_enrollment_uuid &&
      message.sequence_step_uuid
    ) {
      await this.sequenceEnrollmentService.advanceEnrollment(
        message.sequence_enrollment_uuid,
        message.sequence_step_uuid,
        new Date(),
      );
    }
    this.logger.warn(
      `Outreach send skipped message=${message.uuid}: ${options.error_message}`,
    );
  }

  private toInteractionType(channel: Channel): InteractionType {
    switch (channel) {
      case Channel.SMS:
        return InteractionType.SMS;
      case Channel.PHONE_CALL:
        return InteractionType.CALL;
      case Channel.EMAIL:
        return InteractionType.EMAIL;
      default:
        return InteractionType.EMAIL;
    }
  }
}
