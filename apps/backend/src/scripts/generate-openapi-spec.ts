/**
 * Script to generate OpenAPI specification JSON file
 * Run with: pnpm run generate:openapi
 */
import * as fs from 'fs';
import * as path from 'path';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { API_PREFIX } from '../app.constants';
import { AppModule } from '../app.module';
// Import OpenAPI transformation files to register module-specific transformations
// These files register their transformations when imported (side-effect imports)
import { getDiscoveredExtensions } from '../common/extensions/extensions.discovery-cache';
import { ValidationExceptionFactory } from '../common/validation/validation-exception-factory';
import { openApiTagRegistry } from '../modules/api/decorators/api-tag.decorator';
import { openApiTransformRegistry } from '../modules/api/decorators/openapi-transform.decorator';
import { SwaggerService } from '../modules/swagger/swagger.service';
import '../modules/system/system.openapi';

async function generateOpenApiSpec() {
	console.log('🔧 Generating OpenAPI specification...\n');

	try {
		// Discover extensions
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

		console.log(`📦 Discovered extensions → modules: ${moduleExtensions.length}, plugins: ${pluginExtensions.length}`);

		const appModule = AppModule.register({
			moduleExtensions,
			pluginExtensions,
		});

		// Create the NestJS application (without actually starting the server)
		const app = await NestFactory.create<NestFastifyApplication>(appModule, new FastifyAdapter(), {
			logger: false, // Disable logging during generation
		});

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

		// Generate the OpenAPI document using SwaggerService
		const swaggerService = app.get(SwaggerService);
		const document = swaggerService.createDocument(app);

		// Remove /api/v1 prefix from paths to match original spec
		// Also exclude example-extension paths (demo/test endpoints)
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

		// Apply module/plugin-specific transformations
		// These are registered by importing module.openapi.ts files
		openApiTransformRegistry.apply(document as unknown as Record<string, unknown>);

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
		const outputDir = path.join(__dirname, '../../../../spec/api/v1'); // spec/api/v1 at monorepo root
		const outputPath = path.join(outputDir, 'openapi.json');

		// Ensure directory exists
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });

		// Write the OpenAPI spec to file
		fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

		console.log(`\n✅ OpenAPI specification generated successfully!`);
		console.log(`📄 Output: ${outputPath}`);
		console.log(`📊 Endpoints: ${Object.keys(document.paths || {}).length}`);
		console.log(`🏷️  Tags: ${(document.tags || []).length}`);

		// Close the app
		await app.close();

		process.exit(0);
	} catch (error) {
		console.error('❌ Error generating OpenAPI specification:', error);
		process.exit(1);
	}
}

// Run the generator
void generateOpenApiSpec();
