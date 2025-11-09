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
import { useContainer } from 'class-validator';
import { EntityManager, DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType } from '../dashboard.constants';
import { DashboardException } from '../dashboard.exceptions';
import { CreateSingleDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';

import { DataSourceCreateBuilderRegistryService } from './data-source-create-builder-registry.service';
import { DataSourceRelationsLoaderRegistryService } from './data-source-relations-loader-registry.service';
import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';

class CreateMockDataSourceDto extends CreateSingleDataSourceDto {
	@Expose({ name: 'mock_value' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockDataSourceDto extends UpdateDataSourceDto {
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

class MockDataSourceEntity extends DataSourceEntity {
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

describe('DataSourcesService', () => {
	let dataSourceService: DataSourcesService;
	let repository: Repository<DataSourceEntity>;
	let mapper: DataSourcesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: OrmDataSource;

	const mockPage: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Tiles detail',
		order: 0,
		showTopBar: false,
		display: uuid().toString(),
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
		tiles: [],
		dataSource: [],
	};

	const mockDataSource: MockDataSourceEntity = {
		id: uuid().toString(),
		type: 'mock',
		parentType: 'page',
		parentId: mockPage.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
	} as MockDataSourceEntity;

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
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
				DataSourcesService,
				{ provide: getRepositoryToken(DataSourceEntity), useFactory: mockRepository },
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourceRelationsLoaderRegistryService,
					useValue: {
						getLoaders: jest.fn().mockReturnValue([]),
					},
				},
				{
					provide: DataSourceCreateBuilderRegistryService,
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
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
						getRepository: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		dataSourceService = module.get<DataSourcesService>(DataSourcesService);
		repository = module.get<Repository<DataSourceEntity>>(getRepositoryToken(DataSourceEntity));
		mapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<OrmDataSource>(OrmDataSource);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(dataSourceService).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all data sources', async () => {
			const mockDataSources: DataSourceEntity[] = [mockDataSource];

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockDataSources.map((entity) => toInstance(MockDataSourceEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findAll({ parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(mockDataSources.map((entity) => toInstance(MockDataSourceEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.parentType = :parentType', {
				parentType: 'page',
			});
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentId = :parentId', {
				parentId: mockPage.id,
			});
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a data source by ID', async () => {
			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findOne(mockDataSource.id, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(toInstance(MockDataSourceEntity, mockDataSource));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', { id: mockDataSource.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentType = :parentType', {
				parentType: 'page',
			});
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentId = :parentId', {
				parentId: mockPage.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if page not found', async () => {
			const dataSourceId = uuid().toString();

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await dataSourceService.findOne(dataSourceId, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('dataSource');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', { id: dataSourceId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentType = :parentType', {
				parentType: 'page',
			});
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentId = :parentId', {
				parentId: mockPage.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new data source', async () => {
			const createDto: CreateMockDataSourceDto = {
				type: 'mock',
				mockValue: 'New mock value',
				parent: { type: 'page', id: mockPage.id },
			};
			const mockCrateDataSource: Partial<MockDataSourceEntity> = {
				type: createDto.type,
				parentType: createDto.parent.type,
				parentId: createDto.parent.id,
				mockValue: createDto.mockValue,
			};
			const mockCratedDataSource: MockDataSourceEntity = {
				id: uuid().toString(),
				type: mockCrateDataSource.type,
				parentType: mockCrateDataSource.parentType,
				parentId: mockCrateDataSource.parentId,
				createdAt: new Date(),
				updatedAt: null,
				validateOwnership: (): void => {},
				parent: { type: 'page', id: mockPage.id },
				mockValue: mockCrateDataSource.mockValue,
			};

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(toInstance(MockDataSourceEntity, mockCratedDataSource)),
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDataSourceEntity,
				createDto: CreateMockDataSourceDto,
				updateDto: UpdateMockDataSourceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(toInstance(MockDataSourceEntity, mockCratedDataSource));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDataSourceEntity, mockCratedDataSource));

			const result = await dataSourceService.create(createDto, { parentType: 'page', parentId: mockPage.id });

			expect(result).toEqual(toInstance(MockDataSourceEntity, mockCratedDataSource));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockDataSourceEntity, mockCrateDataSource));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockDataSourceEntity, mockCratedDataSource));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DATA_SOURCE_CREATED,
				toInstance(MockDataSourceEntity, mockCratedDataSource),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', { id: mockCratedDataSource.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentType = :parentType', {
				parentType: 'page',
			});
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('dataSource.parentId = :parentId', {
				parentId: mockPage.id,
			});
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateMockDataSourceDto> = {};

			await expect(
				dataSourceService.create(createDto as CreateMockDataSourceDto, { parentType: 'page', parentId: mockPage.id }),
			).rejects.toThrow(DashboardException);
		});
	});

	describe('update', () => {
		it('should update a data source', async () => {
			const updateDto: UpdateMockDataSourceDto = {
				type: 'mock',
				mockValue: 'Updated mock value',
			};
			const mockUpdateDataSource: MockDataSourceEntity = {
				id: mockDataSource.id,
				type: mockDataSource.type,
				parentType: mockDataSource.parentType,
				parentId: mockDataSource.parentId,
				createdAt: mockDataSource.createdAt,
				updatedAt: mockDataSource.updatedAt,
				validateOwnership: (): void => {},
				parent: mockDataSource.parent,
				mockValue: updateDto.mockValue,
			};
			const mockUpdatedDataSource: MockDataSourceEntity = {
				id: mockUpdateDataSource.id,
				type: mockUpdateDataSource.type,
				parentType: mockUpdateDataSource.parentType,
				parentId: mockUpdateDataSource.parentId,
				createdAt: mockUpdateDataSource.createdAt,
				updatedAt: mockUpdateDataSource.updatedAt,
				validateOwnership: (): void => {},
				parent: mockUpdateDataSource.parent,
				mockValue: mockUpdateDataSource.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDataSourceEntity,
				createDto: CreateMockDataSourceDto,
				updateDto: UpdateMockDataSourceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockDataSourceEntity, mockDataSource))
					.mockResolvedValueOnce(toInstance(MockDataSourceEntity, mockUpdatedDataSource)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDataSourceEntity, mockUpdatedDataSource));

			const result = await dataSourceService.update(mockDataSource.id, updateDto);

			expect(result).toEqual(toInstance(MockDataSourceEntity, mockUpdatedDataSource));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockDataSourceEntity, mockUpdatedDataSource));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DATA_SOURCE_UPDATED,
				toInstance(MockDataSourceEntity, mockUpdatedDataSource),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('dataSource.id = :id', { id: mockDataSource.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a data source', async () => {
			jest.spyOn(dataSourceService, 'findOne').mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource));
			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource));

			jest.spyOn(mockManager, 'remove');

			await dataSourceService.remove(mockDataSource.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockDataSourceEntity, mockDataSource));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DATA_SOURCE_DELETED,
				toInstance(MockDataSourceEntity, mockDataSource),
			);
		});
	});
});
