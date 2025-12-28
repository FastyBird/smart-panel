import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Pressure Sensor Converter
 *
 * Handles atmospheric pressure sensors with properties like:
 * - pressure (hPa)
 */
export class PressureSensorConverter extends BaseSensorConverter {
	readonly type = 'pressure-sensor';
	readonly propertyNames = ['pressure'];
	readonly channelCategory = ChannelCategory.PRESSURE;

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

		const properties = [
			this.createNumericSensorProperty(numericExpose, {
				identifier: 'measured',
				name: 'Pressure',
				category: PropertyCategory.MEASURED,
				unit: 'hPa',
				defaultMin: 300,
				defaultMax: 1100,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('pressure', expose.endpoint),
				name: this.formatChannelName('Pressure', expose.endpoint),
				category: ChannelCategory.PRESSURE,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
