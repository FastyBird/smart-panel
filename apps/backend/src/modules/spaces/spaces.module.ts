import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SpacesDomainController } from '../../plugins/spaces-home-control/controllers/spaces-domain.controller';
import { RoomSpaceEntity } from '../../plugins/spaces-home-control/entities/room-space.entity';
import { SpaceActiveMediaActivityEntity } from '../../plugins/spaces-home-control/entities/space-active-media-activity.entity';
import { SpaceClimateRoleEntity } from '../../plugins/spaces-home-control/entities/space-climate-role.entity';
import { SpaceCoversRoleEntity } from '../../plugins/spaces-home-control/entities/space-covers-role.entity';
import { SpaceLightingRoleEntity } from '../../plugins/spaces-home-control/entities/space-lighting-role.entity';
import { SpaceMediaActivityBindingEntity } from '../../plugins/spaces-home-control/entities/space-media-activity-binding.entity';
import { SpaceSensorRoleEntity } from '../../plugins/spaces-home-control/entities/space-sensor-role.entity';
import { ZoneSpaceEntity } from '../../plugins/spaces-home-control/entities/zone-space.entity';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ChannelEntity, DeviceEntity } from '../devices/entities/devices.entity';
import { DisplayEntity } from '../displays/entities/displays.entity';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { IntentsModule } from '../intents/intents.module';
import { SeedModule } from '../seed/seeding.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { ToolsModule } from '../tools/tools.module';

import { SpacesController } from './controllers/spaces.controller';
import { UpdateSpacesConfigDto } from './dto/update-config.dto';
import { SpaceRoleEntity } from './entities/space-role.entity';
import { SpaceEntity } from './entities/space.entity';
import { SpacesConfigModel } from './models/config.model';
import { SpacesModuleResetService } from './services/module-reset.service';
import { SpaceCreateBuilderRegistryService } from './services/space-create-builder-registry.service';
import { SpaceRelationsLoaderRegistryService } from './services/space-relations-loader-registry.service';
import { SpaceRolesTypeMapperService } from './services/space-roles-type-mapper.service';
import { SpacesTypeMapperService } from './services/spaces-type-mapper.service';
import { SpacesService } from './services/spaces.service';
import { SPACES_MODULE_API_TAG_DESCRIPTION, SPACES_MODULE_API_TAG_NAME, SPACES_MODULE_NAME } from './spaces.constants';
import { SPACES_SWAGGER_EXTRA_MODELS } from './spaces.openapi';

@ApiTag({
	tagName: SPACES_MODULE_NAME,
	displayName: SPACES_MODULE_API_TAG_NAME,
	description: SPACES_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([
			SpaceEntity,
			RoomSpaceEntity,
			ZoneSpaceEntity,
			SpaceRoleEntity,
			SpaceLightingRoleEntity,
			SpaceClimateRoleEntity,
			SpaceCoversRoleEntity,
			SpaceMediaActivityBindingEntity,
			SpaceActiveMediaActivityEntity,
			SpaceSensorRoleEntity,
			DeviceEntity,
			ChannelEntity,
			DisplayEntity,
		]),
		DevicesModule,
		IntentsModule,
		SeedModule,
		ToolsModule,
	],
	// `SpacesDomainController` physically lives in the home-control plugin but
	// is registered here so RouterModule mounts its routes under
	// `/api/v1/modules/spaces/spaces/...` — preserving every domain URL
	// (lighting, climate, covers, sensors, media, suggestions, undo, intent
	// catalog) that admin and panel clients expect. Once they migrate to the
	// plugin's own prefix, this dual-location registration can move back.
	controllers: [SpacesController, SpacesDomainController],
	providers: [
		SpacesService,
		SpacesTypeMapperService,
		SpaceRolesTypeMapperService,
		SpaceCreateBuilderRegistryService,
		SpaceRelationsLoaderRegistryService,
		SpacesModuleResetService,
	],
	exports: [
		SpacesService,
		SpacesTypeMapperService,
		SpaceRolesTypeMapperService,
		SpaceCreateBuilderRegistryService,
		SpaceRelationsLoaderRegistryService,
	],
})
export class SpacesModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly moduleReset: SpacesModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		// Register factory reset handler
		this.factoryResetRegistry.register(
			SPACES_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			280,
		);

		this.modulesMapperService.registerMapping<SpacesConfigModel, UpdateSpacesConfigDto>({
			type: SPACES_MODULE_NAME,
			class: SpacesConfigModel,
			configDto: UpdateSpacesConfigDto,
		});

		for (const model of SPACES_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: SPACES_MODULE_NAME,
			name: 'Spaces',
			description: 'Manage spaces (rooms/zones) and organize devices and displays',
			author: 'FastyBird',
			readme: `# Spaces

> Module · by FastyBird

Provides a room-centric organisation layer for the Smart Panel. Devices and displays are grouped into *rooms* and *zones*, which act as the foundation for space-based dashboards, role-based controls (lighting, climate, covers, sensors, media) and the Buddy AI context.

## What it gives you

- A spatial map of your home: every device knows which room it lives in and every display knows which space it primarily serves
- A *role* layer on top of devices so pages and the assistant can talk about "lights in the living room" instead of "channel \`onoff\` of device \`abc-123\`"
- A pluggable concept of "what is a space" — synthetic rooms, signage spaces and home-control rooms can all coexist behind the same API

## Features

- **Space CRUD** — create, edit and delete rooms and zones with icon, name and ordering
- **Rooms and zones** — physical rooms (Living Room, Kitchen) and logical groupings (Downstairs, Outdoor); zones can contain rooms and inherit device membership
- **Device & display assignment** — attach devices and displays to a space individually or in bulk
- **Role registry** — channels register the role they play within a space (lighting, climate, covers, sensors, media); pages and Buddy use these roles to route commands
- **Plugin-extensible** — space *types* are pluggable: \`spaces-home-control\`, \`spaces-signage-info-panel\` and the synthetic plugins each register their own space subtype with extra fields and validation
- **Builder registry** — plugins extend the create / update flow with extra inputs (e.g. signage announcement defaults, home-control role bindings)
- **Validation** — \`SpaceExists\` and role-binding constraints are exported for use in any other module's DTOs
- **Stable identifiers** — re-ordering rooms or moving devices between spaces keeps every reference (dashboards, scenes, displays) intact

## API Endpoints

- \`GET|POST|PATCH|DELETE /api/v1/modules/spaces/spaces\` — manage spaces
- \`GET|POST|DELETE /api/v1/modules/spaces/spaces/:id/devices\` — attach / detach devices
- \`GET|POST|DELETE /api/v1/modules/spaces/spaces/:id/displays\` — attach / detach displays
- \`GET|POST|PATCH|DELETE /api/v1/modules/spaces/spaces/:id/roles\` — manage role bindings inside a space`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}

export default SpacesModule;
