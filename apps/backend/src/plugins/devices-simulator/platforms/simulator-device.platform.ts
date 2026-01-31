import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { DeviceBehaviorManagerService } from '../services/device-behavior-manager.service';

export type ISimulatorDevicePropertyData = IDevicePropertyData & {
	device: SimulatorDeviceEntity;
};

@Injectable()
export class SimulatorDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'SimulatorDevicePlatform',
	);

	constructor(
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly behaviorManager: DeviceBehaviorManagerService,
	) {}

	getType(): string {
		return DEVICES_SIMULATOR_TYPE;
	}

	/**
	 * Process a single property update for a simulated device.
	 * Since this is a simulator, we persist the value directly.
	 */
	async process({ device, channel, property, value }: ISimulatorDevicePropertyData): Promise<boolean> {
		this.logger.log(
			`Simulated property update: device=${device.id}, channel=${channel.id}, property=${property.id}, value=${value}`,
			{ resource: device.id },
		);

		try {
			const previousValue = property.value?.value;

			// For simulated devices, we persist the value directly since there's no physical device
			await this.channelsPropertiesService.update(property.id, {
				type: property.type,
				value,
			});

			// Notify behavior manager about the property change so it can schedule
			// realistic follow-up updates (e.g., gradual temperature convergence)
			this.behaviorManager.handlePropertyChange(device, channel.category, property.category, value, previousValue);

			return true;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to update simulated property: ${err.message}`, { resource: device.id });

			return false;
		}
	}

	/**
	 * Process batch property updates for simulated devices.
	 */
	async processBatch(updates: Array<ISimulatorDevicePropertyData>): Promise<boolean> {
		if (updates.length === 0) {
			return true;
		}

		const device = updates[0].device;

		this.logger.log(`Processing batch of ${updates.length} simulated property updates for device=${device.id}`, {
			resource: device.id,
		});

		const results: boolean[] = [];

		// Process each update and persist the value
		for (const update of updates) {
			try {
				const previousValue = update.property.value?.value;

				await this.channelsPropertiesService.update(update.property.id, {
					type: update.property.type,
					value: update.value,
				});

				this.logger.debug(
					`Simulated update: channel=${update.channel.id}, property=${update.property.id}, value=${update.value}`,
					{ resource: update.device.id },
				);

				// Notify behavior manager about the property change
				this.behaviorManager.handlePropertyChange(
					update.device,
					update.channel.category,
					update.property.category,
					update.value,
					previousValue,
				);

				results.push(true);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to update property ${update.property.id}: ${err.message}`, {
					resource: update.device.id,
				});

				results.push(false);
			}
		}

		// Return true only if all updates succeeded
		const allSucceeded = results.every((r) => r === true);

		if (!allSucceeded) {
			this.logger.warn(`Some properties failed to update for device id=${device.id}`, { resource: device.id });
		}

		return allSucceeded;
	}
}
