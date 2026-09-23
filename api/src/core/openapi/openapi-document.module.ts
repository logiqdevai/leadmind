import { Global, Module } from '@nestjs/common';
import { OpenApiDocumentRegistry } from './openapi-document.registry';

@Global()
@Module({
  providers: [OpenApiDocumentRegistry],
  exports: [OpenApiDocumentRegistry],
})
export class OpenApiDocumentModule {}
