import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DevicesValidationException } from '../devices.exceptions';

import { ChannelPropertyCreateReqSchema, ChannelPropertySchema, ChannelPropertyUpdateReqSchema } from './channels.properties.store.schemas';
import type {
	IChannelProperty,
	IChannelPropertyCreateReq,
	IChannelPropertyRes,
	IChannelPropertyUpdateReq,
	IChannelsPropertiesAddActionPayload,
	IChannelsPropertiesEditActionPayload,
} from './channels.properties.store.types';

export const transformChannelPropertyResponse = <T extends IChannelProperty = IChannelProperty>(
	response: IChannelPropertyRes,
	schema: typeof ChannelPropertySchema
): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate received channel property data.');
	}

	return parsed.data as T;
};

export const transformChannelPropertyCreateRequest = <T extends IChannelPropertyCreateReq = IChannelPropertyCreateReq>(
	data: IChannelsPropertiesAddActionPayload['data'],
	schema: typeof ChannelPropertyCreateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate create channel property request.');
	}

	return parsed.data as T;
};

export const transformChannelPropertyUpdateRequest = <T extends IChannelPropertyUpdateReq = IChannelPropertyUpdateReq>(
	data: IChannelsPropertiesEditActionPayload['data'],
	schema: typeof ChannelPropertyUpdateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate update channel property request.');
	}

	return parsed.data as T;
};
