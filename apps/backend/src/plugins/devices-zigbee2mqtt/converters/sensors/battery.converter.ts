import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
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
 * Battery Sensor Converter
 *
 * Handles battery level sensors with properties like:
 * - battery (0-100%)
 * - battery_low (boolean alert)
 *
 * Inspired by homebridge-z2m's BatteryCreator.
 */
export class BatterySensorConverter extends BaseSensorConverter {
	readonly type = 'battery-sensor';
	readonly propertyNames = ['battery'];
	readonly channelCategory = ChannelCategory.BATTERY;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (this.shouldSkipExpose(expose)) {
			return this.cannotHandle();
		}

		// Battery percentage is numeric
		if (expose.type === 'numeric' && this.matchesProperty(expose)) {
			return this.canHandleWith(ConverterPriority.SENSOR);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const numericExpose = expose as Z2mExposeNumeric;

		const properties: MappedProperty[] = [
			this.createProperty({
				identifier: 'percentage',
				name: 'Battery',
				category: PropertyCategory.PERCENTAGE,
				channelCategory: ChannelCategory.BATTERY,
				dataType: DataTypeType.UCHAR,
				z2mProperty: numericExpose.property ?? 'battery',
				access: numericExpose.access ?? Z2M_ACCESS.STATE,
				unit: '%',
				min: 0,
				max: 100,
				format: [0, 100],
			}),
		];

		// Add battery_low if available
		const batteryLowExpose = this.findBatteryLowExpose(context);
		if (batteryLowExpose && !context.mappedProperties.has('battery_low')) {
			properties.push(
				this.createProperty({
					identifier: 'fault',
					name: 'Battery Low',
					category: PropertyCategory.FAULT,
					channelCategory: ChannelCategory.BATTERY,
					dataType: DataTypeType.BOOL,
					z2mProperty: batteryLowExpose.property ?? 'battery_low',
					access: batteryLowExpose.access ?? Z2M_ACCESS.STATE,
				}),
			);
		}

		return [
			this.createChannel({
				identifier: 'battery',
				name: 'Battery',
				category: ChannelCategory.BATTERY,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
