import { Injectable } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule, getSchemaPath } from '@nestjs/swagger';

import { API_PREFIX } from '../../../app.constants';
import { openApiTagRegistry } from '../decorators/api-tag.decorator';

import { ExtendedDiscriminatorRegistration, ExtendedDiscriminatorService } from './extended-discriminator.service';
import { SwaggerModelsRegistryService } from './swagger-models-registry.service';

@Injectable()
export class SwaggerDocumentService {
	constructor(
		private readonly registry: SwaggerModelsRegistryService,
		private readonly extendedDiscriminatorRegistry: ExtendedDiscriminatorService,
	) {}

	/**
	 * Create OpenAPI document from the NestJS application
	 * @param app The NestJS application instance
	 * @returns OpenAPI document object
	 */
	createDocument(app: INestApplication): OpenAPIObject {
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
			.addBearerAuth(
				{
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
				'authentication',
			)
			.addApiKey(
				{
					type: 'apiKey',
					in: 'header',
					name: 'x-display-secret',
				},
				'x-display-secret',
			)
			.build();

		const document = SwaggerModule.createDocument(app, swaggerConfig, {
			operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
			extraModels: this.registry.getAll(),
		});

		// Set OpenAPI version to 3.1.0
		document.openapi = '3.1.0';

		// Add summary field to info (OpenAPI 3.1.0 feature)
		if (document.info) {
			(document.info as { summary?: string }).summary =
				'The FastyBird Smart Panel API provides a local, real-time interface for retrieving device data, monitoring statuses, and integrating third-party IoT systems. It enables seamless communication between the smart panel and connected devices, ensuring fast, private, and reliable interactions without cloud dependencies.';
		}

		// Get tag definitions and sort them
		const tagDefinitions = openApiTagRegistry.getTagDefinitions();

		/**
		 * Sort tags by:
		 * 1. modules (name endsWith " module") – alphabetical
		 * 2. plugins (name endsWith " plugin") – alphabetical
		 * 3. everything else – alphabetical, at the bottom
		 */
		tagDefinitions.sort((a, b) => {
			const an = a.name.toLowerCase();
			const bn = b.name.toLowerCase();

			const aIsModule = an.endsWith(' module');
			const bIsModule = bn.endsWith(' module');

			const aIsPlugin = an.endsWith(' plugin');
			const bIsPlugin = bn.endsWith(' plugin');

			// 1) Modules go first
			if (aIsModule && !bIsModule) return -1;
			if (!aIsModule && bIsModule) return 1;

			// 2) Plugins go second
			if (aIsPlugin && !bIsPlugin) return -1;
			if (!aIsPlugin && bIsPlugin) return 1;

			// 3) Everything else: alphabetical among themselves
			return an.localeCompare(bn);
		});

		document.tags = tagDefinitions;

		// Exclude example-extension paths (demo/test endpoints) from Swagger UI
		const originalPaths = document.paths;
		const filteredPaths: Record<string, unknown> = {};
		for (const [path, pathItem] of Object.entries(originalPaths || {})) {
			// Skip example-extension paths
			if (!path.includes('/example-extension/')) {
				filteredPaths[path] = pathItem;
			}
		}
		document.paths = filteredPaths;

		this.applyExtendedDiscriminators(document, this.extendedDiscriminatorRegistry.getAll());

		this.adjustThirdPartyDemoWebhookPath(document);

		this.transformAllOfToRef(document);

		this.removeDiscriminatorFromBaseSchemas(document);

		this.addSecurityToNonPublicRoutes(document, app);

		return document;
	}

	/**
	 * Setup Swagger UI for the running Nest application
	 * @param app The NestJS application instance
	 */
	setup(app: INestApplication): void {
		const document = this.createDocument(app);

		SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
			swaggerOptions: {
				persistAuthorization: true,
				docExpansion: 'none',
				filter: true,
				showRequestDuration: true,
			},
		});
	}

	private adjustThirdPartyDemoWebhookPath(document: OpenAPIObject): void {
		const paths = document.paths;

		for (const [path, pathItem] of Object.entries(paths)) {
			const putOperation = pathItem?.put;

			if (putOperation?.operationId === 'update-devices-third-party-plugin-demo-properties') {
				// Přidáme novou "ukázkovou" cestu
				paths['/third-party/webhook'] = {
					put: putOperation,
				};

				// a starou interní cestu odstraníme
				delete paths[path];
				break;
			}
		}
	}

	/**
	 * Transform allOf arrays containing only a single $ref into direct $ref.
	 * This fixes a bug in openapi-typescript that doesn't handle allOf with single $ref correctly.
	 * The discriminator is removed as it's already applied to the referenced schema.
	 */
	private transformAllOfToRef(document: OpenAPIObject): void {
		const schemas = document.components?.schemas;
		if (!schemas) return;

		for (const [, schema] of Object.entries(schemas)) {
			if (typeof schema !== 'object' || schema === null || '$ref' in schema) {
				continue;
			}

			// Process schema properties
			if ('properties' in schema && typeof schema.properties === 'object') {
				for (const [propName, propSchema] of Object.entries(schema.properties)) {
					if (typeof propSchema === 'object' && propSchema !== null && 'allOf' in propSchema) {
						const allOf = propSchema.allOf;
						if (
							Array.isArray(allOf) &&
							allOf.length === 1 &&
							typeof allOf[0] === 'object' &&
							allOf[0] !== null &&
							'$ref' in allOf[0]
						) {
							// Transform allOf with single $ref to direct $ref
							const ref = allOf[0].$ref;
							const description = 'description' in propSchema ? propSchema.description : undefined;

							// Create new schema object with $ref and preserve description only
							// Discriminator is removed as it's already applied to the referenced schema
							const newPropSchema: Record<string, unknown> = {
								$ref: ref,
							};

							if (description) {
								newPropSchema.description = description;
							}

							schema.properties[propName] = newPropSchema;
						}
					}
				}
			}
		}
	}

	/**
	 * Remove discriminator property from variant schemas when they're used in discriminated unions.
	 * This prevents duplicate property errors in code generators (e.g., Dart's json_serializable with Freezed).
	 * Freezed handles the discriminator via unionKey, so we don't need it as a regular field in variants.
	 */
	private removeDiscriminatorFromBaseSchemas(document: OpenAPIObject): void {
		const schemas = document.components?.schemas;
		if (!schemas) return;

		// Process all schemas to find oneOf with discriminators (both at schema level and in properties)
		const processOneOf = (oneOfSchema: unknown, discriminatorProperty: string): void => {
			if (
				typeof oneOfSchema !== 'object' ||
				oneOfSchema === null ||
				!('oneOf' in oneOfSchema) ||
				!Array.isArray(oneOfSchema.oneOf)
			) {
				return;
			}

			// Remove discriminator property from all variant schemas
			for (const oneOfItem of oneOfSchema.oneOf) {
				if (
					typeof oneOfItem === 'object' &&
					oneOfItem !== null &&
					'$ref' in oneOfItem &&
					typeof (oneOfItem as { $ref: unknown }).$ref === 'string'
				) {
					const ref = (oneOfItem as { $ref: string }).$ref;
					if (ref.startsWith('#/components/schemas/')) {
						const variantSchemaName = ref.replace('#/components/schemas/', '');
						const variantSchema = schemas[variantSchemaName];

						if (
							variantSchema &&
							typeof variantSchema === 'object' &&
							variantSchema !== null &&
							!('$ref' in variantSchema) &&
							'properties' in variantSchema &&
							typeof variantSchema.properties === 'object'
						) {
							// Remove discriminator property from variant schema
							// Freezed will handle it via unionKey
							delete variantSchema.properties[discriminatorProperty];
						}
					}
				}
			}
		};

		// Find all schemas with oneOf and discriminator at schema level
		for (const schema of Object.values(schemas)) {
			if (typeof schema !== 'object' || schema === null || '$ref' in schema) {
				continue;
			}

			// Check schema-level oneOf
			if ('oneOf' in schema && 'discriminator' in schema) {
				const discriminator = schema.discriminator;
				if (
					typeof discriminator === 'object' &&
					discriminator !== null &&
					'propertyName' in discriminator &&
					typeof discriminator.propertyName === 'string'
				) {
					processOneOf(schema, discriminator.propertyName);
				}
			}

			// Check properties for oneOf with discriminator
			if ('properties' in schema && typeof schema.properties === 'object') {
				for (const propSchema of Object.values(schema.properties)) {
					if (
						typeof propSchema === 'object' &&
						propSchema !== null &&
						'oneOf' in propSchema &&
						'discriminator' in propSchema
					) {
						const discriminator = propSchema.discriminator;
						if (
							typeof discriminator === 'object' &&
							discriminator !== null &&
							'propertyName' in discriminator &&
							typeof discriminator.propertyName === 'string'
						) {
							processOneOf(propSchema, discriminator.propertyName);
						}
					}
				}
			}
		}

		// Also remove from base schema if it exists
		const weatherBaseSchema = schemas['ConfigModuleDataWeather'];
		if (
			weatherBaseSchema &&
			typeof weatherBaseSchema === 'object' &&
			weatherBaseSchema !== null &&
			!('$ref' in weatherBaseSchema) &&
			'properties' in weatherBaseSchema &&
			typeof weatherBaseSchema.properties === 'object'
		) {
			delete weatherBaseSchema.properties['location_type'];
		}
	}

	/**
	 * Apply extended discriminator mappings to the OpenAPI document.
	 * Groups registrations by parent schema and discriminator property,
	 * then configures oneOf and discriminator properties accordingly.
	 */
	private applyExtendedDiscriminators(
		document: OpenAPIObject,
		registrations: ExtendedDiscriminatorRegistration[],
	): void {
		const schemas = document.components?.schemas;
		if (!schemas) return;

		// Group registrations by (parentClass + discriminatorProperty)
		const groups = new Map<string, ExtendedDiscriminatorRegistration[]>();

		for (const reg of registrations) {
			const parentSchemaPath = getSchemaPath(reg.parentClass);
			const key = `${parentSchemaPath}::${reg.discriminatorProperty}`;
			const group = groups.get(key);
			if (group) {
				group.push(reg);
			} else {
				groups.set(key, [reg]);
			}
		}

		for (const [groupKey, regs] of groups.entries()) {
			const [parentSchemaPath, discriminatorProperty] = groupKey.split('::');

			// Extract schema name from path (e.g., "#/components/schemas/PageEntity" -> "PageEntity")
			const parentSchemaName = parentSchemaPath.replace('#/components/schemas/', '');

			const parentSchema = schemas[parentSchemaName];
			if (!parentSchema) {
				// Parent schema not found - skip this registration
				continue;
			}

			// Skip if parent schema is a reference (not a schema object)
			if ('$ref' in parentSchema) {
				continue;
			}

			// Configure discriminator mapping
			parentSchema.discriminator = {
				propertyName: discriminatorProperty,
				mapping: regs.reduce(
					(acc, r) => {
						acc[r.discriminatorValue] = getSchemaPath(r.modelClass);
						return acc;
					},
					{} as Record<string, string>,
				),
			};
		}
	}

	/**
	 * Add security requirements to all operations that don't already have security defined.
	 * This ensures non-public routes have the required security schemes.
	 * Public routes should explicitly set security to [] using @ApiSecurity([]) from @nestjs/swagger.
	 */
	private addSecurityToNonPublicRoutes(document: OpenAPIObject, app: INestApplication): void {
		const paths = document.paths;
		if (!paths) return;

		// Security requirements: both authentication and x-display-secret
		const securityRequirements = [
			{
				authentication: [] as string[],
			},
			{
				'x-display-secret': [] as string[],
			},
		];

		for (const [path, pathItem] of Object.entries(paths)) {
			if (!pathItem || typeof pathItem !== 'object') continue;

			// Check all HTTP methods
			const operations = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

			for (const method of operations) {
				const operation = pathItem[method];
				if (!operation || typeof operation !== 'object') continue;

				// Only add security if it's not already defined
				// Routes with @Public() should explicitly set security to [] using @ApiSecurity([])
				// to prevent security from being added automatically
				if (!('security' in operation)) {
					operation.security = securityRequirements;
				}
			}
		}
	}
}
