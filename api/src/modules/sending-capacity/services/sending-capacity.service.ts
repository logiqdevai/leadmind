import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  Prisma,
  SendingPeriodUnit,
  SendingUsageScopeType,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { getPeriodWindow } from '@/modules/messaging-goals/utils/messaging-goals.utils';
import { SendingStageResolverService } from '@/modules/sending-policy/services/sending-stage-resolver.service';
import {
  CapacityObservability,
  EligibilityResult,
  SendingCapacityDeniedError,
} from '../interfaces/sending-capacity.interface';

interface ReservationCandidate {
  scope_type: SendingUsageScopeType;
  scope_uuid: string;
  period_key: string;
  limit: number;
  reason: 'stage_limit' | 'account_limit' | 'provider_limit';
}

const CAMPAIGN_INTEGRATION_INCLUDE = {
  campaign: { select: { organisation_uuid: true } },
  integration_account: { include: { integration: true } },
  sending_policy: {
    include: { stages: { orderBy: { order_index: 'asc' as const } } },
  },
  state: true,
};

@Injectable()
export class SendingCapacityService {
  private readonly logger = new Logger(SendingCapacityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stageResolver: SendingStageResolverService,
  ) {}

  /** Idempotently starts the policy clock for a CampaignIntegration on first use. */
  async activatePolicy(
    campaign_integration_uuid: string,
    now: Date = new Date(),
  ): Promise<void> {
    await this.prisma.$executeRaw`
            UPDATE campaign_integration_states
            SET policy_started_at = ${now}, updated_at = now()
            WHERE campaign_integration_uuid = ${campaign_integration_uuid}
              AND policy_started_at IS NULL
        `;
  }

  /** Cheap, read-only pre-check: is this campaign integration eligible to send right now? */
  async checkEligibility(
    campaign_integration_uuid: string,
    now: Date = new Date(),
  ): Promise<EligibilityResult> {
    const ci = await this.loadCampaignIntegration(campaign_integration_uuid);
    const policy = ci.sending_policy;

    if (!ci.state?.policy_started_at) {
      return {
        eligible: false,
        next_eligible_at: now,
        reason: 'no_active_policy',
        stage_remaining: 0,
      };
    }

    const resolved = this.stageResolver.resolveCurrentStage(
      policy.stages,
      ci.state.policy_started_at,
      now,
    );
    if (!resolved) {
      return {
        eligible: false,
        next_eligible_at: now,
        reason: 'no_active_policy',
        stage_remaining: 0,
      };
    }

    const windowOpen = this.resolveWindowOpen(policy, now);
    if (!windowOpen.is_open) {
      return {
        eligible: false,
        next_eligible_at: windowOpen.opens_at,
        reason: 'window_closed',
        stage_remaining: 0,
      };
    }

    const stageWindow = getPeriodWindow(
      resolved.stage.period_unit,
      policy.timezone,
      now,
    );
    const stageUsed = await this.readUsage(
      SendingUsageScopeType.CAMPAIGN_INTEGRATION,
      ci.uuid,
      stageWindow.period_key,
    );
    const stageRemaining = Math.max(0, resolved.stage.limit - stageUsed);
    if (stageRemaining <= 0) {
      return {
        eligible: false,
        next_eligible_at: stageWindow.ends_at,
        reason: 'stage_limit',
        stage_remaining: 0,
      };
    }

    const remainingWindowSeconds = Math.max(
      1,
      (windowOpen.closes_at.getTime() - now.getTime()) / 1000,
    );
    const evenSpacingSeconds = remainingWindowSeconds / stageRemaining;
    const effectiveIntervalSeconds = Math.max(
      policy.min_interval_seconds,
      evenSpacingSeconds,
    );

    const lastSentAt = ci.state.last_sent_at;
    const intervalEligibleAt = lastSentAt
      ? new Date(lastSentAt.getTime() + effectiveIntervalSeconds * 1000)
      : now;

    const nextEligibleAt = new Date(
      Math.max(windowOpen.opens_at.getTime(), intervalEligibleAt.getTime()),
    );

    return {
      eligible: nextEligibleAt.getTime() <= now.getTime(),
      next_eligible_at: nextEligibleAt,
      reason:
        nextEligibleAt.getTime() <= now.getTime() ? undefined : 'min_interval',
      stage_remaining: stageRemaining,
    };
  }

