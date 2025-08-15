import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { DataSource as OrmDataSource } from 'typeorm/data-source/DataSource';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { DataSourceEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageNestedCreateBuilder } from '../../../modules/dashboard/entities/dashboard.relations';
import { DataSourcesTypeMapperService } from '../../../modules/dashboard/services/data-source-type-mapper.service';
import { TilesTypeMapperService } from '../../../modules/dashboard/services/tiles-type-mapper.service';
import { CreateCardDto } from '../dto/create-card.dto';
import { CreateCardsPageDto } from '../dto/create-page.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { PagesCardsValidationException } from '../pages-cards.exceptions';

@Injectable()
export class CardsPageNestedBuilderService implements IPageNestedCreateBuilder {
	private readonly logger = new Logger(CardsPageNestedBuilderService.name);

	constructor(
		private readonly tilesMapperService: TilesTypeMapperService,
		private readonly dataSourcesMapperService: DataSourcesTypeMapperService,
		private readonly dataSource: OrmDataSource,
	) {}

	supports(dto: CreatePageDto): boolean {
		return dto.type === 'cards';
	}

	async build(dto: CreateCardsPageDto, page: CardsPageEntity): Promise<void> {
		const dtoInstance = await this.validateDto<CreateCardsPageDto>(CreateCardsPageDto, dto);

		page['cards'] = (dtoInstance.cards || []).map((createCardDto: CreateCardDto) => {
			const cardRepository: Repository<CardEntity> = this.dataSource.getRepository(CardEntity);

			const card = cardRepository.create(toInstance(CardEntity, { ...createCardDto, page: page.id }));

			card.tiles = (createCardDto.tiles || []).map((createTileDto: CreateTileDto) => {
				const tileMapping = this.tilesMapperService.getMapping(createTileDto.type);

				const tileRepository: Repository<TileEntity> = this.dataSource.getRepository(tileMapping.class);

				const tile = tileRepository.create(
					toInstance(tileMapping.class, { ...createTileDto, parentType: 'card', parentId: card.id }),
				);

				tile.dataSource = (createTileDto.data_source ?? []).map((createDataSourceDto: CreateDataSourceDto) => {
					const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

					const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
						dataSourceMapping.class,
					);

					return dataSourceRepository.create(
						toInstance(dataSourceMapping.class, { ...createDataSourceDto, parentType: 'tile', parentId: tile.id }),
					);
				});

				return tile;
			});

			card.dataSource = (createCardDto.data_source ?? []).map((createDataSourceDto: CreateDataSourceDto) => {
				const dataSourceMapping = this.dataSourcesMapperService.getMapping(createDataSourceDto.type);

				const dataSourceRepository: Repository<DataSourceEntity> = this.dataSource.getRepository(
					dataSourceMapping.class,
				);

				return dataSourceRepository.create(
					toInstance(dataSourceMapping.class, { ...createDataSourceDto, parentType: 'card', parentId: card.id }),
				);
			});

			return card;
		});
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION FAILED] ${JSON.stringify(errors)}`);

			throw new PagesCardsValidationException('Provided card data are invalid.');
		}

		return dtoInstance;
	}
}
