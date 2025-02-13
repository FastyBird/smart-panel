/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory } from '../devices.constants';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsService } from '../services/channels.service';

import { ChannelsController } from './channels.controller';

describe('ChannelsController', () => {
	let controller: ChannelsController;
	let channelsService: ChannelsService;

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

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ChannelsController],
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
			],
		}).compile();

		controller = module.get<ChannelsController>(ChannelsController);
		channelsService = module.get<ChannelsService>(ChannelsService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(channelsService).toBeDefined();
	});

	describe('Channels', () => {
		it('should return all channels', async () => {
			const result = await controller.findAll();

			expect(result).toEqual([mockChannel]);
			expect(channelsService.findAll).toHaveBeenCalled();
		});

		it('should return a single channel', async () => {
			const result = await controller.findOne(mockChannel.id);

			expect(result).toEqual(mockChannel);
			expect(channelsService.findOne).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should create a new channel', async () => {
			const createDto: CreateChannelDto = {
				category: ChannelCategory.GENERIC,
				name: 'New Channel',
				device: mockDevice.id,
			};

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(mockChannel);
			expect(channelsService.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a channel', async () => {
			const updateDto: UpdateChannelDto = {
				name: 'Updated Channel',
			};

			const result = await controller.update(mockChannel.id, { data: updateDto });

			expect(result).toEqual(mockChannel);
			expect(channelsService.update).toHaveBeenCalledWith(mockChannel.id, updateDto);
		});

		it('should delete a channel', async () => {
			const result = await controller.remove(mockChannel.id);

			expect(result).toBeUndefined();
			expect(channelsService.remove).toHaveBeenCalledWith(mockChannel.id);
		});
	});
});
