import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { Z2M_ACCESS } from '../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeBinary, Z2mExposeEnum, Z2mExposeNumeric } from '../interfaces/zigbee2mqtt.interface';

import { CanHandleResult, ConversionContext, IConverter, MappedChannel, MappedProperty } from './converter.interface';

/**
 * Abstract base class for all converters
 *
 * Provides common utility methods for:
 * - Access permission mapping
 * - Data type inference
 * - Value range conversion
 * - Name formatting
 */
export abstract class BaseConverter implements IConverter {
	abstract readonly type: string;

	abstract canHandle(expose: Z2mExpose): CanHandleResult;
	abstract convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[];

	/**
	 * Map Z2M access bits to Smart Panel permissions
	 */
	protected mapAccessToPermissions(access: number): PermissionType[] {
		const canRead = (access & Z2M_ACCESS.STATE) !== 0 || (access & Z2M_ACCESS.GET) !== 0;
		const canWrite = (access & Z2M_ACCESS.SET) !== 0;

		if (canRead && canWrite) {
			return [PermissionType.READ_WRITE];
		} else if (canWrite) {
			return [PermissionType.WRITE_ONLY];
		} else if (canRead) {
			return [PermissionType.READ_ONLY];
		}

		return [PermissionType.READ_ONLY];
	}

	/**
	 * Get data type from spec for a channel/property category combination.
	 * Falls back to inference from Z2M expose if spec doesn't define the type.
	 *
	 * @param channelCategory The channel category
	 * @param propertyCategory The property category
	 * @param expose The Z2M expose (used for fallback inference)
	 */
	protected getDataType(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		expose: Z2mExpose,
	): DataTypeType {
		// First, try to get from spec
		const metadata = getPropertyMetadata(channelCategory, propertyCategory);
		if (metadata && metadata.data_type !== DataTypeType.UNKNOWN) {
			return metadata.data_type;
		}

		// Fallback to inference from Z2M expose
		return this.inferDataType(expose);
	}

	/**
	 * Infer data type from Z2M expose (fallback when spec doesn't define it)
	 */
	protected inferDataType(expose: Z2mExpose): DataTypeType {
		switch (expose.type) {
			case 'binary':
				return DataTypeType.BOOL;
			case 'numeric': {
				const min = expose.value_min;
				const max = expose.value_max;

				if (min !== undefined && max !== undefined) {
					if (min < 0) {
						return DataTypeType.FLOAT;
					}
					if (max <= 255) {
						return DataTypeType.UCHAR;
					}
					if (max <= 65535) {
						return DataTypeType.USHORT;
					}
					if (max <= 4294967295) {
						return DataTypeType.UINT;
					}
				}
				return DataTypeType.FLOAT;
			}
			case 'enum':
				return DataTypeType.ENUM;
			case 'text':
				return DataTypeType.STRING;
			default:
				return DataTypeType.STRING;
		}
	}

