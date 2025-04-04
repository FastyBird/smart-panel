import { camelToSnake, snakeToCamel } from '../../../common';
import { ConfigAudioType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import {
	ConfigAudioSchema,
	ConfigAudioUpdateReqSchema,
	type IConfigAudio,
	type IConfigAudioEditActionPayload,
	type IConfigAudioRes,
	type IConfigAudioUpdateReq,
} from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigAudioResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes
): IConfigAudio => {
	const parsed = ConfigAudioSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		throw new ConfigValidationException('Failed to validate received audio config data.');
	}

	return parsed.data;
};

export const transformConfigAudioUpdateRequest = (config: IConfigAudioEditActionPayload['data']): IConfigAudioUpdateReq => {
	const parsedRequest = ConfigAudioUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigAudioType.audio });

	if (!parsedRequest.success) {
		throw new ConfigValidationException('Failed to validate update audio config request.');
	}

	return parsedRequest.data;
};
