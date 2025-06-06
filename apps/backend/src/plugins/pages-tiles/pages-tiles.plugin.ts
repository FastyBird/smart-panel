import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardModule } from '../../modules/dashboard/dashboard.module';
import { PageCreateBuilderRegistryService } from '../../modules/dashboard/services/page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from '../../modules/dashboard/services/page-relations-loader-registry.service';
import { PagesTypeMapperService } from '../../modules/dashboard/services/pages-type-mapper.service';

import { CreateTilesPageDto } from './dto/create-page.dto';
import { UpdateTilesPageDto } from './dto/update-page.dto';
import { TilesPageEntity } from './entities/pages-tiles.entity';
import { TilesPageNestedBuilderService } from './services/page-create-nested-builder.service';
import { PageRelationsLoaderService } from './services/page-relations-loader.service';

@Module({
	imports: [TypeOrmModule.forFeature([TilesPageEntity]), DashboardModule],
	providers: [PageRelationsLoaderService, TilesPageNestedBuilderService, TilesPageNestedBuilderService],
})
export class PagesTilesPlugin {
	constructor(
		private readonly mapper: PagesTypeMapperService,
		private readonly pageRelationsLoaderRegistryService: PageRelationsLoaderRegistryService,
		private readonly pageRelationsLoaderService: PageRelationsLoaderService,
		private readonly pageCreateBuilderRegistryService: PageCreateBuilderRegistryService,
		private readonly tilesPageNestedBuilderService: TilesPageNestedBuilderService,
	) {}

	onModuleInit() {
		this.mapper.registerMapping<TilesPageEntity, CreateTilesPageDto, UpdateTilesPageDto>({
			type: 'tiles',
			class: TilesPageEntity,
			createDto: CreateTilesPageDto,
			updateDto: UpdateTilesPageDto,
		});

		this.pageRelationsLoaderRegistryService.register(this.pageRelationsLoaderService);

		this.pageCreateBuilderRegistryService.register(this.tilesPageNestedBuilderService);
	}
}
