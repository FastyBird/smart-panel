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
import { EventType, SPACES_MODULE_NAME, SpaceType, isValidCategoryForType } from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';
import { canonicalizeSpaceName } from '../spaces.utils';

import { SpaceTypeMapping, SpacesTypeMapperService } from './spaces-type-mapper.service';

/**
 * Narrow check for whether a subtype mapping owns a given shared-STI-table
 * column. Kept as a module-level helper so the `Readonly<Record<string, unknown>>`
 * default doesn't collapse to `any` through the generic `getMapping<>()`
 * return type.
 */
function subtypeOwnsColumn(
	mapping: SpaceTypeMapping<SpaceEntity, CreateSpaceDto, UpdateSpaceDto>,
	column: string,
): boolean {
	const columns = mapping.subtypeColumns;
	return columns !== undefined && Object.hasOwn(columns, column);
}

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

		// The caller supplies `type` on the incoming DTO. Dispatch through the
		// type mapper so each subtype gets validated against its own DTO —
		// home-control types (room/zone) carry category / suggestions_enabled /
		// status_widgets that do not exist on master/entry/signage DTOs, and
		// the base `CreateSpaceDto` whitelist would reject them.
		const rawType = (createDto as Partial<CreateSpaceDto> | null | undefined)?.type;
		if (!rawType || !Object.values(SpaceType).includes(rawType)) {
			this.logger.error(`Missing or unknown space type on create: ${String(rawType)}`);
			throw new SpacesValidationException('A valid space type is required.');
		}

		const mapping = this.spacesTypeMapper.getMapping(rawType);
		const dtoInstance = await this.validateDto(mapping.createDto as new () => CreateSpaceDto, createDto);

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
		const rawCategory = (dtoInstance as { category?: string | null }).category;
		const category: string | null = rawCategory ?? null;

		// Zones must have a category
		if (type === SpaceType.ZONE && category === null) {
			this.logger.error('Zone must have a category');
			throw new SpacesValidationException('Category is required for zones.');
		}

		// Validate that the category matches the space type (blocks e.g. creating a
		// ROOM with a zone category, or a MASTER/ENTRY singleton with any category).
		// `update()` has this check; `create()` was missing it.
		if (category !== null && !isValidCategoryForType(category, type)) {
			this.logger.error(`Category '${category}' is not valid for type '${type}'`);
			throw new SpacesValidationException(`Category '${category}' is not valid for space type '${type}'.`);
		}

		// Validate parent assignment
		await this.validateParentAssignment(type, dtoInstance.parent_id ?? null);

		// Instantiate the concrete subtype via the plugin mapper so TableInheritance writes the correct discriminator.
		// We obtain a repository scoped to the subclass — calling `this.repository.create()` on the base
		// SpaceEntity repo would do `new SpaceEntity()` + Object.assign, which discards the concrete class
		// (and won't copy the prototype-only `type` getter), so TypeORM would write a null/incorrect
		// discriminator on save.
		const subtypeRepository = this.dataSource.getRepository(mapping.class);

		// Singleton space types (master, entry, and any future plugin-contributed
		// singleton) are seeded once per install and must not be duplicatable via
		// `POST /spaces`. The seeder handles first-boot creation; reject any
		// subsequent attempt.
		if (mapping.singleton) {
			const existing = await subtypeRepository.findOne({ where: {} });
			if (existing) {
				this.logger.error(`Cannot create a second space of singleton type '${type}' (existing id=${existing.id})`);
				throw new SpacesValidationException(
					`Space type '${type}' is a singleton and already exists. Edit the existing space instead of creating a new one.`,
				);
			}
		}

		const space = subtypeRepository.create(
			toInstance(mapping.class, {
				...dtoInstance,
				category,
			}),
		);

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

		// Dispatch to the per-type update DTO so subtype-specific fields
		// (category / suggestions_enabled / status_widgets on home-control
		// rooms/zones) are preserved under the forbidNonWhitelisted guard.
		// The effective type is whatever the caller provides, otherwise the
		// existing space's type.
		const rawType = (updateDto as Partial<UpdateSpaceDto> | null | undefined)?.type ?? space.type;
		if (!Object.values(SpaceType).includes(rawType)) {
			this.logger.error(`Unknown space type on update: ${String(rawType)}`);
			throw new SpacesValidationException('A valid space type is required.');
		}

		const effectiveMapping = this.spacesTypeMapper.getMapping<SpaceEntity, CreateSpaceDto, UpdateSpaceDto>(rawType);
		const dtoInstance = await this.validateDto(effectiveMapping.updateDto as new () => UpdateSpaceDto, updateDto);

		// Effective type equals `rawType`. The `UpdateSpaceDto.type` transform
		// only coerces `null → undefined`, so after validation
		// `dtoInstance.type ?? space.type` resolves to the same value the
		// pre-validation `rawType` captured — no second `getMapping()` lookup
		// is needed.
		const effectiveType: SpaceType = rawType;
		const targetAcceptsCategory = subtypeOwnsColumn(effectiveMapping, 'category');

		// Determine the effective category. Three cases, in order:
		//
		// 1. DTO provided a value (including explicit null) — honor the caller's
		//    intent verbatim.
		// 2. Target subtype doesn't whitelist `category` (e.g. master/entry/
		//    signage after a type change from room/zone) — treat as null. Without
		//    this, stored room/zone categories would leak into the compat check
		//    against a non-home-control type and the update would fail, and
		//    since the target DTO doesn't accept `category` the client can't
		//    clear it in the same PATCH. One-step conversions must work.
		// 3. Target is home-control and DTO omitted — preserve the stored value.
		//    Prefer the subtype-hydrated property; fall back to a raw column
		//    read only when the source subtype didn't declare the column (legacy
		//    rows written before the column moved). This gates the extra SQL
		//    round-trip to the rare legacy-row case instead of every update.
		const dtoCategory = (dtoInstance as { category?: unknown }).category;
		let effectiveCategory: string | null;
		if (dtoCategory !== undefined) {
			effectiveCategory = dtoCategory as string | null;
		} else if (!targetAcceptsCategory) {
			effectiveCategory = null;
		} else if ((space as { category?: unknown }).category !== undefined) {
			effectiveCategory = ((space as { category?: unknown }).category ?? null) as string | null;
		} else {
			effectiveCategory = await this.readRawSpaceCategory(id);
		}

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
		// Use the *effective* type's mapping (resolved earlier for the category
		// check) so that when a subtype change adds new @Expose'd fields, those
		// fields survive `toInstance` and land in the raw update below. Using
		// `space.type` here would use the OLD subtype's class and silently drop
		// new-subtype-specific fields.
		const updateFields = omitBy(toInstance(effectiveMapping.class, updateData), isUndefined);

		// Decide type-change BEFORE any in-memory mutation. `space.type` is a
		// prototype-only getter today, so computing after `Object.assign(space, ...)`
		// happens to work — but it's fragile: any future change that makes `type` an
		// own property (e.g. a different serialization library or a `@Column` being
		// re-introduced) would let Object.assign shadow the getter and make this
		// comparison silently return `false`, skipping the raw discriminator update.
		const typeChanged = effectiveType !== space.type;
		// Resolve the *old* subtype mapping once up front when the type is
		// changing — reused by the singleton guard below and the stale-column
		// wipe in the later `if (typeChanged)` raw-UPDATE block.
		const oldMapping = typeChanged
			? this.spacesTypeMapper.getMapping<SpaceEntity, CreateSpaceDto, UpdateSpaceDto>(space.type)
			: null;

		// Singleton space types (master, entry, future plugin-contributed singletons)
		// must not be reachable via a type change in either direction — flipping a
		// room into a master would violate the "exactly one per install" invariant
		// the seeders and reset handlers depend on, and flipping an existing singleton
		// away would destroy it outright. The only supported lifecycle for a singleton
		// is: seeder creates once, admin edits in place.
		if (typeChanged && oldMapping) {
			if (oldMapping.singleton) {
				this.logger.error(`Cannot change type away from singleton '${space.type}' (space id=${id})`);
				throw new SpacesValidationException(
					`Space type '${space.type}' is a singleton and cannot be converted to another type.`,
				);
			}
			if (effectiveMapping.singleton) {
				this.logger.error(`Cannot change type to singleton '${effectiveType}' (space id=${id})`);
				throw new SpacesValidationException(
					`Space type '${effectiveType}' is a singleton and cannot be assigned via a type change. The singleton is created by its seeder.`,
				);
			}
		}

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
		if (typeChanged) {
			// `toInstance(mapping.class, ...)` applies every @Expose()'d property on the
			// entity, including relations (`parent`, `children`) and read-only columns
			// (`createdAt`, `lastActivityAt`). TypeORM's `QueryBuilder.set()` will reject
			// relation keys and happily overwrite read-only columns if they sneak in.
			// Filter to actual @Column property names from the repository metadata so the
			// raw UPDATE only touches real data columns.
			// Pull column metadata from the *effective* subtype repository so the
			// UPDATE set also includes columns that only the target subtype declares
			// (e.g. home-control's category / suggestionsEnabled / statusWidgets live
			// on RoomSpaceEntity / ZoneSpaceEntity, not the abstract base).
			const columnPropertyNames = new Set(
				this.dataSource.getRepository(effectiveMapping.class).metadata.columns.map((col) => col.propertyName),
			);
			const rawUpdate: Record<string, unknown> = { type: effectiveType };
			for (const [key, value] of Object.entries(updateFields)) {
				if (columnPropertyNames.has(key)) {
					rawUpdate[key] = value;
				}
			}
			// The `parent_id` transform on the DTO collapses null into undefined, so an
			// explicit null clear would be dropped by `omitBy(..., isUndefined)` above.
			// Mirror the in-memory fix-up for the raw update set().
			if (dtoInstance.parent_id === null) {
				rawUpdate.parentId = null;
			}
			// Pin `category` to the compat-checked `effectiveCategory`. If the
			// target subtype accepts category this persists whatever the compat
			// check endorsed; if the target doesn't accept it the value is null
			// (forced above) and the stale stored value gets wiped.
			if (!Object.prototype.hasOwnProperty.call(rawUpdate, 'category')) {
				rawUpdate.category = effectiveCategory;
			}
			// Generalized wipe: any column the OLD subtype owned but the NEW
			// subtype doesn't must be reset, otherwise stale values survive
			// on the shared STI table with no way for the client to clear
			// them (the new type's DTO doesn't whitelist those fields).
			// `category` is handled above; this loop covers the rest (e.g.
			// home-control's `suggestionsEnabled` + `statusWidgets` when
			// flipping away to master/entry/signage).
			//
			// The wipe value is plugin-declared because NOT NULL columns need
			// their column default (e.g. `suggestionsEnabled` → `true`),
			// whereas nullable columns can use `null`. Writing a blind `null`
			// across the board would violate NOT NULL constraints on the
			// shared table and surface as a 500.
			//
			// `oldMapping` is hoisted above the first `typeChanged` block; it's
			// guaranteed non-null here because this branch is gated on the same
			// `typeChanged` flag.
			const oldColumns = oldMapping?.subtypeColumns ?? {};
			for (const column of Object.keys(oldColumns)) {
				if (!subtypeOwnsColumn(effectiveMapping, column) && !Object.hasOwn(rawUpdate, column)) {
					rawUpdate[column] = oldColumns[column];
				}
			}
			// Wrap the raw discriminator UPDATE and the subsequent reload in a single
			// transaction so a concurrent update or delete cannot wedge us into a state
			// where the UPDATE committed but the reload observes stale / missing data.
			const reloaded = await this.dataSource.transaction(async (transactionalManager) => {
				await transactionalManager
					.createQueryBuilder()
					.update(SpaceEntity)
					.set(rawUpdate)
					.where('id = :id', { id })
					.execute();
				const fresh = await transactionalManager.findOne(SpaceEntity, { where: { id } });
				if (!fresh) {
					this.logger.error(`Space with id=${id} disappeared during type-change UPDATE`);
					throw new SpacesNotFoundException('Requested space does not exist');
				}
				return fresh;
			});
			// A type change is always a semantically-meaningful update even when no other
			// field changed: the entity's concrete subtype (and therefore any subscriber
			// branching on it) has flipped, so downstream listeners must be notified.
			this.eventEmitter.emit(EventType.SPACE_UPDATED, reloaded);
			return reloaded;
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

			// Unassign any displays pointing at this space. Displays now point
			// at any space type (Phase 5 dropped the role=room constraint), so
			// cleanup is not room-specific.
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
			where: { spaceId },
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
				.set({ spaceId })
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
		this.logger.debug(`Unassigning ${displayIds.length} displays from their spaces`);

		if (displayIds.length === 0) {
			return 0;
		}

		const result = await this.displayRepository
			.createQueryBuilder()
			.update()
			.set({ spaceId: null })
			.where('id IN (:...ids)', { ids: displayIds })
			.execute();

		const unassigned = result.affected || 0;
		this.logger.debug(`Unassigned ${unassigned} displays`);

		return unassigned;
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

		// Only rooms participate in the zone→room hierarchy. Zones are root-level,
		// and synthetic singletons (master, entry) — as well as any future
		// plugin-contributed space types — are also always root-level unless they
		// opt in to the hierarchy. Using an allowlist here means new space types
		// default to the safe "no parent allowed" behavior.
		if (spaceType !== SpaceType.ROOM) {
			this.logger.error(`Spaces of type '${spaceType}' cannot have a parent`);
			throw new SpacesValidationException(
				`Spaces of type '${spaceType}' cannot have a parent. Only rooms can belong to a zone.`,
			);
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

	/**
	 * Read the `category` column straight from the shared physical table,
	 * bypassing TypeORM's subtype hydration. Non-home-control entities
	 * (master/entry/signage) don't declare `@Column() category`, so loading
	 * them as a concrete subtype yields `space.category === undefined` even
	 * when the underlying row still carries a value written before this
	 * column moved off the abstract base. The update flow needs the real
	 * stored value to run an honest category/type compatibility check.
	 */
	private async readRawSpaceCategory(id: string): Promise<string | null> {
		const rows = await this.dataSource.query<{ category: string | null }[]>(
			'SELECT category FROM spaces_module_spaces WHERE id = ? LIMIT 1',
			[id],
		);
		return rows[0]?.category ?? null;
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
