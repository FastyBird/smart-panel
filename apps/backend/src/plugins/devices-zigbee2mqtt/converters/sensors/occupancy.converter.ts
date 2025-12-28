import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2mExpose, Z2mExposeBinary, Z2mExposeNumeric } from '../../interfaces/zigbee2mqtt.interface';
import { CanHandleResult, ConversionContext, ConverterPriority, MappedChannel, MappedProperty } from '../converter.interface';

import { BaseSensorConverter } from './base-sensor.converter';

/**
 * Occupancy/Presence Sensor Converter
 *
 * Handles occupancy and presence sensors with properties like:
 * - occupancy (boolean)
 * - presence (boolean)
 * - target_distance (for radar sensors)
 *
 * Inspired by homebridge-z2m's OccupancySensorHandler.
 */
export class OccupancySensorConverter extends BaseSensorConverter {
	readonly type = 'occupancy-sensor';
	readonly propertyNames = ['occupancy', 'presence', 'motion'];
	readonly channelCategory = ChannelCategory.OCCUPANCY;

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
		const propertyName = this.getPropertyName(expose) ?? 'occupancy';

		const properties: MappedProperty[] = [
			this.createBinarySensorProperty(binaryExpose, {
				identifier: 'detected',
				name: this.formatName(propertyName),
				category: PropertyCategory.DETECTED,
			}),
		];

		// Add target_distance if available (for radar sensors)
		const distanceExpose = context.allExposes.find(
			(e) => e.type === 'numeric' && (e.property === 'target_distance' || e.property === 'distance'),
		) as Z2mExposeNumeric | undefined;

		if (distanceExpose && !context.mappedProperties.has(distanceExpose.property ?? 'distance')) {
			properties.push(
				this.createNumericSensorProperty(distanceExpose, {
					identifier: 'distance',
					name: 'Distance',
					category: PropertyCategory.DISTANCE,
					unit: 'm',
				}),
			);
		}

		this.addOptionalCharacteristics(properties, context);

		return [
			this.createChannel({
				identifier: 'occupancy',
				name: 'Occupancy',
				category: ChannelCategory.OCCUPANCY,
				endpoint: expose.endpoint,
				properties,
			}),
		];
	}
}
