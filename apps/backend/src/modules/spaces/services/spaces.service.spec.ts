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
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceZonesService } from '../../devices/services/device-zones.service';
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
	let displayRepository: jest.Mocked<Repository<DisplayEntity>>;
	// DataSource mock is hoisted so individual tests can stub `query()` — used
	// by `SpacesService.update()` to read the raw `category` column straight
	// from the shared STI table (ignoring subtype hydration).
	let dataSourceQueryMock: jest.Mock;
	let mockQueryBuilder: {
		update: jest.Mock;
		set: jest.Mock;
		where: jest.Mock;
		execute: jest.Mock;
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
		mockQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 0 } as UpdateResult),
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
					useValue: {
						find: jest.fn().mockResolvedValue([]),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
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
						setDeviceZones: jest.fn().mockResolvedValue([]),
					},
				},
				SpacesTypeMapperService,
			],
		}).compile();

		service = module.get<SpacesService>(SpacesService);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
		displayRepository = module.get(getRepositoryToken(DisplayEntity));

		// Pre-register built-in space types (normally done by SpacesModule.onModuleInit).
		// Use the real plugin DTOs so validation accepts the subtype-specific
		// fields (category / suggestions_enabled / status_widgets) that live on
		// `CreateHomeControlSpaceDto` / `UpdateHomeControlSpaceDto`.
		const typeMapper = module.get<SpacesTypeMapperService>(SpacesTypeMapperService);
		typeMapper.registerMapping({
			type: SpaceType.ROOM,
			class: RoomSpaceEntity,
			createDto: CreateHomeControlSpaceDto,
			updateDto: UpdateHomeControlSpaceDto,
		});
		typeMapper.registerMapping({
			type: SpaceType.ZONE,
			class: ZoneSpaceEntity,
			createDto: CreateHomeControlSpaceDto,
			updateDto: UpdateHomeControlSpaceDto,
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
				execute: jest.fn().mockResolvedValue({ affected: 2 } as UpdateResult),
			};

			const displayQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
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
				execute: jest.fn().mockResolvedValue({ affected: 3 } as UpdateResult),
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
			expect(result.category).toBe(SpaceRoomCategory.LIVING_ROOM);
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
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
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

			expect(result.category).toBeNull();
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
			expect(result.category).toBe(SpaceRoomCategory.BEDROOM);
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
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_FIRST);
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
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
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
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
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

			expect(result.category).toBeNull();
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
	});
});
