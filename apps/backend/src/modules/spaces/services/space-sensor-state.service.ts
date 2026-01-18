import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import {
	SENSOR_CHANNEL_CATEGORIES,
	SENSOR_SAFETY_CHANNEL_CATEGORIES,
	SPACES_MODULE_NAME,
	SensorRole,
} from '../spaces.constants';

import { SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceSensorRoleService } from './space-sensor-role.service';
import { SpacesService } from './spaces.service';

/**
 * Individual sensor reading
 */
export interface SensorReading {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	channelCategory: ChannelCategory;
	value: number | boolean | string | null;
	unit: string | null;
	role: SensorRole | null;
}

/**
 * Aggregated sensor readings by role
 */
export interface SensorRoleReadings {
	role: SensorRole;
	sensorsCount: number;
	readings: SensorReading[];
}

/**
 * Environment summary data
 */
export interface EnvironmentSummary {
	averageTemperature: number | null;
	averageHumidity: number | null;
	averagePressure: number | null;
	averageIlluminance: number | null;
}

/**
 * Safety alert info
 */
export interface SafetyAlert {
	channelCategory: ChannelCategory;
	deviceId: string;
	deviceName: string;
	channelId: string;
	triggered: boolean;
}

/**
 * Full sensor state for a space
 */
export interface SensorState {
	hasSensors: boolean;
	totalSensors: number;
	sensorsByRole: Record<string, number>;
	environment: EnvironmentSummary | null;
	safetyAlerts: SafetyAlert[];
	hasSafetyAlert: boolean;
	motionDetected: boolean;
	occupancyDetected: boolean;
	readings: SensorRoleReadings[];
}

/**
 * Service for calculating aggregated sensor state.
 * Provides state data for UI display without panel-side calculation.
 */
