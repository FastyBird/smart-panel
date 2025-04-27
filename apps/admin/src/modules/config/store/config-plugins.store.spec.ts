import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { IPlugin } from '../../../common';
import { CONFIG_MODULE_NAME } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';

import { useConfigPlugin } from './config-plugins.store';
import { ConfigPluginSchema, ConfigPluginUpdateReqSchema } from './config-plugins.store.schemas';
import type { IConfigPlugin, IConfigPluginsEditActionPayload, IConfigPluginsSetActionPayload } from './config-plugins.store.types';

const CustomPluginConfigSchema = ConfigPluginSchema.extend({
	mockValue: z.string(),
});

type ICustomPluginConfig = z.infer<typeof CustomPluginConfigSchema>;

const CustomPluginConfigUpdateReqSchema = ConfigPluginUpdateReqSchema.and(
	z.object({
		mock_value: z.string(),
	})
);

const mockPluginRes = {
	type: 'custom-plugin',
	mockValue: 'default value',
};

const mockPlugin = {
	type: 'custom-plugin',
	mockValue: 'default value',
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

const mockGetPlugins = vi.fn().mockReturnValue([
	{
		type: 'custom-plugin',
		modules: [CONFIG_MODULE_NAME],
		schemas: {
			pluginConfigSchema: CustomPluginConfigSchema,
			pluginConfigUpdateReqSchema: CustomPluginConfigUpdateReqSchema,
		},
	} as unknown as IPlugin<IPluginsComponents, IPluginsSchemas>,
]);

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		getErrorReason: vi.fn(() => 'Some error'),
		injectPluginsManager: vi.fn(() => ({
			getPlugins: mockGetPlugins,
		})),
	};
});

describe('ConfigPlugin Store', () => {
	let store: ReturnType<typeof useConfigPlugin>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigPlugin();

		vi.clearAllMocks();
	});

	it('should set config Plugin data successfully', () => {
		const result = store.set({ data: mockPlugin });

		expect(result).toEqual(mockPlugin);
		expect(store.data).toEqual({ [mockPlugin.type]: mockPlugin });
	});

	it('should throw validation error if set config Plugin with invalid data', () => {
		expect(() => store.set({ data: { ...mockPlugin, mockValue: 0 } } as unknown as IConfigPluginsSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config Plugin successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockPluginRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get({ type: 'custom-plugin' });

		expect(result).toEqual(mockPlugin);

		const pluginConfig = store.data[mockPlugin.type] as ICustomPluginConfig;

		expect(pluginConfig).toEqual(mockPlugin);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get({ type: 'custom-plugin' })).rejects.toThrow(ConfigApiException);
	});

	it('should update config Plugin successfully', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockPluginRes, mockValue: 'Updated value' } },
			error: undefined,
			response: { status: 200 },
		});

		const result = (await store.edit({
			data: { ...mockPlugin, mockValue: 'Updated value' },
		} as IConfigPluginsEditActionPayload)) as ICustomPluginConfig;

		expect(result.mockValue).toBe('Updated value');

		const pluginConfig = store.data[mockPlugin.type] as ICustomPluginConfig;

		expect(pluginConfig.mockValue).toBe('Updated value');
	});

	it('should throw validation error if edit payload is invalid', async () => {
		store.data = { [mockPlugin.type]: mockPlugin };

		await expect(
			store.edit({
				data: { ...mockPlugin, mockValue: 100 },
			} as unknown as IConfigPluginsEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin, mockValue: 'Updated value' } as IConfigPlugin };

		await expect(
			store.edit({
				data: { ...mockPlugin, mockValue: 100 },
			} as unknown as IConfigPluginsEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { [mockPlugin.type]: { ...mockPlugin } };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockPluginRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockPlugin, mockValue: 'Updated value' } } as IConfigPluginsEditActionPayload)).rejects.toThrow(
			ConfigApiException
		);
	});
});
