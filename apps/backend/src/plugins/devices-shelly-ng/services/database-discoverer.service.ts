import { DeviceDiscoverer, DeviceIdentifiers } from 'shellies-ds9';

import { Injectable, Logger } from '@nestjs/common';

import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

@Injectable()
export class DatabaseDiscovererService extends DeviceDiscoverer {
	private readonly logger = new Logger(DatabaseDiscovererService.name);

	private readonly emitInterval = 20; // The interval, in milliseconds, to wait between each emitted device.

	constructor(private readonly devicesService: DevicesService) {
		super();
	}

	async run() {
		for (const d of await this.devicesService.findAll<ShellyNgDeviceEntity>(DEVICES_SHELLY_NG_TYPE)) {
			if (d.enabled === false) {
				continue;
			}

			if (d.identifier === null) {
				this.logger.error(
					`Failed to prepare device to be managed by Shelly manager. Missing identifier for device=${d.id}`,
				);

				continue;
			}

			await this.emitDevice({
				deviceId: d.identifier,
				hostname: d.hostname,
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
