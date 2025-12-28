/*
eslint-disable @typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: Type assertions are needed to narrow Z2mExpose union type to
specific expose types since TypeScript cannot narrow discriminated unions.
*/
import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ActionConverter,
	BatterySensorConverter,
	ClimateConverter,
	ContactSensorConverter,
	ConversionContext,
	ConverterRegistry,
	CoverConverter,
	ElectricalConverter,
	FanConverter,
	HumiditySensorConverter,
	IlluminanceSensorConverter,
	LeakSensorConverter,
	LightConverter,
	LockConverter,
	MotionSensorConverter,
	OccupancySensorConverter,
	PressureSensorConverter,
	SmokeSensorConverter,
	SwitchConverter,
	TemperatureSensorConverter,
} from '../converters';
import {
	COMMON_PROPERTY_MAPPINGS,
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	Z2M_ACCESS,
	Z2M_GENERIC_TYPES,
	Z2M_SPECIFIC_TYPES,
	mapZ2mAccessToPermissions,
	mapZ2mExposeToChannelCategory,
	mapZ2mTypeToDataType,
} from '../devices-zigbee2mqtt.constants';
import {
	Z2mExpose,
	Z2mExposeBinary,
	Z2mExposeComposite,
	Z2mExposeEnum,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
} from '../interfaces/zigbee2mqtt.interface';

/**
 * Mapped channel structure
 */
export interface MappedChannel {
	identifier: string;
	name: string;
	category: ChannelCategory;
	endpoint?: string;
	properties: MappedProperty[];
}

/**
 * Mapped property structure
 */
export interface MappedProperty {
	identifier: string;
	name: string;
	category: PropertyCategory;
	channelCategory: ChannelCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	z2mProperty: string;
	unit?: string;
	format?: string[] | number[];
	min?: number;
	max?: number;
	step?: number;
}

/**
 * Exposes Mapper Service
 *
 * Maps Zigbee2MQTT exposes structure to Smart Panel channels and properties.
 *
 * This service now uses a modular converter architecture inspired by homebridge-z2m.
 * Each device type has its own dedicated converter for specialized handling.
 *
 * Set useConverterRegistry=true to use the new converter architecture.
 * The legacy mapping logic is preserved for backward compatibility.
 */
