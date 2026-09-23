import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@bull-board/express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BULL_BOARD_ADAPTER } from './core/queues/queues.constants';
import { bullBoardAuthMiddleware } from './core/queues/bull-board.middleware';
import { OpenApiDocumentRegistry } from './core/openapi/openapi-document.registry';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Default body-parser limit (100kb) is too small for provider webhook payloads that embed
  // full page content (e.g. Scrapio's PLAIN_SCRAPE result includes raw_html for every crawled page).
  app.useBodyParser('json', { limit: '20mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '20mb' });
  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Appointly API')
    .setDescription('The Appointly API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.get(OpenApiDocumentRegistry).set(document);

  const bullBoardAdapter = app.get<ExpressAdapter>(BULL_BOARD_ADAPTER);
  const configService = app.get(ConfigService);
  app.use(
    '/admin/queues',
    bullBoardAuthMiddleware(configService),
    bullBoardAdapter.getRouter(),
  );

  // The OAuth authorization server and the MCP endpoint are public, spec-mandated
  // surfaces: any third-party client (Claude, ChatGPT, ...) must be able to reach
  // them cross-origin - that's the entire point of Dynamic Client Registration and
  // Bearer-token auth. They're protected by tokens/PKCE, not by an origin allowlist,
  // so they're deliberately exempted from the app-wide CORS restriction below
  // (registered first so its OPTIONS preflight handling always wins for these paths).
  //
  // /oauth/interaction/* is different: the frontend app (a specific, known
  // origin) calls it with oidc-provider's own interaction/session cookies
  // attached (see OidcProviderService's cross-origin cookie settings), and a
  // cookie is an ambient credential - reflecting *any* origin the way the
  // rest of this surface does would let any website ride a signed-in user's
  // cookies to approve an OAuth grant on their behalf. It gets a strict,
  // single-origin-with-credentials policy instead of the permissive one.
  const OAUTH_MCP_CORS_PATHS = [
    '/oauth',
    '/mcp',
    '/auth',
    '/token',
    '/reg',
    '/jwks',
    '/revocation',
    '/introspection',
    '/device',
    '/request',
    '/me',
    '/.well-known',
  ];
  const interactionOrigin = process.env.APP_URL;
  app.use(OAUTH_MCP_CORS_PATHS, (req, res, next) => {
    const origin = req.headers.origin;

    // req.path (not req.originalUrl) gets rewritten by Express when a path
    // array is passed to app.use() - it's relative to whichever entry in
    // OAUTH_MCP_CORS_PATHS matched, so checking it here would never see the
    // '/oauth/interaction' prefix at all once '/oauth' had already matched.
    if (req.originalUrl.startsWith('/oauth/interaction')) {
      if (interactionOrigin && origin === interactionOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Authorization, Content-Type',
        );
      }
    } else {
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
      );
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  });

  const enabledCors = process.env.NODE_ENV !== 'local' ? [process.env.APP_URL, process.env.LANDING_URL] : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'];

  app.enableCors({
    origin: enabledCors,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Access-Control-Allow-Origin'],
  });

  // The oidc-provider handoff (/auth, /token, /reg, /jwks, /.well-known/*,
  // etc.) is a real Nest route now (OidcFallbackController, a wildcard
  // catch-all imported last in AppModule) rather than raw Express
  // middleware mounted here - see that controller for why: this app briefly
  // shipped two different attempts at ordering a raw app.use() call around
  // Nest's own (undocumented-timing) route mounting, and each one broke a
  // different half of the app.

  await app.listen(configService.get<number>('PORT') || 3000);
}
bootstrap();
