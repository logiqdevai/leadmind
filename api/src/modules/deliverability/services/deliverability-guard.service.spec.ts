import {
  DeliverabilityActionMode,
  DeliverabilityRiskLevel,
  DeliverabilitySchedule,
  DomainSendingGuard,
} from '@/generated/prisma';
import { DeliverabilityGuardService } from './deliverability-guard.service';

const schedule = (overrides: Partial<DeliverabilitySchedule> = {}) =>
  ({
    uuid: 'sched-1',
    organisation_uuid: 'org-1',
    integration_account_uuid: 'acc-1',
    integration_account_domain_uuid: null,
    from_provider: 'RESEND',
    from_account: '1',
    action_mode: DeliverabilityActionMode.THROTTLE,
    critical_threshold: 40,
    ...overrides,
  }) as DeliverabilitySchedule;

function setup(opts: { sentLastWeek?: number; guard?: Partial<DomainSendingGuard> | null } = {}) {
  const prisma = {
    outreachMessage: { count: jest.fn().mockResolvedValue(opts.sentLastWeek ?? 0) },
    domainSendingGuard: {
      findUnique: jest.fn().mockResolvedValue(opts.guard ?? null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: opts.guard ? 1 : 0 }),
    },
  };
  return { prisma, service: new DeliverabilityGuardService(prisma as never) };
}

describe('DeliverabilityGuardService.applyActionForRun', () => {
  it('throttles to a share of the recent daily volume when the risk is not LOW', async () => {
    const { service, prisma } = setup({ sentLastWeek: 700 }); // 100/day
    const result = await service.applyActionForRun(schedule(), 'run-1', 55, DeliverabilityRiskLevel.MEDIUM);

    expect(result).toEqual({ action: 'THROTTLED', recommended_daily_cap: 70 });
    expect(prisma.domainSendingGuard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ daily_cap: 70, paused: false, baseline_daily_volume: 100 }),
      }),
    );
  });

  it('keeps the frozen baseline instead of re-measuring throttled volume', async () => {
    const { service } = setup({
      sentLastWeek: 70, // 10/day after throttling
      guard: { baseline_daily_volume: 100 },
    });
    const result = await service.applyActionForRun(schedule(), 'run-2', 30, DeliverabilityRiskLevel.CRITICAL);
    expect(result.recommended_daily_cap).toBe(10);
  });

  it('pauses only in PAUSE mode and below the critical threshold', async () => {
    const pauseMode = schedule({ action_mode: DeliverabilityActionMode.PAUSE });

    const critical = setup({ sentLastWeek: 70 });
    const paused = await critical.service.applyActionForRun(pauseMode, 'r', 20, DeliverabilityRiskLevel.CRITICAL);
    expect(paused.action).toBe('PAUSED');
    expect(critical.prisma.domainSendingGuard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ paused: true }) }),
    );

    const warn = setup({ sentLastWeek: 70 });
    const throttled = await warn.service.applyActionForRun(pauseMode, 'r', 50, DeliverabilityRiskLevel.HIGH);
    expect(throttled.action).toBe('THROTTLED');
  });

  it('lifts an existing restriction once the score recovers', async () => {
    const { service, prisma } = setup({ guard: { baseline_daily_volume: 100 } });
    const result = await service.applyActionForRun(schedule(), 'run-3', 90, DeliverabilityRiskLevel.LOW);

    expect(result).toEqual({ action: 'LIFTED', recommended_daily_cap: null });
    expect(prisma.domainSendingGuard.deleteMany).toHaveBeenCalledWith({ where: { schedule_uuid: 'sched-1' } });
  });

  it('only recommends in RECOMMEND mode and never leaves a guard behind', async () => {
    const { service, prisma } = setup({ sentLastWeek: 700, guard: { baseline_daily_volume: 100 } });
    const result = await service.applyActionForRun(
      schedule({ action_mode: DeliverabilityActionMode.RECOMMEND }),
      'run-4',
      55,
      DeliverabilityRiskLevel.MEDIUM,
    );

    expect(result).toEqual({ action: 'RECOMMENDED', recommended_daily_cap: 70 });
    expect(prisma.domainSendingGuard.upsert).not.toHaveBeenCalled();
    expect(prisma.domainSendingGuard.deleteMany).toHaveBeenCalled();
  });

  it('cannot enforce for a custom-domain schedule, so it recommends instead', async () => {
    const { service, prisma } = setup({ sentLastWeek: 700 });
    const result = await service.applyActionForRun(
      schedule({ integration_account_uuid: null }),
      'run-5',
      55,
      DeliverabilityRiskLevel.MEDIUM,
    );
    expect(result.action).toBe('RECOMMENDED');
    expect(prisma.domainSendingGuard.upsert).not.toHaveBeenCalled();
  });
});
