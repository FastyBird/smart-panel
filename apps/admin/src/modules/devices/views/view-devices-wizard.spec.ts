/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, ref } from 'vue';

import { ElInput, ElSteps } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import EmptyState from '../../../common/components/empty-state.vue';
import DeviceWizardShell from '../components/wizard/device-wizard-shell.vue';
import type { IDeviceWizardDefinition } from '../devices.types';

import ViewDevicesWizard from './view-devices-wizard.vue';

const mocks = vi.hoisted(() => ({ push: vi.fn(), query: {} as Record<string, string>, enabled: true, disabled: new Set<string>(), load: vi.fn() }));
const Flow = defineComponent({ props: { channel: { type: String, default: '' } }, template: '<div data-test-id="flow">{{ channel }}</div>' });
const definitions: Record<string, IDeviceWizardDefinition> = {
	plugin: {
		selection: { kind: 'integration', icon: 'mdi:lan', description: 'Network devices' },
		variants: [
			{ id: 'lan', label: 'LAN', description: 'Local', icon: 'mdi:lan', component: Flow, props: { channel: 'local' } },
			{ id: 'cloud', label: 'Cloud', description: 'Remote', icon: 'mdi:cloud', component: Flow, props: { channel: 'cloud' } },
		],
	},
	'tools-plugin': {
		selection: { kind: 'section', section: { label: 'Build from existing devices', description: 'Plugin-owned section' } },
		variants: [
			{ id: 'aggregate', label: 'Čidlo teploty', description: 'Combine sensor readings', icon: 'mdi:sigma', component: Flow },
			{ id: 'convert', label: 'Conversion', description: 'Calibrate a measurement', icon: 'mdi:function', component: Flow },
		],
	},
};
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-meta', () => ({ useMeta: () => ({ meta: {} }) }));
vi.mock('vue-router', () => ({
	useRoute: () => ({ query: mocks.query }),
	useRouter: () => ({ push: mocks.push, resolve: () => ({ href: '/devices' }) }),
}));
vi.mock('../../../common', () => ({
	EntityNotFound: defineComponent({ template: '<div data-test-id="unavailable" />' }),
	AppBreadcrumbs: defineComponent({ template: '<div />' }),
	ViewHeader: defineComponent({
		props: { heading: { type: String, default: '' } },
		template: '<header><h1>{{ heading }}</h1><slot name="extra" /></header>',
	}),
	useBreakpoints: () => ({ isMDDevice: ref(true) }),
}));
vi.mock('../components/wizard/device-wizard-shell.vue', () => ({
	default: defineComponent({
		name: 'DeviceWizardShell',
		props: { title: { type: String, default: '' }, prefixSteps: { type: Array, default: () => [] }, backRoute: { type: Object, default: undefined } },
		template: '<div><h1>{{ title }}</h1><slot /></div>',
	}),
}));
vi.mock('../../config', () => ({
	useConfigPlugins: () => ({
		enabled: (type: string) => mocks.enabled && !mocks.disabled.has(type),
		loaded: ref(true),
		fetchConfigPlugins: mocks.load,
	}),
}));
vi.mock('../composables/useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		wizardOptions: computed(() =>
			['plugin', 'tools-plugin'].map((type) => ({
				value: type,
				label: type === 'plugin' ? 'Plugin' : 'Tools',
				description: 'Description',
				disabled: !mocks.enabled || mocks.disabled.has(type),
			}))
		),
		getByPluginType: (type: string) => (definitions[type] ? { name: type === 'plugin' ? 'Plugin' : 'Tools', description: 'Description' } : undefined),
		getWizard: (type: string) => definitions[type],
	}),
}));
beforeEach(() => {
	mocks.query = {};
	mocks.enabled = true;
	mocks.disabled.clear();
	mocks.push.mockReset();
	mocks.load.mockResolvedValue(undefined);
});

