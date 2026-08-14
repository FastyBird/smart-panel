/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString, useContainer } from 'class-validator';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { DevicesException, DevicesValidationException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';
import { DeviceExistsConstraintValidator } from '../validators/device-exists-constraint.validator';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';

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
	let channelsPropertiesService: ChannelsPropertiesService;

	const mockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		roomId: null,
		room: null,
		deviceZones: [],
		status: {
			online: false,
			status: ConnectionState.UNKNOWN,
		},
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
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice.id,
		parentId: null,
		parent: null,
		children: [],
		controls: [],
		properties: [],
		mockValue: 'Some value',
	};

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		find: jest.fn(),
		remove: jest.fn(),
		update: jest.fn(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			// Rows are inserted rather than saved, so a client-supplied id that already exists collides on
			// the primary key instead of quietly turning the create into an update.
			insert: jest.fn().mockResolvedValue({ identifiers: [{}], generatedMaps: [], raw: [] }),
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
				DeviceStructureLockService,
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
					provide: ChannelsPropertiesService,
					useValue: {
						create: jest.fn(() => {}),
						// Reached by the rollback below: the properties created before a nested failure are
						// read back and removed one by one, which is what answers the creations they already
						// announced.
						findAll: jest.fn().mockResolvedValue([]),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsControlsService,
					useValue: {
						remove: jest.fn(() => {}),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
						query: jest.fn(),
						manager: mockManager,
						transaction: jest.fn(async (cb: (m: any) => any) => await cb(mockManager)),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findOne: jest.fn().mockReturnValue(mockDevice),
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
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
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

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue(mockChannels.map((entity) => toInstance(MockChannel, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findAll();

			expect(result).toEqual(mockChannels.map((entity) => toInstance(MockChannel, entity)));
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('channel');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('channel.device', 'device');
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findSummaryPage', () => {
		it('applies the channel cap before hydration', async () => {
			const queryBuilderMock: any = {
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([[mockChannel], 25]),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(service.findSummaryPage(mockDevice.id, 20)).resolves.toEqual({
				channels: [mockChannel],
				total: 25,
			});
			expect(queryBuilderMock.innerJoin).toHaveBeenCalledWith('channel.device', 'device');
			expect(queryBuilderMock.orderBy).toHaveBeenCalledWith('channel.name', 'ASC');
			expect(queryBuilderMock.take).toHaveBeenCalledWith(20);
		});
	});

	describe('findBoundedForDevices', () => {
		it('caps channel IDs per device before hydrating entities', async () => {
			jest.spyOn(dataSource, 'query').mockResolvedValue([
				{ id: mockChannel.id, deviceId: mockDevice.id, rowNumber: 1 },
				{ id: 'truncated-channel', deviceId: mockDevice.id, rowNumber: 2 },
			]);
			const queryBuilderMock: any = {
				where: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockChannel]),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(service.findBoundedForDevices([mockDevice.id], [ChannelCategory.ALARM], 1)).resolves.toEqual({
				channels: [mockChannel],
				deviceIds: { [mockChannel.id]: mockDevice.id },
				truncated: true,
			});
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('ROW_NUMBER() OVER'), [
				mockDevice.id,
				ChannelCategory.ALARM,
				2,
			]);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id IN (:...channelIds)', {
				channelIds: [mockChannel.id],
			});
		});
	});

	describe('findOne', () => {
		it('should return a channel if found', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannel, mockChannel)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(mockChannel.id);

			expect(result).toEqual(toInstance(MockChannel, mockChannel));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :id', { id: mockChannel.id });
		});

		it('should return null if the channel is not found', async () => {
			const id = uuid().toString();

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(id);

			expect(result).toEqual(null);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :id', { id });
		});
	});

	describe('create', () => {
		// `id` is client-suppliable, and `save()` treats a row whose primary key exists as an *update*: a
		// create carrying an existing id moved that channel under this device, and `DevicesService`'s
		// rollback then removed it as one of its own — a malformed request destroying a channel it had
		// nothing to do with.
		it('refuses a create naming a channel id that already exists, before anything is written', async () => {
			const takenId = uuid().toString();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannel,
				createDto: CreateMockChannelDto,
				updateDto: UpdateMockChannelDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue({ id: takenId } as MockChannel);
			jest.spyOn(repository, 'findOne').mockResolvedValue({ id: takenId } as ChannelEntity);

			await expect(
				service.create({
					id: takenId,
					type: 'mock',
					category: ChannelCategory.GENERIC,
					name: 'Colliding channel',
					device: uuid().toString(),
					mock_value: 'Some value',
				} as CreateMockChannelDto),
			).rejects.toThrow(DevicesValidationException);

			expect(repository.insert).not.toHaveBeenCalled();
			expect(repository.save).not.toHaveBeenCalled();
		});

		// The check above closes the collision only for a caller who is alone: two requests carrying the
		// same client-generated uuid can both pass it before either writes. `insert()` always issues an
		// INSERT, so the primary key decides, and the refusal reads the same from the caller's side.
		it('reports a concurrent duplicate channel id as the same refusal the check gives', async () => {
			const takenId = uuid().toString();

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannel,
				createDto: CreateMockChannelDto,
				updateDto: UpdateMockChannelDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue({ id: takenId } as MockChannel);
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);
			jest
				.spyOn(repository, 'insert')
				.mockRejectedValue(Object.assign(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: channels.id')));

			await expect(
				service.create({
					id: takenId,
					type: 'mock',
					category: ChannelCategory.GENERIC,
					name: 'Colliding channel',
					device: uuid().toString(),
					mock_value: 'Some value',
				} as CreateMockChannelDto),
			).rejects.toThrow(DevicesValidationException);
		});

		// One request, one outcome. A property rejected halfway used to leave the channel and the
		// properties before it behind, with the caller told the whole thing failed — a retry then walked
		// into its own leftovers, and a client that had heard the earlier properties announce themselves
		// held children of a channel it was never told about, since CHANNEL_CREATED is emitted only after
		// a creation completes.
		it('rolls the channel back when a nested property fails', async () => {
			const channelId = uuid().toString();
			const deviceId = uuid().toString();
			const built = { id: channelId, type: 'mock' } as MockChannel;
			const alreadyCreated = { id: 'created-property' } as ChannelPropertyEntity;

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockChannel,
				createDto: CreateMockChannelDto,
				updateDto: UpdateMockChannelDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue(built);
			// Null first: that read is the client-supplied-id collision check, which must find nothing.
			// The next one is the rollback re-reading the row it is about to remove.
			jest.spyOn(repository, 'findOne').mockResolvedValueOnce(null).mockResolvedValue(built);

			(channelsPropertiesService.create as jest.Mock)
				.mockResolvedValueOnce(alreadyCreated)
				.mockRejectedValueOnce(new DevicesValidationException('incompatible projection'));
			(channelsPropertiesService.findAll as jest.Mock).mockResolvedValue([alreadyCreated]);

			await expect(
				service.create({
					type: 'mock',
					category: ChannelCategory.GENERIC,
					name: 'Half-built channel',
					device: deviceId,
					mock_value: 'Random text',
					properties: [
						{
							type: 'mock',
							category: PropertyCategory.GENERIC,
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.UNKNOWN,
						},
						{
							type: 'mock',
							category: PropertyCategory.GENERIC,
							permissions: [PermissionType.READ_ONLY],
							data_type: DataTypeType.UNKNOWN,
						},
					],
				} as unknown as CreateMockChannelDto),
			).rejects.toThrow('incompatible projection');

			// The property created before the failure is removed through its own service — its stored
			// values live outside its row, and that removal announces its deletion.
			expect(channelsPropertiesService.remove).toHaveBeenCalledWith('created-property');
			// And the channel itself goes, as an entity rather than a raw row.
			expect(repository.remove).toHaveBeenCalledWith(built);
			// Never announced: it had not announced its creation either.
			expect(eventEmitter.emit).not.toHaveBeenCalledWith(EventType.CHANNEL_DELETED, expect.anything());
		});

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
				device: createDto.device,
				mockValue: createDto.mock_value,
			};
			const mockCreatedChannel: MockChannel = {
				id: uuid().toString(),
				type: mockCreateChannel.type,
				category: mockCreateChannel.category,
				identifier: mockCreateChannel.identifier,
				name: mockCreateChannel.name,
				description: mockCreateChannel.description,
				device: mockCreateChannel.device,
				parentId: null,
				parent: null,
				children: [],
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

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(ChannelEntity, mockCreatedChannel));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelEntity, mockCreatedChannel));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockChannel, mockCreatedChannel)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.create(createDto);

			expect(result).toEqual(toInstance(MockChannel, mockCreatedChannel));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockChannel, mockCreateChannel));
			// Inserted, not saved: `save()` would treat a client-supplied id that already exists as an update.
			expect(repository.insert).toHaveBeenCalledWith(toInstance(ChannelEntity, mockCreatedChannel));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :id', { id: mockCreatedChannel.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_CREATED,
				toInstance(MockChannel, mockCreatedChannel),
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
				identifier: mockChannel.identifier,
				name: updateDto.name,
				description: mockChannel.description,
				device: mockChannel.device,
				parentId: mockChannel.parentId,
				parent: mockChannel.parent,
				children: mockChannel.children,
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
				identifier: mockUpdateChannel.identifier,
				name: mockUpdateChannel.name,
				description: mockUpdateChannel.description,
				device: mockUpdateChannel.device,
				parentId: mockUpdateChannel.parentId,
				parent: mockUpdateChannel.parent,
				children: mockUpdateChannel.children,
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

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockChannel, mockChannel))
					.mockResolvedValueOnce(toInstance(MockChannel, mockUpdatedChannel)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(ChannelEntity, mockUpdatedChannel));

			const result = await service.update(mockChannel.id, updateDto);

			expect(result).toEqual(toInstance(MockChannel, mockUpdatedChannel));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockChannel, mockUpdateChannel));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('channel.id = :id', { id: mockChannel.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CHANNEL_UPDATED,
				toInstance(MockChannel, mockUpdatedChannel),
			);
		});
	});

	describe('remove', () => {
		it('should remove a channel', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(toInstance(MockChannel, mockChannel));

			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(MockChannel, mockChannel));
			jest.spyOn(mockManager, 'find').mockResolvedValue([]);

			jest.spyOn(mockManager, 'remove');

			await service.remove(mockChannel.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockChannel, mockChannel));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_DELETED, toInstance(MockChannel, mockChannel));
		});
	});
});
