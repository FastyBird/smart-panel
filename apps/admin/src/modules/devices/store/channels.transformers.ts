import { DevicesValidationException } from '../devices.exceptions';

import {
	ChannelCreateReqSchema,
	ChannelSchema,
	ChannelUpdateReqSchema,
	type IChannel,
	type IChannelCreateReq,
	type IChannelRes,
	type IChannelUpdateReq,
	type IChannelsAddActionPayload,
	type IChannelsEditActionPayload,
} from './channels.store.types';

export function transformChannelResponse(response: IChannelRes): IChannel {
	const parsedChannel = ChannelSchema.safeParse({
		id: response.id,
		device: response.device,
		category: response.category,
		name: response.name,
		description: response.description,
		controls: response.controls,
		properties: response.properties,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedChannel.success) {
		throw new DevicesValidationException('Failed to validate received channel data.');
	}

	return parsedChannel.data;
}

export function transformChannelCreateRequest(channel: IChannelsAddActionPayload['data'] & { id?: string; device: string }): IChannelCreateReq {
	const parsedRequest = ChannelCreateReqSchema.safeParse({
		id: channel.id,
		device: channel.device,
		category: channel.category,
		name: channel.name,
		description: channel.description,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate create channel request.');
	}

	return parsedRequest.data;
}

export function transformChannelUpdateRequest(channel: IChannelsEditActionPayload['data']): IChannelUpdateReq {
	const parsedRequest = ChannelUpdateReqSchema.safeParse({
		name: channel.name,
		description: channel.description,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate update channel request.');
	}

	return parsedRequest.data;
}
