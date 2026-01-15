import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import {
	CLIMATE_PRIMARY_DEVICE_CATEGORIES,
	ClimateIntentType,
	ClimateMode,
	ClimateRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	EventType,
	SETPOINT_DELTA_STEPS,
	SPACES_MODULE_NAME,
	TEMPERATURE_AVERAGING_STRATEGY,
	TemperatureAveragingStrategy,
} from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { IntentExecutionResult, SpaceIntentBaseService } from './space-intent-base.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
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
	thermostatActiveProperty: ChannelPropertyEntity | null;
	thermostatModeProperty: ChannelPropertyEntity | null;
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
 * Result of a climate intent execution.
 */
export interface ClimateIntentResult extends IntentExecutionResult {
	mode: ClimateMode;
	newSetpoint: number | null;
	heatingSetpoint: number | null;
	coolingSetpoint: number | null;
}

/**
 * Service handling all climate-related intent operations.
 * Manages multi-device climate control, mode switching, and setpoint adjustments.
 */
@Injectable()
export class ClimateIntentService extends SpaceIntentBaseService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'ClimateIntentService');

	constructor(
		private readonly spacesService: SpacesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly climateRoleService: SpaceClimateRoleService,
		@Inject(forwardRef(() => SpaceContextSnapshotService))
		private readonly contextSnapshotService: SpaceContextSnapshotService,
		@Inject(forwardRef(() => SpaceUndoHistoryService))
		private readonly undoHistoryService: SpaceUndoHistoryService,
		@Inject(forwardRef(() => IntentTimeseriesService))
		private readonly intentTimeseriesService: IntentTimeseriesService,
		private readonly eventEmitter: EventEmitter2,
	) {
		super();
	}

	/**
	 * Get the current climate state for a space using multi-device climate roles.
	 * Aggregates temperature/humidity from all primary devices, detects mode from device states,
	 * and calculates intersection of setpoint ranges.
	 */
	async getClimateState(spaceId: string): Promise<ClimateState> {
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

			return defaultState;
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
		const mode = this.detectClimateMode(primaryDevices);

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

		// Set targetTemperature based on mode
		if (mode === ClimateMode.HEAT && heatingSetpoint !== null) {
			targetTemperature = heatingSetpoint;
		} else if (mode === ClimateMode.COOL && coolingSetpoint !== null) {
			targetTemperature = coolingSetpoint;
		} else if (mode === ClimateMode.AUTO) {
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

		// Get last applied mode from InfluxDB
		const lastApplied = await this.intentTimeseriesService.getLastClimateMode(spaceId);
		const lastAppliedMode = lastApplied?.mode
			? Object.values(ClimateMode).includes(lastApplied.mode as ClimateMode)
				? (lastApplied.mode as ClimateMode)
				: null
			: null;

		return {
			hasClimate: true,
			mode,
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
	 * Execute a climate intent for the space.
	 * Supports multi-device control based on mode and roles.
	 */
	async executeClimateIntent(spaceId: string, intent: ClimateIntentDto): Promise<ClimateIntentResult> {
		const defaultResult: ClimateIntentResult = {
			success: false,
			affectedDevices: 0,
			failedDevices: 0,
			mode: ClimateMode.OFF,
			newSetpoint: null,
			heatingSetpoint: null,
			coolingSetpoint: null,
		};

		// Verify space exists
		const space = await this.spacesService.findOne(spaceId);

		if (!space) {
			this.logger.warn(`Space not found id=${spaceId}`);

			return defaultResult;
		}

		// Get current climate state
		const climateState = await this.getClimateState(spaceId);

		if (!climateState.hasClimate) {
			this.logger.debug(`No climate devices in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		// Get primary devices
		const primaryDevices = await this.getPrimaryClimateDevicesInSpace(spaceId);

		if (primaryDevices.length === 0) {
			this.logger.debug(`No controllable climate devices in space id=${spaceId}`);

			return { ...defaultResult, success: true };
		}

		// Capture snapshot for undo BEFORE executing the climate intent
		await this.captureUndoSnapshot(spaceId, intent);

		// Handle different intent types
		let result: ClimateIntentResult;

		switch (intent.type) {
			case ClimateIntentType.SET_MODE:
				result = await this.executeSetModeIntent(spaceId, primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.SETPOINT_SET:
				result = await this.executeSetpointSetIntent(primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.SETPOINT_DELTA:
				result = await this.executeSetpointDeltaIntent(primaryDevices, intent, climateState);
				break;

			case ClimateIntentType.CLIMATE_SET:
				result = await this.executeClimateSetIntent(spaceId, primaryDevices, intent, climateState);
				break;

			default:
				this.logger.warn(`Unknown climate intent type: ${String(intent.type)}`);
				return defaultResult;
		}

		// Emit state change event for WebSocket clients (fire and forget)
		if (result.success) {
			void this.emitClimateStateChange(spaceId);
		}

		return result;
	}

	/**
	 * Get the primary thermostat device ID for a space (legacy method for undo service).
	 * @deprecated Use getPrimaryClimateDevicesInSpace instead
	 */
	async getPrimaryThermostatId(spaceId: string): Promise<string | null> {
		const primaryDevices = await this.getPrimaryClimateDevicesInSpace(spaceId);

		// Return first device that supports setpoint control
		for (const device of primaryDevices) {
			if (device.heaterSetpointProperty || device.coolerSetpointProperty) {
				return device.device.id;
			}
		}

		return null;
	}

	// =====================
	// Private Methods
	// =====================

	/**
	 * Detect climate mode from device states.
	 * - If any heater is ON and no cooler is ON → HEAT
	 * - If any cooler is ON and no heater is ON → COOL
	 * - If both heater and cooler are ON → AUTO
	 * - If nothing is ON → OFF
	 */
	private detectClimateMode(devices: PrimaryClimateDevice[]): ClimateMode {
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

			// Check thermostat mode property for AUTO detection
			if (device.thermostatModeProperty) {
				const modeValue = device.thermostatModeProperty.value;
				if (typeof modeValue === 'string') {
					const modeLower = modeValue.toLowerCase();
					if (modeLower === 'auto' || modeLower === 'heat_cool') {
						return ClimateMode.AUTO;
					}
					if (modeLower === 'heat') {
						anyHeaterOn = true;
					}
					if (modeLower === 'cool') {
						anyCoolerOn = true;
					}
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
	 * Get all primary climate devices in the space.
	 * Primary devices are: thermostat, heating_unit, air_conditioner
	 * Excludes devices with HIDDEN role.
	 */
	private async getPrimaryClimateDevicesInSpace(spaceId: string): Promise<PrimaryClimateDevice[]> {
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
		const thermostatActiveProperty =
			thermostatChannel?.properties?.find((p) => p.category === PropertyCategory.ACTIVE) ?? null;
		const thermostatModeProperty =
			thermostatChannel?.properties?.find((p) => p.category === PropertyCategory.MODE) ?? null;

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
			thermostatActiveProperty,
			thermostatModeProperty,
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

	/**
	 * Execute SET_MODE intent - change climate mode on all applicable devices.
	 */
	private async executeSetModeIntent(
		spaceId: string,
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		const mode = intent.mode ?? ClimateMode.OFF;
		let affectedDevices = 0;
		let failedDevices = 0;

		for (const device of devices) {
			const success = await this.setDeviceMode(device, mode);
			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		const overallSuccess = failedDevices === 0 || affectedDevices > 0;

		// Store mode change to InfluxDB for historical tracking (fire and forget)
		if (overallSuccess) {
			void this.intentTimeseriesService.storeClimateModeChange(
				spaceId,
				mode,
				devices.length,
				affectedDevices,
				failedDevices,
			);
		}

		return {
			success: overallSuccess,
			affectedDevices,
			failedDevices,
			mode,
			newSetpoint: climateState.targetTemperature,
			heatingSetpoint: climateState.heatingSetpoint,
			coolingSetpoint: climateState.coolingSetpoint,
		};
	}

	/**
	 * Set mode on a single device.
	 */
	private async setDeviceMode(device: PrimaryClimateDevice, mode: ClimateMode): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		switch (mode) {
			case ClimateMode.OFF:
				// Turn off heater
				if (device.heaterOnProperty && device.heaterChannel) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: false,
					});
				}
				// Turn off cooler
				if (device.coolerOnProperty && device.coolerChannel) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: false,
					});
				}
				// Turn off thermostat
				if (device.thermostatActiveProperty && device.thermostatChannel) {
					commands.push({
						device: device.device,
						channel: device.thermostatChannel,
						property: device.thermostatActiveProperty,
						value: false,
					});
				}
				break;

			case ClimateMode.HEAT:
				// Turn on heater, turn off cooler
				if (device.heaterOnProperty && device.heaterChannel && device.supportsHeating) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: true,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: false,
					});
				}
				// Set thermostat mode if available
				if (device.thermostatModeProperty && device.thermostatChannel) {
					commands.push({
						device: device.device,
						channel: device.thermostatChannel,
						property: device.thermostatModeProperty,
						value: 'heat',
					});
				}
				break;

			case ClimateMode.COOL:
				// Turn off heater, turn on cooler
				if (device.heaterOnProperty && device.heaterChannel) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: false,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel && device.supportsCooling) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: true,
					});
				}
				// Set thermostat mode if available
				if (device.thermostatModeProperty && device.thermostatChannel) {
					commands.push({
						device: device.device,
						channel: device.thermostatChannel,
						property: device.thermostatModeProperty,
						value: 'cool',
					});
				}
				break;

			case ClimateMode.AUTO:
				// Turn on both heater and cooler
				if (device.heaterOnProperty && device.heaterChannel && device.supportsHeating) {
					commands.push({
						device: device.device,
						channel: device.heaterChannel,
						property: device.heaterOnProperty,
						value: true,
					});
				}
				if (device.coolerOnProperty && device.coolerChannel && device.supportsCooling) {
					commands.push({
						device: device.device,
						channel: device.coolerChannel,
						property: device.coolerOnProperty,
						value: true,
					});
				}
				// Set thermostat mode if available
				if (device.thermostatModeProperty && device.thermostatChannel) {
					commands.push({
						device: device.device,
						channel: device.thermostatChannel,
						property: device.thermostatModeProperty,
						value: 'auto',
					});
				}
				break;
		}

		if (commands.length === 0) {
			this.logger.debug(`No mode commands for device id=${device.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);
			if (!success) {
				this.logger.error(`Mode command execution failed for device id=${device.device.id}`);
				return false;
			}
			return true;
		} catch (error) {
			this.logger.error(`Error executing mode command for device id=${device.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Execute SETPOINT_SET intent - set temperature on all applicable devices.
	 */
	private async executeSetpointSetIntent(
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		const mode = climateState.mode;
		let affectedDevices = 0;
		let failedDevices = 0;

		// Determine setpoints based on intent and mode
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
			// AUTO mode with explicit setpoints for both
			heatingSetpoint = this.clampSetpoint(intent.heatingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
			coolingSetpoint = this.clampSetpoint(intent.coolingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		} else if (intent.heatingSetpoint !== undefined) {
			// Only heating setpoint provided - apply to heating devices
			heatingSetpoint = this.clampSetpoint(intent.heatingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		} else if (intent.coolingSetpoint !== undefined) {
			// Only cooling setpoint provided - apply to cooling devices
			coolingSetpoint = this.clampSetpoint(intent.coolingSetpoint, climateState.minSetpoint, climateState.maxSetpoint);
		} else if (intent.value !== undefined) {
			// Single value - apply based on mode
			const value = this.clampSetpoint(intent.value, climateState.minSetpoint, climateState.maxSetpoint);
			if (mode === ClimateMode.HEAT || mode === ClimateMode.OFF) {
				heatingSetpoint = value;
			}
			if (mode === ClimateMode.COOL || mode === ClimateMode.OFF) {
				coolingSetpoint = value;
			}
			if (mode === ClimateMode.AUTO) {
				// In AUTO mode with single value, set both (this synchronizes devices)
				heatingSetpoint = value;
				coolingSetpoint = value;
			}
		}

		// Apply setpoints to devices based on their roles and capabilities
		for (const device of devices) {
			const role = device.role ?? ClimateRole.AUTO; // null = AUTO

			// Determine if this device should receive heating setpoint
			const shouldSetHeating =
				heatingSetpoint !== null &&
				device.supportsHeating &&
				(role === ClimateRole.AUTO || role === ClimateRole.HEATING_ONLY || role === null);

			// Determine if this device should receive cooling setpoint
			const shouldSetCooling =
				coolingSetpoint !== null &&
				device.supportsCooling &&
				(role === ClimateRole.AUTO || role === ClimateRole.COOLING_ONLY || role === null);

			if (!shouldSetHeating && !shouldSetCooling) {
				continue;
			}

			const success = await this.setDeviceSetpoints(
				device,
				shouldSetHeating ? heatingSetpoint : null,
				shouldSetCooling ? coolingSetpoint : null,
			);

			if (success) {
				affectedDevices++;
			} else {
				failedDevices++;
			}
		}

		// Determine the "primary" setpoint for the response
		const newSetpoint =
			mode === ClimateMode.HEAT ? heatingSetpoint : mode === ClimateMode.COOL ? coolingSetpoint : heatingSetpoint;

		return {
			success: failedDevices === 0 || affectedDevices > 0,
			affectedDevices,
			failedDevices,
			mode,
			newSetpoint,
			heatingSetpoint,
			coolingSetpoint,
		};
	}

	/**
	 * Execute SETPOINT_DELTA intent - adjust temperature on all applicable devices.
	 */
	private async executeSetpointDeltaIntent(
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		if (intent.delta === undefined || intent.increase === undefined) {
			this.logger.warn('SETPOINT_DELTA intent requires delta and increase parameters');
			return {
				success: false,
				affectedDevices: 0,
				failedDevices: 0,
				mode: climateState.mode,
				newSetpoint: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
			};
		}

		const deltaValue = SETPOINT_DELTA_STEPS[intent.delta];

		// Validate delta lookup to prevent NaN from propagating
		if (deltaValue === undefined) {
			this.logger.error(`Invalid setpoint delta value: ${intent.delta}`);
			return {
				success: false,
				affectedDevices: 0,
				failedDevices: 0,
				mode: climateState.mode,
				newSetpoint: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
			};
		}

		// Calculate new setpoints based on current values
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		if (climateState.heatingSetpoint !== null) {
			const newValue = intent.increase
				? climateState.heatingSetpoint + deltaValue
				: climateState.heatingSetpoint - deltaValue;
			heatingSetpoint = this.clampSetpoint(newValue, climateState.minSetpoint, climateState.maxSetpoint);
		}

		if (climateState.coolingSetpoint !== null) {
			const newValue = intent.increase
				? climateState.coolingSetpoint + deltaValue
				: climateState.coolingSetpoint - deltaValue;
			coolingSetpoint = this.clampSetpoint(newValue, climateState.minSetpoint, climateState.maxSetpoint);
		}

		// Use the same logic as SETPOINT_SET
		const setIntent: ClimateIntentDto = {
			type: ClimateIntentType.SETPOINT_SET,
			heatingSetpoint: heatingSetpoint ?? undefined,
			coolingSetpoint: coolingSetpoint ?? undefined,
		};

		// If we only have one setpoint, use value instead
		if (heatingSetpoint !== null && coolingSetpoint === null) {
			setIntent.value = heatingSetpoint;
			delete setIntent.heatingSetpoint;
			delete setIntent.coolingSetpoint;
		} else if (coolingSetpoint !== null && heatingSetpoint === null) {
			setIntent.value = coolingSetpoint;
			delete setIntent.heatingSetpoint;
			delete setIntent.coolingSetpoint;
		}

		return this.executeSetpointSetIntent(devices, setIntent, climateState);
	}

	/**
	 * Set setpoints on a single device.
	 */
	private async setDeviceSetpoints(
		device: PrimaryClimateDevice,
		heatingSetpoint: number | null,
		coolingSetpoint: number | null,
	): Promise<boolean> {
		const platform = this.platformRegistryService.get(device.device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.device.id}`);
			return false;
		}

		const commands: IDevicePropertyData[] = [];

		// Set heating setpoint
		if (heatingSetpoint !== null && device.heaterSetpointProperty && device.heaterChannel) {
			const clampedValue = this.clampSetpoint(heatingSetpoint, device.heaterMinSetpoint, device.heaterMaxSetpoint);
			commands.push({
				device: device.device,
				channel: device.heaterChannel,
				property: device.heaterSetpointProperty,
				value: clampedValue,
			});
		}

		// Set cooling setpoint
		if (coolingSetpoint !== null && device.coolerSetpointProperty && device.coolerChannel) {
			const clampedValue = this.clampSetpoint(coolingSetpoint, device.coolerMinSetpoint, device.coolerMaxSetpoint);
			commands.push({
				device: device.device,
				channel: device.coolerChannel,
				property: device.coolerSetpointProperty,
				value: clampedValue,
			});
		}

		if (commands.length === 0) {
			this.logger.debug(`No setpoint commands for device id=${device.device.id}`);
			return true;
		}

		try {
			const success = await platform.processBatch(commands);
			if (!success) {
				this.logger.error(`Setpoint command execution failed for device id=${device.device.id}`);
				return false;
			}

			this.logger.debug(
				`Set setpoints on device id=${device.device.id} heating=${heatingSetpoint} cooling=${coolingSetpoint}`,
			);
			return true;
		} catch (error) {
			this.logger.error(`Error executing setpoint command for device id=${device.device.id}: ${error}`);
			return false;
		}
	}

	/**
	 * Clamp and round setpoint value.
	 */
	private clampSetpoint(value: number, min: number, max: number): number {
		// Clamp to min/max
		let clamped = Math.max(min, Math.min(max, value));
		// Round to 0.5 degree precision
		clamped = Math.round(clamped * 2) / 2;
		// Re-clamp after rounding
		return Math.max(min, Math.min(max, clamped));
	}

	/**
	 * Execute CLIMATE_SET intent - set mode and/or setpoints in a single atomic operation.
	 * This allows setting multiple climate properties at once (e.g., mode + setpoint).
	 */
	private async executeClimateSetIntent(
		spaceId: string,
		devices: PrimaryClimateDevice[],
		intent: ClimateIntentDto,
		climateState: ClimateState,
	): Promise<ClimateIntentResult> {
		// Track mode and setpoint changes separately
		let modeAffected = 0;
		let modeFailed = 0;
		let setpointAffected = 0;
		let setpointFailed = 0;
		const mode = intent.mode ?? climateState.mode;
		let heatingSetpoint: number | null = null;
		let coolingSetpoint: number | null = null;

		// Step 1: Set mode if provided
		if (intent.mode !== undefined) {
			for (const device of devices) {
				const success = await this.setDeviceMode(device, intent.mode);
				if (success) {
					modeAffected++;
				} else {
					modeFailed++;
				}
			}

			// Store mode change to InfluxDB
			if (modeAffected > 0) {
				void this.intentTimeseriesService.storeClimateModeChange(
					spaceId,
					intent.mode,
					devices.length,
					modeAffected,
					modeFailed,
				);
			}
		}

		// Step 2: Set setpoints if provided
		const hasSetpoints =
			intent.value !== undefined || intent.heatingSetpoint !== undefined || intent.coolingSetpoint !== undefined;

		if (hasSetpoints) {
			// Determine setpoints based on intent and mode
			if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
				// Explicit dual setpoints for AUTO mode
				heatingSetpoint = this.clampSetpoint(
					intent.heatingSetpoint,
					climateState.minSetpoint,
					climateState.maxSetpoint,
				);
				coolingSetpoint = this.clampSetpoint(
					intent.coolingSetpoint,
					climateState.minSetpoint,
					climateState.maxSetpoint,
				);
			} else if (intent.value !== undefined) {
				// Single value - apply based on mode
				const value = this.clampSetpoint(intent.value, climateState.minSetpoint, climateState.maxSetpoint);
				if (mode === ClimateMode.HEAT || mode === ClimateMode.OFF) {
					heatingSetpoint = value;
				}
				if (mode === ClimateMode.COOL || mode === ClimateMode.OFF) {
					coolingSetpoint = value;
				}
				if (mode === ClimateMode.AUTO) {
					heatingSetpoint = value;
					coolingSetpoint = value;
				}
			} else {
				// Only one of heating/cooling setpoint provided
				if (intent.heatingSetpoint !== undefined) {
					heatingSetpoint = this.clampSetpoint(
						intent.heatingSetpoint,
						climateState.minSetpoint,
						climateState.maxSetpoint,
					);
				}
				if (intent.coolingSetpoint !== undefined) {
					coolingSetpoint = this.clampSetpoint(
						intent.coolingSetpoint,
						climateState.minSetpoint,
						climateState.maxSetpoint,
					);
				}
			}

			// Apply setpoints to devices based on their roles and capabilities
			for (const device of devices) {
				const role = device.role ?? ClimateRole.AUTO;

				const shouldSetHeating =
					heatingSetpoint !== null &&
					device.supportsHeating &&
					(role === ClimateRole.AUTO || role === ClimateRole.HEATING_ONLY || role === null);

				const shouldSetCooling =
					coolingSetpoint !== null &&
					device.supportsCooling &&
					(role === ClimateRole.AUTO || role === ClimateRole.COOLING_ONLY || role === null);

				if (!shouldSetHeating && !shouldSetCooling) {
					continue;
				}

				const success = await this.setDeviceSetpoints(
					device,
					shouldSetHeating ? heatingSetpoint : null,
					shouldSetCooling ? coolingSetpoint : null,
				);

				if (success) {
					setpointAffected++;
				} else {
					setpointFailed++;
				}
			}
		}

		// Combine mode and setpoint counts for the response
		// This ensures the response accurately reflects all changes made
		const totalAffected = modeAffected + setpointAffected;
		const totalFailed = modeFailed + setpointFailed;

		// Determine the "primary" setpoint for the response
		const newSetpoint =
			mode === ClimateMode.HEAT ? heatingSetpoint : mode === ClimateMode.COOL ? coolingSetpoint : heatingSetpoint;

		return {
			success: totalFailed === 0 || totalAffected > 0,
			affectedDevices: totalAffected,
			failedDevices: totalFailed,
			mode,
			newSetpoint,
			heatingSetpoint,
			coolingSetpoint,
		};
	}

	/**
	 * Capture a snapshot for undo before executing a climate intent.
	 */
	private async captureUndoSnapshot(spaceId: string, intent: ClimateIntentDto): Promise<void> {
		try {
			const snapshot = await this.contextSnapshotService.captureSnapshot(spaceId);

			if (!snapshot) {
				this.logger.debug(`Could not capture snapshot for undo spaceId=${spaceId}`);

				return;
			}

			const actionDescription = this.buildIntentDescription(intent);

			this.undoHistoryService.pushSnapshot(snapshot, actionDescription, 'climate');

			this.logger.debug(`Undo snapshot captured spaceId=${spaceId} action="${actionDescription}"`);
		} catch (error) {
			this.logger.error(`Error capturing undo snapshot spaceId=${spaceId}: ${error}`);
		}
	}

	/**
	 * Build a human-readable description of a climate intent.
	 */
	private buildIntentDescription(intent: ClimateIntentDto): string {
		switch (intent.type) {
			case ClimateIntentType.SET_MODE:
				return `Set climate mode to ${intent.mode ?? 'unknown'}`;
			case ClimateIntentType.SETPOINT_DELTA:
				return intent.increase ? 'Increase temperature' : 'Decrease temperature';
			case ClimateIntentType.SETPOINT_SET:
				if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
					return `Set temperature range ${intent.heatingSetpoint}°C - ${intent.coolingSetpoint}°C`;
				}
				return `Set temperature to ${intent.value ?? 'unknown'}°C`;
			case ClimateIntentType.CLIMATE_SET: {
				const parts: string[] = [];
				if (intent.mode !== undefined) {
					parts.push(`mode to ${intent.mode}`);
				}
				if (intent.value !== undefined) {
					parts.push(`temperature to ${intent.value}°C`);
				} else if (intent.heatingSetpoint !== undefined || intent.coolingSetpoint !== undefined) {
					if (intent.heatingSetpoint !== undefined && intent.coolingSetpoint !== undefined) {
						parts.push(`range ${intent.heatingSetpoint}°C - ${intent.coolingSetpoint}°C`);
					} else if (intent.heatingSetpoint !== undefined) {
						parts.push(`heating to ${intent.heatingSetpoint}°C`);
					} else if (intent.coolingSetpoint !== undefined) {
						parts.push(`cooling to ${intent.coolingSetpoint}°C`);
					}
				}
				return parts.length > 0 ? `Set climate ${parts.join(', ')}` : 'Set climate properties';
			}
			default:
				return 'Climate intent';
		}
	}

	/**
	 * Emit climate state change event for WebSocket clients.
	 * Fetches the latest climate state and emits it via the event emitter.
	 */
	private async emitClimateStateChange(spaceId: string): Promise<void> {
		try {
			const state = await this.getClimateState(spaceId);

			if (state.hasClimate) {
				this.eventEmitter.emit(EventType.CLIMATE_STATE_CHANGED, {
					space_id: spaceId,
					state,
				});

				this.logger.debug(`Emitted climate state change event spaceId=${spaceId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to emit climate state change event spaceId=${spaceId}: ${error}`);
		}
	}
}
