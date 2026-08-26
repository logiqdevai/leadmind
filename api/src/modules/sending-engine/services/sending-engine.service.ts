import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CampaignContactStatus,
  CampaignIntegrationStatus,
  CampaignStatus,
  CampaignType,
  Channel,
  MarketingCampaign,
  MsgStatus,
  Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
  MARKETING_MESSAGE_SEND_QUEUE,
  OUTREACH_SEND_QUEUE,
} from '@/core/queues/queues.constants';
import { sanitizeEmailHtml } from '@/shared/utils/sanitize-html.util';
import { SendingCapacityService } from '@/modules/sending-capacity/services/sending-capacity.service';
import { SendingCapacityDeniedError } from '@/modules/sending-capacity/interfaces/sending-capacity.interface';
import { IntegrationSelectionService } from '@/modules/integration-selection/services/integration-selection.service';
import { SelectableCampaignIntegration } from '@/modules/integration-selection/interfaces/integration-selection-strategy.interface';

interface ClaimedMcc {
  uuid: string;
  contact_uuid: string;
}

interface ClaimedSequenceMessage {
  uuid: string;
}

/**
 * The periodic "pacing tick": drains PENDING campaign work gradually, one eligible
 * unit of work per ACTIVE CampaignIntegration per pass, instead of the old one-shot
 * burst-enqueue. v1 wiring covers STANDARD/PERSONALIZED and SEQUENCE campaigns' EMAIL
 * sends only - SMS/LinkedIn stay unpaced (see plan doc).
 */
