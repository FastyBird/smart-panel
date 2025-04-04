import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigDisplayType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigAudioRes } from './config-audio.store.types';
import {
	ConfigDisplaySchema,
	ConfigDisplayUpdateReqSchema,
	type IConfigDisplay,
	type IConfigDisplayEditActionPayload,
	type IConfigDisplayRes,
	type IConfigDisplayUpdateReq,
} from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigDisplayResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigDisplay => {
	const parsed = ConfigDisplaySchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new ConfigValidationException('Failed to validate received display config data.');
	}

	return parsed.data;
};

export const transformConfigDisplayUpdateRequest = (config: IConfigDisplayEditActionPayload['data']): IConfigDisplayUpdateReq => {
	const parsedRequest = ConfigDisplayUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigDisplayType.display });

	if (!parsedRequest.success) {
		throw new ConfigValidationException('Failed to validate update display config request.');
	}

	return parsedRequest.data;
};
