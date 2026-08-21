import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  CampaignContactStatus,
  CampaignStatus,
  CampaignType,
  Channel,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
  MARKETING_CAMPAIGN_DISPATCH_QUEUE,
  MARKETING_MESSAGE_SEND_QUEUE,
} from '@/core/queues/queues.constants';
import { CampaignContactResolverService } from '@/modules/marketing-campaigns/services/campaign-contact-resolver.service';
import { CampaignFiltersDto } from '@/modules/marketing-campaigns/dto/campaign-filters.dto';
import { CampaignMessageSendService } from '@/modules/marketing-campaigns/services/campaign-message-send.service';
import { SequenceEnrollmentService } from '@/modules/sequences/services/sequence-enrollment.service';
import { MessageSendJobData } from './marketing-message-send.worker';

interface DispatchJobData {
  campaign_uuid: string;
}

const CHUNK_SIZE = 500;

// v1 sending-policy wiring is email-only (see plan doc) - other channels keep
// sending immediately/unpaced through the pre-existing burst-enqueue path.
const UNPACED_CHANNELS: Channel[] = [
  Channel.SMS,
  Channel.PHONE_CALL,
  Channel.LINKEDIN,
];

@Processor(MARKETING_CAMPAIGN_DISPATCH_QUEUE, { concurrency: 2 })
export class MarketingCampaignDispatchWorker extends WorkerHost {
  private readonly logger = new Logger(MarketingCampaignDispatchWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: CampaignContactResolverService,
    private readonly sendService: CampaignMessageSendService,
    private readonly sequenceEnrollmentService: SequenceEnrollmentService,
    @InjectQueue(MARKETING_MESSAGE_SEND_QUEUE)
    private readonly messageSendQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<void> {
    const { campaign_uuid } = job.data;
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { uuid: campaign_uuid },
    });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaign_uuid} not found`);
      return;
    }
    if (
      campaign.status !== CampaignStatus.SENDING &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      this.logger.warn(
        `Campaign ${campaign_uuid} is ${campaign.status}, skipping dispatch`,
      );
      return;
    }

    if (campaign.status === CampaignStatus.SCHEDULED) {
      await this.prisma.marketingCampaign.update({
        where: { uuid: campaign_uuid },
        data: { status: CampaignStatus.SENDING, started_at: new Date() },
      });
    }

    const filters = (campaign.filters_snapshot ??
      {}) as unknown as CampaignFiltersDto;
    const channels = campaign.channels as Channel[];
    const contact_uuids = await this.resolver.resolveContactUuids(
      campaign.organisation_uuid,
      filters,
      { channels },
    );

    if (contact_uuids.length === 0) {
      await this.prisma.marketingCampaign.update({
        where: { uuid: campaign_uuid },
        data: {
          selected_contact_count: 0,
          total_messages: 0,
          status: CampaignStatus.COMPLETED,
          completed_at: new Date(),
        },
      });
      this.logger.log(
        `Campaign ${campaign_uuid} dispatched zero contacts; marked COMPLETED`,
      );
      return;
    }

    if (campaign.campaign_type === CampaignType.SEQUENCE) {
      if (!campaign.sequence_uuid) {
        this.logger.error(
          `Campaign ${campaign_uuid} is SEQUENCE type but has no sequence_uuid`,
        );
        return;
      }
      await this.dispatchSequenceCampaign(
        campaign.organisation_uuid,
        campaign_uuid,
        campaign.sequence_uuid,
        contact_uuids,
      );
      return;
    }

    // EMAIL rows are created PENDING and drained gradually by the sending-engine tick
    // (see SendingEngineService) - no job is enqueued for them here. Other channels have
    // no pacing engine yet and keep the original immediate burst-enqueue behavior.
    const mccRows = contact_uuids.flatMap((contact_uuid) =>
      channels.map((channel) => ({
        campaign_uuid,
        contact_uuid,
        channel,
        status:
          channel === Channel.EMAIL
            ? CampaignContactStatus.PENDING
            : CampaignContactStatus.QUEUED,
      })),
    );

    const created = await this.prisma.marketingCampaignContact.createMany({
      data: mccRows,
      skipDuplicates: true,
    });
    this.logger.log(
      `Campaign ${campaign_uuid}: ${created.count} MCC rows created (${contact_uuids.length} contacts × ${channels.length} channels)`,
    );

    const mccs = await this.prisma.marketingCampaignContact.findMany({
      where: { campaign_uuid },
      select: { uuid: true, channel: true },
    });
    const unpacedMccs = mccs.filter((mcc) =>
      UNPACED_CHANNELS.includes(mcc.channel),
    );

    await this.prisma.marketingCampaign.update({
      where: { uuid: campaign_uuid },
      data: {
        selected_contact_count: contact_uuids.length,
        total_messages: mccs.length,
        queued_count: unpacedMccs.length,
      },
    });

    for (let i = 0; i < unpacedMccs.length; i += CHUNK_SIZE) {
      const chunk = unpacedMccs.slice(i, i + CHUNK_SIZE);
      await this.messageSendQueue.addBulk(
        chunk.map((mcc) => {
          const data: MessageSendJobData = {
            campaign_uuid,
            mcc_uuid: mcc.uuid,
          };
          return {
            name: `send-${mcc.uuid}`,
            data,
            opts: {
              jobId: `mcc-${mcc.uuid}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 60_000 },
              removeOnComplete: 1000,
              removeOnFail: 1000,
            },
          };
        }),
      );
    }

    this.logger.log(
      `Campaign ${campaign_uuid}: ${mccs.length - unpacedMccs.length} email message(s) pending pacing engine, ${unpacedMccs.length} other-channel job(s) enqueued`,
    );

    await this.sendService.checkCompletion(campaign_uuid);
  }

  private async dispatchSequenceCampaign(
    organisation_uuid: string,
    campaign_uuid: string,
    sequence_uuid: string,
    contact_uuids: string[],
  ): Promise<void> {
    const { enrolled, skipped, enabled_step_count } =
      await this.sequenceEnrollmentService.bulkEnroll(
        organisation_uuid,
        sequence_uuid,
        contact_uuids,
        campaign_uuid,
      );
    // total_messages is a static upper bound (enrolled * enabled steps); individual
    // step messages materialize lazily over time as prior steps resolve - see
    // SequenceEnrollmentService.advanceEnrollment.
    const totalMessages = enrolled * enabled_step_count;

    await this.prisma.marketingCampaign.update({
      where: { uuid: campaign_uuid },
      data: {
        selected_contact_count: enrolled,
        total_messages: totalMessages,
      },
    });

    this.logger.log(
      `Campaign ${campaign_uuid}: enrolled ${enrolled} contacts into sequence ${sequence_uuid} (${skipped} skipped, ${totalMessages} messages expected)`,
    );
  }
}
