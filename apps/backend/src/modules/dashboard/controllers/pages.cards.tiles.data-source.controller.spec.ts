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
import {
	CardEntity,
	CardsPageEntity,
	DeviceChannelDataSourceEntity,
	DeviceTileEntity,
} from '../entities/dashboard.entity';
import { CardsService } from '../services/cards.service';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { DataSourceService } from '../services/data-source.service';
import { PagesService } from '../services/pages.service';
import { TilesService } from '../services/tiles.service';
import { ChannelPropertyExistsConstraintValidator } from '../validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from '../validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { PagesCardsTilesDataSourceController } from './pages.cards.tiles.data-source.controller';

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

describe('PagesCardsTilesDataSourceController', () => {
	let controller: PagesCardsTilesDataSourceController;
	let pagesService: PagesService;
	let cardsService: CardsService;
	let tilesService: TilesService;
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
		permissions: [PermissionType.READ_ONLY],
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
		title: 'Cards detail',
		order: 0,
		icon: null,
		page: mockCardsPage.id,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockDeviceTile: DeviceTileEntity = {
		id: uuid().toString(),
		type: 'device',
		page: mockCardsPage.id,
		card: mockCard.id,
		device: null,
		dataSource: [],
		row: 0,
		col: 0,
		rowSpan: 0,
		colSpan: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		validateOwnership: (): void => {},
	};

	const mockDeviceChannelDataSource: DeviceChannelDataSourceEntity = {
		id: uuid().toString(),
		type: 'device-channel',
		tile: mockDeviceTile.id,
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
			controllers: [PagesCardsTilesDataSourceController],
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
					provide: TilesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockDeviceTile]),
						findOne: jest.fn().mockResolvedValue(mockDeviceTile),
						create: jest.fn().mockResolvedValue(mockDeviceTile),
						update: jest.fn().mockResolvedValue(mockDeviceTile),
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

		controller = module.get<PagesCardsTilesDataSourceController>(PagesCardsTilesDataSourceController);
		pagesService = module.get<PagesService>(PagesService);
		cardsService = module.get<CardsService>(CardsService);
		tilesService = module.get<TilesService>(TilesService);
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
		expect(tilesService).toBeDefined();
		expect(dataSourceService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('DataSources', () => {
		it('should return all data sources', async () => {
			const result = await controller.findAll(mockCardsPage.id, mockCard.id, mockDeviceTile.id);

			expect(result).toEqual([mockDeviceChannelDataSource]);
			expect(dataSourceService.findAll).toHaveBeenCalledWith({ tileId: mockDeviceTile.id });
		});

		it('should return a single data source', async () => {
			const result = await controller.findOne(
				mockCardsPage.id,
				mockCard.id,
				mockDeviceTile.id,
				mockDeviceChannelDataSource.id,
			);

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.findOne).toHaveBeenCalledWith(mockDeviceChannelDataSource.id, {
				tileId: mockDeviceTile.id,
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

			const result = await controller.create(mockCardsPage.id, mockCard.id, mockDeviceTile.id, { data: createDto });

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.create).toHaveBeenCalledWith(createDto, { tileId: mockDeviceTile.id });
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

			const result = await controller.update(
				mockCardsPage.id,
				mockCard.id,
				mockDeviceTile.id,
				mockDeviceChannelDataSource.id,
				{ data: updateDto },
			);

			expect(result).toEqual(mockDeviceChannelDataSource);
			expect(dataSourceService.update).toHaveBeenCalledWith(mockDeviceChannelDataSource.id, updateDto);
		});

		it('should delete a data source', async () => {
			const result = await controller.remove(
				mockCardsPage.id,
				mockCard.id,
				mockDeviceTile.id,
				mockDeviceChannelDataSource.id,
			);

			expect(result).toBeUndefined();
			expect(dataSourceService.remove).toHaveBeenCalledWith(mockDeviceChannelDataSource.id);
		});
	});
});