@Injectable()
export class SpaceSensorStateService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceSensorStateService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly sensorRoleService: SpaceSensorRoleService,
	) {
		super();
	}

	/**
	 * Get the current sensor state for a space.
	 * Aggregates readings from all sensor channels, detects alerts, and groups by role.
	 */
	async getSensorState(spaceId: string): Promise<SensorState | null> {
		const defaultState: SensorState = {
			hasSensors: false,
			totalSensors: 0,
			sensorsByRole: {},
			environment: null,
			safetyAlerts: [],
			hasSafetyAlert: false,
			motionDetected: false,
			occupancyDetected: false,
			readings: [],
		};

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);
			return null;
		}

		// Get all devices in the space
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		// Get all role assignments
		const roleMap = await this.sensorRoleService.getRoleMap(spaceId);

		// Collect all sensor readings
		const allReadings: SensorReading[] = [];
		const sensorsByRole: Record<string, number> = {};
		const safetyAlerts: SafetyAlert[] = [];

		// Environment data for averaging
		const temperatures: number[] = [];
		const humidities: number[] = [];
		const pressures: number[] = [];
		const illuminances: number[] = [];

		// Security detection
		let motionDetected = false;
		let occupancyDetected = false;

		for (const device of devices) {
			for (const channel of device.channels ?? []) {
				// Only process sensor channels
				const isSensorChannel = SENSOR_CHANNEL_CATEGORIES.includes(
					channel.category as (typeof SENSOR_CHANNEL_CATEGORIES)[number],
				);
				if (!isSensorChannel) {
					continue;
				}

				const key = `${device.id}:${channel.id}`;
				const roleEntity = roleMap.get(key);
				const role = roleEntity?.role ?? null;

				// Skip hidden sensors
				if (role === SensorRole.HIDDEN) {
					continue;
				}

				// Get the primary property value
				const { value, unit } = this.extractChannelValue(channel);

				const reading: SensorReading = {
					deviceId: device.id,
					deviceName: device.name,
					channelId: channel.id,
					channelName: channel.name ?? channel.category,
					channelCategory: channel.category,
					value,
					unit,
					role,
				};

				allReadings.push(reading);

				// Count by role
				const roleKey = role ?? 'unassigned';
				sensorsByRole[roleKey] = (sensorsByRole[roleKey] ?? 0) + 1;

				// Collect environment readings for averaging
				this.collectEnvironmentData(channel, temperatures, humidities, pressures, illuminances);

				// Check for safety alerts
				this.checkSafetyAlerts(device, channel, value, safetyAlerts);

				// Check for motion/occupancy
				if (channel.category === ChannelCategory.MOTION && value === true) {
					motionDetected = true;
				}
				if (channel.category === ChannelCategory.OCCUPANCY && value === true) {
					occupancyDetected = true;
				}
			}
		}

		if (allReadings.length === 0) {
			return defaultState;
		}

		// Group readings by role
		const readingsByRole = this.groupReadingsByRole(allReadings);

		// Build environment summary
		const environment: EnvironmentSummary = {
			averageTemperature: this.calculateAverage(temperatures),
			averageHumidity: this.calculateAverage(humidities),
			averagePressure: this.calculateAverage(pressures),
			averageIlluminance: this.calculateAverage(illuminances),
		};

		const hasEnvironmentData =
			environment.averageTemperature !== null ||
			environment.averageHumidity !== null ||
			environment.averagePressure !== null ||
			environment.averageIlluminance !== null;

		return {
			hasSensors: true,
			totalSensors: allReadings.length,
			sensorsByRole,
			environment: hasEnvironmentData ? environment : null,
			safetyAlerts,
			hasSafetyAlert: safetyAlerts.some((a) => a.triggered),
			motionDetected,
			occupancyDetected,
			readings: readingsByRole,
		};
	}

	/**
	 * Extract the primary value and unit from a sensor channel
	 */
	private extractChannelValue(channel: ChannelEntity): {
		value: number | boolean | string | null;
		unit: string | null;
	} {
		const properties = channel.properties ?? [];

		// Try to find the primary property based on channel category
		let primaryProperty: ChannelPropertyEntity | undefined;
		let unit: string | null = null;

		switch (channel.category) {
			case ChannelCategory.TEMPERATURE:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.TEMPERATURE);
				unit = '°C';
				break;
			case ChannelCategory.HUMIDITY:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.HUMIDITY);
				unit = '%';
				break;
			case ChannelCategory.PRESSURE:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.MEASURED);
				unit = 'kPa';
				break;
			case ChannelCategory.ILLUMINANCE:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.DENSITY);
				unit = 'lux';
				break;
			case ChannelCategory.MOTION:
			case ChannelCategory.OCCUPANCY:
			case ChannelCategory.CONTACT:
			case ChannelCategory.SMOKE:
			case ChannelCategory.LEAK:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.DETECTED);
				unit = null;
				break;
			case ChannelCategory.GAS:
				primaryProperty =
					properties.find((p) => p.category === PropertyCategory.DETECTED) ??
					properties.find((p) => p.category === PropertyCategory.DENSITY);
				unit = primaryProperty?.category === PropertyCategory.DENSITY ? 'ppm' : null;
				break;
			case ChannelCategory.CARBON_DIOXIDE:
			case ChannelCategory.CARBON_MONOXIDE:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.DENSITY);
				unit = 'ppm';
				break;
			case ChannelCategory.AIR_QUALITY:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.AQI);
				unit = 'AQI';
				break;
			case ChannelCategory.AIR_PARTICULATE:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.DENSITY);
				unit = 'µg/m³';
				break;
			case ChannelCategory.ELECTRICAL_POWER:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.POWER);
				unit = 'W';
				break;
			case ChannelCategory.ELECTRICAL_ENERGY:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.CONSUMPTION);
				unit = 'kWh';
				break;
			case ChannelCategory.BATTERY:
				primaryProperty = properties.find((p) => p.category === PropertyCategory.PERCENTAGE);
				unit = '%';
				break;
			default:
				// Try to find any value property
				primaryProperty = properties[0];
				unit = primaryProperty?.unit ?? null;
		}

		if (!primaryProperty) {
			return { value: null, unit: null };
		}

		const value = primaryProperty.value;

		if (typeof value === 'boolean') {
			return { value, unit: null };
		}

		if (typeof value === 'number') {
			return { value, unit };
		}

		if (typeof value === 'string') {
			const parsed = parseFloat(value);
			if (!isNaN(parsed)) {
				return { value: parsed, unit };
			}
			return { value, unit: null };
		}

		return { value: null, unit };
	}

	/**
	 * Collect environment data for averaging
	 */
	private collectEnvironmentData(
		channel: ChannelEntity,
		temperatures: number[],
		humidities: number[],
		pressures: number[],
		illuminances: number[],
	): void {
		const properties = channel.properties ?? [];

		if (channel.category === ChannelCategory.TEMPERATURE) {
			const tempProp = properties.find((p) => p.category === PropertyCategory.TEMPERATURE);
			const temp = this.getPropertyNumericValue(tempProp);
			if (temp !== null) {
				temperatures.push(temp);
			}
		}

		if (channel.category === ChannelCategory.HUMIDITY) {
			const humProp = properties.find((p) => p.category === PropertyCategory.HUMIDITY);
			const humidity = this.getPropertyNumericValue(humProp);
			if (humidity !== null) {
				humidities.push(humidity);
			}
		}

		if (channel.category === ChannelCategory.PRESSURE) {
			const pressProp = properties.find((p) => p.category === PropertyCategory.MEASURED);
			const pressure = this.getPropertyNumericValue(pressProp);
			if (pressure !== null) {
				pressures.push(pressure);
			}
		}

		if (channel.category === ChannelCategory.ILLUMINANCE) {
			const illumProp = properties.find((p) => p.category === PropertyCategory.DENSITY);
			const illuminance = this.getPropertyNumericValue(illumProp);
			if (illuminance !== null) {
				illuminances.push(illuminance);
			}
		}
	}

	/**
	 * Check for safety alerts from a channel
	 */
	private checkSafetyAlerts(
		device: DeviceEntity,
		channel: ChannelEntity,
		value: number | boolean | string | null,
		safetyAlerts: SafetyAlert[],
	): void {
		const isSafetyChannel = SENSOR_SAFETY_CHANNEL_CATEGORIES.includes(
			channel.category as (typeof SENSOR_SAFETY_CHANNEL_CATEGORIES)[number],
		);

		if (!isSafetyChannel) {
			return;
		}

		// For boolean safety sensors, check if triggered
		const triggered = value === true;

		safetyAlerts.push({
			channelCategory: channel.category,
			deviceId: device.id,
			deviceName: device.name,
			channelId: channel.id,
			triggered,
		});
	}

	/**
	 * Group readings by role
	 */
	private groupReadingsByRole(readings: SensorReading[]): SensorRoleReadings[] {
		const byRole = new Map<SensorRole | 'unassigned', SensorReading[]>();

		for (const reading of readings) {
			const roleKey = reading.role ?? ('unassigned' as const);
			const existing = byRole.get(roleKey) ?? [];
			existing.push(reading);
			byRole.set(roleKey, existing);
		}

		const result: SensorRoleReadings[] = [];

		// Process assigned roles first
		const roleOrder: SensorRole[] = [
			SensorRole.ENVIRONMENT,
			SensorRole.SAFETY,
			SensorRole.SECURITY,
			SensorRole.AIR_QUALITY,
			SensorRole.ENERGY,
			SensorRole.OTHER,
		];

		for (const role of roleOrder) {
			const roleReadings = byRole.get(role);
			if (roleReadings && roleReadings.length > 0) {
				result.push({
					role,
					sensorsCount: roleReadings.length,
					readings: roleReadings,
				});
			}
		}

		// Add unassigned at the end (as OTHER)
		const unassigned = byRole.get('unassigned');
		if (unassigned && unassigned.length > 0) {
			result.push({
				role: SensorRole.OTHER,
				sensorsCount: unassigned.length,
				readings: unassigned,
			});
		}

		return result;
	}

	/**
	 * Calculate average of an array of numbers
	 */
	private calculateAverage(values: number[]): number | null {
		if (values.length === 0) {
			return null;
		}
		const sum = values.reduce((a, b) => a + b, 0);
		return Math.round((sum / values.length) * 10) / 10;
	}
}
