import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import {
	CLIMATE_PRIMARY_DEVICE_CATEGORIES,
	ClimateMode,
	ClimateRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	SPACES_MODULE_NAME,
	TEMPERATURE_AVERAGING_STRATEGY,
	TemperatureAveragingStrategy,
} from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceIntentBaseService } from './space-intent-base.service';
import { SpacesService } from './spaces.service';

/**
 * Information about a primary climate device (thermostat, heater unit, air conditioner).
 * Tracks channel capabilities and properties for multi-device climate control.
 */
export interface PrimaryClimateDevice {
	device: DeviceEntity;
	deviceCategory: DeviceCategory;
	role: ClimateRole | null;
	// Temperature reading
	temperatureChannel: ChannelEntity | null;
	temperatureProperty: ChannelPropertyEntity | null;
	// Humidity reading (optional)
	humidityChannel: ChannelEntity | null;
	humidityProperty: ChannelPropertyEntity | null;
	// Heater control
	heaterChannel: ChannelEntity | null;
	heaterOnProperty: ChannelPropertyEntity | null;
	heaterSetpointProperty: ChannelPropertyEntity | null;
	heaterMinSetpoint: number;
	heaterMaxSetpoint: number;
	// Cooler control
	coolerChannel: ChannelEntity | null;
	coolerOnProperty: ChannelPropertyEntity | null;
	coolerSetpointProperty: ChannelPropertyEntity | null;
	coolerMinSetpoint: number;
	coolerMaxSetpoint: number;
	// Thermostat channel (for devices with unified thermostat control)
	thermostatChannel: ChannelEntity | null;
	// Capabilities
	supportsHeating: boolean;
	supportsCooling: boolean;
}

/**
 * Full climate state for a space, including multi-device aggregated values.
 */
export interface ClimateState {
	hasClimate: boolean;
	mode: ClimateMode;
	currentTemperature: number | null;
	currentHumidity: number | null;
	targetTemperature: number | null;
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
	minSetpoint: number;
	maxSetpoint: number;
	canSetSetpoint: boolean;
	supportsHeating: boolean;
	supportsCooling: boolean;
	isMixed: boolean;
	devicesCount: number;
	// Last applied mode from InfluxDB storage
	lastAppliedMode: ClimateMode | null;
	lastAppliedAt: Date | null;
}

/**
 * Service for calculating aggregated climate state.
 * Provides state data for UI display without panel-side calculation.
 */
