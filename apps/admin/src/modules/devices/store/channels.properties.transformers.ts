import { DevicesValidationException } from '../devices.exceptions';

import {
	ChannelPropertyCreateReqSchema,
	ChannelPropertySchema,
	ChannelPropertyUpdateReqSchema,
	type IChannelProperty,
	type IChannelPropertyCreateReq,
	type IChannelPropertyRes,
	type IChannelPropertyUpdateReq,
	type IChannelsPropertiesAddActionPayload,
	type IChannelsPropertiesEditActionPayload,
} from './channels.properties.store.types';

export const transformChannelPropertyResponse = (response: IChannelPropertyRes): IChannelProperty => {
	const parsedProperty = ChannelPropertySchema.safeParse({
		id: response.id,
		channel: response.channel,
		category: response.category,
		name: response.name,
		permissions: response.permissions,
		dataType: response.data_type,
		unit: response.unit,
		format: response.format,
		invalid: response.invalid,
		step: response.step,
		value: response.value,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedProperty.success) {
		throw new DevicesValidationException('Failed to validate received channel property data.');
	}

	return parsedProperty.data;
};

export const transformChannelPropertyCreateRequest = (
	property: IChannelsPropertiesAddActionPayload['data'] & { id?: string; channel: string }
): IChannelPropertyCreateReq => {
	const parsedRequest = ChannelPropertyCreateReqSchema.safeParse({
		id: property.id,
		category: property.category,
		name: property.name,
		permissions: property.permissions,
		data_type: property.dataType,
		unit: property.unit,
		format: property.format,
		invalid: property.invalid,
		step: property.step,
		value: property.value,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate create channel property request.');
	}

	return parsedRequest.data;
};

export const transformChannelPropertyUpdateRequest = (property: IChannelsPropertiesEditActionPayload['data']): IChannelPropertyUpdateReq => {
	const parsedRequest = ChannelPropertyUpdateReqSchema.safeParse({
		name: property.name,
		unit: property.unit,
		format: property.format,
		invalid: property.invalid,
		step: property.step,
		value: property.value,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate update channel property request.');
	}

	return parsedRequest.data;
};
