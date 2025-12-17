import { CommandFactory } from 'nest-commander';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { getDiscoveredExtensions } from './modules/extensions/services/extensions-discovery-cache';
import { setGlobalAppInstance } from './common/services/app-instance-holder.service';

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

	// Create INestApplication for commands that need it (e.g., OpenAPI generation)
	const app = await NestFactory.create<NestFastifyApplication>(appModule, new FastifyAdapter(), {
		bufferLogs: true,
	});

	// Set global app instance so AppInstanceHolder can access it when initialized in command context
	setGlobalAppInstance(app);

	// Run commands using nest-commander
	// CommandFactory.run creates its own application context, but AppInstanceHolder
	// will use the global app instance in its onModuleInit hook
	try {
		await CommandFactory.run(appModule, {
			logger: ['log', 'error', 'warn', 'debug', 'verbose'],
		});
	} catch (error) {
		console.error(error);
		await app.close();
		process.exit(1);
	}

	await app.close();
}

bootstrap().catch((error: Error) => {
	console.error(error);
	process.exit(1);
});
