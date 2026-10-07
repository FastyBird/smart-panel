import { createPinia, setActivePinia } from 'pinia';

import createClient from 'openapi-fetch';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { paths } from '../../../openapi';
import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';
import { createSessionMiddleware } from '../../auth/auth.middleware';
import type { SessionStore } from '../../auth/store/session.store.types';
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
		vi.resetAllMocks();
	});

	afterEach(() => vi.useRealTimers());

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
		expect(store.findByKey(ExtensionsModuleServiceOwnerKind.plugin, 'devices-home-assistant-plugin', 'connector')).toEqual(service);
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

		expect(backendClient.GET).toHaveBeenCalledWith('/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}', {
			signal: expect.any(AbortSignal),
			params: {
				path: {
					extensionKind: ExtensionsModuleServiceOwnerKind.module,
					extensionType: 'mdns-module',
					serviceId: 'advertisement',
				},
			},
		});
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
			signal: expect.any(AbortSignal),
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

		expect(store.acting(ExtensionsModuleServiceOwnerKind.plugin, 'devices-home-assistant-plugin', 'connector')).toBe(false);
	});
	it.each(['start', 'stop', 'restart'] as const)('aborts a lost %s reply, releases busy and allows retry', async (action) => {
		vi.useFakeTimers();
		const payload = {
			extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
			extensionType: 'remote-access-cloudflare-tunnel-plugin',
			serviceId: 'tunnel',
		};
		let signal: AbortSignal | undefined;
		backendClient.POST.mockImplementationOnce((_path, options: { signal?: AbortSignal }) => {
			signal = options?.signal;
			return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal?.reason), { once: true }));
		});
		const pending = store[action](payload);
		const rejected = expect(pending).rejects.toThrow('Service action request timed out.');
		expect(store.acting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(true);
		await vi.advanceTimersByTimeAsync(59_999);
		expect(signal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(signal?.aborted).toBe(true);
		await rejected;
		expect(store.acting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		backendClient.POST.mockResolvedValueOnce({ data: { data: pluginService }, response: { status: 200 } });
		await store[action](payload);
		expect(backendClient.POST).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(['get', 'fetch'] as const)('aborts a lost %s reply and releases its coalesced request for refresh', async (action) => {
		vi.useFakeTimers();
		const payload = {
			extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
			extensionType: 'remote-access-cloudflare-tunnel-plugin',
			serviceId: 'tunnel',
		};
		let signal: AbortSignal | undefined;
		backendClient.GET.mockImplementationOnce((_path, options: { signal?: AbortSignal }) => {
			signal = options?.signal;
			return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal?.reason), { once: true }));
		});
		const request = () => (action === 'get' ? store.get(payload) : store.fetch());
		const pending = request();
		const duplicate = request();
		const rejected = expect(pending).rejects.toThrow('Service status request timed out.');
		const duplicateRejected = expect(duplicate).rejects.toThrow('Service status request timed out.');
		expect(backendClient.GET).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(signal?.aborted).toBe(true);
		await rejected;
		await duplicateRejected;
		expect(store.fetching()).toBe(false);
		expect(store.getting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		backendClient.GET.mockResolvedValueOnce({ data: { data: action === 'get' ? pluginService : [pluginService] }, response: { status: 200 } });
		await request();
		expect(backendClient.GET).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('keeps an outstanding lifecycle action local to its Pinia instance', async () => {
		vi.useFakeTimers();
		const payload = {
			extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
			extensionType: 'remote-access-cloudflare-tunnel-plugin',
			serviceId: 'tunnel',
		};
		backendClient.POST.mockImplementationOnce(
			(_path, options: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
		);
		const pending = store.start(payload);
		const rejected = expect(pending).rejects.toThrow('Service action request timed out.');
		const other = useServices(createPinia());
		expect(other.acting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(false);
		backendClient.POST.mockResolvedValueOnce({ data: { data: pluginService }, response: { status: 200 } });
		await other.start(payload);
		expect(store.acting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(true);
		await vi.advanceTimersByTimeAsync(60_000);
		await rejected;
	});
	it.each(['start', 'stop', 'restart', 'get', 'fetch'] as const)(
		'bounds %s blocked in the real client auth middleware and prevents late transport/state writes',
		async (action) => {
			vi.useFakeTimers();
			let releaseRefresh!: (value: boolean) => void;
			const refresh = new Promise<boolean>((resolve) => {
				releaseRefresh = resolve;
			});
			const isExpired = vi.fn(() => true);
			const session = {
				tokenPair: { accessToken: 'test-token' },
				isExpired,
				refresh: vi.fn(() => refresh),
				clear: vi.fn(),
			} as unknown as SessionStore;
			const sent = vi.fn();
			const transport = vi.fn(async (request: Request) => {
				// Native fetch rejects an already-aborted request before sending it.
				request.signal.throwIfAborted();
				sent(request.method);
				return Response.json({ data: action === 'fetch' ? [pluginService] : pluginService });
			});
			const client = createClient<paths>({ baseUrl: 'http://backend.test', fetch: transport });
			client.use(createSessionMiddleware(session));
			backendClient.GET.mockImplementation(client.GET);
			backendClient.POST.mockImplementation(client.POST);
			const payload = {
				extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
				extensionType: 'remote-access-cloudflare-tunnel-plugin',
				serviceId: 'tunnel',
			};
			const request = () => (action === 'fetch' ? store.fetch() : store[action](payload));
			const pending = request();
			const rejected = expect(pending).rejects.toThrow('request timed out.');
			const duplicate = action === 'get' || action === 'fetch' ? request().catch((error: unknown) => error) : null;
			await vi.advanceTimersByTimeAsync(action === 'get' || action === 'fetch' ? 20_000 : 60_000);
			await rejected;
			if (duplicate) expect(await duplicate).toBeInstanceOf(Error);
			expect(transport).not.toHaveBeenCalled();
			expect(store.fetching()).toBe(false);
			expect(store.getting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(false);
			expect(store.acting(payload.extensionKind, payload.extensionType, payload.serviceId)).toBe(false);
			expect(vi.getTimerCount()).toBe(0);
			isExpired.mockReturnValue(false);
			await request();
			const recoveredData = { ...store.data };
			expect(sent).toHaveBeenCalledTimes(1);
			releaseRefresh(true);
			await vi.advanceTimersByTimeAsync(0);
			expect(transport).toHaveBeenCalledTimes(2);
			expect(sent).toHaveBeenCalledTimes(1);
			expect(store.data).toEqual(recoveredData);
		}
	);

	it.each(['start', 'stop', 'restart', 'get', 'fetch'] as const)(
		'ignores a late %s response even when the transport ignores abort',
		async (action) => {
			vi.useFakeTimers();
			let resolveResponse!: (response: unknown) => void;
			const deferred = new Promise((resolve) => {
				resolveResponse = resolve;
			});
			const method = action === 'get' || action === 'fetch' ? backendClient.GET : backendClient.POST;
			method.mockReturnValueOnce(deferred);
			const payload = {
				extensionKind: ExtensionsModuleServiceOwnerKind.plugin,
				extensionType: pluginService.extension_type,
				serviceId: pluginService.service_id,
			};
			const pending = action === 'fetch' ? store.fetch() : store[action](payload);
			const rejected = expect(pending).rejects.toThrow('request timed out.');
			await vi.advanceTimersByTimeAsync(action === 'get' || action === 'fetch' ? 20_000 : 60_000);
			await rejected;
			resolveResponse({ data: { data: action === 'fetch' ? [pluginService] : pluginService }, response: { status: 200 } });
			await vi.advanceTimersByTimeAsync(0);
			expect(store.data).toEqual({});
			expect(store.firstLoadFinished()).toBe(false);
		}
	);
});
