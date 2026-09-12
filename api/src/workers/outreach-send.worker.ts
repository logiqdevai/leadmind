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
import { ContactListsService } from '@/modules/contact-lists/contact-lists.service';
import { MessageSendService } from '@/modules/outreach/services/message-send.service';
import { MessagingGoalsService } from '@/modules/messaging-goals/messaging-goals.service';
import { CampaignMessageSendService } from '@/modules/marketing-campaigns/services/campaign-message-send.service';
import { SequenceEnrollmentService } from '@/modules/sequences/services/sequence-enrollment.service';
import { SendingCapacityService } from '@/modules/sending-capacity/services/sending-capacity.service';
import { RemindersService } from '@/modules/reminders/reminders.service';
import { FOLLOW_UP_DEFAULT_DELAY_DAYS } from '@/modules/reminders/reminders.constants';
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
    private readonly contactListsService: ContactListsService,
    private readonly messagingGoalsService: MessagingGoalsService,
    private readonly campaignMessageSendService: CampaignMessageSendService,
    private readonly sequenceEnrollmentService: SequenceEnrollmentService,
    private readonly sendingCapacityService: SendingCapacityService,
    private readonly remindersService: RemindersService,
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
        cancelSequence: false,
      });
      return;
    }
    if (
      message.status !== MsgStatus.PENDING &&
      message.status !== MsgStatus.QUEUED
    ) {
      await this.failSkippedMessage(message, {
        error_message: `Message is ${message.status} and cannot be sent`,
        cancelSequence: false,
      });
      return;
    }

    if (
      message.channel === Channel.EMAIL &&
      !hasUsableContactEmail(message.contact.email)
    ) {
      await this.failSkippedMessage(message, {
        error_message: 'Contact has no email',
        cancelSequence: true,
      });
      return;
    }
    if (message.channel === Channel.SMS && !message.contact.phone?.trim()) {
      await this.failSkippedMessage(message, {
        error_message: 'Contact has no phone',
        cancelSequence: true,
      });
      return;
    }
    if (message.contact.unsubscribed_at) {
      await this.prisma.outreachMessage.update({
        where: { uuid: message.uuid },
        data: {
          status: MsgStatus.SKIPPED,
          metadata: { error: 'Contact has unsubscribed' },
        },
      });
      if (message.campaign_integration_uuid) {
        await this.sendingCapacityService.releaseSlot(message.uuid);
      }
      if (message.sequence_enrollment_uuid && message.sequence_step_uuid) {
        await this.sequenceEnrollmentService.advanceEnrollment(
          message.sequence_enrollment_uuid,
          message.sequence_step_uuid,
          new Date(),
        );
      }
      this.logger.warn(
        `Outreach send skipped message=${message.uuid}: Contact has unsubscribed`,
      );
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

      const attributedListUuid =
        message.channel === Channel.EMAIL
          ? await this.contactListsService.resolveAttributedListUuid({
              list_uuid: (message.metadata as { list_uuid?: string } | null)
                ?.list_uuid,
              campaign_uuid: message.campaign_uuid,
              sequence_enrollment_uuid: message.sequence_enrollment_uuid,
            })
          : null;
      const attributedListMember = attributedListUuid
        ? await this.prisma.contactListMember.findFirst({
            where: {
              list_uuid: attributedListUuid,
              contact_uuid: message.contact_uuid,
            },
            select: { status: true },
          })
        : null;

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
        ...(attributedListUuid
          ? this.contactListsService.buildPromoteListStatusToContactedIfNewOps(
              attributedListUuid,
              message.contact_uuid,
              attributedListMember?.status ?? null,
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

      // Only a manual reply to a contact who has already replied to us starts the
      // "are they still quiet" clock — not automated sequence steps (governed by their
      // own cadence/stop_on_reply) and not one-off cold sends (nothing to "go quiet" on
      // yet). See ContactsService.replyToContact, the sole place is_manual_reply is set.
      if (message.channel === Channel.EMAIL && message.is_manual_reply) {
        const remindAt = new Date(
          Date.now() + FOLLOW_UP_DEFAULT_DELAY_DAYS * 24 * 60 * 60 * 1000,
        );
        await this.remindersService.upsertFollowUp(
          message.organisation_uuid,
          message.contact_uuid,
          message.uuid,
          remindAt,
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
        await this.sequenceEnrollmentService.cancelEnrollment(
          message.organisation_uuid,
          message.sequence_enrollment_uuid,
        );
      }
      this.logger.error(
        `Failed sending outreach message ${message.uuid}: ${error_message} (status set to FAILED, sequence enrollment cancelled)`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async failSkippedMessage(
    message: {
      uuid: string;
      metadata: unknown;
      organisation_uuid: string;
      campaign_uuid: string | null;
      campaign_integration_uuid: string | null;
      sequence_enrollment_uuid: string | null;
      sequence_step_uuid: string | null;
    },
    options: { error_message: string; cancelSequence: boolean },
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
      options.cancelSequence &&
      message.sequence_enrollment_uuid &&
      message.sequence_step_uuid
    ) {
      await this.sequenceEnrollmentService.cancelEnrollment(
        message.organisation_uuid,
        message.sequence_enrollment_uuid,
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
