import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { DataSource as OrmDataSource } from 'typeorm/data-source/DataSource';

import { Injectable, Logger } from '@nestjs/common';

import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { DataSourceEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageNestedCreateBuilder } from '../../../modules/dashboard/entities/dashboard.relations';
import { DataSourcesTypeMapperService } from '../../../modules/dashboard/services/data-source-type-mapper.service';
import { TilesTypeMapperService } from '../../../modules/dashboard/services/tiles-type-mapper.service';
import { CreateTilesPageDto } from '../dto/create-page.dto';
import { TilesPageEntity } from '../entities/pages-tiles.entity';
import { PagesTilesValidationException } from '../pages-tiles.exceptions';

@Injectable()
export class TilesPageNestedBuilderService implements IPageNestedCreateBuilder {
	private readonly logger = new Logger(TilesPageNestedBuilderService.name);

	constructor(
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
	) {}

	supports(dto: CreatePageDto): boolean {
		return dto.type === 'tiles';
	}

	async build(dto: CreateTilesPageDto, page: TilesPageEntity): Promise<void> {
		const dtoInstance = await this.validateDto<CreateTilesPageDto>(CreateTilesPageDto, dto);

		page.tiles = (dtoInstance.tiles || []).map((createTileDto: CreateTileDto) => {
			const tileMapping = this.tilesMapperService.getMapping(createTileDto.type);

			const tileRepository: Repository<TileEntity> = this.dataSource.getRepository(tileMapping.class);

			const tile = tileRepository.create(
				plainToInstance(
					tileMapping.class,
					{ ...createTileDto, parentType: 'page', parentId: page.id },
					{
						enableImplicitConversion: true,
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
					},
				),
			);

			tile.dataSource = (createTileDto.data_source ?? []).map((createDataSourceDto: CreateDataSourceDto) => {
				const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

				const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
					dataSourceMapping.class,
				);

				return dataSourceRepository.create(
					plainToInstance(
						dataSourceMapping.class,
						{ ...createDataSourceDto, parentType: 'tile', parentId: tile.id },
						{
							enableImplicitConversion: true,
							excludeExtraneousValues: true,
							exposeUnsetFields: false,
						},
					),
				);
			});

			return tile;
		});
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = plainToInstance(DtoClass, dto, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new PagesTilesValidationException('Provided card data are invalid.');
		}

		return dtoInstance;
	}
}
