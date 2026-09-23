import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { McpToolDefinition } from './tool-definition.interface';

export interface McpAuthContext {
  userUuid: string;
  organisationUuid: string;
  organisationRole: string;
  oauthClientId?: string;
}

export interface McpToolResult {
  status: number;
  body: unknown;
}

const INTERNAL_TOKEN_TTL = '60s';

/**
 * Executes a tool call by re-entering the app's own HTTP API over loopback,
 * carrying a short-lived internal JWT minted from the verified MCP access
 * token's claims.
 *
 * Deliberately not a direct in-process controller-method call: going back
 * through HTTP means every guard (JwtGuard, OrganisationRolesGuard, ...),
 * the global ValidationPipe, and each service's business logic all run
 * exactly as they do for a normal request. Tool behavior can never drift
 * from the real API, and this module never needs updating when a route's
 * validation or authorization changes.
 */
@Injectable()
export class ToolDispatcherService {
  private readonly logger = new Logger(ToolDispatcherService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async dispatch(
    tool: McpToolDefinition,
    args: Record<string, unknown>,
    auth: McpAuthContext,
  ): Promise<McpToolResult> {
    let path = tool.pathTemplate;
    for (const param of tool.pathParams) {
      path = path.replace(
        `{${param}}`,
        encodeURIComponent(String(args?.[param] ?? '')),
      );
    }

    const query: Record<string, unknown> = {};
    for (const param of tool.queryParams) {
      if (args?.[param] !== undefined) query[param] = args[param];
    }

    const token = await this.jwtService.signAsync(
      {
        uuid: auth.userUuid,
        organisation_uuid: auth.organisationUuid,
        organisation_role: auth.organisationRole,
      },
      { secret: this.config.get('JWT_SECRET'), expiresIn: INTERNAL_TOKEN_TTL },
    );

    const started = Date.now();
    let status = 500;
    let body: unknown;
    let errorMessage: string | undefined;

    try {
      const response = await axios.request({
        method: tool.method,
        baseURL: this.baseUrl,
        url: path,
        params: query,
        data: tool.hasBody ? (args?.body ?? {}) : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Internal-Mcp-Call': '1',
        },
        validateStatus: () => true,
        timeout: 55_000,
      });
      status = response.status;
      body = response.data;
      if (status >= 400)
        errorMessage = typeof body === 'string' ? body : JSON.stringify(body);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      body = { message: 'Tool call failed', error: errorMessage };
    }

    this.audit(
      tool,
      path,
      auth,
      status,
      Date.now() - started,
      errorMessage,
    ).catch((error) =>
      this.logger.warn(
        `Failed to write MCP audit log: ${error instanceof Error ? error.message : error}`,
      ),
    );

    return { status, body };
  }

  private get baseUrl(): string {
    const port = this.config.get<number>('PORT') || 3000;
    return `http://127.0.0.1:${port}`;
  }

  private async audit(
    tool: McpToolDefinition,
    path: string,
    auth: McpAuthContext,
    status: number,
    durationMs: number,
    errorMessage?: string,
  ) {
    await this.prisma.mcpToolInvocationLog.create({
      data: {
        organisation_uuid: auth.organisationUuid,
        user_uuid: auth.userUuid,
        oauth_client_id: auth.oauthClientId,
        tool_name: tool.name,
        http_method: tool.method.toUpperCase(),
        path,
        status_code: status,
        duration_ms: durationMs,
        error_message: errorMessage?.slice(0, 2000),
      },
    });
  }
}
