import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance, toSnakeCase, toSnakeCaseKeys } from '../../../common/utils/transform.utils';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import {
	DEVICES_MODULE_NAME,
	DEVICE_PLACEMENT_LOCKED_MESSAGE,
	DeviceHiddenFilter,
	EventType,
} from '../devices.constants';
import {
	DevicesException,
	DevicesNotAllowedException,
	DevicesNotFoundException,
	DevicesValidationException,
} from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { ChannelEntity, DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceZonesService } from './device-zones.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesControlsService } from './devices.controls.service';

export interface VisibleDeviceSummaryScope {
	roomIds?: string[];
	zoneId?: string;
}

export interface VisibleDeviceSummaryPage {
	devices: DeviceEntity[];
	total: number;
}

export interface VisibleDeviceSpaceCounts {
	rooms: Record<string, number>;
	zones: Record<string, number>;
	floors: Record<string, number>;
}

export interface VisibleBoundedDeviceState {
	devices: DeviceEntity[];
	devicesTruncated: boolean;
	channelsTruncated: boolean;
	propertiesTruncated: boolean;
}

/**
 * Whether a driver error is the database refusing a duplicate key.
 *
 * Matched on the message because that is all the sqlite driver gives: TypeORM wraps it in a
 * `QueryFailedError` whose `driverError` carries the text, and the two phrasings below are the ones
 * SQLite uses for a primary-key collision across the versions this app runs on. The HTTP layer's
 * `QueryFailedExceptionFilter` matches the same string for the same reason; this needs the answer
 * *before* the exception leaves the service, to report it as the domain refusal it is.
 */
const isUniqueConstraintViolation = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	const driverMessage = (error as { driverError?: { message?: string } }).driverError?.message ?? '';
	const message = `${error.message} ${driverMessage}`;

	return message.includes('UNIQUE constraint failed') || message.includes('PRIMARY KEY must be unique');
};

