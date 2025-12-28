import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
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
 * Handles particulate matter sensors with properties like:
 * - pm25 (PM2.5 concentration in µg/m³)
 * - pm10 (PM10 concentration in µg/m³)
 * - pm1 (PM1 concentration in µg/m³)
 * - voc (Volatile Organic Compounds in µg/m³)
 * - formaldehyde (concentration in µg/m³)
 *
 * Note: The spec's 'mode' property defines sensor measurement type (pm1, pm2_5, pm10),
 * not air quality levels. Z2M's air_quality expose (excellent/good/poor/etc.) is not
 * mappable to the spec and is intentionally excluded.
 */
export class AirParticulateSensorConverter extends BaseSensorConverter {
	readonly type = 'air-particulate-sensor';
	readonly propertyNames = ['pm25', 'pm10', 'pm1', 'voc', 'formaldehyde'];
	readonly channelCategory = ChannelCategory.AIR_PARTICULATE;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		// Only handle numeric exposes (pm25, pm10, voc, etc.)
		// Enum exposes like air_quality are not mappable to the spec
		if (expose.type !== 'numeric') {
			return this.cannotHandle();
		}

		if (this.matchesProperty(expose)) {
			return this.canHandleWith(ConverterPriority.SENSOR);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const propertyName = this.getPropertyName(expose);
		if (!propertyName || expose.type !== 'numeric') return [];

		const properties: MappedProperty[] = [this.convertNumericProperty(expose, propertyName)];

		// Add optional tamper characteristic
		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('air_particulate', expose.endpoint),
				name: this.formatChannelName('Air Particulate', expose.endpoint),
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
}
