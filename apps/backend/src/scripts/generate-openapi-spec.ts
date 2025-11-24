/**
 * Script to generate OpenAPI specification JSON file
 * Run with: pnpm run generate:openapi
 */
import * as fs from 'fs';
import * as path from 'path';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_PREFIX } from '../app.constants';
import { AppModule } from '../app.module';
import { getDiscoveredExtensions } from '../common/extensions/extensions.discovery-cache';
import { ValidationExceptionFactory } from '../common/validation/validation-exception-factory';

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

		// Create Swagger configuration (same as main.ts)
		const swaggerConfig = new DocumentBuilder()
			.setTitle('FastyBird Smart Panel API')
			.setDescription('API documentation for FastyBird Smart Panel backend')
			.setVersion('1.0')
			.addBearerAuth()
			.build();

		// Generate the OpenAPI document
		const document = SwaggerModule.createDocument(app, swaggerConfig);

		// Define output path - align with lint:openapi script location
		const outputDir = path.join(__dirname, '../../../../../spec/api/v1'); // spec/api/v1 at monorepo root
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
generateOpenApiSpec();
