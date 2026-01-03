import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { LightingRole, SPACES_MODULE_NAME } from '../spaces.constants';

import { ClimateState, SpaceIntentService } from './space-intent.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

/**
 * State of a single light device at a point in time
 */
export interface LightStateSnapshot {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: LightingRole | null;
	isOn: boolean;
	brightness: number | null;
	colorTemperature: number | null;
	color: string | null;
}

/**
 * Summary of lighting state in the space
 */
export interface LightingSummary {
	totalLights: number;
	lightsOn: number;
	averageBrightness: number | null;
}

/**
 * Complete lighting context snapshot
 */
export interface LightingContextSnapshot {
	summary: LightingSummary;
	lights: LightStateSnapshot[];
}

/**
 * Complete space context snapshot
 */
export interface SpaceContextSnapshot {
	spaceId: string;
	spaceName: string;
	capturedAt: Date;
	lighting: LightingContextSnapshot;
	climate: ClimateState;
}

@Injectable()
export class SpaceContextSnapshotService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceContextSnapshotService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
		private readonly lightingRoleService: SpaceLightingRoleService,
	) {}

	/**
	 * Capture a complete context snapshot for a space.
	 * Includes lighting state and climate state.
	 */
	async captureSnapshot(spaceId: string): Promise<SpaceContextSnapshot | null> {
		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Capture lighting state
		const lighting = await this.captureLightingSnapshot(spaceId);

		// Capture climate state (reuse existing method from intent service)
		const climate = await this.spaceIntentService.getClimateState(spaceId);

		const snapshot: SpaceContextSnapshot = {
			spaceId: space.id,
			spaceName: space.name,
			capturedAt: new Date(),
			lighting,
			climate,
		};

		return snapshot;
	}

	/**
	 * Capture the lighting context snapshot for a space
	 */
	private async captureLightingSnapshot(spaceId: string): Promise<LightingContextSnapshot> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const roleMap = await this.lightingRoleService.getRoleMap(spaceId);

		const lights: LightStateSnapshot[] = [];
		let totalBrightness = 0;
		let brightnessCount = 0;

		for (const device of devices) {
			// Check if device is a lighting device
			if (device.category !== DeviceCategory.LIGHTING) {
				continue;
			}

			// Find all light channels (devices can have multiple light channels)
			const lightChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.LIGHT) ?? [];

			for (const lightChannel of lightChannels) {
				// Get the light state
				const lightState = this.extractLightState(device, lightChannel, roleMap);

				if (lightState) {
					lights.push(lightState);

					// Track brightness for averaging
					if (lightState.isOn && lightState.brightness !== null) {
						totalBrightness += lightState.brightness;
						brightnessCount++;
					}
				}
			}
		}

		const lightsOn = lights.filter((l) => l.isOn).length;
		const averageBrightness = brightnessCount > 0 ? Math.round(totalBrightness / brightnessCount) : null;

		return {
			summary: {
				totalLights: lights.length,
				lightsOn,
				averageBrightness,
			},
			lights,
		};
	}

	/**
	 * Extract the current state of a light device
	 */
	private extractLightState(
		device: DeviceEntity,
		channel: ChannelEntity,
		roleMap: Map<string, { role: LightingRole; priority: number }>,
	): LightStateSnapshot | null {
		// Find the ON property (required for lights)
		const onProperty = channel.properties?.find((p) => p.category === PropertyCategory.ON);

		if (!onProperty) {
			return null;
		}

		// Get on/off state
		const isOn = this.getPropertyBooleanValue(onProperty);

		// Find optional properties
		const brightnessProperty = channel.properties?.find((p) => p.category === PropertyCategory.BRIGHTNESS);
		const colorTempProperty = channel.properties?.find((p) => p.category === PropertyCategory.COLOR_TEMPERATURE);

		// Try to build a color value from RGB components or HUE
		const color = this.extractColorValue(channel.properties ?? []);

		// Get role assignment
		const roleKey = `${device.id}:${channel.id}`;
		const roleEntity = roleMap.get(roleKey);
		const role = roleEntity?.role ?? null;

		return {
			deviceId: device.id,
			deviceName: device.name ?? device.id,
			channelId: channel.id,
			channelName: channel.name ?? channel.id,
			role,
			isOn,
			brightness: this.getPropertyNumericValue(brightnessProperty),
			colorTemperature: this.getPropertyNumericValue(colorTempProperty),
			color,
		};
	}

	/**
	 * Extract a color value from properties (RGB components or HUE)
	 * Returns a hex color string if RGB values are found, or hue degree if only hue is found
	 */
	private extractColorValue(properties: ChannelPropertyEntity[]): string | null {
		// Try to find RGB components
		const redProperty = properties.find((p) => p.category === PropertyCategory.COLOR_RED);
		const greenProperty = properties.find((p) => p.category === PropertyCategory.COLOR_GREEN);
		const blueProperty = properties.find((p) => p.category === PropertyCategory.COLOR_BLUE);

		// If all RGB components are present, build a hex color
		if (redProperty && greenProperty && blueProperty) {
			const red = this.getPropertyNumericValue(redProperty);
			const green = this.getPropertyNumericValue(greenProperty);
			const blue = this.getPropertyNumericValue(blueProperty);

			if (red !== null && green !== null && blue !== null) {
				// Clamp values to 0-255 range
				const r = Math.max(0, Math.min(255, Math.round(red)));
				const g = Math.max(0, Math.min(255, Math.round(green)));
				const b = Math.max(0, Math.min(255, Math.round(blue)));

				return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
			}
		}

		// Try to find HUE as a fallback (return as degree value)
		const hueProperty = properties.find((p) => p.category === PropertyCategory.HUE);

		if (hueProperty) {
			const hue = this.getPropertyNumericValue(hueProperty);

			if (hue !== null) {
				return `hue:${hue}`;
			}
		}

		return null;
	}

	/**
	 * Get boolean value from a property
	 */
	private getPropertyBooleanValue(property: ChannelPropertyEntity | null | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value;

		if (typeof value === 'boolean') {
			return value;
		}

		if (value === 'true' || value === 1 || value === '1') {
			return true;
		}

		return false;
	}

	/**
	 * Get numeric value from a property
	 */
	private getPropertyNumericValue(property: ChannelPropertyEntity | null | undefined): number | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);

			return isNaN(parsed) ? null : parsed;
		}

		return null;
	}

	/**
	 * Get string value from a property
	 */
	private getPropertyStringValue(property: ChannelPropertyEntity | null | undefined): string | null {
		if (!property) {
			return null;
		}

		const value = property.value;

		if (typeof value === 'string') {
			return value;
		}

		if (value !== null && value !== undefined) {
			return String(value);
		}

		return null;
	}
}