describe('standalone device setup selection', () => {
	it('shows integrations and plugin-owned sections without mounting wizard steps or a footer', async () => {
		const wrapper = mount(ViewDevicesWizard);
		expect(wrapper.findComponent(DeviceWizardShell).exists()).toBe(false);
		expect(wrapper.findComponent(ElSteps).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-footer"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="wizard-section-integrations"]').findAll('[role="button"]')).toHaveLength(1);
		expect(wrapper.get('[data-test-id="wizard-section-tools-plugin"]').findAll('[role="button"]')).toHaveLength(2);
		expect(wrapper.find('[data-test-id="wizard-choice-tools-plugin"]').exists()).toBe(false);
		await wrapper.get('[data-test-id="wizard-choice-plugin"]').trigger('click');
		expect(mocks.push).toHaveBeenCalledWith({ name: 'devices_module-devices_wizard', params: { type: 'plugin' } });
		wrapper.unmount();
	});
	it.each(['click', 'enter', 'space'])('opens a plugin-owned variant directly using %s', async (action) => {
		const wrapper = mount(ViewDevicesWizard);
		const card = wrapper.get('[data-test-id="wizard-choice-tools-plugin:aggregate"]');
		if (action === 'click') await card.trigger('click');
		else await card.trigger('keydown', { key: action === 'enter' ? 'Enter' : ' ' });
		expect(mocks.push).toHaveBeenCalledWith({
			name: 'devices_module-devices_wizard',
			params: { type: 'tools-plugin' },
			query: { variant: 'aggregate' },
		});
		wrapper.unmount();
	});
	it('filters translated card content without case or accent sensitivity and clears an empty search', async () => {
		const wrapper = mount(ViewDevicesWizard);
		const search = wrapper.getComponent(ElInput);
		search.vm.$emit('update:modelValue', 'CIDLO');
		await flushPromises();
		expect(wrapper.find('[data-test-id="wizard-choice-tools-plugin:aggregate"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="wizard-section-integrations"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-choice-tools-plugin:convert"]').exists()).toBe(false);
		search.vm.$emit('update:modelValue', 'not-present');
		await flushPromises();
		expect(wrapper.getComponent(EmptyState).props('description')).toBe('devicesModule.wizard.selection.noResults');
		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('selection.clearSearch'))!
			.trigger('click');
		await flushPromises();
		expect(wrapper.findAll('[role="button"]')).toHaveLength(3);
		wrapper.unmount();
	});
	it('opens manual configuration from the picker', async () => {
		const wrapper = mount(ViewDevicesWizard);
		await wrapper.get('[data-test-id="wizard-manual-configuration"]').trigger('click');
		expect(mocks.push).toHaveBeenCalledWith({ name: 'devices_module-devices_add' });
		wrapper.unmount();
	});
	it('hides every variant of a disabled section owner', () => {
		mocks.disabled.add('tools-plugin');
		const wrapper = mount(ViewDevicesWizard);
		expect(wrapper.find('[data-test-id="wizard-section-tools-plugin"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-choice-plugin"]').exists()).toBe(true);
		wrapper.unmount();
	});
	it('offers a normal integration method on a standalone picker before mounting a flow', async () => {
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		expect(wrapper.find('[data-test-id="wizard-choice-lan"]').exists()).toBe(true);
		expect(wrapper.findComponent(DeviceWizardShell).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="flow"]').exists()).toBe(false);
		await wrapper.get('[data-test-id="wizard-choice-cloud"]').trigger('click');
		expect(mocks.push).toHaveBeenCalledWith({ name: 'devices_module-devices_wizard', params: { type: 'plugin' }, query: { variant: 'cloud' } });
		wrapper.unmount();
	});
	it('starts a chosen integration flow without counting either selection as a step', () => {
		mocks.query = { variant: 'cloud' };
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		expect(wrapper.get('[data-test-id="flow"]').text()).toBe('cloud');
		expect(wrapper.getComponent(DeviceWizardShell).props('prefixSteps')).toEqual([]);
		expect(wrapper.getComponent(DeviceWizardShell).props('backRoute')).toEqual({ name: 'devices_module-devices_wizard', params: { type: 'plugin' } });
		wrapper.unmount();
	});
	it('returns a section variant directly to the main choice page', () => {
		mocks.query = { variant: 'aggregate' };
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'tools-plugin' } });
		expect(wrapper.getComponent(DeviceWizardShell).props('backRoute')).toEqual({ name: 'devices_module-devices_wizard_select' });
		wrapper.unmount();
	});
	it.each(['invalid', 'lan'])('refuses invalid variants and disabled plugins (%s)', (variant) => {
		mocks.query = { variant };
		if (variant === 'lan') mocks.enabled = false;
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		expect(wrapper.find('[data-test-id="flow"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="unavailable"]').exists()).toBe(true);
		wrapper.unmount();
	});
	it('surfaces configuration failures and lets the user retry on the choice page', async () => {
		mocks.load.mockRejectedValueOnce(new Error('offline'));
		const wrapper = mount(ViewDevicesWizard);
		await flushPromises();
		expect(wrapper.text()).toContain('devicesModule.wizard.loadFailed');
		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('devicesModule.wizard.retry'))!
			.trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="wizard-choice-plugin"]').exists()).toBe(true);
		wrapper.unmount();
	});
});