  /**
   * Atomically reserves one send slot across every applicable limit layer
   * (campaign-integration stage, integration-account, provider) plus the
   * minimum-interval gate, all inside a single transaction so a denial at any
   * layer rolls back every increment already made in this call - this is the
   * one concurrency-safe enforcement point for the whole sending system.
   */
  async reserveSlot(
    campaign_integration_uuid: string,
    message_uuid: string,
    now: Date = new Date(),
  ): Promise<{ reserved: true }> {
    const ci = await this.loadCampaignIntegration(campaign_integration_uuid);
    if (!ci.state?.policy_started_at) {
      throw new SendingCapacityDeniedError('no_active_policy');
    }

    const policy = ci.sending_policy;
    const resolved = this.stageResolver.resolveCurrentStage(
      policy.stages,
      ci.state.policy_started_at,
      now,
    );
    if (!resolved) {
      throw new SendingCapacityDeniedError('no_active_policy');
    }

    const orgTimezone = await this.getOrgTimezone(
      ci.campaign.organisation_uuid,
    );
    const candidates = await this.buildCandidates(
      ci,
      resolved.stage,
      orgTimezone,
      now,
    );

    await this.prisma.$transaction(async (tx) => {
      const reservations: {
        scope_type: SendingUsageScopeType;
        scope_uuid: string;
        period_key: string;
      }[] = [];

      for (const candidate of candidates) {
        const rows = await tx.$queryRaw<{ count: number }[]>`
                    INSERT INTO sending_usage_counters (uuid, scope_type, scope_uuid, period_key, count, created_at, updated_at)
                    VALUES (${randomUUID()}, ${candidate.scope_type}::"SendingUsageScopeType", ${candidate.scope_uuid}, ${candidate.period_key}, 1, now(), now())
                    ON CONFLICT (scope_type, scope_uuid, period_key)
                    DO UPDATE SET count = sending_usage_counters.count + 1, updated_at = now()
                    WHERE sending_usage_counters.count < ${candidate.limit}
                    RETURNING count
                `;
        if (rows.length === 0) {
          throw new SendingCapacityDeniedError(candidate.reason);
        }
        reservations.push({
          scope_type: candidate.scope_type,
          scope_uuid: candidate.scope_uuid,
          period_key: candidate.period_key,
        });
      }

      const intervalMs = Math.max(0, policy.min_interval_seconds) * 1000;
      const intervalRows = await tx.$queryRaw<{ uuid: string }[]>`
                UPDATE campaign_integration_states
                SET last_sent_at = ${now}, updated_at = now()
                WHERE campaign_integration_uuid = ${campaign_integration_uuid}
                  AND (last_sent_at IS NULL OR last_sent_at <= ${new Date(now.getTime() - intervalMs)})
                RETURNING uuid
            `;
      if (intervalRows.length === 0) {
        throw new SendingCapacityDeniedError('min_interval');
      }

      const message = await tx.outreachMessage.findUnique({
        where: { uuid: message_uuid },
        select: { metadata: true },
      });
      const metadata =
        (message?.metadata as Record<string, unknown> | null) ?? {};
      await tx.outreachMessage.update({
        where: { uuid: message_uuid },
        data: {
          campaign_integration_uuid,
          metadata: {
            ...metadata,
            sending_reservation: reservations,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return { reserved: true };
  }

  /** Best-effort compensating release for a message whose send failed after reservation. */
  async releaseSlot(message_uuid: string): Promise<void> {
    const message = await this.prisma.outreachMessage.findUnique({
      where: { uuid: message_uuid },
      select: { metadata: true },
    });
    const metadata =
      (message?.metadata as Record<string, unknown> | null) ?? {};
    const reservations = metadata.sending_reservation as
      | {
          scope_type: SendingUsageScopeType;
          scope_uuid: string;
          period_key: string;
        }[]
      | undefined;
    if (!reservations?.length) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const r of reservations) {
          await tx.$executeRaw`
                        UPDATE sending_usage_counters
                        SET count = GREATEST(count - 1, 0), updated_at = now()
                        WHERE scope_type = ${r.scope_type}::"SendingUsageScopeType"
                          AND scope_uuid = ${r.scope_uuid}
                          AND period_key = ${r.period_key}
                    `;
        }
        const rest = { ...metadata };
        delete rest.sending_reservation;
        await tx.outreachMessage.update({
          where: { uuid: message_uuid },
          data: { metadata: rest as Prisma.InputJsonValue },
        });
      });
    } catch (error) {
      this.logger.warn(
        `releaseSlot failed for message=${message_uuid}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async getObservability(
    campaign_integration_uuid: string,
    now: Date = new Date(),
  ): Promise<CapacityObservability> {
    const ci = await this.loadCampaignIntegration(campaign_integration_uuid);
    const policy = ci.sending_policy;
    const resolved = ci.state?.policy_started_at
      ? this.stageResolver.resolveCurrentStage(
          policy.stages,
          ci.state.policy_started_at,
          now,
        )
      : null;

    const orgTimezone = await this.getOrgTimezone(
      ci.campaign.organisation_uuid,
    );
    const provider = ci.integration_account.integration.provider;

    let stage_used: number | null = null;
    let stage_remaining: number | null = null;
    if (resolved) {
      const window = getPeriodWindow(
        resolved.stage.period_unit,
        policy.timezone,
        now,
      );
      stage_used = await this.readUsage(
        SendingUsageScopeType.CAMPAIGN_INTEGRATION,
        ci.uuid,
        window.period_key,
      );
      stage_remaining = Math.max(0, resolved.stage.limit - stage_used);
    }

    let account_used: number | null = null;
    let account_remaining: number | null = null;
    const account_limit =
      ci.integration_account.max_messages_per_period ?? null;
    if (
      account_limit != null &&
      ci.integration_account.max_messages_period_unit
    ) {
      const window = getPeriodWindow(
        ci.integration_account.max_messages_period_unit,
        orgTimezone,
        now,
      );
      account_used = await this.readUsage(
        SendingUsageScopeType.INTEGRATION_ACCOUNT,
        ci.integration_account.uuid,
        window.period_key,
      );
      account_remaining = Math.max(0, account_limit - account_used);
    }

    const providerLimits = await this.prisma.emailSendLimit.findMany({
      where: {
        organisation_uuid: ci.campaign.organisation_uuid,
        provider,
        is_active: true,
      },
    });
    let provider_limit: number | null = null;
    let provider_used: number | null = null;
    let provider_remaining: number | null = null;
    if (providerLimits.length > 0) {
      // Surface the tightest active provider-level limit for observability.
      let tightest: { remaining: number; used: number; limit: number } | null =
        null;
      for (const pl of providerLimits) {
        const window = getPeriodWindow(pl.period, orgTimezone, now);
        const used = await this.readUsage(
          SendingUsageScopeType.PROVIDER,
          `${ci.campaign.organisation_uuid}:${provider}`,
          window.period_key,
        );
        const remaining = Math.max(0, pl.max_count - used);
        if (!tightest || remaining < tightest.remaining) {
          tightest = { remaining, used, limit: pl.max_count };
        }
      }
      provider_limit = tightest?.limit ?? null;
      provider_used = tightest?.used ?? null;
      provider_remaining = tightest?.remaining ?? null;
    }

    const effective_limit = [
      resolved?.stage.limit,
      account_limit,
      provider_limit,
    ].filter((v): v is number => v != null);

    const eligibility = await this.checkEligibility(
      campaign_integration_uuid,
      now,
    );

    return {
      campaign_integration_uuid: ci.uuid,
      current_stage: resolved
        ? {
            order_index: resolved.stage.order_index,
            limit: resolved.stage.limit,
            period_unit: resolved.stage.period_unit,
            is_final_stage: resolved.is_final_stage,
          }
        : null,
      stage_used,
      stage_remaining,
      account_limit,
      account_used,
      account_remaining,
      provider_limit,
      provider_used,
      provider_remaining,
      effective_limit: effective_limit.length
        ? Math.min(...effective_limit)
        : null,
      sending_window: {
        start_minute: policy.window_start_minute,
        end_minute: policy.window_end_minute,
        timezone: policy.timezone,
      },
      next_eligible_at: eligibility.next_eligible_at,
    };
  }

  private async buildCandidates(
    ci: Awaited<ReturnType<SendingCapacityService['loadCampaignIntegration']>>,
    stage: { limit: number; period_unit: SendingPeriodUnit },
    orgTimezone: string,
    now: Date,
  ): Promise<ReservationCandidate[]> {
    const candidates: ReservationCandidate[] = [];

    const stageWindow = getPeriodWindow(
      stage.period_unit,
      ci.sending_policy.timezone,
      now,
    );
    candidates.push({
      scope_type: SendingUsageScopeType.CAMPAIGN_INTEGRATION,
      scope_uuid: ci.uuid,
      period_key: stageWindow.period_key,
      limit: stage.limit,
      reason: 'stage_limit',
    });

    const account = ci.integration_account;
    if (
      account.max_messages_per_period != null &&
      account.max_messages_period_unit
    ) {
      const accountWindow = getPeriodWindow(
        account.max_messages_period_unit,
        orgTimezone,
        now,
      );
      candidates.push({
        scope_type: SendingUsageScopeType.INTEGRATION_ACCOUNT,
        scope_uuid: account.uuid,
        period_key: accountWindow.period_key,
        limit: account.max_messages_per_period,
        reason: 'account_limit',
      });
    }

    const provider = account.integration.provider;
    const providerLimits = await this.prisma.emailSendLimit.findMany({
      where: {
        organisation_uuid: ci.campaign.organisation_uuid,
        provider,
        is_active: true,
      },
    });
    for (const pl of providerLimits) {
      const window = getPeriodWindow(pl.period, orgTimezone, now);
      candidates.push({
        scope_type: SendingUsageScopeType.PROVIDER,
        scope_uuid: `${ci.campaign.organisation_uuid}:${provider}`,
        period_key: window.period_key,
        limit: pl.max_count,
        reason: 'provider_limit',
      });
    }

    return candidates;
  }

  private resolveWindowOpen(
    policy: {
      window_start_minute: number | null;
      window_end_minute: number | null;
      timezone: string;
    },
    now: Date,
  ): { is_open: boolean; opens_at: Date; closes_at: Date } {
    if (
      policy.window_start_minute == null ||
      policy.window_end_minute == null
    ) {
      return {
        is_open: true,
        opens_at: now,
        closes_at: DateTime.fromJSDate(now).plus({ years: 1 }).toJSDate(),
      };
    }

    const zone = policy.timezone || 'UTC';
    const nowZoned = DateTime.fromJSDate(now, { zone });
    const todayStart = nowZoned.startOf('day');
    const opensToday = todayStart.plus({ minutes: policy.window_start_minute });
    const closesToday = todayStart.plus({ minutes: policy.window_end_minute });

    if (nowZoned < opensToday) {
      return {
        is_open: false,
        opens_at: opensToday.toUTC().toJSDate(),
        closes_at: closesToday.toUTC().toJSDate(),
      };
    }
    if (nowZoned > closesToday) {
      const opensTomorrow = opensToday.plus({ days: 1 });
      const closesTomorrow = closesToday.plus({ days: 1 });
      return {
        is_open: false,
        opens_at: opensTomorrow.toUTC().toJSDate(),
        closes_at: closesTomorrow.toUTC().toJSDate(),
      };
    }
    return {
      is_open: true,
      opens_at: opensToday.toUTC().toJSDate(),
      closes_at: closesToday.toUTC().toJSDate(),
    };
  }

  private async readUsage(
    scope_type: SendingUsageScopeType,
    scope_uuid: string,
    period_key: string,
  ): Promise<number> {
    const row = await this.prisma.sendingUsageCounter.findUnique({
      where: {
        scope_type_scope_uuid_period_key: {
          scope_type,
          scope_uuid,
          period_key,
        },
      },
      select: { count: true },
    });
    return row?.count ?? 0;
  }

  private async loadCampaignIntegration(campaign_integration_uuid: string) {
    const ci = await this.prisma.campaignIntegration.findUnique({
      where: { uuid: campaign_integration_uuid },
      include: CAMPAIGN_INTEGRATION_INCLUDE,
    });
    if (!ci) {
      throw new NotFoundException(
        `Campaign integration ${campaign_integration_uuid} not found`,
      );
    }
    return ci;
  }

  private async getOrgTimezone(organisation_uuid: string): Promise<string> {
    const org = await this.prisma.organisation.findUnique({
      where: { uuid: organisation_uuid },
      select: { timezone: true },
    });
    return org?.timezone || 'UTC';
  }
}
