import { DevicesValidationException } from '../devices.exceptions';

import { ChannelControlCreateReqSchema, ChannelControlSchema } from './channels.controls.store.schemas';
import type {
	IChannelControl,
	IChannelControlCreateReq,
	IChannelControlRes,
	IChannelsControlsAddActionPayload,
} from './channels.controls.store.types';

export const transformChannelControlResponse = (response: IChannelControlRes): IChannelControl => {
	const parsedChannelControl = ChannelControlSchema.safeParse({
		id: response.id,
		channel: response.channel,
		name: response.name,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedChannelControl.success) {
		console.error('Schema validation failed with:', parsedChannelControl.error);

		throw new DevicesValidationException('Failed to validate received channel control data.');
	}

	return parsedChannelControl.data;
};

export const transformChannelControlCreateRequest = (
	control: IChannelsControlsAddActionPayload['data'] & { id?: string; channel: string }
): IChannelControlCreateReq => {
	const parsedRequest = ChannelControlCreateReqSchema.safeParse({
		id: control.id,
		channel: control.channel,
		name: control.name,
	});

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new DevicesValidationException('Failed to validate create channel control request.');
	}

	return parsedRequest.data;
};
