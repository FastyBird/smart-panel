import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { isFloorZoneCategory, SpaceType } from '../../spaces/spaces.constants';
import { DEVICES_MODULE_NAME, EventType } from '../devices.constants';
import { DevicesNotFoundException, DevicesValidationException } from '../devices.exceptions';
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
			relations: ['device'],
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

		// Validate that it's not a floor zone
		if (isFloorZoneCategory(zone.category)) {
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

		// Create the relation
		const deviceZone = this.repository.create({
			deviceId,
			zoneId,
		});

		await this.repository.save(deviceZone);

		this.logger.debug(`Successfully added device ${deviceId} to zone ${zoneId}`);

		this.eventEmitter.emit(EventType.DEVICE_UPDATED, device);

		return deviceZone;
	}

	/**
	 * Remove a device from a zone
	 */
	async removeDeviceFromZone(deviceId: string, zoneId: string): Promise<void> {
		this.logger.debug(`Removing device ${deviceId} from zone ${zoneId}`);

		const result = await this.repository.delete({ deviceId, zoneId });

		if (result.affected === 0) {
			this.logger.warn(`Device ${deviceId} was not in zone ${zoneId}`);
		} else {
			this.logger.debug(`Successfully removed device ${deviceId} from zone ${zoneId}`);

			const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
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

			if (isFloorZoneCategory(zone.category)) {
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
	 * Clear all zone memberships for a device
	 */
	async clearDeviceZones(deviceId: string): Promise<void> {
		this.logger.debug(`Clearing all zones for device ${deviceId}`);

		const result = await this.repository.delete({ deviceId });

		this.logger.debug(`Removed ${result.affected ?? 0} zone memberships for device ${deviceId}`);
	}
}