@Injectable()
export class SpaceClimateStateService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceClimateStateService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly climateRoleService: SpaceClimateRoleService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
	) {
		super();
	}

	/**
	 * Get the current climate state for a space using multi-device climate roles.
	 * Aggregates temperature/humidity from all primary devices, detects mode from device states,
	 * and calculates intersection of setpoint ranges.
	 */
	async getClimateState(spaceId: string): Promise<ClimateState | null> {
		const defaultState: ClimateState = {
			hasClimate: false,
			mode: ClimateMode.OFF,
			currentTemperature: null,
			currentHumidity: null,
			targetTemperature: null,
			heatingSetpoint: null,
			coolingSetpoint: null,
			minSetpoint: DEFAULT_MIN_SETPOINT,
			maxSetpoint: DEFAULT_MAX_SETPOINT,
			canSetSetpoint: false,
			supportsHeating: false,
			supportsCooling: false,
			isMixed: false,
			devicesCount: 0,
			lastAppliedMode: null,
			lastAppliedAt: null,
		};

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return null;
		}

		// Get all primary climate devices (excluding HIDDEN)
		const primaryDevices = await this.getPrimaryClimateDevicesInSpace(spaceId);

		if (primaryDevices.length === 0) {
			this.logger.debug(`No primary climate devices found in space id=${spaceId}`);

			return defaultState;
		}

		// Aggregate temperature readings
		const temperatures: number[] = [];
		const humidities: number[] = [];

		// Check if we should include sensors based on strategy
		const includeSensors = TEMPERATURE_AVERAGING_STRATEGY === TemperatureAveragingStrategy.ALL_SOURCES;

		for (const device of primaryDevices) {
			// Get temperature from this device
			const temp = this.getPropertyNumericValue(device.temperatureProperty);
			if (temp !== null) {
				temperatures.push(temp);
			}

			// Get humidity from this device
			const humidity = this.getPropertyNumericValue(device.humidityProperty);
			if (humidity !== null) {
				humidities.push(humidity);
			}
		}

		// If including sensors, also get temperature from SENSOR role devices
		if (includeSensors) {
			const sensorTemperatures = await this.getSensorTemperatures(spaceId);
			temperatures.push(...sensorTemperatures);
		}

		// Calculate averages
		const currentTemperature =
			temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : null;
		const currentHumidity = humidities.length > 0 ? humidities.reduce((a, b) => a + b, 0) / humidities.length : null;

		// Determine capabilities and collect setpoints
		let supportsHeating = false;
		let supportsCooling = false;
		const heatingSetpoints: number[] = [];
		const coolingSetpoints: number[] = [];

		// Track both intersection (most restrictive) and union (widest) bounds
		let intersectionMin = DEFAULT_MIN_SETPOINT;
		let intersectionMax = DEFAULT_MAX_SETPOINT;
		let unionMin = DEFAULT_MAX_SETPOINT; // Start high for union min
		let unionMax = DEFAULT_MIN_SETPOINT; // Start low for union max
		let hasSetBounds = false; // Track if we've set any bounds yet

		for (const device of primaryDevices) {
			if (device.supportsHeating) {
				supportsHeating = true;
				const setpoint = this.getPropertyNumericValue(device.heaterSetpointProperty);
				if (setpoint !== null) {
					heatingSetpoints.push(setpoint);
				}
				// Calculate intersection of min/max (most restrictive)
				if (!hasSetBounds) {
					intersectionMin = device.heaterMinSetpoint;
					intersectionMax = device.heaterMaxSetpoint;
					hasSetBounds = true;
				} else {
					intersectionMin = Math.max(intersectionMin, device.heaterMinSetpoint);
					intersectionMax = Math.min(intersectionMax, device.heaterMaxSetpoint);
				}
				// Calculate union (widest bounds)
				unionMin = Math.min(unionMin, device.heaterMinSetpoint);
				unionMax = Math.max(unionMax, device.heaterMaxSetpoint);
			}
			if (device.supportsCooling) {
				supportsCooling = true;
				const setpoint = this.getPropertyNumericValue(device.coolerSetpointProperty);
				if (setpoint !== null) {
					coolingSetpoints.push(setpoint);
				}
				// Calculate intersection of min/max (most restrictive)
				if (!hasSetBounds) {
					intersectionMin = device.coolerMinSetpoint;
					intersectionMax = device.coolerMaxSetpoint;
					hasSetBounds = true;
				} else {
					intersectionMin = Math.max(intersectionMin, device.coolerMinSetpoint);
					intersectionMax = Math.min(intersectionMax, device.coolerMaxSetpoint);
				}
				// Calculate union (widest bounds)
				unionMin = Math.min(unionMin, device.coolerMinSetpoint);
				unionMax = Math.max(unionMax, device.coolerMaxSetpoint);
			}
		}

		// Determine final setpoint bounds
		// Use intersection if valid, otherwise fall back to union
		let minSetpoint: number;
		let maxSetpoint: number;

		if (intersectionMin <= intersectionMax) {
			// Valid intersection - use most restrictive bounds
			minSetpoint = intersectionMin;
			maxSetpoint = intersectionMax;
		} else {
			// Non-overlapping device ranges - fall back to union (widest bounds)
			// This allows users to set values in any device's range
			this.logger.warn(
				`Non-overlapping setpoint ranges detected in space=${spaceId}. ` +
					`Intersection would be [${intersectionMin}, ${intersectionMax}]. ` +
					`Falling back to union [${unionMin}, ${unionMax}].`,
			);
			minSetpoint = unionMin;
			maxSetpoint = unionMax;
		}

		// Detect current mode from device states
		const detectedMode = this.detectClimateMode(primaryDevices);

		// Get last applied mode from InfluxDB (user's intent, more reliable than detected mode)
		const lastApplied = await this.intentTimeseriesService.getLastClimateMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(ClimateMode).includes(lastApplied.mode as ClimateMode)
				? (lastApplied.mode as ClimateMode)
				: null
			: null;

		// Use lastAppliedMode for calculations if available, as detected mode may be stale
		// immediately after a mode change (devices take time to update their state)
		const effectiveMode = lastAppliedMode ?? detectedMode;

		// Calculate target temperatures based on mode
		let targetTemperature: number | null = null;
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		if (heatingSetpoints.length > 0) {
			heatingSetpoint = heatingSetpoints.reduce((a, b) => a + b, 0) / heatingSetpoints.length;
		}
		if (coolingSetpoints.length > 0) {
			coolingSetpoint = coolingSetpoints.reduce((a, b) => a + b, 0) / coolingSetpoints.length;
		}

		// Set targetTemperature based on effective mode (lastApplied or detected)
		if (effectiveMode === ClimateMode.HEAT && heatingSetpoint !== null) {
			targetTemperature = heatingSetpoint;
		} else if (effectiveMode === ClimateMode.COOL && coolingSetpoint !== null) {
			targetTemperature = coolingSetpoint;
		} else if (effectiveMode === ClimateMode.AUTO) {
			// In AUTO mode, use the average of both setpoints as "target"
			if (heatingSetpoint !== null && coolingSetpoint !== null) {
				targetTemperature = (heatingSetpoint + coolingSetpoint) / 2;
			} else {
				targetTemperature = heatingSetpoint ?? coolingSetpoint;
			}
		}

		// Detect mixed state (setpoints out of sync)
		const isMixed = this.detectMixedState(heatingSetpoints, coolingSetpoints);

		const canSetSetpoint = supportsHeating || supportsCooling;

		return {
			hasClimate: true,
			mode: detectedMode,
			currentTemperature: currentTemperature !== null ? Math.round(currentTemperature * 10) / 10 : null,
			currentHumidity: currentHumidity !== null ? Math.round(currentHumidity) : null,
			targetTemperature: targetTemperature !== null ? Math.round(targetTemperature * 2) / 2 : null,
			heatingSetpoint: heatingSetpoint !== null ? Math.round(heatingSetpoint * 2) / 2 : null,
			coolingSetpoint: coolingSetpoint !== null ? Math.round(coolingSetpoint * 2) / 2 : null,
			minSetpoint,
			maxSetpoint,
			canSetSetpoint,
			supportsHeating,
			supportsCooling,
			isMixed,
			devicesCount: primaryDevices.length,
			lastAppliedMode,
			lastAppliedAt: lastApplied?.appliedAt ?? null,
		};
	}

	/**
	 * Get all primary climate devices in the space.
	 * Primary devices are: thermostat, heating_unit, air_conditioner
	 * Excludes devices with HIDDEN role.
	 */
	async getPrimaryClimateDevicesInSpace(spaceId: string): Promise<PrimaryClimateDevice[]> {
		const devices = await this.spacesService.findDevicesBySpace(spaceId);
		const roleMap = await this.climateRoleService.getRoleMap(spaceId);
		const primaryDevices: PrimaryClimateDevice[] = [];

		// Sort devices by name for deterministic selection
		const sortedDevices = [...devices].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		for (const device of sortedDevices) {
			// Check if device is a primary climate device
			if (
				!CLIMATE_PRIMARY_DEVICE_CATEGORIES.includes(
					device.category as (typeof CLIMATE_PRIMARY_DEVICE_CATEGORIES)[number],
				)
			) {
				continue;
			}

			// Check role - skip HIDDEN devices
			const role = roleMap.get(device.id)?.role ?? null;
			if (role === ClimateRole.HIDDEN) {
				this.logger.debug(`Skipping HIDDEN climate device deviceId=${device.id}`);
				continue;
			}

			// Extract device capabilities
			const primaryDevice = this.extractPrimaryClimateDevice(device, role);
			if (primaryDevice) {
				primaryDevices.push(primaryDevice);
			}
		}

		return primaryDevices;
	}

	/**
	 * Detect climate mode from device states.
	 * - If any heater is ON and no cooler is ON → HEAT
	 * - If any cooler is ON and no heater is ON → COOL
	 * - If both heater and cooler are ON → AUTO
	 * - If nothing is ON → OFF
	 */
	detectClimateMode(devices: PrimaryClimateDevice[]): ClimateMode {
		let anyHeaterOn = false;
		let anyCoolerOn = false;

		for (const device of devices) {
			// Check heater ON state
			if (device.heaterOnProperty) {
				const heaterOn = this.getPropertyBooleanValue(device.heaterOnProperty);
				if (heaterOn) {
					anyHeaterOn = true;
				}
			}

			// Check cooler ON state
			if (device.coolerOnProperty) {
				const coolerOn = this.getPropertyBooleanValue(device.coolerOnProperty);
				if (coolerOn) {
					anyCoolerOn = true;
				}
			}
		}

		if (anyHeaterOn && anyCoolerOn) {
			return ClimateMode.AUTO;
		}
		if (anyHeaterOn) {
			return ClimateMode.HEAT;
		}
		if (anyCoolerOn) {
			return ClimateMode.COOL;
		}
		return ClimateMode.OFF;
	}

	/**
	 * Detect if setpoints are out of sync (mixed state).
	 * Similar to lighting mixed state detection.
	 */
	private detectMixedState(heatingSetpoints: number[], coolingSetpoints: number[]): boolean {
		// Check heating setpoints variance
		if (heatingSetpoints.length > 1) {
			const min = Math.min(...heatingSetpoints);
			const max = Math.max(...heatingSetpoints);
			if (max - min > 0.5) {
				// More than 0.5 degree difference
				return true;
			}
		}

		// Check cooling setpoints variance
		if (coolingSetpoints.length > 1) {
			const min = Math.min(...coolingSetpoints);
			const max = Math.max(...coolingSetpoints);
			if (max - min > 0.5) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get temperature readings from SENSOR role devices.
	 */
	private async getSensorTemperatures(spaceId: string): Promise<number[]> {
		const temperatures: number[] = [];
		const roleMap = await this.climateRoleService.getRoleMap(spaceId);
		const devices = await this.spacesService.findDevicesBySpace(spaceId);

		for (const device of devices) {
			if (device.category !== DeviceCategory.SENSOR) {
				continue;
			}

			for (const channel of device.channels ?? []) {
				if (channel.category !== ChannelCategory.TEMPERATURE) {
					continue;
				}

				const key = `${device.id}:${channel.id}`;
				const role = roleMap.get(key);

				// Only include sensors with SENSOR role (not HIDDEN)
				if (role?.role === ClimateRole.SENSOR) {
					const tempProp = channel.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE);
					const temp = this.getPropertyNumericValue(tempProp);
					if (temp !== null) {
						temperatures.push(temp);
					}
				}
			}
		}

		return temperatures;
	}

	/**
	 * Extract all climate-related channels and properties from a primary climate device.
	 */
	private extractPrimaryClimateDevice(device: DeviceEntity, role: ClimateRole | null): PrimaryClimateDevice | null {
		const channels = device.channels ?? [];

		// Find temperature channel
		const temperatureChannel = channels.find((ch) => ch.category === ChannelCategory.TEMPERATURE) ?? null;
		const temperatureProperty =
			temperatureChannel?.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE) ?? null;

		// Find humidity channel/property
		const humidityChannel = channels.find((ch) => ch.category === ChannelCategory.HUMIDITY) ?? null;
		let humidityProperty = humidityChannel?.properties?.find((p) => p.category === PropertyCategory.HUMIDITY) ?? null;

		// Humidity might also be on temperature channel
		if (!humidityProperty && temperatureChannel) {
			humidityProperty = temperatureChannel.properties?.find((p) => p.category === PropertyCategory.HUMIDITY) ?? null;
		}

		// Find heater channel
		const heaterChannel = channels.find((ch) => ch.category === ChannelCategory.HEATER) ?? null;
		const heaterOnProperty = heaterChannel?.properties?.find((p) => p.category === PropertyCategory.ON) ?? null;
		const heaterSetpointProperty =
			heaterChannel?.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE) ?? null;
		const heaterMinMax = this.getClimatePropertyMinMax(heaterSetpointProperty);

		// Find cooler channel
		const coolerChannel = channels.find((ch) => ch.category === ChannelCategory.COOLER) ?? null;
		const coolerOnProperty = coolerChannel?.properties?.find((p) => p.category === PropertyCategory.ON) ?? null;
		const coolerSetpointProperty =
			coolerChannel?.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE) ?? null;
		const coolerMinMax = this.getClimatePropertyMinMax(coolerSetpointProperty);

		// Find thermostat channel (for unified control)
		const thermostatChannel = channels.find((ch) => ch.category === ChannelCategory.THERMOSTAT) ?? null;

		// Determine capabilities based on role and channel presence
		let supportsHeating = heaterChannel !== null;
		let supportsCooling = coolerChannel !== null;

		// Apply role constraints
		// null role = AUTO (supports both if channels exist)
		// HEATING_ONLY = only heating
		// COOLING_ONLY = only cooling
		// AUTO = both if channels exist
		if (role === ClimateRole.HEATING_ONLY) {
			supportsCooling = false;
		} else if (role === ClimateRole.COOLING_ONLY) {
			supportsHeating = false;
		}
		// For null (unassigned) and AUTO roles, use channel-based capabilities

		// Skip device if it has no useful climate capabilities
		if (!supportsHeating && !supportsCooling && !temperatureProperty) {
			return null;
		}

		return {
			device,
			deviceCategory: device.category,
			role,
			temperatureChannel,
			temperatureProperty,
			humidityChannel: humidityChannel ?? temperatureChannel,
			humidityProperty,
			heaterChannel,
			heaterOnProperty,
			heaterSetpointProperty,
			heaterMinSetpoint: heaterMinMax.min,
			heaterMaxSetpoint: heaterMinMax.max,
			coolerChannel,
			coolerOnProperty,
			coolerSetpointProperty,
			coolerMinSetpoint: coolerMinMax.min,
			coolerMaxSetpoint: coolerMinMax.max,
			thermostatChannel,
			supportsHeating,
			supportsCooling,
		};
	}

	/**
	 * Get min/max range from a property's format field for climate setpoints.
	 * Handles both array format [min, max] and string formats "min:max" or "min|max".
	 */
	private getClimatePropertyMinMax(property: ChannelPropertyEntity | null | undefined): { min: number; max: number } {
		if (!property?.format) {
			return { min: DEFAULT_MIN_SETPOINT, max: DEFAULT_MAX_SETPOINT };
		}

		// Cast to unknown for runtime type checking (format may be string at runtime despite entity typing)
		const format: unknown = property.format;

		// Handle array format [min, max]
		if (Array.isArray(format) && format.length >= 2) {
			const propMin = typeof format[0] === 'number' ? format[0] : parseFloat(String(format[0]));
			const propMax = typeof format[1] === 'number' ? format[1] : parseFloat(String(format[1]));

			if (!isNaN(propMin) && !isNaN(propMax)) {
				return { min: propMin, max: propMax };
			}
		}

		// Handle string format "min:max" or "min|max" (may occur at runtime despite entity typing)
		if (typeof format === 'string') {
			const parts = format.split(/[:|]/);

			if (parts.length >= 2) {
				const propMin = parseFloat(parts[0]);
				const propMax = parseFloat(parts[1]);

				if (!isNaN(propMin) && !isNaN(propMax)) {
					return { min: propMin, max: propMax };
				}
			}
		}

		return { min: DEFAULT_MIN_SETPOINT, max: DEFAULT_MAX_SETPOINT };
	}
}
