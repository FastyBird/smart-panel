/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { useContainer } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { CreateSingleDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity, PageEntity, TileEntity } from '../entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourcesService } from '../services/data-sources.service';

import { DataSourceController } from './data-source.controller';

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

describe('DataSourceController', () => {
	let controller: DataSourceController;
	let dataSourceService: DataSourcesService;
	let mapper: DataSourcesTypeMapperService;

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

	const mockDataSource: MockDataSourceEntity = {
		id: uuid().toString(),
		type: 'mock',
		parentType: 'page',
		parentId: mockPage.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
	} as MockDataSourceEntity;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DataSourceController],
			providers: [
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourcesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(MockDataSourceEntity, mockDataSource)]),
						findOne: jest.fn().mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource)),
						create: jest.fn().mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource)),
						update: jest.fn().mockResolvedValue(toInstance(MockDataSourceEntity, mockDataSource)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<DataSourceController>(DataSourceController);
		dataSourceService = module.get<DataSourcesService>(DataSourcesService);
		mapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(dataSourceService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('DataSources', () => {
		it('should return all data sources', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(MockDataSourceEntity, mockDataSource)]);
			expect(dataSourceService.findAll).toHaveBeenCalled();
		});

		it('should return a single data source', async () => {
			const result = await controller.findOne(mockDataSource.id);

			expect(result.data).toEqual(toInstance(MockDataSourceEntity, mockDataSource));
			expect(dataSourceService.findOne).toHaveBeenCalledWith(mockDataSource.id);
		});

		it('should create a new data source', async () => {
			const createDto: CreateMockDataSourceDto = {
				type: 'mock',
				mockValue: 'New mock value',
				parent: { type: 'page', id: mockPage.id },
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDataSourceEntity,
				createDto: CreateMockDataSourceDto,
				updateDto: UpdateMockDataSourceDto,
			});

			const mockRequest = {
				url: '/api/v1/dashboard/data-source',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(MockDataSourceEntity, mockDataSource));
			expect(dataSourceService.create).toHaveBeenCalledWith(createDto, { parentType: 'page', parentId: mockPage.id });
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/${DASHBOARD_MODULE_PREFIX}/data-source/${mockDataSource.id}`),
			);
		});

		it('should update a data source', async () => {
			const updateDto: UpdateMockDataSourceDto = {
				type: 'mock',
				mockValue: 'Updated mock value',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDataSourceEntity,
				createDto: CreateMockDataSourceDto,
				updateDto: UpdateMockDataSourceDto,
			});

			const result = await controller.update(mockDataSource.id, { data: updateDto });

			expect(result.data).toEqual(toInstance(MockDataSourceEntity, mockDataSource));
			expect(dataSourceService.update).toHaveBeenCalledWith(mockDataSource.id, updateDto);
		});

		it('should delete a data source', async () => {
			const result = await controller.remove(mockDataSource.id);

			expect(result).toBeUndefined();
			expect(dataSourceService.remove).toHaveBeenCalledWith(mockDataSource.id);
		});
	});
});
