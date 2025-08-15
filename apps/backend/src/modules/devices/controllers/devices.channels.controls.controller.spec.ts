/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, DeviceCategory } from '../devices.constants';
import { CreateChannelControlDto } from '../dto/create-channel-control.dto';
import { ChannelControlEntity, ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsControlsService } from '../services/channels.controls.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

import { DevicesChannelsControlsController } from './devices.channels.controls.controller';

describe('DevicesChannelsControlsController', () => {
	let controller: DevicesChannelsControlsController;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsControlsService: ChannelsControlsService;
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

	const mockChannelControl: ChannelControlEntity = {
		id: uuid().toString(),
		name: 'Test Control',
		channel: mockChannel,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesChannelsControlsController],
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
					provide: ChannelsControlsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(ChannelControlEntity, mockChannelControl)]),
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl)),
						findOneByName: jest.fn().mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl)),
						create: jest.fn().mockResolvedValue(toInstance(ChannelControlEntity, mockChannelControl)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<DevicesChannelsControlsController>(DevicesChannelsControlsController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsControlsService = module.get<ChannelsControlsService>(ChannelsControlsService);
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(channelsControlsService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Channel controls', () => {
		it('should return all controls for a channel', async () => {
			const result = await controller.findAll(mockDevice.id, mockChannel.id);

			expect(result).toEqual([toInstance(ChannelControlEntity, mockChannelControl)]);
			expect(channelsControlsService.findAll).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should return a single control for a channel', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id, mockChannelControl.id);

			expect(result).toEqual(toInstance(ChannelControlEntity, mockChannelControl));
			expect(channelsControlsService.findOne).toHaveBeenCalledWith(mockChannelControl.id, mockChannel.id);
		});

		it('should create a new control', async () => {
			const createDto: CreateChannelControlDto = { name: 'New Control' };

			const result = await controller.create(mockDevice.id, mockChannel.id, { data: createDto });

			expect(result).toEqual(toInstance(ChannelControlEntity, mockChannelControl));
			expect(channelsControlsService.create).toHaveBeenCalledWith(mockChannel.id, createDto);
		});

		it('should delete a control', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id, mockChannelControl.id);

			expect(result).toBeUndefined();
			expect(channelsControlsService.remove).toHaveBeenCalledWith(mockChannelControl.id, mockChannel.id);
		});
	});
});
