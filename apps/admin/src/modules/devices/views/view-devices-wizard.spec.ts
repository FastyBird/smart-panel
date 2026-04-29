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
	it('renders the devices-scoped wizard element when plugin also has other module wizards', () => {
		const wrapper = mount(ViewDevicesWizard, {
			props: {
				type: 'multi-module-plugin',
			},
		});

		expect(wrapper.find('[data-test-id="devices-wizard"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="other-wizard"]').exists()).toBe(false);
	});
});
