import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DELIVERABILITY_CHECK_QUEUE } from '@/core/queues/queues.constants';
import { DELIVERABILITY_JOB } from '@/modules/deliverability/constants/deliverability.constants';
import { DeliverabilityRunnerService } from '@/modules/deliverability/services/deliverability-runner.service';

interface RunScheduleJob {
  schedule_uuid: string;
}

interface PollMailTesterJob {
  run_uuid: string;
  attempt: number;
}

/**
 * Handles both the repeatable per-schedule trigger and the delayed Mail-Tester polls. Polling is
 * a separate delayed job (not a sleep inside the run) so a worker slot is never held while
 * waiting for Mail-Tester to receive the test email.
 */
@Processor(DELIVERABILITY_CHECK_QUEUE, { concurrency: 3 })
export class DeliverabilityCheckWorker extends WorkerHost {
  private readonly logger = new Logger(DeliverabilityCheckWorker.name);

  constructor(private readonly runner: DeliverabilityRunnerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case DELIVERABILITY_JOB.RUN_SCHEDULE:
        await this.runner.startRun((job.data as RunScheduleJob).schedule_uuid);
        return;
      case DELIVERABILITY_JOB.POLL_MAIL_TESTER: {
        const { run_uuid, attempt } = job.data as PollMailTesterJob;
        await this.runner.pollMailTester(run_uuid, attempt);
        return;
      }
      default:
        this.logger.warn(`Ignoring unknown deliverability job "${job.name}"`);
    }
  }
}
