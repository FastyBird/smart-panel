import { useContainer } from 'class-validator';
import { CommandModule, CommandService } from 'nestjs-command';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SchedulerRegistry } from '@nestjs/schedule';

import { API_PREFIX } from './app.constants';
import { AppModule } from './app.module';
import { getDiscoveredExtensions } from './common/extensions/extensions.discovery-cache';
import { AppInstanceHolder } from './common/services/app-instance-holder.service';
import { ValidationExceptionFactory } from './common/validation/validation-exception-factory';
import { SystemLoggerService } from './modules/system/services/system-logger.service';

async function bootstrap() {
	process.env.FB_CLI = 'on';

	const discovered = await getDiscoveredExtensions();

	const appModule = AppModule.register({
		moduleExtensions: discovered.backend
			.filter((e) => e.kind === 'module')
			.map((d) => ({
				routePrefix: d.routePrefix,
				extensionClass: d.extensionClass,
			})),
		pluginExtensions: discovered.backend
			.filter((e) => e.kind === 'plugin')
			.map((d) => ({
				routePrefix: d.routePrefix,
				extensionClass: d.extensionClass,
			})),
	});

	const app = await NestFactory.create<NestFastifyApplication>(appModule, new FastifyAdapter(), {
		bufferLogs: true,
	});

	const sysLogger = app.get(SystemLoggerService);

	app.useLogger(sysLogger);

	// Apply the same configuration as main.ts
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transformOptions: {
				enableImplicitConversion: true,
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

	// Set app instance in AppInstanceHolder for commands that need it (e.g., OpenAPI generation)
	const appHolder = app.get(AppInstanceHolder);
	appHolder.setApp(app);

	try {
		const schedulerRegistry = app.get(SchedulerRegistry);

		const jobs = schedulerRegistry.getCronJobs();

		jobs.forEach((job) => {
			job.stop();
		});

		await app.select(CommandModule).get(CommandService).exec();
		await app.close();
	} catch (error) {
		console.error(error);
		await app.close();
		process.exit(1);
	}
}

bootstrap().catch((error: Error) => {
	console.error(error);
});
