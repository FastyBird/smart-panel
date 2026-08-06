import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { configPluginsStoreKey } from '../../config/store/keys';
import { devicesStoreKey } from '../../devices/store/keys';
import { ExtensionKind } from '../../extensions/extensions.constants';
import type { IExtension } from '../../extensions/store/extensions.store.types';
import { extensionsStoreKey } from '../../extensions/store/keys';

import StepIntegrations from './step-integrations.vue';

// devices-virtual is the one plugin where the device type ('virtual') is not the plugin's
// '-plugin'-stripped prefix ('devices-virtual') — every other devices-* plugin satisfies
// TYPE === PREFIX, which is why a naive string-derived match works for them by coincidence.
const VIRTUAL_PLUGIN_TYPE = 'devices-virtual';
const VIRTUAL_DEVICE_TYPE = 'virtual';

// Shaped like a plugin that satisfies TYPE === PREFIX (e.g. devices-home-assistant), used to prove
// the registry-based fix keeps matching the seven plugins that used to work via the old heuristic.
const OTHER_PLUGIN_TYPE = 'devices-other-plugin';
const OTHER_DEVICE_TYPE = 'devices-other';

const mockRemove = vi.fn().mockResolvedValue(true);

const mockExtensionsStore = {
	data: {} as Record<string, IExtension>,
	fetch: vi.fn().mockResolvedValue(undefined),
	update: vi.fn().mockResolvedValue(undefined),
};

const mockDevicesStore = {
	findAll: vi.fn(() => [] as { id: string; type: string }[]),
	remove: mockRemove,
	fetch: vi.fn().mockResolvedValue([]),
};

const mockConfigPluginsStore = {
	get: vi.fn().mockResolvedValue(null),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectStoresManager: () => ({
			getStore: (key: unknown) => {
				if (key === extensionsStoreKey) return mockExtensionsStore;
				if (key === devicesStoreKey) return mockDevicesStore;
				if (key === configPluginsStoreKey) return mockConfigPluginsStore;

				throw new Error(`Unexpected store key requested in test: ${String(key)}`);
			},
		}),
	};
});

vi.mock('../../../modules/config/composables/usePlugins', () => ({
	usePlugins: () => ({
		getByName: () => undefined,
	}),
}));

// The fix under test: resolve a plugin's device type(s) from the plugin registry instead of
// deriving them from the plugin's own type string, which is what broke devices-virtual.
vi.mock('../../../modules/devices/composables/useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		getByPluginType: (type: string) => {
			if (type === VIRTUAL_PLUGIN_TYPE) {
				return {
					type: VIRTUAL_PLUGIN_TYPE,
					elements: [{ type: VIRTUAL_DEVICE_TYPE, modules: ['devices-module'] }],
				};
			}

			if (type === OTHER_PLUGIN_TYPE) {
				return {
					type: OTHER_PLUGIN_TYPE,
					elements: [{ type: OTHER_DEVICE_TYPE, modules: ['devices-module'] }],
				};
			}

			return undefined;
		},
	}),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		// Embed interpolation params in the rendered text so count-dependent assertions can read them.
		t: (key: string, params?: Record<string, unknown>) => (params ? `${key}(${JSON.stringify(params)})` : key),
	}),
}));

const buildExtension = (overrides: Partial<IExtension> = {}): IExtension => ({
	type: VIRTUAL_PLUGIN_TYPE,
	kind: ExtensionKind.plugin,
	name: 'Virtual Devices',
	enabled: true,
	isCore: true,
	canToggleEnabled: true,
	...overrides,
});

describe('StepIntegrations.vue', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mockExtensionsStore.data = {};
		mockDevicesStore.findAll.mockReturnValue([]);
		mockExtensionsStore.fetch.mockResolvedValue(undefined);
		mockExtensionsStore.update.mockResolvedValue(undefined);
		mockConfigPluginsStore.get.mockResolvedValue(null);
		mockRemove.mockResolvedValue(true);
	});

	it('counts a virtual device even though its type does not start with the plugin prefix', async () => {
		mockExtensionsStore.data = { [VIRTUAL_PLUGIN_TYPE]: buildExtension() };
		mockDevicesStore.findAll.mockReturnValue([{ id: 'virtual-device-1', type: VIRTUAL_DEVICE_TYPE }]);

		const wrapper = mount(StepIntegrations, {
			global: {
				stubs: {
					IntegrationConfigDialog: true,
				},
			},
		});

		await flushPromises();

		// The bottom summary bar's total is driven purely by deviceCountsByPlugin, independent of
		// the per-plugin discovery-in-progress UI state, so it is a stable signal for this assertion.
		expect(wrapper.text()).toContain('onboardingModule.integrations.totalDevices({"count":1})');
	});

	it('still counts devices for a plugin whose device type equals its prefix, like the seven non-virtual plugins', async () => {
		mockExtensionsStore.data = { [OTHER_PLUGIN_TYPE]: buildExtension({ type: OTHER_PLUGIN_TYPE, name: 'Other Devices' }) };
		mockDevicesStore.findAll.mockReturnValue([
			{ id: 'other-device-1', type: OTHER_DEVICE_TYPE },
			{ id: 'other-device-2', type: OTHER_DEVICE_TYPE },
		]);

		const wrapper = mount(StepIntegrations, {
			global: {
				stubs: {
					IntegrationConfigDialog: true,
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain('onboardingModule.integrations.totalDevices({"count":2})');
	});

	it('removes virtual devices when the integration is toggled off', async () => {
		mockExtensionsStore.data = { [VIRTUAL_PLUGIN_TYPE]: buildExtension() };
		mockDevicesStore.findAll.mockReturnValue([{ id: 'virtual-device-1', type: VIRTUAL_DEVICE_TYPE }]);

		const wrapper = mount(StepIntegrations, {
			global: {
				stubs: {
					IntegrationConfigDialog: true,
				},
			},
		});

		await flushPromises();

		const toggle = wrapper.findComponent({ name: 'ElSwitch' });

		await toggle.vm.$emit('update:model-value', false);
		await flushPromises();

		expect(mockRemove).toHaveBeenCalledWith({ id: 'virtual-device-1' });
	});

	it('still removes devices for a plugin whose device type equals its prefix, like the seven non-virtual plugins', async () => {
		mockExtensionsStore.data = { [OTHER_PLUGIN_TYPE]: buildExtension({ type: OTHER_PLUGIN_TYPE, name: 'Other Devices' }) };
		mockDevicesStore.findAll.mockReturnValue([{ id: 'other-device-1', type: OTHER_DEVICE_TYPE }]);

		const wrapper = mount(StepIntegrations, {
			global: {
				stubs: {
					IntegrationConfigDialog: true,
				},
			},
		});

		await flushPromises();

		const toggle = wrapper.findComponent({ name: 'ElSwitch' });

		await toggle.vm.$emit('update:model-value', false);
		await flushPromises();

		expect(mockRemove).toHaveBeenCalledWith({ id: 'other-device-1' });
	});
});
