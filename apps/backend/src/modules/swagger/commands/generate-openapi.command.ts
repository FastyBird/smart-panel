import { Command, CommandRunner } from 'nest-commander';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { openApiTagRegistry } from '../decorators/api-tag.decorator';
import { SwaggerService } from '../services/swagger.service';

@Command({
	name: 'openapi:generate',
	description: 'Generate OpenAPI JSON spec for Smart Panel backend',
})
@Injectable()
export class GenerateOpenapiCommand extends CommandRunner {
	private readonly logger = new Logger(GenerateOpenapiCommand.name);

	constructor(
		private readonly swaggerService: SwaggerService,
		private readonly appHolder: AppInstanceHolder,
	) {
		super();
	}

	async run(_passedParams: string[], _options?: Record<string, any>): Promise<void> {
		console.log('\x1b[36m🔧 Generating OpenAPI specification...\x1b[0m\n');

		this.logger.log('Generating OpenAPI spec...');

		const app = this.appHolder.getApp();
		const document = this.swaggerService.createDocument(app);

		// Remove /api/v1 prefix from paths to match original spec
		// Also exclude example-extension paths (demo/test endpoints)
		// Note: SwaggerService already filters example-extension, but we do it here again for safety
		const originalPaths = document.paths;

		const normalizedPaths: Record<string, unknown> = {};
		for (const [path, pathItem] of Object.entries(originalPaths || {})) {
			// Skip example-extension paths
			if (path.includes('/example-extension/')) {
				continue;
			}
			const normalizedPath = path.replace(/^\/api\/v1/, '');
			normalizedPaths[normalizedPath] = pathItem;
		}

		document.paths = normalizedPaths;

		// Use the registry to get tag definitions and mapping
		const tagMapping = openApiTagRegistry.getTagNameMapping();
		const tagDefinitions = openApiTagRegistry.getTagDefinitions();

		// Update tag names in all operations
		if (document.paths) {
			for (const pathItem of Object.values(document.paths)) {
				for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
					const operation = (pathItem as Record<string, { tags?: string[] }>)[method];
					if (operation?.tags) {
						operation.tags = operation.tags.map((tag: string) => tagMapping[tag] || tag);
					}
				}
			}
		}

		// Update tag definitions (SwaggerService already sets them, but we need to ensure tag mapping is applied)
		// The tags are already sorted by SwaggerService, so we just need to update the names if needed
		document.tags = tagDefinitions;

		// Define output path - align with lint:openapi script location
		// Path from dist/modules/swagger/commands/ to spec/api/v1 at monorepo root
		// dist/modules/swagger/commands/ -> dist/modules/swagger/ -> dist/modules/ -> dist/ -> apps/backend/ -> apps/ -> root
		const outputPath = path.resolve(__dirname, '../../../../../spec/api/v1/openapi.json');
		const outputDir = path.dirname(outputPath);

		// Ensure directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Write the OpenAPI spec to file
		fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

		const endpointCount = Object.keys(document.paths || {}).length;
		const tagCount = (document.tags || []).length;

		console.log('\n\x1b[32m✅ OpenAPI specification generated successfully!\x1b[0m');
		console.log(`\x1b[36m📄 Output: \x1b[0m${outputPath}`);
		console.log(`\x1b[36m📊 Endpoints: \x1b[1m${endpointCount}\x1b[0m`);
		console.log(`\x1b[36m🏷️  Tags: \x1b[1m${tagCount}\x1b[0m\n`);

		this.logger.log(`OpenAPI spec written to: ${outputPath}`);
		this.logger.log(`Endpoints: ${endpointCount}`);
		this.logger.log(`Tags: ${tagCount}`);
	}
}
