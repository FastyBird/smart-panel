import { useContainer } from 'class-validator';
import { CommandModule, CommandService } from 'nestjs-command';

import { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';

import { AppModule } from './app.module';

async function bootstrap() {
	const isProduction = process.env.NODE_ENV === 'production';

	const validLogLevels: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

	const logLevels =
		(process.env.FB_LOG_LEVEL?.split(',') as LogLevel[]) ??
		(isProduction ? ['log', 'warn', 'error', 'fatal'] : ['verbose', 'debug', 'log', 'warn', 'error', 'fatal']);

	const app = await NestFactory.createApplicationContext(AppModule, {
		logger: logLevels.filter((level): level is LogLevel => validLogLevels.includes(level)),
	});

	// Optional: Make class-transformer aware of NestJS context
	useContainer(app.select(AppModule), { fallbackOnErrors: true });

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
