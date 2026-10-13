import { ChannelCategory, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { getPropertyMetadata } from './schema.utils';

export function resolvePropertyUnit(property: ChannelPropertyEntity): string | null {
	const channel = property.channel;

	if (!channel || typeof channel === 'string') {
		return null;
	}
	// The adopted Shelly voltmeter has a dynamic UNIT property; its fingerprinted channel
	// fixes the raw VALUE semantics so configuration and runtime agree on physical volts.
	if (
		channel.category === ChannelCategory.ANALOG_INPUT &&
		property.category === PropertyCategory.VALUE &&
		property.identifier === 'voltage' &&
		/^raw-voltage:voltmeter:\d+:[a-f0-9]{64}$/.test(channel.identifier ?? '')
	)
		return 'V';

	const metadata = getPropertyMetadata(channel.category, property.category);

	if (!metadata) {
		return null;
	}
	if (metadata.hasMultipleDataTypes && metadata.dataTypeVariants) {
		const matchingVariant = metadata.dataTypeVariants.find((variant) => variant.data_type === property.dataType);

		if (matchingVariant) {
			return matchingVariant.unit;
		}
	}

	return metadata.unit;
}
