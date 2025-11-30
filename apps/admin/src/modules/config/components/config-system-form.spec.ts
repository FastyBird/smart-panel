import { type ComponentPublicInstance } from 'vue';

import { ElForm, ElFormItem } from 'element-plus';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, flushPromises, mount } from '@vue/test-utils';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { SystemModuleLogEntryType, ConfigModuleSystemType  } from '../../../openapi.constants';
import type { IConfigSystemEditForm } from '../composables/types';
import { FormResult, Layout } from '../config.constants';
import type { ConfigSystemStore } from '../store/config-system.store.types';

import type { IConfigSystemFormProps } from './config-system-form.types';
import ConfigSystemForm from './config-system-form.vue';

type ConfigSystemFormInstance = ComponentPublicInstance<IConfigSystemFormProps> & { model: IConfigSystemEditForm };

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

describe('ConfigSystemForm', (): void => {
	let wrapper: VueWrapper<ConfigSystemFormInstance>;

	const mockConfigSystemStore: ConfigSystemStore = {
		edit: vi.fn(),
	} as ConfigSystemStore;

	beforeEach((): void => {
		vi.clearAllMocks();

		(injectStoresManager as Mock).mockReturnValue({
			getStore: vi.fn(() => mockConfigSystemStore),
		});

		wrapper = mount(ConfigSystemForm, {
			props: {
				remoteFormSubmit: false,
				remoteFormResult: FormResult.NONE,
				remoteFormReset: false,
				layout: Layout.DEFAULT,
				config: {
					type: ConfigModuleSystemType.system,
					logLevels: [SystemModuleLogEntryType.fatal],
				},
			},
		}) as VueWrapper<ConfigSystemFormInstance>;
	});

	it('renders the form correctly', (): void => {
		expect(wrapper.exists()).toBe(true);

		expect(wrapper.findComponent(ElForm).exists()).toBe(true);
		expect(wrapper.findAllComponents(ElFormItem)).toHaveLength(1);
	});

	it('submits successfully and updates config', async (): Promise<void> => {
		await wrapper
			.find('input[name="logLevels"]')
			.setValue([SystemModuleLogEntryType.info, SystemModuleLogEntryType.warn, SystemModuleLogEntryType.error]);

		(mockConfigSystemStore.edit as Mock).mockResolvedValueOnce({});

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.OK]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.success).toHaveBeenCalledWith('configModule.messages.configSystem.edited');
	});

	it('handles submission failure', async (): Promise<void> => {
		await wrapper
			.find('input[name="logLevels"]')
			.setValue([SystemModuleLogEntryType.info, SystemModuleLogEntryType.warn, SystemModuleLogEntryType.error]);

		(mockConfigSystemStore.edit as Mock).mockRejectedValueOnce(new Error());

		await wrapper.setProps({ remoteFormSubmit: true });

		await flushPromises();

		expect(wrapper.emitted('update:remote-form-result')?.[0]).toEqual([FormResult.WORKING]);
		expect(wrapper.emitted('update:remote-form-result')?.[1]).toEqual([FormResult.ERROR]);

		const mockFlashMessage = useFlashMessage();

		expect(mockFlashMessage.error).toHaveBeenCalledWith('configModule.messages.configSystem.notEdited');
	});

	it('resets form when remoteFormReset is triggered', async (): Promise<void> => {
		await wrapper
			.find('input[name="logLevels"]')
			.setValue([SystemModuleLogEntryType.info, SystemModuleLogEntryType.warn, SystemModuleLogEntryType.error]);

		await wrapper.setProps({ remoteFormReset: true });

		await flushPromises();

		expect(wrapper.vm.model.logLevels).toStrictEqual([SystemModuleLogEntryType.fatal]);
	});
});
