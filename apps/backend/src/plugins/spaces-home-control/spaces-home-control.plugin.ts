import { Global, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DevicesModule } from '../../modules/devices/devices.module';
import { ChannelEntity, DeviceEntity } from '../../modules/devices/entities/devices.entity';
import { DisplaysModule } from '../../modules/displays/displays.module';
import { SpaceHomePageResolverRegistryService } from '../../modules/displays/services/space-home-page-resolver-registry.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { IntentsModule } from '../../modules/intents/intents.module';
import { SeedModule } from '../../modules/seed/seeding.module';
import { SeedRegistryService } from '../../modules/seed/services/seed-registry.service';
import { CreateSpaceDto } from '../../modules/spaces/dto/create-space.dto';
import { UpdateSpaceDto } from '../../modules/spaces/dto/update-space.dto';
import { SpaceEntity } from '../../modules/spaces/entities/space.entity';
import { SpaceRolesTypeMapperService } from '../../modules/spaces/services/space-roles-type-mapper.service';
import { SpacesTypeMapperService } from '../../modules/spaces/services/spaces-type-mapper.service';
import { SpaceRoleType, SpaceType } from '../../modules/spaces/spaces.constants';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';
import { ToolProviderRegistryService } from '../../modules/tools/services/tool-provider-registry.service';
import { ToolsModule } from '../../modules/tools/tools.module';
import { WebsocketModule } from '../../modules/websocket/websocket.module';

import { SpacesHomeControlUpdatePluginConfigDto } from './dto/update-config.dto';
import { RoomSpaceEntity } from './entities/room-space.entity';
import { SpaceActiveMediaActivityEntity } from './entities/space-active-media-activity.entity';
import { SpaceClimateRoleEntity } from './entities/space-climate-role.entity';
import { SpaceCoversRoleEntity } from './entities/space-covers-role.entity';
import { SpaceLightingRoleEntity } from './entities/space-lighting-role.entity';
import { SpaceMediaActivityBindingEntity } from './entities/space-media-activity-binding.entity';
import { SpaceSensorRoleEntity } from './entities/space-sensor-role.entity';
import { ZoneSpaceEntity } from './entities/zone-space.entity';
import { SpaceActivityListener } from './listeners/space-activity.listener';
import { SpaceClimateStateListener } from './listeners/space-climate-state.listener';
import { SpaceLightingStateListener } from './listeners/space-lighting-state.listener';
import { SpaceSensorStateListener } from './listeners/space-sensor-state.listener';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { SpacesHomeControlConfigModel } from './models/config.model';
import { ClimateIntentService } from './services/climate-intent.service';
import { CoversIntentService } from './services/covers-intent.service';
import { DerivedMediaEndpointService } from './services/derived-media-endpoint.service';
import { HomeControlHomePageResolver } from './services/home-control-home-page.resolver';
import { HomeControlSpacesService } from './services/home-control-spaces.service';
import { LightingIntentService } from './services/lighting-intent.service';
import { MediaCapabilityService } from './services/media-capability.service';
import { SpaceClimateRoleService } from './services/space-climate-role.service';
import { SpaceClimateStateService } from './services/space-climate-state.service';
import { SpaceContextSnapshotService } from './services/space-context-snapshot.service';
import { SpaceCoversRoleService } from './services/space-covers-role.service';
import { SpaceCoversStateService } from './services/space-covers-state.service';
import { SpaceIntentBaseService } from './services/space-intent-base.service';
import { SpaceIntentService } from './services/space-intent.service';
import { SpaceLightingRoleService } from './services/space-lighting-role.service';
import { SpaceLightingStateService } from './services/space-lighting-state.service';
import { SpaceLightingToolService } from './services/space-lighting-tool.service';
import { SpaceMediaActivityBindingService } from './services/space-media-activity-binding.service';
import { SpaceMediaActivityService } from './services/space-media-activity.service';
import { SpaceSensorRoleService } from './services/space-sensor-role.service';
import { SpaceSensorStateService } from './services/space-sensor-state.service';
import { SpaceSuggestionHeartbeatService } from './services/space-suggestion-heartbeat.service';
import { SpaceSuggestionService } from './services/space-suggestion.service';
import { SpaceUndoHistoryService } from './services/space-undo-history.service';
import { SpacesSeederService } from './services/spaces-seeder.service';
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
 * Owns Room and Zone space types along with their lighting, climate,
 * covers, sensor, and media role domains, intent catalog, suggestions,
 * and undo history. Domain endpoints live in the plugin's
 * `SpacesDomainController` but it is registered on `SpacesModule` (core)
 * so its routes keep their historical `/api/v1/modules/spaces/spaces/...`
 * URLs — critical for admin and panel clients that target those paths.
 * Generic space CRUD stays in `modules/spaces/SpacesController`.
 */
