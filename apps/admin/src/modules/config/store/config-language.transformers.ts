import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigLanguageType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import {
	ConfigLanguageSchema,
	ConfigLanguageUpdateReqSchema,
	type IConfigLanguage,
	type IConfigLanguageEditActionPayload,
	type IConfigLanguageRes,
	type IConfigLanguageUpdateReq,
} from './config-language.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigLanguageResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigLanguage => {
	const parsed = ConfigLanguageSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new ConfigValidationException('Failed to validate received language config data.');
	}

	return parsed.data;
};

export const transformConfigLanguageUpdateRequest = (config: IConfigLanguageEditActionPayload['data']): IConfigLanguageUpdateReq => {
	const parsedRequest = ConfigLanguageUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigLanguageType.language });

	if (!parsedRequest.success) {
		throw new ConfigValidationException('Failed to validate update language config request.');
	}

	return parsedRequest.data;
};
