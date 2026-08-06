/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, DataTypeType, EventType, PermissionType, PropertyCategory } from '../devices.constants';
import { DevicesException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState } from '../models/property-value-state.model';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
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
	let propertyValueService: jest.Mocked<PropertyValueService>;
	let valueSourceRegistry: PropertyValueSourceRegistryService;

	const mockChannel: MockChannel = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: uuid().toString(),
		parentId: null,
		parent: null,
		children: [],
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockChannelProperty: MockChannelProperty = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		identifier: null,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: null,
		format: null,
		invalid: null,
		step: 0.5,
		value: new PropertyValueState('22.5'),
		channel: mockChannel.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some value',
	};

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		findOne: jest.fn(),
		remove: jest.fn(),
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
					provide: PropertyValueService,
					useValue: {
						write: jest.fn(() => {}),
						readLatestStrict: jest.fn(),
					},
				},
				PropertyValueSourceRegistryService,
				{
					provide: DataSource,
					useValue: {
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
						getRepository: jest.fn(() => {}),
						query: jest.fn(),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
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
		propertyValueService = module.get<PropertyValueService>(PropertyValueService) as jest.Mocked<PropertyValueService>;
		valueSourceRegistry = module.get<PropertyValueSourceRegistryService>(PropertyValueSourceRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
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

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockProperties.map((entity) => toInstance(MockChannelProperty, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findAll(mockChannel.id);

			expect(result).toEqual(mockProperties.map((entity) => toInstance(MockChannelProperty, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findBoundedForChannels', () => {
		it('selects capped property IDs before hydrating values', async () => {
			const countQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ channelId: mockChannel.id, propertyCount: '45' }]),
			};
			const entityQuery: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockChannelProperty]),
			};
			jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: mockChannelProperty.id }]);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValueOnce(countQuery).mockReturnValueOnce(entityQuery);

			await expect(channelsPropertiesService.findBoundedForChannels([mockChannel.id], 40)).resolves.toEqual({
				properties: [mockChannelProperty],
				totals: { [mockChannel.id]: 45 },
			});
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ROW_NUMBER() OVER'), [mockChannel.id, 40]);
			expect(entityQuery.where).toHaveBeenCalledWith('property.id IN (:...propertyIds)', {
				propertyIds: [mockChannelProperty.id],
			});
			expect(entityQuery.callListeners).toHaveBeenCalledWith(true);
		});

		it('strictly reloads bounded values and propagates storage failures', async () => {
			const countQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ channelId: mockChannel.id, propertyCount: '1' }]),
			};
			const entityQuery: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockChannelProperty]),
			};
			jest.spyOn(dataSource, 'query').mockResolvedValue([{ id: mockChannelProperty.id }]);
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValueOnce(countQuery).mockReturnValueOnce(entityQuery);
			propertyValueService.readLatestStrict.mockRejectedValue(new Error('storage unavailable'));

			await expect(
				channelsPropertiesService.findBoundedForChannels([mockChannel.id], 40, true, [PropertyCategory.GENERIC]),
			).rejects.toThrow('storage unavailable');
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('property."category" IN (?)'), [
				mockChannel.id,
				PropertyCategory.GENERIC,
				40,
			]);
			expect(countQuery.andWhere).toHaveBeenCalledWith('property.category IN (:...propertyCategories)', {
				propertyCategories: [PropertyCategory.GENERIC],
			});
			expect(entityQuery.callListeners).toHaveBeenCalledWith(false);
			expect(propertyValueService.readLatestStrict).toHaveBeenCalledWith(mockChannelProperty);
		});
	});

	describe('findOne', () => {
		it('should return a channel property if found', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await channelsPropertiesService.findOne(mockChannelProperty.id, mockChannel.id);

			expect(result).toEqual(toInstance(MockChannelProperty, mockChannelProperty));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('property');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('property.channel', 'channel');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockChannelProperty.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('channel.id = :channelId', { channelId: mockChannel.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the channel property is not found', async () => {
			const propertyId = uuid().toString();

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

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
		const projectedPropertyId = uuid().toString();

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
				channel: mockChannel.id,
				mockValue: createDto.mock_value,
			};
			const mockCreatedProperty: MockChannelProperty = {
				id: uuid().toString(),
				type: mockCreateProperty.type,
				category: mockCreateProperty.category,
				identifier: mockCreateProperty.identifier,
				name: mockCreateProperty.name,
				permissions: mockCreateProperty.permissions,
				dataType: mockCreateProperty.dataType,
				unit: null,
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

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(toInstance(MockChannelProperty, mockCreatedProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(ChannelPropertyEntity, mockCreatedProperty));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockCreatedProperty));

			const result = await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(result).toEqual(toInstance(MockChannelProperty, mockCreatedProperty));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockCreateProperty));
			expect(repository.save).toHaveBeenCalledWith(toInstance(ChannelPropertyEntity, mockCreatedProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_CREATED,
				toInstance(MockChannelProperty, mockCreatedProperty),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockCreatedProperty.id });
		});

		it('should throw DevicesException if the channel property type is not provided', async () => {
			const createDto: Partial<CreateChannelPropertyDto> = {
				category: PropertyCategory.GENERIC,
			};

			await expect(
				channelsPropertiesService.create(mockChannel.id, createDto as CreateMockChannelPropertyDto),
			).rejects.toThrow(DevicesException);
		});

		// A property whose value is stored under another property's key has no series of its own to
		// seed, and creation dispatches no command the value could have meant instead — so the only
		// thing it could become is a measurement of the *source* device that its hardware never
		// reported. Refused before the row is saved, so nothing is left behind either.
		it('should refuse a value supplied for a property whose value is stored by another property', async () => {
			valueSourceRegistry.register({
				getType: () => 'mock',
				resolve: (property) => (property.id === projectedPropertyId ? 'some-other-property-id' : null),
			});

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.FLOAT,
				value: 21.5,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: projectedPropertyId });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(created);

			// Everything downstream is wired to succeed, so a build without the guard creates the row
			// and writes the value straight into the source's series rather than failing for some
			// unrelated reason further along.
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(channelsPropertiesService.create(mockChannel.id, createDto)).rejects.toThrow(
				DevicesValidationException,
			);

			// The source's series is never reached, and no half-created row survives the refusal.
			expect(propertyValueService.write).not.toHaveBeenCalled();
			expect(saveSpy).not.toHaveBeenCalled();
		});

		it('should still store a value for a property that owns its series', async () => {
			valueSourceRegistry.register({
				getType: () => 'mock',
				resolve: (property) => (property.id === projectedPropertyId ? 'some-other-property-id' : null),
			});

			const ownPropertyId = uuid().toString();

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.FLOAT,
				value: 21.5,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: ownPropertyId });

			jest.spyOn(repository, 'create').mockReturnValue(created);
			jest.spyOn(repository, 'save').mockResolvedValue(created);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(propertyValueService.write).toHaveBeenCalledWith(created, 21.5);
		});

		// The counterpart to `beforeUpdate`. It exists so a type owner can judge an invariant spanning
		// the property and the channel it is being attached to — and `channelId` is a route parameter on
		// both property controllers, so it never reaches the create DTO and has to be handed over here.

		it('should call the mapping beforeCreate hook with the channel id, before saving', async () => {
			const beforeCreate = jest.fn().mockResolvedValue(undefined);

			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeCreate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: uuid().toString() });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(created);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await channelsPropertiesService.create(mockChannel.id, createDto);

			expect(beforeCreate).toHaveBeenCalledTimes(1);
			expect(beforeCreate.mock.calls[0][1]).toBe(mockChannel.id);
			expect(beforeCreate.mock.invocationCallOrder[0]).toBeLessThan(saveSpy.mock.invocationCallOrder[0]);
		});

		it('should persist nothing when the beforeCreate hook rejects the attachment', async () => {
			const createDto: CreateMockChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
				mock_value: 'Random text',
			};

			const afterCreate = jest.fn();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeCreate: jest.fn().mockRejectedValue(new DevicesValidationException('Wrong kind of channel.')),
				afterCreate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const created = toInstance(MockChannelProperty, { ...createDto, id: uuid().toString() });

			jest.spyOn(repository, 'create').mockReturnValue(created);

			const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(created);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(created),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(channelsPropertiesService.create(mockChannel.id, createDto)).rejects.toThrow(
				DevicesValidationException,
			);

			// No row, no event, and no afterCreate hook — a refused attachment leaves nothing behind for
			// anything downstream to observe.
			expect(saveSpy).not.toHaveBeenCalled();
			expect(afterCreate).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
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
				identifier: mockChannelProperty.identifier,
				name: updateDto.name,
				permissions: mockChannelProperty.permissions,
				dataType: mockChannelProperty.dataType,
				unit: null,
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
				identifier: mockUpdateProperty.identifier,
				name: mockUpdateProperty.name,
				permissions: mockUpdateProperty.permissions,
				dataType: mockUpdateProperty.dataType,
				unit: null,
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

			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockChannelProperty, mockChannelProperty))
					.mockResolvedValueOnce(toInstance(MockChannelProperty, mockUpdatedProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockUpdatedProperty));

			const result = await channelsPropertiesService.update(mockChannelProperty.id, updateDto);

			expect(result).toEqual(toInstance(MockChannelProperty, mockUpdatedProperty));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockUpdateProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_UPDATED,
				toInstance(MockChannelProperty, mockUpdatedProperty),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('property.id = :id', { id: mockUpdatedProperty.id });
		});

		// The hook exists so a type owner can judge an invariant spanning a field the PATCH sent and a
		// field it did not — which is only decidable once the two are merged, and only useful if that
		// happens before anything is written.

		it('should call the mapping beforeUpdate hook with the merged row, before saving it', async () => {
			const beforeUpdate = jest.fn().mockResolvedValue(undefined);

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeUpdate,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty));

			await channelsPropertiesService.update(mockChannelProperty.id, {
				type: 'mock',
				name: 'New name',
			} as UpdateMockChannelPropertyDto);

			expect(beforeUpdate).toHaveBeenCalledTimes(1);
			// The merged row: the field the PATCH sent, on the entity that was loaded from storage.
			expect((beforeUpdate.mock.calls[0][0] as MockChannelProperty).name).toBe('New name');
			expect((beforeUpdate.mock.calls[0][0] as MockChannelProperty).id).toBe(mockChannelProperty.id);
			expect(beforeUpdate.mock.invocationCallOrder[0]).toBeLessThan(
				(repository.save as jest.Mock).mock.invocationCallOrder[0],
			);
		});

		it('should leave the row untouched when the beforeUpdate hook rejects it', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannelProperty,
				createDto: CreateMockChannelPropertyDto,
				updateDto: UpdateMockChannelPropertyDto,
				beforeUpdate: jest.fn().mockRejectedValue(new DevicesValidationException('Merged row is not supported.')),
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty));

			await expect(
				channelsPropertiesService.update(mockChannelProperty.id, {
					type: 'mock',
					name: 'New name',
				} as UpdateMockChannelPropertyDto),
			).rejects.toThrow(DevicesValidationException);

			expect(repository.save).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a channel property', async () => {
			jest.spyOn(channelsService, 'getOneOrThrow').mockResolvedValue(toInstance(ChannelEntity, mockChannel));
			mockManager.findOne = jest.fn().mockResolvedValue(toInstance(MockChannelProperty, mockChannelProperty));

			jest.spyOn(mockManager, 'remove');

			await channelsPropertiesService.remove(mockChannelProperty.id);

			expect(mockManager.findOne).toHaveBeenCalledWith(ChannelPropertyEntity, {
				where: { id: mockChannelProperty.id },
			});
			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockChannelProperty, mockChannelProperty));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_PROPERTY_DELETED,
				toInstance(MockChannelProperty, mockChannelProperty),
			);
		});
	});
});
