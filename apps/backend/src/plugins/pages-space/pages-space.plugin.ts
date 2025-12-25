import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { CreatePageDto } from '../../modules/dashboard/dto/create-page.dto';
import { UpdatePageDto } from '../../modules/dashboard/dto/update-page.dto';
import { PageEntity } from '../../modules/dashboard/entities/dashboard.entity';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { SpacesModule } from '../../modules/spaces/spaces.module';
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateSpacePageDto } from './dto/create-page.dto';
import { UpdateSpacePageDto } from './dto/update-page.dto';
import { SpacePageEntity } from './entities/pages-space.entity';
import { PAGES_SPACE_PLUGIN_NAME, PAGES_SPACE_TYPE } from './pages-space.constants';
import { PAGES_SPACE_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-space.openapi';
import { SpacePageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([SpacePageEntity]),
		DashboardModule,
		SpacesModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [PageRelationsLoaderService, SpacePageNestedBuilderService],
})
export class PagesSpacePlugin {
	constructor(
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly spacePageNestedBuilderService: SpacePageNestedBuilderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.pagesMapper.registerMapping<SpacePageEntity, CreateSpacePageDto, UpdateSpacePageDto>({
			type: PAGES_SPACE_TYPE,
			class: SpacePageEntity,
			createDto: CreateSpacePageDto,
			updateDto: UpdateSpacePageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		this.pageCreateBuilderRegistryService.register(this.spacePageNestedBuilderService);

		for (const model of PAGES_SPACE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_SPACE_TYPE,
			modelClass: SpacePageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_SPACE_TYPE,
			modelClass: CreateSpacePageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_SPACE_TYPE,
			modelClass: UpdateSpacePageDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: PAGES_SPACE_PLUGIN_NAME,
			name: 'Space Page',
			description: 'Dashboard page type for displaying a room-centric space view',
			author: 'FastyBird',
			readme: `# Space Page Plugin

Dashboard page type for displaying a space (room/zone) overview.

## Features

- **Room-centric View** - Displays all devices assigned to a space
- **Automatic Grouping** - Devices grouped by type (lights, climate, etc.)
- **Intent Controls** - Quick actions for common operations
- **Minimal Configuration** - Just select a space

## Usage

1. Create a new space page
2. Select the target space (room/zone)
3. Choose view mode (simple or advanced)
4. Save and view on the panel display

## View Modes

- **Simple** - Clean overview with key controls
- **Advanced** - Detailed view with all device properties`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
