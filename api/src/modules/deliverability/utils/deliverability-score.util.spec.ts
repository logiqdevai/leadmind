import { DeliverabilityRiskLevel } from '@/generated/prisma';
import {
  computeRuleScore,
  recommendDailyCap,
  resolveRiskLevel,
  scoreDns,
} from './deliverability-score.util';
import {
  extractDnsEvidence,
  extractMailTesterEvidence,
} from './deliverability-evidence.util';

const ok = (failed = 0, warnings = 0, passed = 3) => ({
  ok: true,
  failed: Array(failed).fill({}),
  warnings: Array(warnings).fill({}),
  passed: Array(passed).fill({}),
});

describe('scoreDns', () => {
  it('scores a clean report 100', () => {
    const evidence = extractDnsEvidence({ SPF: ok(), DMARC: ok() })!;
    expect(scoreDns(evidence)).toBe(100);
  });

  it('weighs a blacklist hit heavier than a core failure, and core heavier than optional', () => {
    const blacklist = scoreDns(extractDnsEvidence({ BLACKLIST: ok(1) })!);
    const core = scoreDns(extractDnsEvidence({ SPF: ok(1) })!);
    const optional = scoreDns(extractDnsEvidence({ BIMI: ok(1) })!);
    expect(blacklist).toBeLessThan(core);
    expect(core).toBeLessThan(optional);
  });

  it('never goes below 0', () => {
    expect(scoreDns(extractDnsEvidence({ SPF: ok(10), DMARC: ok(10) })!)).toBe(0);
  });

  it('treats an all-errored report as no evidence', () => {
    const errored = { ok: false, error: 'timeout', failed: [], warnings: [], passed: [] };
    expect(extractDnsEvidence({ SPF: errored, MX: errored })).toBeNull();
  });
});

describe('computeRuleScore', () => {
  const dns = extractDnsEvidence({ SPF: ok(), DMARC: ok() });
  const mail = extractMailTesterEvidence({ status: true, displayedMark: '8/10' });

  it('blends DNS (40%) and Mail-Tester (60%)', () => {
    expect(computeRuleScore({ dns, mail_tester: mail })).toBe(88);
  });

  it('uses whichever component is available', () => {
    expect(computeRuleScore({ dns, mail_tester: null })).toBe(100);
    expect(computeRuleScore({ dns: null, mail_tester: mail })).toBe(80);
  });

  it('returns null with no evidence', () => {
    expect(computeRuleScore({ dns: null, mail_tester: null })).toBeNull();
  });
});

describe('resolveRiskLevel', () => {
  const thresholds = { warn: 70, critical: 40 };

  it.each([
    [90, DeliverabilityRiskLevel.LOW],
    [70, DeliverabilityRiskLevel.LOW],
    [60, DeliverabilityRiskLevel.MEDIUM],
    [45, DeliverabilityRiskLevel.HIGH],
    [39, DeliverabilityRiskLevel.CRITICAL],
  ])('score %i -> %s', (score, expected) => {
    expect(resolveRiskLevel(score, thresholds)).toBe(expected);
  });
});

describe('recommendDailyCap', () => {
  it('applies no cap when healthy or when there is no sending history', () => {
    expect(recommendDailyCap(DeliverabilityRiskLevel.LOW, 100)).toBeNull();
    expect(recommendDailyCap(DeliverabilityRiskLevel.HIGH, 0)).toBeNull();
  });

  it('scales the baseline by risk and never drops below 1', () => {
    expect(recommendDailyCap(DeliverabilityRiskLevel.MEDIUM, 100)).toBe(70);
    expect(recommendDailyCap(DeliverabilityRiskLevel.HIGH, 100)).toBe(40);
    expect(recommendDailyCap(DeliverabilityRiskLevel.CRITICAL, 3)).toBe(1);
  });
});
