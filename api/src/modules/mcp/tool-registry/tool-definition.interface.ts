import type { OAuthScope } from '@/modules/oauth/oauth.constants';
import type { JsonSchema } from './json-schema.util';

export interface McpToolDefinition {
  name: string;
  description: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** OpenAPI-style path template, e.g. `/contacts/{uuid}/notes`. */
  pathTemplate: string;
  pathParams: string[];
  queryParams: string[];
  hasBody: boolean;
  scope: OAuthScope;
  inputSchema: JsonSchema;
  annotations: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
