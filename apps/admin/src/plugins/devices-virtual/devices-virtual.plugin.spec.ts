import type { App } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPluginOptions } from '../../app.types';
import { RouteNames as DevicesRouteNames } from '../../modules/devices';

import { RouteNames as VirtualRouteNames } from './devices-virtual.constants';
import DevicesVirtualPlugin from './devices-virtual.plugin';

const mocks = vi.hoisted(() => ({
	addPlugin: vi.fn(),
}));

vi.mock('../../common', () => ({
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

vi.mock('./schemas/devices.schemas', () => ({
	VirtualDeviceAddFormSchema: {},
	VirtualDeviceEditFormSchema: {},
}));

vi.mock('./store/channels.properties.store.schemas', () => ({
	VirtualChannelPropertySchema: {},
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

		const [, registeredRoute] = (options.router.addRoute as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			{ name: string; component: () => unknown },
		];

		expect(registeredRoute.name).toBe(VirtualRouteNames.WIZARD);
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
