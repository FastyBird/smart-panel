import { useContainer } from 'class-validator';
import { CommandModule, CommandService } from 'nestjs-command';

import { NestFactory } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';

import { AppModule } from './app.module';
import { SystemLoggerService } from './modules/system/services/system-logger.service';

async function bootstrap() {
	process.env.FB_CLI = 'on';

	const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });

	const sysLogger = app.get(SystemLoggerService);

	app.useLogger(sysLogger);

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
