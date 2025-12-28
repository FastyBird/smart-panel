import { ChannelCategory, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import {
	Z2mExpose,
	Z2mExposeBinary,
	Z2mExposeEnum,
	Z2mExposeNumeric,
	Z2mExposeSpecific,
} from '../../interfaces/zigbee2mqtt.interface';
import { BaseConverter } from '../base.converter';
import {
	CanHandleResult,
	ConversionContext,
	ConverterPriority,
	IDeviceConverter,
	MappedChannel,
	MappedProperty,
} from '../converter.interface';

/**
 * Fan Converter
 *
 * Handles Z2M 'fan' specific exposes with features like:
 * - state (on/off)
 * - fan_mode (low/medium/high/auto)
 * - fan_speed (0-100% or discrete levels)
 */
export class FanConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'fan';
	readonly exposeType = 'fan' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'fan') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, _context: ConversionContext): MappedChannel[] {
		const fanExpose = expose as Z2mExposeSpecific;
		const features = fanExpose.features || [];
		const endpoint = fanExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Process each feature
		for (const feature of features) {
			const propertyName = this.getPropertyName(feature);
			if (!propertyName) continue;

			switch (propertyName) {
				case 'state':
				case 'fan_state':
					if (feature.type === 'binary') {
						properties.push(this.convertState(feature));
					}
					break;
				case 'fan_mode':
				case 'mode':
					if (feature.type === 'enum') {
						properties.push(this.convertFanMode(feature));
					}
					break;
				case 'fan_speed':
				case 'speed':
					if (feature.type === 'numeric') {
						properties.push(this.convertFanSpeed(feature));
					}
					break;
			}
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('fan', endpoint),
				name: this.formatChannelName('Fan', endpoint),
				category: ChannelCategory.FAN,
				endpoint,
				properties,
			}),
		];
	}

	private convertState(feature: Z2mExpose): MappedProperty {
		const binaryFeature = feature as Z2mExposeBinary;
		const format = this.extractBinaryFormat(binaryFeature);

		return this.createProperty({
			identifier: 'on',
			name: 'State',
			category: PropertyCategory.ON,
			channelCategory: ChannelCategory.FAN,
			dataType: this.getDataType(ChannelCategory.FAN, PropertyCategory.ON, feature),
			z2mProperty: binaryFeature.property ?? 'state',
			access: binaryFeature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format,
		});
	}

	private convertFanMode(feature: Z2mExpose): MappedProperty {
		const enumFeature = feature as Z2mExposeEnum;
		const values = enumFeature.values || [];

		return this.createProperty({
			identifier: 'mode',
			name: 'Fan Mode',
			category: PropertyCategory.MODE,
			channelCategory: ChannelCategory.FAN,
			dataType: this.getDataType(ChannelCategory.FAN, PropertyCategory.MODE, feature),
			z2mProperty: enumFeature.property ?? 'fan_mode',
			access: enumFeature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format: values,
		});
	}

	private convertFanSpeed(feature: Z2mExpose): MappedProperty {
		const numericFeature = feature as Z2mExposeNumeric;
		const min = numericFeature.value_min ?? 0;
		const max = numericFeature.value_max ?? 100;

		return this.createProperty({
			identifier: 'speed',
			name: 'Fan Speed',
			category: PropertyCategory.SPEED,
			channelCategory: ChannelCategory.FAN,
			dataType: this.getDataType(ChannelCategory.FAN, PropertyCategory.SPEED, feature),
			z2mProperty: numericFeature.property ?? 'fan_speed',
			access: numericFeature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			unit: '%',
			min,
			max,
			format: [min, max],
			step: numericFeature.value_step,
		});
	}
}
