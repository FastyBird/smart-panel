/* eslint-disable vue/one-component-per-file */
import { defineComponent } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import ViewDevicesWizard from './view-devices-wizard.vue';

const OtherWizard = defineComponent({
	name: 'OtherWizard',
	template: '<div data-test-id="other-wizard" />',
});

const DevicesWizard = defineComponent({
	name: 'DevicesWizard',
	template: '<div data-test-id="devices-wizard" />',
});

const adapterFactory = vi.fn(() => ({ title: 'Adapter wizard' }));

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
									deviceWizard: OtherWizard,
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
				: type === 'legacy-plugin'
					? {
							type: 'legacy-plugin',
							elements: [
								{
									type: 'legacy-wizard',
									modules: ['devices-module'],
									components: {
										deviceWizard: DevicesWizard,
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

		expect(wrapper.find('[data-test-id="device-wizard"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="other-wizard"]').exists()).toBe(false);
	});

	it('passes the adapter factory without invoking it', () => {
		mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(adapterFactory).not.toHaveBeenCalled();
	});

	it('falls back to a legacy deviceWizard component while plugins are still being migrated', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'legacy-plugin',
			},
		});

		expect(wrapper.find('[data-test-id="devices-wizard"]').exists()).toBe(true);
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
