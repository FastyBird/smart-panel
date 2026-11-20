import { defineComponent, h, onBeforeUnmount, onMounted } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { configPluginsStoreKey } from '../../config/store/keys';
import { extensionsStoreKey } from '../../extensions/store/keys';

import IntegrationConfigDialog from './integration-config-dialog.vue';

const lifecycle = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn() }));

const configPlugin = { type: 'devices-unifi-protect-plugin', enabled: true };

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<Record<string, unknown>>('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
		injectStoresManager: () => ({
			getStore: (key: unknown) => {
				if (key === configPluginsStoreKey) return { findByType: () => configPlugin, get: vi.fn() };
				if (key === extensionsStoreKey) return { findByType: () => null };

				throw new Error('Unexpected store');
			},
		}),
	};
});

vi.mock('../../../modules/config/composables/usePlugins', () => ({
	usePlugins: () => ({
		getByName: () => ({
			elements: [
				{
					type: 'config',
					components: {
						pluginConfigEditForm: defineComponent({
							setup() {
								onMounted(() => lifecycle.mounted());
								onBeforeUnmount(() => lifecycle.unmounted());

								return () => h('div', { 'data-test-id': 'plugin-form' });
							},
						}),
					},
				},
			],
		}),
	}),
}));

const dialogStub = defineComponent({
	// Like ElDialog, the content stays rendered after the dialog is hidden.
	setup(_props, { slots }) {
		return () => h('div', [slots.default?.(), slots.footer?.()]);
	},
});

describe('IntegrationConfigDialog', () => {
	it("unmounts the plugin's form when the dialog closes, so it can release what it holds, and mounts a fresh one on reopen", async () => {
		const wrapper = mount(IntegrationConfigDialog, {
			props: { visible: true, pluginType: 'devices-unifi-protect-plugin', pluginName: 'UniFi Protect' },
			global: { stubs: { ElDialog: dialogStub, ElScrollbar: false } },
		});

		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
		expect(lifecycle.mounted).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ visible: false });

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(false);
		expect(lifecycle.unmounted).toHaveBeenCalledTimes(1);

		await wrapper.setProps({ visible: true });
		await flushPromises();

		expect(wrapper.find('[data-test-id="plugin-form"]').exists()).toBe(true);
		expect(lifecycle.mounted).toHaveBeenCalledTimes(2);
	});
});
