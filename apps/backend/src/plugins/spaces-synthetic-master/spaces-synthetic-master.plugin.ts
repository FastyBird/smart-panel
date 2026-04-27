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
			readme: `# Master Space

> Plugin · by FastyBird · platform: spaces

Contributes the singleton **Master** synthetic space — a whole-house overview surface with no physical-room semantics and no parent / child hierarchy. Displays configured for the overall view of the home are bound to this space.

## What you get

- A natural anchor for "the home" itself when a panel needs a top-level overview that isn't tied to any specific room
- Cleanly separates "this is the whole house" from regular rooms / zones, so the panel can render a different layout without special-casing
- Plays nicely with the rest of the spaces module: the same APIs, validations and home-page resolution apply

## Features

- **Singleton** — only one master space per installation; the spaces service rejects attempts to create a second one
- **User-owned** — created, edited and removed through the standard spaces API (this plugin never auto-seeds it)
- **Display target** — used as the binding for whole-house overview displays
- **Same plumbing as rooms / zones** — dashboards, scenes and Buddy treat the master space exactly like any other space, just with a different shape`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
