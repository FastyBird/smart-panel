import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../../modules/devices/devices.constants';
import { Z2M_ACCESS } from '../../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeBinary, Z2mExposeSpecific } from '../../interfaces/zigbee2mqtt.interface';
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
 * Switch Converter
 *
 * Handles Z2M 'switch' specific exposes with features like:
 * - state (on/off with various value representations)
 *
 * Supports multi-endpoint switches (e.g., dual relay devices)
 */
export class SwitchConverter extends BaseConverter implements IDeviceConverter {
	readonly type = 'switch';
	readonly exposeType = 'switch' as const;

	canHandle(expose: Z2mExpose): CanHandleResult {
		if (expose.type === 'switch') {
			return this.canHandleWith(ConverterPriority.DEVICE);
		}
		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const switchExpose = expose as Z2mExposeSpecific;
		const features = switchExpose.features || [];
		const endpoint = switchExpose.endpoint;

		const properties: MappedProperty[] = [];

		// Find the state feature
		const stateFeature = features.find(
			(f) => f.property === 'state' || f.name === 'state',
		) as Z2mExposeBinary | undefined;

		if (stateFeature) {
			properties.push(this.convertState(stateFeature));
		}

		if (properties.length === 0) {
			return [];
		}

		return [
			this.createChannel({
				identifier: this.createChannelIdentifier('switcher', endpoint),
				name: this.formatChannelName('Switch', endpoint),
				category: ChannelCategory.SWITCHER,
				endpoint,
				properties,
			}),
		];
	}

	private convertState(feature: Z2mExposeBinary): MappedProperty {
		// Extract format for string-based on/off values
		const format = this.extractBinaryFormat(feature);

		return this.createProperty({
			identifier: 'on',
			name: 'State',
			category: PropertyCategory.ON,
			channelCategory: ChannelCategory.SWITCHER,
			dataType: DataTypeType.BOOL,
			z2mProperty: feature.property ?? 'state',
			access: feature.access ?? Z2M_ACCESS.STATE | Z2M_ACCESS.SET,
			format,
		});
	}
}
