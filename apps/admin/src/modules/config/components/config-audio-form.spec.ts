import { type ComponentPublicInstance } from 'vue';
import { createI18n } from 'vue-i18n';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigAudioType } from '../../../openapi';
import type { IConfigAudioEditForm } from '../composables';
import { FormResult, Layout } from '../config.constants';
import enUS from '../locales/en-US.json';
import type { ConfigAudioStore } from '../store';

import type { ConfigAudioFormProps } from './config-audio-form.types';
import ConfigAudioForm from './config-audio-form.vue';

type ConfigAudioFormInstance = ComponentPublicInstance<ConfigAudioFormProps> & { model: IConfigAudioEditForm };

const mockFlash = {
	success: vi.fn(),
	error: vi.fn(),
	exception: vi.fn(),
};

vi.mock('../../../common', () => ({
	injectStoresManager: vi.fn(),
	useFlashMessage: vi.fn(() => mockFlash),
}));

describe('ConfigAudioForm', (): void => {
	let wrapper: VueWrapper<ConfigAudioFormInstance>;

	const mockConfigAudioStore: ConfigAudioStore = {
		edit: vi.fn(),
	} as ConfigAudioStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockConfigAudioStore),
		});

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					configModule: enUS,
				},
			},
		});

		wrapper = mount(ConfigAudioForm, {
			global: {
				plugins: [i18n],
			},
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigAudioType.audio,
					speaker: true,
					speakerVolume: 80,
					microphone: false,
					microphoneVolume: 30,
				},
			},
		}) as VueWrapper<ConfigAudioFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(4);
	});

	it('submits successfully and updates config', async (): Promise<void> => {
		await wrapper.find('input[name="speaker"]').setValue(false);
		await wrapper.find('input[name="microphone"]').setValue(false);

		(mockConfigAudioStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('Changes saved! The audio config has been updated.');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="speaker"]').setValue(false);
		await wrapper.find('input[name="microphone"]').setValue(false);

		(mockConfigAudioStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('Something went wrong. Audio config update was not successful.');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="speaker"]').setValue(false);
		await wrapper.find('input[name="microphone"]').setValue(false);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.speaker).toBe(true);
		expect(wrapper.vm.model.speakerVolume).toBe(80);
		expect(wrapper.vm.model.microphone).toBe(false);
		expect(wrapper.vm.model.microphoneVolume).toBe(30);
	});
});
