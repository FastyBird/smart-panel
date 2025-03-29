import { DevicesValidationException } from '../devices.exceptions';

import {
	ChannelControlCreateReqSchema,
	ChannelControlSchema,
	type IChannelControl,
	type IChannelControlCreateReq,
	type IChannelControlRes,
	type IChannelsControlsAddActionPayload,
} from './channels.controls.store.types';

export function transformChannelControlResponse(response: IChannelControlRes): IChannelControl {
	const parsedChannelControl = ChannelControlSchema.safeParse({
		id: response.id,
		channel: response.channel,
		name: response.name,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedChannelControl.success) {
		throw new DevicesValidationException('Failed to validate received channel control data.');
	}

	return parsedChannelControl.data;
}

export function transformChannelControlCreateRequest(
	control: IChannelsControlsAddActionPayload['data'] & { id?: string; channel: string }
): IChannelControlCreateReq {
	const parsedRequest = ChannelControlCreateReqSchema.safeParse({
		id: control.id,
		channel: control.channel,
		name: control.name,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate create channel control request.');
	}

	return parsedRequest.data;
}
