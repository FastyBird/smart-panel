import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DisplaysModule } from '../displays/displays.module';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { StatsRegistryService } from '../stats/services/stats-registry.service';
import { StatsModule } from '../stats/stats.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

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
		ConfigModule,
		ExtensionsModule,
		SeedModule,
		SystemModule,
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
			name: 'Dashboard',
			description: 'Dashboard pages and tiles management',
			author: 'FastyBird',
			links: {
				documentation: 'https://docs.fastybird.com',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
