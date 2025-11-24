import { useContainer } from 'class-validator';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_PREFIX } from './app.constants';
import { AppModule } from './app.module';
import { getDiscoveredExtensions } from './common/extensions/extensions.discovery-cache';
import { BadRequestExceptionFilter } from './common/filters/bad-request-exception.filter';
import { GlobalErrorFilter } from './common/filters/global-error.filter';
import { InternalServerErrorExceptionFilter } from './common/filters/internal-server-error-exception.filter';
import { NotFoundExceptionFilter } from './common/filters/not-found-exception.filter';
import { QueryFailedExceptionFilter } from './common/filters/query-failed-exception.filter';
import { UnprocessableEntityExceptionFilter } from './common/filters/unprocessable-entity-exception.filter';
import { getEnvValue } from './common/utils/config.utils';
import { ValidationExceptionFactory } from './common/validation/validation-exception-factory';
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
			//transform: true, // Enables class-transformer transformation
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

	// Swagger API documentation setup
	const swaggerConfig = new DocumentBuilder()
		.setTitle('FastyBird Smart Panel API')
		.setDescription('API documentation for FastyBird Smart Panel backend')
		.setVersion('1.0')
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			docExpansion: 'none',
			filter: true,
			showRequestDuration: true,
			tagsSorter: 'alpha',
		},
	});

	sysLogger.log(`Swagger documentation available at http://0.0.0.0:${port}${API_PREFIX}/docs`, ['Bootstrap']);

	await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: Error) => {
	console.error(error);
});
