import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Illuminance Sensor Converter
 *
 * Handles light level sensors with properties like:
 * - illuminance (raw value)
 * - illuminance_lux (lux value)
 */
export class IlluminanceSensorConverter extends BaseSensorConverter {
	readonly type = 'illuminance-sensor';
	readonly propertyNames = ['illuminance', 'illuminance_lux'];
	readonly channelCategory = ChannelCategory.ILLUMINANCE;

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
				identifier: 'density',
				name: 'Illuminance',
				category: PropertyCategory.DENSITY,
				unit: 'lx',
				defaultMin: 0,
				defaultMax: 100000,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('illuminance', expose.endpoint),
				name: this.formatChannelName('Illuminance', expose.endpoint),
				category: ChannelCategory.ILLUMINANCE,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
