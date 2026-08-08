import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import { DEVICES_MODULE_NAME, DEVICE_PLACEMENT_LOCKED_MESSAGE, EventType } from '../devices.constants';
import {
	DevicesNotAllowedException,
	DevicesNotFoundException,
	DevicesValidationException,
} from '../devices.exceptions';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import { DeviceEntity } from '../entities/devices.entity';

@Injectable()
export class DeviceZonesService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceZonesService');

	constructor(
		@InjectRepository(DeviceZoneEntity)
		private readonly repository: Repository<DeviceZoneEntity>,
		@InjectRepository(DeviceEntity)
		private readonly deviceRepository: Repository<DeviceEntity>,
		@InjectRepository(SpaceEntity)
		private readonly spaceRepository: Repository<SpaceEntity>,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get all zones for a device
	 */
	async getDeviceZones(deviceId: string): Promise<SpaceEntity[]> {
		this.logger.debug(`Fetching zones for device id=${deviceId}`);

		const relations = await this.repository.find({
			where: { deviceId },
			relations: ['zone'],
		});

		const zones = relations.map((r) => r.zone).filter((z) => z !== null);

		this.logger.debug(`Found ${zones.length} zones for device`);

		return zones;
	}

	/**
	 * Get all devices in a zone
	 */
	async getZoneDevices(zoneId: string): Promise<DeviceEntity[]> {
		this.logger.debug(`Fetching devices for zone id=${zoneId}`);

		const relations = await this.repository.find({
			where: { zoneId },
			relations: ['device', 'device.channels', 'device.channels.properties'],
		});

		const devices = relations.map((r) => r.device).filter((d) => d !== null);

		this.logger.debug(`Found ${devices.length} devices in zone`);

		return devices;
	}

	/**
	 * Add a device to a zone
	 * Validates that the zone is not a floor zone
	 */
	async addDeviceToZone(deviceId: string, zoneId: string): Promise<DeviceZoneEntity> {
		this.logger.debug(`Adding device ${deviceId} to zone ${zoneId}`);

		// Verify device exists
		const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
		if (!device) {
			this.logger.error(`Device with id=${deviceId} not found`);
			throw new DevicesNotFoundException('Device not found');
		}

		this.assertPlacementChangeAllowed(device);

		// Verify zone exists and is a zone type
		const zone = await this.spaceRepository.findOne({ where: { id: zoneId } });
		if (!zone) {
			this.logger.error(`Zone with id=${zoneId} not found`);
			throw new DevicesNotFoundException('Zone not found');
		}

		if (zone.type !== SpaceType.ZONE) {
			this.logger.error(`Space ${zoneId} is not a zone`);
			throw new DevicesValidationException('Can only add device to a zone, not a room');
		}

		// Validate that it's not a floor zone. `category` lives on home-control's
		// ZoneSpaceEntity, not the abstract SpaceEntity, so read it via an indexed-property cast.
		if (isFloorZoneCategory((zone as { category?: string | null }).category ?? null)) {
			this.logger.error(`Cannot explicitly assign device to floor zone ${zoneId}`);
			throw new DevicesValidationException(
				'Cannot explicitly assign device to a floor zone. Floor membership is derived from room→zone hierarchy.',
			);
		}

		// Check if already exists
		const existing = await this.repository.findOne({
			where: { deviceId, zoneId },
		});

		if (existing) {
			this.logger.debug(`Device ${deviceId} already in zone ${zoneId}`);
			return existing;
		}

		// Inserted only while the device is still visible, in the statement that does the inserting. The
		// `assertPlacementChangeAllowed` above reads the device and then several awaited lookups follow
		// before anything is written — the zone, its type, its category, the existing-membership check —
		// and a hide committing anywhere in that window would leave this request changing the placement of
		// a device that is now inert. The guard stays: it is what turns the ordinary case into a clear
		// 422 naming the reason, rather than a silent no-op.
		//
		// `COALESCE` because the column is only guaranteed non-null going forward; a row written before it
		// existed reads as visible, which is what it was.
		const zoneTable = this.repository.metadata.tableName;
		const deviceTable = this.deviceRepository.metadata.tableName;

		await this.repository.manager.query(
			`INSERT INTO "${zoneTable}" ("deviceId", "zoneId") SELECT ?, ? WHERE EXISTS (SELECT 1 FROM "${deviceTable}" d WHERE d.id = ? AND COALESCE(d.hidden, 0) = 0)`,
			[deviceId, zoneId, deviceId],
		);

		const inserted = await this.repository.findOne({ where: { deviceId, zoneId } });

		if (!inserted) {
			// Nothing matched, so the device was hidden between the guard and here. Reported exactly as the
			// guard reports it — from the caller's side this is the same refusal, arriving a moment later.
			this.logger.error(`Refused zone membership change on device id=${deviceId} hidden while it was being added`);

			throw new DevicesNotAllowedException(DEVICE_PLACEMENT_LOCKED_MESSAGE);
		}

		this.logger.debug(`Successfully added device ${deviceId} to zone ${zoneId}`);

		this.eventEmitter.emit(EventType.DEVICE_UPDATED, device);

		return inserted;
	}

	/**
	 * Remove a device from a zone
	 */
	async removeDeviceFromZone(deviceId: string, zoneId: string): Promise<void> {
		this.logger.debug(`Removing device ${deviceId} from zone ${zoneId}`);

		// Read before the delete, not after it: the guard below has to run before anything is written.
		// A missing device stays non-fatal here, exactly as before — the delete simply affects no rows.
		// The same instance is reused for the event, which is equivalent to the post-delete re-read it
		// replaces: neither loads the `deviceZones` relation, so neither reflects this delete anyway.
		const device = await this.deviceRepository.findOne({ where: { id: deviceId } });

		this.assertPlacementChangeAllowed(device);

		const result = await this.repository.delete({ deviceId, zoneId });

		if (result.affected === 0) {
			this.logger.warn(`Device ${deviceId} was not in zone ${zoneId}`);
		} else {
			this.logger.debug(`Successfully removed device ${deviceId} from zone ${zoneId}`);

			if (device) {
				this.eventEmitter.emit(EventType.DEVICE_UPDATED, device);
			}
		}
	}

	/**
	 * Set zones for a device (replaces existing zone memberships)
	 */
	async setDeviceZones(deviceId: string, zoneIds: string[]): Promise<SpaceEntity[]> {
		this.logger.debug(`Setting zones for device ${deviceId}: ${zoneIds.join(', ')}`);

		// Verify device exists
		const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
		if (!device) {
			this.logger.error(`Device with id=${deviceId} not found`);
			throw new DevicesNotFoundException('Device not found');
		}

		// Validate all zones
		const validatedZones: SpaceEntity[] = [];
		for (const zoneId of zoneIds) {
			const zone = await this.spaceRepository.findOne({ where: { id: zoneId } });

			if (!zone) {
				this.logger.error(`Zone with id=${zoneId} not found`);
				throw new DevicesNotFoundException(`Zone ${zoneId} not found`);
			}

			if (zone.type !== SpaceType.ZONE) {
				this.logger.error(`Space ${zoneId} is not a zone`);
				throw new DevicesValidationException(`${zone.name} is not a zone`);
			}

			if (isFloorZoneCategory((zone as { category?: string | null }).category ?? null)) {
				this.logger.error(`Cannot explicitly assign device to floor zone ${zoneId}`);
				throw new DevicesValidationException(
					`Cannot assign to floor zone "${zone.name}". Floor membership is derived from room hierarchy.`,
				);
			}

			validatedZones.push(zone);
		}

		// Remove existing zone memberships
		await this.repository.delete({ deviceId });

		// Add new zone memberships
		if (zoneIds.length > 0) {
			const deviceZones = zoneIds.map((zoneId) =>
				this.repository.create({
					deviceId,
					zoneId,
				}),
			);

			await this.repository.save(deviceZones);
		}

		this.logger.debug(`Successfully set ${zoneIds.length} zones for device ${deviceId}`);

		this.eventEmitter.emit(EventType.DEVICE_UPDATED, device);

		return validatedZones;
	}

	/**
	 * Refuses a single-membership zone change on a hidden device.
	 *
	 * `DevicesService.assertPlacementChangeAllowed()` covers placement changes made through
	 * `DevicesService.update()`, but `POST|DELETE /devices/:id/zones/:zoneId` reach zone membership
	 * directly and never pass through it. Without this the rule is bypassable: a client refused a
	 * `zone_ids` PATCH could reach the same end state one membership at a time. Removal is refused for
	 * the same reason a room change is — a hidden device is inert, and changing its placement means
	 * unhiding it first.
	 *
	 * A missing device is not this guard's business; the callers decide whether that is fatal.
	 *
	 * `setDeviceZones()` deliberately carries no such check: its only callers are
	 * `DevicesService.create()` / `update()`, and `update()` is already guarded before it gets there.
	 */
	private assertPlacementChangeAllowed(device: DeviceEntity | null): void {
		if (!device?.hidden) {
			return;
		}

		this.logger.error(`Refused zone membership change on hidden device id=${device.id}`);

		throw new DevicesNotAllowedException(DEVICE_PLACEMENT_LOCKED_MESSAGE);
	}

	/**
	 * Clear all zone memberships for a device
	 */
	async clearDeviceZones(deviceId: string): Promise<void> {
		this.logger.debug(`Clearing all zones for device ${deviceId}`);

		const result = await this.repository.delete({ deviceId });

		this.logger.debug(`Removed ${result.affected ?? 0} zone memberships for device ${deviceId}`);
	}
}
