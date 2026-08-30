import { reactive, ref } from 'vue';

import { ElRadioButton } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesHomeyPluginConnectionMode } from '../../../openapi.constants';
import type { IHomeyConfig } from '../store/config.store.types';

import HomeyConfigForm from './homey-config-form.vue';

const submit = vi.fn();
const useConfigPluginEditForm = vi.hoisted(() => vi.fn());
const formChanged = ref(false);
const authorizationStore = vi.hoisted(() => ({
	invalidateStatus: vi.fn(),
	fetchStatus: vi.fn().mockResolvedValue({ connected: false, selectedHomeyId: null }),
}));
const model = reactive({
	type: 'devices-homey-plugin',
	enabled: true,
	mode: DevicesHomeyPluginConnectionMode.local,
	url: 'http://homey.local:4859',
	apiKey: undefined as string | null | undefined,
	apiKeyConfigured: true,
	cloudClientId: 'client-id' as string | null | undefined,
	cloudClientSecret: undefined as string | null | undefined,
	cloudClientSecretConfigured: true,
	cloudRedirectUrl: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback' as string | null | undefined,
	connectionTimeout: 10_000,
	reconciliationInterval: 300_000,
});

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({ t: (key: string) => key }),
	};
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

vi.mock('../store/homey-cloud-authorization.store', () => ({ useHomeyCloudAuthorization: () => authorizationStore }));

const mountForm = () =>
	mount(HomeyConfigForm, {
		props: {
			config: model as IHomeyConfig,
		},
		global: {
			stubs: {
				ConfigSecretInput: true,
				HomeyConnectionPanel: {
					name: 'HomeyConnectionPanel',
					props: ['mode', 'candidateUrl', 'candidateApiKey'],
					template: '<div data-test-id="homey-connection-panel-stub" />',
				},
				HomeyCloudAuthorizationPanel: {
					name: 'HomeyCloudAuthorizationPanel',
					props: ['savedMode', 'configurationSaved'],
					template: '<div data-test-id="homey-cloud-authorization-panel-stub" />',
				},
			},
		},
	});

describe('HomeyConfigForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		model.mode = DevicesHomeyPluginConnectionMode.local;
		model.apiKey = undefined;
		model.cloudClientSecret = undefined;
		formChanged.value = false;
		useConfigPluginEditForm.mockReturnValue({
			formEl: ref(),
			model,
			formChanged,
			submit,
			formResult: ref('none'),
		});
	});

	it('offers both local and cloud connection modes', () => {
		const wrapper = mountForm();
		const modes = wrapper.findAllComponents(ElRadioButton);

		expect(modes).toHaveLength(2);
		expect(modes[0]?.props('value')).toBe('local');
		expect(modes[0]?.props('disabled')).not.toBe(true);
		expect(modes[1]?.props('value')).toBe('cloud');
		expect(modes[1]?.props('disabled')).not.toBe(true);
	});

	it('passes only newly entered candidate credentials into the connection panel', async () => {
		const wrapper = mountForm();
		const panel = wrapper.getComponent({ name: 'HomeyConnectionPanel' });

		expect(panel.props()).toEqual(expect.objectContaining({ candidateUrl: 'http://homey.local:4859', candidateApiKey: undefined }));

		model.apiKey = 'new-candidate-key';
		await wrapper.vm.$nextTick();

		expect(panel.props('candidateApiKey')).toBe('new-candidate-key');
	});

	it('shows admin-managed cloud credentials and authorization while hiding local inputs in cloud mode', async () => {
		const wrapper = mountForm();
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		await wrapper.vm.$nextTick();

		expect(wrapper.find('[name="url"]').exists()).toBe(false);
		expect(wrapper.find('[name="cloudClientId"]').exists()).toBe(true);
		expect(wrapper.find('[name="cloudRedirectUrl"]').exists()).toBe(true);
		expect(wrapper.find('[name="cloudClientSecret"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="homey-cloud-authorization-panel-stub"]').exists()).toBe(true);
		expect(wrapper.getComponent({ name: 'HomeyConnectionPanel' }).props('mode')).toBe('cloud');
		expect(wrapper.getComponent({ name: 'HomeyCloudAuthorizationPanel' }).props('savedMode')).toBe('local');
	});

	it('updates the authorization guard only after cloud mode is saved', async () => {
		const wrapper = mountForm();
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		await wrapper.vm.$nextTick();

		expect(wrapper.getComponent({ name: 'HomeyCloudAuthorizationPanel' }).props('savedMode')).toBe('local');

		submit.mockResolvedValueOnce('saved');
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(wrapper.getComponent({ name: 'HomeyCloudAuthorizationPanel' }).props('savedMode')).toBe('cloud');
		expect(authorizationStore.invalidateStatus).toHaveBeenCalledOnce();
		expect(authorizationStore.fetchStatus).toHaveBeenCalledOnce();
	});

	it('marks authorization unavailable while configuration changes are unsaved', async () => {
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		const wrapper = mountForm();
		await wrapper.vm.$nextTick();

		formChanged.value = true;
		await wrapper.vm.$nextTick();

		expect(wrapper.getComponent({ name: 'HomeyCloudAuthorizationPanel' }).props('configurationSaved')).toBe(false);
	});

	it('keeps a successful cloud save when authorization status refresh temporarily fails', async () => {
		const wrapper = mountForm();
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		submit.mockResolvedValueOnce('saved');
		authorizationStore.fetchStatus.mockRejectedValueOnce(new Error('temporary failure'));

		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		expect(authorizationStore.invalidateStatus).toHaveBeenCalledOnce();
		expect(wrapper.getComponent({ name: 'HomeyCloudAuthorizationPanel' }).props('savedMode')).toBe('cloud');
	});

	it('restores the saved connection mode when the parent resets the form', async () => {
		const wrapper = mountForm();
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		await wrapper.vm.$nextTick();

		await wrapper.setProps({ remoteFormReset: true });
		await flushPromises();

		expect(model.mode).toBe(DevicesHomeyPluginConnectionMode.local);
	});

	it('resets against the latest mode after a successful save', async () => {
		const wrapper = mountForm();
		model.mode = DevicesHomeyPluginConnectionMode.cloud;
		submit.mockResolvedValueOnce('saved');
		await wrapper.setProps({ remoteFormSubmit: true });
		await flushPromises();

		model.mode = DevicesHomeyPluginConnectionMode.local;
		await wrapper.setProps({ remoteFormReset: true });
		await flushPromises();

		expect(model.mode).toBe(DevicesHomeyPluginConnectionMode.cloud);
	});
});
