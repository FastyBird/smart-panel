/* eslint-disable vue/one-component-per-file */
import type { App } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPluginOptions } from '../../app.types';
import { RouteNames as DevicesRouteNames } from '../../modules/devices';

import VirtualDeviceSources from './components/virtual-device-sources.vue';
import { RouteNames as VirtualRouteNames } from './devices-virtual.constants';
import DevicesVirtualPlugin from './devices-virtual.plugin';
import {
	VirtualChannelPropertyCreateReqSchema,
	VirtualChannelPropertySchema,
	VirtualChannelPropertyUpdateReqSchema,
} from './store/channels.properties.store.schemas';

const mocks = vi.hoisted(() => ({
	addPlugin: vi.fn(),
	configStore: {
		firstLoadFinished: vi.fn(),
		fetch: vi.fn(),
		findByType: vi.fn(),
	},
}));

vi.mock('../../common', () => ({
	injectStoresManager: () => ({ getStore: () => mocks.configStore }),
	injectPluginsManager: () => ({
		addPlugin: mocks.addPlugin,
	}),
}));

vi.mock('../../modules/devices', () => ({
	DEVICES_MODULE_NAME: 'devices-module',
	RouteNames: {
		DEVICES: 'devices_module-devices',
	},
}));

vi.mock('./components/components', async () => {
	const { defineComponent } = await import('vue');

	const StubComponent = defineComponent({
		template: '<div />',
	});

	return {
		VirtualDeviceAddForm: StubComponent,
		VirtualDeviceEditForm: StubComponent,
	};
});

vi.mock('./components/virtual-device-sources.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ name: 'VirtualDeviceSources', template: '<div />' }) };
});

vi.mock('./schemas/devices.schemas', () => ({
	VirtualDeviceAddFormSchema: {},
	VirtualDeviceEditFormSchema: {},
}));

vi.mock('./store/channels.properties.store.schemas', () => ({
	VirtualChannelPropertySchema: { schema: 'VirtualChannelPropertySchema' },
	VirtualChannelPropertyCreateReqSchema: { schema: 'VirtualChannelPropertyCreateReqSchema' },
	VirtualChannelPropertyUpdateReqSchema: { schema: 'VirtualChannelPropertyUpdateReqSchema' },
}));

vi.mock('./store/channels.store.schemas', () => ({
	VirtualChannelSchema: {},
}));

vi.mock('./store/devices.store.schemas', () => ({
	VirtualDeviceCreateReqSchema: {},
	VirtualDeviceSchema: {},
	VirtualDeviceUpdateReqSchema: {},
}));

const createOptions = (routes: Array<{ name: string }>) =>
	({
		i18n: {
			global: {
				getLocaleMessage: vi.fn(() => ({})),
				setLocaleMessage: vi.fn(),
			},
		},
		router: {
			getRoutes: vi.fn(() => routes),
			addRoute: vi.fn(),
			resolve: vi.fn((route) => route),
		},
	}) as unknown as IPluginOptions;

