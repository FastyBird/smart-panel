import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DisplaysModule } from '../displays/displays.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { DataSourceController } from './controllers/data-source.controller';
import { PagesController } from './controllers/pages.controller';
import { TilesController } from './controllers/tiles.controller';
import {
	DASHBOARD_MODULE_API_TAG_DESCRIPTION,
	DASHBOARD_MODULE_API_TAG_NAME,
	DASHBOARD_MODULE_NAME,
} from './dashboard.constants';
import { DASHBOARD_SWAGGER_EXTRA_MODELS } from './dashboard.openapi';
import { UpdateDashboardConfigDto } from './dto/update-config.dto';
import { DataSourceEntity, PageEntity, TileEntity } from './entities/dashboard.entity';
import { DashboardConfigModel } from './models/config.model';
import { DashboardStatsProvider } from './providers/dashboard-stats.provider';
import { DashboardSeederService } from './services/dashboard-seeder.service';
import { DataSourceCreateBuilderRegistryService } from './services/data-source-create-builder-registry.service';
import { DataSourceRelationsLoaderRegistryService } from './services/data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from './services/data-source-type-mapper.service';
import { DataSourcesService } from './services/data-sources.service';
import { ModuleResetService } from './services/module-reset.service';
import { PageCreateBuilderRegistryService } from './services/page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from './services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from './services/pages-type-mapper.service';
import { PagesService } from './services/pages.service';
import { TileCreateBuilderRegistryService } from './services/tile-create-builder-registry.service';
import { TileRelationsLoaderRegistryService } from './services/tile-relations-loader-registry.service';
import { TilesTypeMapperService } from './services/tiles-type-mapper.service';
import { TilesService } from './services/tiles.service';
import { DataSourceTypeConstraintValidator } from './validators/data-source-type-constraint.validator';
import { TileTypeConstraintValidator } from './validators/tile-type-constraint.validator';

@ApiTag({
	tagName: DASHBOARD_MODULE_NAME,
	displayName: DASHBOARD_MODULE_API_TAG_NAME,
	description: DASHBOARD_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([PageEntity, TileEntity, DataSourceEntity]),
		SeedModule,
		StatsModule,
		SwaggerModule,
		DisplaysModule,
	],
	providers: [
		PagesService,
		TilesService,
		DataSourcesService,
		PagesTypeMapperService,
		TilesTypeMapperService,
		TileTypeConstraintValidator,
		DataSourcesTypeMapperService,
		DataSourceTypeConstraintValidator,
		DashboardSeederService,
		PageRelationsLoaderRegistryService,
		TileRelationsLoaderRegistryService,
		DataSourceRelationsLoaderRegistryService,
		PageCreateBuilderRegistryService,
		TileCreateBuilderRegistryService,
		DataSourceCreateBuilderRegistryService,
		ModuleResetService,
		DashboardStatsProvider,
	],
	controllers: [PagesController, TilesController, DataSourceController],
	exports: [
		PagesService,
		TilesService,
		DataSourcesService,
		PagesTypeMapperService,
		TilesTypeMapperService,
		DataSourcesTypeMapperService,
		DashboardSeederService,
		PageRelationsLoaderRegistryService,
		TileRelationsLoaderRegistryService,
		DataSourceRelationsLoaderRegistryService,
		PageCreateBuilderRegistryService,
		TileCreateBuilderRegistryService,
		DataSourceCreateBuilderRegistryService,
	],
})
export class DashboardModule implements OnModuleInit {
	constructor(
		private readonly moduleSeeder: DashboardSeederService,
		private readonly moduleReset: ModuleResetService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly statsRegistryService: StatsRegistryService,
		private readonly dashboardStatsProvider: DashboardStatsProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.seedRegistry.register(
			DASHBOARD_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			200,
		);

		this.factoryResetRegistry.register(
			DASHBOARD_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			100,
		);

		this.statsRegistryService.register(DASHBOARD_MODULE_NAME, this.dashboardStatsProvider);

		for (const model of DASHBOARD_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register module config mapping
		this.modulesMapperService.registerMapping<DashboardConfigModel, UpdateDashboardConfigDto>({
			type: DASHBOARD_MODULE_NAME,
			class: DashboardConfigModel,
			configDto: UpdateDashboardConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: DASHBOARD_MODULE_NAME,
			name: 'Dashboards',
			description: 'Dashboard pages and tiles management',
			author: 'FastyBird',
			readme: `# Dashboards

> Module · by FastyBird

Visual interface framework for the Smart Panel display. Organizes pages, tiles and data sources into a grid-based layout that the Flutter panel renders and operates. This module owns the *what* of the UI; page and tile plugins decide *how* each piece looks and behaves.

## What it gives you

- A page tree that mirrors what the user sees on every panel — swipeable, lockable per space, and editable from the admin UI
- A grid of tiles per page, each tile owning its own type, configuration and data bindings
- Data sources that decouple a tile's visuals from its underlying value: the same time-tile can be driven by the system clock or a device property without code changes

## Features

- **Pages** — multiple dashboard pages per space, swipeable on the display, with per-page icon, title and ordering
- **Tiles** — interactive widgets registered by tile plugins (device controls, weather, time, scenes, info-cards, …); each tile type validates its own config
- **Data sources** — pluggable adapters that supply live values to tiles (e.g. device channel property, weather location, scene)
- **Grid layout** — flexible row × column positioning with size hints; the panel re-flows automatically for the configured screen
- **Plugin registry** — page types, tile types and data-source types are added by plugins; this module enforces correct DTOs and references at the API boundary
- **Cross-references checked** — tiles that point at devices / channels / properties / scenes are validated through the existence constraints exposed by other modules
- **Real-time sync** — every change is broadcast over WebSocket so the admin UI and the panel update without polling
- **Seeding & factory reset** — registers seed data and a reset handler so demo dashboards and full wipes work consistently with the rest of the system

## API Endpoints

- \`GET|POST|PATCH|DELETE /api/v1/modules/dashboard/pages\` — manage pages
- \`GET|POST|PATCH|DELETE /api/v1/modules/dashboard/tiles\` — manage tiles
- \`GET|POST|PATCH|DELETE /api/v1/modules/dashboard/data-sources\` — manage data sources
- \`GET /api/v1/modules/dashboard/pages/:id/tiles\` — fetch every tile that belongs to a page in one call`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
