import { useContainer } from 'class-validator';
import { DataSource as OrmDataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { UpdateDataSourceDto } from '../../../modules/dashboard/dto/update-data-source.dto';
import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../../../modules/dashboard/services/data-source-type-mapper.service';
import { TilesTypeMapperService } from '../../../modules/dashboard/services/tiles-type-mapper.service';
import { DataSourceTypeConstraintValidator } from '../../../modules/dashboard/validators/data-source-type-constraint.validator';
import { TileTypeConstraintValidator } from '../../../modules/dashboard/validators/tile-type-constraint.validator';
import { CreateCardsPageDto } from '../dto/create-page.dto';
import { CardEntity, CardsPageEntity } from '../entities/pages-cards.entity';
import { PagesCardsValidationException } from '../pages-cards.exceptions';

import { CardsPageNestedBuilderService } from './page-create-nested-builder.service';

describe('CardsPageNestedBuilderService', () => {
	let service: CardsPageNestedBuilderService;
	let tileMapperService: TilesTypeMapperService;
	let dataSourceMapperService: DataSourcesTypeMapperService;
	let ormDataSource: OrmDataSource;

	beforeEach(async () => {
		const tileRepository = {
			create: jest.fn().mockImplementation((x): TileEntity => x),
		};

		const dataSourceRepository = {
			create: jest.fn().mockImplementation((x): DataSourceEntity => x),
		};

		const cardRepository = {
			create: jest.fn().mockImplementation((x): CardEntity => x),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CardsPageNestedBuilderService,
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn().mockReturnValue({
							class: TileEntity,
							createDto: CreateTileDto,
							updateDto: UpdateTileDto,
						}),
					},
				},
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn().mockReturnValue({
							class: DataSourceEntity,
							createDto: CreateDataSourceDto,
							updateDto: UpdateDataSourceDto,
						}),
					},
				},
				{
					provide: OrmDataSource,
					useValue: {
						getRepository: jest.fn((cls) => {
							if (cls === CardEntity) return cardRepository;
							if (cls === TileEntity) return tileRepository;
							if (cls === DataSourceEntity) return dataSourceRepository;
							return null;
						}),
					},
				},
				TileTypeConstraintValidator,
				DataSourceTypeConstraintValidator,
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get(CardsPageNestedBuilderService);
		tileMapperService = module.get(TilesTypeMapperService);
		dataSourceMapperService = module.get(DataSourcesTypeMapperService);
		ormDataSource = module.get(OrmDataSource);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(tileMapperService).toBeDefined();
		expect(dataSourceMapperService).toBeDefined();
		expect(ormDataSource).toBeDefined();
	});

	it('should support "cards" page type', () => {
		const result = service.supports({ type: 'cards' } as CardsPageEntity);
		expect(result).toBe(true);
	});

	it('should not support other page types', () => {
		const result = service.supports({ type: 'tiles' } as PageEntity);
		expect(result).toBe(false);
	});

	it('should build cards with tiles and data sources', async () => {
		const page = new CardsPageEntity();
		page.id = uuid().toString();

		const dto = {
			type: 'cards',
			title: 'Test Page',
			order: 1,
			cards: [
				{
					title: 'Card 1',
					order: 1,
					tiles: [
						{
							type: 'mock',
							row: 1,
							col: 1,
							row_span: 2,
							col_span: 2,
							hidden: false,
							data_source: [
								{
									type: 'mock',
								},
							],
						},
					],
					data_source: [
						{
							type: 'mock',
						},
					],
				},
			],
		};

		await service.build(dto as CreateCardsPageDto, page);

		expect(page.cards).toHaveLength(1);
		expect(page.cards[0].tiles).toHaveLength(1);
		expect(page.cards[0].tiles[0].dataSource).toHaveLength(1);
		expect(page.cards[0].dataSource).toHaveLength(1);
	});

	it('should throw validation error if DTO is invalid', async () => {
		await expect(service['validateDto'](class {}, {})).rejects.toThrow(PagesCardsValidationException);
	});
});
