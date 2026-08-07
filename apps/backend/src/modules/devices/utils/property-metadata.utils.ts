import { ChannelPropertyEntity } from '../entities/devices.entity';

import { getPropertyMetadata } from './schema.utils';

export function resolvePropertyUnit(property: ChannelPropertyEntity): string | null {
	const channel = property.channel;

	if (!channel || typeof channel === 'string') {
		return null;
	}

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
