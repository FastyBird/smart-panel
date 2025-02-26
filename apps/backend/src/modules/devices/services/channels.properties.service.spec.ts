/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, DataTypeType, EventType, PermissionType, PropertyCategory } from '../devices.constants';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { PropertyValueService } from './property-value.service';

describe('ChannelsPropertiesService', () => {
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let repository: Repository<ChannelPropertyEntity>;
	let eventEmitter: EventEmitter2;

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		category: ChannelCategory.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
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
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
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
				ChannelsPropertiesService,
				{ provide: getRepositoryToken(ChannelPropertyEntity), useFactory: mockRepository },
				{
					provide: ChannelsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
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

		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		repository = module.get<Repository<ChannelPropertyEntity>>(getRepositoryToken(ChannelPropertyEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
	});

	it('should be defined', () => {
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
		expect(repository).toBeDefined();
		expect(eventEmitter).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all properties for a channel', async () => {
			const mockProperties: ChannelPropertyEntity[] = [mockChannelProperty];

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockProperties.map((entity) => plainToInstance(ChannelPropertyEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findAll(mockChannel.id);

			expect(result).toEqual(mockProperties.map((entity) => plainToInstance(ChannelPropertyEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a channel property if found', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(ChannelPropertyEntity, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(mockChannelProperty.id, mockChannel.id);

			expect(result).toEqual(plainToInstance(ChannelPropertyEntity, mockChannelProperty));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockChannelProperty.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the channel property is not found', async () => {
			const propertyId = uuid().toString();

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(propertyId, mockChannel.id);

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: propertyId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new channel property', async () => {
			const createDto: CreateChannelPropertyDto = {
				category: PropertyCategory.GENERIC,
				permission: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
			};
			const mockCreateProperty: Partial<ChannelPropertyEntity> = {
				category: createDto.category,
				name: createDto.name,
				permission: createDto.permission,
				dataType: createDto.data_type,
				unit: null,
				format: null,
				invalid: null,
				step: null,
				value: null,
				channel: mockChannel.id,
			};
			const mockCreatedProperty: ChannelPropertyEntity = {
				id: uuid().toString(),
				category: mockCreateProperty.category,
				name: mockCreateProperty.name,
				permission: mockCreateProperty.permission,
				dataType: mockCreateProperty.dataType,
				unit: mockCreateProperty.unit,
				format: mockCreateProperty.format,
				invalid: mockCreateProperty.invalid,
				step: mockCreateProperty.step,
				value: mockCreateProperty.value,
				channel: mockCreateProperty.channel,
				createdAt: new Date(),
				updatedAt: null,
			};

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(ChannelPropertyEntity, mockCreatedProperty));
			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedProperty);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedProperty);

			const result = await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(result).toEqual(plainToInstance(ChannelPropertyEntity, mockCreatedProperty));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(ChannelPropertyEntity, mockCreateProperty, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedProperty);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_CREATED,
				plainToInstance(ChannelPropertyEntity, mockCreatedProperty),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				relations: ['channel'],
				where: { id: mockCreatedProperty.id },
			});
		});
	});

	describe('update', () => {
		it('should update existing and return a channel property', async () => {
			const updateDto: UpdateChannelPropertyDto = { name: 'New name', step: 0.1 };
			const mockUpdateProperty: ChannelPropertyEntity = {
				id: mockChannelProperty.id,
				category: mockChannelProperty.category,
				name: updateDto.name,
				permission: mockChannelProperty.permission,
				dataType: mockChannelProperty.dataType,
				unit: mockChannelProperty.unit,
				format: mockChannelProperty.format,
				invalid: mockChannelProperty.invalid,
				step: updateDto.step,
				value: mockChannelProperty.value,
				channel: mockChannelProperty.channel,
				createdAt: mockChannelProperty.createdAt,
				updatedAt: mockChannelProperty.updatedAt,
			};
			const mockUpdatedProperty: ChannelPropertyEntity = {
				id: mockUpdateProperty.id,
				category: mockUpdateProperty.category,
				name: mockUpdateProperty.name,
				permission: mockUpdateProperty.permission,
				dataType: mockUpdateProperty.dataType,
				unit: mockUpdateProperty.unit,
				format: mockUpdateProperty.format,
				invalid: mockUpdateProperty.invalid,
				step: mockUpdateProperty.step,
				value: mockUpdateProperty.value,
				channel: mockUpdateProperty.channel,
				createdAt: mockUpdateProperty.createdAt,
				updatedAt: new Date(),
			};

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(ChannelPropertyEntity, mockChannelProperty))
				.mockResolvedValueOnce(plainToInstance(ChannelPropertyEntity, mockUpdatedProperty));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedProperty);

			const result = await channelsPropertiesService.update(mockChannelProperty.id, updateDto);

			expect(result).toEqual(plainToInstance(ChannelPropertyEntity, mockUpdatedProperty));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(ChannelPropertyEntity, mockUpdateProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				plainToInstance(ChannelPropertyEntity, mockUpdatedProperty),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				relations: ['channel'],
				where: { id: mockUpdatedProperty.id },
			});
		});
	});

	describe('remove', () => {
		it('should remove a channel property', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));
			jest
				.spyOn(channelsPropertiesService, 'findOne')
				.mockResolvedValue(plainToInstance(ChannelPropertyEntity, mockChannelProperty));

			jest.spyOn(repository, 'remove').mockResolvedValue(mockChannelProperty);

			await channelsPropertiesService.remove(mockChannelProperty.id);

			expect(repository.remove).toHaveBeenCalledWith(plainToInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_DELETED,
				plainToInstance(ChannelPropertyEntity, mockChannelProperty),
			);
		});
	});
});
