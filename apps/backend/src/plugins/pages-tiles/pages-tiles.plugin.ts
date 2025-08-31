import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';

import { CreateTilesPageDto } from './dto/create-page.dto';
import { TilesUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateTilesPageDto } from './dto/update-page.dto';
import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesConfigModel } from './models/config.model';
import { PAGES_TILES_PLUGIN_NAME, PAGES_TILES_TYPE } from './pages-tiles.constants';
import { TilesPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([TilesPageEntity]), DashboardModule, ConfigModule],
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
	}
}