describe('devicesVirtualPlugin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.configStore.firstLoadFinished.mockReturnValue(true);
		mocks.configStore.fetch.mockResolvedValue(undefined);
		mocks.configStore.findByType.mockReturnValue({ enabled: true });
	});

	it('does not register the wizard route when the devices list route is missing', () => {
		const options = createOptions([{ name: 'root' }]);

		DevicesVirtualPlugin.install({} as App, options);

		expect(options.router.addRoute).not.toHaveBeenCalled();
	});

	it('registers the wizard route as a child of the devices list route', () => {
		const options = createOptions([{ name: DevicesRouteNames.DEVICES }]);

		DevicesVirtualPlugin.install({} as App, options);

		expect(options.router.addRoute).toHaveBeenCalledWith(DevicesRouteNames.DEVICES, expect.any(Object));
	});

	it('registers a route resolvable by the wizard route name, with the wizard view as its component', async () => {
		const options = createOptions([{ name: DevicesRouteNames.DEVICES }]);

		DevicesVirtualPlugin.install({} as App, options);

		const registeredRoute = ((options.router.addRoute as ReturnType<typeof vi.fn>).mock.calls as [
			string,
			{ name: string; component: () => unknown },
		][]).find(([, route]) => route.name === VirtualRouteNames.WIZARD)?.[1];

		expect(registeredRoute).toBeDefined();
		if (!registeredRoute) throw new Error('Virtual device wizard route was not registered');
		// The route's component is a lazy import — resolving it proves it points at the wizard view
		// this task creates rather than at a placeholder.
		await expect(registeredRoute.component()).resolves.toMatchObject({ default: expect.objectContaining({ name: 'ViewVirtualDeviceWizard' }) });
	});

	it('registers the plugin even when the devices list route is not present yet', () => {
		const options = createOptions([{ name: 'root' }]);

		DevicesVirtualPlugin.install({} as App, options);

		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				type: 'devices-virtual',
			})
		);
	});

	// Regression pin for task-12-brief.md's "trap that fails silently": these two were the only
	// schemas missing from the element's `schemas` block. Without them, `getPluginElement('virtual')`
	// falls back to the base module's `ChannelPropertyCreateReqSchema`/`ChannelPropertyUpdateReqSchema`
	// — plain objects with no `source_property` field — and a remap PATCH returns 200 having silently
	// dropped the one field it exists to send. See virtual-device-remap-dialog.spec.ts for the same
	// bug pinned end-to-end, through the real transformer and wire schema.
	it('registers the virtual channel property create and update request schemas', () => {
		const options = createOptions([{ name: 'root' }]);

		DevicesVirtualPlugin.install({} as App, options);

		const registered = mocks.addPlugin.mock.calls[0]?.[1].elements[0].schemas;
		expect(registered.channelPropertySchema).toBe(VirtualChannelPropertySchema);
		expect(registered.channelPropertyCreateReqSchema).toBe(VirtualChannelPropertyCreateReqSchema);
		expect(registered.channelPropertyUpdateReqSchema).toBe(VirtualChannelPropertyUpdateReqSchema);

		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				elements: [
					expect.objectContaining({
						schemas: expect.objectContaining({
							channelPropertyCreateReqSchema: VirtualChannelPropertyCreateReqSchema,
							channelPropertyUpdateReqSchema: VirtualChannelPropertyUpdateReqSchema,
						}),
					}),
				],
			})
		);
	});

	it('registers its sources and remap section for the virtual device type', () => {
		DevicesVirtualPlugin.install({} as App, createOptions([{ name: 'root' }]));

		const element = mocks.addPlugin.mock.calls[0]?.[1].elements[0];
		expect(element.type).toBe('virtual');
		expect(element.components.deviceDetailSection).toBe(VirtualDeviceSources);
	});

	it('registers its bespoke wizard as route-based launcher metadata when the route is available', () => {
		const options = createOptions([{ name: DevicesRouteNames.DEVICES }]);

		DevicesVirtualPlugin.install({} as App, options);

		expect(mocks.addPlugin).toHaveBeenCalledWith(
			expect.any(Symbol),
			expect.objectContaining({
				routes: {
					wizard: {
						label: 'devicesVirtualPlugin.wizard.title',
						icon: 'mdi:call-split',
						to: { name: VirtualRouteNames.WIZARD },
						testId: 'virtual-device-wizard',
					},
				},
			})
		);
	});

	describe('route reachability against a real router', () => {
		// The tests above assert install() *calls* addRoute correctly against a hand-rolled fake
		// router. This one runs the same install() against vue-router's real implementation, so the
		// path join, name resolution and navigation are the library's own — not a mock's approximation
		// of them — proving the wizard route is actually navigable, not merely "addRoute was called".
		it('makes the wizard route resolvable and navigable once installed under the real devices route', async () => {
			const router = createRouter({
				history: createMemoryHistory(),
				routes: [
					{
						path: '/devices',
						name: DevicesRouteNames.DEVICES,
						component: { template: '<div />' },
					},
				],
			});

			const options = {
				i18n: {
					global: {
						getLocaleMessage: vi.fn(() => ({})),
						setLocaleMessage: vi.fn(),
					},
				},
				router,
			} as unknown as IPluginOptions;

			DevicesVirtualPlugin.install({} as App, options);

			const resolved = router.resolve({ name: VirtualRouteNames.WIZARD });

			expect(resolved.name).toBe(VirtualRouteNames.WIZARD);
			expect(resolved.path).toBe('/devices/devices-virtual/wizard');

			await router.push({ name: VirtualRouteNames.WIZARD });
			await router.isReady();

			expect(router.currentRoute.value.name).toBe(VirtualRouteNames.WIZARD);
		});
	});
});

describe('virtual wizard direct navigation gate', () => {
	const navigate = async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: '/devices', name: DevicesRouteNames.DEVICES, component: { template: '<div />' } }],
		});
		const options = createOptions([]);
		options.router = router;
		DevicesVirtualPlugin.install({} as App, options);
		await router.push('/devices/devices-virtual/wizard');
		await router.isReady();
		return router.currentRoute.value.name;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.configStore.firstLoadFinished.mockReturnValue(true);
		mocks.configStore.fetch.mockResolvedValue(undefined);
	});

	it.each([false, undefined])('redirects disabled or absent plugin state %s to the devices list', async (enabled) => {
		mocks.configStore.findByType.mockReturnValue(enabled === undefined ? null : { enabled });
		expect(await navigate()).toBe(DevicesRouteNames.DEVICES);
		expect(mocks.configStore.fetch).not.toHaveBeenCalled();
	});

	it('waits for first hydration before allowing an enabled plugin', async () => {
		mocks.configStore.firstLoadFinished.mockReturnValue(false);
		mocks.configStore.findByType.mockReturnValue(null);
		mocks.configStore.fetch.mockImplementation(async () => {
			mocks.configStore.findByType.mockReturnValue({ enabled: true });
		});
		expect(await navigate()).toBe(VirtualRouteNames.WIZARD);
		expect(mocks.configStore.fetch).toHaveBeenCalledTimes(1);
	});

	it('redirects when config cannot be hydrated', async () => {
		mocks.configStore.firstLoadFinished.mockReturnValue(false);
		mocks.configStore.findByType.mockReturnValue(null);
		mocks.configStore.fetch.mockRejectedValue(new Error('Offline'));
		expect(await navigate()).toBe(DevicesRouteNames.DEVICES);
	});
});
