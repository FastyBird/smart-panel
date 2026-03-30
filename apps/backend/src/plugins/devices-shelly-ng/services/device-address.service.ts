import { In, Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ADDRESS_PRIORITY, AddressType, DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgDeviceAddressEntity } from '../entities/shelly-ng-device-address.entity';

/**
 * Normalize a MAC address to uppercase hex without separators.
 * Handles colon-separated, dash-separated, and bare hex input.
 */
export function normalizeMac(mac: string): string {
	return mac.replace(/[:-]/g, '').toUpperCase();
}

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
			try {
				const entity = this.addressRepository.create({
					deviceId,
					interfaceType,
					address,
				});

				await this.addressRepository.save(entity);

				this.logger.log(`Stored ${interfaceType} address ${address} for device=${deviceId}`, {
					resource: deviceId,
				});
			} catch {
				// Unique constraint violation — another delegate inserted concurrently.
				// Retry as an update.
				await this.addressRepository.update({ deviceId, interfaceType }, { address });
			}
		}
	}

	/**
	 * Remove an address entry for a device interface.
	 */
	async removeAddress(deviceId: string, interfaceType: AddressType): Promise<void> {
		const result = await this.addressRepository.delete({ deviceId, interfaceType });

		if (result.affected) {
			this.logger.log(`Removed ${interfaceType} address for device=${deviceId}`, { resource: deviceId });
		}
	}

	/**
	 * Store addresses from a discovered device.
	 * Only upserts addresses that are present — a null IP means the delegate
	 * doesn't have info about that interface, not that the interface is gone.
	 */
	async syncAddresses(deviceId: string, wifiIp: string | null, ethernetIp: string | null): Promise<void> {
		if (ethernetIp) {
			await this.upsertAddress(deviceId, AddressType.ETHERNET, ethernetIp);
		}

		if (wifiIp) {
			await this.upsertAddress(deviceId, AddressType.WIFI, wifiIp);
		}
	}

	/**
	 * Returns the preferred address for a device, falling back to the legacy
	 * hostname column for pre-existing devices that haven't been migrated yet.
	 * If a legacy hostname is found, it's auto-migrated to the address table.
	 */
	async getPreferredAddressOrMigrate(deviceId: string): Promise<string | null> {
		const preferred = await this.getPreferredAddress(deviceId);

		if (preferred !== null) {
			return preferred;
		}

		const legacyHostname = await this.getLegacyHostname(deviceId);

		if (legacyHostname) {
			await this.upsertAddress(deviceId, AddressType.WIFI, legacyHostname);

			this.logger.log(`Migrated legacy hostname=${legacyHostname} to address table for device=${deviceId}`, {
				resource: deviceId,
			});

			return legacyHostname;
		}

		return null;
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
	 * Batch-load preferred addresses for multiple devices.
	 * Returns a map of deviceId → preferred address (ethernet-first).
	 */
	async getPreferredAddresses(deviceIds: string[]): Promise<Map<string, string>> {
		if (deviceIds.length === 0) {
			return new Map();
		}

		const addresses = await this.addressRepository.find({
			where: { deviceId: In(deviceIds) },
		});

		// Group by device, pick preferred (lowest priority number)
		const byDevice = new Map<string, ShellyNgDeviceAddressEntity[]>();

		for (const addr of addresses) {
			const list = byDevice.get(addr.deviceId) ?? [];
			list.push(addr);
			byDevice.set(addr.deviceId, list);
		}

		const result = new Map<string, string>();

		for (const [deviceId, addrs] of byDevice) {
			addrs.sort((a, b) => (ADDRESS_PRIORITY[a.interfaceType] ?? 99) - (ADDRESS_PRIORITY[b.interfaceType] ?? 99));
			result.set(deviceId, addrs[0].address);
		}

		return result;
	}

	/**
	 * Returns all addresses for a device.
	 */
	async getAddresses(deviceId: string): Promise<ShellyNgDeviceAddressEntity[]> {
		return this.addressRepository.find({ where: { deviceId } });
	}

	/**
	 * Find a device by its canonical MAC address.
	 * Used for deduplication of Shelly Pro devices with both WiFi and Ethernet.
	 * The repository is scoped to ShellyNgDeviceEntity (a @ChildEntity), so TypeORM
	 * automatically applies the STI discriminator filter — no explicit type condition needed.
	 */
	async findDeviceByCanonicalMac(canonicalMac: string): Promise<ShellyNgDeviceEntity | null> {
		return this.deviceRepository.findOne({
			where: { canonicalMac: normalizeMac(canonicalMac) },
		});
	}

	/**
	 * Set the canonical MAC on a device entity (normalized to uppercase hex).
	 */
	async setCanonicalMac(deviceId: string, canonicalMac: string): Promise<void> {
		await this.deviceRepository.update(deviceId, { canonicalMac: normalizeMac(canonicalMac) });
	}

	/**
	 * Persist whether the device has an Ethernet interface.
	 * Derived from the device descriptor's system components during provisioning.
	 */
	async setHasEthernet(deviceId: string, hasEthernet: boolean): Promise<void> {
		await this.deviceRepository.update(deviceId, { hasEthernet });
	}

	/**
	 * Read the legacy `hostname` column value for a device via raw query.
	 * The column still exists on the STI table (used by other plugins) but is
	 * no longer declared on ShellyNgDeviceEntity. Used for one-time migration
	 * of pre-existing devices that have hostname but no address table entries.
	 */
	async getLegacyHostname(deviceId: string): Promise<string | null> {
		const result: { hostname: string | null }[] = await this.deviceRepository.query(
			'SELECT "hostname" FROM "devices_module_devices" WHERE "id" = ?',
			[deviceId],
		);

		return result[0]?.hostname ?? null;
	}
}
