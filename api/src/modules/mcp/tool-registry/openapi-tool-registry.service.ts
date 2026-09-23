import { Injectable, Logger } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { OpenApiDocumentRegistry } from '@/core/openapi/openapi-document.registry';
import { SCOPE_READ, SCOPE_WRITE } from '@/modules/oauth/oauth.constants';
import { isDeniedPath } from './mcp-tools.config';
import { dereference, JsonSchema } from './json-schema.util';
import { McpToolDefinition } from './tool-definition.interface';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Builds the MCP tool catalogue from the app's own OpenAPI document, so the
 * catalogue can't drift from the real API: every route already excluded from
 * OpenAPI (admin/internal, via @ApiExcludeController()) is automatically
 * excluded here too, and every new documented route automatically becomes a
 * tool without touching this module.
 *
 * Built lazily (not in onModuleInit): the OpenAPI document is only available
 * after main.ts finishes `SwaggerModule.createDocument`, which itself
 * requires every module - including this one - to already be instantiated.
 */
@Injectable()
export class OpenApiToolRegistryService {
  private readonly logger = new Logger(OpenApiToolRegistryService.name);
  private tools?: McpToolDefinition[];

  constructor(private readonly documentRegistry: OpenApiDocumentRegistry) {}

  getTools(): McpToolDefinition[] {
    if (!this.tools) {
      this.tools = this.build(this.documentRegistry.get());
      this.logger.log(
        `Registered ${this.tools.length} MCP tools from the OpenAPI document`,
      );
    }
    return this.tools;
  }

  findTool(name: string): McpToolDefinition | undefined {
    return this.getTools().find((tool) => tool.name === name);
  }

  private build(document: OpenAPIObject): McpToolDefinition[] {
    const components = (document.components?.schemas ?? {}) as Record<
      string,
      JsonSchema
    >;
    const usedNames = new Set<string>();
    const tools: McpToolDefinition[] = [];

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      if (isDeniedPath(path)) continue;

      for (const method of HTTP_METHODS) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;

        const tag = operation.tags?.[0] ?? 'general';
        const name = this.uniqueName(
          tag,
          operation.operationId ?? `${method}_${path}`,
          usedNames,
        );
        const pathParams = [...path.matchAll(/\{([^}]+)\}/g)].map(
          (match) => match[1],
        );
        const queryParams: string[] = [];

        const properties: JsonSchema = {};
        const required: string[] = [];

        for (const param of operation.parameters ?? []) {
          const schema = dereference(param.schema, components);
          if (param.description) schema.description = param.description;

          if (param.in === 'path') {
            properties[param.name] = {
              ...schema,
              type: schema.type ?? 'string',
            };
            required.push(param.name);
          } else if (param.in === 'query') {
            properties[param.name] = schema;
            queryParams.push(param.name);
            if (param.required) required.push(param.name);
          }
        }

        const requestBody =
          operation.requestBody?.content?.['application/json']?.schema;
        const hasBody = Boolean(requestBody);
        if (hasBody) {
          properties.body = dereference(requestBody, components);
          if (operation.requestBody?.required !== false) required.push('body');
        }

        tools.push({
          name,
          description:
            operation.summary ||
            operation.description ||
            `${method.toUpperCase()} ${path}`,
          method,
          pathTemplate: path,
          pathParams,
          queryParams,
          hasBody,
          scope: method === 'get' ? SCOPE_READ : SCOPE_WRITE,
          inputSchema: {
            type: 'object',
            properties,
            required: required.length ? required : undefined,
          },
          annotations: {
            title: operation.summary,
            readOnlyHint: method === 'get',
            destructiveHint: method === 'delete',
            idempotentHint:
              method === 'get' || method === 'put' || method === 'delete',
            openWorldHint: false,
          },
        });
      }
    }

    return tools;
  }

  private uniqueName(
    tag: string,
    operationId: string,
    used: Set<string>,
  ): string {
    const methodName = operationId.includes('_')
      ? operationId.slice(operationId.indexOf('_') + 1)
      : operationId;
    const snake = methodName
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toLowerCase();
    const tagSlug = tag.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();

    const base = `${tagSlug}_${snake}`
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix++}`;
    }
    used.add(candidate);
    return candidate;
  }
}
