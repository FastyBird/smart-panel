/*
eslint-disable @typescript-eslint/unbound-method,
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException } from '../dashboard.exceptions';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourceService } from './data-source.service';
import { PageCreateBuilderRegistryService } from './page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from './page-relations-loader-registry.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';
import { PagesService } from './pages.service';

class CreateMockPageDto extends CreatePageDto {
	@Expose()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockPageDto extends UpdatePageDto {
	@Expose()
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
	get type(): string {
		return 'mock';
	}
}

describe('PagesService', () => {
	let service: PagesService;
	let repository: Repository<PageEntity>;
	let mapper: PagesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: OrmDataSource;

	const mockPageOne: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Mock page one',
		order: 0,
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
	};

	const mockPageTwo: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Mock page two',
		order: 0,
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Other mock value',
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
				PagesService,
				{ provide: getRepositoryToken(PageEntity), useFactory: mockRepository },
				{
					provide: DataSourceService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: PagesTypeMapperService,
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
					provide: PageRelationsLoaderRegistryService,
					useValue: {
						getLoaders: jest.fn().mockReturnValue([]),
					},
				},
				{
					provide: PageCreateBuilderRegistryService,
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
					},
				},
			],
		}).compile();

		service = module.get<PagesService>(PagesService);
		repository = module.get<Repository<PageEntity>>(getRepositoryToken(PageEntity));
		mapper = module.get<PagesTypeMapperService>(PagesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<OrmDataSource>(OrmDataSource);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all pages', async () => {
			const mockPages: PageEntity[] = [mockPageOne];

			jest
				.spyOn(repository, 'find')
				.mockResolvedValue(mockPages.map((entity) => plainToInstance(MockPageEntity, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockPages.map((entity) => plainToInstance(MockPageEntity, entity)));
			expect(repository.find).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a page by ID', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockPageEntity, mockPageOne));

			const result = await service.findOne(mockPageOne.id);

			expect(result).toEqual(plainToInstance(MockPageEntity, mockPageOne));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockPageOne.id },
			});
		});

		it('should return null if page not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne(id);

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should create and return a new page', async () => {
			const createDto: CreateMockPageDto = { type: 'tiles', title: 'New Page', order: 1, mockValue: 'New mock value' };
			const mockCratePage: Partial<MockPageEntity> = {
				type: createDto.type,
				title: createDto.title,
				icon: null,
				order: createDto.order,
				mockValue: createDto.mockValue,
			};
			const mockCratedPage: MockPageEntity = {
				id: uuid().toString(),
				type: mockCratePage.type,
				title: mockCratePage.title,
				icon: null,
				order: mockCratePage.order,
				createdAt: new Date(),
				dataSource: [],
				updatedAt: null,
				mockValue: mockCratePage.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: MockPageEntity,
				createDto: CreateMockPageDto,
				updateDto: UpdateMockPageDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedPage);
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedPage);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockPageEntity, mockCratedPage));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(MockPageEntity, mockCratedPage));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(MockPageEntity, mockCratePage, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedPage);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCratedPage.id },
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_CREATED,
				plainToInstance(MockPageEntity, mockCratedPage),
			);
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateMockPageDto> = {
				title: 'New page',
			};

			await expect(service.create(createDto as CreateMockPageDto)).rejects.toThrow(DashboardException);
		});
	});

	describe('update', () => {
		it('should update a page', async () => {
			const updateDto: UpdateMockPageDto = {
				type: 'tiles',
				title: 'Updated title',
				mockValue: 'Updated mock value',
			};
			const mockUpdatePage: MockPageEntity = {
				id: mockPageTwo.id,
				type: mockPageTwo.type,
				title: updateDto.title,
				order: mockPageTwo.order,
				dataSource: mockPageTwo.dataSource,
				createdAt: mockPageTwo.createdAt,
				updatedAt: mockPageTwo.updatedAt,
				mockValue: updateDto.mockValue,
			};
			const mockUpdatedPage: MockPageEntity = {
				id: mockUpdatePage.id,
				type: mockUpdatePage.type,
				title: mockUpdatePage.title,
				order: mockUpdatePage.order,
				dataSource: mockUpdatePage.dataSource,
				createdAt: mockUpdatePage.createdAt,
				updatedAt: new Date(),
				mockValue: mockUpdatePage.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockPageEntity,
				createDto: CreateMockPageDto,
				updateDto: UpdateMockPageDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(MockPageEntity, mockPageTwo))
				.mockResolvedValueOnce(plainToInstance(MockPageEntity, mockUpdatedPage));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedPage);

			const result = await service.update(mockPageTwo.id, updateDto);

			expect(result).toEqual(plainToInstance(MockPageEntity, mockUpdatedPage));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(MockPageEntity, mockUpdatePage));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockPageTwo.id },
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_UPDATED,
				plainToInstance(MockPageEntity, mockUpdatedPage),
			);
		});
	});

	describe('remove', () => {
		it('should delete a page', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(MockPageEntity, mockPageOne));
			jest.spyOn(repository, 'delete');

			await service.remove(mockPageOne.id);

			expect(repository.delete).toHaveBeenCalledWith(mockPageOne.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_DELETED,
				plainToInstance(MockPageEntity, mockPageOne),
			);
		});

		it('should throw an exception if page is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DashboardNotFoundException('Page not found'));

			await expect(service.remove(id)).rejects.toThrow(DashboardNotFoundException);
		});
	});
});
