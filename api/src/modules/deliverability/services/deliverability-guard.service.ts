import { Injectable } from '@nestjs/common';
import {
  DeliverabilityActionMode,
  DeliverabilityRiskLevel,
  DeliverabilityRun,
  DeliverabilitySchedule,
  DomainSendingGuard,
  MsgDirection,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { BASELINE_LOOKBACK_DAYS } from '../constants/deliverability.constants';
import { recommendDailyCap } from '../utils/deliverability-score.util';

export type DeliverabilityActionTaken =
  | 'NONE'
  | 'RECOMMENDED'
  | 'THROTTLED'
  | 'PAUSED'
  | 'LIFTED'
  | 'APPLIED';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Owns the DomainSendingGuard rows. A guard is only a restriction derived from the latest run;
 * the sending layer reads it (see SendingCapacityService) and the user's own account/provider
 * limits are never modified.
 */
@Injectable()
export class DeliverabilityGuardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether this schedule targets an integration account, i.e. whether sending can be restricted. */
  canEnforce(schedule: DeliverabilitySchedule): boolean {
    return schedule.integration_account_uuid != null;
  }

  /** Average sent per day over the lookback window for the schedule's account/domain. */
  async estimateDailyVolume(schedule: DeliverabilitySchedule): Promise<number> {
    if (!schedule.from_provider || !schedule.from_account) return 0;
    const since = new Date(Date.now() - BASELINE_LOOKBACK_DAYS * MS_PER_DAY);
    const sent = await this.prisma.outreachMessage.count({
      where: {
        organisation_uuid: schedule.organisation_uuid,
        direction: MsgDirection.OUTBOUND,
        sent_at: { gte: since },
        email_provider: schedule.from_provider,
        email_account: schedule.from_account,
        ...(schedule.integration_account_domain_uuid && {
          email_domain_uuid: schedule.integration_account_domain_uuid,
        }),
      },
    });
    return Math.ceil(sent / BASELINE_LOOKBACK_DAYS);
  }

  /**
   * Turns a scored run into the schedule's configured action. Returns what was done and the
   * cap that was recommended (stored on the run so RECOMMEND mode can apply it later).
   */
  async applyActionForRun(
    schedule: DeliverabilitySchedule,
    run_uuid: string,
    score: number,
    risk: DeliverabilityRiskLevel,
  ): Promise<{ action: DeliverabilityActionTaken; recommended_daily_cap: number | null }> {
    const guard = await this.findGuard(schedule.uuid);
    // Frozen while restricted: re-measuring volume after throttling would shrink the cap each run.
    const baseline =
      guard?.baseline_daily_volume ?? (await this.estimateDailyVolume(schedule));
    const cap = recommendDailyCap(risk, baseline);

    const healthy = risk === DeliverabilityRiskLevel.LOW;
    const enforcing =
      schedule.action_mode !== DeliverabilityActionMode.RECOMMEND &&
      this.canEnforce(schedule);

    if (!enforcing) {
      // Nothing is being enforced, so a guard left from an earlier mode must not linger.
      await this.lift(schedule.uuid);
      return {
        action: healthy || cap == null ? 'NONE' : 'RECOMMENDED',
        recommended_daily_cap: cap,
      };
    }

    if (healthy) {
      const lifted = await this.lift(schedule.uuid);
      return { action: lifted ? 'LIFTED' : 'NONE', recommended_daily_cap: null };
    }

    const pause =
      schedule.action_mode === DeliverabilityActionMode.PAUSE &&
      score < schedule.critical_threshold;
    await this.upsertGuard(schedule, {
      daily_cap: cap,
      paused: pause,
      baseline_daily_volume: baseline > 0 ? baseline : null,
      source_run_uuid: run_uuid,
    });
    return { action: pause ? 'PAUSED' : 'THROTTLED', recommended_daily_cap: cap };
  }

  /** Applies a run's recommended cap on demand (the RECOMMEND-mode "apply" button). */
  async applyRecommendedCap(
    schedule: DeliverabilitySchedule,
    run: DeliverabilityRun,
  ): Promise<void> {
    const baseline = await this.estimateDailyVolume(schedule);
    await this.upsertGuard(schedule, {
      daily_cap: run.recommended_daily_cap,
      paused: false,
      baseline_daily_volume: baseline > 0 ? baseline : null,
      source_run_uuid: run.uuid,
    });
  }

  /** Removes any restriction. Returns whether one existed. */
  async lift(schedule_uuid: string): Promise<boolean> {
    const { count } = await this.prisma.domainSendingGuard.deleteMany({
      where: { schedule_uuid },
    });
    return count > 0;
  }

  findGuard(schedule_uuid: string): Promise<DomainSendingGuard | null> {
    return this.prisma.domainSendingGuard.findUnique({ where: { schedule_uuid } });
  }

  private upsertGuard(
    schedule: DeliverabilitySchedule,
    data: Pick<
      DomainSendingGuard,
      'daily_cap' | 'paused' | 'baseline_daily_volume' | 'source_run_uuid'
    >,
  ): Promise<DomainSendingGuard> {
    return this.prisma.domainSendingGuard.upsert({
      where: { schedule_uuid: schedule.uuid },
      create: {
        schedule_uuid: schedule.uuid,
        organisation_uuid: schedule.organisation_uuid,
        integration_account_uuid: schedule.integration_account_uuid!,
        integration_account_domain_uuid: schedule.integration_account_domain_uuid,
        ...data,
      },
      update: data,
    });
  }
}
