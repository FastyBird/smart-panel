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
		.setTitle('🖥️ FastyBird Smart Panel API 🚀')
		.setDescription(
			'Welcome to the **FastyBird Smart Panel API Documentation**!\n\nThis API is the central interface for integrating with the **FastyBird Smart Panel**, a modern, modular, and open-source platform for managing smart home devices and dashboards — all running on **your local hardware**, with no cloud dependency.\n\n---\n\n## 🌟 What Can This API Do?\n\nThe **FastyBird Smart Panel API** provides:\n\n- 🎛️ **Full Access to Smart Devices**  \n  Manage devices, channels, and properties — read current values or send commands.\n\n- 📊 **Real-Time Monitoring & Sync**  \n  Receive live updates from sensors, switches, and more through WebSocket connections.\n\n- 🔌 **Third-Party Integration Support**  \n  Easily connect external systems using standard API calls to sync data and trigger actions.\n\n- 🧱 **Dashboard Customization**  \n  Build or modify dashboard layouts, pages, tiles, and data sources dynamically via API.\n\n- 🚀 **Local-First Control**  \n  The entire stack is designed to run offline on your own network — secure, private, and fast.\n\n---\n\n## 🚀 Getting Started\n\n> 🛠️ **No cloud required. Everything runs locally.**\n\n### 1. Install the Smart Panel  \nDeploy the platform to a supported device like a Raspberry Pi or ReTerminal.\n\n### 2. Connect & Configure Devices  \nAdd devices via the Admin App or API, either manually or through plugin integrations.\n\n### 3. Interact via REST or WebSocket  \nUse the API to read states, send commands, and subscribe to real-time updates.\n\n---\n\n## 🔎 API Modules Overview\n\n### Devices API  \nManage devices and their structure:  \n- Retrieve device/channel/property metadata  \n- Send control commands  \n- Sync state updates  \n\n### Dashboard API  \nConfigure your Smart Panel UI:  \n- Build pages and tiles  \n- Add data sources  \n- Organize device widgets  \n\n---\n\n## 📚 API Usage Examples\n\nUse this API to:\n\n- 💡 Read a temperature sensor value  \n- 🔘 Toggle a light switch  \n- 🧩 Display custom widgets  \n- 🔄 Sync external device state  \n- 📱 Integrate with your own mobile or desktop app  \n\n---\n\n## 🔐 Authentication\n\nUse token-based access when integrating external apps or third-party devices.  \nSee the [Authentication Guide](#) for details.\n\n---\n\n## 💬 Frequently Asked\n\n**Is the API cloud-based?**  \nNo — it runs entirely on your own hardware.\n\n**Do I need to be online?**  \nNo — the API is designed for offline-first use.\n\n**Can I control third-party devices?**  \nYes — use plugin-based extensions or the generic third-party interface.\n\n**Does the Smart Panel support real-time updates?**  \nYes — WebSocket support is built-in.\n\n---\n\n## 🤝 Need Help?\n\n- 💬 [Join the FastyBird Community](https://discord.gg/H7pHN3hbqq)  \n- 🛠️ [Explore the Docs](https://smart-panel.fastybird.com/docs)  \n- 📨 [Report an issue](https://github.com/fastybird/smart-panel/issues)\n\n---\n\n🚀 **Built with ❤️ by FastyBird** — Local-first, modular smart home integration.',
		)
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
