import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DeliverabilitySchedule } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { DELIVERABILITY_CHECK_QUEUE } from '@/core/queues/queues.constants';
import {
  DELIVERABILITY_JOB,
  deliverabilitySchedulerId,
} from '../constants/deliverability.constants';
import { buildRepeatSpec } from '../utils/schedule-cadence.util';

const JOB_RETENTION = { removeOnComplete: 50, removeOnFail: 50 };

/**
 * Keeps one BullMQ job scheduler per active schedule in sync with the database, so the schedule
 * row stays the single source of truth and the queue can always be rebuilt from it.
 */
@Injectable()
export class DeliverabilitySchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DeliverabilitySchedulerService.name);

  constructor(
    @InjectQueue(DELIVERABILITY_CHECK_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /** Re-creates any missing schedulers (e.g. after a Redis flush) without touching existing ones. */
  async onModuleInit(): Promise<void> {
    try {
      const active = await this.prisma.deliverabilitySchedule.findMany({
        where: { is_active: true },
      });
      for (const schedule of active) {
        const existing = await this.queue.getJobScheduler(
          deliverabilitySchedulerId(schedule.uuid),
        );
        if (!existing) await this.sync(schedule);
      }
    } catch (error) {
      this.logger.error(
        `Could not restore deliverability schedulers: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /** Creates, updates or removes the scheduler to match the schedule's current state. */
  async sync(schedule: DeliverabilitySchedule): Promise<void> {
    const id = deliverabilitySchedulerId(schedule.uuid);
    if (!schedule.is_active) {
      await this.queue.removeJobScheduler(id);
      return;
    }

    const spec = buildRepeatSpec(schedule);
    const repeat =
      spec.kind === 'cron'
        ? { pattern: spec.pattern, tz: spec.tz }
        : { every: spec.every_ms, startDate: spec.start_date };

    await this.queue.upsertJobScheduler(id, repeat, {
      name: DELIVERABILITY_JOB.RUN_SCHEDULE,
      data: { schedule_uuid: schedule.uuid },
      opts: JOB_RETENTION,
    });
  }

  async remove(schedule_uuid: string): Promise<void> {
    await this.queue.removeJobScheduler(deliverabilitySchedulerId(schedule_uuid));
  }

  async enqueueMailTesterPoll(
    run_uuid: string,
    attempt: number,
    delay_ms: number,
  ): Promise<void> {
    await this.queue.add(
      DELIVERABILITY_JOB.POLL_MAIL_TESTER,
      { run_uuid, attempt },
      { delay: delay_ms, ...JOB_RETENTION },
    );
  }

  async enqueueRunNow(schedule_uuid: string): Promise<void> {
    await this.queue.add(
      DELIVERABILITY_JOB.RUN_SCHEDULE,
      { schedule_uuid },
      JOB_RETENTION,
    );
  }
}
