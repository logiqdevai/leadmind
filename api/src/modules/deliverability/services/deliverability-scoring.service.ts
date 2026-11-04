import { Injectable, Logger } from '@nestjs/common';
import { DeliverabilityRiskLevel } from '@/generated/prisma';
import { JevClient } from '@/integrations/jev/jev.client';
import { JevScoreQuestion } from '@/integrations/jev/interfaces/jev.interface';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import {
  JEV_DELIVERABILITY_INSTRUCTIONS,
  JEV_DELIVERABILITY_SCORE_LEVELS,
} from '../constants/deliverability.constants';
import { DeliverabilityEvidence } from '../utils/deliverability-evidence.util';
import {
  computeRuleScore,
  resolveRiskLevel,
  summariseEvidence,
} from '../utils/deliverability-score.util';

export interface DeliverabilityScoreResult {
  score: number;
  risk_level: DeliverabilityRiskLevel;
  scored_by: 'jev' | 'rules';
  jev_confidence: number | null;
  summary: string;
}

/** Jev may not rate a domain more than this far above what the hard rules allow. */
const JEV_MAX_UPLIFT_OVER_RULES = 15;
const JEV_MIN_CONFIDENCE = 0.5;
const QUESTION_KEY = 'deliverability';

@Injectable()
export class DeliverabilityScoringService {
  private readonly logger = new Logger(DeliverabilityScoringService.name);

  constructor(
    private readonly jevClient: JevClient,
    private readonly aiCredentialsService: AiCredentialsService,
  ) {}

  /**
   * Scores a domain 0-100 from the collected check evidence. Jev judges the evidence (so it can
   * weigh combinations of findings); the deterministic rule score is the fallback when Jev is
   * not configured, errors, or is not confident, and also caps how far Jev can rate a domain
   * above the hard rules, so a blacklist hit can never be talked away.
   *
   * Returns null when there is no evidence to score.
   */
  async score(
    organisation_uuid: string,
    domain: string,
    evidence: DeliverabilityEvidence,
    thresholds: { warn: number; critical: number },
  ): Promise<DeliverabilityScoreResult | null> {
    const ruleScore = computeRuleScore(evidence);
    if (ruleScore == null) return null;

    const summary = summariseEvidence(evidence);
    const jev = await this.askJev(organisation_uuid, domain, evidence);

    const useJev = jev != null && jev.confidence >= JEV_MIN_CONFIDENCE;
    const score = useJev
      ? Math.min(jev.score, ruleScore + JEV_MAX_UPLIFT_OVER_RULES)
      : ruleScore;

    return {
      score,
      risk_level: resolveRiskLevel(score, thresholds),
      scored_by: useJev ? 'jev' : 'rules',
      jev_confidence: jev?.confidence ?? null,
      summary,
    };
  }

  private async askJev(
    organisation_uuid: string,
    domain: string,
    evidence: DeliverabilityEvidence,
  ): Promise<{ score: number; confidence: number } | null> {
    try {
      const apiKey =
        await this.aiCredentialsService.getTypesafeApiKey(organisation_uuid);
      const question: JevScoreQuestion = {
        type: 'score',
        instructions: JEV_DELIVERABILITY_INSTRUCTIONS,
        criteria: JEV_DELIVERABILITY_SCORE_LEVELS,
      };
      const result = await this.jevClient.decide(
        { domain, ...evidence },
        { [QUESTION_KEY]: question },
        { apiKey },
      );
      const answer = result.answers?.[QUESTION_KEY];
      if (!answer || answer.type !== 'score' || !Number.isFinite(answer.score)) {
        return null;
      }
      // Level 0 is the lowest description ("10 - ..."), so level n maps to (n + 1) * 10.
      const levels = JEV_DELIVERABILITY_SCORE_LEVELS.length;
      const score = Math.round(((answer.score + 1) / levels) * 100);
      return {
        score: Math.max(0, Math.min(100, score)),
        confidence: answer.confidence ?? 0,
      };
    } catch (error) {
      // Not configured is the normal case for orgs without a TypeSafe key; the fallback covers it.
      this.logger.debug(
        `Jev scoring unavailable for ${domain}, using rule score: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
