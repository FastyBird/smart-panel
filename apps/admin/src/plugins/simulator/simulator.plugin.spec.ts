import type { App } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPluginOptions } from '../../app.types';
import { RouteNames as DevicesRouteNames } from '../../modules/devices';

import { RouteNames } from './simulator.constants';
import SimulatorPlugin from './simulator.plugin';

const mocks = vi.hoisted(() => ({
	addPlugin: vi.fn(),
}));

vi.mock('../../common', () => ({
	injectPluginsManager: () => ({
		addPlugin: mocks.addPlugin,
	}),
}));

vi.mock('../../modules/config', () => ({
	CONFIG_MODULE_NAME: 'config-module',
	CONFIG_MODULE_PLUGIN_TYPE: 'config',
}));

vi.mock('../../modules/devices', () => ({
	DEVICES_MODULE_NAME: 'devices-module',
	RouteNames: {
		DEVICES: 'devices_module-devices',
	},
}));

vi.mock('./components/components', () => ({
	SimulatorConfigForm: {},
}));

vi.mock('./schemas/config.schemas', () => ({
	SimulatorConfigEditFormSchema: {},
}));

vi.mock('./schemas/devices.schemas', () => ({
	SimulatorDeviceAddFormSchema: {},
	SimulatorDeviceEditFormSchema: {},
}));

vi.mock('./store/channels.properties.store.schemas', () => ({
	SimulatorChannelPropertySchema: {},
}));

vi.mock('./store/channels.store.schemas', () => ({
	SimulatorChannelSchema: {},
}));

vi.mock('./store/config.store.schemas', () => ({
	SimulatorConfigSchema: {},
	SimulatorConfigUpdateReqSchema: {},
}));

vi.mock('./store/devices.store.schemas', () => ({
	SimulatorDeviceCreateReqSchema: {},
	SimulatorDeviceSchema: {},
	SimulatorDeviceUpdateReqSchema: {},
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
		},
	}) as unknown as IPluginOptions;

describe('SimulatorPlugin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('does not register the wizard route before the Devices route exists', () => {
		const options = createOptions([{ name: 'root' }]);

		SimulatorPlugin.install({} as App, options);

		expect(options.router.addRoute).not.toHaveBeenCalled();
		expect(mocks.addPlugin).toHaveBeenCalledWith(expect.any(Symbol), expect.not.objectContaining({ routes: expect.anything() }));
	});

	it('redirects the former simulator URL to the common wizard', () => {
		const options = createOptions([{ name: DevicesRouteNames.DEVICES }]);
		SimulatorPlugin.install({} as App, options);
		expect(options.router.addRoute).toHaveBeenCalledWith(
			DevicesRouteNames.DEVICES,
			expect.objectContaining({ name: RouteNames.WIZARD, redirect: expect.objectContaining({ params: { type: 'simulator-plugin' } }) })
		);
	});

	it('registers the simulator flow with manual and batch capabilities', () => {
		SimulatorPlugin.install({} as App, createOptions([]));
		const registration = mocks.addPlugin.mock.calls[0]?.[1];
		expect(registration.routes).toBeUndefined();
		expect(registration.elements.find((element: { type: string }) => element.type === 'simulator').components.deviceWizard.capabilities).toEqual({
			manual: true,
			batch: true,
		});
	});
});
