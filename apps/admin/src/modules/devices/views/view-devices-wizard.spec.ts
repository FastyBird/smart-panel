import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewDevicesWizard from './view-devices-wizard.vue';

const adapterFactory = vi.fn(() => ({ title: 'Adapter wizard' }));
// Declares the SAME `deviceWizardAdapter` key as the devices-scoped element below, differing
// only in `modules`. This is what makes the module-eligibility test meaningful: if the
// `modules` filter in view-devices-wizard.vue were ever disabled, `.find()` would pick this one
// up first (it comes first in the elements array) and the shell would receive the wrong
// factory. A fixture that instead used the dead `deviceWizard` key would be excluded solely
// because nothing reads that key any more, proving nothing about module scoping.
const otherAdapterFactory = vi.fn(() => ({ title: 'Other module wizard' }));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
}));

vi.mock('../../../common', async () => {
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		EntityNotFound: defineVueComponent({
			name: 'EntityNotFound',
			template: '<div data-test-id="entity-not-found" />',
		}),
	};
});

vi.mock('../components/components', async () => {
	const { defineComponent } = await import('vue');

	return {
		DeviceWizard: defineComponent({
			name: 'DeviceWizard',
			props: { adapterFactory: { type: Function, required: true } },
			template: '<div data-test-id="device-wizard" />',
		}),
	};
});

vi.mock('../composables/composables', () => ({
	useDevicesPlugins: () => ({
		getByPluginType: (type: string) =>
			type === 'multi-module-plugin'
				? {
						type: 'multi-module-plugin',
						elements: [
							{
								type: 'other-module-wizard',
								modules: ['other-module'],
								components: {
									deviceWizardAdapter: otherAdapterFactory,
								},
							},
							{
								type: 'devices-module-wizard',
								modules: ['devices-module'],
								components: {
									deviceWizardAdapter: adapterFactory,
								},
							},
						],
					}
				: undefined,
	}),
}));

vi.mock('../devices.constants', () => ({
	RouteNames: {
		DEVICES: 'devices',
	},
	DEVICES_MODULE_NAME: 'devices-module',
}));

describe('ViewDevicesWizard', () => {
	it('renders the shared shell for the devices-scoped adapter element', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		const deviceWizard = wrapper.findComponent({ name: 'DeviceWizard' });

		expect(deviceWizard.exists()).toBe(true);
		expect(deviceWizard.props('adapterFactory')).toBe(adapterFactory);
	});

	it('excludes an element scoped to a different module even though it declares its own adapter factory', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		const deviceWizard = wrapper.findComponent({ name: 'DeviceWizard' });

		expect(deviceWizard.props('adapterFactory')).not.toBe(otherAdapterFactory);
		expect(otherAdapterFactory).not.toHaveBeenCalled();
	});

	it('passes the adapter factory without invoking it', () => {
		mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(adapterFactory).not.toHaveBeenCalled();
	});

	it('renders the not-found state for an unknown plugin type', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'nope',
			},
		});

		expect(wrapper.find('[data-test-id="entity-not-found"]').exists()).toBe(true);
	});
});
