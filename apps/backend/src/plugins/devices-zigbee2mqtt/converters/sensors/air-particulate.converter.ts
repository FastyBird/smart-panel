import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeEnum, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import {
	CanHandleResult,
	ConversionContext,
	ConverterPriority,
	MappedChannel,
	MappedProperty,
} from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Air Particulate Sensor Converter
 *
 * Handles air quality and particulate matter sensors with properties like:
 * - pm25 (PM2.5 concentration in µg/m³)
 * - pm10 (PM10 concentration in µg/m³)
 * - pm1 (PM1 concentration in µg/m³)
 * - air_quality (calculated air quality level)
 * - voc (Volatile Organic Compounds)
 * - formaldehyde
 */
export class AirParticulateSensorConverter extends BaseSensorConverter {
	readonly type = 'air-particulate-sensor';
	readonly propertyNames = ['pm25', 'pm10', 'pm1', 'voc', 'formaldehyde', 'air_quality'];
	readonly channelCategory = ChannelCategory.AIR_PARTICULATE;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		// Handle numeric (pm25, pm10, etc.) and enum (air_quality) exposes
		if (expose.type !== 'numeric' && expose.type !== 'enum') {
			return this.cannotHandle();
		}

		if (this.matchesProperty(expose)) {
			return this.canHandleWith(ConverterPriority.SENSOR);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const propertyName = this.getPropertyName(expose);
		if (!propertyName) return [];

		const properties: MappedProperty[] = [];

		if (expose.type === 'numeric') {
			properties.push(this.convertNumericProperty(expose, propertyName));
		} else if (expose.type === 'enum') {
			properties.push(this.convertEnumProperty(expose, propertyName));
		}

		if (properties.length === 0) {
			return [];
		}

		// Add optional tamper characteristic
		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('air_particulate', expose.endpoint),
				name: this.formatChannelName('Air Quality', expose.endpoint),
				category: ChannelCategory.AIR_PARTICULATE,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}

	/**
	 * Convert numeric air quality properties (pm25, pm10, voc, etc.)
	 */
	private convertNumericProperty(expose: Z2mExpose, propertyName: string): MappedProperty {
		const numericExpose = expose as Z2mExposeNumeric;

		// All PM/VOC values map to density property category
		return this.createNumericSensorProperty(numericExpose, {
			identifier: propertyName,
			name: this.formatName(propertyName),
			category: PropertyCategory.DENSITY,
			unit: numericExpose.unit ?? 'µg/m³',
			defaultMin: 0,
			defaultMax: 1000,
		});
	}

	/**
	 * Convert enum air quality properties (air_quality level)
	 */
	private convertEnumProperty(expose: Z2mExpose, propertyName: string): MappedProperty {
		const enumExpose = expose as Z2mExposeEnum;
		const values = enumExpose.values || [];

		return this.createProperty({
			identifier: propertyName,
			name: this.formatName(propertyName),
			category: PropertyCategory.MODE,
			channelCategory: this.channelCategory,
			dataType: this.getDataType(this.channelCategory, PropertyCategory.MODE, expose),
			z2mProperty: enumExpose.property ?? propertyName,
			access: enumExpose.access,
			format: values,
		});
	}
}
