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
import { ConnectionState, DeviceCategory, DeviceHiddenBy, DeviceHiddenFilter, EventType } from '../devices.constants';
import { DevicesException, DevicesNotAllowedException, DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

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
