import { Global, Module, OnModuleInit } from '@nestjs/common';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DisplaysModule } from '../../modules/displays/displays.module';
import { SpaceHomePageResolverRegistryService } from '../../modules/displays/services/space-home-page-resolver-registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { SpaceType } from '../../modules/spaces/spaces.constants';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { SpacesHomeControlUpdatePluginConfigDto } from './dto/update-config.dto';
import { SpacesHomeControlConfigModel } from './models/config.model';
import { HomeControlHomePageResolver } from './services/home-control-home-page.resolver';
import {
	SPACES_HOME_CONTROL_PLUGIN_API_TAG_DESCRIPTION,
	SPACES_HOME_CONTROL_PLUGIN_API_TAG_NAME,
	SPACES_HOME_CONTROL_PLUGIN_NAME,
} from './spaces-home-control.constants';
import { SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS } from './spaces-home-control.openapi';
import { IntentSpecLoaderService } from './spec';

/**
 * Spaces Home Control plugin.
 *
 * Phase 3a skeleton. This plugin will own Room and Zone space types along
 * with their lighting, climate, covers, sensor, and media role domains,
 * intent catalog, suggestions, and undo history once those files are
 * relocated out of `modules/spaces/` in subsequent commits on this branch.
 *
 * Phase 5 adds the first real wiring: the home-page resolver for Room /
 * Zone space types — when a display is assigned to a room/zone and uses
 * `home_mode = auto_space`, this resolver decides which dashboard page is
 * the home page. Today that's always `null` (fall through to first-page
 * fallback), but the indirection is ready for a future "preferred page"
 * column without touching core.
 */
@ApiTag({
	tagName: SPACES_HOME_CONTROL_PLUGIN_NAME,
	displayName: SPACES_HOME_CONTROL_PLUGIN_API_TAG_NAME,
	description: SPACES_HOME_CONTROL_PLUGIN_API_TAG_DESCRIPTION,
})
// `@Global()` is transitional — domain services that still live in core
// (lighting/climate/covers intent + state, suggestion, …) inject
// `IntentSpecLoaderService` without importing this plugin, so we avoid a
// circular SpacesModule → plugin → DisplaysModule → SpacesModule chain.
// Drop the decorator once those callers relocate into the plugin in a
// later Phase 3a commit.
@Global()
@Module({
	imports: [SwaggerModule, DisplaysModule],
	providers: [HomeControlHomePageResolver, IntentSpecLoaderService],
	controllers: [],
	exports: [IntentSpecLoaderService],
})
export class SpacesHomeControlPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly spaceHomePageResolverRegistry: SpaceHomePageResolverRegistryService,
		private readonly homeControlHomePageResolver: HomeControlHomePageResolver,
	) {}

	onModuleInit() {
		// Register with PluginsTypeMapperService so the Extensions module lists
		// this plugin alongside the other module- and plugin-level extensions
		// (enable/disable toggle, metadata view). Without this call the
		// plugin is invisible to `/extensions/plugins`.
		this.configMapper.registerMapping<SpacesHomeControlConfigModel, SpacesHomeControlUpdatePluginConfigDto>({
			type: SPACES_HOME_CONTROL_PLUGIN_NAME,
			class: SpacesHomeControlConfigModel,
			configDto: SpacesHomeControlUpdatePluginConfigDto,
		});

		for (const model of SPACES_HOME_CONTROL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.spaceHomePageResolverRegistry.register(SpaceType.ROOM, this.homeControlHomePageResolver);
		this.spaceHomePageResolverRegistry.register(SpaceType.ZONE, this.homeControlHomePageResolver);

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
