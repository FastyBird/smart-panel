import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { ConfigModuleAudioType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import { ConfigAudioSchema, ConfigAudioUpdateReqSchema } from './config-audio.store.schemas';
import type { IConfigAudio, IConfigAudioEditActionPayload, IConfigAudioRes, IConfigAudioUpdateReq } from './config-audio.store.types';
import type { IConfigDisplayRes } from './config-display.store.types';
import type { IConfigLanguageRes } from './config-language.store.types';
import type { IConfigSystemRes } from './config-system.store.types';
import type { IConfigWeatherRes } from './config-weather.store.types';

export const transformConfigAudioResponse = (
	response: IConfigAudioRes | IConfigDisplayRes | IConfigLanguageRes | IConfigWeatherRes | IConfigSystemRes
): IConfigAudio => {
	const parsed = ConfigAudioSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new ConfigValidationException('Failed to validate received audio config data.');
	}

	return parsed.data;
};

export const transformConfigAudioUpdateRequest = (config: IConfigAudioEditActionPayload['data']): IConfigAudioUpdateReq => {
	const parsedRequest = ConfigAudioUpdateReqSchema.safeParse({ ...camelToSnake(config), type: ConfigModuleAudioType.audio });

	if (!parsedRequest.success) {
		logger.error('Schema validation failed with:', parsedRequest.error);

		throw new ConfigValidationException('Failed to validate update audio config request.');
	}

	return parsedRequest.data;
};
