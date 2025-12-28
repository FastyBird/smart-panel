import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeBinary } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Smoke Sensor Converter
 *
 * Handles smoke and carbon monoxide sensors with properties like:
 * - smoke (boolean)
 * - carbon_monoxide (boolean)
 */
export class SmokeSensorConverter extends BaseSensorConverter {
	readonly type = 'smoke-sensor';
	readonly propertyNames = ['smoke', 'carbon_monoxide'];
	readonly channelCategory = ChannelCategory.SMOKE;

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
		const propertyName = this.getPropertyName(expose) ?? 'smoke';

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
				identifier: 'smoke',
				name: 'Smoke',
				category: ChannelCategory.SMOKE,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
