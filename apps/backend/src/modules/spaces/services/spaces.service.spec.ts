/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource, Repository, SelectQueryBuilder, UpdateResult } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CreateHomeControlSpaceDto } from '../../../plugins/spaces-home-control/dto/create-home-control-space.dto';
import { UpdateHomeControlSpaceDto } from '../../../plugins/spaces-home-control/dto/update-home-control-space.dto';
import { RoomSpaceEntity } from '../../../plugins/spaces-home-control/entities/room-space.entity';
import { ZoneSpaceEntity } from '../../../plugins/spaces-home-control/entities/zone-space.entity';
import { DevicesNotAllowedException } from '../../devices/devices.exceptions';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DeviceZonesService } from '../../devices/services/device-zones.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceRoomCategory, SpaceType, SpaceZoneCategory } from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';

import { SpacesTypeMapperService } from './spaces-type-mapper.service';
import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
	let service: SpacesService;
	let spaceRepository: jest.Mocked<Repository<SpaceEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;
	let deviceZonesService: DeviceZonesService;
	let displayRepository: jest.Mocked<Repository<DisplayEntity>>;
	let devicesService: { findVisibleSummaryPage: jest.Mock };
	let platformRegistryService: { list: jest.Mock };
	let deviceConnectionStateService: { readLatestMany: jest.Mock };
	// DataSource mock is hoisted so individual tests can stub `query()` — used
	// by `SpacesService.update()` to read the raw `category` column straight
	// from the shared STI table (ignoring subtype hydration).
	let dataSourceQueryMock: jest.Mock;
	let deviceRepositoryStub: {
		find: jest.Mock;
		createQueryBuilder: jest.Mock;
		manager: { transaction: jest.Mock };
	};
	let mockQueryBuilder: {
		update: jest.Mock;
		set: jest.Mock;
		where: jest.Mock;
		// The bulk placement writes carry the visibility condition in the statement itself, so the builder
		// chain has one more link than it used to.
		andWhere: jest.Mock;
		execute: jest.Mock;
		getCount: jest.Mock;
	};

	const mockSpace = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		category: null,
		icon: 'mdi:sofa',
		displayOrder: 0,
		suggestionsEnabled: true,
		statusWidgets: null,
		lastActivityAt: null,
		parentId: null,
		parent: null,
		children: [],
		createdAt: new Date(),
		updatedAt: null,
	} as unknown as SpaceEntity;

	beforeEach(async () => {
		devicesService = {
			findVisibleSummaryPage: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
		};
		platformRegistryService = {
			list: jest.fn().mockReturnValue(['test-light']),
		};
		deviceConnectionStateService = {
			readLatestMany: jest.fn().mockResolvedValue(new Map()),
		};
		// The bulk placement writes run inside a transaction so a refusal rolls the statement back. The
		// callback's manager delegates to this same stub's `createQueryBuilder` *at call time*, so a test
		// that swaps in its own builder (see `arrangeDeviceWrite`) still sees its own `affected` count.
		deviceRepositoryStub = {
			find: jest.fn().mockResolvedValue([]),
			createQueryBuilder: jest.fn(() => mockQueryBuilder),
			manager: {
				transaction: jest.fn(async (run: (m: { createQueryBuilder: () => unknown }) => Promise<number>) =>
					run({ createQueryBuilder: () => deviceRepositoryStub.createQueryBuilder() as unknown }),
				),
			},
		};

		mockQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 0 } as UpdateResult),
			// The bulk placement writes ask about the hidden rows directly rather than inferring them from
			// the count the statement affected, so the builder answers a count too. Nothing hidden by
			// default.
			getCount: jest.fn().mockResolvedValue(0),
		};
		dataSourceQueryMock = jest.fn().mockResolvedValue([{ category: null }]);

		const spaceRepositoryMock = {
			find: jest.fn().mockResolvedValue([mockSpace]),
			findOne: jest.fn().mockResolvedValue(mockSpace),
			save: jest.fn().mockResolvedValue(mockSpace),
			create: jest
				.fn()
				.mockImplementation((data: Partial<SpaceEntity>) => ({ ...data, id: mockSpace.id }) as SpaceEntity),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
			// The type-change raw UPDATE path whitelists keys against the entity's column
			// metadata. Supply the set of known column property names the production
			// entity has so filtering passes through the fields these tests actually send.
			metadata: {
				columns: [
					'name',
					'description',
					'category',
					'parentId',
					'icon',
					'displayOrder',
					'suggestionsEnabled',
					'statusWidgets',
					'lastActivityAt',
				].map((propertyName) => ({ propertyName })),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpacesService,
				{
					provide: getRepositoryToken(SpaceEntity),
					useValue: spaceRepositoryMock,
				},
				{
					provide: getRepositoryToken(DeviceEntity),
					useValue: deviceRepositoryStub,
				},
				{
					provide: getRepositoryToken(DisplayEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([]),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
				},
				{
					provide: DataSource,
					useValue: {
						// SpacesService.create now resolves a subtype-specific repository via
						// dataSource.getRepository(mapping.class). Route those calls back to the
						// same mocked SpaceEntity repo so the existing assertions still apply.
						getRepository: jest.fn().mockImplementation(() => spaceRepositoryMock),
						// `update()` reads the raw `category` column via dataSource.query() to
						// ground the compat check in the real stored value (ignoring subtype
						// hydration). Default to `null` — individual tests can override via
						// `dataSourceQueryMock.mockResolvedValueOnce([{ category: '...' }])`
						// to simulate a legacy row.
						query: dataSourceQueryMock,
						// The type-change raw UPDATE path wraps the QueryBuilder.update() and
						// the subsequent reload in a DataSource.transaction(...). The
						// transactional manager exposes `createQueryBuilder` and `findOne` —
						// delegate both back to the same mocked repository so existing
						// findOne.mockResolvedValueOnce(...) chains continue to drive the reload.
						transaction: jest.fn().mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) =>
							cb({
								createQueryBuilder: () => mockQueryBuilder,
								findOne: (...args: unknown[]): unknown => spaceRepositoryMock.findOne(...(args as [never])),
								remove: jest.fn().mockResolvedValue(undefined),
								save: jest.fn().mockResolvedValue(mockSpace),
							}),
						),
						createQueryRunner: jest.fn().mockReturnValue({
							connect: jest.fn(),
							startTransaction: jest.fn(),
							commitTransaction: jest.fn(),
							rollbackTransaction: jest.fn(),
							release: jest.fn(),
							manager: {
								save: jest.fn().mockResolvedValue(mockSpace),
								update: jest.fn().mockResolvedValue({ affected: 1 }),
							},
						}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: DeviceZonesService,
					useValue: {
						getDeviceZones: jest.fn().mockResolvedValue([]),
						getZoneDevices: jest.fn().mockResolvedValue([]),
						setDeviceZones: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: DevicesService,
					useValue: devicesService,
				},
				{
					provide: PlatformRegistryService,
					useValue: platformRegistryService,
				},
				{
					provide: DeviceConnectionStateService,
					useValue: deviceConnectionStateService,
				},
				SpacesTypeMapperService,
			],
		}).compile();

		service = module.get<SpacesService>(SpacesService);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
		deviceZonesService = module.get<DeviceZonesService>(DeviceZonesService);
		displayRepository = module.get(getRepositoryToken(DisplayEntity));

		// Pre-register built-in space types (normally done by SpacesModule.onModuleInit).
		// Use the real plugin DTOs so validation accepts the subtype-specific
		// fields (category / suggestions_enabled / status_widgets) that live on
		// `CreateHomeControlSpaceDto` / `UpdateHomeControlSpaceDto`.
		const typeMapper = module.get<SpacesTypeMapperService>(SpacesTypeMapperService);
		// Include `subtypeColumns` to mirror the real plugin registration —
		// `SpacesService.update()` reads this map to decide whether the target
		// subtype carries category (and what wipe value to write for each
		// column on type change). Wipe values must match the `@Column({
		// default: ... })` defaults on the concrete entity so NOT NULL
		// columns don't get nulled out.
		const HOME_CONTROL_SUBTYPE_COLUMNS = {
			category: null,
			suggestionsEnabled: true,
			statusWidgets: null,
		} as const;
		typeMapper.registerMapping({
			type: SpaceType.ROOM,
			class: RoomSpaceEntity,
			createDto: CreateHomeControlSpaceDto,
			updateDto: UpdateHomeControlSpaceDto,
			subtypeColumns: HOME_CONTROL_SUBTYPE_COLUMNS,
		});
		typeMapper.registerMapping({
			type: SpaceType.ZONE,
			class: ZoneSpaceEntity,
			createDto: CreateHomeControlSpaceDto,
			updateDto: UpdateHomeControlSpaceDto,
			subtypeColumns: HOME_CONTROL_SUBTYPE_COLUMNS,
		});
		// A synthetic singleton type used in the singleton-enforcement test below.
		// Mirrors how spaces-synthetic-master / spaces-synthetic-entry plugins
		// register their mappings, but scoped to the test suite so the core spec
		// doesn't need to import plugin code. Master/entry DTOs only accept the
		// generic base fields — use the core `CreateSpaceDto` / `UpdateSpaceDto`
		// shape.
		typeMapper.registerMapping({
			type: 'master' as SpaceType,
			class: RoomSpaceEntity, // subtype class doesn't matter for the guard
			createDto: CreateSpaceDto,
			updateDto: UpdateSpaceDto,
			singleton: true,
		});
		// A non-singleton non-home-control type stand-in used by the
		// legacy-category bypass tests below. Signage-like: entity class is
		// irrelevant (subtype hydration doesn't declare `category`), DTOs are
		// the generic base. The key property is `singleton: false` so a
		// `signage → room` type change is allowed and the category compat
		// check actually runs.
		typeMapper.registerMapping({
			type: 'signage_info_panel' as SpaceType,
			class: RoomSpaceEntity,
			createDto: CreateSpaceDto,
			updateDto: UpdateSpaceDto,
		});
	});

	describe('bulkAssign', () => {
		const roomId = mockSpace.id;

		beforeEach(() => {
			spaceRepository.findOne.mockResolvedValue(mockSpace);
		});

		it('should assign devices and displays to a space', async () => {
			const deviceIds = [uuid(), uuid()];
			const displayIds = [uuid()];

			const deviceQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 2 } as UpdateResult),
				// Nothing hidden: the write asks about the hidden rows directly rather than reading the
				// count it affected as a verdict.
				getCount: jest.fn().mockResolvedValue(0),
			};

			const displayQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 } as UpdateResult),
			};

			deviceRepository.createQueryBuilder.mockReturnValue(
				deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
			);
			displayRepository.createQueryBuilder.mockReturnValue(
				displayQueryBuilder as unknown as SelectQueryBuilder<DisplayEntity>,
			);

			const result = await service.bulkAssign(roomId, {
				deviceIds,
				displayIds,
			});

			expect(result.devicesAssigned).toBe(2);
			expect(result.displaysAssigned).toBe(1);
			expect(deviceQueryBuilder.set).toHaveBeenCalledWith({ roomId });
			expect(displayQueryBuilder.set).toHaveBeenCalledWith({ spaceId: roomId });
		});

		it('should handle empty device and display arrays', async () => {
			const result = await service.bulkAssign(roomId, {
				deviceIds: [],
				displayIds: [],
			});

			expect(result.devicesAssigned).toBe(0);
			expect(result.displaysAssigned).toBe(0);
		});

		it('should assign only devices when no displays provided', async () => {
			const deviceIds = [uuid(), uuid(), uuid()];

			const deviceQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 3 } as UpdateResult),
				// Nothing hidden: the write asks about the hidden rows directly rather than reading the
				// count it affected as a verdict.
				getCount: jest.fn().mockResolvedValue(0),
			};

			deviceRepository.createQueryBuilder.mockReturnValue(
				deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
			);

			const result = await service.bulkAssign(roomId, {
				deviceIds,
				displayIds: [],
			});

			expect(result.devicesAssigned).toBe(3);
			expect(result.displaysAssigned).toBe(0);
		});

		it('should throw SpacesNotFoundException when space does not exist', async () => {
			spaceRepository.findOne.mockResolvedValue(null);

			await expect(
				service.bulkAssign('non-existent-id', {
					deviceIds: [uuid()],
					displayIds: [],
				}),
			).rejects.toThrow(SpacesNotFoundException);
		});

		it('should throw SpacesValidationException for invalid device IDs', async () => {
			await expect(
				service.bulkAssign(roomId, {
					deviceIds: ['not-a-uuid'],
					displayIds: [],
				}),
			).rejects.toThrow(SpacesValidationException);
		});

		// This route writes `roomId` with a raw query builder UPDATE, so it never passes through
		// `DevicesService.update()` and the placement guard there does not see it. A hidden device is
		// one a virtual device has replaced; its placement belongs to that virtual device, whichever
		// route the write arrives on. Refusal is all-or-nothing on purpose — quietly skipping the
		// hidden ids while reporting `devicesAssigned: N` would be a silent partial write.
		describe('placement of a hidden device', () => {
			const arrangeDeviceWrite = (): {
				update: jest.Mock;
				set: jest.Mock;
				where: jest.Mock;
				andWhere: jest.Mock;
				execute: jest.Mock;
				getCount: jest.Mock;
			} => {
				const deviceQueryBuilder = {
					update: jest.fn().mockReturnThis(),
					set: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					andWhere: jest.fn().mockReturnThis(),
					execute: jest.fn().mockResolvedValue({ affected: 1 } as UpdateResult),
					// Nothing hidden unless a test says so: the refusal is keyed on this count, not on the
					// shortfall between rows asked for and rows touched.
					getCount: jest.fn().mockResolvedValue(0),
				};

				deviceRepository.createQueryBuilder.mockReturnValue(
					deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
				);

				return deviceQueryBuilder;
			};

			it('refuses the whole bulk assign when any targeted device is hidden', async () => {
				const hiddenId = uuid();
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([{ id: hiddenId, hidden: true } as DeviceEntity]);

				await expect(service.bulkAssign(roomId, { deviceIds: [uuid(), hiddenId], displayIds: [] })).rejects.toThrow(
					DevicesNotAllowedException,
				);

				expect(deviceQueryBuilder.execute).not.toHaveBeenCalled();
			});

			// The preflight is a check made a query earlier than the write. A device hidden in between — the
			// virtual-device wizard hides its source the moment it takes over — would otherwise have its
			// placement moved by a check that was true when it was made and false when it was applied. The
			// statement carries the condition now, so it touches fewer rows than asked for and says so.
			it('refuses when a targeted device is hidden between the check and the write', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);
				deviceQueryBuilder.execute.mockResolvedValue({ affected: 1 } as UpdateResult);
				// One of the two is hidden by the time the statement runs — read inside the same
				// transaction, so it is the state the write actually met.
				deviceQueryBuilder.getCount.mockResolvedValue(1);

				await expect(service.bulkAssign(roomId, { deviceIds: [uuid(), uuid()], displayIds: [] })).rejects.toThrow(
					DevicesNotAllowedException,
				);
			});

			// `IN` updates a repeated id once, so counting the raw list would read a perfectly valid
			// assignment as a hidden-device refusal and roll it back. The DTO permits duplicates today.
			it('assigns a device named twice in one payload', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();
				const repeated = uuid();

				deviceRepository.find.mockResolvedValue([]);
				deviceQueryBuilder.execute.mockResolvedValue({ affected: 1 } as UpdateResult);

				const result = await service.bulkAssign(roomId, { deviceIds: [repeated, repeated], displayIds: [] });

				expect(result.devicesAssigned).toBe(1);
			});

			// The refusal has to undo the statement that provoked it. Without a transaction, one device
			// hidden mid-call left every *other* device moved and the caller told the whole thing was
			// refused — a partial placement reported as a failure, with no DEVICE_UPDATED events for the
			// rows that did move, so nothing downstream would ever learn of them.
			it('runs the refused assignment inside a transaction so nothing is left moved', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);
				deviceQueryBuilder.execute.mockResolvedValue({ affected: 1 } as UpdateResult);
				deviceQueryBuilder.getCount.mockResolvedValue(1);

				await expect(service.bulkAssign(roomId, { deviceIds: [uuid(), uuid()], displayIds: [] })).rejects.toThrow(
					DevicesNotAllowedException,
				);

				// The throw came from inside the transaction callback, which is what rolls the update back.
				expect(deviceRepositoryStub.manager.transaction).toHaveBeenCalled();
			});

			// A device deleted after the client built its selection is skipped by the statement exactly as a
			// hidden one is, so reading the shortfall as "something was hidden" refused the whole batch and
			// rolled back every device that was perfectly assignable. Missing means not assigned, which is
			// what the returned count has always said.
			it('assigns the devices that exist when the payload names one that no longer does', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);
				// Two ids asked for, one row touched, and nothing hidden — the other id names nothing.
				deviceQueryBuilder.execute.mockResolvedValue({ affected: 1 } as UpdateResult);

				const result = await service.bulkAssign(roomId, { deviceIds: [uuid(), uuid()], displayIds: [] });

				expect(result.devicesAssigned).toBe(1);
			});

			it('unassigns the devices that exist when the list names one that no longer does', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);
				deviceQueryBuilder.execute.mockResolvedValue({ affected: 1 } as UpdateResult);

				const unassigned = await service.unassignDevices([uuid(), uuid()]);

				expect(unassigned).toBe(1);
			});

			it('assigns when every targeted device is visible', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);

				const result = await service.bulkAssign(roomId, { deviceIds: [uuid()], displayIds: [] });

				expect(result.devicesAssigned).toBe(1);
				expect(deviceQueryBuilder.set).toHaveBeenCalledWith({ roomId });
			});

			it('refuses the whole unassign when any targeted device is hidden', async () => {
				const hiddenId = uuid();
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([{ id: hiddenId, hidden: true } as DeviceEntity]);

				await expect(service.unassignDevices([uuid(), hiddenId])).rejects.toThrow(DevicesNotAllowedException);

				expect(deviceQueryBuilder.execute).not.toHaveBeenCalled();
			});

			it('unassigns when every targeted device is visible', async () => {
				const deviceQueryBuilder = arrangeDeviceWrite();

				deviceRepository.find.mockResolvedValue([]);

				const unassigned = await service.unassignDevices([uuid()]);

				expect(unassigned).toBe(1);
				expect(deviceQueryBuilder.set).toHaveBeenCalledWith({ roomId: null });
			});
		});
	});

	describe('findAll', () => {
		it('should return all spaces ordered by displayOrder and name', async () => {
			const spaces = [mockSpace];
			spaceRepository.find.mockResolvedValue(spaces);

			const result = await service.findAll();

			expect(result).toEqual(spaces);
			expect(spaceRepository.find).toHaveBeenCalledWith({
				order: { displayOrder: 'ASC', name: 'ASC' },
			});
		});
	});

	describe('findSummaryPage', () => {
		it('returns a deterministic bounded page and total count', async () => {
			const queryBuilder = {
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getManyAndCount: jest.fn().mockResolvedValue([[mockSpace], 75]),
			};
			spaceRepository.createQueryBuilder.mockReturnValue(queryBuilder as unknown as SelectQueryBuilder<SpaceEntity>);

			await expect(service.findSummaryPage(50, 25)).resolves.toEqual({ spaces: [mockSpace], total: 75 });
			expect(queryBuilder.orderBy).toHaveBeenCalledWith('space.displayOrder', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(1, 'space.name', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'space.id', 'ASC');
			expect(queryBuilder.skip).toHaveBeenCalledWith(25);
			expect(queryBuilder.take).toHaveBeenCalledWith(50);
		});
	});

	describe('searchSummaryPage', () => {
		it('returns bounded FTS-ranked metadata with type, category, and scope filters', async () => {
			dataSourceQueryMock
				.mockResolvedValueOnce([
					{
						id: mockSpace.id,
						name: mockSpace.name,
						type: SpaceType.ROOM,
						category: SpaceRoomCategory.LIVING_ROOM,
						parentId: 'floor-id',
						rankTier: '1',
						lexicalScore: '-2.5',
					},
				])
				.mockResolvedValueOnce([{ total: '3' }]);

			await expect(
				service.searchSummaryPage({
					match: '"living"*',
					rawQuery: ' Living%Room_ ',
					normalizedQuery: 'living%room_',
					offset: 2,
					limit: 20,
					spaceIds: [mockSpace.id],
					parentSpaceId: 'floor-id',
					types: [SpaceType.ROOM],
					categories: [SpaceRoomCategory.LIVING_ROOM],
				}),
			).resolves.toEqual({
				spaces: [
					expect.objectContaining({
						id: mockSpace.id,
						category: SpaceRoomCategory.LIVING_ROOM,
						rankTier: 1,
						lexicalScore: -2.5,
					}),
				],
				total: 3,
			});
			const [selectSql, selectParameters] = dataSourceQueryMock.mock.calls[0] as [string, unknown[]];
			const [countSql, countParameters] = dataSourceQueryMock.mock.calls[1] as [string, unknown[]];
			expect(selectSql).toContain('home_context_entity_search_fts MATCH ?');
			expect(selectSql).toContain('(space.id IN (?) OR space."parentId" = ?)');
			expect(selectSql).toContain('space.type IN (?)');
			expect(selectSql).toContain('space.category IN (?)');
			expect(selectSql).toContain('WHEN space.id = ? COLLATE NOCASE THEN 0');
			expect(selectSql).toContain('FROM home_context_entity_search_vocab exact_count');
			expect(selectSql).toContain('FROM home_context_entity_search_vocab prefix_term');
			expect(selectSql).toContain('ORDER BY "rankTier" ASC, "lexicalScore" ASC, LOWER(space.name) ASC, space.id ASC');
			expect(selectSql).toContain('LIMIT ? OFFSET ?');
			expect(selectParameters).toEqual([
				'Living%Room_',
				1,
				'living%room_',
				1,
				'living\\%room\\_%',
				'space',
				'"living"*',
				mockSpace.id,
				'floor-id',
				SpaceType.ROOM,
				SpaceRoomCategory.LIVING_ROOM,
				20,
				2,
			]);
			expect(countSql).toContain('SELECT COUNT(*) AS total');
			expect(countParameters).toEqual([
				'space',
				'"living"*',
				mockSpace.id,
				'floor-id',
				SpaceType.ROOM,
				SpaceRoomCategory.LIVING_ROOM,
			]);
		});

		it('does not query an explicitly empty scope', async () => {
			await expect(service.searchSummaryPage({ match: 'living', limit: 20, spaceIds: [] })).resolves.toEqual({
				spaces: [],
				total: 0,
			});
			expect(dataSourceQueryMock).not.toHaveBeenCalled();
		});
	});

	describe('findLightingTriggerSummaryPage', () => {
		it('returns only bounded spaces with enabled visible writable lighting targets', async () => {
			const onlineDevice = { id: 'device-1' } as DeviceEntity;
			const deviceQueryBuilder = {
				innerJoin: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				distinct: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([onlineDevice]),
			};
			const queryBuilder = {
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockSpace]),
			};
			deviceRepository.createQueryBuilder.mockReturnValue(
				deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
			);
			deviceConnectionStateService.readLatestMany.mockResolvedValue(
				new Map([[onlineDevice.id, { online: true, status: 'connected', lastChanged: new Date() }]]),
			);
			spaceRepository.createQueryBuilder.mockReturnValue(queryBuilder as unknown as SelectQueryBuilder<SpaceEntity>);

			await expect(service.findLightingTriggerSummaryPage(50)).resolves.toEqual({ spaces: [mockSpace], total: 1 });
			expect(queryBuilder.where).toHaveBeenCalledWith(
				expect.stringContaining('device.type IN (:...registeredDeviceTypes)'),
				expect.objectContaining({
					enabled: true,
					hidden: false,
					registeredDeviceTypes: ['test-light'],
					deviceCategory: 'lighting',
					channelCategory: 'light',
					propertyCategory: 'on',
					readWrite: 'rw',
					writeOnly: 'wo',
					lightingRoleType: 'lighting',
					hiddenLightingRole: 'hidden',
				}),
			);
			expect(queryBuilder.where).toHaveBeenCalledWith(
				expect.stringContaining('spaces_module_space_roles'),
				expect.any(Object),
			);
			expect(queryBuilder.orderBy).toHaveBeenCalledWith('space.displayOrder', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(1, 'space.name', 'ASC');
			expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(2, 'space.id', 'ASC');
			expect(queryBuilder.take).toHaveBeenCalledWith(50);
			expect(deviceQueryBuilder.take).toHaveBeenCalledWith(100);
			expect(deviceConnectionStateService.readLatestMany).toHaveBeenCalledWith([onlineDevice]);
		});

		it('returns no spaces when no device platforms are registered', async () => {
			platformRegistryService.list.mockReturnValue([]);

			await expect(service.findLightingTriggerSummaryPage(50)).resolves.toEqual({ spaces: [], total: 0 });
			expect(spaceRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('returns no spaces when all candidate lighting devices are offline', async () => {
			const offlineDevice = { id: 'device-1' } as DeviceEntity;
			const deviceQueryBuilder = {
				innerJoin: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				distinct: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([offlineDevice]),
			};
			const queryBuilder = {
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mockSpace]),
			};
			deviceRepository.createQueryBuilder.mockReturnValue(
				deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
			);
			spaceRepository.createQueryBuilder.mockReturnValue(queryBuilder as unknown as SelectQueryBuilder<SpaceEntity>);
			deviceConnectionStateService.readLatestMany.mockResolvedValue(
				new Map([[offlineDevice.id, { online: false, status: 'disconnected', lastChanged: new Date() }]]),
			);

			await expect(service.findLightingTriggerSummaryPage(50)).resolves.toEqual({ spaces: [], total: 0 });
			expect(deviceQueryBuilder.take).toHaveBeenCalledWith(100);
			expect(deviceConnectionStateService.readLatestMany).toHaveBeenCalledWith([offlineDevice]);
		});

		it('continues through bounded candidate batches until the requested page is filled', async () => {
			const offlineSpace = { ...mockSpace, id: 'space-offline' } as SpaceEntity;
			const onlineSpace = { ...mockSpace, id: 'space-online' } as SpaceEntity;
			const offlineDevice = { id: 'device-offline' } as DeviceEntity;
			const onlineDevice = { id: 'device-online' } as DeviceEntity;
			const deviceQueryBuilder = {
				innerJoin: jest.fn().mockReturnThis(),
				leftJoin: jest.fn().mockReturnThis(),
				select: jest.fn().mockReturnThis(),
				distinct: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				callListeners: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValueOnce([offlineDevice]).mockResolvedValueOnce([onlineDevice]),
			};
			const queryBuilder = {
				where: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				addOrderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([offlineSpace, onlineSpace]),
			};
			deviceRepository.createQueryBuilder.mockReturnValue(
				deviceQueryBuilder as unknown as SelectQueryBuilder<DeviceEntity>,
			);
			spaceRepository.createQueryBuilder.mockReturnValue(queryBuilder as unknown as SelectQueryBuilder<SpaceEntity>);
			deviceConnectionStateService.readLatestMany
				.mockResolvedValueOnce(
					new Map([[offlineDevice.id, { online: false, status: 'disconnected', lastChanged: new Date() }]]),
				)
				.mockResolvedValueOnce(
					new Map([[onlineDevice.id, { online: true, status: 'connected', lastChanged: new Date() }]]),
				);

			await expect(service.findLightingTriggerSummaryPage(1)).resolves.toEqual({
				spaces: [onlineSpace],
				total: 1,
			});
			expect(deviceConnectionStateService.readLatestMany).toHaveBeenCalledTimes(2);
			expect(deviceQueryBuilder.take).toHaveBeenCalledWith(100);
		});
	});

	describe('findVisibleDeviceSummariesBySpace', () => {
		it('derives floor-zone devices from child rooms', async () => {
			const floorId = uuid();
			const roomIds = [uuid(), uuid()];
			spaceRepository.findOne.mockResolvedValue({
				...mockSpace,
				id: floorId,
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			} as unknown as SpaceEntity);
			spaceRepository.find.mockResolvedValue(roomIds.map((id) => ({ id }) as SpaceEntity));

			await service.findVisibleDeviceSummariesBySpace(floorId, 100);

			expect(spaceRepository.find).toHaveBeenCalledWith({
				select: { id: true },
				where: { parentId: floorId },
			});
			expect(devicesService.findVisibleSummaryPage).toHaveBeenCalledWith(100, { roomIds });
		});

		it('resolves master spaces to whole-home scope', async () => {
			await expect(
				service.resolveSnapshotScope({ id: 'master-id', type: SpaceType.MASTER } as SpaceEntity),
			).resolves.toEqual({
				deviceScope: {},
				wholeHome: true,
			});
		});

		it('keeps entry content empty while using whole-home security scope', async () => {
			await expect(
				service.resolveSnapshotScope({ id: 'entry-id', type: SpaceType.ENTRY } as SpaceEntity),
			).resolves.toEqual({
				deviceScope: { roomIds: [] },
				securityDeviceScope: {},
				sceneSpaceIds: [],
				wholeHome: false,
			});
		});
	});

	describe('getOneOrThrow', () => {
		it('should return space when found', async () => {
			spaceRepository.findOne.mockResolvedValue(mockSpace);

			const result = await service.getOneOrThrow(mockSpace.id);

			expect(result).toEqual(mockSpace);
		});

		it('should throw SpacesNotFoundException when space not found', async () => {
			spaceRepository.findOne.mockResolvedValue(null);

			await expect(service.getOneOrThrow('non-existent')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('create - type/category validation', () => {
		it('should accept ROOM with room category', async () => {
			const createDto: CreateHomeControlSpaceDto = {
				name: 'Living Room',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.LIVING_ROOM,
			};

			const savedSpace = {
				...mockSpace,
				id: uuid(),
				name: 'Living Room',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.LIVING_ROOM,
			};

			// Clear find mock to avoid deduplication with mockSpace (same name)
			spaceRepository.find.mockResolvedValue([]);
			spaceRepository.save.mockResolvedValue(savedSpace);
			spaceRepository.findOne.mockResolvedValue(savedSpace);

			const result = await service.create(createDto);

			expect(result.type).toBe(SpaceType.ROOM);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceRoomCategory.LIVING_ROOM,
			);
		});

		it('should accept ZONE with zone category', async () => {
			const createDto: CreateHomeControlSpaceDto = {
				name: 'Ground Floor',
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			const savedSpace = {
				...mockSpace,
				id: uuid(),
				name: 'Ground Floor',
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			spaceRepository.save.mockResolvedValue(savedSpace);
			spaceRepository.findOne.mockResolvedValue(savedSpace);

			const result = await service.create(createDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceZoneCategory.FLOOR_GROUND,
			);
		});

		it('should accept null category for both types', async () => {
			const createDto: CreateHomeControlSpaceDto = {
				name: 'Custom Space',
				type: SpaceType.ROOM,
				category: null,
			};

			const savedSpace = {
				...mockSpace,
				id: uuid(),
				name: 'Custom Space',
				type: SpaceType.ROOM,
				category: null,
			};

			spaceRepository.save.mockResolvedValue(savedSpace);
			spaceRepository.findOne.mockResolvedValue(savedSpace);

			const result = await service.create(createDto);

			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBeNull();
		});

		it('should reject ROOM with zone category', async () => {
			const createDto: CreateHomeControlSpaceDto = {
				name: 'Invalid Room',
				type: SpaceType.ROOM,
				category: SpaceZoneCategory.FLOOR_GROUND, // Zone category for room type
			};

			await expect(service.create(createDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject ZONE with room category', async () => {
			const createDto: CreateHomeControlSpaceDto = {
				name: 'Invalid Zone',
				type: SpaceType.ZONE,
				category: SpaceRoomCategory.LIVING_ROOM, // Room category for zone type
			};

			await expect(service.create(createDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject creating a second instance of a singleton space type', async () => {
			// The in-suite 'master' mapping is registered with `singleton: true`.
			// The first row is seeded by the plugin on boot — simulate that by
			// having the subtype repository's findOne (which SpacesService.create
			// consults before writing) return an already-existing row.
			const existingMaster = {
				...mockSpace,
				id: uuid(),
				name: 'Home',
				type: 'master' as SpaceType,
				category: null,
			} as unknown as SpaceEntity;

			spaceRepository.find.mockResolvedValue([]);
			spaceRepository.findOne.mockResolvedValueOnce(existingMaster);

			// Payload stays on the base `CreateSpaceDto` whitelist (name + type only —
			// `category` moved to `CreateHomeControlSpaceDto` and isn't valid on the
			// master singleton DTO in this suite). Anything extra would be rejected
			// by `forbidNonWhitelisted` inside `SpacesService.create`'s per-type
			// validator, masking whether the actual singleton guard fired.
			await expect(
				service.create({
					name: 'Another Home',
					type: 'master' as SpaceType,
				} as CreateSpaceDto),
			).rejects.toThrow(SpacesValidationException);
		});

		it('should reject creating a ROOM with a zone category', async () => {
			spaceRepository.find.mockResolvedValue([]);

			const createDto: CreateHomeControlSpaceDto = {
				name: 'Oddly-shaped room',
				type: SpaceType.ROOM,
				category: SpaceZoneCategory.FLOOR_GROUND, // zone category on room
			};
			await expect(service.create(createDto)).rejects.toThrow(SpacesValidationException);
		});
	});

	describe('update - type/category validation', () => {
		const existingRoomSpace = {
			...mockSpace,
			id: uuid(),
			name: 'Living Room',
			type: SpaceType.ROOM,
			category: SpaceRoomCategory.LIVING_ROOM,
		} as unknown as SpaceEntity;

		const existingZoneSpace = {
			...mockSpace,
			id: uuid(),
			name: 'Ground Floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_GROUND,
		} as unknown as SpaceEntity;

		it('should accept updating ROOM category to another room category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: SpaceRoomCategory.BEDROOM,
			};

			const updatedSpace = {
				...existingRoomSpace,
				category: SpaceRoomCategory.BEDROOM,
			} as unknown as SpaceEntity;

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingRoomSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ROOM);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceRoomCategory.BEDROOM,
			);
		});

		it('should accept updating ZONE category to another zone category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: SpaceZoneCategory.FLOOR_FIRST,
			};

			const updatedSpace = {
				...existingZoneSpace,
				category: SpaceZoneCategory.FLOOR_FIRST,
			} as unknown as SpaceEntity;

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingZoneSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceZoneCategory.FLOOR_FIRST,
			);
		});

		it('should reject updating ROOM category to a zone category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: SpaceZoneCategory.FLOOR_GROUND, // Zone category for existing room
			};

			await expect(service.update(existingRoomSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject updating ZONE category to a room category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: SpaceRoomCategory.LIVING_ROOM, // Room category for existing zone
			};

			await expect(service.update(existingZoneSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject changing type when existing category becomes incompatible', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			// Trying to change room to zone while keeping living_room category
			const updateDto = {
				type: SpaceType.ZONE, // Change type but keep incompatible category
			};

			await expect(service.update(existingRoomSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject changing type to ZONE when category is null', async () => {
			const spaceWithNullCategory = {
				...existingRoomSpace,
				category: null,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValue(spaceWithNullCategory);

			const updateDto = {
				type: SpaceType.ZONE,
			};

			// Zones require a category, so this should fail
			await expect(service.update(spaceWithNullCategory.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject changing a room into a singleton type', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);
			// The master singleton type in this suite uses the base `UpdateSpaceDto`
			// (no `category`) — keep the payload minimal so the singleton guard is
			// what fails, not the whitelist.
			await expect(
				service.update(existingRoomSpace.id, {
					type: 'master' as SpaceType,
				} as UpdateSpaceDto),
			).rejects.toThrow(SpacesValidationException);
		});

		it('should reject changing a singleton type into a room', async () => {
			const existingMaster = {
				...mockSpace,
				id: uuid(),
				name: 'Home',
				type: 'master' as SpaceType,
				category: null,
			} as unknown as SpaceEntity;
			spaceRepository.findOne.mockResolvedValue(existingMaster);
			// Target is ROOM (home-control) — category is a valid whitelisted field
			// on the per-type `UpdateHomeControlSpaceDto`, so the singleton guard is
			// the sole reason this must reject.
			await expect(
				service.update(existingMaster.id, {
					type: SpaceType.ROOM,
					category: SpaceRoomCategory.LIVING_ROOM,
				} as UpdateHomeControlSpaceDto),
			).rejects.toThrow(SpacesValidationException);
		});

		it('should accept changing type to ZONE when category is provided', async () => {
			const spaceWithNullCategory = {
				...existingRoomSpace,
				category: null,
			} as unknown as SpaceEntity;

			const updatedSpace = {
				...spaceWithNullCategory,
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			} as unknown as SpaceEntity;

			// First findOne returns the pre-update entity; after the type-change raw update
			// the service re-fetches to get the entity with the new subtype.
			spaceRepository.findOne.mockResolvedValueOnce(spaceWithNullCategory).mockResolvedValueOnce(updatedSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(spaceWithNullCategory.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceZoneCategory.FLOOR_GROUND,
			);
			// The raw UPDATE path for type changes must emit the discriminator column.
			// We assert the payload handed to TypeORM's QueryBuilder.set() — TypeORM then
			// resolves `type` via @TableInheritance's entityMetadata to the discriminator
			// column and issues `UPDATE ... SET type = 'zone' WHERE id = ?`.
			expect(mockQueryBuilder.update).toHaveBeenCalled();
			expect(mockQueryBuilder.set).toHaveBeenCalledWith(
				expect.objectContaining({ type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_GROUND }),
			);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', { id: spaceWithNullCategory.id });
			expect(mockQueryBuilder.execute).toHaveBeenCalled();
		});

		it('should accept changing type and category together when compatible', async () => {
			const updatedSpace = {
				...existingRoomSpace,
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			} as unknown as SpaceEntity;

			// See note above — type changes reload the entity as the new subtype.
			spaceRepository.findOne.mockResolvedValueOnce(existingRoomSpace).mockResolvedValueOnce(updatedSpace);

			// Change from room/living_room to zone/floor_ground
			const updateDto: UpdateHomeControlSpaceDto = {
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingRoomSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBe(
				SpaceZoneCategory.FLOOR_GROUND,
			);
			// Same assertion as above — verify the raw UPDATE SET payload includes the
			// new discriminator alongside the other DTO-sourced fields, and is keyed by id.
			expect(mockQueryBuilder.set).toHaveBeenCalledWith(
				expect.objectContaining({ type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_GROUND }),
			);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith('id = :id', { id: existingRoomSpace.id });
		});

		it('should accept setting category to null for a ROOM', async () => {
			// Create a fresh room space instance
			const roomSpace = {
				...mockSpace,
				id: uuid(),
				name: 'Test Room',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.BEDROOM,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValue(roomSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: null,
			};

			const updatedSpace = {
				...roomSpace,
				category: null,
			} as unknown as SpaceEntity;

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(roomSpace.id, updateDto);

			expect((result as { category?: SpaceRoomCategory | SpaceZoneCategory | null }).category).toBeNull();
		});

		it('should reject setting category to null for a ZONE', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto: UpdateHomeControlSpaceDto = {
				category: null,
			};

			// Zones require a category
			await expect(service.update(existingZoneSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		// Legacy-row safety: before `category` moved off the abstract base, a
		// non-home-control subtype could carry a stored category value that its
		// post-refactor entity class no longer hydrates. A PATCH that only
		// flips `type` without touching category must still see the real
		// stored value via the raw column read — otherwise the compat check
		// runs against `null` and lets invalid combinations slip through.
		//
		// Scenario: legacy signage row with `category = 'floor_ground'` stored
		// pre-refactor. `SignageInfoPanelSpaceEntity` doesn't declare
		// `@Column() category`, so TypeORM hydrates it as `undefined`. A PATCH
		// that flips type to ROOM without providing a category would previously
		// slip past the compat check (effectiveCategory = null) and leave the
		// stale zone category on a room row. The raw column read now grounds
		// the check in the real persisted value.
		it('should reject a signage → room type change when the stored legacy category is zone-typed', async () => {
			const legacySignage = {
				...mockSpace,
				id: uuid(),
				name: 'Lobby Panel',
				type: 'signage_info_panel' as SpaceType,
				category: undefined,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValue(legacySignage);
			dataSourceQueryMock.mockResolvedValueOnce([{ category: SpaceZoneCategory.FLOOR_GROUND }]);

			await expect(service.update(legacySignage.id, { type: SpaceType.ROOM } as UpdateSpaceDto)).rejects.toThrow(
				SpacesValidationException,
			);
		});

		it('should pin category in the raw UPDATE to the effective value when the DTO omits it', async () => {
			const legacySignage = {
				...mockSpace,
				id: uuid(),
				name: 'Lobby Panel',
				type: 'signage_info_panel' as SpaceType,
				category: undefined,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValueOnce(legacySignage).mockResolvedValueOnce({
				...legacySignage,
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.LIVING_ROOM,
			} as unknown as SpaceEntity);

			// Stale DB value compatible with the target type so compat check
			// passes and we exercise the raw UPDATE path itself.
			dataSourceQueryMock.mockResolvedValueOnce([{ category: SpaceRoomCategory.LIVING_ROOM }]);

			spaceRepository.save.mockResolvedValue(legacySignage);

			await service.update(legacySignage.id, { type: SpaceType.ROOM } as UpdateSpaceDto);

			// The raw UPDATE must explicitly persist the compat-checked
			// `effectiveCategory` — otherwise a future refactor that changes
			// how legacy rows are normalized would bypass the service.
			expect(mockQueryBuilder.set).toHaveBeenCalledWith(
				expect.objectContaining({ type: SpaceType.ROOM, category: SpaceRoomCategory.LIVING_ROOM }),
			);
		});

		// Cursor Low follow-up: the raw-column read is an extra SQL round-trip
		// and should only run for the narrow legacy-row case (source subtype
		// didn't declare `category` and DTO didn't provide one). Ordinary
		// home-control updates — or any update where the category isn't needed
		// — must not trigger it.
		it('should not issue the raw category read on a hydrated home-control update', async () => {
			const roomWithCategory = {
				...mockSpace,
				id: uuid(),
				name: 'Kitchen',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.KITCHEN,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValue(roomWithCategory);
			spaceRepository.save.mockResolvedValue(roomWithCategory);

			await service.update(roomWithCategory.id, { name: 'Kitchen updated' } as UpdateHomeControlSpaceDto);

			expect(dataSourceQueryMock).not.toHaveBeenCalled();
		});

		it('should not issue the raw category read when target is non-home-control', async () => {
			const existingMaster = {
				...mockSpace,
				id: uuid(),
				name: 'Home',
				type: 'master' as SpaceType,
				category: undefined,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValue(existingMaster);
			spaceRepository.save.mockResolvedValue(existingMaster);

			await service.update(existingMaster.id, { name: 'Renamed' } as UpdateSpaceDto);

			expect(dataSourceQueryMock).not.toHaveBeenCalled();
		});

		// Codex P2 follow-up: a one-step conversion from room/zone to a
		// non-home-control target (e.g. signage) must work even without the
		// client clearing `category` in the same PATCH — the target DTO
		// doesn't whitelist `category`, so the client *can't* clear it. Core
		// has to force-null home-control-only columns when they're not on
		// the target subtype's `subtypeColumns` list.
		it('should wipe category when converting room → signage without an explicit category', async () => {
			const roomWithCategory = {
				...mockSpace,
				id: uuid(),
				name: 'Lobby',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.LIVING_ROOM,
				suggestionsEnabled: true,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValueOnce(roomWithCategory).mockResolvedValueOnce({
				...roomWithCategory,
				type: 'signage_info_panel' as SpaceType,
				category: null,
				suggestionsEnabled: false,
			} as unknown as SpaceEntity);
			spaceRepository.save.mockResolvedValue(roomWithCategory);

			await service.update(roomWithCategory.id, { type: 'signage_info_panel' as SpaceType } as UpdateSpaceDto);

			// Compat check must see effectiveCategory = null (target doesn't
			// accept it); the raw UPDATE must wipe the home-control-only
			// columns so they don't linger. Each column gets its plugin-
			// declared wipe value — critically, `suggestionsEnabled` is NOT
			// NULL in the DB so its wipe value is the column default (`true`)
			// rather than `null`.
			expect(mockQueryBuilder.set).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'signage_info_panel',
					category: null,
					suggestionsEnabled: true,
					statusWidgets: null,
				}),
			);
		});

		// Cursor High follow-up: the wipe loop previously hard-coded `null` for
		// every old-subtype column, which blew up when the column is NOT NULL
		// (e.g. `suggestionsEnabled boolean NOT NULL DEFAULT 1`). Lock in that
		// the wipe now sources the value from the plugin's `subtypeColumns`
		// map so NOT NULL columns land on their default instead.
		it('should wipe NOT NULL suggestionsEnabled to its default (true) when converting room → signage', async () => {
			const roomWithSuggestionsOff = {
				...mockSpace,
				id: uuid(),
				name: 'Kiosk',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.LIVING_ROOM,
				suggestionsEnabled: false,
			} as unknown as SpaceEntity;

			spaceRepository.findOne.mockResolvedValueOnce(roomWithSuggestionsOff).mockResolvedValueOnce({
				...roomWithSuggestionsOff,
				type: 'signage_info_panel' as SpaceType,
				category: null,
				suggestionsEnabled: true,
			} as unknown as SpaceEntity);
			spaceRepository.save.mockResolvedValue(roomWithSuggestionsOff);

			await service.update(roomWithSuggestionsOff.id, {
				type: 'signage_info_panel' as SpaceType,
			} as UpdateSpaceDto);

			// `suggestionsEnabled` is a NOT NULL column; its wipe value must
			// be the column default (`true`), not `null`.
			const [setArg] = mockQueryBuilder.set.mock.calls[0] as [Record<string, unknown>];
			expect(setArg.suggestionsEnabled).toBe(true);
			expect(setArg.suggestionsEnabled).not.toBeNull();
		});
	});
	// Every caller of this is a user-facing projection of "what is in this space" — the lighting,
	// covers, climate and sensor role and state services, media capability, Buddy's context, the space
	// device listing. A hidden device is a physical source a virtual device replaced, so including it
	// would show and count the source beside its replacement and let a command reach it directly.
	describe('findDevicesBySpace', () => {
		it('asks the repository for visible devices only in a room', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue({ id: 'room-1', type: SpaceType.ROOM } as SpaceEntity);
			deviceRepository.find.mockResolvedValue([]);

			await service.findDevicesBySpace('room-1');

			expect(deviceRepository.find).toHaveBeenCalledWith(
				expect.objectContaining({ where: { roomId: 'room-1', hidden: false } }),
			);
		});

		it('drops hidden devices from a zone', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue({ id: 'zone-1', type: SpaceType.ZONE } as SpaceEntity);

			(deviceZonesService.getZoneDevices as jest.Mock).mockResolvedValue([
				{ id: 'visible', hidden: false },
				{ id: 'replaced', hidden: true },
			]);

			const devices = await service.findDevicesBySpace('zone-1');

			expect(devices.map((device) => device.id)).toEqual(['visible']);
		});
	});
});