@ApiTag({
	tagName: SPACES_HOME_CONTROL_PLUGIN_NAME,
	displayName: SPACES_HOME_CONTROL_PLUGIN_API_TAG_NAME,
	description: SPACES_HOME_CONTROL_PLUGIN_API_TAG_DESCRIPTION,
})
// `@Global()` keeps the exported services reachable from any module
// without each one importing this plugin (and sidesteps a circular
// SpacesModule → plugin → DisplaysModule → SpacesModule chain). It also
// lets `SpacesModule` register `SpacesDomainController` (physically
// defined in this plugin) without a reciprocal module import — the
// controller injects every domain service directly from the @Global
// provider pool.
@Global()
@Module({
	imports: [
		// Repositories for the plugin's own entities + the Devices entities
		// the listeners / role services inject. Repeating the registrations
		// from SpacesModule is fine — TypeORM scopes per-module and both
		// owners get their own repository instance.
		TypeOrmModule.forFeature([
			SpaceEntity,
			RoomSpaceEntity,
			ZoneSpaceEntity,
			SpaceLightingRoleEntity,
			SpaceClimateRoleEntity,
			SpaceCoversRoleEntity,
			SpaceSensorRoleEntity,
			SpaceMediaActivityBindingEntity,
			SpaceActiveMediaActivityEntity,
			DeviceEntity,
			ChannelEntity,
		]),
		SwaggerModule,
		DevicesModule,
		DisplaysModule,
		IntentsModule,
		SpacesModule,
		SeedModule,
		ToolsModule,
		WebsocketModule,
	],
	providers: [
		// Resolvers + loader
		HomeControlHomePageResolver,
		HomeControlSpacesService,
		IntentSpecLoaderService,
		// Listeners
		SpaceActivityListener,
		SpaceClimateStateListener,
		SpaceLightingStateListener,
		SpaceSensorStateListener,
		WebsocketExchangeListener,
		// Intent services
		ClimateIntentService,
		CoversIntentService,
		LightingIntentService,
		SpaceIntentBaseService,
		SpaceIntentService,
		// Role services
		SpaceClimateRoleService,
		SpaceCoversRoleService,
		SpaceLightingRoleService,
		SpaceSensorRoleService,
		// State services
		SpaceClimateStateService,
		SpaceCoversStateService,
		SpaceLightingStateService,
		SpaceSensorStateService,
		// Media services
		DerivedMediaEndpointService,
		MediaCapabilityService,
		SpaceMediaActivityBindingService,
		SpaceMediaActivityService,
		// Support services
		SpaceContextSnapshotService,
		SpaceLightingToolService,
		SpaceSuggestionHeartbeatService,
		SpaceSuggestionService,
		SpaceUndoHistoryService,
		SpacesSeederService,
	],
	controllers: [],
	exports: [
		HomeControlSpacesService,
		IntentSpecLoaderService,
		ClimateIntentService,
		CoversIntentService,
		LightingIntentService,
		SpaceIntentBaseService,
		SpaceIntentService,
		SpaceClimateRoleService,
		SpaceCoversRoleService,
		SpaceLightingRoleService,
		SpaceSensorRoleService,
		SpaceClimateStateService,
		SpaceCoversStateService,
		SpaceLightingStateService,
		SpaceSensorStateService,
		DerivedMediaEndpointService,
		MediaCapabilityService,
		SpaceMediaActivityBindingService,
		SpaceMediaActivityService,
		SpaceContextSnapshotService,
		SpaceLightingToolService,
		SpaceSuggestionHeartbeatService,
		SpaceSuggestionService,
		SpaceUndoHistoryService,
	],
})
export class SpacesHomeControlPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly spaceHomePageResolverRegistry: SpaceHomePageResolverRegistryService,
		private readonly homeControlHomePageResolver: HomeControlHomePageResolver,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly spaceRolesTypeMapper: SpaceRolesTypeMapperService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly moduleSeeder: SpacesSeederService,
		private readonly toolProviderRegistry: ToolProviderRegistryService,
		private readonly spaceLightingTool: SpaceLightingToolService,
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

		// Room/Zone space type mappings — entity files moved into this plugin
		// in Phase 3a step 4.
		this.spacesTypeMapper.registerMapping<RoomSpaceEntity, CreateSpaceDto, UpdateSpaceDto>({
			type: SpaceType.ROOM,
			class: RoomSpaceEntity,
			createDto: CreateSpaceDto,
			updateDto: UpdateSpaceDto,
		});
		this.spacesTypeMapper.registerMapping<ZoneSpaceEntity, CreateSpaceDto, UpdateSpaceDto>({
			type: SpaceType.ZONE,
			class: ZoneSpaceEntity,
			createDto: CreateSpaceDto,
			updateDto: UpdateSpaceDto,
		});

		// Role subtype mappings — entities live in this plugin.
		this.spaceRolesTypeMapper.registerMapping<SpaceLightingRoleEntity>({
			type: SpaceRoleType.LIGHTING,
			class: SpaceLightingRoleEntity,
		});
		this.spaceRolesTypeMapper.registerMapping<SpaceClimateRoleEntity>({
			type: SpaceRoleType.CLIMATE,
			class: SpaceClimateRoleEntity,
		});
		this.spaceRolesTypeMapper.registerMapping<SpaceCoversRoleEntity>({
			type: SpaceRoleType.COVERS,
			class: SpaceCoversRoleEntity,
		});
		this.spaceRolesTypeMapper.registerMapping<SpaceSensorRoleEntity>({
			type: SpaceRoleType.SENSOR,
			class: SpaceSensorRoleEntity,
		});
		this.spaceRolesTypeMapper.registerMapping<SpaceMediaActivityBindingEntity>({
			type: SpaceRoleType.MEDIA_BINDING,
			class: SpaceMediaActivityBindingEntity,
		});
		this.spaceRolesTypeMapper.registerMapping<SpaceActiveMediaActivityEntity>({
			type: SpaceRoleType.ACTIVE_MEDIA,
			class: SpaceActiveMediaActivityEntity,
		});

		// Register the space lighting tool provider (moved here from
		// SpacesModule.onModuleInit; the tool is plugin-owned).
		this.toolProviderRegistry.register(this.spaceLightingTool);

		// Seed the spaces module — Room/Zone structure + seeded lighting /
		// climate roles. The seeder itself owns the role-service injections
		// so it belongs to the plugin. Priority 125 stays after the core
		// spaces reset handler at priority 280 runs during factory reset,
		// while still letting the seeder run in its natural 120–130 range.
		this.seedRegistry.register(
			SPACES_HOME_CONTROL_PLUGIN_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			125,
		);

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
