import { describe, expect, it, vi } from 'vitest';

import { ConfigModuleDisplayType } from '../../../openapi.constants';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigDisplayEditActionPayload, IConfigDisplayRes } from './config-display.store.types';
import { transformConfigDisplayResponse, transformConfigDisplayUpdateRequest } from './config-display.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const validConfigDisplayResponse: IConfigDisplayRes = {
	type: ConfigModuleDisplayType.display,
	dark_mode: true,
	brightness: 80,
	screen_lock_duration: 300,
	screen_saver: true,
};

const validConfigDisplayUpdatePayload: IConfigDisplayEditActionPayload['data'] = {
	darkMode: true,
	brightness: 80,
	screenLockDuration: 300,
	screenSaver: true,
};

describe('Config Display Transformers', (): void => {
	describe('transformConfigDisplayResponse', (): void => {
		it('should transform a valid config display response', (): void => {
			const result = transformConfigDisplayResponse(validConfigDisplayResponse);

			expect(result).toEqual({
				type: ConfigModuleDisplayType.display,
				darkMode: true,
				brightness: 80,
				screenLockDuration: 300,
				screenSaver: true,
			});
		});

		it('should throw an error for an invalid config display response', (): void => {
			expect(() => transformConfigDisplayResponse({ ...validConfigDisplayResponse, darkMode: null } as unknown as IConfigDisplayRes)).toThrow(
				ConfigValidationException
			);
		});
	});

	describe('transformConfigDisplayUpdateRequest', (): void => {
		it('should transform a valid config display update request', (): void => {
			const result = transformConfigDisplayUpdateRequest(validConfigDisplayUpdatePayload);

			expect(result).toEqual({
				type: ConfigModuleDisplayType.display,
				dark_mode: true,
				brightness: 80,
				screen_lock_duration: 300,
				screen_saver: true,
			});
		});

		it('should throw an error for an invalid config display update request', (): void => {
			expect(() =>
				transformConfigDisplayUpdateRequest({
					...validConfigDisplayUpdatePayload,
					brightness: 200,
				} as unknown as IConfigDisplayEditActionPayload['data'])
			).toThrow(ConfigValidationException);
		});
	});
});
