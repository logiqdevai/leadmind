import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  ListToolsResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { McpAuth, McpAuthGuard } from './guards/mcp-auth.guard';
import { OpenApiToolRegistryService } from './tool-registry/openapi-tool-registry.service';
import { ToolDispatcherService } from './tool-registry/tool-dispatcher.service';

const SERVER_INFO = { name: 'leadmind', version: '1.0.0' };

/**
 * The MCP endpoint itself (Streamable HTTP transport, per the 2025-06-18 MCP
 * spec). A fresh `Server` + transport is created per request (stateless
 * mode - `sessionIdGenerator: undefined`): there's no server-side
 * conversational state to keep between calls, every tool call goes back out
 * over HTTP to the real API (see ToolDispatcherService), so statelessness
 * is free and it keeps this endpoint horizontally scalable with zero
 * session affinity requirements.
 */
@ApiExcludeController()
@UseGuards(McpAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(
    private readonly toolRegistry: OpenApiToolRegistryService,
    private readonly dispatcher: ToolDispatcherService,
  ) {}

  @Post()
  handlePost(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  @Get()
  handleGet(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  @Delete()
  handleDelete(@Req() req: Request, @Res() res: Response) {
    return this.handle(req, res);
  }

  private async handle(req: Request, res: Response) {
    const auth = (req as Request & { mcpAuth: McpAuth }).mcpAuth;
    const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

    server.setRequestHandler(
      ListToolsRequestSchema,
      async (): Promise<ListToolsResult> => ({
        tools: this.toolRegistry
          .getTools()
          .filter((tool) => auth.scopes.includes(tool.scope))
          .map(
            (tool): Tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema as Tool['inputSchema'],
              annotations: tool.annotations,
            }),
          ),
      }),
    );

    server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<CallToolResult> => {
        const tool = this.toolRegistry.findTool(request.params.name);
        if (!tool) {
          return {
            content: [
              { type: 'text', text: `Unknown tool: ${request.params.name}` },
            ],
            isError: true,
          };
        }
        if (!auth.scopes.includes(tool.scope)) {
          return {
            content: [
              {
                type: 'text',
                text: `This connection was not granted the '${tool.scope}' scope required for '${tool.name}'. Ask the user to reconnect and allow that access.`,
              },
            ],
            isError: true,
          };
        }

        const result = await this.dispatcher.dispatch(
          tool,
          request.params.arguments ?? {},
          {
            userUuid: auth.userUuid,
            organisationUuid: auth.organisationUuid,
            organisationRole: auth.organisationRole,
            oauthClientId: auth.oauthClientId,
          },
        );

        const text =
          typeof result.body === 'string'
            ? result.body
            : JSON.stringify(result.body, null, 2);
        const structuredContent =
          result.body &&
          typeof result.body === 'object' &&
          !Array.isArray(result.body)
            ? (result.body as Record<string, unknown>)
            : undefined;

        return {
          content: [{ type: 'text', text }],
          ...(structuredContent ? { structuredContent } : {}),
          isError: result.status >= 400,
        };
      },
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
