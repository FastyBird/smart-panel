import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTime_format, ConfigModuleLanguageType } from '../../../openapi';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';

import { useConfigLanguage } from './config-language.store';
import type { IConfigLanguageEditActionPayload, IConfigLanguageSetActionPayload } from './config-language.store.types';

const mockLanguageRes = {
	type: ConfigModuleLanguageType.language,
	language: ConfigModuleLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	time_format: ConfigModuleLanguageTime_format.Value24h,
};

const mockLanguage = {
	type: ConfigModuleLanguageType.language,
	language: ConfigModuleLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	timeFormat: ConfigModuleLanguageTime_format.Value24h,
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({
			client: backendClient,
		}),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
		getErrorReason: () => 'Some error',
	};
});

describe('ConfigLanguage Store', () => {
	let store: ReturnType<typeof useConfigLanguage>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useConfigLanguage();

		vi.clearAllMocks();
	});

	it('should set config language data successfully', () => {
		const result = store.set({ data: mockLanguage });

		expect(result).toEqual(mockLanguage);
		expect(store.data).toEqual(mockLanguage);
	});

	it('should throw validation error if set config language with invalid data', () => {
		expect(() => store.set({ data: { ...mockLanguage, language: 'invalid' } } as unknown as IConfigLanguageSetActionPayload)).toThrow(
			ConfigValidationException
		);
	});

	it('should fetch config language successfully', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockLanguageRes },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.get();

		expect(result).toEqual(mockLanguage);
		expect(store.data).toEqual(mockLanguage);
	});

	it('should throw error if fetch fails', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Network error'),
			response: { status: 500 },
		});

		await expect(store.get()).rejects.toThrow(ConfigApiException);
	});

	it('should update config language successfully', async () => {
		store.data = { ...mockLanguage };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: { data: { ...mockLanguageRes, language: ConfigModuleLanguageLanguage.cs_CZ } },
			error: undefined,
			response: { status: 200 },
		});

		const result = await store.edit({
			data: { ...mockLanguage, language: ConfigModuleLanguageLanguage.cs_CZ },
		});

		expect(result.language).toBe(ConfigModuleLanguageLanguage.cs_CZ);
		expect(store.data?.language).toBe(ConfigModuleLanguageLanguage.cs_CZ);
	});

	it('should throw validation error if edit payload is invalid', async () => {
		await expect(
			store.edit({
				data: { ...mockLanguage, language: 'not-a-language' },
			} as unknown as IConfigLanguageEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should throw validation error if local data + edit is invalid', async () => {
		store.data = { ...mockLanguage, language: ConfigModuleLanguageLanguage.cs_CZ };

		await expect(
			store.edit({
				data: { ...mockLanguage, language: undefined },
			} as unknown as IConfigLanguageEditActionPayload)
		).rejects.toThrow(ConfigValidationException);
	});

	it('should refresh data and throw if API update fails', async () => {
		store.data = { ...mockLanguage };

		(backendClient.PATCH as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Patch error'),
			response: { status: 500 },
		});

		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: mockLanguageRes },
			error: undefined,
			response: { status: 200 },
		});

		await expect(store.edit({ data: { ...mockLanguage, language: ConfigModuleLanguageLanguage.cs_CZ } })).rejects.toThrow(ConfigApiException);
	});
});
