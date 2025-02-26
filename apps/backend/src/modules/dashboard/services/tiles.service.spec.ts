/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { EventType } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateTimeTileDto } from '../dto/create-tile.dto';
import { UpdateTimeTileDto } from '../dto/update-tile.dto';
import { DevicePageEntity, TileEntity, TilesPageEntity, TimeTileEntity } from '../entities/dashboard.entity';

import { CardsService } from './cards.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';
import { TilesService } from './tiles.service';

class MockDevice extends DeviceEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('TilesService', () => {
	let pagesService: PagesService;
	let tilesService: TilesService;
	let repository: Repository<TileEntity>;
	let tilesMapper: TilesTypeMapperService;
	let dataSourceMapper: DataSourcesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: OrmDataSource;

	const mockDevice: MockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		mockValue: 'Some value',
	};

	const mockDevicePage: DevicePageEntity = {
		id: uuid().toString(),
		type: 'device',
		title: 'Device detail',
		order: 0,
		device: mockDevice.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTilesPage: TilesPageEntity = {
		id: uuid().toString(),
		type: 'tiles',
		title: 'Tiles detail',
		order: 0,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockTimeTile: TimeTileEntity = {
		id: uuid().toString(),
		type: 'clock',
		page: mockDevicePage.id,
		card: null,
		dataSource: [],
		row: 0,
		col: 0,
		rowSpan: 0,
		colSpan: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TilesService,
				{ provide: getRepositoryToken(TileEntity), useFactory: mockRepository },
				{
					provide: PagesService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: CardsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
					},
				},
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: OrmDataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		pagesService = module.get<PagesService>(PagesService);
		tilesService = module.get<TilesService>(TilesService);
		repository = module.get<Repository<TileEntity>>(getRepositoryToken(TileEntity));
		tilesMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);
		dataSourceMapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<OrmDataSource>(OrmDataSource);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(pagesService).toBeDefined();
		expect(tilesService).toBeDefined();
		expect(repository).toBeDefined();
		expect(tilesMapper).toBeDefined();
		expect(dataSourceMapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all tiles with relations', async () => {
			const mockTiles: TileEntity[] = [mockTimeTile];

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockTiles.map((entity) => plainToInstance(TilesPageEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findAll({ pageId: mockTilesPage.id });

			expect(result).toEqual(mockTiles.map((entity) => plainToInstance(TilesPageEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('tile.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.dataSource', 'dataSource');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockTilesPage.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a tile by ID', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(TimeTileEntity, mockTimeTile)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findOne(mockTimeTile.id, { pageId: mockTilesPage.id });

			expect(result).toEqual(plainToInstance(TimeTileEntity, mockTimeTile));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('tile.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.dataSource', 'dataSource');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: mockTimeTile.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockTilesPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if page not found', async () => {
			const tileId = uuid().toString();

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findOne(tileId, { pageId: mockTilesPage.id });

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('tile.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.dataSource', 'dataSource');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: tileId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockTilesPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new tile', async () => {
			const createDto: CreateTimeTileDto = { type: 'clock', row: 0, col: 1 };
			const mockCrateTile: Partial<TimeTileEntity> = {
				type: createDto.type,
				row: createDto.row,
				col: createDto.col,
				page: mockTilesPage.id,
				dataSource: [],
			};
			const mockCratedTile: TimeTileEntity = {
				id: uuid().toString(),
				type: mockCrateTile.type,
				row: mockCrateTile.row,
				col: mockCrateTile.col,
				page: mockTilesPage.id,
				card: null,
				dataSource: [],
				createdAt: new Date(),
				updatedAt: null,
				validateOwnership: (): void => {},
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(plainToInstance(TimeTileEntity, mockCratedTile)),
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			jest.spyOn(tilesMapper, 'getMapping').mockReturnValue({
				type: 'clock',
				class: TimeTileEntity,
				createDto: CreateTimeTileDto,
				updateDto: UpdateTimeTileDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedTile);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedTile);

			const result = await tilesService.create(createDto, { pageId: mockTilesPage.id });

			expect(result).toEqual(plainToInstance(TimeTileEntity, mockCratedTile));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(TimeTileEntity, mockCrateTile, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedTile);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.TILE_CREATED,
				plainToInstance(TimeTileEntity, mockCratedTile),
			);
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('tile.page', 'page');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.dataSource', 'dataSource');
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('tile.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: mockCratedTile.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('page.id = :pageId', { pageId: mockTilesPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateTimeTileDto> = {
				row: 1,
				col: 2,
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			await expect(tilesService.create(createDto as CreateTimeTileDto, { pageId: mockTilesPage.id })).rejects.toThrow(
				DashboardException,
			);
		});
	});

	describe('update', () => {
		it('should update a tile', async () => {
			const updateDto: UpdateTimeTileDto = {
				type: 'clock',
				row: 10,
				col: 10,
			};
			const mockUpdateTile: TimeTileEntity = {
				id: mockTimeTile.id,
				type: mockTimeTile.type,
				row: updateDto.row,
				col: updateDto.col,
				page: mockTimeTile.page,
				card: null,
				dataSource: mockTimeTile.dataSource,
				createdAt: mockTimeTile.createdAt,
				updatedAt: mockTimeTile.updatedAt,
				validateOwnership: (): void => {},
			};
			const mockUpdatedTile: TimeTileEntity = {
				id: mockUpdateTile.id,
				type: mockUpdateTile.type,
				row: mockUpdateTile.row,
				col: mockUpdateTile.col,
				rowSpan: mockTimeTile.rowSpan,
				colSpan: mockTimeTile.colSpan,
				page: mockUpdateTile.page,
				card: null,
				dataSource: mockUpdateTile.dataSource,
				createdAt: mockUpdateTile.createdAt,
				updatedAt: mockUpdateTile.updatedAt,
				validateOwnership: (): void => {},
			};

			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));

			jest.spyOn(tilesMapper, 'getMapping').mockReturnValue({
				type: 'clock',
				class: TimeTileEntity,
				createDto: CreateTimeTileDto,
				updateDto: UpdateTimeTileDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(TimeTileEntity, mockTimeTile))
				.mockResolvedValueOnce(plainToInstance(TimeTileEntity, mockUpdatedTile));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedTile);

			const result = await tilesService.update(mockTimeTile.id, updateDto);

			expect(result).toEqual(plainToInstance(TimeTileEntity, mockUpdatedTile));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(TimeTileEntity, mockUpdatedTile));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.TILE_UPDATED,
				plainToInstance(TimeTileEntity, mockUpdatedTile),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockTimeTile.id },
				relations: ['page', 'card', 'dataSource', 'dataSource.tile', 'device'],
			});
		});
	});

	describe('remove', () => {
		it('should remove a tile', async () => {
			jest.spyOn(pagesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(TilesPageEntity, mockTilesPage));
			jest.spyOn(tilesService, 'findOne').mockResolvedValue(plainToInstance(TimeTileEntity, mockTimeTile));

			jest.spyOn(repository, 'remove').mockResolvedValue(mockTimeTile);

			await tilesService.remove(mockTimeTile.id);

			expect(repository.remove).toHaveBeenCalledWith(plainToInstance(TimeTileEntity, mockTimeTile));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.TILE_DELETED,
				plainToInstance(TimeTileEntity, mockTimeTile),
			);
		});
	});
});
