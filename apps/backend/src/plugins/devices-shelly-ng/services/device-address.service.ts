import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ADDRESS_PRIORITY, AddressType, DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgDeviceAddressEntity } from '../entities/shelly-ng-device-address.entity';

@Injectable()
export class DeviceAddressService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DeviceAddressService',
	);

	constructor(
		@InjectRepository(ShellyNgDeviceAddressEntity)
		private readonly addressRepository: Repository<ShellyNgDeviceAddressEntity>,
		@InjectRepository(ShellyNgDeviceEntity)
		private readonly deviceRepository: Repository<ShellyNgDeviceEntity>,
	) {}

	/**
	 * Store or update a network address for a device.
	 */
	async upsertAddress(deviceId: string, interfaceType: AddressType, address: string): Promise<void> {
		const existing = await this.addressRepository.findOne({
			where: { deviceId, interfaceType },
		});

		if (existing) {
			if (existing.address !== address) {
				existing.address = address;

				await this.addressRepository.save(existing);

				this.logger.log(`Updated ${interfaceType} address to ${address} for device=${deviceId}`, {
					resource: deviceId,
				});
			}
		} else {
			const entity = this.addressRepository.create({
				deviceId,
				interfaceType,
				address,
			});

			await this.addressRepository.save(entity);

			this.logger.log(`Stored ${interfaceType} address ${address} for device=${deviceId}`, {
				resource: deviceId,
			});
		}
	}

	/**
	 * Store addresses from a discovered device and update the device hostname
	 * to the preferred (ethernet-first) address.
	 */
	async syncAddressesAndHostname(deviceId: string, wifiIp: string | null, ethernetIp: string | null): Promise<void> {
		if (ethernetIp) {
			await this.upsertAddress(deviceId, AddressType.ETHERNET, ethernetIp);
		} else {
			await this.removeAddress(deviceId, AddressType.ETHERNET);
		}

		if (wifiIp) {
			await this.upsertAddress(deviceId, AddressType.WIFI, wifiIp);
		} else {
			await this.removeAddress(deviceId, AddressType.WIFI);
		}

		const preferred = await this.getPreferredAddress(deviceId);

		if (preferred) {
			await this.deviceRepository.update(deviceId, { hostname: preferred });
		}
	}

	/**
	 * Remove a specific address for a device (e.g. when an interface is no longer available).
	 */
	private async removeAddress(deviceId: string, interfaceType: AddressType): Promise<void> {
		const result = await this.addressRepository.delete({ deviceId, interfaceType });

		if (result.affected && result.affected > 0) {
			this.logger.log(`Removed stale ${interfaceType} address for device=${deviceId}`, { resource: deviceId });
		}
	}

	/**
	 * Returns the preferred address for a device.
	 * Prefers ethernet (LAN) over WiFi.
	 */
	async getPreferredAddress(deviceId: string): Promise<string | null> {
		const addresses = await this.addressRepository.find({
			where: { deviceId },
		});

		if (addresses.length === 0) {
			return null;
		}

		addresses.sort((a, b) => (ADDRESS_PRIORITY[a.interfaceType] ?? 99) - (ADDRESS_PRIORITY[b.interfaceType] ?? 99));

		return addresses[0].address;
	}

	/**
	 * Find a device by its canonical MAC address.
	 * Used for deduplication of Shelly Pro devices with both WiFi and Ethernet.
	 * The repository is scoped to ShellyNgDeviceEntity (a @ChildEntity), so TypeORM
	 * automatically applies the STI discriminator filter — no explicit type condition needed.
	 */
	async findDeviceByCanonicalMac(canonicalMac: string): Promise<ShellyNgDeviceEntity | null> {
		return this.deviceRepository.findOne({
			where: { canonicalMac },
		});
	}

	/**
	 * Set the canonical MAC on a device entity.
	 */
	async setCanonicalMac(deviceId: string, canonicalMac: string): Promise<void> {
		await this.deviceRepository.update(deviceId, { canonicalMac });
	}
}
