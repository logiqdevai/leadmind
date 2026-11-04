import { MailTesterResult } from '@/integrations/mail-tester/interfaces/mail-tester.interface';

/** Per-command shape persisted in MxToolboxCheck.results. */
export interface StoredMxToolboxCommandResult {
  ok: boolean;
  error?: string;
  failed: unknown[];
  warnings: unknown[];
  passed: unknown[];
}

export interface DnsEvidence {
  /** Failed-item count per MxToolbox command, only commands with at least one failure. */
  failed: Record<string, number>;
  warnings: Record<string, number>;
  /** Commands whose lookup itself errored (no verdict either way). */
  errored: string[];
  passed_count: number;
}

export interface MailTesterEvidence {
  score_out_of_10: number | null;
  spamassassin_score: number | null;
  spamassassin_threshold: number | null;
  blacklist_hits: number;
  /** Titles of authentication sub-checks (SPF/DKIM/DMARC/rDNS) that did not pass. */
  auth_failures: string[];
}

export interface DeliverabilityEvidence {
  dns: DnsEvidence | null;
  mail_tester: MailTesterEvidence | null;
}

export function extractDnsEvidence(
  results: Record<string, StoredMxToolboxCommandResult> | null | undefined,
): DnsEvidence | null {
  if (!results || Object.keys(results).length === 0) return null;

  const evidence: DnsEvidence = {
    failed: {},
    warnings: {},
    errored: [],
    passed_count: 0,
  };
  for (const [command, result] of Object.entries(results)) {
    if (!result.ok) {
      evidence.errored.push(command);
      continue;
    }
    if (result.failed.length) evidence.failed[command] = result.failed.length;
    if (result.warnings.length) evidence.warnings[command] = result.warnings.length;
    evidence.passed_count += result.passed.length;
  }
  // Every lookup errored: there is nothing to judge the domain on.
  if (evidence.errored.length === Object.keys(results).length) return null;
  return evidence;
}

/** Mail-Tester only returns the final mark pre-formatted ("6.5/10"); `mark` is the raw penalty. */
export function extractMailTesterScore(result: MailTesterResult): number | null {
  if (typeof result.displayedMark === 'string') {
    const match = result.displayedMark.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }
  if (typeof result.mark === 'number') {
    return Math.round((10 + result.mark) * 10) / 10;
  }
  return null;
}

export function extractMailTesterEvidence(
  result: MailTesterResult | null | undefined,
): MailTesterEvidence | null {
  if (!result || result.status !== true) return null;

  const authFailures = Object.values(result.signature?.subtests ?? {})
    .filter(
      (check) => check.statusClass === 'failure' || check.statusClass === 'warning',
    )
    .map((check) => (check.title ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return {
    score_out_of_10: extractMailTesterScore(result),
    spamassassin_score: result.spamAssassin?.score ?? null,
    spamassassin_threshold: result.spamAssassin?.threshold ?? null,
    blacklist_hits: result.blacklists?.hits ?? 0,
    auth_failures: authFailures,
  };
}
