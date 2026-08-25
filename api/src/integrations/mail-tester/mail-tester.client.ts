import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  MAIL_TESTER_BASE_URL,
  MAIL_TESTER_REQUEST_TIMEOUT_MS,
} from './mail-tester.constants';
import { MailTesterResult } from './interfaces/mail-tester.interface';

export interface MailTesterFetchOptions {
  /** Restrict the response to one of Mail-Tester's documented main tests (e.g. "signature"). */
  test?: string;
  /** Language code for the returned messages (e.g. "fr-fr"). */
  lang?: string;
}

/**
 * Thin wrapper around the public Mail-Tester JSON API
 * (see api/docs/mail_tester_json_api_reference.md). There is no API key - the test address
 * itself (username-testIdentifier@mail-tester.com) is the only credential.
 */
@Injectable()
export class MailTesterClient {
  private readonly logger = new Logger(MailTesterClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: MAIL_TESTER_BASE_URL,
      timeout: MAIL_TESTER_REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Fetches the current result for a test address. Mail-Tester returns `status: false` both for
   * an email that hasn't been processed yet and for a genuinely failed test - the JSON API alone
   * doesn't distinguish the two, so callers should treat `status: false` as "not ready or failed"
   * rather than a hard error.
   */
  async fetchResult(
    username: string,
    testIdentifier: string,
    options?: MailTesterFetchOptions,
  ): Promise<MailTesterResult> {
    try {
      const { data } = await this.http.get<MailTesterResult>(
        `/${username}-${testIdentifier}`,
        {
          params: {
            format: 'json',
            ...(options?.test ? { test: options.test } : {}),
            ...(options?.lang ? { lang: options.lang } : {}),
          },
        },
      );
      return data;
    } catch (error) {
      this.logger.warn(
        `Mail-Tester fetch failed username=${username} test=${testIdentifier}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to reach Mail-Tester. Try again in a moment.',
      );
    }
  }
}
