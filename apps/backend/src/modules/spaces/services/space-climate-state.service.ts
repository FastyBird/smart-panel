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
	heaterStatusProperty: ChannelPropertyEntity | null; // RO - is heater actively working
	heaterSetpointProperty: ChannelPropertyEntity | null;
	heaterMinSetpoint: number;
	heaterMaxSetpoint: number;
	// Cooler control
	coolerChannel: ChannelEntity | null;
	coolerOnProperty: ChannelPropertyEntity | null;
	coolerStatusProperty: ChannelPropertyEntity | null; // RO - is cooler actively working
	coolerSetpointProperty: ChannelPropertyEntity | null;
	coolerMinSetpoint: number;
	coolerMaxSetpoint: number;
	// Thermostat channel (for child lock only)
	thermostatChannel: ChannelEntity | null;
	thermostatLockedProperty: ChannelPropertyEntity | null;
	// Capabilities (respecting device role)
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
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
	minSetpoint: number;
	maxSetpoint: number;
	supportsHeating: boolean;
	supportsCooling: boolean;
	// Actual device activity status (heater.on + heater.status = actively working)
	isHeating: boolean;
	isCooling: boolean;
	// Mixed state: devices have different setpoints or modes
	isMixed: boolean;
	devicesCount: number;
	// Last applied values from InfluxDB storage
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

		// Detect current mode and activity status from device states
		const { mode: detectedMode, isHeating, isCooling } = this.detectClimateModeAndActivity(primaryDevices);

		// Get last applied climate state from InfluxDB (user's intent, includes mode and setpoints)
		const lastApplied = await this.intentTimeseriesService.getLastClimateState(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(ClimateMode).includes(lastApplied.mode as ClimateMode)
				? (lastApplied.mode as ClimateMode)
				: null
			: null;

		// Calculate setpoints using priority: InfluxDB > device consensus > null
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		// Try InfluxDB values first
		if (lastApplied?.heatingSetpoint !== null && lastApplied?.heatingSetpoint !== undefined) {
			heatingSetpoint = lastApplied.heatingSetpoint;
		} else if (heatingSetpoints.length > 0) {
			// Check if all devices have same value (consensus)
			heatingSetpoint = this.getConsensusValue(heatingSetpoints);
		}

		if (lastApplied?.coolingSetpoint !== null && lastApplied?.coolingSetpoint !== undefined) {
			coolingSetpoint = lastApplied.coolingSetpoint;
		} else if (coolingSetpoints.length > 0) {
			// Check if all devices have same value (consensus)
			coolingSetpoint = this.getConsensusValue(coolingSetpoints);
		}

		// Detect mixed state (setpoints or modes out of sync)
		const isMixed = this.detectMixedState(heatingSetpoint, heatingSetpoints, coolingSetpoint, coolingSetpoints);

		return {
			hasClimate: true,
			mode: detectedMode,
			currentTemperature: currentTemperature !== null ? Math.round(currentTemperature * 10) / 10 : null,
			currentHumidity: currentHumidity !== null ? Math.round(currentHumidity) : null,
			heatingSetpoint: heatingSetpoint !== null ? Math.round(heatingSetpoint * 2) / 2 : null,
			coolingSetpoint: coolingSetpoint !== null ? Math.round(coolingSetpoint * 2) / 2 : null,
			minSetpoint,
			maxSetpoint,
			supportsHeating,
			supportsCooling,
			isHeating,
			isCooling,
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
	 * Detect climate mode and activity status from device states.
	 *
	 * Unified detection logic for all device types (AIR_CONDITIONER, HEATING_UNIT, THERMOSTAT):
	 * - isHeating: heater.on = true AND heater.status = true (device is actively heating)
	 * - isCooling: cooler.on = true AND cooler.status = true (device is actively cooling)
	 *
	 * Mode detection:
	 * - If any device is heating AND cooling → AUTO
	 * - If any device is only heating → HEAT
	 * - If any device is only cooling → COOL
	 * - If nothing is active → OFF
	 *
	 * Device roles are already applied in supportsHeating/supportsCooling.
	 */
	detectClimateModeAndActivity(devices: PrimaryClimateDevice[]): {
		mode: ClimateMode;
		isHeating: boolean;
		isCooling: boolean;
	} {
		let isHeating = false;
		let isCooling = false;

		// Track if any device has heater/cooler ON (even if not actively working)
		let anyHeaterOn = false;
		let anyCoolerOn = false;

		for (const device of devices) {
			// Check heater state (respecting role via supportsHeating)
			if (device.supportsHeating && device.heaterOnProperty) {
				const heaterOn = this.getPropertyBooleanValue(device.heaterOnProperty);
				if (heaterOn) {
					anyHeaterOn = true;
					// Check if heater is actively working (status = true)
					const heaterStatus = device.heaterStatusProperty
						? this.getPropertyBooleanValue(device.heaterStatusProperty)
						: true; // If no status property, assume active when on
					if (heaterStatus) {
						isHeating = true;
					}
				}
			}

			// Check cooler state (respecting role via supportsCooling)
			if (device.supportsCooling && device.coolerOnProperty) {
				const coolerOn = this.getPropertyBooleanValue(device.coolerOnProperty);
				if (coolerOn) {
					anyCoolerOn = true;
					// Check if cooler is actively working (status = true)
					const coolerStatus = device.coolerStatusProperty
						? this.getPropertyBooleanValue(device.coolerStatusProperty)
						: true; // If no status property, assume active when on
					if (coolerStatus) {
						isCooling = true;
					}
				}
			}
		}

		// Determine mode from device ON states (not just active status)
		// This shows the intended mode, not just what's currently running
		let mode: ClimateMode;
		if (anyHeaterOn && anyCoolerOn) {
			// Both heater and cooler are commanded on → AUTO mode
			mode = ClimateMode.AUTO;
		} else if (anyHeaterOn) {
			mode = ClimateMode.HEAT;
		} else if (anyCoolerOn) {
			mode = ClimateMode.COOL;
		} else {
			mode = ClimateMode.OFF;
		}

		return { mode, isHeating, isCooling };
	}

	/**
	 * Get consensus value from an array of numbers.
	 * Returns the value if all values are within 0.5°C tolerance, otherwise null.
	 */
	private getConsensusValue(values: number[]): number | null {
		if (values.length === 0) {
			return null;
		}
		if (values.length === 1) {
			return values[0];
		}

		const min = Math.min(...values);
		const max = Math.max(...values);

		// All values must be within 0.5°C tolerance
		if (max - min <= 0.5) {
			// Return the first value (or could use average, but first is simpler)
			return values[0];
		}

		// No consensus - devices have different values
		return null;
	}

	/**
	 * Detect if devices are out of sync (mixed state).
	 *
	 * isMixed = true when:
	 * 1. setpoint has value AND any device differs by >0.5°C
	 * 2. setpoint is null because devices have different values (no consensus)
	 */
	private detectMixedState(
		heatingSetpoint: number | null,
		heatingDeviceValues: number[],
		coolingSetpoint: number | null,
		coolingDeviceValues: number[],
	): boolean {
		// Check heating setpoints
		if (heatingDeviceValues.length > 0) {
			if (heatingSetpoint !== null) {
				// Check if any device differs from the setpoint
				for (const value of heatingDeviceValues) {
					if (Math.abs(value - heatingSetpoint) > 0.5) {
						return true;
					}
				}
			} else {
				// No setpoint means no consensus (devices have different values)
				if (heatingDeviceValues.length > 1) {
					const min = Math.min(...heatingDeviceValues);
					const max = Math.max(...heatingDeviceValues);
					if (max - min > 0.5) {
						return true;
					}
				}
			}
		}

		// Check cooling setpoints
		if (coolingDeviceValues.length > 0) {
			if (coolingSetpoint !== null) {
				// Check if any device differs from the setpoint
				for (const value of coolingDeviceValues) {
					if (Math.abs(value - coolingSetpoint) > 0.5) {
						return true;
					}
				}
			} else {
				// No setpoint means no consensus (devices have different values)
				if (coolingDeviceValues.length > 1) {
					const min = Math.min(...coolingDeviceValues);
					const max = Math.max(...coolingDeviceValues);
					if (max - min > 0.5) {
						return true;
					}
				}
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
		const heaterStatusProperty =
			heaterChannel?.properties?.find((p) => p.category === PropertyCategory.STATUS) ?? null;
		const heaterSetpointProperty =
			heaterChannel?.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE) ?? null;
		const heaterMinMax = this.getClimatePropertyMinMax(heaterSetpointProperty);

		// Find cooler channel
		const coolerChannel = channels.find((ch) => ch.category === ChannelCategory.COOLER) ?? null;
		const coolerOnProperty = coolerChannel?.properties?.find((p) => p.category === PropertyCategory.ON) ?? null;
		const coolerStatusProperty =
			coolerChannel?.properties?.find((p) => p.category === PropertyCategory.STATUS) ?? null;
		const coolerSetpointProperty =
			coolerChannel?.properties?.find((p) => p.category === PropertyCategory.TEMPERATURE) ?? null;
		const coolerMinMax = this.getClimatePropertyMinMax(coolerSetpointProperty);

		// Find thermostat channel (for child lock only)
		const thermostatChannel = channels.find((ch) => ch.category === ChannelCategory.THERMOSTAT) ?? null;
		const thermostatLockedProperty =
			thermostatChannel?.properties?.find((p) => p.category === PropertyCategory.LOCKED) ?? null;

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
			heaterStatusProperty,
			heaterSetpointProperty,
			heaterMinSetpoint: heaterMinMax.min,
			heaterMaxSetpoint: heaterMinMax.max,
			coolerChannel,
			coolerOnProperty,
			coolerStatusProperty,
			coolerSetpointProperty,
			coolerMinSetpoint: coolerMinMax.min,
			coolerMaxSetpoint: coolerMinMax.max,
			thermostatChannel,
			thermostatLockedProperty,
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
