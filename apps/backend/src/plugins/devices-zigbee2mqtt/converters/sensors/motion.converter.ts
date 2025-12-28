import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeBinary } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Motion/Vibration Sensor Converter
 *
 * Handles vibration and movement sensors with properties like:
 * - vibration (boolean)
 * - action (for tilt/drop events)
 */
export class MotionSensorConverter extends BaseSensorConverter {
	readonly type = 'motion-sensor';
	readonly propertyNames = ['vibration'];
	readonly channelCategory = ChannelCategory.MOTION;

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

		const properties = [
			this.createBinarySensorProperty(binaryExpose, {
				identifier: 'detected',
				name: 'Vibration',
				category: PropertyCategory.DETECTED,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('motion', expose.endpoint),
				name: this.formatChannelName('Motion', expose.endpoint),
				category: ChannelCategory.MOTION,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
