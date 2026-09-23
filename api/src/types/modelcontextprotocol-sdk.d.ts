/**
 * @modelcontextprotocol/sdk ships as an "exports"-only package (no root
 * main/types fields), which this project's `moduleResolution: "node10"`
 * (the tsconfig default for `module: "commonjs"`) cannot resolve subpath
 * imports against - Node's own `require()` resolves them fine at runtime
 * (it always honors package.json "exports"), only `tsc` needs the help.
 * These ambient declarations cover just the surface mcp/mcp.controller.ts
 * actually uses; switching the whole project to `moduleResolution: "node16"`
 * would be the "proper" fix but changes CJS/ESM interop semantics
 * project-wide, which is out of scope here.
 */
declare module '@modelcontextprotocol/sdk/server' {
    export interface ServerInfo {
        name: string;
        version: string;
        [key: string]: unknown;
    }

    export interface ServerOptions {
        capabilities?: Record<string, unknown>;
        instructions?: string;
        [key: string]: unknown;
    }

    export class Server {
        constructor(serverInfo: ServerInfo, options?: ServerOptions);
        setRequestHandler<Req = any, Res = any>(
            schema: unknown,
            handler: (request: Req, extra?: unknown) => Res | Promise<Res>,
        ): void;
        connect(transport: unknown): Promise<void>;
        close(): Promise<void>;
    }
}

declare module '@modelcontextprotocol/sdk/server/streamableHttp.js' {
    export interface StreamableHTTPServerTransportOptions {
        sessionIdGenerator?: (() => string) | undefined;
        [key: string]: unknown;
    }

    export class StreamableHTTPServerTransport {
        constructor(options?: StreamableHTTPServerTransportOptions);
        readonly sessionId: string | undefined;
        handleRequest(req: unknown, res: unknown, parsedBody?: unknown): Promise<void>;
        close(): Promise<void>;
    }
}

declare module '@modelcontextprotocol/sdk/types.js' {
    export const ListToolsRequestSchema: unknown;
    export const CallToolRequestSchema: unknown;

    export interface JsonSchemaObject {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
        [key: string]: unknown;
    }

    export interface Tool {
        name: string;
        description?: string;
        inputSchema: JsonSchemaObject;
        annotations?: Record<string, unknown>;
        [key: string]: unknown;
    }

    export interface ListToolsResult {
        tools: Tool[];
        [key: string]: unknown;
    }

    export interface CallToolRequest {
        method: 'tools/call';
        params: {
            name: string;
            arguments?: Record<string, unknown>;
        };
    }

    export interface TextContent {
        type: 'text';
        text: string;
    }

    export interface CallToolResult {
        content: TextContent[];
        structuredContent?: Record<string, unknown>;
        isError?: boolean;
        [key: string]: unknown;
    }
}
