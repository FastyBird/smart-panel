import { DeviceDiscoverer, DeviceIdentifiers } from 'shellies-ds9';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

import { DeviceAddressService } from './device-address.service';

@Injectable()
export class DatabaseDiscovererService extends DeviceDiscoverer {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DatabaseDiscovererService',
	);

	private readonly emitInterval = 20; // The interval, in milliseconds, to wait between each emitted device.

	constructor(
		private readonly devicesService: DevicesService,
		private readonly deviceAddressService: DeviceAddressService,
	) {
		super();
	}

	async run() {
		const devices = await this.devicesService.findAll<ShellyNgDeviceEntity>(DEVICES_SHELLY_NG_TYPE);

		const enabledDevices = devices.filter((d) => {
			if (d.enabled === false) return false;

			if (d.identifier === null) {
				this.logger.error(
					`Failed to prepare device to be managed by Shelly manager. Missing identifier for device=${d.id}`,
				);

				return false;
			}

			return true;
		});

		// Batch-load preferred addresses for all enabled devices (single query)
		const preferredAddresses = await this.deviceAddressService.getPreferredAddresses(enabledDevices.map((d) => d.id));

		for (const d of enabledDevices) {
			const hostname = preferredAddresses.get(d.id) ?? null;

			if (hostname === null) {
				this.logger.warn(`No address found for device=${d.id}, skipping discovery emit`);

				continue;
			}

			await this.emitDevice({
				deviceId: d.identifier,
				hostname,
			});
		}
	}

	/**
	 * Emits a device after the configured time interval has passed
	 */
	protected emitDevice(identifiers: DeviceIdentifiers): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(() => {
				this.handleDiscoveredDevice(identifiers);

				resolve();
			}, this.emitInterval);
		});
	}
}
