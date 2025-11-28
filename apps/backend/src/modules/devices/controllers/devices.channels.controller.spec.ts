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
import { ChannelCategory, ConnectionState, DeviceCategory } from '../devices.constants';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { CreateDeviceChannelDto } from '../dto/create-device-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsTypeMapperService } from '../services/channels-type-mapper.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';
import { ChannelExistsConstraintValidator } from '../validators/channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { DevicesChannelsController } from './devices.channels.controller';

describe('DevicesChannelsController', () => {
	let controller: DevicesChannelsController;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let mapper: ChannelsTypeMapperService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		status: {
			online: false,
			status: ConnectionState.UNKNOWN,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
	};

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice,
		controls: [],
		properties: [],
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesChannelsController],
			providers: [
				DeviceExistsConstraintValidator,
				ChannelExistsConstraintValidator,
				{
					provide: ChannelsTypeMapperService,
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
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<DevicesChannelsController>(DevicesChannelsController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		mapper = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Device Channels', () => {
		it('should return all device channels for a device', async () => {
			const result = await controller.findAll(mockDevice.id);

			expect(result.data).toEqual([toInstance(ChannelEntity, mockChannel)]);
			expect(channelsService.findAll).toHaveBeenCalledWith(mockDevice.id);
		});

		it('should return a single device channel for a device', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id);

			expect(result.data).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(channelsService.findOne).toHaveBeenCalledWith(mockChannel.id, mockDevice.id);
		});

		it('should create a new device channel', async () => {
			const createDto: CreateDeviceChannelDto = {
				type: 'mock',
				category: ChannelCategory.GENERIC,
				name: 'New Channel',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelEntity,
				createDto: CreateChannelDto,
				updateDto: UpdateChannelDto,
			});

			const result = await controller.create(mockDevice.id, { data: createDto });

			expect(result.data).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(channelsService.create).toHaveBeenCalledWith({ ...createDto, device: mockDevice.id });
		});

		it('should delete a device channel', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id);

			expect(result).toBeUndefined();
			expect(channelsService.remove).toHaveBeenCalledWith(mockChannel.id);
		});
	});
});
