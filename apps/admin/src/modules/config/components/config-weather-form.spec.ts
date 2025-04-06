import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigWeatherType, ConfigWeatherUnit, PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type } from '../../../openapi';
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

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

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
					type: ConfigWeatherType.weather,
					location: 'Prague',
					locationType: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.city_name,
					unit: ConfigWeatherUnit.celsius,
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
		await wrapper.find('input[name="location"]').setValue('London');
		await wrapper.find('input[name="locationType"]').setValue(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.zip_code);
		await wrapper.find('input[name="unit"]').setValue(ConfigWeatherUnit.fahrenheit);

		(mockConfigWeatherStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('configModule.messages.configWeather.edited');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="location"]').setValue('London');
		await wrapper.find('input[name="locationType"]').setValue(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.zip_code);
		await wrapper.find('input[name="unit"]').setValue(ConfigWeatherUnit.fahrenheit);

		(mockConfigWeatherStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('configModule.messages.configWeather.notEdited');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="location"]').setValue('London');
		await wrapper.find('input[name="locationType"]').setValue(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.zip_code);
		await wrapper.find('input[name="unit"]').setValue(ConfigWeatherUnit.fahrenheit);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.location).toBe('Prague');
		expect(wrapper.vm.model.locationType).toBe(PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type.city_name);
		expect(wrapper.vm.model.unit).toBe(ConfigWeatherUnit.celsius);
		expect(wrapper.vm.model.openWeatherApiKey).toBe('');
	});
});
