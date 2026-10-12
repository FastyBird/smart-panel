import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DevicesValidationException } from '../devices.exceptions';

import { ChannelCreateReqSchema, ChannelSchema, ChannelUpdateReqSchema } from './channels.store.schemas';
import type {
	IChannel,
	IChannelCreateReq,
	IChannelRes,
	IChannelUpdateReq,
	IChannelsAddActionPayload,
	IChannelsEditActionPayload,
} from './channels.store.types';

export const transformChannelResponse = <T extends IChannel = IChannel>(response: IChannelRes, schema: typeof ChannelSchema): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate received channel data.');
	}

	return parsed.data as T;
};

export const transformChannelCreateRequest = <T extends IChannelCreateReq = IChannelCreateReq>(
	data: IChannelsAddActionPayload['data'],
	schema: typeof ChannelCreateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate create channel request.');
	}

	return parsed.data as T;
};

export const transformChannelUpdateRequest = <T extends IChannelUpdateReq = IChannelUpdateReq>(
	data: IChannelsEditActionPayload['data'],
	schema: typeof ChannelUpdateReqSchema
): T => {
	const supplied = camelToSnake(data);
	const parsed = schema.safeParse(supplied);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate update channel request.');
	}

	// Request schemas may supply defaults. PATCH must preserve the caller's omissions.
	return Object.fromEntries(Object.entries(parsed.data).filter(([key]) => Object.hasOwn(supplied, key) && supplied[key] !== undefined)) as T;
};
