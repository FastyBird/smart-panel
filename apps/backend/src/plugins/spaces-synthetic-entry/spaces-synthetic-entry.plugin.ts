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

import { CreateEntrySpaceDto } from './dto/create-entry-space.dto';
import { SpacesSyntheticEntryUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateEntrySpaceDto } from './dto/update-entry-space.dto';
import { EntrySpaceEntity } from './entities/entry-space.entity';
import { SpacesSyntheticEntryConfigModel } from './models/config.model';
import {
	SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_DESCRIPTION,
	SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_NAME,
	SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	SPACES_SYNTHETIC_ENTRY_TYPE,
} from './spaces-synthetic-entry.constants';
import { SPACES_SYNTHETIC_ENTRY_PLUGIN_SWAGGER_EXTRA_MODELS } from './spaces-synthetic-entry.openapi';

/**
 * Spaces Synthetic Entry plugin.
 *
 * Contributes the singleton `entry` space type — a security / front-door
 * surface with no physical-room semantics. The entry space row is owned by
 * the user: it is created/edited/removed through the standard spaces API and
 * is never auto-seeded by this plugin.
 */
@ApiTag({
	tagName: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	displayName: SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_NAME,
	description: SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([EntrySpaceEntity]), SpacesModule, SwaggerModule],
	providers: [],
	controllers: [],
	exports: [],
})
export class SpacesSyntheticEntryPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit(): void {
		this.configMapper.registerMapping<SpacesSyntheticEntryConfigModel, SpacesSyntheticEntryUpdatePluginConfigDto>({
			type: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
			class: SpacesSyntheticEntryConfigModel,
			configDto: SpacesSyntheticEntryUpdatePluginConfigDto,
		});

		this.spacesTypeMapper.registerMapping<EntrySpaceEntity, CreateEntrySpaceDto, UpdateEntrySpaceDto>({
			type: SPACES_SYNTHETIC_ENTRY_TYPE,
			class: EntrySpaceEntity,
			createDto: CreateEntrySpaceDto,
			updateDto: UpdateEntrySpaceDto,
			singleton: true,
		});

		for (const model of SPACES_SYNTHETIC_ENTRY_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: SpaceEntity,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_ENTRY_TYPE,
			modelClass: EntrySpaceEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_ENTRY_TYPE,
			modelClass: CreateEntrySpaceDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdateSpaceDto,
			discriminatorProperty: 'type',
			discriminatorValue: SPACES_SYNTHETIC_ENTRY_TYPE,
			modelClass: UpdateEntrySpaceDto,
		});

		this.extensionsService.registerPluginMetadata({
			type: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
			name: 'Spaces Synthetic Entry',
			description: 'Contributes the singleton Entry synthetic space for security / front-door surfaces.',
			author: 'FastyBird',
			readme: `# Spaces Synthetic Entry Plugin

Contributes the **Entry** space type — a singleton synthetic space that represents
the security / front-door surface. Unlike Room and Zone spaces, the entry space has
no physical-room semantics and no parent/child hierarchy.

## Features

- **Singleton** — at most one entry space per installation. The singleton guard in the
  spaces service rejects attempts to create a second one.
- **User-owned** — the row is created, edited, and removed through the standard spaces
  API. This plugin does not seed or restore the entry space automatically.
- **Display target** — displays configured for security / entry surfaces point at this space.

## Uninstall behavior

Uninstalling this plugin leaves the entry row orphaned in the spaces table;
displays pointing at it will no longer resolve to a rendered view until the
plugin is reinstalled.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
