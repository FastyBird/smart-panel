import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTime_format, ConfigModuleDataLanguageType } from '../../../openapi';
import type { IConfigLanguage } from '../store/config-language.store.types';

import { useConfigLanguage } from './useConfigLanguage';

const mockLanguage: IConfigLanguage = {
	type: ConfigModuleDataLanguageType.language,
	language: ConfigModuleLanguageLanguage.en_US,
	timezone: 'Europe/Prague',
	timeFormat: ConfigModuleLanguageTime_format.Value24h,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigLanguage', () => {
	let get: Mock;

	let mockStore: {
		get: Mock;
		$id: string;
		data: Ref;
		semaphore: Ref;
	};

	beforeEach(() => {
		setActivePinia(createPinia());

		get = vi.fn();

		mockStore = {
			get,
			$id: 'configLanguage',
			data: ref(null),
			semaphore: ref({
				getting: false,
			}),
		};

		(injectStoresManager as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			getStore: () => mockStore,
		});
	});

	it('should return a config', () => {
		mockStore.data.value = mockLanguage;

		const { configLanguage } = useConfigLanguage();

		expect(configLanguage.value).toEqual(mockLanguage);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useConfigLanguage();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useConfigLanguage();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigLanguage and triggers store.get', async () => {
		const { fetchConfigLanguage } = useConfigLanguage();

		await fetchConfigLanguage();

		expect(get).toHaveBeenCalled();
	});
});
