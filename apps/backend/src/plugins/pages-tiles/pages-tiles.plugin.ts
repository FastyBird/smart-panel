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
			readme: `# Tiles Page

> Plugin · by FastyBird · platform: dashboard pages

Dashboard page type that lays out configurable tiles in a flexible grid. The default page used for "the main view of a room" or any custom layout — works with every registered tile plugin (clock, weather, device preview, scenes, …) and lets them mix freely on the same page.

## What you get

- A free-form, room-style canvas: drop a clock here, two switches there, a temperature graph beside them
- Variable tile sizes so big-impact tiles (a temperature gauge) can sit next to small ones (a quick switch)
- Live data everywhere — every tile reflects the underlying device / weather / scene state in real time
- Responsiveness by default — the same page renders on a phone-sized panel and a 10" panel without per-device tweaks

## Features

- **Grid layout** — configurable rows × columns; tiles can span multiple cells horizontally and vertically
- **Mixed tiles** — combine any registered tile plugins on the same page
- **Drag-and-drop editing** in the admin UI; positions and sizes are validated against the configured grid
- **Live data** — tiles bound to data-source plugins update automatically as values change
- **Empty-state hint** — a freshly created page guides the user into adding the first tile rather than showing a blank screen

Grid size and tile placement are configured per page — there is no global plugin configuration.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