	/**
	 * Format a name for display (convert snake_case to Title Case)
	 */
	protected formatName(name: string): string {
		return name
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Format channel name with optional endpoint suffix
	 */
	protected formatChannelName(baseName: string, endpoint?: string): string {
		const formatted = this.formatName(baseName);
		return endpoint ? `${formatted} (${endpoint})` : formatted;
	}

	/**
	 * Create channel identifier from type and endpoint
	 */
	protected createChannelIdentifier(type: string, endpoint?: string): string {
		return endpoint ? `${type}_${endpoint}` : type;
	}

	/**
	 * Scale brightness value from Z2M range (0-254/255) to 0-100%
	 */
	protected scaleBrightnessToPercent(value: number, max: number = 254): number {
		return Math.round((value / max) * 100);
	}

	/**
	 * Scale percent (0-100) to Z2M brightness range
	 */
	protected scalePercentToBrightness(percent: number, max: number = 254): number {
		return Math.round((percent / 100) * max);
	}

	/**
	 * Convert mired to Kelvin
	 */
	protected miredToKelvin(mired: number): number {
		if (mired <= 0) return 6500;
		return Math.round(1000000 / mired);
	}

	/**
	 * Convert Kelvin to mired
	 */
	protected kelvinToMired(kelvin: number): number {
		if (kelvin <= 0) return 153;
		return Math.round(1000000 / kelvin);
	}

	/**
	 * Check if an expose should be skipped (config category or skip property)
	 */
	protected shouldSkipExpose(expose: Z2mExpose): boolean {
		if (expose.category === 'config') {
			return true;
		}

		const propertyName = this.getPropertyName(expose);
		if (propertyName && SKIP_PROPERTIES.includes(propertyName as (typeof SKIP_PROPERTIES)[number])) {
			return true;
		}

		return false;
	}

	/**
	 * Get property name from expose
	 */
	protected getPropertyName(expose: Z2mExpose): string | undefined {
		return expose.property ?? expose.name;
	}

	/**
	 * Create a result indicating the converter cannot handle this expose
	 */
	protected cannotHandle(): CanHandleResult {
		return { canHandle: false, priority: 0 };
	}

	/**
	 * Create a result indicating the converter can handle this expose
	 */
	protected canHandleWith(priority: number): CanHandleResult {
		return { canHandle: true, priority };
	}

	/**
	 * Extract binary format (value_on, value_off) if applicable
	 */
	protected extractBinaryFormat(expose: Z2mExposeBinary): string[] | undefined {
		if (typeof expose.value_on === 'string' && typeof expose.value_off === 'string') {
			return [expose.value_on, expose.value_off];
		}
		return undefined;
	}

	/**
	 * Extract numeric range from expose
	 */
	protected extractNumericRange(expose: Z2mExposeNumeric): {
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
	} {
		return {
			min: expose.value_min,
			max: expose.value_max,
			step: expose.value_step,
			unit: expose.unit,
		};
	}

	/**
	 * Extract enum values from expose
	 */
	protected extractEnumValues(expose: Z2mExposeEnum): string[] {
		return expose.values || [];
	}

	/**
	 * Find a feature by property name in a composite or specific expose
	 */
	protected findFeature(expose: { features?: Z2mExpose[] }, propertyName: string): Z2mExpose | undefined {
		return expose.features?.find((f) => f.property === propertyName || f.name === propertyName);
	}

	/**
	 * Find features matching a predicate
	 */
	protected findFeatures(expose: { features?: Z2mExpose[] }, predicate: (f: Z2mExpose) => boolean): Z2mExpose[] {
		return expose.features?.filter(predicate) || [];
	}

	/**
	 * Create a basic mapped property
	 */
	protected createProperty(
		params: {
			identifier: string;
			name: string;
			category: PropertyCategory;
			channelCategory: ChannelCategory;
			dataType: DataTypeType;
			z2mProperty: string;
			access?: number;
			permissions?: PermissionType[];
		} & Partial<Pick<MappedProperty, 'unit' | 'format' | 'min' | 'max' | 'step'>>,
	): MappedProperty {
		return {
			identifier: params.identifier,
			name: params.name,
			category: params.category,
			channelCategory: params.channelCategory,
			dataType: params.dataType,
			permissions: params.permissions ?? this.mapAccessToPermissions(params.access ?? Z2M_ACCESS.STATE),
			z2mProperty: params.z2mProperty,
			unit: params.unit,
			format: params.format,
			min: params.min,
			max: params.max,
			step: params.step,
		};
	}

	/**
	 * Create a basic mapped channel
	 */
	protected createChannel(params: {
		identifier: string;
		name: string;
		category: ChannelCategory;
		endpoint?: string;
		properties: MappedProperty[];
		parentIdentifier?: string;
	}): MappedChannel {
		return {
			identifier: params.identifier,
			name: params.name,
			category: params.category,
			endpoint: params.endpoint,
			properties: params.properties,
			parentIdentifier: params.parentIdentifier,
		};
	}
}

/**
 * Properties that should be skipped during generic mapping
 * These are typically settings/calibration values
 */
export const SKIP_PROPERTIES = [
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
	// Diagnostic enum
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
	// Link quality - handled by device_information
	'linkquality',
] as const;
