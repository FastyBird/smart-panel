import { type ComponentPublicInstance } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigLanguageLanguage, ConfigLanguageTime_format, ConfigLanguageType } from '../../../openapi';
import type { IConfigLanguageEditForm } from '../composables';
import { FormResult, Layout } from '../config.constants';
import enUS from '../locales/en-US.json';
import type { ConfigLanguageStore } from '../store';

import type { ConfigLanguageFormProps } from './config-language-form.types';
import ConfigLanguageForm from './config-language-form.vue';

type ConfigLanguageFormInstance = ComponentPublicInstance<ConfigLanguageFormProps> & { model: IConfigLanguageEditForm };

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	exception: vi.fn(),
};

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

describe('ConfigLanguageForm', (): void => {
	let wrapper: VueWrapper<ConfigLanguageFormInstance>;

	const mockConfigLanguageStore: ConfigLanguageStore = {
		edit: vi.fn(),
	} as ConfigLanguageStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockConfigLanguageStore),
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					configModule: enUS,
				},
			},
		});

		wrapper = mount(ConfigLanguageForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigLanguageType.language,
					language: ConfigLanguageLanguage.en_US,
					timezone: 'Europe/Prague',
					timeFormat: ConfigLanguageTime_format.Value24h,
				},
			},
		}) as VueWrapper<ConfigLanguageFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(3);
	});

	it('submits successfully and updates config', async (): Promise<void> => {
		await wrapper.find('input[name="language"]').setValue(ConfigLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigLanguageTime_format.Value12h);

		(mockConfigLanguageStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('Changes saved! The language config has been updated.');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="language"]').setValue(ConfigLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigLanguageTime_format.Value12h);

		(mockConfigLanguageStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('Something went wrong. Language config update was not successful.');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="language"]').setValue(ConfigLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigLanguageTime_format.Value12h);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.language).toBe(ConfigLanguageLanguage.en_US);
		expect(wrapper.vm.model.timezone).toBe('Europe/Prague');
		expect(wrapper.vm.model.timeFormat).toBe(ConfigLanguageTime_format.Value24h);
	});
});
