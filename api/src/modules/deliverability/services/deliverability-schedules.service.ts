import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliverabilityActionMode,
  DeliverabilityFrequency,
  DeliverabilityRun,
  DeliverabilitySchedule,
  DomainSendingGuard,
  Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EmailCredentialsService } from '@/modules/integrations/services/email-credentials.service';
import {
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_DELIVERABILITY_CHECKS,
  DEFAULT_WARN_THRESHOLD,
  DeliverabilityCheckType,
} from '../constants/deliverability.constants';
import { CreateDeliverabilityScheduleDto } from '../dto/create-deliverability-schedule.dto';
import { UpdateDeliverabilityScheduleDto } from '../dto/update-deliverability-schedule.dto';
import { buildRepeatSpec, isValidTimezone } from '../utils/schedule-cadence.util';
import { DeliverabilityGuardService } from './deliverability-guard.service';
import { DeliverabilitySchedulerService } from './deliverability-scheduler.service';

const RUN_LIST_LIMIT = 30;

type ScheduleTarget = Pick<
  DeliverabilitySchedule,
  | 'domain'
  | 'integration_account_uuid'
  | 'integration_account_domain_uuid'
  | 'from_provider'
  | 'from_account'
>;

/** The schedule fields a create/update resolves to, before they are written. */
type ScheduleFields = Omit<
  Prisma.DeliverabilityScheduleUncheckedCreateInput,
  'organisation_uuid'
>;

export type DeliverabilityScheduleView = DeliverabilitySchedule & {
  latest_run: DeliverabilityRun | null;
  guard: Pick<DomainSendingGuard, 'daily_cap' | 'paused' | 'updated_at'> | null;
};

