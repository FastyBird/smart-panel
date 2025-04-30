/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, useContainer } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, DeviceCategory, EventType } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, DeviceEntity } from '../entities/devices.entity';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';

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

class MockChannel extends ChannelEntity {
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

class CreateMockChannelDto extends CreateChannelDto {
	@Expose()
	@IsString()
	mock_value: string;
}

class UpdateMockChannelDto extends UpdateChannelDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

describe('ChannelsService', () => {
	let service: ChannelsService;
	let repository: Repository<ChannelEntity>;
	let mapper: ChannelsTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: DataSource;

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

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice.id,
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
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
					provide: ChannelsTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockChannel,
							createDto: CreateMockChannelDto,
							updateDto: UpdateMockChannelDto,
						})),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn().mockReturnValue(mockDevice),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						create: jest.fn(() => {}),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
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
		mapper = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<DataSource>(DataSource);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all channels', async () => {
			const mockChannels: MockChannel[] = [mockChannel];

			jest
				.spyOn(repository, 'find')
				.mockResolvedValue(mockChannels.map((entity) => plainToInstance(MockChannel, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockChannels.map((entity) => plainToInstance(MockChannel, entity)));
			expect(repository.find).toHaveBeenCalledWith({
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
		});
	});

	describe('findOne', () => {
		it('should return a channel if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockChannel, mockChannel));

			const result = await service.findOne(mockChannel.id);

			expect(result).toEqual(plainToInstance(MockChannel, mockChannel));
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
			const createDto: CreateMockChannelDto = {
				type: 'mock',
				category: ChannelCategory.GENERIC,
				name: 'New channel',
				device: uuid().toString(),
				mock_value: 'Random text',
			};
			const mockCreateChannel: Partial<MockChannel> = {
				type: createDto.type,
				category: createDto.category,
				name: createDto.name,
				description: null,
				device: createDto.device,
				mockValue: createDto.mock_value,
			};
			const mockCreatedChannel: MockChannel = {
				id: uuid().toString(),
				type: mockCreateChannel.type,
				category: mockCreateChannel.category,
				name: mockCreateChannel.name,
				description: mockCreateChannel.description,
				device: mockCreateChannel.device,
				createdAt: new Date(),
				updatedAt: null,
				properties: [],
				controls: [],
				mockValue: mockCreateChannel.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannel,
				createDto: CreateMockChannelDto,
				updateDto: UpdateMockChannelDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedChannel);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedChannel);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockChannel, mockCreatedChannel));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(MockChannel, mockCreatedChannel));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(MockChannel, mockCreateChannel, {
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
				plainToInstance(MockChannel, mockCreatedChannel),
			);
		});

		it('should throw DevicesException if the channel type is not provided', async () => {
			const createDto: Partial<CreateChannelDto> = {
				category: ChannelCategory.GENERIC,
				name: 'New channel',
			};

			await expect(service.create(createDto as CreateMockChannelDto)).rejects.toThrow(DevicesException);
		});
	});

	describe('update', () => {
		it('should update and return the channel', async () => {
			const updateDto: UpdateMockChannelDto = {
				type: 'mock',
				name: 'Updated channel',
				mock_value: 'Changed text',
			};
			const mockUpdateChannel: MockChannel = {
				id: mockChannel.id,
				type: mockChannel.type,
				category: mockChannel.category,
				name: updateDto.name,
				description: mockChannel.description,
				device: mockChannel.device,
				properties: mockChannel.properties,
				controls: mockChannel.controls,
				createdAt: mockChannel.createdAt,
				updatedAt: mockChannel.updatedAt,
				mockValue: updateDto.mock_value,
			};
			const mockUpdatedChannel: MockChannel = {
				id: mockUpdateChannel.id,
				type: mockUpdateChannel.type,
				category: mockUpdateChannel.category,
				name: mockUpdateChannel.name,
				description: mockUpdateChannel.description,
				device: mockUpdateChannel.device,
				properties: mockUpdateChannel.properties,
				controls: mockUpdateChannel.controls,
				createdAt: mockUpdateChannel.createdAt,
				updatedAt: new Date(),
				mockValue: mockUpdateChannel.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannel,
				createDto: CreateMockChannelDto,
				updateDto: UpdateMockChannelDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(MockChannel, mockChannel))
				.mockResolvedValueOnce(plainToInstance(MockChannel, mockUpdatedChannel));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedChannel);

			const result = await service.update(mockChannel.id, updateDto);

			expect(result).toEqual(plainToInstance(MockChannel, mockUpdatedChannel));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(MockChannel, mockUpdateChannel));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockChannel.id },
				relations: ['device', 'controls', 'controls.channel', 'properties', 'properties.channel'],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_UPDATED,
				plainToInstance(MockChannel, mockUpdatedChannel),
			);
		});
	});

	describe('remove', () => {
		it('should remove a channel', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(MockChannel, mockChannel));
			jest.spyOn(repository, 'delete');

			await service.remove(mockChannel.id);

			expect(repository.delete).toHaveBeenCalledWith(mockChannel.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_DELETED,
				plainToInstance(MockChannel, mockChannel),
			);
		});
	});
});
