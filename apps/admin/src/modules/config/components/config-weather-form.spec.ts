import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigModuleWeatherCityNameLocation_type, ConfigModuleWeatherType, ConfigModuleWeatherUnit } from '../../../openapi';
import type { IConfigWeatherEditForm } from '../composables/types';
import { FormResult, Layout } from '../config.constants';
import type { ConfigWeatherStore } from '../store/config-weather.store.types';

import type { IConfigWeatherFormProps } from './config-weather-form.types';
import ConfigWeatherForm from './config-weather-form.vue';

type ConfigWeatherFormInstance = ComponentPublicInstance<IConfigWeatherFormProps> & { model: IConfigWeatherEditForm };

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	exception: vi.fn(),
};

const backendClient = {
	GET: vi.fn().mockResolvedValue({ data: undefined, status: 200 }),
};

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('@vue-leaflet/vue-leaflet', () => {
	const stub = (name: string) => ({
		name,
		// minimal Vue component that renders nothing
		render: () => null,
	});

	return {
		LMap: stub('LMap'),
		LTileLayer: stub('LTileLayer'),
		LMarker: stub('LMarker'),
	};
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
		useBackend: () => ({
			client: backendClient,
		}),
	};
});

describe('ConfigWeatherForm', (): void => {
	let wrapper: VueWrapper<ConfigWeatherFormInstance>;

	const mockConfigWeatherStore: ConfigWeatherStore = {
		edit: vi.fn(),
	} as ConfigWeatherStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockConfigWeatherStore),
		});

		wrapper = mount(ConfigWeatherForm, {
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigModuleWeatherType.weather,
					cityName: 'Prague,CZ',
					locationType: ConfigModuleWeatherCityNameLocation_type.city_name,
					unit: ConfigModuleWeatherUnit.celsius,
					openWeatherApiKey: null,
				},
			},
		}) as VueWrapper<ConfigWeatherFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(4);
	});

	it('submits successfully and updates config', async (): Promise<void> => {
		await wrapper.find('input[name="cityName"]').setValue('London,UK');
		await wrapper.find('input[name="locationType"]').setValue(ConfigModuleWeatherCityNameLocation_type.city_name);
		await wrapper.find('input[name="unit"]').setValue(ConfigModuleWeatherUnit.fahrenheit);

		(mockConfigWeatherStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('configModule.messages.configWeather.edited');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="cityName"]').setValue('London,UK');
		await wrapper.find('input[name="locationType"]').setValue(ConfigModuleWeatherCityNameLocation_type.city_name);
		await wrapper.find('input[name="unit"]').setValue(ConfigModuleWeatherUnit.fahrenheit);

		(mockConfigWeatherStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('configModule.messages.configWeather.notEdited');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="cityName"]').setValue('London,UK');
		await wrapper.find('input[name="locationType"]').setValue(ConfigModuleWeatherCityNameLocation_type.city_name);
		await wrapper.find('input[name="unit"]').setValue(ConfigModuleWeatherUnit.fahrenheit);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.cityName).toBe('Prague,CZ');
		expect(wrapper.vm.model.locationType).toBe(ConfigModuleWeatherCityNameLocation_type.city_name);
		expect(wrapper.vm.model.unit).toBe(ConfigModuleWeatherUnit.celsius);
		expect(wrapper.vm.model.openWeatherApiKey).toBe('');
	});
});
