import { Injectable } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { API_PREFIX } from '../../app.constants';

import { openApiTagRegistry } from './decorators/api-tag.decorator';
import { SWAGGER_EXTRA_MODELS } from './swagger-extra-models';

@Injectable()
export class SwaggerService {
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
			.addBearerAuth()
			.build();

		const document = SwaggerModule.createDocument(app, swaggerConfig, {
			operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
			extraModels: SWAGGER_EXTRA_MODELS,
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
}
