import { describe, expect, it, vi } from 'vitest';

import { ConfigModuleSystemLog_levels, ConfigModuleSystemType } from '../../../openapi';
import { ConfigValidationException } from '../config.exceptions';

import type { IConfigSystemEditActionPayload, IConfigSystemRes } from './config-system.store.types';
import { transformConfigSystemResponse, transformConfigSystemUpdateRequest } from './config-system.transformers';

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

const validConfigSystemResponse: IConfigSystemRes = {
	type: ConfigModuleSystemType.system,
	log_levels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn],
};

const validConfigSystemUpdatePayload: IConfigSystemEditActionPayload['data'] = {
	logLevels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn],
};

describe('Config System Transformers', (): void => {
	describe('transformConfigSystemResponse', (): void => {
		it('should transform a valid config system response', (): void => {
			const result = transformConfigSystemResponse(validConfigSystemResponse);

			expect(result).toEqual({
				type: ConfigModuleSystemType.system,
				logLevels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn],
			});
		});

		it('should throw an error for an invalid config system response', (): void => {
			expect(() => transformConfigSystemResponse({ ...validConfigSystemResponse, logLevels: null } as unknown as IConfigSystemRes)).toThrow(
				ConfigValidationException
			);
		});
	});

	describe('transformConfigSystemUpdateRequest', (): void => {
		it('should transform a valid config system update request', (): void => {
			const result = transformConfigSystemUpdateRequest(validConfigSystemUpdatePayload);

			expect(result).toEqual({
				type: ConfigModuleSystemType.system,
				log_levels: [ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.warn],
			});
		});

		it('should throw an error for an invalid config system update request', (): void => {
			expect(() =>
				transformConfigSystemUpdateRequest({
					...validConfigSystemUpdatePayload,
					logLevels: ['unknown_level'],
				} as unknown as IConfigSystemEditActionPayload['data'])
			).toThrow(ConfigValidationException);
		});
	});
});
