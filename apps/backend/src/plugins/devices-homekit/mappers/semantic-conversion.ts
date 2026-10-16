import { DataTypeType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

import { communicationFailure } from './property-read';

/** Exact canonical enum members only; never coerce numeric strings or guess unknown states. */
export function enumToHap(
	property: ChannelPropertyEntity,
	value: unknown,
	values: Readonly<Record<string, number>>,
): number {
	if (
		property.dataType !== DataTypeType.ENUM ||
		typeof value !== 'string' ||
		!Array.isArray(property.format) ||
		!property.format.includes(value as never) ||
		!Object.hasOwn(values, value)
	)
		throw communicationFailure();
	return values[value];
}
