/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return,
@typescript-eslint/no-unsafe-assignment
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
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	DeviceHiddenBy,
	DeviceHiddenFilter,
	EventType,
} from '../devices.constants';
import { DevicesException, DevicesNotAllowedException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceConnectionStateService } from './device-connection-state.service';
import { DeviceZonesService } from './device-zones.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesControlsService } from './devices.controls.service';
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

class CreateMockDeviceDto extends CreateDeviceDto {
	@Expose()
	@IsString()
	mock_value: string;
}

class UpdateMockDeviceDto extends UpdateDeviceDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

describe('DevicesService', () => {
	let service: DevicesService;
	let repository: Repository<DeviceEntity>;
	let spaceRepository: Repository<SpaceEntity>;
	let deviceZonesService: DeviceZonesService;
	let mapper: DevicesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: DataSource;
	let channelsService: jest.Mocked<ChannelsService>;
	let propertiesService: jest.Mocked<ChannelsPropertiesService>;

	const mockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		hidden: false,
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

	const mockManager: jest.Mocked<Partial<EntityManager>> = {
		findOneOrFail: jest.fn(),
		find: jest.fn(),
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
				DevicesService,
				{ provide: getRepositoryToken(DeviceEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(SpaceEntity), useFactory: mockRepository },
				{
					provide: DeviceZonesService,
					useValue: {
						setDeviceZones: jest.fn().mockResolvedValue([]),
						getDeviceZones: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: DevicesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockDevice,
							createDto: CreateMockDeviceDto,
							updateDto: UpdateMockDeviceDto,
						})),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						create: jest.fn(() => {}),
						findAll: jest.fn().mockResolvedValue([]),
						findBoundedForDevices: jest.fn().mockResolvedValue({ channels: [], deviceIds: {}, truncated: false }),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findBoundedForChannels: jest.fn().mockResolvedValue({ properties: [], totals: {} }),
					},
				},
				{
					provide: DevicesControlsService,
					useValue: {
						remove: jest.fn(() => {}),
					},
				},
				{
					provide: DeviceConnectionStateService,
					useValue: {
						write: jest.fn(() => {}),
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
			],
		}).compile();

		service = module.get<DevicesService>(DevicesService);
		repository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
		spaceRepository = module.get<Repository<SpaceEntity>>(getRepositoryToken(SpaceEntity));
		deviceZonesService = module.get<DeviceZonesService>(DeviceZonesService);
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<DataSource>(DataSource);
		channelsService = jest.mocked(module.get<ChannelsService>(ChannelsService));
		propertiesService = jest.mocked(module.get<ChannelsPropertiesService>(ChannelsPropertiesService));
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
		it('should return all devices', async () => {
			const mockDevices = [mockDevice];
			jest.spyOn(repository, 'find').mockResolvedValue(mockDevices.map((entity) => toInstance(MockDevice, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockDevices.map((entity) => toInstance(MockDevice, entity)));
			expect(repository.find).toHaveBeenCalledWith({
				relations: [
					'controls',
					'controls.device',
					'channels',
					'channels.device',
					'channels.controls',
					'channels.controls.channel',
					'channels.properties',
					'channels.properties.channel',
					'deviceZones',
				],
			});
		});

		it('returns only visible devices when hidden=false', async () => {
			const visibleDevice = toInstance(MockDevice, { ...mockDevice, hidden: false });

			jest.spyOn(repository, 'find').mockResolvedValue([visibleDevice]);

			const devices = await service.findAll(undefined, DeviceHiddenFilter.FALSE);

			expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { hidden: false } }));
			expect(devices.every((device) => !device.hidden)).toBe(true);
		});

		it('returns every device by default', async () => {
			const spy = jest.spyOn(repository, 'find').mockResolvedValue([]);

			await service.findAll();

			expect(spy).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
		});
	});

	describe('findVisibleSummaryPage', () => {
		it('bounds the query before loading device summaries', async () => {
			const visibleDevice = toInstance(MockDevice, { ...mockDevice, hidden: false });
			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([[visibleDevice], 12]),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(service.findVisibleSummaryPage(10, { roomIds: ['room-id'] })).resolves.toEqual({
				devices: [visibleDevice],
				total: 12,
			});
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledTimes(1);
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('device.deviceZones', 'deviceZones');
			expect(queryBuilderMock.take).toHaveBeenCalledWith(10);
			expect(queryBuilderMock.callListeners).toHaveBeenCalledWith(false);
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('device.roomId IN (:...roomIds)', {
				roomIds: ['room-id'],
			});
		});

		it('filters by one zone while hydrating all zone memberships', async () => {
			const visibleDevice = toInstance(MockDevice, { ...mockDevice, hidden: false });
			visibleDevice.deviceZones = [
				{ zoneId: 'selected-zone' },
				{ zoneId: 'other-zone' },
			] as typeof visibleDevice.deviceZones;
			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([[visibleDevice], 1]),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findVisibleSummaryPage(10, { zoneId: 'selected-zone' });

			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('device.deviceZones', 'deviceZones');
			expect(queryBuilderMock.innerJoin).toHaveBeenCalledWith(
				'device.deviceZones',
				'scopeDeviceZone',
				'scopeDeviceZone.zoneId = :zoneId',
				{ zoneId: 'selected-zone' },
			);
			expect(result.devices[0].zoneIds).toEqual(['selected-zone', 'other-zone']);
		});

		it('loads one visible device without channel relations', async () => {
			const visibleDevice = toInstance(MockDevice, { ...mockDevice, hidden: false });
			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(visibleDevice),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(service.findVisibleSummaryById(mockDevice.id)).resolves.toEqual(visibleDevice);
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledTimes(1);
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('device.deviceZones', 'deviceZones');
			expect(queryBuilderMock.callListeners).toHaveBeenCalledWith(false);
		});
	});

	describe('findVisibleBoundedStateByChannelCategories', () => {
		it('uses one extra device ID to report truncation without hydrating it', async () => {
			const visibleDevice = toInstance(MockDevice, { ...mockDevice, id: 'device-1', hidden: false });
			jest.spyOn(dataSource, 'query').mockResolvedValue([
				{ id: 'device-1', name: 'First' },
				{ id: 'device-2', name: 'Second' },
			]);
			const queryBuilderMock: any = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([visibleDevice]),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			channelsService.findBoundedForDevices.mockResolvedValue({
				channels: [{ id: 'channel-1', properties: [] } as any],
				deviceIds: { 'channel-1': 'device-1' },
				truncated: true,
			});
			propertiesService.findBoundedForChannels.mockResolvedValue({
				properties: [],
				totals: { 'channel-1': 21 },
			});

			await expect(
				service.findVisibleBoundedStateByChannelCategories([ChannelCategory.ALARM], 1, 10, 20, {
					roomIds: ['room-1'],
				}),
			).resolves.toEqual({
				devices: [expect.objectContaining({ id: 'device-1' })],
				devicesTruncated: true,
				channelsTruncated: true,
				propertiesTruncated: true,
			});
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('device."roomId" IN (?)'), [
				ChannelCategory.ALARM,
				'room-1',
				2,
			]);
			expect(channelsService.findBoundedForDevices).toHaveBeenCalledWith(['device-1'], [ChannelCategory.ALARM], 10);
			expect(propertiesService.findBoundedForChannels).toHaveBeenCalledWith(['channel-1'], 20, true, undefined);
		});
	});

	describe('getVisibleSpaceCounts', () => {
		it('uses grouped raw counts without hydrating device entities', async () => {
			const roomQuery: any = {
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ spaceId: 'room-id', deviceCount: '12' }]),
			};
			const zoneQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ spaceId: 'zone-id', deviceCount: 7 }]),
			};
			const floorQuery: any = {
				innerJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ spaceId: 'floor-id', deviceCount: '5' }]),
			};

			jest
				.spyOn(repository, 'createQueryBuilder')
				.mockReturnValueOnce(roomQuery)
				.mockReturnValueOnce(zoneQuery)
				.mockReturnValueOnce(floorQuery);

			await expect(service.getVisibleSpaceCounts()).resolves.toEqual({
				rooms: { 'room-id': 12 },
				zones: { 'zone-id': 7 },
				floors: { 'floor-id': 5 },
			});
			expect(roomQuery.getRawMany).toHaveBeenCalledTimes(1);
			expect(zoneQuery.getRawMany).toHaveBeenCalledTimes(1);
			expect(floorQuery.getRawMany).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a device if found', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, mockDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(mockDevice.id);

			expect(result).toEqual(toInstance(MockDevice, mockDevice));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('device.id = :id', { id: mockDevice.id });
		});

		it('should return null if the device is not found', async () => {
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
		});
	});

	describe('create', () => {
		// A nested create saves the device first, then its channels. When a child fails — a virtual
		// property whose source cannot fill its slot, say — the device must not survive as a half-built
		// row, and the children that already announced themselves must have their deletions announced
		// too, or websocket clients keep ghosts.
		it('rolls the device back and announces the children when a nested channel fails', async () => {
			const createDto: CreateMockDeviceDto = {
				type: 'mock',
				category: DeviceCategory.GENERIC,
				name: 'Half-built device',
				mock_value: 'Random text',
			};

			const createdDeviceId = uuid().toString();
			const orphanedProperty = { id: uuid().toString() };
			const orphanedChannel = { id: uuid().toString(), properties: [orphanedProperty] };

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});
			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);
			jest.spyOn(repository, 'create').mockReturnValue({ id: createdDeviceId } as MockDevice);
			jest.spyOn(repository, 'save').mockResolvedValue({ id: createdDeviceId } as MockDevice);

			channelsService.create.mockRejectedValue(new DevicesValidationException('Source cannot fill this slot'));
			channelsService.findAll.mockResolvedValue([orphanedChannel] as never);

			await expect(
				service.create({
					...createDto,
					channels: [{ type: 'mock', category: ChannelCategory.GENERIC, name: 'Generic' }],
				} as never),
			).rejects.toThrow('Source cannot fill this slot');

			expect(repository.delete).toHaveBeenCalledWith(createdDeviceId);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_PROPERTY_DELETED, orphanedProperty);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.CHANNEL_DELETED, orphanedChannel);
			expect(eventEmitter.emit).not.toHaveBeenCalledWith(EventType.DEVICE_CREATED, expect.anything());
		});

		it('should create and return a new device', async () => {
			const createDto: CreateMockDeviceDto = {
				type: 'mock',
				category: DeviceCategory.GENERIC,
				name: 'New device',
				mock_value: 'Random text',
			};
			const mockCrateDevice: Partial<MockDevice> = {
				type: createDto.type,
				category: createDto.category,
				name: createDto.name,
				mockValue: createDto.mock_value,
			};
			const mockCratedDevice = {
				id: uuid().toString(),
				type: mockCrateDevice.type,
				category: mockCrateDevice.category,
				identifier: mockCrateDevice.identifier,
				name: mockCrateDevice.name,
				description: mockCrateDevice.description,
				enabled: mockCrateDevice.enabled,
				roomId: null,
				room: null,
				deviceZones: [],
				status: mockCrateDevice.status,
				createdAt: new Date(),
				updatedAt: null,
				controls: [],
				channels: [],
				mockValue: mockCrateDevice.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(MockDevice, mockCratedDevice));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, mockCratedDevice));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, mockCratedDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.create(createDto);

			expect(result).toEqual(toInstance(MockDevice, mockCratedDevice));
			expect(repository.create).toHaveBeenCalledWith(toInstance(MockDevice, mockCrateDevice));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockDevice, mockCratedDevice));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('device.id = :id', { id: mockCratedDevice.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_CREATED,
				toInstance(MockDevice, mockCratedDevice),
			);
		});

		it('should throw DevicesException if the device type is not provided', async () => {
			const createDto: Partial<CreateDeviceDto> = {
				category: DeviceCategory.GENERIC,
				name: 'New device',
			};

			await expect(service.create(createDto as CreateMockDeviceDto)).rejects.toThrow(DevicesException);
		});
	});

	describe('update', () => {
		it('should update and return the device', async () => {
			const updateDto: UpdateMockDeviceDto = {
				type: 'mock',
				name: 'Updated device',
				mock_value: 'Changed text',
			};
			const mockUpdateDevice = {
				id: mockDevice.id,
				type: mockDevice.type,
				category: mockDevice.category,
				identifier: mockDevice.identifier,
				name: updateDto.name,
				description: mockDevice.description,
				enabled: mockDevice.enabled,
				// Carried over from the loaded device rather than reset: `hidden` is absent from the
				// update DTO, so nothing in the patch may touch it. DeviceEntity.hidden deliberately
				// carries no class field initializer for exactly this reason — with one,
				// `omitBy(toInstance(...), isUndefined)` produced `hidden: false` for every PATCH and
				// silently un-hid the device on the next unrelated edit.
				hidden: mockDevice.hidden,
				roomId: null,
				room: null,
				deviceZones: [],
				status: mockDevice.status,
				controls: mockDevice.controls,
				channels: mockDevice.channels,
				createdAt: mockDevice.createdAt,
				updatedAt: mockDevice.updatedAt,
				mockValue: updateDto.mock_value,
			};
			const mockUpdatedDevice = {
				id: mockUpdateDevice.id,
				type: mockUpdateDevice.type,
				category: mockUpdateDevice.category,
				identifier: mockUpdateDevice.identifier,
				name: mockUpdateDevice.name,
				description: mockUpdateDevice.description,
				enabled: mockUpdateDevice.enabled,
				hidden: mockUpdateDevice.hidden,
				roomId: null,
				room: null,
				deviceZones: [],
				status: mockUpdateDevice.status,
				createdAt: mockUpdateDevice.createdAt,
				updatedAt: new Date(),
				controls: mockUpdateDevice.controls,
				channels: mockUpdateDevice.channels,
				mockValue: mockUpdateDevice.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockDevice, mockDevice))
					.mockResolvedValueOnce(toInstance(MockDevice, mockUpdatedDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, mockUpdatedDevice));

			const result = await service.update(mockDevice.id, updateDto);

			expect(result).toEqual(toInstance(MockDevice, mockUpdatedDevice));
			expect(repository.save).toHaveBeenCalledWith(toInstance(MockDevice, mockUpdateDevice));
			expect(queryBuilderMock.where).toHaveBeenCalledWith('device.id = :id', { id: mockDevice.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_UPDATED,
				toInstance(MockDevice, mockUpdatedDevice),
			);
		});

		// Regression test. `hidden` is what marks a physical device as replaced by a virtual one, and
		// nothing else in the system ever re-sets it — so a PATCH that silently reverts it to `false`
		// makes the flag unusable in practice: the first unrelated edit (a rename, a room change) undoes
		// it. The mechanism is class-transformer building its target with `new Target()`, which runs
		// class field initializers before any source value is copied; the initializer's value then
		// survives `omitBy(..., isUndefined)` and gets written back by `Object.assign`. Asserted against
		// `save`, not the returned entity, because the return value is re-read from the database and
		// would hide the clobber.
		//
		// `enabled` is affected by the identical mechanism and is covered separately below. Its
		// initializer (unlike `hidden`'s) is intentionally still in place — three device plugins'
		// `afterInsert` subscribers read `event.entity.enabled` before the row is re-read — so this could
		// only be fixed on the update() side, by restricting `updateFields` to properties the PATCH
		// actually carried, not by dropping the initializer. See the note on DeviceEntity.enabled and the
		// comment at the `updateFields` computation in DevicesService.update().
		it('does not reset hidden when the patch does not mention it', async () => {
			const hiddenDevice = { ...mockDevice, hidden: true };

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, hiddenDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, hiddenDevice));

			await service.update(hiddenDevice.id, { type: 'mock', name: 'Renamed' } as UpdateMockDeviceDto);

			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ hidden: true }));
		});

		it('applies hidden when the patch does set it', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, mockDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, { ...mockDevice, hidden: true }));

			await service.update(mockDevice.id, { type: 'mock', hidden: true } as UpdateMockDeviceDto);

			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ hidden: true }));
		});

		// Regression test for the same class-field-initializer mechanism as `hidden` above, now proven
		// for `enabled`. DeviceEntity.enabled's initializer is intentionally still in place (see the note
		// on DeviceEntity.enabled), so unlike `hidden` this could not be fixed by dropping it — update()
		// instead restricts `updateFields` to properties dtoInstance actually carried. Asserted against
		// `save`, not the returned entity, for the same reason as the `hidden` test above.
		it('does not reset enabled when the patch does not mention it', async () => {
			const disabledDevice = { ...mockDevice, enabled: false };

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, disabledDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, disabledDevice));

			await service.update(disabledDevice.id, { type: 'mock', name: 'Renamed' } as UpdateMockDeviceDto);

			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
		});

		// Symmetric with the `hidden` coverage: a patch that genuinely carries `enabled` must still apply
		// it, including flipping it to the falsy `false` — the exact value `omitBy(..., isUndefined)`
		// must not be tricked into treating as "absent".
		it('applies enabled when the patch does set it, including a falsy false', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, mockDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(MockDevice, { ...mockDevice, enabled: false }));

			await service.update(mockDevice.id, { type: 'mock', enabled: false } as UpdateMockDeviceDto);

			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
		});

		// Confirms hidden_by round-trips through a PATCH that sets it alongside hidden, symmetric with
		// the `hidden` coverage above. Asserted against `save`'s argument, not the returned entity — the
		// returned value comes from a second, independently-mocked `getOne()` and would equal whatever
		// literal that mock is configured with regardless of what update() actually computed from the
		// DTO, which is exactly the blind spot the `leaves hiddenBy untouched...` test below documents.
		it('persists hiddenBy alongside hidden', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const updatedDevice = toInstance(MockDevice, { ...mockDevice, hidden: true, hiddenBy: DeviceHiddenBy.SYSTEM });

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(MockDevice, mockDevice))
					.mockResolvedValueOnce(updatedDevice),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(updatedDevice);

			await service.update(mockDevice.id, {
				type: 'mock',
				hidden: true,
				hidden_by: DeviceHiddenBy.SYSTEM,
			} as UpdateMockDeviceDto);

			expect(repository.save).toHaveBeenCalledWith(
				expect.objectContaining({ hidden: true, hiddenBy: DeviceHiddenBy.SYSTEM }),
			);
		});

		// Regression test, pinning the class-field-initializer trap that shipped twice on the predecessor
		// branch (see the note on `hidden` above for the mechanism). `getOne` is backed by a single shared
		// `persisted` reference here, instead of the hand-written literals the other tests in this block
		// use for the post-save fetch, specifically so the second update's *returned* value reflects
		// whatever `Object.assign(device, updateFields)` actually produced on that same object. A
		// hand-written literal for the post-save fetch would assert against a fiction and pass
		// unconditionally regardless of what update() really did — the same blind spot the comment on the
		// `does not reset hidden...` test above avoids by asserting on `save`'s argument instead; this test
		// gets the same guarantee a different way, by making the "database" one mutable object so the
		// return value cannot help but reflect a clobber.
		it('leaves hiddenBy untouched by an unrelated patch', async () => {
			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			const persisted = toInstance(MockDevice, mockDevice);

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(persisted),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'save').mockResolvedValue(persisted);

			await service.update(mockDevice.id, {
				type: 'mock',
				hidden: true,
				hidden_by: DeviceHiddenBy.USER,
			} as UpdateMockDeviceDto);

			const device = await service.update(mockDevice.id, { type: 'mock', name: 'Renamed' } as UpdateMockDeviceDto);

			expect(device.hiddenBy).toBe(DeviceHiddenBy.USER);
		});

		// A hidden device is one a virtual device has replaced, so its placement is the virtual device's
		// to own — the physical device keeps the room it had, and energy attribution keeps following it.
		//
		// The guard is on *mutation*, not on state. Hiding deliberately preserves the stored room so
		// unhiding restores it, and the virtual-device split flow places the parent device *before* it
		// hides it — a guard keyed on "is hidden and has a room" would break that flow. Only a patch
		// that itself carries `room_id` / `zone_ids` is refused.
		//
		// Enforced in the service rather than as a `class-validator` constraint on `UpdateDeviceDto`,
		// because the decision needs the *stored* device and a DTO constraint never sees the `:id` route
		// parameter — `ValidationArguments` exposes only `{ value, constraints, targetName, object,
		// property }`, where `object` is the DTO built from the request body alone.
		describe('placement changes on a hidden device', () => {
			const roomId = uuid().toString();
			const zoneId = uuid().toString();

			// Same arrangement the tests above spell out inline: one mapped device standing in for the row
			// `getOneOrThrow()` loads, shared with the post-save fetch so `save`'s argument and the returned
			// entity cannot disagree.
			const arrangeDevice = (overrides: Record<string, unknown>): MockDevice => {
				jest.spyOn(mapper, 'getMapping').mockReturnValue({
					type: 'mock',
					class: MockDevice,
					createDto: CreateMockDeviceDto,
					updateDto: UpdateMockDeviceDto,
				});

				jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

				const persisted = toInstance(MockDevice, { ...mockDevice, ...overrides });

				const queryBuilderMock: any = {
					innerJoinAndSelect: jest.fn().mockReturnThis(),
					leftJoinAndSelect: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					getOne: jest.fn().mockResolvedValue(persisted),
				};

				jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
				jest.spyOn(repository, 'save').mockResolvedValue(persisted);

				return persisted;
			};

			beforeEach(() => {
				// `validateRoomAssignment()` resolves the target space; every room referenced here is a room.
				jest.spyOn(spaceRepository, 'findOne').mockResolvedValue({ id: roomId, type: SpaceType.ROOM } as SpaceEntity);
			});

			it('allows a room change on a visible device', async () => {
				arrangeDevice({ hidden: false });

				await service.update(mockDevice.id, { type: 'mock', room_id: roomId } as UpdateMockDeviceDto);

				expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ roomId }));
			});

			it('refuses a room change on a hidden device', async () => {
				arrangeDevice({ hidden: true });

				await expect(
					service.update(mockDevice.id, { type: 'mock', room_id: roomId } as UpdateMockDeviceDto),
				).rejects.toThrow(DevicesNotAllowedException);

				expect(repository.save).not.toHaveBeenCalled();
			});

			// Clearing the room is a placement change too — `null` is a value, not an absent field.
			it('refuses clearing the room on a hidden device', async () => {
				arrangeDevice({ hidden: true, roomId });

				await expect(
					service.update(mockDevice.id, { type: 'mock', room_id: null } as UpdateMockDeviceDto),
				).rejects.toThrow(DevicesNotAllowedException);

				expect(repository.save).not.toHaveBeenCalled();
			});

			it('refuses a zone change on a hidden device', async () => {
				arrangeDevice({ hidden: true });

				await expect(
					service.update(mockDevice.id, { type: 'mock', zone_ids: [zoneId] } as UpdateMockDeviceDto),
				).rejects.toThrow(DevicesNotAllowedException);

				expect(repository.save).not.toHaveBeenCalled();
				expect(deviceZonesService.setDeviceZones).not.toHaveBeenCalled();
			});

			it('allows a zone change on a visible device', async () => {
				arrangeDevice({ hidden: false });

				await service.update(mockDevice.id, { type: 'mock', zone_ids: [zoneId] } as UpdateMockDeviceDto);

				expect(deviceZonesService.setDeviceZones).toHaveBeenCalledWith(mockDevice.id, [zoneId]);
			});

			// Load-bearing: hiding a device is itself a PATCH, and it must not be refused by its own guard.
			it('allows a patch that does not touch placement on a hidden device', async () => {
				arrangeDevice({ hidden: true });

				await service.update(mockDevice.id, { type: 'mock', name: 'Renamed' } as UpdateMockDeviceDto);

				expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
			});

			// The split flow itself: the parent device is placed in a room first, then hidden. The stored
			// room survives the hide untouched so unhiding restores it.
			it('allows hiding a device that already has a room', async () => {
				arrangeDevice({ hidden: false, roomId });

				await service.update(mockDevice.id, { type: 'mock', hidden: true } as UpdateMockDeviceDto);

				expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ hidden: true, roomId }));
			});

			// The placement fields carry their own `@IsUUID` on `UpdateDeviceDto`, and every plugin update
			// DTO inherits that stack. Pinned here because `class-validator` *replaces* rather than merges a
			// redeclared property's decorators — anything that later restates `room_id` / `zone_ids` on the
			// DTO (or on a subclass) silently drops the UUID check, and nothing else would notice.
			it('still rejects an invalid room_id', async () => {
				arrangeDevice({ hidden: false });

				await expect(
					service.update(mockDevice.id, { type: 'mock', room_id: 'not-a-uuid' } as UpdateMockDeviceDto),
				).rejects.toThrow(DevicesValidationException);

				expect(repository.save).not.toHaveBeenCalled();
			});

			it('still rejects an invalid zone id', async () => {
				arrangeDevice({ hidden: false });

				await expect(
					service.update(mockDevice.id, { type: 'mock', zone_ids: ['not-a-uuid'] } as UpdateMockDeviceDto),
				).rejects.toThrow(DevicesValidationException);

				expect(repository.save).not.toHaveBeenCalled();
			});
		});
	});

	describe('remove', () => {
		it('should remove a device', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(MockDevice, mockDevice)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(mockManager, 'findOneOrFail').mockResolvedValue(toInstance(MockDevice, mockDevice));
			jest.spyOn(mockManager, 'find').mockResolvedValue([]);

			jest.spyOn(mockManager, 'remove');

			await service.remove(mockDevice.id);

			expect(mockManager.remove).toHaveBeenCalledWith(toInstance(MockDevice, mockDevice));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.DEVICE_DELETED, toInstance(MockDevice, mockDevice));
		});
	});
});
