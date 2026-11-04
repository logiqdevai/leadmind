import { DeliverabilityRiskLevel } from '@/generated/prisma';
import { RISK_VOLUME_FACTOR } from '../constants/deliverability.constants';
import {
  DeliverabilityEvidence,
  DnsEvidence,
  MailTesterEvidence,
} from './deliverability-evidence.util';

/** DNS commands that decide whether mail is accepted; failures there weigh far more than the rest. */
const CORE_DNS_COMMANDS = new Set(['SPF', 'DKIM', 'DMARC', 'MX', 'BLACKLIST']);

const FAILED_PENALTY = { core: 20, blacklist: 30, other: 6 } as const;
const WARNING_PENALTY = { core: 6, other: 2 } as const;
const ERRORED_PENALTY = 3;

const DNS_WEIGHT = 0.4;
const MAIL_TESTER_WEIGHT = 0.6;

export function scoreDns(evidence: DnsEvidence): number {
  let penalty = evidence.errored.length * ERRORED_PENALTY;
  for (const [command, count] of Object.entries(evidence.failed)) {
    const each =
      command === 'BLACKLIST'
        ? FAILED_PENALTY.blacklist
        : CORE_DNS_COMMANDS.has(command)
          ? FAILED_PENALTY.core
          : FAILED_PENALTY.other;
    penalty += each * count;
  }
  for (const [command, count] of Object.entries(evidence.warnings)) {
    penalty +=
      (CORE_DNS_COMMANDS.has(command) ? WARNING_PENALTY.core : WARNING_PENALTY.other) * count;
  }
  return clampScore(100 - penalty);
}

export function scoreMailTester(evidence: MailTesterEvidence): number | null {
  if (evidence.score_out_of_10 == null) return null;
  return clampScore(evidence.score_out_of_10 * 10);
}

/**
 * Deterministic 0-100 score. Used as the Jev fallback and as a guard rail on Jev's answer.
 * Returns null when there is no usable evidence at all.
 */
export function computeRuleScore(evidence: DeliverabilityEvidence): number | null {
  const dns = evidence.dns ? scoreDns(evidence.dns) : null;
  const mail = evidence.mail_tester ? scoreMailTester(evidence.mail_tester) : null;

  if (dns != null && mail != null) {
    return clampScore(dns * DNS_WEIGHT + mail * MAIL_TESTER_WEIGHT);
  }
  return dns ?? mail;
}

/** LOW at/above warn, CRITICAL below critical, MEDIUM/HIGH split the band in between. */
export function resolveRiskLevel(
  score: number,
  thresholds: { warn: number; critical: number },
): DeliverabilityRiskLevel {
  if (score >= thresholds.warn) return DeliverabilityRiskLevel.LOW;
  if (score < thresholds.critical) return DeliverabilityRiskLevel.CRITICAL;
  const midpoint = (thresholds.warn + thresholds.critical) / 2;
  return score >= midpoint
    ? DeliverabilityRiskLevel.MEDIUM
    : DeliverabilityRiskLevel.HIGH;
}

/** Daily send cap for a risk level, or null when no cap applies (healthy, or no volume to scale). */
export function recommendDailyCap(
  risk: DeliverabilityRiskLevel,
  baseline_daily_volume: number,
): number | null {
  const factor = RISK_VOLUME_FACTOR[risk];
  if (factor == null || baseline_daily_volume <= 0) return null;
  return Math.max(1, Math.floor(baseline_daily_volume * factor));
}

/** Human-readable findings, ordered by severity, for the run summary (Jev returns no prose). */
export function summariseEvidence(evidence: DeliverabilityEvidence): string {
  const lines: string[] = [];
  const dns = evidence.dns;
  if (dns) {
    for (const [command, count] of Object.entries(dns.failed)) {
      lines.push(`${command}: ${count} failed check${count > 1 ? 's' : ''}`);
    }
    for (const [command, count] of Object.entries(dns.warnings)) {
      lines.push(`${command}: ${count} warning${count > 1 ? 's' : ''}`);
    }
  }
  const mail = evidence.mail_tester;
  if (mail) {
    if (mail.score_out_of_10 != null) lines.push(`Mail-Tester score ${mail.score_out_of_10}/10`);
    if (mail.blacklist_hits > 0) lines.push(`Listed on ${mail.blacklist_hits} blacklist(s)`);
    for (const failure of mail.auth_failures) lines.push(failure);
  }
  return lines.length ? lines.join('; ') : 'No problems found';
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
