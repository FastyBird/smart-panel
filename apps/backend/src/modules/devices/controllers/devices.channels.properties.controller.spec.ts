/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

import { DevicesChannelsPropertiesController } from './devices.channels.properties.controller';

describe('DevicesChannelsPropertiesController', () => {
	let controller: DevicesChannelsPropertiesController;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let mapper: ChannelsPropertiesTypeMapperService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
	};

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice,
		controls: [],
		properties: [],
	};

	const mockChannelProperty: ChannelPropertyEntity = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: '°C',
		format: null,
		invalid: null,
		step: 0.5,
		value: '22.5',
		channel: mockChannel,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesChannelsPropertiesController],
			providers: [
				{
					provide: ChannelsPropertiesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(DeviceEntity, mockDevice)]),
						findOne: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						create: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						update: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(ChannelEntity, mockChannel)]),
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						create: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						update: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(ChannelPropertyEntity, mockChannelProperty)]),
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						create: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						update: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<DevicesChannelsPropertiesController>(DevicesChannelsPropertiesController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		mapper = module.get<ChannelsPropertiesTypeMapperService>(ChannelsPropertiesTypeMapperService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Channel properties', () => {
		it('should return all properties for a channel', async () => {
			const result = await controller.findAll(mockDevice.id, mockChannel.id);

			expect(result).toEqual([toInstance(ChannelPropertyEntity, mockChannelProperty)]);
			expect(channelsPropertiesService.findAll).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should return a single property for a channel', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(mockChannelProperty.id, mockChannel.id);
		});

		it('should create a new property', async () => {
			const createDto: CreateChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				name: 'New Property',
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelPropertyEntity,
				createDto: CreateChannelPropertyDto,
				updateDto: UpdateChannelPropertyDto,
			});

			const result = await controller.create(mockDevice.id, mockChannel.id, { data: createDto });

			expect(result).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(mockChannel.id, createDto);
		});

		it('should update a property', async () => {
			const updateDto: UpdateChannelPropertyDto = {
				type: 'mock',
				name: 'Updated Property',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelPropertyEntity,
				createDto: CreateChannelPropertyDto,
				updateDto: UpdateChannelPropertyDto,
			});

			const result = await controller.update(mockDevice.id, mockChannel.id, mockChannelProperty.id, {
				data: updateDto,
			});

			expect(result).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(mockChannelProperty.id, updateDto);
		});

		it('should delete a property', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result).toBeUndefined();
			expect(channelsPropertiesService.remove).toHaveBeenCalledWith(mockChannelProperty.id);
		});
	});
});
