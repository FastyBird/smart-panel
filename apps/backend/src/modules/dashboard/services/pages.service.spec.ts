/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, useContainer } from 'class-validator';
import { EntityManager, DataSource as OrmDataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { DisplaysService } from '../../displays/services/displays.service';
import { DisplayExistsConstraint } from '../../displays/validators/display-exists-constraint.validator';
import { EventType } from '../dashboard.constants';
import { DashboardException, DashboardNotFoundException } from '../dashboard.exceptions';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { DataSourcesService } from './data-sources.service';
import { PageCreateBuilderRegistryService } from './page-create-builder-registry.service';
import { PageRelationsLoaderRegistryService } from './page-relations-loader-registry.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';
import { PagesService } from './pages.service';

class CreateMockPageDto extends CreatePageDto {
	@Expose({ name: 'mock_value' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockPageDto extends UpdatePageDto {
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

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
		version: '1.0.0',
		build: 'test',
		screenWidth: 1280,
		screenHeight: 720,
		pixelRatio: 2,
		unitSize: 120,
		rows: 6,
		cols: 4,
		darkMode: false,
		brightness: 100,
		screenLockDuration: 30,
		screenSaver: true,
		audioOutputSupported: false,
		audioInputSupported: false,
		speaker: false,
		speakerVolume: 50,
		microphone: false,
		microphoneVolume: 50,
		createdAt: new Date(),
		updatedAt: undefined,
	};

	const mockPageOne: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Mock page one',
		order: 0,
		showTopBar: false,
		dataSource: [],
		display: mockDisplay.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
	};

	const mockPageTwo: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Mock page two',
		order: 0,
		showTopBar: false,
		dataSource: [],
		display: mockDisplay.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Other mock value',
	};

	const mockDisplaysService = {
		findAll: jest.fn().mockResolvedValue([toInstance(DisplayEntity, mockDisplay)]),
		findOne: jest.fn().mockResolvedValue(toInstance(DisplayEntity, mockDisplay)),
		findByMacAddress: jest.fn().mockResolvedValue(toInstance(DisplayEntity, mockDisplay)),
		findPrimary: jest.fn().mockResolvedValue(toInstance(DisplayEntity, mockDisplay)),
		getOneOrThrow: jest.fn().mockResolvedValue(toInstance(DisplayEntity, mockDisplay)),
	};

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
				PagesService,
				DisplayExistsConstraint,
				{ provide: getRepositoryToken(PageEntity), useFactory: mockRepository },
				{
					provide: DataSourcesService,
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
					provide: DisplaysService,
					useValue: mockDisplaysService,
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

		useContainer(module, { fallbackOnErrors: true });

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

	afterEach(() => {
		jest.clearAllMocks();
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

			jest.spyOn(repository, 'find').mockResolvedValue(mockPages.map((entity) => toInstance(MockPageEntity, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockPages.map((entity) => toInstance(MockPageEntity, entity)));
			expect(repository.find).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a page by ID', async () => {
			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockPageEntity, mockPageOne)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(mockPageOne.id);

			expect(result).toEqual(toInstance(MockPageEntity, mockPageOne));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('page.id = :id', { id: mockPageOne.id });
		});

		it('should return null if page not found', async () => {
			const id = uuid().toString();

			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(id);

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should create and return a new page', async () => {
			const createDto: CreateMockPageDto = {
				type: 'tiles',
				title: 'New Page',
				order: 1,
				mockValue: 'New mock value',
				show_top_bar: true,
			};
			const mockCratePage: Partial<MockPageEntity> = {
				type: createDto.type,
				title: createDto.title,
				order: createDto.order,
				showTopBar: createDto.show_top_bar,
				display: mockDisplay.id,
				mockValue: createDto.mockValue,
			};
			const mockCratedPage: MockPageEntity = {
				id: uuid().toString(),
				type: mockCratePage.type,
				title: mockCratePage.title,
				icon: null,
				order: mockCratePage.order,
				showTopBar: mockCratePage.showTopBar,
				display: mockCratePage.display,
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

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockPageEntity, mockCratedPage));
			jest.spyOn(repository, 'create').mockReturnValue(toInstance(MockPageEntity, mockCratedPage));

			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockPageEntity, mockCratedPage)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.create(createDto);

			expect(result).toEqual(toInstance(MockPageEntity, mockCratedPage));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockPageEntity, mockCratePage));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockPageEntity, mockCratedPage));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('page.id = :id', { id: mockCratedPage.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_CREATED,
				toInstance(MockPageEntity, mockCratedPage),
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
				showTopBar: mockPageTwo.showTopBar,
				dataSource: mockPageTwo.dataSource,
				display: mockDisplay.id,
				createdAt: mockPageTwo.createdAt,
				updatedAt: mockPageTwo.updatedAt,
				mockValue: updateDto.mockValue,
			};
			const mockUpdatedPage: MockPageEntity = {
				id: mockUpdatePage.id,
				type: mockUpdatePage.type,
				title: mockUpdatePage.title,
				order: mockUpdatePage.order,
				showTopBar: mockUpdatePage.showTopBar,
				dataSource: mockUpdatePage.dataSource,
				display: mockUpdatePage.display,
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

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockPageEntity, mockPageTwo))
					.mockResolvedValueOnce(toInstance(MockPageEntity, mockUpdatedPage)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockPageEntity, mockUpdatedPage));

			const result = await service.update(mockPageTwo.id, updateDto);

			expect(result).toEqual(toInstance(MockPageEntity, mockUpdatedPage));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockPageEntity, mockUpdatePage));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('page.id = :id', { id: mockPageTwo.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_UPDATED,
				toInstance(MockPageEntity, mockUpdatedPage),
			);
		});
	});

	describe('remove', () => {
		it('should delete a page', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(toInstance(MockPageEntity, mockPageOne));

			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(MockPageEntity, mockPageOne));
			jest.spyOn(mockManager, 'find').mockResolvedValue([]);

			jest.spyOn(mockManager, 'remove');

			await service.remove(mockPageOne.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockPageEntity, mockPageOne));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.PAGE_DELETED, toInstance(MockPageEntity, mockPageOne));
		});

		it('should throw an exception if page is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DashboardNotFoundException('Page not found'));

			await expect(service.remove(id)).rejects.toThrow(DashboardNotFoundException);
		});
	});
});
