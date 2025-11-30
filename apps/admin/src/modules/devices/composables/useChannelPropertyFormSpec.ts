import { type DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../openapi.constants';
import { DevicesException } from '../devices.exceptions';
import { type ChannelPropertySpec, getChannelPropertySpecification } from '../devices.mapping';

import type { IUseChannelPropertyFormSpec } from './types';

interface IUseChannelPropertyFormSpecProps {
	channel: DevicesModuleChannelCategory;
	property: DevicesModuleChannelPropertyCategory;
	field: keyof ChannelPropertySpec;
}

export const useChannelPropertyFormSpec = <TValue>({
	channel,
	property,
	field,
}: IUseChannelPropertyFormSpecProps): IUseChannelPropertyFormSpec<TValue> => {
	const propertySpec = getChannelPropertySpecification(channel, property);

	if (['category', 'required', 'description'].includes(field)) {
		throw new DevicesException('Wrong field type provided');
	}

	return {
		required: propertySpec?.required ?? false,
		description: propertySpec?.description,
		value: (propertySpec && field in propertySpec ? propertySpec[field] : undefined) as TValue,
	};
};
