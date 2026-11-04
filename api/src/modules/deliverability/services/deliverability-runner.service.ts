import { Injectable, Logger } from '@nestjs/common';
import {
  DeliverabilityRun,
  DeliverabilityRunStatus,
  DeliverabilitySchedule,
  MailTesterTestStatus,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { MxToolboxService } from '@/modules/mxtoolbox/mxtoolbox.service';
import { MailTesterService } from '@/modules/mail-tester/mail-tester.service';
import { MailTesterResult } from '@/integrations/mail-tester/interfaces/mail-tester.interface';
import {
  DeliverabilityCheckType,
  MAIL_TESTER_MAX_POLL_ATTEMPTS,
  MAIL_TESTER_POLL_DELAY_MS,
} from '../constants/deliverability.constants';
import {
  DeliverabilityEvidence,
  StoredMxToolboxCommandResult,
  extractDnsEvidence,
  extractMailTesterEvidence,
} from '../utils/deliverability-evidence.util';
import { DeliverabilityGuardService } from './deliverability-guard.service';
import { DeliverabilitySchedulerService } from './deliverability-scheduler.service';
import { DeliverabilityScoringService } from './deliverability-scoring.service';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Executes one scheduled run: start the selected checks, wait for the asynchronous ones
 * (Mail-Tester) via delayed poll jobs rather than blocking a worker, then score the evidence and
 * apply the schedule's action. New check types plug in at `startChecks` and `collectEvidence`.
 */
@Injectable()
export class DeliverabilityRunnerService {
  private readonly logger = new Logger(DeliverabilityRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mxToolboxService: MxToolboxService,
    private readonly mailTesterService: MailTesterService,
    private readonly scoringService: DeliverabilityScoringService,
    private readonly guardService: DeliverabilityGuardService,
    private readonly schedulerService: DeliverabilitySchedulerService,
  ) {}

  async startRun(schedule_uuid: string): Promise<DeliverabilityRun | null> {
    const schedule = await this.prisma.deliverabilitySchedule.findUnique({
      where: { uuid: schedule_uuid },
    });
    if (!schedule) {
      this.logger.warn(`Schedule ${schedule_uuid} no longer exists, skipping run`);
      return null;
    }

    const run = await this.prisma.deliverabilityRun.create({
      data: { schedule_uuid },
    });

    try {
      const started = await this.startChecks(schedule);
      await this.prisma.deliverabilityRun.update({
        where: { uuid: run.uuid },
        data: started,
      });

      if (started.mail_tester_test_uuid) {
        await this.schedulerService.enqueueMailTesterPoll(
          run.uuid,
          1,
          MAIL_TESTER_POLL_DELAY_MS,
        );
      } else {
        await this.finalizeRun(run.uuid);
      }
    } catch (error) {
      await this.failRun(run.uuid, errorMessage(error));
    }
    return run;
  }

  /** Re-checks the Mail-Tester result; finalises once it is ready or attempts run out. */
  async pollMailTester(run_uuid: string, attempt: number): Promise<void> {
    const run = await this.prisma.deliverabilityRun.findUnique({
      where: { uuid: run_uuid },
      include: { schedule: true },
    });
    if (!run || run.status !== DeliverabilityRunStatus.RUNNING || !run.mail_tester_test_uuid) {
      return;
    }

    try {
      const test = await this.mailTesterService.refreshResult(
        run.schedule.organisation_uuid,
        run.mail_tester_test_uuid,
      );
      if (test.status === MailTesterTestStatus.COMPLETED) {
        await this.finalizeRun(run_uuid);
        return;
      }
    } catch (error) {
      // A transient API error is retried like "not ready yet".
      this.logger.warn(`Mail-Tester poll failed for run ${run_uuid}: ${errorMessage(error)}`);
    }

    if (attempt >= MAIL_TESTER_MAX_POLL_ATTEMPTS) {
      // Score from whatever finished (e.g. DNS) rather than discarding the whole run.
      await this.finalizeRun(run_uuid);
      return;
    }
    await this.schedulerService.enqueueMailTesterPoll(
      run_uuid,
      attempt + 1,
      MAIL_TESTER_POLL_DELAY_MS,
    );
  }

  private async startChecks(
    schedule: DeliverabilitySchedule,
  ): Promise<{ mxtoolbox_check_uuid?: string; mail_tester_test_uuid?: string }> {
    const label = `Scheduled${schedule.label ? `: ${schedule.label}` : ''}`;
    const started: { mxtoolbox_check_uuid?: string; mail_tester_test_uuid?: string } = {};
    const failures: string[] = [];

    if (schedule.checks.includes(DeliverabilityCheckType.DNS)) {
      try {
        const check = await this.mxToolboxService.startCheck(schedule.organisation_uuid, {
          domain: schedule.domain,
          label,
          dkim_selector: schedule.dkim_selector ?? undefined,
        });
        started.mxtoolbox_check_uuid = check.uuid;
      } catch (error) {
        failures.push(`DNS check: ${errorMessage(error)}`);
      }
    }

    if (
      schedule.checks.includes(DeliverabilityCheckType.MAIL_TESTER) &&
      schedule.from_provider &&
      schedule.from_account
    ) {
      try {
        const test = await this.mailTesterService.startTest(schedule.organisation_uuid, {
          label,
          from: {
            provider: schedule.from_provider as 'RESEND' | 'SMTP',
            account: schedule.from_account,
            domain_uuid: schedule.integration_account_domain_uuid ?? undefined,
          },
        });
        started.mail_tester_test_uuid = test.uuid;
      } catch (error) {
        failures.push(`Mail-Tester: ${errorMessage(error)}`);
      }
    }

    if (!started.mxtoolbox_check_uuid && !started.mail_tester_test_uuid) {
      throw new Error(failures.join('; ') || 'No checks could be started');
    }
    if (failures.length) {
      this.logger.warn(`Schedule ${schedule.uuid}: partial start - ${failures.join('; ')}`);
    }
    return started;
  }

  private async collectEvidence(run: DeliverabilityRun): Promise<DeliverabilityEvidence> {
    const [check, test] = await Promise.all([
      run.mxtoolbox_check_uuid
        ? this.prisma.mxToolboxCheck.findUnique({ where: { uuid: run.mxtoolbox_check_uuid } })
        : null,
      run.mail_tester_test_uuid
        ? this.prisma.mailTesterTest.findUnique({ where: { uuid: run.mail_tester_test_uuid } })
        : null,
    ]);

    return {
      dns: extractDnsEvidence(
        check?.results as unknown as Record<string, StoredMxToolboxCommandResult> | undefined,
      ),
      mail_tester:
        test?.status === MailTesterTestStatus.COMPLETED
          ? extractMailTesterEvidence(test.result as unknown as MailTesterResult)
          : null,
    };
  }

  async finalizeRun(run_uuid: string): Promise<void> {
    const run = await this.prisma.deliverabilityRun.findUnique({
      where: { uuid: run_uuid },
      include: { schedule: true },
    });
    if (!run || run.status !== DeliverabilityRunStatus.RUNNING) return;
    const { schedule } = run;

    try {
      const evidence = await this.collectEvidence(run);
      const scored = await this.scoringService.score(
        schedule.organisation_uuid,
        schedule.domain,
        evidence,
        { warn: schedule.warn_threshold, critical: schedule.critical_threshold },
      );
      if (!scored) {
        await this.failRun(run_uuid, 'No usable check results to score');
        return;
      }

      const { action, recommended_daily_cap } =
        await this.guardService.applyActionForRun(
          schedule,
          run.uuid,
          scored.score,
          scored.risk_level,
        );

      await this.prisma.$transaction([
        this.prisma.deliverabilityRun.update({
          where: { uuid: run_uuid },
          data: {
            status: DeliverabilityRunStatus.COMPLETED,
            score: scored.score,
            risk_level: scored.risk_level,
            scored_by: scored.scored_by,
            jev_confidence: scored.jev_confidence,
            summary: scored.summary,
            recommended_daily_cap,
            action_taken: action,
            finished_at: new Date(),
          },
        }),
        this.prisma.deliverabilitySchedule.update({
          where: { uuid: schedule.uuid },
          data: { last_run_at: new Date() },
        }),
      ]);
      this.logger.log(
        `Deliverability run ${run_uuid} domain=${schedule.domain} score=${scored.score} risk=${scored.risk_level} by=${scored.scored_by} action=${action}`,
      );
    } catch (error) {
      await this.failRun(run_uuid, errorMessage(error));
    }
  }

  private async failRun(run_uuid: string, message: string): Promise<void> {
    this.logger.error(`Deliverability run ${run_uuid} failed: ${message}`);
    await this.prisma.deliverabilityRun.update({
      where: { uuid: run_uuid },
      data: {
        status: DeliverabilityRunStatus.FAILED,
        error_message: message.slice(0, 1000),
        finished_at: new Date(),
      },
    });
  }
}
