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

import { CreateHouseModesPageDto } from './dto/create-page.dto';
import { UpdateHouseModesPageDto } from './dto/update-page.dto';
import { HouseModesPageEntity } from './entities/pages-house-modes.entity';
import { PAGES_HOUSE_MODES_PLUGIN_NAME, PAGES_HOUSE_MODES_TYPE } from './pages-house-modes.constants';
import { PAGES_HOUSE_MODES_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-house-modes.openapi';
import { HouseModesPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([HouseModesPageEntity]), DashboardModule, ExtensionsModule, SwaggerModule],
	providers: [PageRelationsLoaderService, HouseModesPageNestedBuilderService],
})
export class PagesHouseModesPlugin {
	constructor(
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly houseModesPageNestedBuilderService: HouseModesPageNestedBuilderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.pagesMapper.registerMapping<HouseModesPageEntity, CreateHouseModesPageDto, UpdateHouseModesPageDto>({
			type: PAGES_HOUSE_MODES_TYPE,
			class: HouseModesPageEntity,
			createDto: CreateHouseModesPageDto,
			updateDto: UpdateHouseModesPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		this.pageCreateBuilderRegistryService.register(this.houseModesPageNestedBuilderService);

		for (const model of PAGES_HOUSE_MODES_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_MODES_TYPE,
			modelClass: HouseModesPageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_MODES_TYPE,
			modelClass: CreateHouseModesPageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_HOUSE_MODES_TYPE,
			modelClass: UpdateHouseModesPageDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: PAGES_HOUSE_MODES_PLUGIN_NAME,
			name: 'House Modes Page',
			description: 'Dashboard page type for quick house mode switching (Home/Away/Night)',
			author: 'FastyBird',
			readme: `# House Modes Page Plugin

Dashboard page type for quick house mode switching.

## Features

- **Quick Mode Selection** - Large buttons for Home/Away/Night modes
- **Active Mode Indicator** - Visual indication of current house mode
- **Entry Panel View** - Designed for displays with 'entry' role
- **Confirmation Dialog** - Optional confirmation when switching to Away mode

## Usage

1. Create a new house modes page
2. Configure confirmation settings
3. Assign to entry displays

## House Modes

- **Home** - Normal operation, all devices active
- **Away** - Leaving house, turns off all lights
- **Night** - Night mode, applies night lighting`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