@Injectable()
export class DevicesService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DevicesService');

	constructor(
		@InjectRepository(DeviceEntity)
		private readonly repository: Repository<DeviceEntity>,
		@InjectRepository(SpaceEntity)
		private readonly spaceRepository: Repository<SpaceEntity>,
		private readonly devicesMapperService: DevicesTypeMapperService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly devicesControlsService: DevicesControlsService,
		private readonly deviceZonesService: DeviceZonesService,
		private readonly dataSource: DataSource,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async getCount<TDevice extends DeviceEntity>(type?: string): Promise<number> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('Fetching all devices count');

		const devices = await repository.count();

		this.logger.debug(`Found that in system is ${devices} devices`);

		return devices;
	}

	async getAllIds(): Promise<DeviceEntity['id'][]> {
		this.logger.debug('Fetching all device IDs');

		const rows: { id: string }[] = await this.repository
			.createQueryBuilder('device')
			.select('device.id', 'id')
			.getRawMany();

		this.logger.debug(`Found ${rows.length} device IDs`);

		return rows.map((r) => r.id);
	}

	// Devices
	async findAll<TDevice extends DeviceEntity>(
		type?: string,
		hidden: DeviceHiddenFilter = DeviceHiddenFilter.ALL,
	): Promise<TDevice[]> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug('Fetching all devices');

		// Cast to the base repository type: `hidden` is declared on DeviceEntity itself, but TypeScript
		// cannot verify a `where` clause referencing it against the generic, union-typed `repository`
		// (Repository<DeviceEntity> | Repository<TDevice>) without this annotation.
		const devices = (await (repository as Repository<DeviceEntity>).find({
			...(hidden === DeviceHiddenFilter.ALL ? {} : { where: { hidden: hidden === DeviceHiddenFilter.TRUE } }),
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
		})) as TDevice[];

		this.logger.debug(`Found ${devices.length} devices`);

		return devices;
	}

	async findVisibleSummaryPage(
		limit: number,
		scope: VisibleDeviceSummaryScope = {},
	): Promise<VisibleDeviceSummaryPage> {
		if (scope.roomIds?.length === 0) {
			return { devices: [], total: 0 };
		}

		const query = this.repository
			.createQueryBuilder('device')
			.leftJoinAndSelect('device.deviceZones', 'deviceZones')
			.where('device.hidden = :hidden', { hidden: false })
			.orderBy('device.name', 'ASC')
			.callListeners(false)
			.take(limit);

		if (scope.roomIds) {
			query.andWhere('device.roomId IN (:...roomIds)', { roomIds: scope.roomIds });
		}

		if (scope.zoneId) {
			query.innerJoin('device.deviceZones', 'scopeDeviceZone', 'scopeDeviceZone.zoneId = :zoneId', {
				zoneId: scope.zoneId,
			});
		}

		const [devices, total] = await query.getManyAndCount();

		return { devices, total };
	}

	async findVisibleSummaryById(id: string): Promise<DeviceEntity | null> {
		return this.repository
			.createQueryBuilder('device')
			.leftJoinAndSelect('device.deviceZones', 'deviceZones')
			.where('device.id = :id', { id })
			.andWhere('device.hidden = :hidden', { hidden: false })
			.callListeners(false)
			.getOne();
	}

	async findVisibleBoundedStateByChannelCategories(
		channelCategories: string[],
		deviceLimit: number,
		channelLimit: number,
		propertyLimit: number,
		scope: VisibleDeviceSummaryScope = {},
		propertyCategories?: string[],
	): Promise<VisibleBoundedDeviceState> {
		if (channelCategories.length === 0 || scope.roomIds?.length === 0) {
			return {
				devices: [],
				devicesTruncated: false,
				channelsTruncated: false,
				propertiesTruncated: false,
			};
		}

		interface DeviceIdRow {
			id: string;
		}

		const categoryPlaceholders = channelCategories.map(() => '?').join(', ');
		const parameters: Array<string | number> = [...channelCategories];
		let scopeJoin = '';
		let scopePredicate = '';

		if (scope.roomIds) {
			const roomPlaceholders = scope.roomIds.map(() => '?').join(', ');
			scopePredicate = ` AND device."roomId" IN (${roomPlaceholders})`;
			parameters.push(...scope.roomIds);
		} else if (scope.zoneId) {
			scopeJoin = ' INNER JOIN devices_module_devices_zones deviceZone ON deviceZone."deviceId" = device."id"';
			scopePredicate = ' AND deviceZone."zoneId" = ?';
			parameters.push(scope.zoneId);
		}
		parameters.push(deviceLimit + 1);
		const idRows = await this.dataSource.query<DeviceIdRow[]>(
			`SELECT DISTINCT device."id" AS "id", device."name" AS "name"
			 FROM devices_module_devices device
			 INNER JOIN devices_module_channels channel ON channel."deviceId" = device."id"
			 ${scopeJoin}
			 WHERE device."hidden" = 0
			 AND channel."category" IN (${categoryPlaceholders})
			 ${scopePredicate}
			 ORDER BY device."name", device."id"
			 LIMIT ?`,
			parameters,
		);
		const deviceIds = idRows.slice(0, deviceLimit).map((row) => row.id);
		const devicesTruncated = idRows.length > deviceLimit;

		if (deviceIds.length === 0) {
			return {
				devices: [],
				devicesTruncated,
				channelsTruncated: false,
				propertiesTruncated: false,
			};
		}

		const [devices, channelPage] = await Promise.all([
			this.repository
				.createQueryBuilder('device')
				.leftJoinAndSelect('device.deviceZones', 'deviceZones')
				.where('device.id IN (:...deviceIds)', { deviceIds })
				.callListeners(false)
				.getMany(),
			this.channelsService.findBoundedForDevices(deviceIds, channelCategories, channelLimit),
		]);
		const properties = await this.channelsPropertiesService.findBoundedForChannels(
			channelPage.channels.map((channel) => channel.id),
			propertyLimit,
			true,
			propertyCategories,
		);
		const propertiesByChannel = new Map<string, ChannelEntity['properties']>();

		for (const property of properties.properties) {
			const channelId = typeof property.channel === 'string' ? property.channel : property.channel.id;
			propertiesByChannel.set(channelId, [...(propertiesByChannel.get(channelId) ?? []), property]);
		}
		const channelsByDevice = new Map<string, ChannelEntity[]>();

		for (const channel of channelPage.channels) {
			channel.properties = propertiesByChannel.get(channel.id) ?? [];
			const deviceId = channelPage.deviceIds[channel.id];

			if (!deviceId) {
				continue;
			}
			channelsByDevice.set(deviceId, [...(channelsByDevice.get(deviceId) ?? []), channel]);
		}
		const deviceOrder = new Map(deviceIds.map((id, index) => [id, index]));

		return {
			devices: devices
				.map((device) => {
					device.channels = channelsByDevice.get(device.id) ?? [];

					return device;
				})
				.sort((left, right) => (deviceOrder.get(left.id) ?? 0) - (deviceOrder.get(right.id) ?? 0)),
			devicesTruncated,
			channelsTruncated: channelPage.truncated,
			propertiesTruncated: Object.values(properties.totals).some((total) => total > propertyLimit),
		};
	}

	async getVisibleSpaceCounts(): Promise<VisibleDeviceSpaceCounts> {
		interface SpaceCountRow {
			spaceId: string;
			deviceCount: string | number;
		}

		const [roomRows, zoneRows, floorRows] = await Promise.all([
			this.repository
				.createQueryBuilder('device')
				.select('device.roomId', 'spaceId')
				.addSelect('COUNT(device.id)', 'deviceCount')
				.where('device.hidden = :hidden', { hidden: false })
				.andWhere('device.roomId IS NOT NULL')
				.groupBy('device.roomId')
				.getRawMany<SpaceCountRow>(),
			this.repository
				.createQueryBuilder('device')
				.innerJoin('device.deviceZones', 'deviceZone')
				.select('deviceZone.zoneId', 'spaceId')
				.addSelect('COUNT(DISTINCT device.id)', 'deviceCount')
				.where('device.hidden = :hidden', { hidden: false })
				.groupBy('deviceZone.zoneId')
				.getRawMany<SpaceCountRow>(),
			this.repository
				.createQueryBuilder('device')
				.innerJoin('device.room', 'room')
				.select('room.parentId', 'spaceId')
				.addSelect('COUNT(device.id)', 'deviceCount')
				.where('device.hidden = :hidden', { hidden: false })
				.andWhere('room.parentId IS NOT NULL')
				.groupBy('room.parentId')
				.getRawMany<SpaceCountRow>(),
		]);

		return {
			rooms: Object.fromEntries(roomRows.map((row) => [row.spaceId, Number(row.deviceCount)])),
			zones: Object.fromEntries(zoneRows.map((row) => [row.spaceId, Number(row.deviceCount)])),
			floors: Object.fromEntries(floorRows.map((row) => [row.spaceId, Number(row.deviceCount)])),
		};
	}

	async findOne<TDevice extends DeviceEntity>(id: string, type?: string): Promise<TDevice | null> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`Fetching device with id=${id}`);

		const device = (await this.buildDeviceQuery(repository)
			.where('device.id = :id', { id })
			.getOne()) as TDevice | null;

		if (!device) {
			this.logger.debug(`Device with id=${id} not found`);

			return null;
		}

		this.logger.debug(`Successfully fetched device with id=${id}`);

		return device;
	}

	async findOneBy<TDevice extends DeviceEntity>(
		column: 'id' | 'category' | 'identifier' | 'name',
		value: string | number | boolean,
		type?: string,
	): Promise<TDevice | null> {
		const mapping = type ? this.devicesMapperService.getMapping<TDevice, any, any>(type) : null;

		const repository = mapping ? this.dataSource.getRepository(mapping.class) : this.repository;

		this.logger.debug(`Fetching device with ${column}=${value}`);

		const device = (await this.buildDeviceQuery(repository)
			.where(`device.${column} = :filterBy`, { filterBy: value })
			.getOne()) as TDevice | null;

		if (!device) {
			this.logger.debug(`Device with ${column}=${value} not found`);

			return null;
		}

		this.logger.debug(`Successfully fetched device with ${column}=${value}`);

		return device;
	}

	async create<TDevice extends DeviceEntity, TCreateDTO extends CreateDeviceDto>(
		createDto: TCreateDTO,
	): Promise<TDevice> {
		this.logger.debug('Creating new device');

		const { type } = createDto;

		if (!type) {
			this.logger.error('Validation failed: Missing required "type" attribute in data.');

			throw new DevicesException('Device type attribute is required.');
		}

		const mapping = this.devicesMapperService.getMapping<TDevice, TCreateDTO, any>(type);

		const dtoInstance = await this.validateDto<TCreateDTO>(mapping.createDto, createDto);

		// Validate room assignment if provided
		if (dtoInstance.room_id) {
			await this.validateRoomAssignment(dtoInstance.room_id);
		}

		// Extract zone IDs before processing
		const zoneIds = dtoInstance.zone_ids || [];
		delete dtoInstance.zone_ids;

		(dtoInstance.channels || []).forEach((channel) => {
			channel.id = channel.id ?? uuid().toString();

			(channel.properties || []).forEach((property) => {
				property.id = property.id ?? uuid().toString();
			});
		});

		const channels = dtoInstance.channels || [];

		delete dtoInstance.channels;

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Validation failed for device creation error=${JSON.stringify(errors)}`);

			throw new DevicesValidationException('Provided device data are invalid.');
		}

		const repository: Repository<TDevice> = this.dataSource.getRepository(mapping.class);

		const device = repository.create(toInstance(mapping.class, dtoInstance));

		// A create that names an id already in use is refused before anything is written.
		//
		// `id` is client-suppliable — the wizard generates its uuids up front — and `repository.save()`
		// treats a row whose primary key exists as an *update*. So a create carrying an existing id
		// silently overwrote that device instead of inserting, and the rollback below then removed it:
		// a malformed request destroying a device it had nothing to do with. The rollback is what makes
		// it destructive, but the overwrite was wrong on its own — a create that quietly becomes an
		// update is not something any caller asked for.
		//
		// Asked of the base repository rather than the mapped one, because a collision with a device of
		// *another* type is the same collision: ids are unique across the table, not per subclass, and
		// the mapped repository's own discriminator would hide exactly the case that is hardest to
		// explain afterwards.
		if (device.id) {
			const existing = await this.repository.findOne({ where: { id: device.id } });

			if (existing) {
				this.logger.error(`[VALIDATION FAILED] Device id=${device.id} already exists, refusing to create over it`);

				throw new DevicesValidationException(
					`Device with id=${device.id} already exists. Creating a device with an id already in use is not allowed.`,
				);
			}
		}

		// Inserted, not saved. `save()` decides between INSERT and UPDATE by looking for the row first,
		// which is the behaviour that let a create overwrite an existing device — and the check above
		// closes that only for a caller who is alone. Two requests carrying the same client-generated uuid
		// can both pass it before either writes, and the second `save()` would then update the first's row
		// with the rollback still armed behind it. `insert()` always issues an INSERT, so the primary key
		// constraint decides, and the database does not interleave. The check above stays for the message:
		// a caller reusing an id deliberately gets a sentence rather than a constraint violation.
		const inserted = await repository
			.insert(device as unknown as Parameters<Repository<TDevice>['insert']>[0])
			.catch((error: unknown) => {
				if (isUniqueConstraintViolation(error)) {
					this.logger.error(`[VALIDATION FAILED] Device id=${device.id} was created concurrently by another request`);

					throw new DevicesValidationException(
						`Device with id=${device.id} already exists. Creating a device with an id already in use is not allowed.`,
					);
				}

				throw error;
			});

		// `@PrimaryGeneratedColumn('uuid')` generates in JS, so a request that supplied no id already has
		// one on the entity by now; the returned identifier is read anyway rather than assumed, since it is
		// what the row was actually written under.
		const raw = Object.assign(device, inserted.identifiers[0] ?? {}) as TDevice;

		// A nested create is one request and has to succeed or fail as one thing. The device row is
		// already saved by the time its channels and properties are built, and a type owner's
		// `beforeCreate` hook can legitimately reject one of them — a virtual property whose source
		// cannot fill the slot it is being wired into, say. Without this, that rejection returns its 422
		// and leaves the parent device (and any channel already created) behind, so the client sees a
		// failure while the database keeps a half-built device, and a retry adds a second one.
		//
		// Rolled back by deleting the device row rather than by a transaction: the sqlite driver shares
		// one QueryRunner process-wide, so opening a transaction here would interact with the known
		// TOCTOU hazard tracked in the virtual-devices follow-ups. `ChannelEntity.device` is
		// `onDelete: 'CASCADE'`, so the channels and their properties go with it. No event is emitted
		// because none was: DEVICE_CREATED fires at the end of this method, so nothing ever observed
		// this device existing.
		try {
			for (const channelDtoInstance of channels) {
				this.logger.debug(`Creating new channel for deviceId=${raw.id}`);

				await this.channelsService.create({
					...channelDtoInstance,
					device: raw.id,
				});
			}

			// Set zone memberships if provided
			if (zoneIds.length > 0) {
				// Initial placement, not a change to an existing one: a create may legitimately carry both
				// `hidden: true` and `zone_ids` — the wizard hides a source device it is replacing — and the
				// placement lock is about mutating where an already-hidden device sits, which this is not.
				await this.deviceZonesService.setDeviceZones(raw.id, zoneIds, { initialPlacement: true });
			}
		} catch (error) {
			this.logger.error(`Nested creation failed for deviceId=${raw.id}, rolling the device back`);

			// The rows go with the device (channels cascade from it), but the events do not: every channel
			// and property created before the failure has *already* announced itself with
			// CHANNEL_CREATED / CHANNEL_PROPERTY_CREATED. A silent delete would leave websocket clients
			// holding children that no longer exist, and the virtual property index holding mappings for
			// them until some later structural event forced a rebuild. So the children are read back
			// before the delete and their deletions announced after it.
			//
			// Channels are announced rather than unwound through ChannelsService.remove(): that path
			// expects a fully built channel and re-parents children as it goes, which is the wrong shape
			// for tearing down a half-created device — and the device delete has to happen either way,
			// since the channel whose own creation threw was already persisted and is not in this list.
			const orphanedChannels = await this.channelsService
				.findAll(raw.id)
				.catch((readError: unknown): ChannelEntity[] => {
					this.logger.error(
						`Failed to read back channels for rolled-back deviceId=${raw.id}`,
						readError instanceof Error ? readError : undefined,
					);

					return [];
				});

			// Properties go through their own removal, not the cascade: a property's stored values and
			// device-status records live outside its row, and only the entity-removal lifecycle
			// (ChannelPropertyEntitySubscriber.afterRemove) clears them. A raw delete leaves that history
			// behind, and a retry supplying the same explicit property ids would find the failed attempt's
			// values already sitting there. That removal emits the property's deletion event too, so only
			// the channels need announcing below.
			for (const channel of orphanedChannels) {
				for (const property of channel.properties ?? []) {
					try {
						await this.channelsPropertiesService.remove(property.id);
					} catch (cleanupError) {
						this.logger.error(
							`Failed to roll back property id=${property.id} for deviceId=${raw.id}`,
							cleanupError instanceof Error ? cleanupError : undefined,
						);
					}
				}
			}

			// Removed as an entity, not deleted as a row. `repository.delete()` issues a DELETE and runs no
			// subscriber, and a device's removal lifecycle does real work outside its own table:
			// DeviceEntitySubscriber.afterRemove drops the device's stored connection statuses, and plugin
			// subscribers (Shelly v1's, for one) tear down the in-memory adapter entry the creation put
			// there. A child creation that succeeded before a later one failed can already have produced
			// exactly that state, so a raw delete leaves it behind — with a retry supplying the same
			// explicit id or identifier walking straight into the failed attempt's leftovers. Same
			// reasoning as the properties above, one level up.
			//
			// Still not routed through `remove()`: that emits DEVICE_DELETED, and this device never
			// emitted DEVICE_CREATED — that happens only after a creation completes. The compensating
			// events below exist because the *children* did announce themselves; the device did not.
			// Re-read first, and removed as *that* row rather than as `raw`. `raw` is the instance the
			// create built, and it still carries whatever the request nested onto it — `DeviceEntity.channels`
			// is `cascade: true`, so `remove()` handed that instance cascades across the in-memory graph and
			// detaches children instead of letting the database's own `ON DELETE CASCADE` take them. That
			// left channel properties behind with no channel at all, which the containment e2e caught. A
			// freshly loaded row has no relations loaded, so the removal is exactly one DELETE on the device
			// — subscribers and all — and the cascade below it is the schema's.
			const rollbackTarget = await repository.findOne({
				where: { id: raw.id } as FindOptionsWhere<TDevice>,
			});

			if (rollbackTarget) {
				await repository.remove(rollbackTarget);
			}

			for (const channel of orphanedChannels) {
				this.eventEmitter.emit(EventType.CHANNEL_DELETED, channel);
			}

			throw error;
		}

		// Retrieve the saved device with its full relations
		let savedDevice = (await this.getOneOrThrow(device.id)) as TDevice;

		if (mapping.afterCreate) {
			await mapping.afterCreate(savedDevice, dtoInstance);

			// Reload a potentially updated device
			savedDevice = (await this.getOneOrThrow(device.id)) as TDevice;
		}

		this.logger.debug(`Successfully created device with id=${savedDevice.id}`);

		this.eventEmitter.emit(EventType.DEVICE_CREATED, savedDevice);

		return savedDevice;
	}

	async update<TDevice extends DeviceEntity, TUpdateDTO extends UpdateDeviceDto>(
		id: string,
		updateDto: TUpdateDTO,
	): Promise<TDevice> {
		this.logger.debug(`Updating device with id=${id}`);

		const device = await this.getOneOrThrow(id);

		// Taken before anything is merged in, so `beforeUpdate` below can tell an actual change from a
		// PATCH that merely echoed a field back unchanged.
		const previous = { ...device } as Readonly<Partial<TDevice>>;

		const mapping = this.devicesMapperService.getMapping<TDevice, any, TUpdateDTO>(device.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

		this.assertPlacementChangeAllowed(device, dtoInstance);

		// Validate room assignment if provided (only validate if it's a non-null UUID)
		if (dtoInstance.room_id !== undefined && dtoInstance.room_id !== null) {
			await this.validateRoomAssignment(dtoInstance.room_id);
		}

		// Handle zone assignments if provided
		const zoneIds = dtoInstance.zone_ids;
		delete dtoInstance.zone_ids;

		// Get current zone IDs before update (for change detection)
		const currentZones = zoneIds !== undefined ? await this.deviceZonesService.getDeviceZones(device.id) : [];
		const currentZoneIds = currentZones.map((z) => z.id).sort();

		const repository: Repository<TDevice> = this.dataSource.getRepository(mapping.class);

		// Get the fields to update from DTO, restricted to properties this PATCH actually carried.
		//
		// toInstance() below builds `mapping.class` via `new mapping.class()`, so any class-field
		// initializer on the entity (see the `enabled` comment above) survives for properties the DTO
		// never mentioned. Those survivors are `true` / `null` / etc — not `undefined` — so
		// omitBy(isUndefined) alone cannot remove them, and Object.assign() below would write them back
		// over stored values on every unrelated PATCH (e.g. a `{type, hidden, hiddenBy}` body would reset
		// a Shelly device's `password`/`hostname` to null and silently re-`enable` a disabled device).
		//
		// Trap 1 (name mapping): dtoInstance's own enumerable keys are not uniformly cased. The base
		// UpdateDeviceDto spells multi-word fields in snake_case directly (`room_id`, `hidden_by`), but
		// some plugin DTOs use a camelCase JS property name with an @Expose({name}) override instead
		// (e.g. UpdateShellyNgDeviceDto.wifiAddress <- wire name `wifi_address`), so a set built from
		// Object.keys(dtoInstance) cannot be compared against updateFields' camelCase entity keys
		// directly — it has to be translated. We normalize dtoInstance's keys to wire form with the same
		// toSnakeCaseKeys() helper toInstance() uses internally, then mechanically convert each
		// updateFields key the same way for the comparison. This reproduces the @Expose({name: ...})
		// wire name for every entity field currently reachable from an update DTO (verified against every
		// @Expose on DeviceEntity and its 4 child entities): properties without a name override are
		// single-word, so camelCase already equals their wire name, and every existing override in the
		// codebase (hiddenBy -> hidden_by, roomId -> room_id, wifiAddress -> wifi_address,
		// ethernetAddress -> ethernet_address, canonicalMac -> canonical_mac, hasEthernet -> has_ethernet)
		// already IS the mechanical snake_case of the property name. If a future field pairs a
		// class-field initializer with an @Expose({name}) that does NOT mechanically match its property
		// name, this filter will silently stop recognizing it as "provided" — re-verify this claim when
		// adding one.
		//
		// We cannot instead have class-transformer do this mapping for us by passing
		// `exposeUnsetFields: true` (which would make it emit explicit `undefined`s for every unset field,
		// letting omitBy(isUndefined) strip them with no extra code): DeviceEntity.zoneIds is a
		// getter-only property declared once on the base class and never redeclared on any
		// @ChildEntity() subclass. class-transformer's guard against assigning to read-only properties
		// does an own-property lookup (Object.getOwnPropertyDescriptor(target.constructor.prototype,
		// key)) that does not walk the prototype chain, so on a subclass like ShellyV1DeviceEntity it
		// fails to find the inherited getter and then throws trying to assign to it. This only surfaces
		// once something forces unset fields to be materialized — exposeUnsetFields: false (the default,
		// used everywhere else, including below) never attempts the assignment, which is why the existing
		// call is unaffected.
		//
		// Trap 2 (dtoInstance contamination): this filter is only sound if dtoInstance's own keys really
		// are "what the request carried" and are not themselves polluted the same way updateFields is.
		// Verified: UpdateDeviceDto and all 4 plugin update DTOs (Shelly V1, Shelly NG, WLED, reTerminal)
		// declare every field as `foo?: T` with no `= default`, so a body of {type, name} produces
		// Object.keys(dtoInstance) === ['type', 'name'] — nothing leaks in from dtoInstance's own
		// construction. zone_ids was deleted from dtoInstance above, before this runs, so it is excluded
		// from dtoWireKeys too and cannot reappear in updateFields.
		const dtoWireKeys = new Set(Object.keys(toSnakeCaseKeys<TUpdateDTO, Record<string, unknown>>(dtoInstance)));

		const updateFields = omitBy(
			toInstance(mapping.class, dtoInstance),
			(value, key) => isUndefined(value) || !dtoWireKeys.has(toSnakeCase(key)),
		);

		// Provenance only means something while the device is hidden, so unhiding clears it. Forced onto
		// the resolved fields rather than set on the DTO, because no caller can express it and the DTO
		// cannot carry it: the admin's generated `UpdateDevice` type drops `| null` from enum-referencing
		// properties, and this DTO's own `@Transform` reads an explicit null as "not provided". A stale
		// `system` left behind would also mislead the reconciliation that keys on it.
		if (dtoInstance.hidden === false) {
			updateFields.hiddenBy = null;
		}

		// Check if any entity fields are actually being changed by comparing with existing values
		const entityFieldsChanged =
			Object.keys(updateFields).some((key) => {
				const newValue = (updateFields as Record<string, unknown>)[key];
				const existingValue = (device as unknown as Record<string, unknown>)[key];

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
			// Explicit check for room_id being set to null (toInstance drops null values)
			(dtoInstance.room_id !== undefined && device.roomId !== (dtoInstance.room_id ?? null)) ||
			// Explicit check for zone_ids changes (zone_ids is deleted from dtoInstance before updateFields is computed)
			(zoneIds !== undefined && JSON.stringify(currentZoneIds) !== JSON.stringify([...(zoneIds ?? [])].sort()));

		Object.assign(device, updateFields);

		// Explicitly handle room_id being set to null (toInstance with exposeUnsetFields:false drops null values)
		if (dtoInstance.room_id === null) {
			device.roomId = null;
		}

		// The type owner's last look at the merged row, before anything is written — the only point at
		// which an invariant spanning a field the PATCH sent and one it did not is decidable.
		if (mapping.beforeUpdate) {
			await mapping.beforeUpdate(device as TDevice, previous);
		}

		// Written through a row carrying no relations, not through the entity the decisions above were
		// made on. `DeviceEntity.channels` is `cascade: true`, so saving the loaded entity re-saves
		// whatever channels it happens to hold — and TypeORM reads a child that is *missing* from a
		// cascaded collection as one detached from its parent, issuing `SET channelId = NULL` on that
		// channel's properties.
		//
		// The list is routinely stale. A virtual device's device_information channel is synthesized
		// fire-and-forget off DEVICE_CREATED, so a PATCH arriving while that is still in flight loaded its
		// channels before the channel existed. Renaming a device moments after creating it therefore
		// stripped the channel from its own properties — `manufacturer`, `model` and `serial_number` left
		// pointing at nothing, past the cascade that would have cleaned them up. Found as an intermittent
		// stray in the containment e2e, one run in five or so.
		//
		// A re-read is enough: without the collection loaded there is no cascade to run, and the write is
		// the one UPDATE this method was always meant to make.
		const persisted = await repository.findOne({
			where: { id: device.id } as FindOptionsWhere<TDevice>,
			loadEagerRelations: false,
		});

		// The row is gone, so a concurrent `remove()` deleted it after this call read it. There is nothing
		// left to update, and saving the entity loaded at the top is not a way to say so: TypeORM's `save`
		// looks the primary key up, finds nothing and INSERTs — the PATCH would resurrect a device whose
		// DEVICE_DELETED has already been emitted, cascading whatever relation graph the stale entity
		// happens to carry. The honest answer is the same one this method gives for an id that never
		// existed.
		if (!persisted) {
			this.logger.error(`Device with id=${device.id} was removed while it was being updated`);

			throw new DevicesNotFoundException('Device does not exist');
		}

		// The placement guard again, on the row as it stands now rather than as it stood when this
		// call began. Between the two there are several awaited round trips — the room validation, the
		// zone read-back, this re-read — and a wizard hiding the device in that window would otherwise
		// have this write the placement of a device that is now inert. The zone half carries the same
		// condition in the statements that write it (see DeviceZonesService.setDeviceZones).
		this.assertPlacementChangeAllowed(persisted, dtoInstance);

		Object.assign(persisted, updateFields);

		if (dtoInstance.room_id === null) {
			persisted.roomId = null;
		}

		await repository.save(persisted);

		// Update zone memberships if zone_ids was explicitly provided
		if (zoneIds !== undefined) {
			await this.deviceZonesService.setDeviceZones(device.id, zoneIds);
		}

		let updatedDevice = (await this.getOneOrThrow(device.id)) as TDevice;

		if (mapping.afterUpdate) {
			await mapping.afterUpdate(updatedDevice);

			updatedDevice = (await this.getOneOrThrow(device.id)) as TDevice;
		}

		this.logger.debug(`Successfully updated device with id=${updatedDevice.id}`);

		if (entityFieldsChanged) {
			this.eventEmitter.emit(EventType.DEVICE_UPDATED, updatedDevice);
		}

		return updatedDevice;
	}

	async remove(id: string): Promise<void> {
		this.logger.debug(`Removing device with id=${id}`);

		// Get the full device entity before removal to preserve ID for event emission
		const fullDevice = await this.getOneOrThrow(id);

		await this.dataSource.transaction(async (manager) => {
			const device = await manager.findOneOrFail<DeviceEntity>(DeviceEntity, { where: { id } });

			const channels = await manager.find<ChannelEntity>(ChannelEntity, { where: { device: { id } } });

			for (const channel of channels) {
				await this.channelsService.remove(channel.id, manager);
			}

			const controls = await manager.find<DeviceControlEntity>(DeviceControlEntity, { where: { device: { id } } });

			for (const control of controls) {
				await this.devicesControlsService.remove(control.id, device.id, manager);
			}

			await manager.remove(device);

			this.logger.log(`Successfully removed device with id=${id}`);

			// Emit event with the full device entity captured before removal to preserve ID
			this.eventEmitter.emit(EventType.DEVICE_DELETED, fullDevice);
		});
	}

	async getOneOrThrow(id: string): Promise<DeviceEntity> {
		const device = await this.findOne(id);

		if (!device) {
			this.logger.error(`Device with id=${id} not found`);

			throw new DevicesNotFoundException('Device does not exist');
		}

		return device;
	}

	private buildDeviceQuery(repository: Repository<any>) {
		const qb = repository
			.createQueryBuilder('device')
			.leftJoinAndSelect('device.controls', 'controls')
			.leftJoinAndSelect('controls.device', 'controlDevice')
			.leftJoinAndSelect('device.channels', 'channels')
			.leftJoinAndSelect('channels.device', 'channelDevice')
			.leftJoinAndSelect('channels.controls', 'channelControls')
			.leftJoinAndSelect('channelControls.channel', 'channelControlChannel')
			.leftJoinAndSelect('channels.properties', 'channelProperties')
			.leftJoinAndSelect('channelProperties.channel', 'channelPropertyChannel')
			.leftJoinAndSelect('device.deviceZones', 'deviceZones');

		// QueryBuilder ignores eager:true — auto-join any eager relations from plugin entities
		for (const relation of repository.metadata?.relations ?? []) {
			if (relation.isEager && !['controls', 'channels', 'deviceZones'].includes(relation.propertyName)) {
				qb.leftJoinAndSelect(`device.${relation.propertyName}`, relation.propertyName);
			}
		}

		return qb;
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

			throw new DevicesValidationException('Provided device data are invalid.');
		}

		return dtoInstance;
	}

	/**
	 * Refuses a PATCH that moves a hidden device between rooms or zones.
	 *
	 * A hidden device is one a virtual device has replaced, and the virtual device is what the operator
	 * places from then on. The physical device keeps the room it had — energy attribution follows it,
	 * which is the accepted tradeoff of this rule.
	 *
	 * The guard is on *mutation*, not on state. Hiding deliberately preserves the stored room so
	 * unhiding restores it, and the virtual-device split flow places the parent device *before* it hides
	 * it — refusing a hide because the device already has a room would break that flow. So only a patch
	 * that itself carries `room_id` / `zone_ids` is refused; a patch that leaves both absent passes,
	 * including the `hidden: true` patch that does the hiding.
	 *
	 * `null` counts as carrying the field: clearing the room is a placement change too.
	 *
	 * Lives here rather than as a `class-validator` constraint on `UpdateDeviceDto` because the decision
	 * needs the *stored* device, and a DTO constraint never sees the `:id` route parameter —
	 * `ValidationArguments` exposes only `{ value, constraints, targetName, object, property }`, where
	 * `object` is the DTO built from the request body alone. Enforcing it here also covers every caller
	 * of `update()`, and cannot be dropped by a plugin update DTO that redeclares a placement field.
	 */
	private assertPlacementChangeAllowed(device: DeviceEntity, dtoInstance: UpdateDeviceDto): void {
		// The PATCH's own `hidden: true` counts, not just the row's current value. The rule is about the
		// device this placement lands on, and after such a request that device is hidden — so judging the
		// stored value alone made the outcome depend on write order: the entity save committed the hide,
		// and `setDeviceZones` then refused the zone half because the device it re-read was now hidden.
		// The caller got a 422 with the hide already applied, the other fields already written and no
		// DEVICE_UPDATED to tell anything about it. Refused before the first write, nothing is left half
		// done, and a request cannot end both hidden and re-placed.
		if (!device.hidden && dtoInstance.hidden !== true) {
			return;
		}

		if (dtoInstance.room_id === undefined && dtoInstance.zone_ids === undefined) {
			return;
		}

		this.logger.error(`Refused placement change on hidden device id=${device.id}`);

		throw new DevicesNotAllowedException(DEVICE_PLACEMENT_LOCKED_MESSAGE);
	}

	/**
	 * Validates that the given room ID references a space with type=ROOM
	 * @param roomId - The room ID to validate
	 * @throws DevicesNotFoundException if room does not exist
	 * @throws DevicesValidationException if space is not a room
	 */
	private async validateRoomAssignment(roomId: string): Promise<void> {
		this.logger.debug(`Validating room assignment for roomId=${roomId}`);

		const space = await this.spaceRepository.findOne({ where: { id: roomId } });

		if (!space) {
			this.logger.error(`Space with id=${roomId} not found`);

			throw new DevicesNotFoundException(`Room with id=${roomId} not found`);
		}

		if (space.type !== SpaceType.ROOM) {
			this.logger.error(`Space with id=${roomId} is not a room, it is a ${space.type}`);

			throw new DevicesValidationException(
				'Device can only be assigned to a room, not a zone. Use zone_ids for zone membership.',
			);
		}

		this.logger.debug(`Room assignment validated for roomId=${roomId}`);
	}
}