@Injectable()
export class Z2mExposesMapperService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ExposesMapper',
	);

	private readonly converterRegistry: ConverterRegistry;

	/**
	 * Feature flag to switch between legacy and new converter architecture.
	 * Set to true to use the new modular converters.
	 */
	private readonly useConverterRegistry = true;

	constructor() {
		this.converterRegistry = new ConverterRegistry();
	}

	/**
	 * Initialize and register all converters
	 */
	onModuleInit(): void {
		if (this.useConverterRegistry) {
			this.registerConverters();
		}
	}

	/**
	 * Register all available converters with the registry
	 */
	private registerConverters(): void {
		// Device converters (highest priority)
		this.converterRegistry.register(new LightConverter());
		this.converterRegistry.register(new SwitchConverter());
		this.converterRegistry.register(new CoverConverter());
		this.converterRegistry.register(new ClimateConverter());
		this.converterRegistry.register(new LockConverter());
		this.converterRegistry.register(new FanConverter());

		// Sensor converters
		this.converterRegistry.register(new TemperatureSensorConverter());
		this.converterRegistry.register(new HumiditySensorConverter());
		this.converterRegistry.register(new OccupancySensorConverter());
		this.converterRegistry.register(new ContactSensorConverter());
		this.converterRegistry.register(new LeakSensorConverter());
		this.converterRegistry.register(new SmokeSensorConverter());
		this.converterRegistry.register(new IlluminanceSensorConverter());
		this.converterRegistry.register(new PressureSensorConverter());
		this.converterRegistry.register(new MotionSensorConverter());
		this.converterRegistry.register(new BatterySensorConverter());

		// Special converters
		this.converterRegistry.register(new ActionConverter());
		this.converterRegistry.register(new ElectricalConverter());

		this.converterRegistry.markInitialized();
		this.logger.log('Converter registry initialized with modular converters');
	}

	/**
	 * Map Z2M exposes to channels and properties
	 *
	 * @param exposes - Array of Z2M exposes to convert
	 * @param deviceInfo - Optional device info for context
	 */
	mapExposes(exposes: Z2mExpose[], deviceInfo?: { ieeeAddress?: string; friendlyName?: string }): MappedChannel[] {
		// Use new converter architecture if enabled
		if (this.useConverterRegistry && this.converterRegistry.isInitialized()) {
			return this.mapExposesWithRegistry(exposes, deviceInfo);
		}

		// Fallback to legacy mapping
		return this.mapExposesLegacy(exposes);
	}

	/**
	 * Map exposes using the new converter registry
	 */
	private mapExposesWithRegistry(
		exposes: Z2mExpose[],
		deviceInfo?: { ieeeAddress?: string; friendlyName?: string },
	): MappedChannel[] {
		const context: ConversionContext = {
			ieeeAddress: deviceInfo?.ieeeAddress ?? '',
			friendlyName: deviceInfo?.friendlyName ?? '',
			allExposes: exposes,
			mappedProperties: new Set<string>(),
		};

		// First, handle specific exposes (light, switch, etc.) which have features
		const specificExposes = exposes.filter((e) =>
			Z2M_SPECIFIC_TYPES.includes(e.type as (typeof Z2M_SPECIFIC_TYPES)[number]),
		);

		// Then, handle generic exposes (binary, numeric, etc.)
		const genericExposes = exposes.filter((e) =>
			Z2M_GENERIC_TYPES.includes(e.type as (typeof Z2M_GENERIC_TYPES)[number]),
		);

		// Convert specific exposes first (they have higher priority)
		const channels = this.converterRegistry.convertAll(specificExposes, context);

		// Then convert generic exposes, which will merge into existing channels or create new ones
		const genericChannels = this.converterRegistry.convertAll(genericExposes, context);

		// Merge generic channels with specific channels
		for (const channel of genericChannels) {
			const existingChannel = channels.find((c) => c.identifier === channel.identifier);
			if (existingChannel) {
				// Add new properties to existing channel
				for (const prop of channel.properties) {
					if (!existingChannel.properties.some((p) => p.identifier === prop.identifier)) {
						existingChannel.properties.push(prop);
					}
				}
			} else {
				channels.push(channel);
			}
		}

		return channels;
	}

	/**
	 * Legacy mapping logic (preserved for backward compatibility)
	 */
	private mapExposesLegacy(exposes: Z2mExpose[]): MappedChannel[] {
		const channels: MappedChannel[] = [];

		for (const expose of exposes) {
			const mappedChannels = this.mapExpose(expose);
			channels.push(...mappedChannels);
		}

		return channels;
	}

	/**
	 * Map a single expose to one or more channels (legacy)
	 */
	private mapExpose(expose: Z2mExpose): MappedChannel[] {
		const type = expose.type;

		// Handle specific types (light, switch, climate, etc.)
		if (Z2M_SPECIFIC_TYPES.includes(type as (typeof Z2M_SPECIFIC_TYPES)[number])) {
			return this.mapSpecificExpose(expose as Z2mExposeSpecific);
		}

		// Handle generic types (binary, numeric, enum, etc.)
		if (Z2M_GENERIC_TYPES.includes(type as (typeof Z2M_GENERIC_TYPES)[number])) {
			return this.mapGenericExpose(expose);
		}

		this.logger.debug(`Unknown expose type: ${type}`);
		return [];
	}

	/**
	 * Map specific expose types (light, switch, climate, etc.)
	 */
	private mapSpecificExpose(expose: Z2mExposeSpecific): MappedChannel[] {
		const category = mapZ2mExposeToChannelCategory(expose.type);
		const endpoint = expose.endpoint;
		const identifier = endpoint ? `${expose.type}_${endpoint}` : expose.type;

		const properties: MappedProperty[] = [];

		// Map features to properties
		for (const feature of expose.features || []) {
			// Handle color composite exposes - expand to hue/saturation properties
			if (feature.type === 'composite') {
				const colorProperties = this.mapColorCompositeToProperties(feature as Z2mExposeComposite);
				properties.push(...colorProperties);
				continue;
			}

			const mappedProperty = this.mapFeatureToProperty(feature);
			if (mappedProperty) {
				properties.push(mappedProperty);
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			{
				identifier,
				name: this.formatChannelName(expose.type, endpoint),
				category,
				endpoint: endpoint ?? undefined,
				properties,
			},
		];
	}

	/**
	 * Map color composite expose to hue and saturation properties
	 * Z2M color composites can have different structures:
	 * - color_hs (name) with property "color" - has features: hue (0-360), saturation (0-100)
	 * - color_xy (name) with property "color" - has features: x (0-1), y (0-1) - skipped
	 *
	 * Important: We must use composite.name to distinguish between color_hs and color_xy
	 * because both have property="color"
	 */
	private mapColorCompositeToProperties(composite: Z2mExposeComposite): MappedProperty[] {
		// Use composite.name to distinguish between color_xy and color_hs
		// Both have property="color" but different names
		const compositeName = composite.name ?? '';
		const compositeProperty = composite.property ?? composite.name ?? 'color';
		const properties: MappedProperty[] = [];

		// Log the composite structure for debugging
		const featureNames = (composite.features || []).map((f) => f.property ?? f.name).join(', ');
		this.logger.debug(
			`Processing color composite: name=${compositeName}, property=${compositeProperty}, features=[${featureNames}]`,
		);

		// Skip color_xy - we prefer color_hs for HSV/HSB support
		// Check by name since both color_xy and color_hs have property="color"
		if (compositeName === 'color_xy') {
			this.logger.debug('Skipping color_xy composite - prefer color_hs for HSV support');
			return properties;
		}

		// Handle color_hs composite (or generic color with hs features)
		if (compositeName === 'color_hs' || compositeName === 'color') {
			for (const feature of composite.features || []) {
				const featureName = (feature.property ?? feature.name ?? '').toLowerCase();

				// Match hue feature (h, hue)
				if (featureName === 'hue' || featureName === 'h') {
					const numericFeature = feature as Z2mExposeNumeric;
					this.logger.debug(`Found hue feature: ${featureName}`);
					properties.push({
						identifier: PropertyCategory.HUE.toString(),
						name: 'Hue',
						category: PropertyCategory.HUE,
						channelCategory: ChannelCategory.LIGHT,
						dataType: DataTypeType.USHORT,
						permissions: mapZ2mAccessToPermissions(feature.access ?? Z2M_ACCESS.STATE),
						z2mProperty: 'color',
						unit: 'deg',
						format: [0, 360],
						min: 0,
						max: 360,
						step: numericFeature.value_step,
					});
				}

				// Match saturation feature (s, saturation)
				if (featureName === 'saturation' || featureName === 's') {
					const numericFeature = feature as Z2mExposeNumeric;
					this.logger.debug(`Found saturation feature: ${featureName}`);
					properties.push({
						identifier: PropertyCategory.SATURATION.toString(),
						name: 'Saturation',
						category: PropertyCategory.SATURATION,
						channelCategory: ChannelCategory.LIGHT,
						dataType: DataTypeType.UCHAR,
						permissions: mapZ2mAccessToPermissions(feature.access ?? Z2M_ACCESS.STATE),
						z2mProperty: 'color',
						unit: '%',
						format: [0, 100],
						min: 0,
						max: 100,
						step: numericFeature.value_step,
					});
				}

				// Check for nested color_hs inside color composite
				if (featureName === 'color_hs' && feature.type === 'composite') {
					const nestedProperties = this.mapColorCompositeToProperties(feature as Z2mExposeComposite);
					properties.push(...nestedProperties);
				}
			}

			if (properties.length > 0) {
				this.logger.debug(`Mapped ${compositeName} to ${properties.length} properties (hue, saturation)`);
			} else {
				this.logger.warn(`No hue/saturation features found in ${compositeName} composite`);
			}
		}

		return properties;
	}

	/**
	 * Map generic expose to a sensor channel
	 */
	private mapGenericExpose(expose: Z2mExpose): MappedChannel[] {
		// Skip config exposes (settings like calibration, sensitivity, etc.)
		// Keep diagnostic exposes (battery, linkquality, etc.) - they're operational data
		if (expose.category === 'config') {
			return [];
		}

		const property = this.mapFeatureToProperty(expose);
		if (!property) {
			return [];
		}

		// Use the channel category from the property mapping
		// Each sensor type gets its own channel (temperature, humidity, occupancy, etc.)
		const channelCategory = property.channelCategory;
		const channelIdentifier = channelCategory.toString();
		const channelName = this.formatChannelName(channelIdentifier);

		return [
			{
				identifier: channelIdentifier,
				name: channelName,
				category: channelCategory,
				endpoint: expose.endpoint ?? undefined,
				properties: [property],
			},
		];
	}

	/**
	 * Map a feature/expose to a property
	 */
	private mapFeatureToProperty(expose: Z2mExpose): MappedProperty | null {
		const propertyName = expose.property ?? expose.name;
		if (!propertyName) {
			return null;
		}

		// Skip config properties - these are settings, not operational data
		// Note: diagnostic properties (battery, linkquality) are operational data we want to keep
		if (expose.category === 'config') {
			this.logger.debug(`Skipping config property: ${propertyName}`);
			return null;
		}

		// Check for cover state enum (OPEN/CLOSE/STOP) - should map to status, not on
		// Z2M state represents the current status of the cover
		if (propertyName === 'state' && expose.type === 'enum') {
			const enumExpose = expose as Z2mExposeEnum;
			if (this.isCoverStateEnum(enumExpose.values)) {
				return this.mapCoverStateToStatus(expose, enumExpose.values);
			}
		}

		// Skip calibration and settings properties that Z2M doesn't mark as config
		const skipProperties = [
			// Calibration settings
			'temperature_calibration',
			'humidity_calibration',
			'illuminance_calibration',
			'pm25_calibration',
			// Unit settings
			'temperature_unit',
			// Precision settings
			'temperature_precision',
			'humidity_precision',
			// Radar/sensor settings
			'radar_sensitivity',
			'minimum_range',
			'maximum_range',
			'detection_delay',
			'fading_time',
			// Motor/cover settings
			'reverse_direction',
			// Diagnostic enum (not useful for display)
			'self_test',
			// Valve settings
			'threshold',
			'timer',
			// Light settings
			'effect',
			'do_not_disturb',
			'color_power_on_behavior',
			// Identification
			'identify',
			// Link quality - handled automatically by device_information channel
			'linkquality',
		];
		if (skipProperties.includes(propertyName)) {
			this.logger.debug(`Skipping settings property: ${propertyName}`);
			return null;
		}

		// Skip if no access at all
		const access = expose.access ?? Z2M_ACCESS.STATE;
		if (access === 0) {
			return null;
		}

		const permissions = mapZ2mAccessToPermissions(access);
		const label = expose.label ?? expose.name ?? propertyName;

		// Check for common property mappings
		const commonMapping = COMMON_PROPERTY_MAPPINGS[propertyName];

		// Determine data type based on expose type
		let dataType: DataTypeType;
		let format: string[] | number[] | undefined;
		let min: number | undefined;
		let max: number | undefined;
		let step: number | undefined;
		let unit: string | undefined;

		switch (expose.type) {
			case 'binary': {
				const binaryExpose = expose as Z2mExposeBinary;
				dataType = DataTypeType.BOOL;
				// Store value_on/value_off as format for string values
				// This includes 'true'/'false' strings which need to be sent as-is to the device
				if (typeof binaryExpose.value_on === 'string' && typeof binaryExpose.value_off === 'string') {
					format = [binaryExpose.value_on, binaryExpose.value_off];
				}
				break;
			}
			case 'numeric': {
				const numericExpose = expose as Z2mExposeNumeric;
				// Prefer commonMapping dataType (e.g., FLOAT for humidity/pressure) over range-based inference
				dataType =
					commonMapping?.dataType ?? mapZ2mTypeToDataType('numeric', numericExpose.value_min, numericExpose.value_max);

				// Convert Z2M ranges to spec-compliant ranges
				// This handles unit conversions like mired->Kelvin, 0-254->0-100%, etc.
				const convertedRange = this.convertZ2mRangeToSpec(
					propertyName,
					numericExpose.value_min,
					numericExpose.value_max,
					numericExpose.unit,
				);

				min = convertedRange.min;
				max = convertedRange.max;
				unit = convertedRange.unit;
				step = numericExpose.value_step;

				if (min !== undefined && max !== undefined) {
					format = [min, max];
				}
				break;
			}
			case 'enum': {
				const enumExpose = expose as Z2mExposeEnum;
				dataType = DataTypeType.STRING;
				format = enumExpose.values;
				break;
			}
			case 'text':
				dataType = DataTypeType.STRING;
				break;
			case 'composite': {
				// Handle composite types like color
				const compositeExpose = expose as Z2mExposeComposite;
				// Color composites should be expanded to separate properties (hue, saturation)
				// This is handled specially in mapFeatureToProperty which returns null for composites
				// so they're skipped here - the features are mapped separately
				if (propertyName === 'color' || propertyName === 'color_hs' || propertyName === 'color_xy') {
					this.logger.debug(`Skipping composite color expose ${propertyName} - features mapped separately`);
					return null;
				}
				// For other composites, store as JSON string
				dataType = DataTypeType.STRING;
				this.logger.debug(`Composite expose ${propertyName} with ${compositeExpose.features?.length ?? 0} features`);
				break;
			}
			default:
				dataType = commonMapping?.dataType ?? DataTypeType.STRING;
		}

		// Determine property category
		const category = commonMapping?.category ?? this.inferPropertyCategory(propertyName, expose.type);

		// Determine channel category from mapping or infer from property category
		const channelCategory =
			commonMapping?.channelCategory ?? this.inferChannelCategoryFromProperty(propertyName, category);

		// Skip if no valid channel category (property doesn't fit any known channel)
		if (channelCategory === null) {
			this.logger.debug(`Skipping property with no channel mapping: ${propertyName} (category: ${category})`);
			return null;
		}

		// Use spec-compliant identifier from mapping if available, otherwise derive from Z2M property name
		const identifier = commonMapping?.propertyIdentifier ?? this.mapToSpecIdentifier(propertyName, category);

		return {
			identifier,
			name: this.formatPropertyName(label),
			category,
			channelCategory,
			dataType,
			permissions,
			z2mProperty: propertyName,
			unit,
			format,
			min: min ?? commonMapping?.min,
			max: max ?? commonMapping?.max,
			step,
		};
	}

	/**
	 * Map Z2M property name to spec-compliant identifier
	 */
	private mapToSpecIdentifier(propertyName: string, category: PropertyCategory): string {
		// The identifier should match the property category (which matches spec)
		// This ensures properties use spec-compliant identifiers
		return category.toString();
	}

	/**
	 * Infer channel category from property name and category
	 * Returns null if the property should be skipped (not mapped to any channel)
	 */
	private inferChannelCategoryFromProperty(propertyName: string, category: PropertyCategory): ChannelCategory | null {
		const name = propertyName.toLowerCase();

		// Map property categories to channel categories
		switch (category) {
			case PropertyCategory.TEMPERATURE:
				return ChannelCategory.TEMPERATURE;
			case PropertyCategory.HUMIDITY:
				return ChannelCategory.HUMIDITY;
			case PropertyCategory.DETECTED:
			case PropertyCategory.TAMPERED:
				// Infer specific sensor type from property name
				if (name.includes('occupancy') || name.includes('presence') || name.includes('motion')) {
					return ChannelCategory.OCCUPANCY;
				}
				if (name.includes('contact') || name.includes('door') || name.includes('window')) {
					return ChannelCategory.CONTACT;
				}
				if (name.includes('water') || name.includes('leak')) {
					return ChannelCategory.LEAK;
				}
				if (name.includes('smoke')) {
					return ChannelCategory.SMOKE;
				}
				if (name.includes('gas') || name.includes('co2') || name.includes('carbon')) {
					return ChannelCategory.CARBON_DIOXIDE;
				}
				if (name.includes('vibration')) {
					return ChannelCategory.MOTION;
				}
				return ChannelCategory.OCCUPANCY; // Default for detected
			case PropertyCategory.ON:
				return ChannelCategory.SWITCHER;
			case PropertyCategory.BRIGHTNESS:
			case PropertyCategory.COLOR_TEMPERATURE:
			case PropertyCategory.HUE:
			case PropertyCategory.SATURATION:
				return ChannelCategory.LIGHT;
			case PropertyCategory.POSITION:
			case PropertyCategory.TILT:
				return ChannelCategory.WINDOW_COVERING;
			case PropertyCategory.LOCKED:
				return ChannelCategory.LOCK;
			case PropertyCategory.PERCENTAGE:
			case PropertyCategory.FAULT:
			case PropertyCategory.LEVEL:
				// Check if it's battery related
				if (name.includes('battery')) {
					return ChannelCategory.BATTERY;
				}
				return ChannelCategory.BATTERY; // Default for percentage/level
			case PropertyCategory.VOLTAGE:
			case PropertyCategory.CURRENT:
			case PropertyCategory.POWER:
				return ChannelCategory.ELECTRICAL_POWER;
			case PropertyCategory.CONSUMPTION:
				return ChannelCategory.ELECTRICAL_ENERGY;
			case PropertyCategory.MEASURED:
				// Infer from property name
				if (name.includes('illuminance') || name.includes('lux') || name.includes('light')) {
					return ChannelCategory.ILLUMINANCE;
				}
				if (name.includes('pressure')) {
					return ChannelCategory.PRESSURE;
				}
				if (name.includes('co2') || name.includes('carbon_dioxide')) {
					return ChannelCategory.CARBON_DIOXIDE;
				}
				if (name.includes('voc') || name.includes('volatile')) {
					return ChannelCategory.VOLATILE_ORGANIC_COMPOUNDS;
				}
				if (name.includes('pm25') || name.includes('pm10') || name.includes('particulate')) {
					return ChannelCategory.AIR_PARTICULATE;
				}
				// Default to temperature for unknown measured values
				return ChannelCategory.TEMPERATURE;
			case PropertyCategory.MODE:
			case PropertyCategory.STATUS:
				// Infer from property name for modes/status
				if (
					name.includes('thermostat') ||
					name.includes('climate') ||
					name.includes('heating') ||
					name.includes('cooling') ||
					name.includes('system_mode') ||
					name.includes('running_state')
				) {
					return ChannelCategory.THERMOSTAT;
				}
				if (name.includes('fan')) {
					return ChannelCategory.FAN;
				}
				if (name.includes('cover') || name.includes('motor') || name.includes('moving')) {
					return ChannelCategory.WINDOW_COVERING;
				}
				if (name.includes('air_quality') || name.includes('pm25') || name.includes('pm10')) {
					return ChannelCategory.AIR_PARTICULATE;
				}
				// Skip unknown mode/status properties - they're likely config settings
				return null;
			case PropertyCategory.DISTANCE:
				return ChannelCategory.OCCUPANCY;
			case PropertyCategory.SPEED:
				return ChannelCategory.FAN;
			case PropertyCategory.EVENT:
				return ChannelCategory.DOORBELL; // Actions/events go to doorbell channel
			case PropertyCategory.LINK_QUALITY:
				return ChannelCategory.DEVICE_INFORMATION;
			default:
				// Try to infer from property name as last resort
				if (name.includes('temperature') || name.includes('temp')) {
					return ChannelCategory.TEMPERATURE;
				}
				if (name.includes('humidity')) {
					return ChannelCategory.HUMIDITY;
				}
				if (name.includes('battery')) {
					return ChannelCategory.BATTERY;
				}
				if (name.includes('illuminance') || name.includes('lux')) {
					return ChannelCategory.ILLUMINANCE;
				}
				if (name.includes('pressure')) {
					return ChannelCategory.PRESSURE;
				}
				return ChannelCategory.DEVICE_INFORMATION;
		}
	}

	/**
	 * Infer property category from property name
	 */
	private inferPropertyCategory(propertyName: string, exposeType: string): PropertyCategory {
		const name = propertyName.toLowerCase();

		// Binary properties
		if (exposeType === 'binary') {
			if (name.includes('state') || name === 'on') {
				return PropertyCategory.ON;
			}
			if (name.includes('occupancy') || name.includes('presence') || name.includes('motion')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('contact') || name.includes('door') || name.includes('window')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('water') || name.includes('leak')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('smoke') || name.includes('gas') || name.includes('co')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('tamper')) {
				return PropertyCategory.DETECTED;
			}
			if (name.includes('battery_low') || name.includes('low_battery')) {
				return PropertyCategory.FAULT;
			}
			return PropertyCategory.STATUS;
		}

		// Numeric properties
		if (exposeType === 'numeric') {
			if (name.includes('temperature') || name.includes('temp')) {
				return PropertyCategory.TEMPERATURE;
			}
			if (name.includes('humidity')) {
				return PropertyCategory.HUMIDITY;
			}
			if (name.includes('pressure')) {
				return PropertyCategory.MEASURED;
			}
			if (name.includes('illuminance') || name.includes('lux')) {
				return PropertyCategory.DENSITY;
			}
			if (name === 'battery') {
				return PropertyCategory.PERCENTAGE;
			}
			if (name.includes('voltage')) {
				return PropertyCategory.VOLTAGE;
			}
			if (name.includes('current')) {
				return PropertyCategory.CURRENT;
			}
			if (name.includes('power')) {
				return PropertyCategory.POWER;
			}
			if (name.includes('energy')) {
				return PropertyCategory.CONSUMPTION;
			}
			if (name.includes('brightness') || name.includes('bri')) {
				return PropertyCategory.BRIGHTNESS;
			}
			if (name.includes('color_temp')) {
				return PropertyCategory.COLOR_TEMPERATURE;
			}
			if (name.includes('position')) {
				return PropertyCategory.POSITION;
			}
			if (name.includes('tilt')) {
				return PropertyCategory.TILT;
			}
			if (name.includes('setpoint')) {
				return PropertyCategory.TEMPERATURE;
			}
			if (name.includes('linkquality') || name.includes('link_quality')) {
				return PropertyCategory.LINK_QUALITY;
			}
			return PropertyCategory.LEVEL;
		}

		// Enum/text properties
		if (name.includes('mode') || name.includes('preset')) {
			return PropertyCategory.MODE;
		}
		if (name.includes('action') || name.includes('click')) {
			return PropertyCategory.EVENT;
		}
		if (name.includes('state') || name.includes('status')) {
			return PropertyCategory.STATUS;
		}

		// Default to STATUS for unknown properties (GENERIC is deprecated)
		return PropertyCategory.STATUS;
	}

	/**
	 * Convert Z2M value range to spec-compliant range
	 * Handles unit conversions like:
	 * - brightness: 0-254/255 -> 0-100%
	 * - color_temp: mired -> Kelvin (inverted scale)
	 * - other numeric values: keep as-is with original unit
	 */
	private convertZ2mRangeToSpec(
		propertyName: string,
		z2mMin: number | undefined,
		z2mMax: number | undefined,
		z2mUnit: string | undefined,
	): { min: number | undefined; max: number | undefined; unit: string | undefined } {
		// Brightness conversion: 0-254/255 -> 0-100%
		if (propertyName === 'brightness') {
			// Always normalize to 0-100% regardless of Z2M range
			return { min: 0, max: 100, unit: '%' };
		}

		// Color temperature: mired -> Kelvin (inverted scale)
		// mired = 1,000,000 / Kelvin, so Kelvin = 1,000,000 / mired
		// Z2M min mired = max Kelvin (coolest), Z2M max mired = min Kelvin (warmest)
		if (propertyName === 'color_temp' && z2mUnit === 'mired') {
			const minKelvin = z2mMax && z2mMax > 0 ? Math.round(1000000 / z2mMax) : 2000;
			const maxKelvin = z2mMin && z2mMin > 0 ? Math.round(1000000 / z2mMin) : 6500;
			this.logger.debug(`Converting color_temp range: ${z2mMin}-${z2mMax} mired -> ${minKelvin}-${maxKelvin} K`);
			return { min: minKelvin, max: maxKelvin, unit: 'K' };
		}

		// Link quality: 0-255 -> 0-100%
		if (propertyName === 'linkquality') {
			return { min: 0, max: 100, unit: '%' };
		}

		// Default: keep original range and unit
		return { min: z2mMin, max: z2mMax, unit: z2mUnit };
	}

	/**
	 * Format channel name for display
	 */
	private formatChannelName(type: string, endpoint?: string): string {
		const baseName = type.charAt(0).toUpperCase() + type.slice(1);
		return endpoint ? `${baseName} (${endpoint})` : baseName;
	}

	/**
	 * Format property name for display
	 */
	private formatPropertyName(label: string): string {
		return label
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Sanitize identifier to be valid
	 */
	private sanitizeIdentifier(name: string): string {
		return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
	}

	/**
	 * Check if enum values indicate a cover state (OPEN/CLOSE/STOP)
	 */
	private isCoverStateEnum(values: string[] | undefined): boolean {
		if (!values || values.length === 0) {
			return false;
		}

		const lowerValues = values.map((v) => v.toLowerCase());

		// Check for cover control values
		const hasOpen = lowerValues.includes('open');
		const hasClose = lowerValues.includes('close');

		// A cover state enum should have at least open and close (stop is optional)
		return hasOpen && hasClose;
	}

	/**
	 * Map cover state enum to status property
	 * Z2M state (OPEN/CLOSE/STOP) represents the current status of the cover
	 * Values are normalized to match spec format (opened/closed/stopped)
	 */
	private mapCoverStateToStatus(expose: Z2mExpose, values: string[]): MappedProperty {
		// Normalize Z2M values to spec format
		const normalizedFormat = this.normalizeCoverStateValues(values);

		return {
			identifier: PropertyCategory.STATUS.toString(),
			name: 'Status',
			category: PropertyCategory.STATUS,
			channelCategory: ChannelCategory.WINDOW_COVERING,
			dataType: DataTypeType.ENUM,
			// Status is read-only - we read the current state from Z2M
			permissions: [PermissionType.READ_ONLY],
			z2mProperty: expose.property ?? expose.name ?? 'state',
			format: normalizedFormat,
		};
	}

	/**
	 * Normalize Z2M cover state values to spec format
	 * Z2M uses: OPEN, CLOSE, STOP (uppercase, imperative)
	 * Spec uses: opened, closed, stopped (lowercase, past tense)
	 */
	private normalizeCoverStateValues(values: string[]): string[] {
		const normalized: string[] = [];

		for (const value of values) {
			const lower = value.toLowerCase();
			if (lower === 'open') {
				normalized.push('opened');
			} else if (lower === 'close') {
				normalized.push('closed');
			} else if (lower === 'stop') {
				normalized.push('stopped');
			} else {
				// Keep other values as-is (lowercase)
				normalized.push(lower);
			}
		}

		return normalized;
	}
}
