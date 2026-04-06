import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { API_PREFIX } from '../../../app.constants';
import { createExtensionLogger } from '../../../common/logger';
import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { SwaggerDocumentService } from '../services/swagger-document.service';
import { SWAGGER_MODULE_NAME } from '../swagger.constants';

interface ServeSwaggerOptions {
	port?: number;
}

@Command({
	name: 'swagger:serve',
	description: 'Start a standalone Swagger UI server for API documentation',
})
@Injectable()
export class ServeSwaggerCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(SWAGGER_MODULE_NAME, 'ServeSwaggerCommand');

	constructor(
		private readonly swaggerService: SwaggerDocumentService,
		private readonly appHolder: AppInstanceHolder,
	) {
		super();
	}

	async run(_passedParams: string[], options?: ServeSwaggerOptions): Promise<void> {
		const app = this.appHolder.getApp();
		const port = options?.port ?? parseInt(process.env.FB_BACKEND_PORT || '3000', 10);

		console.log('\x1b[36m📖 Starting Swagger UI server...\x1b[0m\n');

		this.swaggerService.setup(app);

		await app.listen(port, '0.0.0.0');

		console.log(`\x1b[32m✅ Swagger UI available at http://localhost:${port}/${API_PREFIX}/docs\x1b[0m`);
		console.log('\x1b[90mPress Ctrl+C to stop\x1b[0m\n');

		// Block until process is killed — without this, CommandFactory.run()
		// resolves and cli.ts calls app.close(), tearing down the server.
		await new Promise<void>((resolve) => {
			process.on('SIGINT', resolve);
			process.on('SIGTERM', resolve);
		});
	}

	@Option({
		flags: '-p, --port <port>',
		description: 'Port to run the Swagger UI server on (default: FB_BACKEND_PORT or 3000)',
	})
	parsePort(val: string): number {
		return parseInt(val, 10);
	}
}
