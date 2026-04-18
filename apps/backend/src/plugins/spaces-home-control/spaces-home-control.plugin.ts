import { Module, OnModuleInit } from '@nestjs/common';

import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	SPACES_HOME_CONTROL_PLUGIN_API_TAG_DESCRIPTION,
	SPACES_HOME_CONTROL_PLUGIN_API_TAG_NAME,
	SPACES_HOME_CONTROL_PLUGIN_NAME,
} from './spaces-home-control.constants';
import { SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS } from './spaces-home-control.openapi';

/**
 * Spaces Home Control plugin.
 *
 * Phase 3a skeleton. This plugin will own Room and Zone space types along
 * with their lighting, climate, covers, sensor, and media role domains,
 * intent catalog, suggestions, and undo history once those files are
 * relocated out of `modules/spaces/` in subsequent commits on this branch.
 *
 * For now it is an empty shell: the providers, controllers, and entity
 * registrations still live in `SpacesModule`. Registering the skeleton
 * ahead of the relocation lets us wire the route prefix and extension
 * metadata without disrupting existing clients. See Phase 3a in
 * `tasks/plans/plan-spaces-plugin-system-signage.md`.
 */
@ApiTag({
	tagName: SPACES_HOME_CONTROL_PLUGIN_NAME,
	displayName: SPACES_HOME_CONTROL_PLUGIN_API_TAG_NAME,
	description: SPACES_HOME_CONTROL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [SwaggerModule],
	providers: [],
	controllers: [],
	exports: [],
})
export class SpacesHomeControlPlugin implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		for (const model of SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: SPACES_HOME_CONTROL_PLUGIN_NAME,
			name: 'Spaces Home Control',
			description:
				'Provides the built-in Room and Zone space types along with lighting, climate, covers, sensor, and media role domains, intent catalog, suggestions, and undo history.',
			author: 'FastyBird',
			readme: `# Spaces Home Control Plugin

Contributes the home-control space types (Room and Zone) that turn the
Smart Panel into an interactive surface for controlling devices.

## Features

- **Room and Zone space types** — organize physical rooms and logical groupings.
- **Lighting domain** — discover light targets, assign roles, execute lighting intents (on/off, brightness, color, temperature).
- **Climate domain** — HVAC and setpoint roles, climate intents.
- **Covers domain** — blinds, shades, and cover roles and intents.
- **Sensor domain** — sensor roles and aggregated state.
- **Media domain** — media activity bindings and orchestrated playback.
- **Intent catalog** — YAML-driven intent definitions for voice/text assistants.
- **Suggestions and undo history** — space-scoped automation hints and reversible intents.

## Uninstall behavior

Uninstalling this plugin disables Room and Zone creation and strips the
domain endpoints listed above. Synthetic and signage space-type plugins
continue to work independently.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
