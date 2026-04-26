import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { CreateSpaceDto } from '../../modules/spaces/dto/create-space.dto';
import { UpdateSpaceDto } from '../../modules/spaces/dto/update-space.dto';
import { SpaceEntity } from '../../modules/spaces/entities/space.entity';
import { SpacesTypeMapperService } from '../../modules/spaces/services/spaces-type-mapper.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateMasterSpaceDto } from './dto/create-master-space.dto';
import { SpacesSyntheticMasterUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateMasterSpaceDto } from './dto/update-master-space.dto';
import { MasterSpaceEntity } from './entities/master-space.entity';
import { SpacesSyntheticMasterConfigModel } from './models/config.model';
import {
	SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_DESCRIPTION,
	SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_NAME,
	SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	SPACES_SYNTHETIC_MASTER_TYPE,
} from './spaces-synthetic-master.constants';
import { SPACES_SYNTHETIC_MASTER_PLUGIN_SWAGGER_EXTRA_MODELS } from './spaces-synthetic-master.openapi';

/**
 * Spaces Synthetic Master plugin.
 *
 * Contributes the singleton `master` space type — a whole-house overview
 * surface with no physical-room semantics. The master space row is owned by
 * the user: it is created/edited/removed through the standard spaces API and
 * is never auto-seeded by this plugin.
 */
@ApiTag({
	tagName: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	displayName: SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_NAME,
	description: SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([MasterSpaceEntity]), SpacesModule, SwaggerModule],
	providers: [],
	controllers: [],
	exports: [],
})
export class SpacesSyntheticMasterPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		this.configMapper.registerMapping<SpacesSyntheticMasterConfigModel, SpacesSyntheticMasterUpdatePluginConfigDto>({
			type: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
			class: SpacesSyntheticMasterConfigModel,
			configDto: SpacesSyntheticMasterUpdatePluginConfigDto,
		});

		this.spacesTypeMapper.registerMapping<MasterSpaceEntity, CreateMasterSpaceDto, UpdateMasterSpaceDto>({
			type: SPACES_SYNTHETIC_MASTER_TYPE,
			class: MasterSpaceEntity,
			createDto: CreateMasterSpaceDto,
			updateDto: UpdateMasterSpaceDto,
			singleton: true,
		});

		for (const model of SPACES_SYNTHETIC_MASTER_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: SpaceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_MASTER_TYPE,
			modelClass: MasterSpaceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_MASTER_TYPE,
			modelClass: CreateMasterSpaceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_MASTER_TYPE,
			modelClass: UpdateMasterSpaceDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
			name: 'Spaces Synthetic Master',
			description: 'Contributes the singleton Master synthetic space for whole-house overview surfaces.',
			author: 'FastyBird',
			readme: `# Spaces Synthetic Master Plugin

Contributes the **Master** space type — a singleton synthetic space that represents
the whole-house overview surface. Unlike Room and Zone spaces, the master space has
no physical-room semantics and no parent/child hierarchy.

## Features

- **Singleton** — at most one master space per installation. The singleton guard in the
  spaces service rejects attempts to create a second one.
- **User-owned** — the row is created, edited, and removed through the standard spaces
  API. This plugin does not seed or restore the master space automatically.
- **Display target** — displays configured for whole-house overview point at this space.

## Uninstall behavior

Uninstalling this plugin leaves the master row orphaned in the spaces table;
displays pointing at it will no longer resolve to a rendered view until the
plugin is reinstalled.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
