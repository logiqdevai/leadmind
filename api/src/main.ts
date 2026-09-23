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
import { OidcProviderService } from './modules/oauth/services/oidc-provider.service';

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

  // NestFactory.create() only resolves the DI graph (constructors) - it does NOT
  // run onModuleInit/onApplicationBootstrap hooks. Those normally fire inside
  // app.listen() -> app.init(), but OidcProviderService.onModuleInit() (below)
  // must have already built its Provider instance before we can mount its
  // callback, so init() is called explicitly here. app.listen() detects the app
  // is already initialized and won't run this twice.
  await app.init();

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
  app.use(OAUTH_MCP_CORS_PATHS, (req, res, next) => {
    const origin = req.headers.origin;
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

  // Mounted last and unprefixed so it only ever handles requests none of the
  // Nest controllers above matched (auth/token/jwks/registration/revocation/
  // .well-known/*, etc. - see OidcProviderService for why the issuer has no
  // path prefix). Nest's router is already fully bound by this point (every
  // controller route was registered during the DI graph construction inside
  // NestFactory.create()), so there's no route-order race with the
  // oidc-provider Koa app taking over paths it shouldn't.
  const oidcProvider = app.get(OidcProviderService);
  app.use(oidcProvider.callback());

  await app.listen(configService.get<number>('PORT') || 3000);
}
bootstrap();