@Injectable()
export class SendingEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendingCapacityService: SendingCapacityService,
    private readonly integrationSelectionService: IntegrationSelectionService,
    @InjectQueue(MARKETING_MESSAGE_SEND_QUEUE)
    private readonly messageSendQueue: Queue,
    @InjectQueue(OUTREACH_SEND_QUEUE)
    private readonly outreachSendQueue: Queue,
  ) {}

  async tick(
    now: Date = new Date(),
  ): Promise<{ campaigns_processed: number; messages_sent: number }> {
    const campaigns = await this.prisma.marketingCampaign.findMany({
      where: {
        status: CampaignStatus.SENDING,
        campaign_type: {
          in: [
            CampaignType.STANDARD,
            CampaignType.PERSONALIZED,
            CampaignType.SEQUENCE,
          ],
        },
        campaign_integrations: {
          some: { status: CampaignIntegrationStatus.ACTIVE },
        },
      },
    });

    let messages_sent = 0;
    for (const campaign of campaigns) {
      messages_sent += await this.tickCampaign(campaign, now);
    }

    return { campaigns_processed: campaigns.length, messages_sent };
  }

  private async tickCampaign(
    campaign: MarketingCampaign,
    now: Date,
  ): Promise<number> {
    const integrations = await this.prisma.campaignIntegration.findMany({
      where: {
        campaign_uuid: campaign.uuid,
        status: CampaignIntegrationStatus.ACTIVE,
      },
      select: { uuid: true },
    });
    if (integrations.length === 0) return 0;

    await Promise.all(
      integrations.map((ci) =>
        this.sendingCapacityService.activatePolicy(ci.uuid, now),
      ),
    );

    const eligibility = await Promise.all(
      integrations.map(async (ci) => ({
        campaign_integration_uuid: ci.uuid,
        result: await this.sendingCapacityService.checkEligibility(
          ci.uuid,
          now,
        ),
      })),
    );

    let candidates: SelectableCampaignIntegration[] = eligibility
      .filter((e) => e.result.eligible)
      .map((e) => ({
        campaign_integration_uuid: e.campaign_integration_uuid,
        stage_remaining: e.result.stage_remaining,
      }));

    const isSequence = campaign.campaign_type === CampaignType.SEQUENCE;
    let sent = 0;

    while (candidates.length > 0) {
      const selected = this.integrationSelectionService.select(candidates);
      if (!selected) break;
      candidates = candidates.filter(
        (c) =>
          c.campaign_integration_uuid !== selected.campaign_integration_uuid,
      );

      const succeeded = isSequence
        ? await this.tickSequenceStep(
            campaign,
            selected.campaign_integration_uuid,
            now,
          )
        : await this.tickCampaignContact(
            campaign,
            selected.campaign_integration_uuid,
            now,
          );
      if (succeeded === null) break; // nothing left to claim for this campaign this tick
      if (succeeded) sent += 1;
    }

    return sent;
  }

  /** STANDARD/PERSONALIZED: claim a pending MarketingCampaignContact and send via it. */
  private async tickCampaignContact(
    campaign: MarketingCampaign,
    campaign_integration_uuid: string,
    now: Date,
  ): Promise<boolean | null> {
    const claimed = await this.claimNextPendingMcc(campaign.uuid);
    if (!claimed) return null;

    await this.prisma.marketingCampaign.update({
      where: { uuid: campaign.uuid },
      data: { queued_count: { increment: 1 } },
    });

    const message = await this.ensureCampaignContactMessage(
      campaign,
      claimed.contact_uuid,
    );

    const reserved = await this.tryReserve(
      campaign_integration_uuid,
      message.uuid,
      now,
    );
    if (!reserved) {
      await this.prisma.$transaction([
        this.prisma.marketingCampaignContact.update({
          where: { uuid: claimed.uuid },
          data: { status: CampaignContactStatus.PENDING },
        }),
        this.prisma.marketingCampaign.update({
          where: { uuid: campaign.uuid },
          data: { queued_count: { decrement: 1 } },
        }),
      ]);
      return false;
    }

    await this.messageSendQueue.add(
      `send-${claimed.uuid}`,
      { campaign_uuid: campaign.uuid, mcc_uuid: claimed.uuid },
      {
        jobId: `mcc-${claimed.uuid}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
    return true;
  }

  /** SEQUENCE: claim a pending step OutreachMessage (already materialized by SequenceEnrollmentService) and send via it. */
  private async tickSequenceStep(
    campaign: MarketingCampaign,
    campaign_integration_uuid: string,
    now: Date,
  ): Promise<boolean | null> {
    const claimed = await this.claimNextPendingSequenceMessage(
      campaign.uuid,
      now,
    );
    if (!claimed) return null;

    const reserved = await this.tryReserve(
      campaign_integration_uuid,
      claimed.uuid,
      now,
    );
    if (!reserved) {
      await this.prisma.outreachMessage.update({
        where: { uuid: claimed.uuid },
        data: { status: MsgStatus.PENDING },
      });
      return false;
    }

    await this.outreachSendQueue.add(
      `outreach-send:${claimed.uuid}`,
      { message_uuid: claimed.uuid },
      {
        jobId: claimed.uuid,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return true;
  }

  private async tryReserve(
    campaign_integration_uuid: string,
    message_uuid: string,
    now: Date,
  ): Promise<boolean> {
    try {
      await this.sendingCapacityService.reserveSlot(
        campaign_integration_uuid,
        message_uuid,
        now,
      );
      return true;
    } catch (error) {
      if (error instanceof SendingCapacityDeniedError) {
        return false;
      }
      throw error;
    }
  }

  private async ensureCampaignContactMessage(
    campaign: MarketingCampaign,
    contact_uuid: string,
  ): Promise<{ uuid: string }> {
    const idempotency_key = `campaign:${campaign.uuid}:${contact_uuid}:${Channel.EMAIL}`;
    const existing = await this.prisma.outreachMessage.findUnique({
      where: { idempotency_key },
      select: { uuid: true },
    });
    if (existing) return existing;

    try {
      return await this.prisma.outreachMessage.create({
        data: {
          organisation_uuid: campaign.organisation_uuid,
          contact_uuid,
          campaign_uuid: campaign.uuid,
          channel: Channel.EMAIL,
          subject: campaign.email_subject,
          content: sanitizeEmailHtml(campaign.email_content ?? ''),
          status: MsgStatus.QUEUED,
          idempotency_key,
        },
        select: { uuid: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.outreachMessage.findUniqueOrThrow({
          where: { idempotency_key },
          select: { uuid: true },
        });
      }
      throw error;
    }
  }

  /** Atomically claims one PENDING MCC row via SKIP LOCKED, safe under concurrent ticks. */
  private async claimNextPendingMcc(
    campaign_uuid: string,
  ): Promise<ClaimedMcc | null> {
    const rows = await this.prisma.$queryRaw<ClaimedMcc[]>`
            UPDATE marketing_campaign_contacts
            SET status = 'QUEUED', updated_at = now()
            WHERE uuid = (
                SELECT uuid FROM marketing_campaign_contacts
                WHERE campaign_uuid = ${campaign_uuid} AND channel = 'EMAIL' AND status = 'PENDING'
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING uuid, contact_uuid
        `;
    return rows[0] ?? null;
  }

  /** Atomically claims one due, PENDING sequence-step OutreachMessage via SKIP LOCKED. */
  private async claimNextPendingSequenceMessage(
    campaign_uuid: string,
    now: Date,
  ): Promise<ClaimedSequenceMessage | null> {
    const rows = await this.prisma.$queryRaw<ClaimedSequenceMessage[]>`
            UPDATE "OutreachMessage"
            SET status = 'QUEUED', updated_at = now()
            WHERE uuid = (
                SELECT uuid FROM "OutreachMessage"
                WHERE campaign_uuid = ${campaign_uuid}
                  AND channel = 'EMAIL'
                  AND status = 'PENDING'
                  AND sequence_step_uuid IS NOT NULL
                  AND (scheduled_at IS NULL OR scheduled_at <= ${now})
                ORDER BY scheduled_at ASC NULLS FIRST, created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING uuid
        `;
    return rows[0] ?? null;
  }
}
