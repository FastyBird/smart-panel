import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

export type ISimulatorDevicePropertyData = IDevicePropertyData & {
	device: SimulatorDeviceEntity;
};

@Injectable()
export class SimulatorDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'SimulatorDevicePlatform',
	);

	getType(): string {
		return DEVICES_SIMULATOR_TYPE;
	}

	/**
	 * Process a single property update for a simulated device.
	 * Since this is a simulator, we simply accept all updates.
	 */
	process({ device, channel, property, value }: ISimulatorDevicePropertyData): boolean {
		this.logger.log(
			`Simulated property update: device=${device.id}, channel=${channel.id}, property=${property.id}, value=${value}`,
			{ resource: device.id },
		);

		// For simulated devices, we always accept the update
		// The actual value persistence is handled by the PropertyValueService
		return true;
	}

	/**
	 * Process batch property updates for simulated devices.
	 */
	processBatch(updates: Array<ISimulatorDevicePropertyData>): boolean {
		if (updates.length === 0) {
			return true;
		}

		const device = updates[0].device;

		this.logger.log(`Processing batch of ${updates.length} simulated property updates for device=${device.id}`, {
			resource: device.id,
		});

		// For simulated devices, we always accept all updates
		for (const update of updates) {
			this.logger.debug(
				`Simulated update: channel=${update.channel.id}, property=${update.property.id}, value=${update.value}`,
				{ resource: device.id },
			);
		}

		return true;
	}
}
