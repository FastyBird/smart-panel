/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform, plainToInstance } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, DataTypeType, EventType, PermissionType, PropertyCategory } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { PropertyValueService } from './property-value.service';

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

class MockChannelProperty extends ChannelPropertyEntity {
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

class CreateMockChannelPropertyDto extends CreateChannelPropertyDto {
	@Expose()
	@IsString()
	mock_value: string;
}

class UpdateMockChannelPropertyDto extends UpdateChannelPropertyDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

describe('ChannelsPropertiesService', () => {
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let repository: Repository<ChannelPropertyEntity>;
	let mapper: ChannelsPropertiesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: DataSource;

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockChannelProperty: MockChannelProperty = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: '°C',
		format: null,
		invalid: null,
		step: 0.5,
		value: '22.5',
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
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
				ChannelsPropertiesService,
				{ provide: getRepositoryToken(ChannelPropertyEntity), useFactory: mockRepository },
				{
					provide: ChannelsPropertiesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockChannelProperty,
							createDto: CreateMockChannelPropertyDto,
							updateDto: UpdateMockChannelPropertyDto,
						})),
					},
				},
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

		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		repository = module.get<Repository<ChannelPropertyEntity>>(getRepositoryToken(ChannelPropertyEntity));
		mapper = module.get<ChannelsPropertiesTypeMapperService>(ChannelsPropertiesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<DataSource>(DataSource);
	});

	it('should be defined', () => {
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all properties for a channel', async () => {
			const mockProperties: MockChannelProperty[] = [mockChannelProperty];

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockProperties.map((entity) => plainToInstance(MockChannelProperty, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findAll(mockChannel.id);

			expect(result).toEqual(mockProperties.map((entity) => plainToInstance(MockChannelProperty, entity)));

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
				getOne: jest.fn().mockResolvedValue(plainToInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(mockChannelProperty.id, mockChannel.id);

			expect(result).toEqual(plainToInstance(MockChannelProperty, mockChannelProperty));

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
			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};
			const mockCreateProperty: Partial<MockChannelProperty> = {
				type: createDto.type,
				category: createDto.category,
				name: createDto.name,
				permissions: createDto.permissions,
				dataType: createDto.data_type,
				unit: null,
				format: null,
				invalid: null,
				step: null,
				value: null,
				channel: mockChannel.id,
				mockValue: createDto.mock_value,
			};
			const mockCreatedProperty: MockChannelProperty = {
				id: uuid().toString(),
				type: mockCreateProperty.type,
				category: mockCreateProperty.category,
				name: mockCreateProperty.name,
				permissions: mockCreateProperty.permissions,
				dataType: mockCreateProperty.dataType,
				unit: mockCreateProperty.unit,
				format: mockCreateProperty.format,
				invalid: mockCreateProperty.invalid,
				step: mockCreateProperty.step,
				value: mockCreateProperty.value,
				channel: mockCreateProperty.channel,
				createdAt: new Date(),
				updatedAt: null,
				mockValue: mockCreateProperty.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(MockChannelProperty, mockCreatedProperty));
			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedProperty);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedProperty);

			const result = await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(result).toEqual(plainToInstance(MockChannelProperty, mockCreatedProperty));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(MockChannelProperty, mockCreateProperty, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedProperty);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_CREATED,
				plainToInstance(MockChannelProperty, mockCreatedProperty),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				relations: ['channel'],
				where: { id: mockCreatedProperty.id },
			});
		});

		it('should throw DevicesException if the channel property type is not provided', async () => {
			const createDto: Partial<CreateChannelPropertyDto> = {
				category: PropertyCategory.GENERIC,
			};

			await expect(
				channelsPropertiesService.create(mockChannel.id, createDto as CreateMockChannelPropertyDto),
			).rejects.toThrow(DevicesException);
		});
	});

	describe('update', () => {
		it('should update existing and return a channel property', async () => {
			const updateDto: UpdateMockChannelPropertyDto = {
				type: 'mock',
				name: 'New name',
				step: 0.1,
				mock_value: 'Changed text',
			};
			const mockUpdateProperty: MockChannelProperty = {
				id: mockChannelProperty.id,
				type: mockChannelProperty.type,
				category: mockChannelProperty.category,
				name: updateDto.name,
				permissions: mockChannelProperty.permissions,
				dataType: mockChannelProperty.dataType,
				unit: mockChannelProperty.unit,
				format: mockChannelProperty.format,
				invalid: mockChannelProperty.invalid,
				step: updateDto.step,
				value: mockChannelProperty.value,
				channel: mockChannelProperty.channel,
				createdAt: mockChannelProperty.createdAt,
				updatedAt: mockChannelProperty.updatedAt,
				mockValue: updateDto.mock_value,
			};
			const mockUpdatedProperty: MockChannelProperty = {
				id: mockUpdateProperty.id,
				type: mockUpdateProperty.type,
				category: mockUpdateProperty.category,
				name: mockUpdateProperty.name,
				permissions: mockUpdateProperty.permissions,
				dataType: mockUpdateProperty.dataType,
				unit: mockUpdateProperty.unit,
				format: mockUpdateProperty.format,
				invalid: mockUpdateProperty.invalid,
				step: mockUpdateProperty.step,
				value: mockUpdateProperty.value,
				channel: mockUpdateProperty.channel,
				createdAt: mockUpdateProperty.createdAt,
				updatedAt: new Date(),
				mockValue: mockUpdateProperty.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(plainToInstance(ChannelEntity, mockChannel));

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(MockChannelProperty, mockChannelProperty))
				.mockResolvedValueOnce(plainToInstance(MockChannelProperty, mockUpdatedProperty));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedProperty);

			const result = await channelsPropertiesService.update(mockChannelProperty.id, updateDto);

			expect(result).toEqual(plainToInstance(MockChannelProperty, mockUpdatedProperty));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(MockChannelProperty, mockUpdateProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				plainToInstance(MockChannelProperty, mockUpdatedProperty),
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
				.mockResolvedValue(plainToInstance(MockChannelProperty, mockChannelProperty));

			jest.spyOn(repository, 'delete');

			await channelsPropertiesService.remove(mockChannelProperty.id);

			expect(repository.delete).toHaveBeenCalledWith(mockChannelProperty.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_DELETED,
				plainToInstance(MockChannelProperty, mockChannelProperty),
			);
		});
	});
});
