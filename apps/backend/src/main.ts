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
	// Load long description from markdown file for maintainability
	const fs = await import('node:fs');
	const path = await import('node:path');
	const filePath = path.join(__dirname, '../docs/swagger-description.md');
	const description: string = ((): string => fs.readFileSync(filePath, 'utf8'))();

	const swaggerConfig = new DocumentBuilder()
		.setTitle('🖥️ FastyBird Smart Panel API 🚀')
		.setDescription(description)
		.setVersion('1.0')
		.setLicense('Apache 2.0', 'https://github.com/FastyBird/smart-panel/blob/main/LICENSE.md')
		.setContact('Adam Kadlec', 'https://fastybird.com', 'info@fastybird.com')
		.setTermsOfService('http://smart-panel.fastybird.com')
		.addServer('http://localhost:3000/api/v1', 'Local development server')
		.addBearerAuth()
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig, {
		operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
	});

	// Set OpenAPI version to 3.1.0
	document.openapi = '3.1.0';

	// Add summary field to info (OpenAPI 3.1.0 feature)
	if (document.info) {
		(document.info as { summary?: string }).summary =
			'The FastyBird Smart Panel API provides a local, real-time interface for retrieving device data, monitoring statuses, and integrating third-party IoT systems. It enables seamless communication between the smart panel and connected devices, ensuring fast, private, and reliable interactions without cloud dependencies.';
	}

	/**
	 * Sort tags by:
	 * 1. modules (name endsWith " module") – alphabetical
	 * 2. plugins (name endsWith " plugin") – alphabetical
	 * 3. everything else – alphabetical, at the bottom
	 */
	if (document.tags) {
		document.tags.sort((a, b) => {
			const an = a.name.toLowerCase();
			const bn = b.name.toLowerCase();

			const aIsModule = an.endsWith(' module');
			const bIsModule = bn.endsWith(' module');

			const aIsPlugin = an.endsWith(' plugin');
			const bIsPlugin = bn.endsWith(' plugin');

			// 1) Modules go first
			if (aIsModule && !bIsModule) return -1;
			if (!aIsModule && bIsModule) return 1;

			// 2) Plugins go second
			if (aIsPlugin && !bIsPlugin) return -1;
			if (!aIsPlugin && bIsPlugin) return 1;

			// 3) Everything else: alphabetical among themselves
			return an.localeCompare(bn);
		});
	}

	SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			docExpansion: 'none',
			filter: true,
			showRequestDuration: true,
			tagsSorter: 'alpha',
		},
	});

	sysLogger.log(`Swagger documentation available at http://0.0.0.0:${port}/${API_PREFIX}/docs`, ['Bootstrap']);

	await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: Error) => {
	console.error(error);
});
