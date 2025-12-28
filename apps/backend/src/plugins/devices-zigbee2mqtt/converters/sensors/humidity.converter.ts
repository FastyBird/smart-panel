import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Humidity Sensor Converter
 *
 * Handles humidity sensors with properties like:
 * - humidity (0-100%)
 * - soil_moisture
 */
export class HumiditySensorConverter extends BaseSensorConverter {
	readonly type = 'humidity-sensor';
	readonly propertyNames = ['humidity', 'soil_moisture'];
	readonly channelCategory = ChannelCategory.HUMIDITY;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		if (expose.type !== 'numeric') {
			return this.cannotHandle();
		}

		if (this.matchesProperty(expose)) {
			return this.canHandleWith(ConverterPriority.SENSOR);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const numericExpose = expose as Z2mExposeNumeric;
		const propertyName = this.getPropertyName(expose) ?? 'humidity';

		const properties = [
			this.createNumericSensorProperty(numericExpose, {
				identifier: 'humidity',
				name: this.formatName(propertyName),
				category: PropertyCategory.HUMIDITY,
				unit: '%',
				defaultMin: 0,
				defaultMax: 100,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: 'humidity',
				name: 'Humidity',
				category: ChannelCategory.HUMIDITY,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
