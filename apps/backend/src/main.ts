import { useContainer } from 'class-validator';
import { FastifyReply, FastifyRequest } from 'fastify';

import fastifyMultipart from '@fastify/multipart';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { API_PREFIX, MULTIPART_MAX_FILE_SIZE_BYTES } from './app.constants';
import { AppModule } from './app.module';
import { BadRequestExceptionFilter } from './common/filters/bad-request-exception.filter';
import { GlobalErrorFilter } from './common/filters/global-error.filter';
import { InternalServerErrorExceptionFilter } from './common/filters/internal-server-error-exception.filter';
import { NotFoundExceptionFilter } from './common/filters/not-found-exception.filter';
import { QueryFailedExceptionFilter } from './common/filters/query-failed-exception.filter';
import { UnprocessableEntityExceptionFilter } from './common/filters/unprocessable-entity-exception.filter';
import { getEnvValue } from './common/utils/config.utils';
import { ValidationExceptionFactory } from './common/validation/validation-exception-factory';
import { OAuthCallbackService } from './modules/buddy/services/oauth-callback.service';
import { getDiscoveredExtensions } from './modules/extensions/services/extensions-discovery-cache';
import { MdnsService } from './modules/mdns/services/mdns.service';
import { SwaggerDocumentService } from './modules/swagger/services/swagger-document.service';
import { SystemLoggerService } from './modules/system/services/system-logger.service';
import { WebsocketGateway } from './modules/websocket/gateway/websocket.gateway';

async function bootstrap() {
	const discovered = await getDiscoveredExtensions();

	const moduleExtensions = discovered.backend
		.filter((e) => e.kind === 'module')
		.map((d) => ({
			routePrefix: d.routePrefix,
			extensionClass: d.extensionClass,
		}));

	const pluginExtensions = discovered.backend
		.filter((e) => e.kind === 'plugin')
		.map((d) => ({
			routePrefix: d.routePrefix,
			extensionClass: d.extensionClass,
		}));

	const appModule = AppModule.register({
		moduleExtensions,
		pluginExtensions,
	});

	const app = await NestFactory.create<NestFastifyApplication>(appModule, new FastifyAdapter(), { bufferLogs: true });

	// Raise the body-size limit for multipart/form-data routes (audio uploads)
	// while keeping Fastify's default 1 MiB for JSON endpoints.
	const fastifyInstance = app.getHttpAdapter().getInstance();

	fastifyInstance.addHook(
		'onRoute',
		(routeOptions: { url?: string; path?: string; bodyLimit?: number; method?: string | string[] }) => {
			// Only raise the limit for routes that explicitly consume multipart
			const path = routeOptions.url ?? routeOptions.path ?? '';

			if (path === '/api/v1/buddy/conversations/:conversationId/audio') {
				routeOptions.bodyLimit = MULTIPART_MAX_FILE_SIZE_BYTES;
			}
		},
	);

	// Register multipart support for file uploads — this adds the content-type
	// parser that sets req[kMultipart] = true, which req.file() relies on.
	await app.register(fastifyMultipart, {
		limits: { fileSize: MULTIPART_MAX_FILE_SIZE_BYTES },
	});

	const sysLogger = app.get(SystemLoggerService);

	sysLogger.log(`Extensions mounted → modules: ${moduleExtensions.length}, plugins: ${pluginExtensions.length}`, [
		'Bootstrap',
	]);

	app.useLogger(sysLogger);

	const configService = app.get(NestConfigService);
	const port = getEnvValue<number>(configService, 'FB_BACKEND_PORT', 3000);

	app.useGlobalFilters(
		new GlobalErrorFilter(),
		new InternalServerErrorExceptionFilter(),
		new BadRequestExceptionFilter(),
		new UnprocessableEntityExceptionFilter(),
		new NotFoundExceptionFilter(),
		new QueryFailedExceptionFilter(),
	);

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true, // Enables class-transformer transformation
			whitelist: true, // Strips properties not defined in DTO
			forbidNonWhitelisted: true, // Rejects requests with extra properties
			transformOptions: {
				enableImplicitConversion: true, // Automatically convert types
			},
			exceptionFactory: (validationErrors) => {
				return ValidationExceptionFactory.createException(validationErrors);
			},
		}),
	);

	app.setGlobalPrefix(API_PREFIX);

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
	});

	// Optional: Make class-transformer aware of NestJS context
	useContainer(app.select(appModule), { fallbackOnErrors: true });

	const websocketGateway = app.get(WebsocketGateway);
	websocketGateway.enable();

	app.enableCors();

	// Setup Swagger UI using SwaggerDocumentService
	const swaggerService = app.get(SwaggerDocumentService);
	swaggerService.setup(app);

	// Register OAuth callback route outside the API prefix (OAuth providers redirect here directly)
	const oauthCallbackService = app.get(OAuthCallbackService);

	const oauthCallbackHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
		try {
			const query = request.query as Record<string, string>;
			const { code, state } = query;
			const result = await oauthCallbackService.handleCallback(code || '', state || '');
			const html = oauthCallbackService.renderCallbackHtml(result.success, result.pluginType, result.error);

			void reply.type('text/html').send(html);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'An unexpected error occurred';
			const html = oauthCallbackService.renderCallbackHtml(false, '', message);

			void reply.type('text/html').send(html);
		}
	};

	fastifyInstance.get('/auth/callback', oauthCallbackHandler);

	sysLogger.log(`Swagger documentation available at http://0.0.0.0:${port}/${API_PREFIX}/docs`, ['Bootstrap']);

	await app.listen(port, '0.0.0.0');

	// Start mDNS service advertisement after server is listening
	const mdnsService = app.get(MdnsService);
	mdnsService.advertise(port);
}

bootstrap().catch((error: Error) => {
	console.error(error);
});
