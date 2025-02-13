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

import { ChannelsPropertiesController } from './channels.properties.controller';

describe('ChannelsPropertiesController', () => {
	let controller: ChannelsPropertiesController;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;

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
		permission: [PermissionType.READ_ONLY],
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
			controllers: [ChannelsPropertiesController],
			providers: [
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

		controller = module.get<ChannelsPropertiesController>(ChannelsPropertiesController);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
	});

	describe('Properties', () => {
		it('should return all properties for a channel', async () => {
			const result = await controller.findAll(mockChannel.id);

			expect(result).toEqual([mockChannelProperty]);
			expect(channelsPropertiesService.findAll).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should return a single property for a channel', async () => {
			const result = await controller.findOne(mockChannel.id, mockChannelProperty.id);

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(mockChannelProperty.id, mockChannel.id);
		});

		it('should create a new property', async () => {
			const createDto: CreateChannelPropertyDto = {
				category: PropertyCategory.GENERIC,
				name: 'New Property',
				permission: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
			};

			const result = await controller.create(mockChannel.id, { data: createDto });

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(mockChannel.id, createDto);
		});

		it('should update a property', async () => {
			const updateDto: UpdateChannelPropertyDto = { name: 'Updated Property' };

			const result = await controller.update(mockChannel.id, mockChannelProperty.id, { data: updateDto });

			expect(result).toEqual(mockChannelProperty);
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(mockChannelProperty.id, updateDto);
		});

		it('should delete a property', async () => {
			const result = await controller.remove(mockChannel.id, mockChannelProperty.id);

			expect(result).toBeUndefined();
			expect(channelsPropertiesService.remove).toHaveBeenCalledWith(mockChannelProperty.id);
		});
	});
});
