/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource, Repository, UpdateQueryBuilder, UpdateResult } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceZonesService } from '../../devices/services/device-zones.service';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceRoomCategory, SpaceType, SpaceZoneCategory } from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
	let service: SpacesService;
	let spaceRepository: jest.Mocked<Repository<SpaceEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;
	let displayRepository: jest.Mocked<Repository<DisplayEntity>>;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		category: null,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		suggestionsEnabled: true,
		lastActivityAt: null,
		parentId: null,
		parent: null,
		children: [],
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		const mockQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 0 } as UpdateResult),
		} as unknown as UpdateQueryBuilder<any>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpacesService,
				{
					provide: getRepositoryToken(SpaceEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([mockSpace]),
						findOne: jest.fn().mockResolvedValue(mockSpace),
						save: jest.fn().mockResolvedValue(mockSpace),
						create: jest.fn().mockImplementation((data) => ({ ...data, id: mockSpace.id }) as SpaceEntity),
						delete: jest.fn().mockResolvedValue({ affected: 1 }),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
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
			],
		}).compile();

		service = module.get<SpacesService>(SpacesService);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
		displayRepository = module.get(getRepositoryToken(DisplayEntity));
	});

	describe('proposeSpaces', () => {
		it('should return empty array when no devices exist', async () => {
			deviceRepository.find.mockResolvedValue([]);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
			expect(deviceRepository.find).toHaveBeenCalledWith({ select: ['id', 'name'] });
		});

		it('should propose spaces based on device names', async () => {
			const devices = [
				{ id: uuid(), name: 'Living Room Ceiling Light' },
				{ id: uuid(), name: 'Living Room Lamp' },
				{ id: uuid(), name: 'Kitchen Light' },
				{ id: uuid(), name: 'Bedroom Thermostat' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(3);

			const livingRoom = result.find((s) => s.name === 'Living Room');
			expect(livingRoom).toBeDefined();
			expect(livingRoom?.deviceCount).toBe(2);
			expect(livingRoom?.deviceIds).toContain(devices[0].id);
			expect(livingRoom?.deviceIds).toContain(devices[1].id);

			const kitchen = result.find((s) => s.name === 'Kitchen');
			expect(kitchen).toBeDefined();
			expect(kitchen?.deviceCount).toBe(1);

			const bedroom = result.find((s) => s.name === 'Bedroom');
			expect(bedroom).toBeDefined();
			expect(bedroom?.deviceCount).toBe(1);
		});

		it('should not propose spaces for devices without room tokens', async () => {
			const devices = [
				{ id: uuid(), name: 'Main Switch' },
				{ id: uuid(), name: 'Temperature Sensor' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
		});

		it('should match longest room token when multiple match', async () => {
			const devices = [{ id: uuid(), name: 'Master Bedroom Light' }] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Master Bedroom');
		});

		it('should handle case-insensitive matching', async () => {
			const devices = [
				{ id: uuid(), name: 'LIVING ROOM Lamp' },
				{ id: uuid(), name: 'living room light' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Living Room');
			expect(result[0].deviceCount).toBe(2);
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

			deviceRepository.createQueryBuilder.mockReturnValue(deviceQueryBuilder as any);
			displayRepository.createQueryBuilder.mockReturnValue(displayQueryBuilder as any);

			const result = await service.bulkAssign(roomId, {
				deviceIds,
				displayIds,
			});

			expect(result.devicesAssigned).toBe(2);
			expect(result.displaysAssigned).toBe(1);
			expect(deviceQueryBuilder.set).toHaveBeenCalledWith({ roomId });
			expect(displayQueryBuilder.set).toHaveBeenCalledWith({ roomId: roomId });
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

			deviceRepository.createQueryBuilder.mockReturnValue(deviceQueryBuilder as any);

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
			const createDto = {
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
			const createDto = {
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

		it('should accept ZONE with legacy outdoor value and normalize to outdoor_garden', async () => {
			const createDto = {
				name: 'Garden',
				type: SpaceType.ZONE,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				category: 'outdoor' as any, // Legacy value
			};

			const savedSpace = {
				...mockSpace,
				id: uuid(),
				name: 'Garden',
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.OUTDOOR_GARDEN, // Normalized
			};

			spaceRepository.save.mockResolvedValue(savedSpace);
			spaceRepository.findOne.mockResolvedValue(savedSpace);

			// The service should normalize the legacy value
			const result = await service.create(createDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceZoneCategory.OUTDOOR_GARDEN);
		});

		it('should accept null category for both types', async () => {
			const createDto = {
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
			const createDto = {
				name: 'Invalid Room',
				type: SpaceType.ROOM,
				category: SpaceZoneCategory.FLOOR_GROUND, // Zone category for room type
			};

			await expect(service.create(createDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject ZONE with room category', async () => {
			const createDto = {
				name: 'Invalid Zone',
				type: SpaceType.ZONE,
				category: SpaceRoomCategory.LIVING_ROOM, // Room category for zone type
			};

			await expect(service.create(createDto)).rejects.toThrow(SpacesValidationException);
		});
	});

	describe('update - type/category validation', () => {
		const existingRoomSpace: SpaceEntity = {
			...mockSpace,
			id: uuid(),
			name: 'Living Room',
			type: SpaceType.ROOM,
			category: SpaceRoomCategory.LIVING_ROOM,
		};

		const existingZoneSpace: SpaceEntity = {
			...mockSpace,
			id: uuid(),
			name: 'Ground Floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_GROUND,
		};

		it('should accept updating ROOM category to another room category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			const updateDto = {
				category: SpaceRoomCategory.BEDROOM,
			};

			const updatedSpace = {
				...existingRoomSpace,
				category: SpaceRoomCategory.BEDROOM,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingRoomSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ROOM);
			expect(result.category).toBe(SpaceRoomCategory.BEDROOM);
		});

		it('should accept updating ZONE category to another zone category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto = {
				category: SpaceZoneCategory.FLOOR_FIRST,
			};

			const updatedSpace = {
				...existingZoneSpace,
				category: SpaceZoneCategory.FLOOR_FIRST,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingZoneSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_FIRST);
		});

		it('should reject updating ROOM category to a zone category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			const updateDto = {
				category: SpaceZoneCategory.FLOOR_GROUND, // Zone category for existing room
			};

			await expect(service.update(existingRoomSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should reject updating ZONE category to a room category', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto = {
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
			const spaceWithNullCategory: SpaceEntity = {
				...existingRoomSpace,
				category: null,
			};

			spaceRepository.findOne.mockResolvedValue(spaceWithNullCategory);

			const updateDto = {
				type: SpaceType.ZONE,
			};

			// Zones require a category, so this should fail
			await expect(service.update(spaceWithNullCategory.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});

		it('should accept changing type to ZONE when category is provided', async () => {
			const spaceWithNullCategory: SpaceEntity = {
				...existingRoomSpace,
				category: null,
			};

			spaceRepository.findOne.mockResolvedValue(spaceWithNullCategory);

			const updateDto = {
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			const updatedSpace = {
				...spaceWithNullCategory,
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(spaceWithNullCategory.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
		});

		it('should accept changing type and category together when compatible', async () => {
			spaceRepository.findOne.mockResolvedValue(existingRoomSpace);

			// Change from room/living_room to zone/floor_ground
			const updateDto = {
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			const updatedSpace = {
				...existingRoomSpace,
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingRoomSpace.id, updateDto);

			expect(result.type).toBe(SpaceType.ZONE);
			expect(result.category).toBe(SpaceZoneCategory.FLOOR_GROUND);
		});

		it('should normalize legacy outdoor value on update', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto = {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				category: 'outdoor' as any, // Legacy value
			};

			const updatedSpace = {
				...existingZoneSpace,
				category: SpaceZoneCategory.OUTDOOR_GARDEN,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(existingZoneSpace.id, updateDto);

			expect(result.category).toBe(SpaceZoneCategory.OUTDOOR_GARDEN);
		});

		it('should accept setting category to null for a ROOM', async () => {
			// Create a fresh room space instance
			const roomSpace: SpaceEntity = {
				...mockSpace,
				id: uuid(),
				name: 'Test Room',
				type: SpaceType.ROOM,
				category: SpaceRoomCategory.BEDROOM,
			};

			spaceRepository.findOne.mockResolvedValue(roomSpace);

			const updateDto = {
				category: null,
			};

			const updatedSpace = {
				...roomSpace,
				category: null,
			};

			spaceRepository.save.mockResolvedValue(updatedSpace);

			const result = await service.update(roomSpace.id, updateDto);

			expect(result.category).toBeNull();
		});

		it('should reject setting category to null for a ZONE', async () => {
			spaceRepository.findOne.mockResolvedValue(existingZoneSpace);

			const updateDto = {
				category: null,
			};

			// Zones require a category
			await expect(service.update(existingZoneSpace.id, updateDto)).rejects.toThrow(SpacesValidationException);
		});
	});
});
