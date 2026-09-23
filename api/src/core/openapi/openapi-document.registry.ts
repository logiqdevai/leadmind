import { Injectable } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * Holds the single OpenAPI document built once in main.ts (SwaggerModule.createDocument)
 * so it can be reused by the MCP tool registry instead of being rebuilt. Set via
 * `app.get(OpenApiDocumentRegistry).set(document)` right after SwaggerModule.setup.
 */
@Injectable()
export class OpenApiDocumentRegistry {
  private document?: OpenAPIObject;

  set(document: OpenAPIObject): void {
    this.document = document;
  }

  get(): OpenAPIObject {
    if (!this.document) {
      throw new Error(
        'OpenAPI document has not been set yet - is main.ts calling registry.set() after SwaggerModule.createDocument?',
      );
    }
    return this.document;
  }
}
