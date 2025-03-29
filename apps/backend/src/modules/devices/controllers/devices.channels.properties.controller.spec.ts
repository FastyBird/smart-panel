/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../devices.constants';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

import { DevicesChannelsPropertiesController } from './devices.channels.properties.controller';

describe('DevicesChannelsPropertiesController', () => {
	let controller: DevicesChannelsPropertiesController;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let mapper: DevicesTypeMapperService;

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
					provide: DevicesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockDevice]),
						findOne: jest.fn().mockResolvedValue(mockDevice),
						create: jest.fn().mockResolvedValue(mockDevice),
						update: jest.fn().mockResolvedValue(mockDevice),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockChannel]),
						findOne: jest.fn().mockResolvedValue(mockChannel),
						create: jest.fn().mockResolvedValue(mockChannel),
						update: jest.fn().mockResolvedValue(mockChannel),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockChannelProperty]),
						findOne: jest.fn().mockResolvedValue(mockChannelProperty),
						create: jest.fn().mockResolvedValue(mockChannelProperty),
						update: jest.fn().mockResolvedValue(mockChannelProperty),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<DevicesChannelsPropertiesController>(DevicesChannelsPropertiesController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
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

			expect(result).toEqual([mockChannelProperty]);
			expect(channelsPropertiesService.findAll).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should return a single property for a channel', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(mockChannelProperty.id, mockChannel.id);
		});

		it('should create a new property', async () => {
			const createDto: CreateChannelPropertyDto = {
				category: PropertyCategory.GENERIC,
				name: 'New Property',
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
			};

			const result = await controller.create(mockDevice.id, mockChannel.id, { data: createDto });

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(mockChannel.id, createDto);
		});

		it('should update a property', async () => {
			const updateDto: UpdateChannelPropertyDto = { name: 'Updated Property' };

			const result = await controller.update(mockDevice.id, mockChannel.id, mockChannelProperty.id, {
				data: updateDto,
			});

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(mockChannelProperty.id, updateDto);
		});

		it('should delete a property', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result).toBeUndefined();
			expect(channelsPropertiesService.remove).toHaveBeenCalledWith(mockChannelProperty.id);
		});
	});
});
