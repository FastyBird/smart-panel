import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeSpecific } from '../interfaces/zigbee2mqtt.interface';

/**
 * Mapped channel structure produced by converters
 */
export interface MappedChannel {
	identifier: string;
	name: string;
	category: ChannelCategory;
	endpoint?: string;
	properties: MappedProperty[];
}

/**
 * Mapped property structure produced by converters
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
 * Context passed to converters during conversion
 * Contains information about the device and conversion state
 */
export interface ConversionContext {
	/** IEEE address of the device */
	ieeeAddress: string;
	/** Friendly name of the device */
	friendlyName: string;
	/** All exposes from the device (for context) */
	allExposes: Z2mExpose[];
	/** Properties already mapped in sibling channels (to avoid duplicates) */
	mappedProperties: Set<string>;
}

/**
 * Result of checking if a converter can handle an expose
 */
export interface CanHandleResult {
	/** Whether the converter can handle this expose */
	canHandle: boolean;
	/** Priority (higher = more specific, should be preferred) */
	priority: number;
}

/**
 * Converter interface for mapping Z2M exposes to Smart Panel channels
 *
 * Each converter handles a specific type of device or sensor.
 * Converters are registered with the ConverterRegistry and are
 * queried in priority order to find the best match for each expose.
 */
export interface IConverter {
	/**
	 * Unique identifier for this converter type
	 * Used for logging and debugging
	 */
	readonly type: string;

	/**
	 * Check if this converter can handle the given expose
	 *
	 * @param expose - The Z2M expose to check
	 * @returns Whether the converter can handle this expose and at what priority
	 */
	canHandle(expose: Z2mExpose): CanHandleResult;

	/**
	 * Convert the expose to mapped channels
	 *
	 * @param expose - The Z2M expose to convert
	 * @param context - Conversion context with device info
	 * @returns Array of mapped channels (can be empty if expose should be skipped)
	 */
	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[];
}

/**
 * Interface for specific device converters (light, switch, cover, etc.)
 * These handle Z2mExposeSpecific types which have a features array
 */
export interface IDeviceConverter extends IConverter {
	/**
	 * The specific expose type this converter handles
	 */
	readonly exposeType: Z2mExposeSpecific['type'];
}

/**
 * Interface for generic/sensor converters
 * These handle generic expose types (binary, numeric, enum, etc.)
 */
export interface ISensorConverter extends IConverter {
	/**
	 * Property names this sensor converter handles
	 * Used to match generic exposes by their property name
	 */
	readonly propertyNames: string[];
}

/**
 * Converter priority levels
 * Higher priority converters are checked first and can override lower priority ones
 */
export const ConverterPriority = {
	/** Specific device types (light, switch, cover, etc.) - highest priority */
	DEVICE: 100,
	/** Known sensor types (temperature, humidity, etc.) */
	SENSOR: 50,
	/** Action/button converters */
	ACTION: 40,
	/** Electrical monitoring (power, energy, etc.) */
	ELECTRICAL: 30,
	/** Generic fallback converters - lowest priority */
	GENERIC: 10,
} as const;
