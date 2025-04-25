import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigModuleLanguageType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import { ConfigLanguageSchema, ConfigLanguageUpdateReqSchema } from './config-language.store.schemas';
import type { IConfigLanguage, IConfigLanguageEditActionPayload, IConfigLanguageRes, IConfigLanguageUpdateReq } from './config-language.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigLanguageResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigLanguage => {
	const parsed = ConfigLanguageSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received language config data.');
	}

	return parsed.data;
};

export const transformConfigLanguageUpdateRequest = (config: IConfigLanguageEditActionPayload['data']): IConfigLanguageUpdateReq => {
	const parsedRequest = ConfigLanguageUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigModuleLanguageType.language });

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update language config request.');
	}

	return parsedRequest.data;
};
