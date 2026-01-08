import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { ChannelEntity, DeviceEntity } from '../devices/entities/devices.entity';
import { DisplayEntity } from '../displays/entities/displays.entity';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';

import { SpacesController } from './controllers/spaces.controller';
import { UpdateSpacesConfigDto } from './dto/update-config.dto';
import { SpaceClimateRoleEntity } from './entities/space-climate-role.entity';
import { SpaceLightingRoleEntity } from './entities/space-lighting-role.entity';
import { SpaceEntity } from './entities/space.entity';
import { SpaceActivityListener } from './listeners/space-activity.listener';
import { SpacesConfigModel } from './models/config.model';
import { SpaceClimateRoleService } from './services/space-climate-role.service';
import { SpaceContextSnapshotService } from './services/space-context-snapshot.service';
import { SpaceIntentService } from './services/space-intent.service';
import { SpaceLightingRoleService } from './services/space-lighting-role.service';
import { SpaceSuggestionService } from './services/space-suggestion.service';
import { SpaceUndoHistoryService } from './services/space-undo-history.service';
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
			SpaceLightingRoleEntity,
			SpaceClimateRoleEntity,
			DeviceEntity,
			ChannelEntity,
			DisplayEntity,
		]),
		forwardRef(() => DevicesModule),
		forwardRef(() => ExtensionsModule),
		forwardRef(() => ConfigModule),
	],
	controllers: [SpacesController],
	providers: [
		SpacesService,
		SpaceIntentService,
		SpaceLightingRoleService,
		SpaceClimateRoleService,
		SpaceSuggestionService,
		SpaceContextSnapshotService,
		SpaceUndoHistoryService,
		SpaceActivityListener,
	],
	exports: [
		SpacesService,
		SpaceIntentService,
		SpaceLightingRoleService,
		SpaceClimateRoleService,
		SpaceSuggestionService,
		SpaceContextSnapshotService,
		SpaceUndoHistoryService,
	],
})
export class SpacesModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
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
			readme: `# Spaces Module

The Spaces module provides a room-centric organization for your Smart Panel system.

## Features

- **Space Management** - Create, edit, and delete spaces (rooms/zones)
- **Device Assignment** - Assign devices to spaces for organized control
- **Display Assignment** - Link displays to specific spaces
- **Bulk Operations** - Assign multiple devices/displays at once

## Space Types

- **Room** - Physical rooms like Living Room, Bedroom, Kitchen
- **Zone** - Logical groupings like Downstairs, Outdoor, Entertainment Area

## Benefits

- Simplified device organization
- Room-centric control experience
- Foundation for Space Pages and intent-based controls`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
