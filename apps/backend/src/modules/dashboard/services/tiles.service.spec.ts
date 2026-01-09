/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { EntityManager, DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateSingleTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { PageEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';
import { TileCreateBuilderRegistryService } from './tile-create-builder-registry.service';
import { TileRelationsLoaderRegistryService } from './tile-relations-loader-registry.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';
import { TilesService } from './tiles.service';

class CreateMockTileDto extends CreateSingleTileDto {
	@Expose({ name: 'mock_value' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockTileDto extends UpdateTileDto {
	@Expose({ name: 'mock_value' })
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue?: string;
}

class MockPageEntity extends PageEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[];

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class MockTileEntity extends TileEntity {
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
	let tilesService: TilesService;
	let repository: Repository<TileEntity>;
	let tilesMapper: TilesTypeMapperService;
	let dataSourceMapper: DataSourcesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: OrmDataSource;

	const mockPage: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Tiles detail',
		order: 0,
		showTopBar: false,
		dataSource: [],
		displays: [],
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
		tiles: [],
	};

	const mockTile: MockTileEntity = {
		id: uuid().toString(),
		type: 'mock',
		parentType: 'page',
		parentId: mockPage.id,
		row: 1,
		col: 1,
		rowSpan: 1,
		colSpan: 1,
		hidden: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		dataSource: [],
		mockValue: 'Some mock value',
	} as MockTileEntity;

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		find: jest.fn(),
		remove: jest.fn(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
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
					provide: DataSourcesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([]),
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
					provide: TileRelationsLoaderRegistryService,
					useValue: {
						getLoaders: jest.fn().mockReturnValue([]),
					},
				},
				{
					provide: TileCreateBuilderRegistryService,
					useValue: {
						getBuilders: jest.fn().mockReturnValue([]),
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
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
					},
				},
			],
		}).compile();

		tilesService = module.get<TilesService>(TilesService);
		repository = module.get<Repository<TileEntity>>(getRepositoryToken(TileEntity));
		tilesMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);
		dataSourceMapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<OrmDataSource>(OrmDataSource);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(tilesService).toBeDefined();
		expect(repository).toBeDefined();
		expect(tilesMapper).toBeDefined();
		expect(dataSourceMapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all tiles', async () => {
			const mockTiles: TileEntity[] = [mockTile];

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockTiles.map((entity) => toInstance(MockTileEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findAll({ parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(mockTiles.map((entity) => toInstance(MockTileEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.parentType = :parentType', { parentType: 'page' });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.parentId = :parentId', { parentId: mockPage.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a tile by ID', async () => {
			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockTileEntity, mockTile)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findOne(mockTile.id, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(toInstance(MockTileEntity, mockTile));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: mockTile.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.parentType = :parentType', { parentType: 'page' });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.parentId = :parentId', { parentId: mockPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if page not found', async () => {
			const tileId = uuid().toString();

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await tilesService.findOne(tileId, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('tile');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: tileId });
			expect(queryBuilderMock.andWhere).toHaveBeenNthCalledWith(1, 'tile.parentType = :parentType', {
				parentType: 'page',
			});
			expect(queryBuilderMock.andWhere).toHaveBeenNthCalledWith(2, 'tile.parentId = :parentId', {
				parentId: mockPage.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new tile', async () => {
			const createDto: CreateMockTileDto = {
				type: 'mock',
				row: 1,
				col: 1,
				mockValue: 'New mock value',
				parent: { type: 'page', id: mockPage.id },
			};
			const mockCrateTile: Partial<MockTileEntity> = {
				type: createDto.type,
				row: createDto.row,
				col: createDto.col,
				parentType: createDto.parent.type,
				parentId: createDto.parent.id,
				mockValue: createDto.mockValue,
			};
			const mockCratedTile: MockTileEntity = {
				id: uuid().toString(),
				type: mockCrateTile.type,
				parentType: mockCrateTile.parentType,
				parentId: mockCrateTile.parentId,
				row: mockCrateTile.row,
				col: mockCrateTile.col,
				rowSpan: mockCrateTile.rowSpan,
				colSpan: mockCrateTile.colSpan,
				hidden: mockCrateTile.hidden,
				createdAt: new Date(),
				updatedAt: null,
				validateOwnership: (): void => {},
				dataSource: [],
				parent: { type: 'page', id: mockPage.id },
				mockValue: mockCrateTile.mockValue,
			};

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(toInstance(MockTileEntity, mockCratedTile)),
			};

			jest.spyOn(tilesMapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockTileEntity,
				createDto: CreateMockTileDto,
				updateDto: UpdateMockTileDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(toInstance(MockTileEntity, mockCratedTile));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockTileEntity, mockCratedTile));

			const result = await tilesService.create(createDto, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(toInstance(MockTileEntity, mockCratedTile));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockTileEntity, mockCrateTile));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockTileEntity, mockCratedTile));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.TILE_CREATED,
				toInstance(MockTileEntity, mockCratedTile),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: mockCratedTile.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.parentType = :parentType', { parentType: 'page' });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('tile.parentId = :parentId', { parentId: mockPage.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateMockTileDto> = {
				row: 1,
				col: 2,
			};

			await expect(
				tilesService.create(createDto as CreateMockTileDto, { parentType: 'page', parentId: mockPage.id }),
			).rejects.toThrow(DashboardException);
		});
	});

	describe('update', () => {
		it('should update a tile', async () => {
			const updateDto: UpdateMockTileDto = {
				type: 'mock',
				row: 10,
				col: 10,
				mockValue: 'Updated mock value',
			};
			const mockUpdateTile: MockTileEntity = {
				id: mockTile.id,
				type: mockTile.type,
				parentType: mockTile.parentType,
				parentId: mockTile.parentId,
				row: updateDto.row,
				col: updateDto.col,
				rowSpan: mockTile.rowSpan,
				colSpan: mockTile.colSpan,
				hidden: mockTile.hidden,
				createdAt: mockTile.createdAt,
				updatedAt: mockTile.updatedAt,
				validateOwnership: (): void => {},
				dataSource: mockTile.dataSource,
				parent: mockTile.parent,
				mockValue: updateDto.mockValue,
			};
			const mockUpdatedTile: MockTileEntity = {
				id: mockUpdateTile.id,
				type: mockUpdateTile.type,
				parentType: mockUpdateTile.parentType,
				parentId: mockUpdateTile.parentId,
				row: mockUpdateTile.row,
				col: mockUpdateTile.col,
				rowSpan: mockUpdateTile.rowSpan,
				colSpan: mockUpdateTile.colSpan,
				hidden: mockUpdateTile.hidden,
				createdAt: mockUpdateTile.createdAt,
				updatedAt: mockUpdateTile.updatedAt,
				validateOwnership: (): void => {},
				dataSource: mockUpdateTile.dataSource,
				parent: mockUpdateTile.parent,
				mockValue: mockUpdateTile.mockValue,
			};

			jest.spyOn(tilesMapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockTileEntity,
				createDto: CreateMockTileDto,
				updateDto: UpdateMockTileDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockTileEntity, mockTile))
					.mockResolvedValueOnce(toInstance(MockTileEntity, mockUpdatedTile)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockTileEntity, mockUpdatedTile));

			const result = await tilesService.update(mockTile.id, updateDto);

			expect(result).toEqual(toInstance(MockTileEntity, mockUpdatedTile));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockTileEntity, mockUpdatedTile));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.TILE_UPDATED,
				toInstance(MockTileEntity, mockUpdatedTile),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('tile.id = :id', { id: mockTile.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a tile', async () => {
			jest.spyOn(tilesService, 'findOne').mockResolvedValue(toInstance(MockTileEntity, mockTile));

			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(MockTileEntity, mockTile));
			jest.spyOn(mockManager, 'find').mockResolvedValue([]);

			jest.spyOn(mockManager, 'remove');

			await tilesService.remove(mockTile.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockTileEntity, mockTile));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.TILE_DELETED, toInstance(MockTileEntity, mockTile));
		});
	});
});
