import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigDisplayType } from '../../../openapi';
import type { IConfigDisplayEditForm } from '../composables/types';
import { FormResult, Layout } from '../config.constants';
import type { ConfigDisplayStore } from '../store/config-display.store.types';

import type { IConfigDisplayFormProps } from './config-display-form.types';
import ConfigDisplayForm from './config-display-form.vue';

type ConfigDisplayFormInstance = ComponentPublicInstance<IConfigDisplayFormProps> & { model: IConfigDisplayEditForm };

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

describe('ConfigDisplayForm', (): void => {
	let wrapper: VueWrapper<ConfigDisplayFormInstance>;

	const mockConfigDisplayStore: ConfigDisplayStore = {
		edit: vi.fn(),
	} as ConfigDisplayStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockConfigDisplayStore),
		});

		wrapper = mount(ConfigDisplayForm, {
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigDisplayType.display,
					darkMode: true,
					brightness: 80,
					screenLockDuration: 300,
					screenSaver: true,
				},
			},
		}) as VueWrapper<ConfigDisplayFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(4);
	});

	it('submits successfully and updates config', async (): Promise<void> => {
		await wrapper.find('input[name="darkMode"]').setValue(false);
		await wrapper.find('input[name="screenLockDuration"]').setValue(1800);
		await wrapper.find('input[name="screenSaver"]').setValue(false);

		(mockConfigDisplayStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('configModule.messages.configDisplay.edited');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper.find('input[name="darkMode"]').setValue(false);
		await wrapper.find('input[name="screenLockDuration"]').setValue(1800);
		await wrapper.find('input[name="screenSaver"]').setValue(false);

		(mockConfigDisplayStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('configModule.messages.configDisplay.notEdited');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper.find('input[name="darkMode"]').setValue(false);
		await wrapper.find('input[name="screenLockDuration"]').setValue(1800);
		await wrapper.find('input[name="screenSaver"]').setValue(false);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.darkMode).toBe(true);
		expect(wrapper.vm.model.brightness).toBe(80);
		expect(wrapper.vm.model.screenLockDuration).toBe(300);
		expect(wrapper.vm.model.screenSaver).toBe(true);
	});
});
