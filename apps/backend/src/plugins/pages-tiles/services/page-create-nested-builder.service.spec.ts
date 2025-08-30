import { useContainer } from 'class-validator';
import { DataSource as OrmDataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CreateDataSourceDto } from '../../../modules/dashboard/dto/create-data-source.dto';
import { CreatePageDto } from '../../../modules/dashboard/dto/create-page.dto';
import { CreateTileDto } from '../../../modules/dashboard/dto/create-tile.dto';
import { UpdateDataSourceDto } from '../../../modules/dashboard/dto/update-data-source.dto';
import { UpdateTileDto } from '../../../modules/dashboard/dto/update-tile.dto';
import { DataSourceEntity, TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../../../modules/dashboard/services/data-source-type-mapper.service';
import { TilesTypeMapperService } from '../../../modules/dashboard/services/tiles-type-mapper.service';
import { DataSourceTypeConstraintValidator } from '../../../modules/dashboard/validators/data-source-type-constraint.validator';
import { TileTypeConstraintValidator } from '../../../modules/dashboard/validators/tile-type-constraint.validator';
import { CreateTilesPageDto } from '../dto/create-page.dto';
import { TilesPageEntity } from '../entities/pages-tiles.entity';
import { PAGES_TILES_TYPE } from '../pages-tiles.constants';
import { PagesTilesValidationException } from '../pages-tiles.exceptions';

import { TilesPageNestedBuilderService } from './page-create-nested-builder.service';

describe('TilesPageNestedBuilderService', () => {
	let service: TilesPageNestedBuilderService;
	let tileMapperService: TilesTypeMapperService;
	let dataSourceMapperService: DataSourcesTypeMapperService;
	let ormDataSource: OrmDataSource;

	beforeEach(async () => {
		const tileRepo = {
			create: jest.fn().mockImplementation((x): TileEntity => x),
		};

		const dataSourceRepo = {
			create: jest.fn().mockImplementation((x): DataSourceEntity => x),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TilesPageNestedBuilderService,
				{
					provide: TilesTypeMapperService,
					useValue: {
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
							if (cls === TileEntity) return tileRepo;
							if (cls === DataSourceEntity) return dataSourceRepo;
							throw new Error('Unknown repository class');
						}),
					},
				},
				TileTypeConstraintValidator,
				DataSourceTypeConstraintValidator,
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get(TilesPageNestedBuilderService);
		tileMapperService = module.get(TilesTypeMapperService);
		dataSourceMapperService = module.get(DataSourcesTypeMapperService);
		ormDataSource = module.get(OrmDataSource);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(tileMapperService).toBeDefined();
		expect(dataSourceMapperService).toBeDefined();
		expect(ormDataSource).toBeDefined();
	});

	it('should support "tiles" page type', () => {
		expect(service.supports({ type: PAGES_TILES_TYPE } as CreateTilesPageDto)).toBe(true);
	});

	it('should not support other page types', () => {
		expect(service.supports({ type: 'unknown' } as CreatePageDto)).toBe(false);
	});

	it('should build tiles with data sources', async () => {
		const page = new TilesPageEntity();
		page.id = uuid();

		const dto = {
			type: PAGES_TILES_TYPE,
			title: 'Test Page',
			order: 1,
			tiles: [
				{
					type: 'mock',
					row: 1,
					col: 1,
					row_span: 2,
					col_span: 2,
					data_source: [
						{
							type: 'mock',
						},
					],
				},
			],
		};

		await service.build(dto as CreateTilesPageDto, page);

		expect(page.tiles).toHaveLength(1);
		expect(page.tiles[0].dataSource).toHaveLength(1);
	});

	it('should throw validation error for invalid DTO', async () => {
		await expect(service['validateDto'](class {}, {})).rejects.toThrow(PagesTilesValidationException);
	});
});
