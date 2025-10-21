import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigValidationException } from '../config.exceptions';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from './config-plugins.store.schemas';
import type { IConfigPlugin, IConfigPluginRes, IConfigPluginUpdateReq, IConfigPluginsEditActionPayload } from './config-plugins.store.types';

export const transformConfigPluginResponse = <T extends IConfigPlugin = IConfigPlugin>(
	response: IConfigPluginRes,
	schema: typeof ConfigPluginSchema
): T => {
	const parsedResponse = schema.safeParse(snakeToCamel(response));

	if (!parsedResponse.success) {
		logger.error('Schema validation failed with:', parsedResponse.error);

		throw new ConfigValidationException('Failed to validate received plugin config data.');
	}

	return parsedResponse.data as T;
};

export const transformConfigPluginUpdateRequest = <T extends IConfigPluginUpdateReq = IConfigPluginUpdateReq>(
	config: IConfigPluginsEditActionPayload['data'],
	schema: typeof ConfigPluginUpdateReqSchema
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(config));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update plugin config request.');
	}

	return parsedRequest.data as T;
};
