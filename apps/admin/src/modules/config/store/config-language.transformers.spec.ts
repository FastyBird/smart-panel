import { describe, expect, it } from 'vitest';

import { ConfigLanguageLanguage, ConfigLanguageTime_format, ConfigLanguageType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigLanguageEditActionPayload, IConfigLanguageRes } from './config-language.store.types';
import { transformConfigLanguageResponse, transformConfigLanguageUpdateRequest } from './config-language.transformers';

const validConfigLanguageResponse: IConfigLanguageRes = {
	type: ConfigLanguageType.language,
	language: ConfigLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	time_format: ConfigLanguageTime_format.Value24h,
};

const validConfigLanguageUpdatePayload: IConfigLanguageEditActionPayload['data'] = {
	language: ConfigLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	timeFormat: ConfigLanguageTime_format.Value24h,
};

describe('Config Language Transformers', (): void => {
	describe('transformConfigLanguageResponse', (): void => {
		it('should transform a valid config language response', (): void => {
			const result = transformConfigLanguageResponse(validConfigLanguageResponse);

			expect(result).toEqual({
				type: ConfigLanguageType.language,
				language: ConfigLanguageLanguage.en_US,
				timezone: 'Europe/Prague',
				timeFormat: ConfigLanguageTime_format.Value24h,
			});
		});

		it('should throw an error for an invalid config language response', (): void => {
			expect(() => transformConfigLanguageResponse({ ...validConfigLanguageResponse, timeFormat: null } as unknown as IConfigLanguageRes)).toThrow(
				ConfigValidationException
			);
		});
	});

	describe('transformConfigLanguageUpdateRequest', (): void => {
		it('should transform a valid config language update request', (): void => {
			const result = transformConfigLanguageUpdateRequest(validConfigLanguageUpdatePayload);

			expect(result).toEqual({
				type: ConfigLanguageType.language,
				language: ConfigLanguageLanguage.en_US,
				timezone: 'Europe/Prague',
				time_format: ConfigLanguageTime_format.Value24h,
			});
		});

		it('should throw an error for an invalid config language update request', (): void => {
			expect(() =>
				transformConfigLanguageUpdateRequest({
					...validConfigLanguageUpdatePayload,
					language: 'de_DE',
				} as unknown as IConfigLanguageEditActionPayload['data'])
			).toThrow(ConfigValidationException);
		});
	});
});
