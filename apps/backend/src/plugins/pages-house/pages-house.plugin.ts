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
import { ExtendedDiscriminatorService } from '../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { CreateHousePageDto } from './dto/create-page.dto';
import { UpdateHousePageDto } from './dto/update-page.dto';
import { HousePageEntity } from './entities/pages-house.entity';
import { PAGES_HOUSE_PLUGIN_NAME, PAGES_HOUSE_TYPE } from './pages-house.constants';
import { PAGES_HOUSE_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-house.openapi';
import { HousePageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([HousePageEntity]), DashboardModule, ExtensionsModule, SwaggerModule],
	providers: [PageRelationsLoaderService, HousePageNestedBuilderService],
})
export class PagesHousePlugin {
	constructor(
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly housePageNestedBuilderService: HousePageNestedBuilderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.pagesMapper.registerMapping<HousePageEntity, CreateHousePageDto, UpdateHousePageDto>({
			type: PAGES_HOUSE_TYPE,
			class: HousePageEntity,
			createDto: CreateHousePageDto,
			updateDto: UpdateHousePageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		this.pageCreateBuilderRegistryService.register(this.housePageNestedBuilderService);

		for (const model of PAGES_HOUSE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_TYPE,
			modelClass: HousePageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_TYPE,
			modelClass: CreateHousePageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_TYPE,
			modelClass: UpdateHousePageDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: PAGES_HOUSE_PLUGIN_NAME,
			name: 'House Page',
			description: 'Dashboard page type for displaying a whole-house overview',
			author: 'FastyBird',
			readme: `# House Page Plugin

Dashboard page type for displaying a whole-house overview.

## Features

- **House Overview** - Displays all spaces/rooms in a single view
- **Weather Display** - Optional weather information widget
- **Master Panel View** - Designed for displays with 'master' role
- **Quick Navigation** - Jump to any room from the overview

## Usage

1. Create a new house page
2. Configure view mode (simple or detailed)
3. Toggle weather display option
4. Assign to master displays

## View Modes

- **Simple** - Clean overview with room status summaries
- **Detailed** - Expanded view with more device information`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
