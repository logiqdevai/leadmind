import { Injectable } from '@nestjs/common';
import { SendingPeriodUnit, SendingPolicyStage } from '@/generated/prisma';
import {
  ResolvedStage,
  SchedulePreviewEntry,
  SchedulePreviewResult,
} from '../interfaces/sending-policy.interface';

const UNIT_MS: Record<SendingPeriodUnit, number> = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
};

export function durationMs(value: number, unit: SendingPeriodUnit): number {
  return value * UNIT_MS[unit];
}

/**
 * Pure, stateless stage resolution: the current stage of a SendingPolicy is always
 * derived from policy_started_at + the ordered stage durations, never stored as a
 * mutable "current stage index". This is the single implementation reused by the
 * capacity engine, the API's observability endpoints, and the frontend preview.
 */
@Injectable()
export class SendingStageResolverService {
  resolveCurrentStage(
    stages: SendingPolicyStage[],
    policy_started_at: Date,
    now: Date = new Date(),
  ): ResolvedStage | null {
    const ordered = [...stages].sort((a, b) => a.order_index - b.order_index);
    if (ordered.length === 0) return null;

    const elapsedMs = Math.max(0, now.getTime() - policy_started_at.getTime());
    let cumulativeMs = 0;

    for (let i = 0; i < ordered.length; i++) {
      const stage = ordered[i];
      const isLastStage = i === ordered.length - 1;

      if (stage.duration_value == null || stage.duration_unit == null) {
        const stageStartedAt = new Date(
          policy_started_at.getTime() + cumulativeMs,
        );
        return {
          stage,
          stage_index: i,
          stage_started_at: stageStartedAt,
          stage_elapsed_ms: now.getTime() - stageStartedAt.getTime(),
          next_stage_at: null,
          is_final_stage: true,
        };
      }

      const stageDurationMs = durationMs(
        stage.duration_value,
        stage.duration_unit,
      );
      const stageEndsAtMs = cumulativeMs + stageDurationMs;

      if (elapsedMs < stageEndsAtMs || isLastStage) {
        const stageStartedAt = new Date(
          policy_started_at.getTime() + cumulativeMs,
        );
        return {
          stage,
          stage_index: i,
          stage_started_at: stageStartedAt,
          stage_elapsed_ms: now.getTime() - stageStartedAt.getTime(),
          next_stage_at: isLastStage
            ? null
            : new Date(policy_started_at.getTime() + stageEndsAtMs),
          is_final_stage: isLastStage,
        };
      }

      cumulativeMs = stageEndsAtMs;
    }

    return null;
  }

  previewSchedule(
    stages: SendingPolicyStage[],
    totalContacts: number,
    startAt: Date = new Date(),
  ): SchedulePreviewResult {
    const ordered = [...stages].sort((a, b) => a.order_index - b.order_index);
    const entries: SchedulePreviewEntry[] = [];
    let cumulativeMs = 0;
    let remaining = totalContacts;
    let completionAt: Date | null = null;

    for (let i = 0; i < ordered.length; i++) {
      const stage = ordered[i];
      const startsAt = new Date(startAt.getTime() + cumulativeMs);
      const isFinal =
        stage.duration_value == null || stage.duration_unit == null;
      const stageDurationMs = isFinal
        ? null
        : durationMs(
            stage.duration_value as number,
            stage.duration_unit as SendingPeriodUnit,
          );
      const endsAt =
        stageDurationMs == null
          ? null
          : new Date(startsAt.getTime() + stageDurationMs);

      if (isFinal) {
        // Indefinite final stage: project forward using its own limit to estimate
        // when the remaining contacts would be drained, rather than assuming
        // instant completion.
        const periodsNeeded = Math.ceil(remaining / stage.limit);
        const projectedDurationMs = periodsNeeded * UNIT_MS[stage.period_unit];
        const projectedEndsAt = new Date(
          startsAt.getTime() + projectedDurationMs,
        );
        entries.push({
          stage_index: i,
          order_index: stage.order_index,
          limit: stage.limit,
          period_unit: stage.period_unit,
          starts_at: startsAt,
          ends_at: null,
          is_final_stage: true,
          estimated_messages: remaining,
        });
        completionAt = projectedEndsAt;
        remaining = 0;
        break;
      }

      const periodsInStage =
        (stageDurationMs as number) / UNIT_MS[stage.period_unit];
      const stageCapacity = Math.floor(stage.limit * periodsInStage);
      const estimated_messages = Math.min(remaining, stageCapacity);

      entries.push({
        stage_index: i,
        order_index: stage.order_index,
        limit: stage.limit,
        period_unit: stage.period_unit,
        starts_at: startsAt,
        ends_at: endsAt,
        is_final_stage: false,
        estimated_messages,
      });

      remaining -= estimated_messages;

      if (remaining <= 0) {
        completionAt = new Date(
          startsAt.getTime() +
            (estimated_messages / stage.limit) * UNIT_MS[stage.period_unit],
        );
        break;
      }

      cumulativeMs += stageDurationMs as number;
    }

    return {
      entries,
      estimated_completion_at: completionAt,
      total_contacts: totalContacts,
    };
  }
}
