import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';

import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceZonesService } from '../../devices/services/device-zones.service';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { BulkAssignDto } from '../dto/bulk-assign.dto';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { SpaceEntity } from '../entities/space.entity';
import {
	EventType,
	SPACES_MODULE_NAME,
	type SpaceCategory,
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
	isValidCategoryForType,
	normalizeCategoryValue,
} from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';
import { canonicalizeSpaceName } from '../spaces.utils';

@Injectable()
export class SpacesService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpacesService');

	constructor(
		@InjectRepository(SpaceEntity)
		private readonly repository: Repository<SpaceEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		@InjectRepository(DisplayEntity)
		private readonly displayRepository: Repository<DisplayEntity>,
		@Inject(forwardRef(() => DeviceZonesService))
		private readonly deviceZonesService: DeviceZonesService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async findAll(): Promise<SpaceEntity[]> {
		this.logger.debug('Fetching all spaces');

		const spaces = await this.repository.find({
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${spaces.length} spaces`);

		return spaces;
	}

	async findOne(id: string): Promise<SpaceEntity | null> {
		this.logger.debug(`Fetching space with id=${id}`);

		const space = await this.repository.findOne({ where: { id } });

		if (!space) {
			this.logger.warn(`Space not found by id=${id}`);

			return null;
		}

		this.logger.debug('Successfully fetched space');

		return space;
	}

	async getOneOrThrow(id: string): Promise<SpaceEntity> {
		const space = await this.findOne(id);

		if (!space) {
			this.logger.error(`Space with id=${id} not found`);

			throw new SpacesNotFoundException('Requested space does not exist');
		}

		return space;
	}

	/**
	 * Find a space by its canonical name
	 * Used for deduplication during creation
	 */
	async findByCanonicalName(canonicalName: string): Promise<SpaceEntity | null> {
		const allSpaces = await this.findAll();
		return allSpaces.find((space) => canonicalizeSpaceName(space.name) === canonicalName) ?? null;
	}

	async create(createDto: CreateSpaceDto): Promise<SpaceEntity> {
		this.logger.debug('Creating new space');

		const dtoInstance = await this.validateDto(CreateSpaceDto, createDto);

		// Check for existing space with same canonical name (deduplication)
		const canonicalName = canonicalizeSpaceName(dtoInstance.name);
		const existingSpace = await this.findByCanonicalName(canonicalName);

		if (existingSpace) {
			this.logger.debug(
				`Space with canonical name "${canonicalName}" already exists (id=${existingSpace.id}), returning existing`,
			);
			return existingSpace;
		}

		// Normalize legacy category values (e.g., 'outdoor' -> 'outdoor_garden' for zones)
		const type = dtoInstance.type;
		const normalizedCategory = normalizeCategoryValue(dtoInstance.category ?? null, type);

		// Zones must have a category
		if (type === SpaceType.ZONE && normalizedCategory === null) {
			this.logger.error('Zone must have a category');
			throw new SpacesValidationException('Category is required for zones.');
		}

		// Validate parent assignment
		await this.validateParentAssignment(type, dtoInstance.parent_id ?? null);

		const space = this.repository.create(
			toInstance(SpaceEntity, {
				...dtoInstance,
				category: normalizedCategory,
			}),
		);

		await this.repository.save(space);

		// Re-fetch to get database default values populated
		const savedSpace = await this.getOneOrThrow(space.id);

		this.logger.debug(`Successfully created space with id=${savedSpace.id}`);

		this.eventEmitter.emit(EventType.SPACE_CREATED, savedSpace);

		return savedSpace;
	}

	async update(id: string, updateDto: UpdateSpaceDto): Promise<SpaceEntity> {
		this.logger.debug(`Updating space with id=${id}`);

		const space = await this.getOneOrThrow(id);

		const dtoInstance = await this.validateDto(UpdateSpaceDto, updateDto);

		// Determine the effective type (new type if provided, otherwise existing)
		const effectiveType = dtoInstance.type ?? space.type;

		// Determine the effective category (new category if provided, otherwise existing)
		const effectiveCategory = dtoInstance.category !== undefined ? dtoInstance.category : space.category;

		// Zones must have a category
		if (effectiveType === SpaceType.ZONE && effectiveCategory === null) {
			this.logger.error(`Zone must have a category. Update rejected for space id=${id}`);
			throw new SpacesValidationException('Category is required for zones.');
		}

		// Validate that the category is compatible with the type
		// This handles the case where type is changed but category is not,
		// or category is changed but type is not provided
		if (effectiveCategory !== null && !isValidCategoryForType(effectiveCategory, effectiveType)) {
			this.logger.error(
				`Category '${effectiveCategory}' is not valid for type '${effectiveType}'. ` +
					`Update rejected for space id=${id}`,
			);
			throw new SpacesValidationException(
				`Category '${effectiveCategory}' is not valid for space type '${effectiveType}'.`,
			);
		}

		// Validate parent assignment if provided
		const effectiveParentId = dtoInstance.parent_id !== undefined ? dtoInstance.parent_id : space.parentId;
		await this.validateParentAssignment(effectiveType, effectiveParentId ?? null, id);

		// Normalize legacy category values
		const normalizedCategory =
			dtoInstance.category !== undefined ? normalizeCategoryValue(dtoInstance.category, effectiveType) : undefined;

		// Build the update object
		const updateData = {
			...dtoInstance,
			...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
		};

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(SpaceEntity, updateData), isUndefined);

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged =
			Object.keys(updateFields).some((key) => {
				const newValue = (updateFields as Record<string, unknown>)[key];
				const existingValue = (space as unknown as Record<string, unknown>)[key];

				// Deep comparison for arrays
				if (Array.isArray(newValue) && Array.isArray(existingValue)) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}

				// Deep comparison for plain objects
				if (
					typeof newValue === 'object' &&
					typeof existingValue === 'object' &&
					newValue !== null &&
					existingValue !== null
				) {
					return JSON.stringify(newValue) !== JSON.stringify(existingValue);
				}

				// Handle null/undefined comparison
				if (newValue === null && existingValue === null) {
					return false;
				}
				if (newValue === null || existingValue === null) {
					return true;
				}

				// Simple value comparison
				return newValue !== existingValue;
			}) ||
			(dtoInstance.parent_id !== undefined && space.parentId !== (dtoInstance.parent_id ?? null));

		Object.assign(space, updateFields);

		// Explicitly handle parent_id being set to null (toInstance with exposeUnsetFields:false drops null values)
		if (dtoInstance.parent_id === null) {
			space.parentId = null;
		}

		await this.repository.save(space);

		this.logger.debug(`Successfully updated space with id=${space.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.SPACE_UPDATED, space);
		}

		return space;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing space with id=${id}`);

		const space = await this.getOneOrThrow(id);

		await this.dataSource.transaction(async (manager) => {
			// Set parentId to null for all child spaces (rooms that belong to this zone)
			await manager
				.createQueryBuilder()
				.update(SpaceEntity)
				.set({ parentId: null })
				.where('parentId = :id', { id })
				.execute();

			// Set roomId to null for all devices in this space (if it's a room)
			await manager
				.createQueryBuilder()
				.update(DeviceEntity)
				.set({ roomId: null })
				.where('roomId = :id', { id })
				.execute();

			// Set spaceId to null for all displays in this space
			await manager
				.createQueryBuilder()
				.update(DisplayEntity)
				.set({ spaceId: null })
				.where('spaceId = :id', { id })
				.execute();

			await manager.remove(space);
		});

		this.logger.debug(`Successfully removed space with id=${id}`);

		this.eventEmitter.emit(EventType.SPACE_DELETED, { id });
	}

	async findDevicesBySpace(spaceId: string): Promise<DeviceEntity[]> {
		this.logger.debug(`Fetching devices for space with id=${spaceId}`);

		// Verify space exists
		const space = await this.getOneOrThrow(spaceId);

		if (space.type === SpaceType.ROOM) {
			// Rooms have directly assigned devices via roomId
			const devices = await this.deviceRepository.find({
				where: { roomId: spaceId },
				relations: ['channels', 'channels.properties'],
				order: { name: 'ASC' },
			});

			this.logger.debug(`Found ${devices.length} devices in room`);

			return devices;
		} else {
			// Zones have devices via junction table
			const devices = await this.deviceZonesService.getZoneDevices(spaceId);

			this.logger.debug(`Found ${devices.length} devices in zone`);

			return devices;
		}
	}

	async findDisplaysBySpace(spaceId: string): Promise<DisplayEntity[]> {
		this.logger.debug(`Fetching displays for space with id=${spaceId}`);

		// Verify space exists
		await this.getOneOrThrow(spaceId);

		const displays = await this.displayRepository.find({
			where: { roomId: spaceId },
			order: { name: 'ASC' },
		});

		this.logger.debug(`Found ${displays.length} displays in space`);

		return displays;
	}

	async bulkAssign(
		spaceId: string,
		bulkAssignDto: BulkAssignDto,
	): Promise<{ devicesAssigned: number; displaysAssigned: number }> {
		this.logger.debug(`Bulk assigning to space with id=${spaceId}`);

		// Verify space exists
		const space = await this.getOneOrThrow(spaceId);

		const dtoInstance = await this.validateDto(BulkAssignDto, bulkAssignDto);

		let devicesAssigned = 0;
		let displaysAssigned = 0;

		// Assign devices - only to rooms
		if (dtoInstance.deviceIds && dtoInstance.deviceIds.length > 0) {
			if (space.type !== SpaceType.ROOM) {
				throw new SpacesValidationException('Devices can only be assigned to rooms, not zones');
			}

			const result = await this.deviceRepository
				.createQueryBuilder()
				.update()
				.set({ roomId: spaceId })
				.where('id IN (:...ids)', { ids: dtoInstance.deviceIds })
				.execute();

			devicesAssigned = result.affected || 0;
			this.logger.debug(`Assigned ${devicesAssigned} devices to space`);
		}

		// Assign displays
		if (dtoInstance.displayIds && dtoInstance.displayIds.length > 0) {
			const result = await this.displayRepository
				.createQueryBuilder()
				.update()
				.set({ roomId: spaceId })
				.where('id IN (:...ids)', { ids: dtoInstance.displayIds })
				.execute();

			displaysAssigned = result.affected || 0;
			this.logger.debug(`Assigned ${displaysAssigned} displays to space`);
		}

		this.logger.debug(`Successfully bulk assigned to space with id=${spaceId}`);

		return { devicesAssigned, displaysAssigned };
	}

	async unassignDevices(deviceIds: string[]): Promise<number> {
		this.logger.debug(`Unassigning ${deviceIds.length} devices from their rooms`);

		if (deviceIds.length === 0) {
			return 0;
		}

		const result = await this.deviceRepository
			.createQueryBuilder()
			.update()
			.set({ roomId: null })
			.where('id IN (:...ids)', { ids: deviceIds })
			.execute();

		const unassigned = result.affected || 0;
		this.logger.debug(`Unassigned ${unassigned} devices`);

		return unassigned;
	}

	async unassignDisplays(displayIds: string[]): Promise<number> {
		this.logger.debug(`Unassigning ${displayIds.length} displays from their rooms`);

		if (displayIds.length === 0) {
			return 0;
		}

		const result = await this.displayRepository
			.createQueryBuilder()
			.update()
			.set({ roomId: null })
			.where('id IN (:...ids)', { ids: displayIds })
			.execute();

		const unassigned = result.affected || 0;
		this.logger.debug(`Unassigned ${unassigned} displays`);

		return unassigned;
	}

	async proposeSpaces(): Promise<
		{ name: string; type: SpaceType; category: SpaceCategory | null; deviceIds: string[]; deviceCount: number }[]
	> {
		this.logger.debug('Proposing spaces based on device names');

		// Token to (type, category) mapping for intelligent space proposals
		const tokenMapping: Record<string, { type: SpaceType; category: SpaceCategory | null }> = {
			// Room tokens
			'living room': { type: SpaceType.ROOM, category: SpaceRoomCategory.LIVING_ROOM },
			bedroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'master bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'guest bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'guest room': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'guests room': { type: SpaceType.ROOM, category: SpaceRoomCategory.GUEST_ROOM },
			'kids bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			'children bedroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BEDROOM },
			kitchen: { type: SpaceType.ROOM, category: SpaceRoomCategory.KITCHEN },
			bathroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			'master bathroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			'guest bathroom': { type: SpaceType.ROOM, category: SpaceRoomCategory.BATHROOM },
			toilet: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			wc: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			restroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			lavatory: { type: SpaceType.ROOM, category: SpaceRoomCategory.TOILET },
			hallway: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			hall: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			corridor: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			entrance: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			entry: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			entryway: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			foyer: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			vestibule: { type: SpaceType.ROOM, category: SpaceRoomCategory.ENTRYWAY },
			garage: { type: SpaceType.ROOM, category: SpaceRoomCategory.GARAGE },
			office: { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			'home office': { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			study: { type: SpaceType.ROOM, category: SpaceRoomCategory.OFFICE },
			'dining room': { type: SpaceType.ROOM, category: SpaceRoomCategory.DINING_ROOM },
			laundry: { type: SpaceType.ROOM, category: SpaceRoomCategory.LAUNDRY },
			'laundry room': { type: SpaceType.ROOM, category: SpaceRoomCategory.LAUNDRY },
			'utility room': { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			utility: { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			'boiler room': { type: SpaceType.ROOM, category: SpaceRoomCategory.UTILITY_ROOM },
			nursery: { type: SpaceType.ROOM, category: SpaceRoomCategory.NURSERY },
			playroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			'game room': { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			'media room': { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			theater: { type: SpaceType.ROOM, category: SpaceRoomCategory.MEDIA_ROOM },
			gym: { type: SpaceType.ROOM, category: SpaceRoomCategory.GYM },
			workshop: { type: SpaceType.ROOM, category: SpaceRoomCategory.WORKSHOP },
			closet: { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			'walk-in closet': { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			wardrobe: { type: SpaceType.ROOM, category: SpaceRoomCategory.CLOSET },
			pantry: { type: SpaceType.ROOM, category: SpaceRoomCategory.PANTRY },
			storage: { type: SpaceType.ROOM, category: SpaceRoomCategory.STORAGE },
			'storage room': { type: SpaceType.ROOM, category: SpaceRoomCategory.STORAGE },
			mudroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.HALLWAY },
			sunroom: { type: SpaceType.ROOM, category: SpaceRoomCategory.LIVING_ROOM },
			sauna: { type: SpaceType.ROOM, category: SpaceRoomCategory.OTHER },
			// Zone tokens
			basement: { type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_BASEMENT },
			attic: { type: SpaceType.ZONE, category: SpaceZoneCategory.FLOOR_ATTIC },
			patio: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			balcony: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BALCONY },
			terrace: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			garden: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_GARDEN },
			backyard: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BACKYARD },
			'front yard': { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_FRONT_YARD },
			porch: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_TERRACE },
			pool: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_BACKYARD },
			spa: { type: SpaceType.ROOM, category: SpaceRoomCategory.OTHER },
			driveway: { type: SpaceType.ZONE, category: SpaceZoneCategory.OUTDOOR_DRIVEWAY },
		};

		const tokens = Object.keys(tokenMapping);

		// Get all devices (including those already assigned, for completeness)
		const devices = await this.deviceRepository.find({
			select: ['id', 'name'],
		});

		// Map to store space token -> device IDs
		const spaceMap = new Map<string, string[]>();

		for (const device of devices) {
			const deviceNameLower = device.name.toLowerCase();

			// Try to match room tokens in device name (prefer longest match)
			let matchedToken: string | null = null;
			let matchLength = 0;

			for (const token of tokens) {
				if (deviceNameLower.includes(token) && token.length > matchLength) {
					matchedToken = token;
					matchLength = token.length;
				}
			}

			if (matchedToken) {
				const existingDevices = spaceMap.get(matchedToken) ?? [];
				existingDevices.push(device.id);
				spaceMap.set(matchedToken, existingDevices);
			}
		}

		// Convert map to array and sort by device count (descending)
		const proposals = Array.from(spaceMap.entries())
			.map(([token, deviceIds]) => {
				const mapping = tokenMapping[token];
				// Capitalize the token for display name
				const name = token
					.split(' ')
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ');

				return {
					name,
					type: mapping.type,
					category: mapping.category,
					deviceIds,
					deviceCount: deviceIds.length,
				};
			})
			.sort((a, b) => b.deviceCount - a.deviceCount);

		this.logger.debug(`Proposed ${proposals.length} spaces from device names`);

		return proposals;
	}

	/**
	 * Get child rooms for a zone
	 */
	async getChildRooms(zoneId: string): Promise<SpaceEntity[]> {
		this.logger.debug(`Fetching child rooms for zone id=${zoneId}`);

		const zone = await this.getOneOrThrow(zoneId);

		if (zone.type !== SpaceType.ZONE) {
			this.logger.warn(`Space ${zoneId} is not a zone, returning empty list`);
			return [];
		}

		const children = await this.repository.find({
			where: { parentId: zoneId, type: SpaceType.ROOM },
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${children.length} child rooms for zone`);

		return children;
	}

	/**
	 * Get parent zone for a room
	 */
	async getParentZone(roomId: string): Promise<SpaceEntity | null> {
		this.logger.debug(`Fetching parent zone for room id=${roomId}`);

		const room = await this.getOneOrThrow(roomId);

		if (!room.parentId) {
			this.logger.debug(`Room ${roomId} has no parent zone`);
			return null;
		}

		const parent = await this.findOne(room.parentId);

		return parent;
	}

	/**
	 * Get all zones (for parent selection dropdown)
	 */
	async findAllZones(): Promise<SpaceEntity[]> {
		this.logger.debug('Fetching all zones');

		const zones = await this.repository.find({
			where: { type: SpaceType.ZONE },
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${zones.length} zones`);

		return zones;
	}

	/**
	 * Validate parent assignment for a space
	 * - Zones cannot have a parent
	 * - Rooms can only have a zone as parent
	 * - Cannot assign self as parent
	 */
	private async validateParentAssignment(
		spaceType: SpaceType,
		parentId: string | null,
		currentSpaceId?: string,
	): Promise<void> {
		if (parentId === null) {
			return;
		}

		// Zones cannot have a parent
		if (spaceType === SpaceType.ZONE) {
			this.logger.error('Zones cannot have a parent');
			throw new SpacesValidationException('Zones cannot have a parent. Only rooms can belong to a zone.');
		}

		// Cannot assign self as parent
		if (currentSpaceId && parentId === currentSpaceId) {
			this.logger.error('Cannot assign space as its own parent');
			throw new SpacesValidationException('A space cannot be its own parent.');
		}

		// Parent must exist and be a zone
		const parent = await this.findOne(parentId);

		if (!parent) {
			this.logger.error(`Parent space with id=${parentId} not found`);
			throw new SpacesNotFoundException('Parent space does not exist.');
		}

		if (parent.type !== SpaceType.ZONE) {
			this.logger.error(`Parent space ${parentId} is not a zone`);
			throw new SpacesValidationException('Parent must be a zone. Rooms can only belong to zones.');
		}
	}

	private async validateDto<T extends object>(DtoClass: new () => T, dto: any): Promise<T> {
		const dtoInstance = toInstance(DtoClass, dto, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed: ${JSON.stringify(errors)}`);

			throw new SpacesValidationException('Provided space data is invalid.');
		}

		return dtoInstance;
	}
}
