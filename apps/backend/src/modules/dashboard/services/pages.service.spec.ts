/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment
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
import { DashboardException, DashboardNotFoundException } from '../dashboard.exceptions';
import { CreateDevicePageDto, CreateTilesPageDto } from '../dto/create-page.dto';
import { UpdateTilesPageDto } from '../dto/update-page.dto';
import { DevicePageEntity, PageEntity, TilesPageEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';
import { PagesTypeMapperService } from './pages-type-mapper.service';
import { PagesService } from './pages.service';
import { TilesTypeMapperService } from './tiles-type-mapper.service';

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

describe('PagesService', () => {
	let service: PagesService;
	let repository: Repository<PageEntity>;
	let mapper: PagesTypeMapperService;
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
				PagesService,
				{ provide: getRepositoryToken(PageEntity), useFactory: mockRepository },
				{
					provide: PagesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
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
		it('should return all pages with relations', async () => {
			const mockPages: PageEntity[] = [mockDevicePage];

			jest
				.spyOn(repository, 'find')
				.mockResolvedValue(mockPages.map((entity) => plainToInstance(DevicePageEntity, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockPages.map((entity) => plainToInstance(DevicePageEntity, entity)));
			expect(repository.find).toHaveBeenCalledWith({
				relations: expect.arrayContaining([
					'tiles',
					'tiles.page',
					'tiles.dataSource',
					'tiles.dataSource.tile',
					'tiles.device',
					'device',
				]),
			});
		});
	});

	describe('findOne', () => {
		it('should return a page by ID', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(DevicePageEntity, mockDevicePage));

			const result = await service.findOne(mockDevicePage.id);

			expect(result).toEqual(plainToInstance(DevicePageEntity, mockDevicePage));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockDevicePage.id },
				relations: expect.arrayContaining([
					'tiles',
					'tiles.page',
					'tiles.dataSource',
					'tiles.dataSource.tile',
					'tiles.device',
					'device',
				]),
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
			const createDto: CreateTilesPageDto = { type: 'tiles', title: 'New Page', order: 1 };
			const mockCratePage: Partial<TilesPageEntity> = {
				type: createDto.type,
				title: createDto.title,
				icon: null,
				order: createDto.order,
			};
			const mockCratedPage: TilesPageEntity = {
				id: uuid().toString(),
				type: mockCratePage.type,
				title: mockCratePage.title,
				icon: null,
				order: mockCratePage.order,
				tiles: [],
				dataSource: [],
				createdAt: new Date(),
				updatedAt: null,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: TilesPageEntity,
				createDto: CreateTilesPageDto,
				updateDto: UpdateTilesPageDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedPage);
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedPage);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(TilesPageEntity, mockCratedPage));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(TilesPageEntity, mockCratedPage));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(TilesPageEntity, mockCratePage, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedPage);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCratedPage.id },
				relations: [
					'cards',
					'cards.page',
					'cards.tiles',
					'cards.tiles.card',
					'cards.tiles.dataSource',
					'cards.tiles.dataSource.tile',
					'cards.tiles.dataSource.device',
					'cards.tiles.dataSource.channel',
					'cards.tiles.dataSource.property',
					'cards.dataSource',
					'cards.dataSource.card',
					'cards.dataSource.device',
					'cards.dataSource.channel',
					'cards.dataSource.property',
					'tiles',
					'tiles.page',
					'tiles.dataSource',
					'tiles.dataSource.tile',
					'tiles.dataSource.device',
					'tiles.dataSource.channel',
					'tiles.dataSource.property',
					'tiles.device',
					'device',
					'dataSource',
					'dataSource.page',
					'dataSource.device',
					'dataSource.channel',
					'dataSource.property',
				],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_CREATED,
				plainToInstance(TilesPageEntity, mockCratedPage),
			);
		});

		it('should throw validation exception for invalid data', async () => {
			const createDto: Partial<CreateDevicePageDto> = {
				title: 'New page',
			};

			await expect(service.create(createDto as CreateDevicePageDto)).rejects.toThrow(DashboardException);
		});
	});

	describe('update', () => {
		it('should update a page', async () => {
			const updateDto: UpdateTilesPageDto = {
				type: 'tiles',
				title: 'Updated title',
			};
			const mockUpdatePage: TilesPageEntity = {
				id: mockTilesPage.id,
				type: mockTilesPage.type,
				title: updateDto.title,
				order: mockTilesPage.order,
				tiles: [],
				dataSource: [],
				createdAt: mockTilesPage.createdAt,
				updatedAt: mockTilesPage.updatedAt,
			};
			const mockUpdatedPage: TilesPageEntity = {
				id: mockUpdatePage.id,
				type: mockUpdatePage.type,
				title: mockUpdatePage.title,
				order: mockUpdatePage.order,
				tiles: [],
				dataSource: [],
				createdAt: mockUpdatePage.createdAt,
				updatedAt: new Date(),
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: TilesPageEntity,
				createDto: CreateTilesPageDto,
				updateDto: UpdateTilesPageDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(TilesPageEntity, mockTilesPage))
				.mockResolvedValueOnce(plainToInstance(TilesPageEntity, mockUpdatedPage));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedPage);

			const result = await service.update(mockTilesPage.id, updateDto);

			expect(result).toEqual(plainToInstance(TilesPageEntity, mockUpdatedPage));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(TilesPageEntity, mockUpdatePage));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockTilesPage.id },
				relations: [
					'cards',
					'cards.page',
					'cards.tiles',
					'cards.tiles.card',
					'cards.tiles.dataSource',
					'cards.tiles.dataSource.tile',
					'cards.tiles.dataSource.device',
					'cards.tiles.dataSource.channel',
					'cards.tiles.dataSource.property',
					'cards.dataSource',
					'cards.dataSource.card',
					'cards.dataSource.device',
					'cards.dataSource.channel',
					'cards.dataSource.property',
					'tiles',
					'tiles.page',
					'tiles.dataSource',
					'tiles.dataSource.tile',
					'tiles.dataSource.device',
					'tiles.dataSource.channel',
					'tiles.dataSource.property',
					'tiles.device',
					'device',
					'dataSource',
					'dataSource.page',
					'dataSource.device',
					'dataSource.channel',
					'dataSource.property',
				],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_UPDATED,
				plainToInstance(TilesPageEntity, mockUpdatedPage),
			);
		});
	});

	describe('remove', () => {
		it('should delete a page', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(DevicePageEntity, mockDevicePage));
			jest.spyOn(repository, 'remove').mockResolvedValue(mockDevicePage);

			await service.remove(mockDevicePage.id);

			expect(repository.remove).toHaveBeenCalledWith(plainToInstance(MockDevice, mockDevicePage));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.PAGE_DELETED,
				plainToInstance(MockDevice, mockDevicePage),
			);
		});

		it('should throw an exception if page is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DashboardNotFoundException('Page not found'));

			await expect(service.remove(id)).rejects.toThrow(DashboardNotFoundException);
		});
	});
});
