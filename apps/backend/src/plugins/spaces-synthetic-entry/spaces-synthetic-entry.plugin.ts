import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { FactoryResetRegistryService } from '../../modules/system/services/factory-reset-registry.service';

import { CreateEntrySpaceDto } from './dto/create-entry-space.dto';
import { UpdateEntrySpaceDto } from './dto/update-entry-space.dto';
import { EntrySpaceEntity } from './entities/entry-space.entity';
import { EntrySpaceResetService } from './services/entry-space-reset.service';
import { EntrySpaceSeederService } from './services/entry-space-seeder.service';
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
 * surface with no physical-room semantics. One entry space is seeded on
 * first boot; subsequent boots short-circuit. The core spaces module's
 * factory reset clears the row, and this plugin's reset handler (priority
 * 300, after core's 280) re-seeds it.
 */
@ApiTag({
	tagName: SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
	displayName: SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_NAME,
	description: SPACES_SYNTHETIC_ENTRY_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([EntrySpaceEntity]), SpacesModule, SwaggerModule],
	providers: [EntrySpaceSeederService, EntrySpaceResetService],
	controllers: [],
	exports: [EntrySpaceSeederService],
})
export class SpacesSyntheticEntryPlugin implements OnModuleInit {
	constructor(
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly seeder: EntrySpaceSeederService,
		private readonly resetService: EntrySpaceResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	async onModuleInit(): Promise<void> {
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

		this.factoryResetRegistry.register(
			SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.resetService.reset();
			},
			300,
		);

		// Skip DB-touching seed when the app is booted solely to host a CLI command
		// (e.g. `openapi:generate`, where migrations may not have run and the spaces
		// table may not exist). In normal app boot FB_CLI is unset.
		if (process.env.FB_CLI !== 'on') {
			await this.seeder.seed();
		}

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

- **Singleton** — exactly one entry space per installation, seeded on first boot.
- **Display target** — displays configured for security / entry surfaces point at this space.
- **Factory-reset safe** — re-seeded automatically after the core spaces module reset.

## Defaults

- ID: \`a0000000-0000-4000-8000-000000000002\`
- Name: \`Entry\` (user-editable)
- No category, no parent, no children.

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
