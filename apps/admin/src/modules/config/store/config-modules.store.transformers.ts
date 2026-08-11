import type { ZodType } from 'zod';

import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigModule, IConfigModuleRes, IConfigModuleUpdateReq, IConfigModulesEditActionPayload } from './config-modules.store.types';

export const transformConfigModuleResponse = <T extends IConfigModule = IConfigModule>(response: IConfigModuleRes, schema: ZodType<T>): T => {
	const parsedResponse = schema.safeParse(snakeToCamel(response));

	if (!parsedResponse.success) {
		logger.error('Schema validation failed with:', parsedResponse.error);

		throw new ConfigValidationException('Failed to validate received module config data.');
	}

	return parsedResponse.data;
};

export const transformConfigModuleUpdateRequest = <T extends IConfigModuleUpdateReq = IConfigModuleUpdateReq>(
	config: IConfigModulesEditActionPayload['data'],
	schema: ZodType<T>
): T => {
	const parsedRequest = schema.safeParse(camelToSnake(config));

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update module config request.');
	}

	return parsedRequest.data;
};