@Injectable()
export class DeliverabilitySchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailCredentialsService: EmailCredentialsService,
    private readonly guardService: DeliverabilityGuardService,
    private readonly schedulerService: DeliverabilitySchedulerService,
  ) {}

  async list(organisation_uuid: string): Promise<DeliverabilityScheduleView[]> {
    const rows = await this.prisma.deliverabilitySchedule.findMany({
      where: { organisation_uuid },
      orderBy: { created_at: 'desc' },
      include: {
        runs: { orderBy: { created_at: 'desc' }, take: 1 },
        guard: { select: { daily_cap: true, paused: true, updated_at: true } },
      },
    });
    return rows.map(({ runs, guard, ...schedule }) => ({
      ...schedule,
      latest_run: runs[0] ?? null,
      guard,
    }));
  }

  async create(
    organisation_uuid: string,
    dto: CreateDeliverabilityScheduleDto,
  ): Promise<DeliverabilitySchedule> {
    const target = await this.resolveTarget(organisation_uuid, dto);
    const fields = this.buildFields(dto, target);
    this.assertValid(fields);

    const schedule = await this.prisma.deliverabilitySchedule.create({
      data: { ...fields, organisation_uuid },
    });
    await this.schedulerService.sync(schedule);
    return schedule;
  }

  async update(
    organisation_uuid: string,
    uuid: string,
    dto: UpdateDeliverabilityScheduleDto,
  ): Promise<DeliverabilitySchedule> {
    const existing = await this.requireOwned(organisation_uuid, uuid);

    const retarget = dto.from !== undefined || dto.custom_domain !== undefined;
    const target: ScheduleTarget = retarget
      ? await this.resolveTarget(organisation_uuid, dto)
      : existing;

    const merged = { ...existing, ...stripUndefined(dto) } as unknown as CreateDeliverabilityScheduleDto;
    const fields = this.buildFields(merged, target);
    this.assertValid(fields);

    const schedule = await this.prisma.deliverabilitySchedule.update({
      where: { uuid },
      data: fields,
    });
    await this.schedulerService.sync(schedule);

    const restrictionStale =
      retarget ||
      !schedule.is_active ||
      schedule.action_mode === DeliverabilityActionMode.RECOMMEND;
    if (restrictionStale) await this.guardService.lift(uuid);
    return schedule;
  }

  async remove(organisation_uuid: string, uuid: string): Promise<{ uuid: string }> {
    await this.requireOwned(organisation_uuid, uuid);
    await this.schedulerService.remove(uuid);
    // Runs and the sending guard cascade, so any restriction ends with the schedule.
    await this.prisma.deliverabilitySchedule.delete({ where: { uuid } });
    return { uuid };
  }

  async runNow(organisation_uuid: string, uuid: string): Promise<{ queued: true }> {
    await this.requireOwned(organisation_uuid, uuid);
    await this.schedulerService.enqueueRunNow(uuid);
    return { queued: true };
  }

  async listRuns(
    organisation_uuid: string,
    uuid: string,
  ): Promise<DeliverabilityRun[]> {
    await this.requireOwned(organisation_uuid, uuid);
    return this.prisma.deliverabilityRun.findMany({
      where: { schedule_uuid: uuid },
      orderBy: { created_at: 'desc' },
      take: RUN_LIST_LIMIT,
    });
  }

  /** RECOMMEND mode: the user accepts a run's suggested cap, which becomes an enforced guard. */
  async applyRecommendation(
    organisation_uuid: string,
    run_uuid: string,
  ): Promise<DeliverabilityRun> {
    const run = await this.prisma.deliverabilityRun.findFirst({
      where: { uuid: run_uuid, schedule: { organisation_uuid } },
      include: { schedule: true },
    });
    if (!run) throw new NotFoundException(`Run ${run_uuid} not found`);
    if (run.recommended_daily_cap == null) {
      throw new BadRequestException('This run has no recommended send cap to apply');
    }
    if (!this.guardService.canEnforce(run.schedule)) {
      throw new BadRequestException(
        'Sending can only be limited for schedules that target an integration account',
      );
    }

    const { schedule, ...plain } = run;
    await this.guardService.applyRecommendedCap(schedule, plain);
    return this.prisma.deliverabilityRun.update({
      where: { uuid: run_uuid },
      data: { action_taken: 'APPLIED' },
    });
  }

  async liftRestriction(organisation_uuid: string, uuid: string): Promise<{ lifted: boolean }> {
    await this.requireOwned(organisation_uuid, uuid);
    return { lifted: await this.guardService.lift(uuid) };
  }

  private async requireOwned(
    organisation_uuid: string,
    uuid: string,
  ): Promise<DeliverabilitySchedule> {
    const schedule = await this.prisma.deliverabilitySchedule.findFirst({
      where: { uuid, organisation_uuid },
    });
    if (!schedule) throw new NotFoundException(`Schedule ${uuid} not found`);
    return schedule;
  }

  /** Resolves "which domain, and which account sends the test mail" from the request. */
  private async resolveTarget(
    organisation_uuid: string,
    dto: Pick<CreateDeliverabilityScheduleDto, 'from' | 'custom_domain'>,
  ): Promise<ScheduleTarget> {
    if (Boolean(dto.from) === Boolean(dto.custom_domain)) {
      throw new BadRequestException(
        'Provide exactly one of "from" (an integration account) or "custom_domain"',
      );
    }

    if (dto.custom_domain) {
      return {
        domain: dto.custom_domain.trim().toLowerCase(),
        integration_account_uuid: null,
        integration_account_domain_uuid: null,
        from_provider: null,
        from_account: null,
      };
    }

    const { provider, account, domain_uuid } = dto.from!;
    await this.emailCredentialsService.assertSendableAccount(
      organisation_uuid,
      provider,
      account,
    );
    const accountRow = await this.prisma.integrationAccount.findFirst({
      where: {
        account: account.trim(),
        integration: { organisation_uuid, provider },
      },
      include: { domains: { select: { uuid: true } } },
    });
    if (!accountRow) {
      throw new BadRequestException(`${provider} account "${account}" not found`);
    }
    if (domain_uuid && !accountRow.domains.some((d) => d.uuid === domain_uuid)) {
      throw new BadRequestException(
        `Domain ${domain_uuid} does not belong to account "${account}"`,
      );
    }

    const fromEmail = await this.emailCredentialsService.resolveFromEmailForDisplay(
      organisation_uuid,
      provider,
      account,
      domain_uuid,
    );
    const domain = fromEmail?.split('@')[1]?.trim().toLowerCase();
    if (!domain) {
      throw new BadRequestException(
        `Could not determine the sending domain of ${provider} account "${account}"`,
      );
    }

    return {
      domain,
      integration_account_uuid: accountRow.uuid,
      integration_account_domain_uuid: domain_uuid ?? null,
      from_provider: provider,
      from_account: account.trim(),
    };
  }

  /** Normalises a request into stored fields; cadence values irrelevant to the frequency are dropped. */
  private buildFields(
    input: Omit<Partial<CreateDeliverabilityScheduleDto>, 'from' | 'custom_domain'> &
      Pick<CreateDeliverabilityScheduleDto, 'frequency' | 'time_of_day' | 'timezone'>,
    target: ScheduleTarget,
  ): ScheduleFields {
    const { frequency } = input;
    return {
      label: input.label?.trim() || null,
      ...target,
      dkim_selector: input.dkim_selector?.trim() || null,
      frequency,
      time_of_day: input.time_of_day,
      weekday: frequency === DeliverabilityFrequency.WEEKLY ? (input.weekday ?? null) : null,
      day_of_month:
        frequency === DeliverabilityFrequency.MONTHLY ? (input.day_of_month ?? null) : null,
      interval_days:
        frequency === DeliverabilityFrequency.EVERY_N_DAYS ? (input.interval_days ?? null) : null,
      timezone: input.timezone,
      checks: input.checks?.length ? input.checks : DEFAULT_DELIVERABILITY_CHECKS,
      action_mode: input.action_mode ?? DeliverabilityActionMode.RECOMMEND,
      warn_threshold: input.warn_threshold ?? DEFAULT_WARN_THRESHOLD,
      critical_threshold: input.critical_threshold ?? DEFAULT_CRITICAL_THRESHOLD,
      is_active: input.is_active ?? true,
    };
  }

  private assertValid(fields: ScheduleFields): void {
    if (!isValidTimezone(fields.timezone!)) {
      throw new BadRequestException(`"${fields.timezone}" is not a valid timezone`);
    }
    if ((fields.critical_threshold ?? 0) >= (fields.warn_threshold ?? 0)) {
      throw new BadRequestException('critical_threshold must be lower than warn_threshold');
    }

    const checks = (fields.checks as string[] | undefined) ?? [];
    const hasAccount = fields.integration_account_uuid != null;
    if (checks.includes(DeliverabilityCheckType.MAIL_TESTER) && !hasAccount) {
      throw new BadRequestException(
        'Mail-Tester checks need an integration account to send the test email from',
      );
    }
    if (fields.action_mode !== DeliverabilityActionMode.RECOMMEND && !hasAccount) {
      throw new BadRequestException(
        'Throttling or pausing sending needs an integration account, not a custom domain',
      );
    }

    try {
      buildRepeatSpec({
        frequency: fields.frequency,
        time_of_day: fields.time_of_day,
        weekday: fields.weekday,
        day_of_month: fields.day_of_month,
        interval_days: fields.interval_days,
        timezone: fields.timezone!,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid schedule');
    }
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
