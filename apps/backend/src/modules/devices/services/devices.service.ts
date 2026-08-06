import { validate } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import { DEVICES_MODULE_NAME, DeviceHiddenFilter, EventType } from '../devices.constants';
import { DevicesException, DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
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
}

export interface VisibleBoundedDeviceState {
	devices: DeviceEntity[];
	devicesTruncated: boolean;
	channelsTruncated: boolean;
	propertiesTruncated: boolean;
}

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

		const [roomRows, zoneRows] = await Promise.all([
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
		]);

		return {
			rooms: Object.fromEntries(roomRows.map((row) => [row.spaceId, Number(row.deviceCount)])),
			zones: Object.fromEntries(zoneRows.map((row) => [row.spaceId, Number(row.deviceCount)])),
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

		// Save the device
		const raw = await repository.save(device);

		for (const channelDtoInstance of channels) {
			this.logger.debug(`Creating new channel for deviceId=${raw.id}`);

			await this.channelsService.create({
				...channelDtoInstance,
				device: raw.id,
			});
		}

		// Set zone memberships if provided
		if (zoneIds.length > 0) {
			await this.deviceZonesService.setDeviceZones(raw.id, zoneIds);
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

		const mapping = this.devicesMapperService.getMapping<TDevice, any, TUpdateDTO>(device.type);

		const dtoInstance = await this.validateDto<TUpdateDTO>(mapping.updateDto, updateDto);

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

		// Get the fields to update from DTO (excluding undefined values)
		const updateFields = omitBy(toInstance(mapping.class, dtoInstance), isUndefined);

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

		await repository.save(device as TDevice);

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
