import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeBinary } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Leak Sensor Converter
 *
 * Handles water leak sensors with properties like:
 * - water_leak (boolean)
 * - gas (boolean) - for gas leak sensors
 */
export class LeakSensorConverter extends BaseSensorConverter {
	readonly type = 'leak-sensor';
	readonly propertyNames = ['water_leak', 'gas'];
	readonly channelCategory = ChannelCategory.LEAK;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		if (expose.type !== 'binary') {
			return this.cannotHandle();
		}

		if (this.matchesProperty(expose)) {
			return this.canHandleWith(ConverterPriority.SENSOR);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const binaryExpose = expose as Z2mExposeBinary;
		const propertyName = this.getPropertyName(expose) ?? 'water_leak';

		const properties = [
			this.createBinarySensorProperty(binaryExpose, {
				identifier: 'detected',
				name: this.formatName(propertyName),
				category: PropertyCategory.DETECTED,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: 'leak',
				name: 'Leak',
				category: ChannelCategory.LEAK,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
