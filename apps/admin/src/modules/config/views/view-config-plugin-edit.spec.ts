import { computed, defineComponent, h, reactive, ref, watch } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { ExtensionsModuleServiceState } from '../../../openapi.constants';
import { FormResult, RouteNames } from '../config.constants';

import ViewConfigPluginEdit from './view-config-plugin-edit.vue';

enableAutoUnmount(afterEach);

const { push, replace, confirmDiscard, fetchConfigPlugin, fetchServices } = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	confirmDiscard: vi.fn(),
	fetchConfigPlugin: vi.fn(),
	fetchServices: vi.fn(),
}));

const config = reactive<{ type: string; enabled: boolean; webhookUrl: string }>({ type: 'notifications-slack', enabled: false, webhookUrl: '' });
const services = ref<{ extensionType: string; state: ExtensionsModuleServiceState; healthy?: boolean }[]>([]);
const hasForm = ref<boolean>(true);

// A plugin form as the slot contract has it: fields only, the host saves. It reports a change and answers a submit
const PluginForm = defineComponent({
	name: 'PluginForm',
	props: { config: { type: Object, required: true }, remoteFormSubmit: Boolean },
	emits: ['update:remote-form-submit', 'update:remote-form-result', 'update:remote-form-changed'],
	setup(props, { emit }) {
		const initial = JSON.stringify(props.config);

		watch(
			() => JSON.stringify(props.config),
			(now) => emit('update:remote-form-changed', now !== initial)
		);

		watch(
			() => props.remoteFormSubmit,
			(submit) => {
				if (submit) {
					emit('update:remote-form-submit', false);
					emit('update:remote-form-result', FormResult.OK);
				}
			}
		);

		return () => h('div', { 'data-test-id': 'plugin-form' });
	},
});

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-meta', () => ({
	useMeta: () => ({ meta: {} }),
}));

vi.mock('vue-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('vue-router')>()),
	useRouter: () => ({ push, replace, resolve: () => ({}) }),
}));

vi.mock('../../../common', async () => {
	const { computed } = await import('vue');
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		AppBreadcrumbs: { template: '<div />' },
		ViewHeader: { props: ['title'], template: '<h1 data-test-id="view-header">{{ title }}</h1>' },
		injectStoresManager: () => ({ getStore: () => ({ findByType: () => ({ version: '1.4.0' }) }) }),
		useEditDrawer: () => ({ inDrawer: computed(() => true) }),
	};
});

vi.mock('../composables/useConfigPlugin', () => ({
	useConfigPlugin: () => ({ configPlugin: computed(() => config), fetchConfigPlugin }),
}));

vi.mock('../composables/usePlugin', () => ({
	usePlugin: () => ({
		plugin: computed(() => ({ type: 'notifications-slack', name: 'Slack' })),
		element: computed(() => (hasForm.value ? { components: { pluginConfigEditForm: PluginForm } } : { components: {} })),
	}),
}));

vi.mock('../../extensions/composables/useServices', () => ({
	useServices: () => ({ services, fetchServices }),
}));

vi.mock('../composables/useConfigDiscard', () => ({
	useConfigDiscard: () => ({ confirmDiscard }),
}));

const render = async () => {
	const wrapper = mount(ViewConfigPluginEdit, { props: { plugin: 'notifications-slack' }, global: { stubs: { Icon: true } } });

	await flushPromises();

	return wrapper;
};

describe('ViewConfigPluginEdit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		config.enabled = false;
		config.webhookUrl = '';
		services.value = [];
		hasForm.value = true;
		fetchConfigPlugin.mockResolvedValue(undefined);
		fetchServices.mockResolvedValue(undefined);
		confirmDiscard.mockResolvedValue(true);
	});

	it('draws the identity row: name, family and version, and the Enabled switch', async () => {
		const wrapper = await render();

		expect(wrapper.find('[data-test-id="config-identity-name"]').text()).toBe('Slack');
		expect(wrapper.find('[data-test-id="config-identity-meta"]').text()).toBe('configModule.families.notifications.title · 1.4.0');
		expect(wrapper.find('[data-test-id="config-identity-enabled"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="config-identity-status"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
	});

	it('shows how the plugin services run', async () => {
		services.value = [{ extensionType: 'notifications-slack', state: ExtensionsModuleServiceState.error }];

		const wrapper = await render();

		expect(wrapper.find('[data-test-id="config-identity-status"]').text()).toContain('configModule.pluginStatus.error');
	});

	it('turns the plugin on through the form it edits, so the footer can save it', async () => {
		const wrapper = await render();

		expect(wrapper.find('[data-test-id="form-footer-save"]').attributes('disabled')).toBeDefined();

		await wrapper.find('[data-test-id="config-identity-enabled"] input').setValue(true);
		await flushPromises();

		expect(config.enabled).toBe(true);
		expect(wrapper.find('[data-test-id="form-footer-save"]').attributes('disabled')).toBeUndefined();

		await wrapper.find('[data-test-id="form-footer-save"]').trigger('click');
		await flushPromises();

		expect(replace).toHaveBeenCalledWith({ name: RouteNames.CONFIG_PLUGINS });
	});

	it('asks before discarding changes and stays when they are kept', async () => {
		const wrapper = await render();

		config.webhookUrl = 'https://hooks.slack.com/x';
		await flushPromises();

		confirmDiscard.mockResolvedValue(false);
		await wrapper.find('[data-test-id="form-footer-discard"]').trigger('click');
		await flushPromises();

		expect(confirmDiscard).toHaveBeenCalledTimes(1);
		expect(replace).not.toHaveBeenCalled();
	});

	it('says when the plugin has no settings form', async () => {
		hasForm.value = false;

		const wrapper = await render();

		expect(wrapper.find('[data-test-id="config-plugin-not-found"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="config-identity"]').exists()).toBe(false);
	});
});
