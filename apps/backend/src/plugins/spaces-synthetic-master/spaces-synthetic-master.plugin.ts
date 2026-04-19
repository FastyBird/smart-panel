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

import { CreateMasterSpaceDto } from './dto/create-master-space.dto';
import { UpdateMasterSpaceDto } from './dto/update-master-space.dto';
import { MasterSpaceEntity } from './entities/master-space.entity';
import { MasterSpaceResetService } from './services/master-space-reset.service';
import { MasterSpaceSeederService } from './services/master-space-seeder.service';
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
 * surface with no physical-room semantics. One master space is seeded on
 * first boot; subsequent boots short-circuit. The core spaces module's
 * factory reset clears the row, and this plugin's reset handler (priority
 * 300, after core's 280) re-seeds it.
 */
@ApiTag({
	tagName: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
	displayName: SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_NAME,
	description: SPACES_SYNTHETIC_MASTER_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([MasterSpaceEntity]), SpacesModule, SwaggerModule],
	providers: [MasterSpaceSeederService, MasterSpaceResetService],
	controllers: [],
	exports: [MasterSpaceSeederService],
})
export class SpacesSyntheticMasterPlugin implements OnModuleInit {
	constructor(
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly seeder: MasterSpaceSeederService,
		private readonly resetService: MasterSpaceResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	async onModuleInit(): Promise<void> {
		this.spacesTypeMapper.registerMapping<MasterSpaceEntity, CreateMasterSpaceDto, UpdateMasterSpaceDto>({
			type: SPACES_SYNTHETIC_MASTER_TYPE,
			class: MasterSpaceEntity,
			createDto: CreateMasterSpaceDto,
			updateDto: UpdateMasterSpaceDto,
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

		this.factoryResetRegistry.register(
			SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
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
			type: SPACES_SYNTHETIC_MASTER_PLUGIN_NAME,
			name: 'Spaces Synthetic Master',
			description: 'Contributes the singleton Master synthetic space for whole-house overview surfaces.',
			author: 'FastyBird',
			readme: `# Spaces Synthetic Master Plugin

Contributes the **Master** space type — a singleton synthetic space that represents
the whole-house overview surface. Unlike Room and Zone spaces, the master space has
no physical-room semantics and no parent/child hierarchy.

## Features

- **Singleton** — exactly one master space per installation, seeded on first boot.
- **Display target** — displays configured for whole-house overview point at this space.
- **Factory-reset safe** — re-seeded automatically after the core spaces module reset.

## Defaults

- ID: \`a0000000-0000-4000-8000-000000000001\`
- Name: \`Home\` (user-editable)
- No category, no parent, no children.

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
