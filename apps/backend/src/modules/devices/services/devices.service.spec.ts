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
import { ChannelCategory, ConnectionState, DeviceCategory, DeviceHiddenFilter, EventType } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
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
				getOne: jest.fn().mockResolvedValue(visibleDevice),
			};
			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(service.findVisibleSummaryById(mockDevice.id)).resolves.toEqual(visibleDevice);
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledTimes(1);
			expect(queryBuilderMock.leftJoinAndSelect).toHaveBeenCalledWith('device.deviceZones', 'deviceZones');
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
				service.findVisibleBoundedStateByChannelCategories([ChannelCategory.ALARM], 1, 10, 20),
			).resolves.toEqual({
				devices: [expect.objectContaining({ id: 'device-1' })],
				devicesTruncated: true,
				channelsTruncated: true,
				propertiesTruncated: true,
			});
			expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [ChannelCategory.ALARM, 2]);
			expect(channelsService.findBoundedForDevices).toHaveBeenCalledWith(['device-1'], [ChannelCategory.ALARM], 10);
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

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValueOnce(roomQuery).mockReturnValueOnce(zoneQuery);

			await expect(service.getVisibleSpaceCounts()).resolves.toEqual({
				rooms: { 'room-id': 12 },
				zones: { 'zone-id': 7 },
			});
			expect(roomQuery.getRawMany).toHaveBeenCalledTimes(1);
			expect(zoneQuery.getRawMany).toHaveBeenCalledTimes(1);
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
		// `enabled` is affected by the identical mechanism but is deliberately NOT asserted here: its
		// initializer is still in place, because three device plugins read `event.entity.enabled` in
		// `afterInsert` before the row is re-read. See the note on DeviceEntity.enabled — pre-existing,
		// tracked separately.
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
