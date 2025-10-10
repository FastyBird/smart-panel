import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigModuleLanguageLanguage, ConfigModuleLanguageTime_format, ConfigModuleLanguageType } from '../../../openapi';
import type { IConfigLanguageEditForm } from '../composables/types';
import { FormResult, Layout } from '../config.constants';
import type { ConfigLanguageStore } from '../store/config-language.store.types';

import type { IConfigLanguageFormProps } from './config-language-form.types';
import ConfigLanguageForm from './config-language-form.vue';

type ConfigLanguageFormInstance = ComponentPublicInstance<IConfigLanguageFormProps> & { model: IConfigLanguageEditForm };

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

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: vi.fn(),
		useFlashMessage: vi.fn(() => mockFlash),
	};
});

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

		wrapper = mount(ConfigLanguageForm, {
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigModuleLanguageType.language,
					language: ConfigModuleLanguageLanguage.en_US,
					timezone: 'Europe/Prague',
					timeFormat: ConfigModuleLanguageTime_format.Value24h,
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
		await wrapper.find('input[name="language"]').setValue(ConfigModuleLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigModuleLanguageTime_format.Value12h);

		(mockConfigLanguageStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('configModule.messages.configLanguage.edited');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="language"]').setValue(ConfigModuleLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigModuleLanguageTime_format.Value12h);

		(mockConfigLanguageStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('configModule.messages.configLanguage.notEdited');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="language"]').setValue(ConfigModuleLanguageLanguage.cs_CZ);
		await wrapper.find('input[name="timezone"]').setValue('Africa/Cairo');
		await wrapper.find('input[name="timeFormat"]').setValue(ConfigModuleLanguageTime_format.Value12h);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.language).toBe(ConfigModuleLanguageLanguage.en_US);
		expect(wrapper.vm.model.timezone).toBe('Europe/Prague');
		expect(wrapper.vm.model.timeFormat).toBe(ConfigModuleLanguageTime_format.Value24h);
	});
});
