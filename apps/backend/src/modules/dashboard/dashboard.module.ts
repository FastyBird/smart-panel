import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { DataSourceController } from './controllers/data-source.controller';
import { PagesController } from './controllers/pages.controller';
import { TilesController } from './controllers/tiles.controller';
import { DASHBOARD_MODULE_NAME } from './dashboard.constants';
import { DataSourceEntity, PageEntity, TileEntity } from './entities/dashboard.entity';
import { DashboardSeederService } from './services/dashboard-seeder.service';
import { DataSourceCreateBuilderRegistryService } from './services/data-source-create-builder-registry.service';
import { DataSourceRelationsLoaderRegistryService } from './services/data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from './services/data-source-type-mapper.service';
import { DataSourceService } from './services/data-source.service';
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

@Module({
	imports: [
		NestConfigModule,
		TypeOrmModule.forFeature([PageEntity, TileEntity, DataSourceEntity]),
		SeedModule,
		SystemModule,
	],
	providers: [
		PagesService,
		TilesService,
		DataSourceService,
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
	],
	controllers: [PagesController, TilesController, DataSourceController],
	exports: [
		PagesService,
		TilesService,
		DataSourceService,
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
export class DashboardModule {
	constructor(
		private readonly moduleSeeder: DashboardSeederService,
		private readonly moduleReset: ModuleResetService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		this.seedRegistry.register(
			DASHBOARD_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			100,
		);

		this.factoryResetRegistry.register(
			DASHBOARD_MODULE_NAME,
			100,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
		);
	}
}
