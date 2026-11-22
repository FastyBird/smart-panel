/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import DeviceWizardShell from '../components/wizard/device-wizard-shell.vue';
import type { IDeviceWizardDefinition } from '../devices.types';

import ViewDevicesWizard from './view-devices-wizard.vue';

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	query: {} as Record<string, string>,
	enabled: true,
	disabled: new Set<string>(),
	load: vi.fn(),
}));
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
	useRouter: () => ({ push: mocks.push, replace: mocks.replace, resolve: () => ({ href: '/devices' }) }),
}));
vi.mock('../../../common', () => ({
	EntityNotFound: defineComponent({ template: '<div data-test-id="unavailable" />' }),
	AppBreadcrumbs: defineComponent({ template: '<div />' }),
	ViewHeader: defineComponent({
		props: { title: { type: String, default: '' } },
		template: '<header><h1>{{ title }}</h1><slot name="actions" /></header>',
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
	mocks.replace.mockReset();
	mocks.load.mockReset();
	mocks.load.mockResolvedValue(undefined);
});

describe('device wizard page', () => {
	it('sends a wizard with several variants and none chosen back to the picker', async () => {
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		await flushPromises();
		expect(mocks.replace).toHaveBeenCalledWith({ name: 'devices_module-devices_wizard_select' });
		expect(wrapper.findComponent(DeviceWizardShell).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="flow"]').exists()).toBe(false);
		wrapper.unmount();
	});
	it('starts a chosen variant, returning to the picker from its first step', () => {
		mocks.query = { variant: 'cloud' };
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		expect(wrapper.get('[data-test-id="flow"]').text()).toBe('cloud');
		expect(wrapper.getComponent(DeviceWizardShell).props('prefixSteps')).toEqual([]);
		expect(wrapper.getComponent(DeviceWizardShell).props('backRoute')).toEqual({ name: 'devices_module-devices_wizard_select' });
		expect(mocks.replace).not.toHaveBeenCalled();
		wrapper.unmount();
	});
	it('returns a section variant to the picker too', () => {
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
	it('surfaces configuration failures and lets the user retry', async () => {
		mocks.query = { variant: 'cloud' };
		mocks.load.mockRejectedValueOnce(new Error('offline'));
		const wrapper = mount(ViewDevicesWizard, { props: { type: 'plugin' } });
		await flushPromises();
		expect(wrapper.text()).toContain('devicesModule.wizard.loadFailed');
		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('devicesModule.wizard.retry'))!
			.trigger('click');
		await flushPromises();
		expect(mocks.load).toHaveBeenCalledTimes(2);
		expect(wrapper.find('[data-test-id="flow"]').exists()).toBe(true);
		wrapper.unmount();
	});
});
