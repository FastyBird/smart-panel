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
// A second, independently valid plugin type — used only by the :key remount test, so switching
// `type` between it and `multi-module-plugin` keeps `device-wizard` mounted throughout (no
// v-if toggle to entity-not-found), isolating the remount to the `:key="type"` binding itself.
const secondAdapterFactory = vi.fn(() => ({ title: 'Second plugin wizard' }));

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
		getByPluginType: (type: string) => {
			if (type === 'multi-module-plugin') {
				return {
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
				};
			}

			if (type === 'second-plugin') {
				return {
					type: 'second-plugin',
					elements: [
						{
							type: 'second-plugin-wizard',
							modules: ['devices-module'],
							components: {
								deviceWizardAdapter: secondAdapterFactory,
							},
						},
					],
				};
			}

			return undefined;
		},
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

	it('remounts the shell — a brand new instance, not a patched one — when the type prop changes', async () => {
		// `:key="type"` exists specifically so switching plugin type tears down the outgoing
		// adapter (running its dispose()) instead of leaving stale state bleeding into the new
		// one. Both `multi-module-plugin` and `second-plugin` resolve to a real adapter factory,
		// so `device-wizard` stays mounted throughout — isolating the assertion to the key-driven
		// remount rather than a v-if toggle to/from entity-not-found.
		const wrapper = mount(ViewDevicesWizard, {
			props: { type: 'multi-module-plugin' },
		});

		const elementBefore = wrapper.find('[data-test-id="device-wizard"]').element;

		await wrapper.setProps({ type: 'second-plugin' });

		const deviceWizardAfter = wrapper.findComponent({ name: 'DeviceWizard' });
		const elementAfter = wrapper.find('[data-test-id="device-wizard"]').element;

		expect(deviceWizardAfter.props('adapterFactory')).toBe(secondAdapterFactory);
		// A patched (not remounted) component would keep rendering into the SAME DOM node;
		// a `:key` change destroys the old vnode/instance and mounts a fresh one in its place.
		expect(elementAfter).not.toBe(elementBefore);
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
