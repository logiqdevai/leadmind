import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  JEV_BASE_URL,
  JEV_DEFAULT_MODEL,
  JEV_ENDPOINT,
  JEV_REQUEST_TIMEOUT_MS,
  JEV_SCORE_MAX_LEVELS,
  JEV_SCORE_MIN_LEVELS,
} from './jev.constants';
import {
  JevDecisionResponse,
  JevQuestion,
  JevState,
} from './interfaces/jev.interface';

/**
 * Thin wrapper around TypeSafe's System One API (https://docs.typesafe.ai/api/system-one),
 * which serves the Jev decision model. One request carries a `state` and a map of typed
 * questions (noul / choice / score); all are judged independently against the same state.
 * The API key is a TypeSafe key: pass one per call, or fall back to TYPESAFE_API_KEY.
 */
@Injectable()
export class JevClient {
  private readonly logger = new Logger(JevClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.http = axios.create({
      baseURL: this.configService.get<string>('TYPESAFE_BASE_URL') ?? JEV_BASE_URL,
      timeout: JEV_REQUEST_TIMEOUT_MS,
    });
  }

  async decide<Q extends Record<string, JevQuestion>>(
    state: JevState,
    questions: Q,
    options: { apiKey?: string; model?: string } = {},
  ): Promise<JevDecisionResponse<Q>> {
    const apiKey = options.apiKey ?? this.configService.get<string>('TYPESAFE_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Jev is not configured.');
    }
    this.validateQuestions(questions);

    try {
      const { data } = await this.http.post<JevDecisionResponse<Q>>(
        JEV_ENDPOINT,
        {
          model:
            options.model ??
            this.configService.get<string>('JEV_MODEL') ??
            JEV_DEFAULT_MODEL,
          state,
          questions,
        },
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.warn(`Jev decision failed${status ? ` status=${status}` : ''}: ${message}`);

      // Auth and validation errors will not fix themselves on retry, so surface them as
      // non-transient; network errors, timeouts, 429 and 529 (overloaded) stay retryable
      // (BullMQ backoff). See docs.typesafe.ai/api/errors.
      if (status === 401 || status === 403) {
        throw new UnauthorizedException('Jev API key is invalid.');
      }
      if (status === 402) {
        throw new BadRequestException('Jev account is out of credit.');
      }
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new BadRequestException(`Jev rejected the request (${status}).`);
      }
      throw new ServiceUnavailableException(
        'Failed to reach Jev. Try again in a moment.',
      );
    }
  }

  private validateQuestions(questions: Record<string, JevQuestion>): void {
    for (const [id, question] of Object.entries(questions)) {
      if (
        question.type === 'score' &&
        (question.criteria.length < JEV_SCORE_MIN_LEVELS ||
          question.criteria.length > JEV_SCORE_MAX_LEVELS)
      ) {
        throw new BadRequestException(
          `Jev score question "${id}" needs ${JEV_SCORE_MIN_LEVELS}-${JEV_SCORE_MAX_LEVELS} levels.`,
        );
      }
    }
  }
}
