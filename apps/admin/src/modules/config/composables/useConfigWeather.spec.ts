import { type Ref, ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectStoresManager } from '../../../common';
import { ConfigWeatherType, ConfigWeatherUnit, PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type } from '../../../openapi';
import type { IConfigWeather } from '../store/config-weather.store.types';

import { useConfigWeather } from './useConfigWeather';

const mockWeather: IConfigWeather = {
	type: ConfigWeatherType.weather,
	location: 'Prague',
	locationType: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.city_name,
	unit: ConfigWeatherUnit.celsius,
	openWeatherApiKey: null,
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
	};
});

describe('useConfigWeather', () => {
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
			$id: 'configWeather',
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
		mockStore.data.value = mockWeather;

		const { configWeather } = useConfigWeather();

		expect(configWeather.value).toEqual(mockWeather);
	});

	it('returns isLoading true if data is null and getting is true', () => {
		mockStore.semaphore.value.getting = true;

		const { isLoading } = useConfigWeather();

		expect(isLoading.value).toBe(true);
	});

	it('returns isLoading false if data is present', () => {
		mockStore.semaphore.value.getting = false;

		const { isLoading } = useConfigWeather();

		expect(isLoading.value).toBe(false);
	});

	it('calls fetchConfigWeather and triggers store.get', async () => {
		const { fetchConfigWeather } = useConfigWeather();

		await fetchConfigWeather();

		expect(get).toHaveBeenCalled();
	});
});
