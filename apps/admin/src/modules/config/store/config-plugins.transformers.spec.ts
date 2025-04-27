import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConfigValidationException } from '../config.exceptions';

import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from './config-plugins.store.schemas';
import type { IConfigPluginRes, IConfigPluginsEditActionPayload } from './config-plugins.store.types';
import { transformConfigPluginResponse, transformConfigPluginUpdateRequest } from './config-plugins.transformers';

const CustomPluginConfigSchema = ConfigPluginSchema.extend({
	mockValue: z.string(),
});

const CustomPluginConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		mock_value: z.string(),
	})
);

const validConfigPluginResponse: IConfigPluginRes = {
	type: 'custom-plugin',
	mock_value: 'Default value',
} as IConfigPluginRes;

const validConfigPluginUpdatePayload: IConfigPluginsEditActionPayload['data'] = {
	type: 'custom-plugin',
	mockValue: 'Default value',
} as IConfigPluginsEditActionPayload['data'];

describe('Config Plugin Transformers', (): void => {
	describe('transformConfigPluginResponse', (): void => {
		it('should transform a valid config plugin response', (): void => {
			const result = transformConfigPluginResponse(validConfigPluginResponse, CustomPluginConfigSchema);

			expect(result).toEqual({
				type: 'custom-plugin',
				mockValue: 'Default value',
			});
		});

		it('should throw an error for an invalid config plugin response', (): void => {
			expect(() =>
				transformConfigPluginResponse({ ...validConfigPluginResponse, mockValue: null } as unknown as IConfigPluginRes, CustomPluginConfigSchema)
			).toThrow(ConfigValidationException);
		});
	});

	describe('transformConfigPluginUpdateRequest', (): void => {
		it('should transform a valid config plugin update request', (): void => {
			const result = transformConfigPluginUpdateRequest(validConfigPluginUpdatePayload, CustomPluginConfigUpdateReqSchema);

			expect(result).toEqual({
				type: 'custom-plugin',
				mock_value: 'Default value',
			});
		});

		it('should throw an error for an invalid config plugin update request', (): void => {
			expect(() =>
				transformConfigPluginUpdateRequest(
					{
						...validConfigPluginUpdatePayload,
						mockValue: 100,
					} as unknown as IConfigPluginsEditActionPayload['data'],
					CustomPluginConfigUpdateReqSchema
				)
			).toThrow(ConfigValidationException);
		});
	});
});
