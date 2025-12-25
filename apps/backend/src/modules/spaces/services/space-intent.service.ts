import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	LIGHTING_MODE_BRIGHTNESS,
	LightingIntentType,
	LightingMode,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpacesService } from './spaces.service';

interface LightDevice {
	device: DeviceEntity;
	lightChannel: ChannelEntity;
	onProperty: ChannelPropertyEntity;
	brightnessProperty: ChannelPropertyEntity | null;
}

interface IntentExecutionResult {
	success: boolean;
	affectedDevices: number;
	failedDevices: number;
}

@Injectable()
export class SpaceIntentService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly devicesService: DevicesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	/**
	 * Execute a lighting intent for all lights in a space
	 */
	async executeLightingIntent(spaceId: string, intent: LightingIntentDto): Promise<IntentExecutionResult> {
		this.logger.debug(`Executing lighting intent type=${intent.type} spaceId=${spaceId}`);

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return { success: false, affectedDevices: 0, failedDevices: 0 };
		}

		// Get all lights in the space
		const lights = await this.getLightsInSpace(spaceId);

		if (lights.length === 0) {
			this.logger.debug(`No lights found in space id=${spaceId}`);

			return { success: true, affectedDevices: 0, failedDevices: 0 };
		}

		this.logger.debug(`Found ${lights.length} lights in space id=${spaceId}`);

		// Execute intent based on type
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const light of lights) {
			const success = await this.executeIntentForLight(light, intent);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		this.logger.debug(
			`Lighting intent completed spaceId=${spaceId} affected=${affectedDevices} failed=${failedDevices}`,
		);

		return { success: overallSuccess, affectedDevices, failedDevices };
	}

	/**
	 * Find all light devices in a space with their channels and properties
	 */
	private async getLightsInSpace(spaceId: string): Promise<LightDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const lights: LightDevice[] = [];

		for (const device of devices) {
			// Check if device is a lighting device
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			// Find the light channel
			const lightChannel = device.channels?.find((ch) => ch.category === ChannelCategory.LIGHT);

			if (!lightChannel) {
				this.logger.debug(`Light device has no light channel deviceId=${device.id}`);
				continue;
			}

			// Find the ON property (required for lights)
			const onProperty = lightChannel.properties?.find((p) => p.category === PropertyCategory.ON);

			if (!onProperty) {
				this.logger.debug(`Light channel has no ON property deviceId=${device.id} channelId=${lightChannel.id}`);
				continue;
			}

			// Find brightness property (optional)
			const brightnessProperty =
				lightChannel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS) ?? null;

			lights.push({
				device,
				lightChannel,
				onProperty,
				brightnessProperty,
			});
		}

		return lights;
	}

	/**
	 * Execute a lighting intent for a single light
	 */
	private async executeIntentForLight(light: LightDevice, intent: LightingIntentDto): Promise<boolean> {
		const platform = this.platformRegistryService.get(light.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${light.device.id} type=${light.device.type}`);

			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (intent.type) {
			case LightingIntentType.OFF:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: false,
				});
				break;

			case LightingIntentType.ON:
				commands.push({
					device: light.device,
					channel: light.lightChannel,
					property: light.onProperty,
					value: true,
				});
				break;

			case LightingIntentType.SET_MODE:
				if (!intent.mode) {
					this.logger.warn('SET_MODE intent requires mode parameter');

					return false;
				}
				commands.push(...this.buildModeCommands(light, intent.mode));
				break;

			case LightingIntentType.BRIGHTNESS_DELTA:
				if (intent.delta === undefined || intent.increase === undefined) {
					this.logger.warn('BRIGHTNESS_DELTA intent requires delta and increase parameters');

					return false;
				}
				commands.push(...this.buildBrightnessDeltaCommands(light, intent.delta, intent.increase));
				break;

			default:
				this.logger.warn(`Unknown intent type: ${String(intent.type)}`);

				return false;
		}

		if (commands.length === 0) {
			this.logger.debug(`No commands to execute for device id=${light.device.id}`);

			return true;
		}

		try {
			const success = await platform.processBatch(commands);

			if (!success) {
				this.logger.error(`Command execution failed for device id=${light.device.id}`);

				return false;
			}

			this.logger.debug(`Successfully executed commands for device id=${light.device.id}`);

			return true;
		} catch (error) {
			this.logger.error(`Error executing commands for device id=${light.device.id}: ${error}`);

			return false;
		}
	}

	/**
	 * Build commands for a lighting mode
	 */
	private buildModeCommands(light: LightDevice, mode: LightingMode): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// Always turn on the light
		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.onProperty,
			value: true,
		});

		// Set brightness if supported
		if (light.brightnessProperty) {
			const brightness = LIGHTING_MODE_BRIGHTNESS[mode];

			commands.push({
				device: light.device,
				channel: light.lightChannel,
				property: light.brightnessProperty,
				value: brightness,
			});
		}

		return commands;
	}

	/**
	 * Build commands for a brightness delta adjustment
	 */
	private buildBrightnessDeltaCommands(
		light: LightDevice,
		delta: BrightnessDelta,
		increase: boolean,
	): IDevicePropertyData[] {
		const commands: IDevicePropertyData[] = [];

		// If light doesn't support brightness, just ignore (no-op)
		if (!light.brightnessProperty) {
			this.logger.debug(`Device does not support brightness adjustment deviceId=${light.device.id}`);

			return commands;
		}

		// Get current brightness value
		const currentValue = light.brightnessProperty.value;
		let currentBrightness = 50; // Default if no value

		if (typeof currentValue === 'number') {
			currentBrightness = currentValue;
		} else if (typeof currentValue === 'string') {
			const parsed = parseFloat(currentValue);

			if (!isNaN(parsed)) {
				currentBrightness = parsed;
			}
		}

		// Calculate new brightness
		const deltaValue = BRIGHTNESS_DELTA_STEPS[delta];
		let newBrightness = increase ? currentBrightness + deltaValue : currentBrightness - deltaValue;

		// Clamp to [0, 100]
		newBrightness = Math.max(0, Math.min(100, newBrightness));

		commands.push({
			device: light.device,
			channel: light.lightChannel,
			property: light.brightnessProperty,
			value: newBrightness,
		});

		return commands;
	}
}
