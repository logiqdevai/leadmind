import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  MXTOOLBOX_BASE_URL,
  MXTOOLBOX_COMMANDS,
  MXTOOLBOX_REQUEST_TIMEOUT_MS,
  MxToolboxCommand,
} from './mxtoolbox.constants';
import {
  MxToolboxLookupResult,
  MxToolboxUsage,
} from './interfaces/mxtoolbox.interface';

/**
 * Thin wrapper around the MxToolbox API v1 (see api/docs/mxtoolbox_api_reference.md). Every
 * call needs the organisation's own API key, so it's passed per-call rather than read from
 * config - callers resolve it via IntegrationsService first.
 */
@Injectable()
export class MxToolboxClient {
  private readonly logger = new Logger(MxToolboxClient.name);
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: MXTOOLBOX_BASE_URL,
      timeout: MXTOOLBOX_REQUEST_TIMEOUT_MS,
    });
  }

  async lookup(
    apiKey: string,
    command: MxToolboxCommand,
    argument: string,
    port?: number,
  ): Promise<MxToolboxLookupResult> {
    try {
      const { data } = await this.http.get<MxToolboxLookupResult>(
        `/Lookup/${MXTOOLBOX_COMMANDS[command]}/`,
        {
          headers: { Authorization: apiKey },
          params: {
            argument,
            ...(port ? { port } : {}),
          },
        },
      );
      return data;
    } catch (error) {
      this.logger.warn(
        `MxToolbox lookup failed command=${command} argument=${argument}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        `MxToolbox ${command} lookup failed for ${argument}.`,
      );
    }
  }

  async getUsage(apiKey: string): Promise<MxToolboxUsage> {
    try {
      const { data } = await this.http.get<MxToolboxUsage>('/Usage', {
        headers: { Authorization: apiKey },
      });
      return data;
    } catch (error) {
      this.logger.warn(
        `MxToolbox usage fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Failed to reach MxToolbox. Try again in a moment.',
      );
    }
  }
}
