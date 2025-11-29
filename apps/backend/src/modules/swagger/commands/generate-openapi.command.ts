import { Command } from 'nestjs-command';

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { openApiTagRegistry } from '../decorators/api-tag.decorator';
import { SwaggerService } from '../services/swagger.service';

@Injectable()
export class GenerateOpenapiCommand {
	private readonly logger = new Logger(GenerateOpenapiCommand.name);

	constructor(
		private readonly swaggerService: SwaggerService,
		private readonly appHolder: AppInstanceHolder,
	) {}

	@Command({
		command: 'openapi:generate',
		describe: 'Generate OpenAPI JSON spec for Smart Panel backend',
	})
	async generate(): Promise<void> {
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

		this.logger.log(`OpenAPI spec written to: ${outputPath}`);
		this.logger.log(`Endpoints: ${Object.keys(document.paths || {}).length}`);
		this.logger.log(`Tags: ${(document.tags || []).length}`);
	}
}

