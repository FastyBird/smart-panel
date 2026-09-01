import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';
import { ExtensionsApiException, ExtensionsValidationException } from '../extensions.exceptions';

import { useServices } from './services.store';
import type { IServiceRes } from './services.store.types';

const pluginService: IServiceRes = {
	extension_kind: ExtensionsModuleServiceOwnerKind.plugin,
	extension_type: 'devices-home-assistant-plugin',
	service_id: 'connector',
	activation_policy: ExtensionsModuleServiceActivationPolicy.owner_enabled,
	state: ExtensionsModuleServiceState.started,
	desired_state: ExtensionsModuleServiceDesiredState.started,
	enabled: true,
	healthy: true,
	start_count: 5,
	uptime_ms: 3600000,
};

const alwaysActiveService: IServiceRes = {
	extension_kind: ExtensionsModuleServiceOwnerKind.plugin,
	extension_type: 'devices-home-assistant-plugin',
	service_id: 'discovery',
	activation_policy: ExtensionsModuleServiceActivationPolicy.always,
	state: ExtensionsModuleServiceState.started,
	desired_state: ExtensionsModuleServiceDesiredState.started,
	enabled: false,
	healthy: false,
	start_count: 1,
};

const moduleService: IServiceRes = {
	extension_kind: ExtensionsModuleServiceOwnerKind.module,
	extension_type: 'mdns-module',
	service_id: 'advertisement',
	activation_policy: ExtensionsModuleServiceActivationPolicy.owner_enabled,
	state: ExtensionsModuleServiceState.stopped,
	desired_state: ExtensionsModuleServiceDesiredState.stopped,
	enabled: false,
	start_count: 2,
};

const backendClient = {
	GET: vi.fn(),
	POST: vi.fn(),
};

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: vi.fn(() => ({ client: backendClient })),
		useLogger: vi.fn(() => ({ error: vi.fn() })),
		getErrorReason: vi.fn(() => 'Some error'),
	};
});

describe('Services Store', () => {
	let store: ReturnType<typeof useServices>;

	beforeEach(() => {
		setActivePinia(createPinia());
		store = useServices();
		vi.clearAllMocks();
	});

	it('stores services using a key that includes owner kind and type', () => {
		const service = {
			extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
			extensionType: 'devices-home-assistant-plugin',
			serviceId: 'connector',
			activationPolicy: ExtensionsModuleServiceActivationPolicy.owner_enabled,
			state: ExtensionsModuleServiceState.started,
			desiredState: ExtensionsModuleServiceDesiredState.started,
			enabled: true,
			startCount: 1,
		};

		store.set({
			extensionKind: service.extensionKind,
			extensionType: service.extensionType,
			serviceId: service.serviceId,
			data: service,
		});

		expect(store.data['plugin:devices-home-assistant-plugin:connector']).toEqual(service);
		expect(
			store.findByKey(ExtensionsModuleServiceOwnerKind.plugin, 'devices-home-assistant-plugin', 'connector')
		).toEqual(service);
	});

	it('rejects invalid service data', () => {
		expect(() =>
			store.set({
				extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
				extensionType: 'test-plugin',
				serviceId: 'main',
				data: { state: 'invalid' } as never,
			})
		).toThrow(ExtensionsValidationException);
	});

	it('maps module, plugin, always-active, and unhealthy service status fields', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: [pluginService, alwaysActiveService, moduleService] },
			error: undefined,
			response: { status: 200 },
		});

		const services = await store.fetch();

		expect(services).toHaveLength(3);
		expect(store.data['module:mdns-module:advertisement']).toMatchObject({
			extensionKind: ExtensionsModuleServiceOwnerKind.module,
			desiredState: ExtensionsModuleServiceDesiredState.stopped,
		});
		expect(store.data['plugin:devices-home-assistant-plugin:discovery']).toMatchObject({
			activationPolicy: ExtensionsModuleServiceActivationPolicy.always,
			enabled: false,
			desiredState: ExtensionsModuleServiceDesiredState.started,
			healthy: false,
		});
	});

	it('uses owner kind and type in a get request', async () => {
		(backendClient.GET as Mock).mockResolvedValue({
			data: { data: moduleService },
			error: undefined,
			response: { status: 200 },
		});

		await store.get({
			extensionKind: ExtensionsModuleServiceOwnerKind.module,
			extensionType: 'mdns-module',
			serviceId: 'advertisement',
		});

		expect(backendClient.GET).toHaveBeenCalledWith(
			'/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}',
			{
				params: {
					path: {
						extensionKind: ExtensionsModuleServiceOwnerKind.module,
						extensionType: 'mdns-module',
						serviceId: 'advertisement',
					},
				},
			}
		);
	});

	it.each([
		['start', '/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}/start'],
		['stop', '/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}/stop'],
		['restart', '/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}/restart'],
	] as const)('uses owner route parameters to %s a service', async (action, path) => {
		(backendClient.POST as Mock).mockResolvedValue({
			data: { data: alwaysActiveService },
			error: undefined,
			response: { status: 200 },
		});

		await store[action]({
			extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
			extensionType: 'devices-home-assistant-plugin',
			serviceId: 'discovery',
		});

		expect(backendClient.POST).toHaveBeenCalledWith(path, {
			params: {
				path: {
					extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
					extensionType: 'devices-home-assistant-plugin',
					serviceId: 'discovery',
				},
			},
		});
	});

	it('preserves API failures and resets action semaphores', async () => {
		(backendClient.POST as Mock).mockResolvedValue({
			data: undefined,
			error: new Error('Restart failed'),
			response: { status: 500 },
		});

		await expect(
			store.restart({
				extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
				extensionType: 'devices-home-assistant-plugin',
				serviceId: 'connector',
			})
		).rejects.toThrow(ExtensionsApiException);

		expect(
			store.acting(ExtensionsModuleServiceOwnerKind.plugin, 'devices-home-assistant-plugin', 'connector')
		).toBe(false);
	});
});
