import { reactive, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IHomeyConfig } from '../store/config.store.types';

import HomeyConfigForm from './homey-config-form.vue';

const useConfigPluginEditForm = vi.hoisted(() => vi.fn());
const model = reactive({
	type: 'devices-homey-plugin',
	enabled: true,
	url: 'http://homey.local:4859',
	apiKey: undefined as string | null | undefined,
	apiKeyConfigured: true,
	connectionTimeout: 10_000,
	reconciliationInterval: 300_000,
});

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../modules/config', async () => {
	const { ConfigPluginEditFormSchema } = await vi.importActual<typeof import('../../../modules/config/schemas/plugins.schemas')>(
		'../../../modules/config/schemas/plugins.schemas'
	);

	return {
		ConfigPluginEditFormSchema,
		ConfigSecretInput: { name: 'ConfigSecretInput', template: '<div />' },
		FormResult: { NONE: 'none' },
		Layout: { DEFAULT: 'default' },
		useConfigPluginEditForm,
	};
});

const mountForm = () => {
	useConfigPluginEditForm.mockReturnValue({
		formEl: ref(),
		model,
		formChanged: ref(false),
		submit: vi.fn(),
		formResult: ref('none'),
	});

	return mount(HomeyConfigForm, {
		props: { config: model as IHomeyConfig },
		global: {
			stubs: {
				ConfigSecretInput: true,
				HomeyConnectionPanel: {
					name: 'HomeyConnectionPanel',
					props: ['candidateUrl', 'candidateApiKey'],
					template: '<div data-test-id="homey-connection-panel-stub" />',
				},
			},
		},
	});
};

describe('HomeyConfigForm', () => {
	it('shows only the supported local connection settings', () => {
		const wrapper = mountForm();

		expect(wrapper.find('[name="url"]').exists()).toBe(true);
		expect(wrapper.find('[name="mode"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('devicesHomeyPlugin.config.local.title');
	});

	it('passes only newly entered candidate credentials into the connection panel', async () => {
		const wrapper = mountForm();
		const panel = wrapper.getComponent({ name: 'HomeyConnectionPanel' });

		expect(panel.props()).toEqual(expect.objectContaining({ candidateUrl: 'http://homey.local:4859', candidateApiKey: undefined }));

		model.apiKey = 'new-candidate-key';
		await wrapper.vm.$nextTick();

		expect(panel.props('candidateApiKey')).toBe('new-candidate-key');
	});
});
