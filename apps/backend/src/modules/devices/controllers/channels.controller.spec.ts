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
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsTypeMapperService } from '../services/channels-type-mapper.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';
import { ChannelExistsConstraintValidator } from '../validators/channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsController } from './channels.controller';

describe('ChannelsController', () => {
	let controller: ChannelsController;
	let service: ChannelsService;
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
			controllers: [ChannelsController],
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

		controller = module.get<ChannelsController>(ChannelsController);
		service = module.get<ChannelsService>(ChannelsService);
		mapper = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Channels', () => {
		it('should return all channels', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(ChannelEntity, mockChannel)]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single channel', async () => {
			const result = await controller.findOne(mockChannel.id);

			expect(result.data).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(service.findOne).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should create a new channel', async () => {
			const createDto: CreateChannelDto = {
				type: 'mock',
				category: ChannelCategory.GENERIC,
				name: 'New Channel',
				device: mockDevice.id,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelEntity,
				createDto: CreateChannelDto,
				updateDto: UpdateChannelDto,
			});

			const result = await controller.create({ data: createDto });

			expect(result.data).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(service.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a channel', async () => {
			const updateDto: UpdateChannelDto = {
				type: 'mock',
				name: 'Updated Channel',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelEntity,
				createDto: CreateChannelDto,
				updateDto: UpdateChannelDto,
			});

			const result = await controller.update(mockChannel.id, { data: updateDto });

			expect(result.data).toEqual(toInstance(ChannelEntity, mockChannel));
			expect(service.update).toHaveBeenCalledWith(mockChannel.id, updateDto);
		});

		it('should delete a channel', async () => {
			const result = await controller.remove(mockChannel.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockChannel.id);
		});
	});
});
