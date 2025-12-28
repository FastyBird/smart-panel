import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeBinary, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { BaseConverter } from '../base.converter';
import { ConversionContext, ISensorConverter, MappedProperty } from '../converter.interface';

/**
 * Abstract Base Sensor Converter
 *
 * Provides common functionality for sensor converters:
 * - Tamper detection characteristic
 * - Low battery alert handling
 * - Standard sensor property creation
 *
 * Inspired by homebridge-z2m's BasicSensorHandler pattern.
 */
export abstract class BaseSensorConverter extends BaseConverter implements ISensorConverter {
	abstract readonly type: string;
	abstract readonly propertyNames: string[];
	abstract readonly channelCategory: ChannelCategory;

	/**
	 * Check if this sensor can handle the expose by matching property name
	 *
	 * Uses exact matching to avoid false positives like 'temperature_calibration'
	 * matching the temperature sensor converter.
	 */
	protected matchesProperty(expose: Z2mExpose): boolean {
		const propertyName = this.getPropertyName(expose);
		if (!propertyName) return false;

		// Use exact matching only to avoid false positives
		// e.g., 'temperature_calibration' should NOT match 'temperature'
		return this.propertyNames.includes(propertyName);
	}

	/**
	 * Find optional tamper property in the device's exposes
	 */
	protected findTamperExpose(context: ConversionContext): Z2mExposeBinary | undefined {
		return context.allExposes.find((e) => e.type === 'binary' && (e.property === 'tamper' || e.name === 'tamper')) as
			| Z2mExposeBinary
			| undefined;
	}

	/**
	 * Find optional battery_low property in the device's exposes
	 */
	protected findBatteryLowExpose(context: ConversionContext): Z2mExposeBinary | undefined {
		return context.allExposes.find(
			(e) =>
				e.type === 'binary' &&
				(e.property === 'battery_low' || e.name === 'battery_low' || e.property === 'low_battery'),
		) as Z2mExposeBinary | undefined;
	}

	/**
	 * Create tamper property if tamper expose exists
	 */
	protected createTamperProperty(tamperExpose: Z2mExposeBinary): MappedProperty {
		return this.createProperty({
			identifier: 'tampered',
			name: 'Tamper',
			category: PropertyCategory.TAMPERED,
			channelCategory: this.channelCategory,
			dataType: DataTypeType.BOOL,
			z2mProperty: tamperExpose.property ?? 'tamper',
			access: tamperExpose.access ?? Z2M_ACCESS.STATE,
		});
	}

	/**
	 * Create battery low property if battery_low expose exists
	 */
	protected createBatteryLowProperty(batteryLowExpose: Z2mExposeBinary): MappedProperty {
		return this.createProperty({
			identifier: 'fault',
			name: 'Battery Low',
			category: PropertyCategory.FAULT,
			channelCategory: this.channelCategory,
			dataType: DataTypeType.BOOL,
			z2mProperty: batteryLowExpose.property ?? 'battery_low',
			access: batteryLowExpose.access ?? Z2M_ACCESS.STATE,
		});
	}

	/**
	 * Add optional characteristics (tamper, battery_low) to properties array
	 */
	protected addOptionalCharacteristics(properties: MappedProperty[], context: ConversionContext): void {
		// Add tamper if available and not already mapped
		if (!context.mappedProperties.has('tamper')) {
			const tamperExpose = this.findTamperExpose(context);
			if (tamperExpose) {
				properties.push(this.createTamperProperty(tamperExpose));
			}
		}

		// Note: battery_low is typically handled by the battery converter
		// so we don't add it here to avoid duplication
	}

	/**
	 * Create a standard numeric sensor property
	 */
	protected createNumericSensorProperty(
		expose: Z2mExposeNumeric,
		params: {
			identifier: string;
			name: string;
			category: PropertyCategory;
			unit?: string;
			defaultMin?: number;
			defaultMax?: number;
		},
	): MappedProperty {
		const range = this.extractNumericRange(expose);

		return this.createProperty({
			identifier: params.identifier,
			name: params.name,
			category: params.category,
			channelCategory: this.channelCategory,
			dataType: this.inferDataType(expose),
			z2mProperty: expose.property ?? expose.name ?? params.identifier,
			access: expose.access ?? Z2M_ACCESS.STATE,
			unit: range.unit ?? params.unit,
			min: range.min ?? params.defaultMin,
			max: range.max ?? params.defaultMax,
			step: range.step,
			format: range.min !== undefined && range.max !== undefined ? [range.min, range.max] : undefined,
		});
	}

	/**
	 * Create a standard binary sensor property
	 */
	protected createBinarySensorProperty(
		expose: Z2mExposeBinary,
		params: {
			identifier: string;
			name: string;
			category: PropertyCategory;
		},
	): MappedProperty {
		const format = this.extractBinaryFormat(expose);

		return this.createProperty({
			identifier: params.identifier,
			name: params.name,
			category: params.category,
			channelCategory: this.channelCategory,
			dataType: DataTypeType.BOOL,
			z2mProperty: expose.property ?? expose.name ?? params.identifier,
			access: expose.access ?? Z2M_ACCESS.STATE,
			format,
		});
	}
}
