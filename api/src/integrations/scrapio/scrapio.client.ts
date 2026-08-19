import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  SCRAPIO_API_BASE_URL,
  SCRAPIO_MAX_RETRIES,
  SCRAPIO_REQUEST_TIMEOUT_MS,
  SCRAPIO_RETRY_DELAY_MS,
} from './scrapio.constants';
import { ScrapioCredentialsService } from './services/scrapio-credentials.service';

export interface ScrapioRequestOptions {
  /** Query string parameters. */
  params?: Record<string, any>;
  /** Organisation whose stored Scrapio API key authenticates this call. Required unless `skip_auth` is set. */
  organisation_uuid?: string;
  /** Skip the Authorization header entirely (public endpoints, e.g. login/register). */
  skip_auth?: boolean;
}

/**
 * Thin, retrying HTTP wrapper around the Scrapio API (https://api.scrapio.logiqdev.com).
 * Scrapio is multi-tenant per connected leadmind organisation, so every authenticated call
 * resolves its Bearer token from that organisation's stored integration key — there is no
 * static/global Scrapio API key. Domain services under `./services` build on top of the
 * generic verbs exposed here.
 */
@Injectable()
export class ScrapioClient {
  private readonly logger = new Logger(ScrapioClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly credentials: ScrapioCredentialsService) {
    this.http = axios.create({
      baseURL: SCRAPIO_API_BASE_URL,
      timeout: SCRAPIO_REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get<T>(path: string, options?: ScrapioRequestOptions): Promise<T> {
    return this.request<T>('get', path, undefined, options);
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: ScrapioRequestOptions,
  ): Promise<T> {
    return this.request<T>('post', path, body, options);
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: ScrapioRequestOptions,
  ): Promise<T> {
    return this.request<T>('patch', path, body, options);
  }

  delete<T = void>(path: string, options?: ScrapioRequestOptions): Promise<T> {
    return this.request<T>('delete', path, undefined, options);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body: unknown,
    options?: ScrapioRequestOptions,
  ): Promise<T> {
    const headers = await this.buildAuthHeaders(options);

    let last_error: unknown;
    for (let attempt = 0; attempt <= SCRAPIO_MAX_RETRIES; attempt++) {
      try {
        const config: AxiosRequestConfig = { params: options?.params, headers };
        const { data } =
          method === 'get' || method === 'delete'
            ? await this.http[method]<T>(path, config)
            : await this.http[method]<T>(path, body, config);
        return data;
      } catch (error) {
        last_error = error;
        const status = (error as AxiosError)?.response?.status;

        // Don't retry client errors — they won't succeed on a second attempt.
        if (status && status >= 400 && status < 500) {
          throw this.toHttpException(path, error as AxiosError);
        }

        this.logger.warn(
          `Scrapio ${method.toUpperCase()} ${path} attempt ${attempt + 1} failed (HTTP ${status ?? '?'}): ${this.errorMessage(error)}`,
        );

        if (attempt < SCRAPIO_MAX_RETRIES) {
          await this.sleep(SCRAPIO_RETRY_DELAY_MS);
        }
      }
    }

    if ((last_error as AxiosError)?.isAxiosError) {
      throw this.toHttpException(path, last_error as AxiosError);
    }
    throw new InternalServerErrorException(
      `Scrapio ${method.toUpperCase()} ${path} failed: ${this.errorMessage(last_error)}`,
    );
  }

  private async buildAuthHeaders(
    options?: ScrapioRequestOptions,
  ): Promise<Record<string, string>> {
    if (options?.skip_auth) return {};

    if (!options?.organisation_uuid) {
      throw new InternalServerErrorException(
        'ScrapioClient: organisation_uuid is required to authenticate this call (or pass skip_auth for public endpoints)',
      );
    }

    const token = await this.credentials.getScrapioApiKey(
      options.organisation_uuid,
    );
    return { Authorization: `Bearer ${token}` };
  }

  private toHttpException(path: string, error: AxiosError<any>): Error {
    const status = error.response?.status;
    const message = this.errorMessage(error);

    switch (status) {
      case 400:
        return new BadRequestException(message);
      case 401:
        return new UnauthorizedException(message);
      case 403:
        return new ForbiddenException(message);
      case 404:
        return new NotFoundException(message);
      case 409:
        return new ConflictException(message);
      case 503:
        return new ServiceUnavailableException(message);
      default:
        return new InternalServerErrorException(
          `Scrapio ${path} failed: ${message}`,
        );
    }
  }

  private errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as any;
      const message = data?.message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string' && message.length) return message;
      return error.message;
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
