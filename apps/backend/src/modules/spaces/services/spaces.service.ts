import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, In, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
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
	SpaceRoomCategory,
	SpaceType,
	SpaceZoneCategory,
	isValidCategoryForType,
} from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';
import { canonicalizeSpaceName } from '../spaces.utils';

import { SpaceCreateBuilderRegistryService } from './space-create-builder-registry.service';
import { SpaceRelationsLoaderRegistryService } from './space-relations-loader-registry.service';
import { SpacesTypeMapperService } from './spaces-type-mapper.service';

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
		private readonly deviceZonesService: DeviceZonesService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
		private readonly spacesTypeMapper: SpacesTypeMapperService,
		private readonly relationsRegistry: SpaceRelationsLoaderRegistryService,
		private readonly createBuilderRegistry: SpaceCreateBuilderRegistryService,
	) {}

	async findAll(): Promise<SpaceEntity[]> {
		this.logger.debug('Fetching all spaces');

		const spaces = await this.repository.find({
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${spaces.length} spaces`);

		await Promise.all(spaces.map((space) => this.loadRelations(space)));

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

		await this.loadRelations(space);

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
		// Bypass findAll() here: relation loaders aren't needed for name matching,
		// and create() hits this for every insert — avoid the N×M loader fan-out.
		const candidates = await this.repository.find({ select: ['id', 'name'] });
		const match = candidates.find((space) => canonicalizeSpaceName(space.name) === canonicalName);
		if (!match) {
			return null;
		}
		return this.findOne(match.id);
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

		const type = dtoInstance.type;
		const category = dtoInstance.category ?? null;

		// Zones must have a category
		if (type === SpaceType.ZONE && category === null) {
			this.logger.error('Zone must have a category');
			throw new SpacesValidationException('Category is required for zones.');
		}

		// Validate parent assignment
		await this.validateParentAssignment(type, dtoInstance.parent_id ?? null);

		// Instantiate the concrete subtype via the plugin mapper so TableInheritance writes the correct discriminator.
		// We obtain a repository scoped to the subclass — calling `this.repository.create()` on the base
		// SpaceEntity repo would do `new SpaceEntity()` + Object.assign, which discards the concrete class
		// (and won't copy the prototype-only `type` getter), so TypeORM would write a null/incorrect
		// discriminator on save.
		const mapping = this.spacesTypeMapper.getMapping(type);
		const subtypeRepository = this.dataSource.getRepository(mapping.class);
		const space = subtypeRepository.create(
			toInstance(mapping.class, {
				...dtoInstance,
				category,
			}),
		);

		for (const builder of this.createBuilderRegistry.getBuilders()) {
			if (builder.supports(dtoInstance)) {
				await builder.build(dtoInstance, space);
			}
		}

		await subtypeRepository.save(space);

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
		const effectiveType: SpaceType = dtoInstance.type ?? space.type;

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

		// Build the update object
		const updateData = {
			...dtoInstance,
		};

		// Get the fields to update from DTO (excluding undefined values).
		// Use the *effective* type's mapping so that when a subtype change adds new
		// @Expose'd fields, those fields survive `toInstance` and land in the raw
		// update below. Using `space.type` here would use the OLD subtype's class
		// and silently drop new-subtype-specific fields.
		const mapping = this.spacesTypeMapper.getMapping(effectiveType);
		const updateFields = omitBy(toInstance(mapping.class, updateData), isUndefined);

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

		// When the space type changes we cannot just save the existing entity instance —
		// TableInheritance keys off the concrete class (RoomSpaceEntity vs ZoneSpaceEntity),
		// and the `type` getter is immutable on an already-loaded instance. Update the
		// discriminator column directly via a raw update, then reload as the new subtype.
		const typeChanged = effectiveType !== space.type;
		if (typeChanged) {
			// The `parent_id` transform on the DTO collapses null into undefined, so an
			// explicit null clear would be dropped by `omitBy(..., isUndefined)` above.
			// Mirror the in-memory fix-up for the raw update set().
			const rawUpdate: Record<string, unknown> = { ...updateFields, type: effectiveType };
			if (dtoInstance.parent_id === null) {
				rawUpdate.parentId = null;
			}
			await this.repository.createQueryBuilder().update(SpaceEntity).set(rawUpdate).where('id = :id', { id }).execute();
			const reloaded = await this.getOneOrThrow(id);
			// A type change is always a semantically-meaningful update even when no other
			// field changed: the entity's concrete subtype (and therefore any subscriber
			// branching on it) has flipped, so downstream listeners must be notified.
			this.eventEmitter.emit(EventType.SPACE_UPDATED, reloaded);
			return reloaded;
		}

		await this.repository.save(space);

		// Re-fetch so registered relation loaders reflect post-save entity state
		// (e.g. loaders keyed on mutable fields like `category`). Matches the
		// type-change path above and create().
		const updatedSpace = await this.getOneOrThrow(id);

		this.logger.debug(`Successfully updated space with id=${updatedSpace.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.SPACE_UPDATED, updatedSpace);
		}

		return updatedSpace;
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

			// Set roomId to null for all displays in this space
			await manager
				.createQueryBuilder()
				.update(DisplayEntity)
				.set({ roomId: null })
				.where('roomId = :id', { id })
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

	/**
	 * Find multiple devices by their IDs
	 * Returns devices with channels and properties loaded
	 */
	async findDevicesByIds(deviceIds: string[]): Promise<DeviceEntity[]> {
		if (deviceIds.length === 0) {
			return [];
		}

		this.logger.debug(`Fetching ${deviceIds.length} devices by IDs`);

		const devices = await this.deviceRepository.find({
			where: { id: In(deviceIds) },
			relations: ['channels', 'channels.properties'],
		});

		this.logger.debug(`Found ${devices.length} of ${deviceIds.length} requested devices`);

		return devices;
	}

	/**
	 * Check if a device belongs to a space (room or zone)
	 * - For rooms: checks device.roomId
	 * - For zones: checks the zone-device junction table
	 */
	async isDeviceInSpace(spaceId: string, deviceId: string): Promise<boolean> {
		const space = await this.getOneOrThrow(spaceId);

		if (space.type === SpaceType.ROOM) {
			// For rooms, check device.roomId
			const device = await this.deviceRepository.findOne({
				where: { id: deviceId, roomId: spaceId },
			});
			return device !== null;
		} else {
			// For zones, check the junction table
			const zoneDevices = await this.deviceZonesService.getZoneDevices(spaceId);
			return zoneDevices.some((d) => d.id === deviceId);
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

			// Emit DEVICE_UPDATED events so connected clients (panel) learn
			// about the room-assignment change and can refresh derived data
			// (e.g. media endpoints).
			if (devicesAssigned > 0) {
				const updatedDevices = await this.deviceRepository.find({
					where: { id: In(dtoInstance.deviceIds) },
				});

				for (const device of updatedDevices) {
					this.eventEmitter.emit(DevicesEventType.DEVICE_UPDATED, device);
				}
			}
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

		// Emit DEVICE_UPDATED events so connected clients refresh derived data
		if (unassigned > 0) {
			const updatedDevices = await this.deviceRepository.find({
				where: { id: In(deviceIds) },
			});

			for (const device of updatedDevices) {
				this.eventEmitter.emit(DevicesEventType.DEVICE_UPDATED, device);
			}
		}

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
		{
			name: string;
			type: SpaceType;
			category: SpaceRoomCategory | SpaceZoneCategory | null;
			deviceIds: string[];
			deviceCount: number;
		}[]
	> {
		this.logger.debug('Proposing spaces based on device names');

		// Token to (type, category) mapping for intelligent space proposals
		const tokenMapping: Record<string, { type: SpaceType; category: SpaceRoomCategory | SpaceZoneCategory | null }> = {
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

		// Use the Room subtype's repository to filter by discriminator. TableInheritance
		// excludes `type` from ordinary column metadata (see TypeORM #3261), so
		// `repository.find({ where: { type: ... } })` on the base SpaceEntity repo is a
		// silent no-op. The subtype repository scopes to the right discriminator.
		const roomMapping = this.spacesTypeMapper.getMapping(SpaceType.ROOM);
		const children = await this.dataSource.getRepository(roomMapping.class).find({
			where: { parentId: zoneId },
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${children.length} child rooms for zone`);

		await Promise.all(children.map((child) => this.loadRelations(child)));

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

		// Same reason as getChildRooms: query via the subtype-specific repository
		// rather than filtering `type` on the base repo.
		const zoneMapping = this.spacesTypeMapper.getMapping(SpaceType.ZONE);
		const zones = await this.dataSource.getRepository(zoneMapping.class).find({
			order: { displayOrder: 'ASC', name: 'ASC' },
		});

		this.logger.debug(`Found ${zones.length} zones`);

		await Promise.all(zones.map((zone) => this.loadRelations(zone)));

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

		// Parent must exist and be a zone. Bypass `findOne()` to skip relation loaders;
		// also avoid `select: ['id', 'type']` because TableInheritance excludes the
		// discriminator from column metadata (TypeORM #3261), which would prevent
		// subtype resolution and trigger the base getter's throw. A full row fetch
		// by primary key is cheap.
		const parent = await this.repository.findOne({ where: { id: parentId } });

		if (!parent) {
			this.logger.error(`Parent space with id=${parentId} not found`);
			throw new SpacesNotFoundException('Parent space does not exist.');
		}

		if (parent.type !== SpaceType.ZONE) {
			this.logger.error(`Parent space ${parentId} is not a zone`);
			throw new SpacesValidationException('Parent must be a zone. Rooms can only belong to zones.');
		}
	}

	private async loadRelations(space: SpaceEntity): Promise<void> {
		for (const loader of this.relationsRegistry.getLoaders()) {
			if (loader.supports(space)) {
				await loader.loadRelations(space);
			}
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
