import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigModuleSystemType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import { ConfigSystemSchema, ConfigSystemUpdateReqSchema } from './config-system.store.schemas';
import type { IConfigSystem, IConfigSystemEditActionPayload, IConfigSystemRes, IConfigSystemUpdateReq } from './config-system.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigSystemResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes | IConfigSystemRes
): IConfigSystem => {
	const parsed = ConfigSystemSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received system config data.');
	}

	return parsed.data;
};

export const transformConfigSystemUpdateRequest = (config: IConfigSystemEditActionPayload['data']): IConfigSystemUpdateReq => {
	const parsedRequest = ConfigSystemUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigModuleSystemType.system });

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update system config request.');
	}

	return parsedRequest.data;
};
