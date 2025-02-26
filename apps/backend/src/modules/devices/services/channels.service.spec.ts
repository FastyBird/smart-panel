/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Expose, Transform } from 'class-transformer';
import { IsString, useContainer } from 'class-validator';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, DeviceCategory, EventType } from '../devices.constants';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PropertyValueService } from './property-value.service';

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

describe('ChannelsService', () => {
	let service: ChannelsService;
	let repository: Repository<ChannelEntity>;
	let eventEmitter: EventEmitter2;

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

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChannelsService,
				DeviceExistsConstraintValidator,
				{ provide: getRepositoryToken(ChannelEntity), useFactory: mockRepository },
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn().mockReturnValue(mockDevice),
					},
				},
				{
					provide: PropertyValueService,
					useValue: {
						write: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get<ChannelsService>(ChannelsService);
		repository = module.get<Repository<ChannelEntity>>(getRepositoryToken(ChannelEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(eventEmitter).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all channels', async () => {
			const mockChannels: ChannelEntity[] = [mockChannel];

			jest
				.spyOn(repository, 'find')
				.mockResolvedValue(mockChannels.map((entity) => plainToInstance(ChannelEntity, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockChannels.map((entity) => plainToInstance(ChannelEntity, entity)));
			expect(repository.find).toHaveBeenCalledWith({
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
		});
	});

	describe('findOne', () => {
		it('should return a channel if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const result = await service.findOne(mockChannel.id);

			expect(result).toEqual(plainToInstance(ChannelEntity, mockChannel));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockChannel.id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
		});

		it('should return null if the channel is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne(id);

			expect(result).toEqual(null);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
		});
	});

	describe('create', () => {
		it('should create and return a new channel', async () => {
			const createDto: CreateChannelDto = {
				category: ChannelCategory.GENERIC,
				name: 'New channel',
				device: uuid().toString(),
			};
			const mockCreateChannel: Partial<ChannelEntity> = {
				category: createDto.category,
				name: createDto.name,
				description: null,
				device: createDto.device,
			};
			const mockCreatedChannel: ChannelEntity = {
				id: uuid().toString(),
				category: mockCreateChannel.category,
				name: mockCreateChannel.name,
				description: mockCreateChannel.description,
				device: mockCreateChannel.device,
				createdAt: new Date(),
				updatedAt: null,
				properties: [],
				controls: [],
			};

			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedChannel);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedChannel);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(ChannelEntity, mockCreatedChannel));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(ChannelEntity, mockCreatedChannel));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(ChannelEntity, mockCreateChannel, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedChannel);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCreatedChannel.id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CREATED,
				plainToInstance(ChannelEntity, mockCreatedChannel),
			);
		});
	});

	describe('update', () => {
		it('should update and return the channel', async () => {
			const updateDto: UpdateChannelDto = { name: 'Updated channel' };
			const mockUpdateChannel: ChannelEntity = {
				id: mockChannel.id,
				category: mockChannel.category,
				name: updateDto.name,
				description: mockChannel.description,
				device: mockChannel.device,
				properties: mockChannel.properties,
				controls: mockChannel.controls,
				createdAt: mockChannel.createdAt,
				updatedAt: mockChannel.updatedAt,
			};
			const mockUpdatedChannel: ChannelEntity = {
				id: mockUpdateChannel.id,
				category: mockUpdateChannel.category,
				name: mockUpdateChannel.name,
				description: mockUpdateChannel.description,
				device: mockUpdateChannel.device,
				properties: mockUpdateChannel.properties,
				controls: mockUpdateChannel.controls,
				createdAt: mockUpdateChannel.createdAt,
				updatedAt: new Date(),
			};

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(ChannelEntity, mockChannel))
				.mockResolvedValueOnce(plainToInstance(ChannelEntity, mockUpdatedChannel));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedChannel);

			const result = await service.update(mockChannel.id, updateDto);

			expect(result).toEqual(plainToInstance(ChannelEntity, mockUpdatedChannel));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(ChannelEntity, mockUpdateChannel));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockChannel.id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_UPDATED,
				plainToInstance(ChannelEntity, mockUpdatedChannel),
			);
		});
	});

	describe('remove', () => {
		it('should remove a channel', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));
			jest.spyOn(repository, 'remove').mockResolvedValue(mockChannel);

			await service.remove(mockChannel.id);

			expect(repository.remove).toHaveBeenCalledWith(mockChannel);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_DELETED,
				plainToInstance(ChannelEntity, mockChannel),
			);
		});
	});
});
