import { DeliverabilityRiskLevel } from '@/generated/prisma';

/**
 * Check types a schedule can run. Stored as plain strings on the schedule, so adding a type is a
 * code-only change: add a value here and handle it in DeliverabilityRunnerService.
 */
export enum DeliverabilityCheckType {
  DNS = 'DNS',
  MAIL_TESTER = 'MAIL_TESTER',
}

export const DEFAULT_DELIVERABILITY_CHECKS: DeliverabilityCheckType[] = [
  DeliverabilityCheckType.DNS,
  DeliverabilityCheckType.MAIL_TESTER,
];

export const DELIVERABILITY_JOB = {
  RUN_SCHEDULE: 'run-schedule',
  POLL_MAIL_TESTER: 'poll-mail-tester',
} as const;

export const deliverabilitySchedulerId = (schedule_uuid: string) =>
  `deliverability:${schedule_uuid}`;

/** Mail-Tester needs a moment to receive and analyse the email, so results are polled with a delay. */
export const MAIL_TESTER_POLL_DELAY_MS = 45_000;
export const MAIL_TESTER_MAX_POLL_ATTEMPTS = 12;

export const DEFAULT_WARN_THRESHOLD = 70;
export const DEFAULT_CRITICAL_THRESHOLD = 40;

/** Days of sending history used to estimate the daily volume a cap is derived from. */
export const BASELINE_LOOKBACK_DAYS = 7;

/** Share of the baseline daily volume a domain may keep sending at, per risk level (null = no cap). */
export const RISK_VOLUME_FACTOR: Record<DeliverabilityRiskLevel, number | null> = {
  [DeliverabilityRiskLevel.LOW]: null,
  [DeliverabilityRiskLevel.MEDIUM]: 0.7,
  [DeliverabilityRiskLevel.HIGH]: 0.4,
  [DeliverabilityRiskLevel.CRITICAL]: 0.1,
};

/** Ordered lowest to highest; Jev's score is the 0-based probability-weighted level. */
export const JEV_DELIVERABILITY_SCORE_LEVELS: string[] = [
  '10 - Severe: blacklisted or failing core authentication; mail will almost certainly be rejected or marked as spam',
  '20 - Very poor: multiple authentication failures or spam-filter hits; most mail will land in spam',
  '30 - Poor: serious authentication or reputation problems; a large share of mail will land in spam',
  '40 - Weak: clear problems that will hurt inbox placement',
  '50 - Mediocre: several warnings or one real failure; inbox placement is unreliable',
  '60 - Fair: some warnings; inbox placement is likely but not safe at higher volume',
  '70 - Acceptable: minor warnings only',
  '80 - Good: authentication passes with only cosmetic warnings',
  '90 - Very good: authentication and spam checks pass',
  '100 - Excellent: everything passes with no warnings',
];

export const JEV_DELIVERABILITY_INSTRUCTIONS =
  'Rate how safely cold and marketing email can be sent from this domain right now, based on the ' +
  'DNS/email-authentication health report (SPF, DKIM, DMARC, MX, blacklists) and the spam-filter ' +
  'test result. Blacklist listings and failing SPF/DKIM/DMARC weigh most; missing optional records ' +
  '(BIMI, MTA-STS, TLS-RPT) weigh least.';
