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

		controller = module.get<ChannelsController>(ChannelsController);
		service = module.get<ChannelsService>(ChannelsService);
		mapper = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Channels', () => {
		it('should return all channels', async () => {
			const result = await controller.findAll();

			expect(result).toEqual([mockChannel]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single channel', async () => {
			const result = await controller.findOne(mockChannel.id);

			expect(result).toEqual(mockChannel);
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

			expect(result).toEqual(mockChannel);
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

			expect(result).toEqual(mockChannel);
			expect(service.update).toHaveBeenCalledWith(mockChannel.id, updateDto);
		});

		it('should delete a channel', async () => {
			const result = await controller.remove(mockChannel.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockChannel.id);
		});
	});
});
