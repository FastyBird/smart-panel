import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import {
	ClimateMode,
	CoversRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	LightingRole,
	SPACES_MODULE_NAME,
} from '../spaces.constants';

import { SpaceCoversRoleService } from './space-covers-role.service';
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
 * Climate state snapshot (extends ClimateState with device ID for undo)
 */
export interface ClimateStateSnapshot extends ClimateState {
	primaryThermostatId: string | null;
}

/**
 * State of a single cover device at a point in time
 */
export interface CoverStateSnapshot {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	role: CoversRole | null;
	position: number | null;
}

/**
 * Summary of covers state in the space
 */
export interface CoversSummary {
	totalCovers: number;
	averagePosition: number | null;
}

/**
 * Complete covers context snapshot
 */
export interface CoversContextSnapshot {
	summary: CoversSummary;
	covers: CoverStateSnapshot[];
}

/**
 * Complete space context snapshot
 */
export interface SpaceContextSnapshot {
	spaceId: string;
	spaceName: string;
	capturedAt: Date;
	lighting: LightingContextSnapshot;
	climate: ClimateStateSnapshot;
	covers: CoversContextSnapshot;
}

@Injectable()
export class SpaceContextSnapshotService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceContextSnapshotService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
		private readonly lightingRoleService: SpaceLightingRoleService,
		private readonly coversRoleService: SpaceCoversRoleService,
	) {}

	/**
	 * Capture a complete context snapshot for a space.
	 * Includes lighting state, climate state, and covers state.
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
		const climateState = await this.spaceIntentService.getClimateState(spaceId);

		// Get primary thermostat ID from intent service (uses same logic as executeClimateIntent)
		const primaryThermostatId = await this.spaceIntentService.getPrimaryThermostatId(spaceId);

		// Default climate state when null (space exists but no climate devices)
		const defaultClimateState: ClimateState = {
			hasClimate: false,
			mode: ClimateMode.OFF,
			currentTemperature: null,
			currentHumidity: null,
			heatingSetpoint: null,
			coolingSetpoint: null,
			minSetpoint: DEFAULT_MIN_SETPOINT,
			maxSetpoint: DEFAULT_MAX_SETPOINT,
			supportsHeating: false,
			supportsCooling: false,
			isHeating: false,
			isCooling: false,
			isMixed: false,
			devicesCount: 0,
			lastAppliedMode: null,
			lastAppliedAt: null,
		};

		const climate: ClimateStateSnapshot = {
			...(climateState ?? defaultClimateState),
			primaryThermostatId,
		};

		// Capture covers state
		const covers = await this.captureCoversSnapshot(spaceId);

		const snapshot: SpaceContextSnapshot = {
			spaceId: space.id,
			spaceName: space.name,
			capturedAt: new Date(),
			lighting,
			climate,
			covers,
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
	 * Capture the covers context snapshot for a space
	 */
	private async captureCoversSnapshot(spaceId: string): Promise<CoversContextSnapshot> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const roleMap = await this.coversRoleService.getRoleMap(spaceId);

		const covers: CoverStateSnapshot[] = [];
		let totalPosition = 0;
		let positionCount = 0;

		for (const device of devices) {
			// Check if device is a window covering device
			if (device.category !== DeviceCategory.WINDOW_COVERING) {
				continue;
			}

			// Find all window covering channels
			const coverChannels = device.channels?.filter((ch) => ch.category === ChannelCategory.WINDOW_COVERING) ?? [];

			for (const coverChannel of coverChannels) {
				// Get the cover state
				const coverState = this.extractCoverState(device, coverChannel, roleMap);

				if (coverState) {
					covers.push(coverState);

					// Track position for averaging
					if (coverState.position !== null) {
						totalPosition += coverState.position;
						positionCount++;
					}
				}
			}
		}

		const averagePosition = positionCount > 0 ? Math.round(totalPosition / positionCount) : null;

		return {
			summary: {
				totalCovers: covers.length,
				averagePosition,
			},
			covers,
		};
	}

	/**
	 * Extract the current state of a cover device
	 */
	private extractCoverState(
		device: DeviceEntity,
		channel: ChannelEntity,
		roleMap: Map<string, { role: CoversRole; priority: number }>,
	): CoverStateSnapshot | null {
		// Find the position property
		const positionProperty = channel.properties?.find((p) => p.category === PropertyCategory.POSITION);

		// Get position value
		const position = this.getPropertyNumericValue(positionProperty);

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
			position,
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
	 * Extract a color value from properties (RGB components or HUE + SATURATION)
	 * Returns a hex color string for consistent panel display and convergence checks.
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

		// Try HUE + SATURATION (convert to hex so panel gets full color for display/convergence)
		const hueProperty = properties.find((p) => p.category === PropertyCategory.HUE);
		const saturationProperty = properties.find((p) => p.category === PropertyCategory.SATURATION);

		if (hueProperty && saturationProperty) {
			const hue = this.getPropertyNumericValue(hueProperty);
			const saturationRaw = this.getPropertyNumericValue(saturationProperty);

			if (hue !== null && saturationRaw !== null) {
				const sat = saturationRaw > 1 ? saturationRaw / 100 : saturationRaw;
				const hex = this.hsvToHex(hue, Math.max(0, Math.min(1, sat)), 1);
				if (hex) return hex;
			}
		}

		// Fallback: hue only (device has hue but no saturation property)
		if (hueProperty) {
			const hue = this.getPropertyNumericValue(hueProperty);

			if (hue !== null) {
				return `hue:${hue}`;
			}
		}

		return null;
	}

	/**
	 * Convert HSV to hex color string.
	 * H: 0-360 (degrees), S: 0-1, V: 0-1
	 */
	private hsvToHex(h: number, s: number, v: number): string {
		const c = v * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = v - c;

		let r = 0,
			g = 0,
			b = 0;

		if (h >= 0 && h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (h >= 60 && h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (h >= 120 && h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (h >= 180 && h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (h >= 240 && h < 300) {
			r = x;
			g = 0;
			b = c;
		} else {
			r = c;
			g = 0;
			b = x;
		}

		const red = Math.round((r + m) * 255);
		const green = Math.round((g + m) * 255);
		const blue = Math.round((b + m) * 255);

		return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
	}

	/**
	 * Get boolean value from a property
	 */
	private getPropertyBooleanValue(property: ChannelPropertyEntity | null | undefined): boolean {
		if (!property) {
			return false;
		}

		const value = property.value?.value;

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

		const value = property.value?.value;

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

		const value = property.value?.value;

		if (typeof value === 'string') {
			return value;
		}

		if (value !== null && value !== undefined) {
			return String(value);
		}

		return null;
	}
}
