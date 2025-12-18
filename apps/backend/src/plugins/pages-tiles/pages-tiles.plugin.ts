import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
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

import { CreateTilesPageDto } from './dto/create-page.dto';
import { TilesUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateTilesPageDto } from './dto/update-page.dto';
import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesConfigModel } from './models/config.model';
import { PAGES_TILES_PLUGIN_NAME, PAGES_TILES_TYPE } from './pages-tiles.constants';
import { PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS } from './pages-tiles.openapi';
import { TilesPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([TilesPageEntity]),
		DashboardModule,
		ConfigModule,
		ExtensionsModule,
		SwaggerModule,
	],
	providers: [PageRelationsLoaderService, TilesPageNestedBuilderService, TilesPageNestedBuilderService],
})
export class PagesTilesPlugin {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly pagesMapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly tilesPageNestedBuilderService: TilesPageNestedBuilderService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly discriminatorRegistry: ExtendedDiscriminatorService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<TilesConfigModel, TilesUpdatePluginConfigDto>({
			type: PAGES_TILES_PLUGIN_NAME,
			class: TilesConfigModel,
			configDto: TilesUpdatePluginConfigDto,
		});

		this.pagesMapper.registerMapping<TilesPageEntity, CreateTilesPageDto, UpdateTilesPageDto>({
			type: PAGES_TILES_TYPE,
			class: TilesPageEntity,
			createDto: CreateTilesPageDto,
			updateDto: UpdateTilesPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		this.pageCreateBuilderRegistryService.register(this.tilesPageNestedBuilderService);

		for (const model of PAGES_TILES_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.discriminatorRegistry.register({
			parentClass: PageEntity,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_TILES_TYPE,
			modelClass: TilesPageEntity,
		});

		this.discriminatorRegistry.register({
			parentClass: CreatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_TILES_TYPE,
			modelClass: CreateTilesPageDto,
		});

		this.discriminatorRegistry.register({
			parentClass: UpdatePageDto,
			discriminatorProperty: 'type',
			discriminatorValue: PAGES_TILES_TYPE,
			modelClass: UpdateTilesPageDto,
		});

		// Register extension metadata
		this.extensionsService.registerPluginMetadata({
			type: PAGES_TILES_PLUGIN_NAME,
			name: 'Tiles Page',
			description: 'Dashboard page type for displaying tiles with widgets',
			author: 'FastyBird',
			readme: `# Tiles Page Plugin

Dashboard page type for displaying a grid of configurable tiles.

## Features

- **Grid Layout** - Arrange tiles in a flexible grid system
- **Multiple Tile Types** - Support for various tile plugins
- **Responsive Design** - Adapts to display size
- **Tile Data Sources** - Connect tiles to live data

## Page Layout

Tiles pages display widgets in a grid:
- Configurable grid dimensions
- Tiles can span multiple cells
- Automatic layout optimization

## Supported Tiles

Works with any registered tile type:
- Time tiles
- Weather tiles
- Device preview tiles
- Custom tile plugins

## Usage

1. Create a new tiles page
2. Configure grid size
3. Add tiles and position them
4. Connect data sources to tiles
5. Save and view on the panel display`,
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
