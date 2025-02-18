/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { CreateDeviceChannelDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDeviceChannelDataSourceDto } from '../dto/update-data-source.dto';
import { CardEntity, CardsPageEntity, DeviceChannelDataSourceEntity } from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourceService } from '../services/data-source.service';
import { PagesService } from '../services/pages.service';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from '../validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { PagesCardsDataSourceController } from './pages.cards.data-source.controller';

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

describe('PagesCardsDataSourceController', () => {
	let controller: PagesCardsDataSourceController;
	let pagesService: PagesService;
	let cardsService: CardsService;
	let dataSourceService: DataSourceService;
	let mapper: DataSourcesTypeMapperService;

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

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		category: ChannelCategory.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice.id,
		controls: [],
		properties: [],
	};

	const mockChannelProperty: ChannelPropertyEntity = {
		id: uuid().toString(),
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		permission: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: '°C',
		format: null,
		invalid: null,
		step: 0.5,
		value: '22.5',
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockCardsPage: CardsPageEntity = {
		id: uuid().toString(),
		type: 'cards',
		title: 'Cards detail',
		order: 0,
		cards: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockCard: CardEntity = {
		id: uuid().toString(),
		title: 'Card name',
		order: 0,
		icon: null,
		page: mockCardsPage.id,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockDeviceChannelDataSource: DeviceChannelDataSourceEntity = {
		id: uuid().toString(),
		type: 'device-channel',
		tile: mockCard.id,
		card: null,
		page: null,
		device: mockDevice.id,
		channel: mockChannel.id,
		property: mockChannelProperty.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PagesCardsDataSourceController],
			providers: [
				DeviceExistsConstraintValidator,
				DeviceChannelExistsConstraintValidator,
				ChannelPropertyExistsConstraintValidator,
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: PagesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockCardsPage]),
						findOne: jest.fn().mockResolvedValue(mockCardsPage),
						create: jest.fn().mockResolvedValue(mockCardsPage),
						update: jest.fn().mockResolvedValue(mockCardsPage),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: CardsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockCard]),
						findOne: jest.fn().mockResolvedValue(mockCard),
						create: jest.fn().mockResolvedValue(mockCard),
						update: jest.fn().mockResolvedValue(mockCard),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: DataSourceService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockDeviceChannelDataSource]),
						findOne: jest.fn().mockResolvedValue(mockDeviceChannelDataSource),
						create: jest.fn().mockResolvedValue(mockDeviceChannelDataSource),
						update: jest.fn().mockResolvedValue(mockDeviceChannelDataSource),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(mockDevice),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(mockChannel),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue(mockChannelProperty),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<PagesCardsDataSourceController>(PagesCardsDataSourceController);
		pagesService = module.get<PagesService>(PagesService);
		cardsService = module.get<CardsService>(CardsService);
		dataSourceService = module.get<DataSourceService>(DataSourceService);
		mapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(pagesService).toBeDefined();
		expect(cardsService).toBeDefined();
		expect(dataSourceService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('DataSources', () => {
		it('should return all data sources', async () => {
			const result = await controller.findAll(mockCardsPage.id, mockCard.id);

			expect(result).toEqual([mockDeviceChannelDataSource]);
			expect(dataSourceService.findAll).toHaveBeenCalledWith({ cardId: mockCard.id });
		});

		it('should return a single data source', async () => {
			const result = await controller.findOne(mockCardsPage.id, mockCard.id, mockDeviceChannelDataSource.id);

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.findOne).toHaveBeenCalledWith(mockDeviceChannelDataSource.id, {
				cardId: mockCard.id,
			});
		});

		it('should create a new data source', async () => {
			const createDto: CreateDeviceChannelDataSourceDto = {
				type: 'device-channel',
				device: mockDevice.id,
				channel: mockChannel.id,
				property: mockChannelProperty.id,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'dataSources',
				class: DeviceChannelDataSourceEntity,
				createDto: CreateDeviceChannelDataSourceDto,
				updateDto: UpdateDeviceChannelDataSourceDto,
			});

			const result = await controller.create(mockCardsPage.id, mockCard.id, { data: createDto });

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.create).toHaveBeenCalledWith(createDto, { cardId: mockCard.id });
		});

		it('should update a data source', async () => {
			const updateDto: UpdateDeviceChannelDataSourceDto = {
				type: 'device-channel',
				property: mockChannelProperty.id,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'dataSources',
				class: DeviceChannelDataSourceEntity,
				createDto: CreateDeviceChannelDataSourceDto,
				updateDto: UpdateDeviceChannelDataSourceDto,
			});

			const result = await controller.update(mockCardsPage.id, mockCard.id, mockDeviceChannelDataSource.id, {
				data: updateDto,
			});

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.update).toHaveBeenCalledWith(mockDeviceChannelDataSource.id, updateDto);
		});

		it('should delete a data source', async () => {
			const result = await controller.remove(mockCardsPage.id, mockCard.id, mockDeviceChannelDataSource.id);

			expect(result).toBeUndefined();
			expect(dataSourceService.remove).toHaveBeenCalledWith(mockDeviceChannelDataSource.id);
		});
	});
});
