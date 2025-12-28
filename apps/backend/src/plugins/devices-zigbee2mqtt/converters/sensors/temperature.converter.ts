import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Temperature Sensor Converter
 *
 * Handles temperature sensors with properties like:
 * - temperature (°C or °F)
 * - device_temperature (device internal temperature)
 */
export class TemperatureSensorConverter extends BaseSensorConverter {
	readonly type = 'temperature-sensor';
	readonly propertyNames = ['temperature', 'device_temperature', 'soil_temperature'];
	readonly channelCategory = ChannelCategory.TEMPERATURE;

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
		const propertyName = this.getPropertyName(expose) ?? 'temperature';

		const properties = [
			this.createNumericSensorProperty(numericExpose, {
				identifier: 'temperature',
				name: this.formatName(propertyName),
				category: PropertyCategory.TEMPERATURE,
				unit: '°C',
				defaultMin: -40,
				defaultMax: 80,
			}),
		];

		// Add optional tamper characteristic
		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: 'temperature',
				name: 'Temperature',
				category: ChannelCategory.TEMPERATURE,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
