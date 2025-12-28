import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeBinary } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Contact Sensor Converter
 *
 * Handles door/window contact sensors with properties like:
 * - contact (boolean - true = closed, false = open)
 */
export class ContactSensorConverter extends BaseSensorConverter {
	readonly type = 'contact-sensor';
	readonly propertyNames = ['contact'];
	readonly channelCategory = ChannelCategory.CONTACT;

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
				name: 'Contact',
				category: PropertyCategory.DETECTED,
			}),
		];

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('contact', expose.endpoint),
				name: this.formatChannelName('Contact', expose.endpoint),
				category: ChannelCategory.CONTACT,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
