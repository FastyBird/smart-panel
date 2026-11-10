import type { App } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createPinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPluginOptions } from '../../app.types';
import { RouteNames as DevicesRouteNames } from '../../modules/devices';

import { RouteNames } from './devices-modbus.constants';
import DevicesModbusPlugin from './devices-modbus.plugin';

const mocks = vi.hoisted(() => ({
	addPlugin: vi.fn(),
	addStore: vi.fn(),
	configStore: {
		firstLoadFinished: vi.fn(),
		fetch: vi.fn(),
		findByType: vi.fn(),
	},
}));

vi.mock('../../common', async () => {
	const actual = await vi.importActual('../../common');

	return {
		...actual,
		useBackend: () => ({ client: {} }),
		injectStoresManager: () => ({ getStore: () => mocks.configStore, addStore: mocks.addStore }),
		injectPluginsManager: () => ({ addPlugin: mocks.addPlugin }),
	};
});

const app = { provide: vi.fn() } as unknown as App;

const createOptions = (router: unknown) =>
	({
		i18n: { global: { getLocaleMessage: vi.fn(() => ({})), setLocaleMessage: vi.fn() } },
		router,
		store: createPinia(),
	}) as unknown as IPluginOptions;

const createRealRouter = () =>
	createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/devices', name: DevicesRouteNames.DEVICES, component: { template: '<div />' } }],
	});

describe('DevicesModbusPlugin', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.configStore.firstLoadFinished.mockReturnValue(true);
		mocks.configStore.fetch.mockResolvedValue(undefined);
		mocks.configStore.findByType.mockReturnValue({ enabled: true });
	});

	it('registers the plugin, its device element, wizard launcher and config element', () => {
		const router = createRealRouter();

		DevicesModbusPlugin.install(app, createOptions(router));

		expect(mocks.addPlugin).toHaveBeenCalledTimes(1);
		const registration = mocks.addPlugin.mock.calls[0]?.[1];
		expect(registration).toMatchObject({
			type: 'devices-modbus-plugin',
			source: 'com.fastybird.smart-panel.plugin.devices-modbus',
			routes: {
				wizard: {
					label: 'devicesModbusPlugin.wizard.title',
					icon: 'mdi:lan-connect',
					to: { name: RouteNames.WIZARD },
					testId: 'modbus-device-wizard',
				},
			},
		});

		const deviceElement = registration.elements.find((element: { type: string }) => element.type === 'devices-modbus');
		expect(deviceElement.schemas).toEqual(
			expect.objectContaining({
				deviceSchema: expect.anything(),
				deviceCreateReqSchema: expect.anything(),
				deviceUpdateReqSchema: expect.anything(),
				channelSchema: expect.anything(),
				channelPropertySchema: expect.anything(),
			})
		);
		expect(deviceElement.components?.deviceAddForm).toBeUndefined();

		const configElement = registration.elements.find((element: { type: string }) => element.type !== 'devices-modbus');
		expect(configElement.schemas).toEqual(
			expect.objectContaining({
				pluginConfigSchema: expect.anything(),
				pluginConfigEditFormSchema: expect.anything(),
				pluginConfigUpdateReqSchema: expect.anything(),
			})
		);
	});

	it('registers the endpoints and templates stores with the stores manager', () => {
		DevicesModbusPlugin.install(app, createOptions(createRealRouter()));

		expect(mocks.addStore).toHaveBeenCalledTimes(2);
	});

	it.each([
		[RouteNames.WIZARD, '/devices/devices-modbus/wizard'],
		[RouteNames.ENDPOINTS, '/devices/devices-modbus/endpoints'],
	])('adds the %s route under the devices route and gates it on the plugin being enabled', async (name, path) => {
		const router = createRealRouter();
		DevicesModbusPlugin.install(app, createOptions(router));

		expect(router.resolve({ name }).path).toBe(path);
		await router.push({ name });
		expect(router.currentRoute.value.name).toBe(name);
		expect(router.resolve({ name }).meta['devicesWizard']).toBe(true);

		mocks.configStore.findByType.mockReturnValue({ enabled: false });
		await router.push({ name: DevicesRouteNames.DEVICES });
		await router.push({ name });
		expect(router.currentRoute.value.name).toBe(DevicesRouteNames.DEVICES);
	});

	it('redirects to the devices list when the plugin config cannot be loaded', async () => {
		mocks.configStore.firstLoadFinished.mockReturnValue(false);
		mocks.configStore.fetch.mockRejectedValue(new Error('Offline'));
		const router = createRealRouter();
		DevicesModbusPlugin.install(app, createOptions(router));

		await router.push({ name: RouteNames.WIZARD });

		expect(router.currentRoute.value.name).toBe(DevicesRouteNames.DEVICES);
	});

	it('skips routes and the launcher when the devices route does not exist yet', () => {
		const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'root', component: { template: '<div />' } }] });

		DevicesModbusPlugin.install(app, createOptions(router));

		expect(router.hasRoute(RouteNames.WIZARD)).toBe(false);
		expect(mocks.addPlugin.mock.calls[0]?.[1].routes).toBeUndefined();
	});
});
