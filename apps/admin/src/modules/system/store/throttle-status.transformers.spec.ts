import { describe, expect, it } from 'vitest';

import { SystemValidationException } from '../system.exceptions';

import type { IThrottleStatusRes } from './throttle-status.store.types';
import { transformThrottleStatusResponse } from './throttle-status.transformers';

const validConfigWeatherResponse: IThrottleStatusRes = {
	undervoltage: false,
	frequency_capping: false,
	throttling: false,
	soft_temp_limit: false,
};

describe('System Info Transformers', (): void => {
	describe('transformThrottleStatusResponse', (): void => {
		it('should transform a valid throttle status response', (): void => {
			const result = transformThrottleStatusResponse(validConfigWeatherResponse);

			expect(result).toEqual({
				undervoltage: false,
				frequencyCapping: false,
				throttling: false,
				softTempLimit: false,
			});
		});

		it('should throw an error for an invalid throttle status response', (): void => {
			expect(() =>
				transformThrottleStatusResponse({ ...validConfigWeatherResponse, undervoltage: 'not-a-boolean' } as unknown as IThrottleStatusRes)
			).toThrow(SystemValidationException);
		});
	});
});
