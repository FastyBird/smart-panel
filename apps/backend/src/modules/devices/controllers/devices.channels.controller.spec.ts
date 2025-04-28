/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory } from '../devices.constants';
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
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<DevicesChannelsController>(DevicesChannelsController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		mapper = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);
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

			expect(result).toEqual([mockChannel]);
			expect(channelsService.findAll).toHaveBeenCalledWith(mockDevice.id);
		});

		it('should return a single device channel for a device', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id);

			expect(result).toEqual(mockChannel);
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

			expect(result).toEqual(mockChannel);
			expect(channelsService.create).toHaveBeenCalledWith({ ...createDto, device: mockDevice.id });
		});

		it('should delete a device channel', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id);

			expect(result).toBeUndefined();
			expect(channelsService.remove).toHaveBeenCalledWith(mockChannel.id);
		});
	});
});
