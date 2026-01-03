import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionsModuleServiceState } from '../../../openapi.constants';
import { ExtensionsApiException, ExtensionsValidationException } from '../extensions.exceptions';

import type { IServiceRes } from './services.store.types';
import { useServices } from './services.store';

const mockServiceRes: IServiceRes = {
	plugin_name: 'devices-shelly-v1',
	service_id: 'connector',
	state: 'started',
	enabled: true,
	healthy: true,
	last_started_at: '2025-01-15T10:30:00.000Z',
	start_count: 5,
	uptime_ms: 3600000,
};

const mockStoppedServiceRes: IServiceRes = {
	plugin_name: 'devices-home-assistant',
	service_id: 'connector',
	state: 'stopped',
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
		useBackend: vi.fn(() => ({
			client: backendClient,
		})),
		useLogger: vi.fn(() => ({
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		})),
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

	describe('initial state', () => {
		it('should have empty initial state', () => {
			expect(store.data).toEqual({});
			expect(store.firstLoadFinished()).toBe(false);
			expect(store.fetching()).toBe(false);
		});
	});

	describe('set', () => {
		it('should set service data successfully', () => {
			const service = {
				pluginName: 'test-plugin',
				serviceId: 'main',
				state: ExtensionsModuleServiceState.started,
				enabled: true,
				startCount: 1,
			};

			const result = store.set({ pluginName: service.pluginName, serviceId: service.serviceId, data: service });

			expect(result.pluginName).toBe('test-plugin');
			expect(store.data['test-plugin:main']).toEqual(service);
		});

		it('should update existing service', () => {
			const service = {
				pluginName: 'test-plugin',
				serviceId: 'main',
				state: ExtensionsModuleServiceState.started,
				enabled: true,
				startCount: 1,
			};

			store.set({ pluginName: service.pluginName, serviceId: service.serviceId, data: service });

			const updated = store.set({
				pluginName: service.pluginName,
				serviceId: service.serviceId,
				data: { ...service, state: ExtensionsModuleServiceState.stopped },
			});

			expect(updated.state).toBe(ExtensionsModuleServiceState.stopped);
			expect(store.data['test-plugin:main']?.state).toBe(ExtensionsModuleServiceState.stopped);
		});

		it('should throw validation error for invalid data', () => {
			expect(() =>
				store.set({
					pluginName: 'test',
					serviceId: 'main',
					data: { pluginName: 'test', serviceId: 'main', state: 'invalid' } as never,
				})
			).toThrow(ExtensionsValidationException);
		});
	});

	describe('findAll', () => {
		it('should return all services', () => {
			store.set({
				pluginName: 'plugin-1',
				serviceId: 'main',
				data: {
					pluginName: 'plugin-1',
					serviceId: 'main',
					state: ExtensionsModuleServiceState.started,
					enabled: true,
					startCount: 1,
				},
			});

			store.set({
				pluginName: 'plugin-2',
				serviceId: 'connector',
				data: {
					pluginName: 'plugin-2',
					serviceId: 'connector',
					state: ExtensionsModuleServiceState.stopped,
					enabled: false,
					startCount: 0,
				},
			});

			const all = store.findAll();

			expect(all).toHaveLength(2);
		});
	});

	describe('findByKey', () => {
		it('should return service by key', () => {
			store.set({
				pluginName: 'test-plugin',
				serviceId: 'main',
				data: {
					pluginName: 'test-plugin',
					serviceId: 'main',
					state: ExtensionsModuleServiceState.started,
					enabled: true,
					startCount: 1,
				},
			});

			const service = store.findByKey('test-plugin', 'main');

			expect(service).not.toBeNull();
			expect(service?.pluginName).toBe('test-plugin');
		});

		it('should return null for unknown service', () => {
			const service = store.findByKey('unknown-plugin', 'unknown-service');

			expect(service).toBeNull();
		});
	});

	describe('get', () => {
		it('should fetch single service successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockServiceRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			expect(result.pluginName).toBe('devices-shelly-v1');
			expect(result.state).toBe(ExtensionsModuleServiceState.started);
			expect(store.data['devices-shelly-v1:connector']).toBeDefined();
		});

		it('should throw error on fetch failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.get({ pluginName: 'devices-shelly-v1', serviceId: 'connector' })).rejects.toThrow(
				ExtensionsApiException
			);
		});

		it('should deduplicate concurrent requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockServiceRes },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.get({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });
			const promise2 = store.get({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('fetch', () => {
		it('should fetch all services successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockServiceRes, mockStoppedServiceRes] },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.fetch();

			expect(result).toHaveLength(2);
			expect(store.firstLoadFinished()).toBe(true);
			expect(store.data['devices-shelly-v1:connector']).toBeDefined();
			expect(store.data['devices-home-assistant:connector']).toBeDefined();
		});

		it('should throw error on fetch failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.fetch()).rejects.toThrow(ExtensionsApiException);
		});

		it('should deduplicate concurrent fetch requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockServiceRes] },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.fetch();
			const promise2 = store.fetch();

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('start', () => {
		it('should start service successfully', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: { data: { ...mockStoppedServiceRes, state: 'started', enabled: true } },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.start({ pluginName: 'devices-home-assistant', serviceId: 'connector' });

			expect(result.state).toBe(ExtensionsModuleServiceState.started);
			expect(backendClient.POST).toHaveBeenCalledWith('/modules/extensions/services/{pluginName}/{serviceId}/start', {
				params: { path: { pluginName: 'devices-home-assistant', serviceId: 'connector' } },
			});
		});

		it('should throw error on start failure', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Start failed'),
				response: { status: 500 },
			});

			await expect(store.start({ pluginName: 'devices-home-assistant', serviceId: 'connector' })).rejects.toThrow(
				ExtensionsApiException
			);
		});
	});

	describe('stop', () => {
		it('should stop service successfully', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: { data: { ...mockServiceRes, state: 'stopped' } },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.stop({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			expect(result.state).toBe(ExtensionsModuleServiceState.stopped);
			expect(backendClient.POST).toHaveBeenCalledWith('/modules/extensions/services/{pluginName}/{serviceId}/stop', {
				params: { path: { pluginName: 'devices-shelly-v1', serviceId: 'connector' } },
			});
		});

		it('should throw error on stop failure', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Stop failed'),
				response: { status: 500 },
			});

			await expect(store.stop({ pluginName: 'devices-shelly-v1', serviceId: 'connector' })).rejects.toThrow(
				ExtensionsApiException
			);
		});
	});

	describe('restart', () => {
		it('should restart service successfully', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: { data: mockServiceRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.restart({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			expect(result.state).toBe(ExtensionsModuleServiceState.started);
			expect(backendClient.POST).toHaveBeenCalledWith('/modules/extensions/services/{pluginName}/{serviceId}/restart', {
				params: { path: { pluginName: 'devices-shelly-v1', serviceId: 'connector' } },
			});
		});

		it('should throw error on restart failure', async () => {
			(backendClient.POST as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Restart failed'),
				response: { status: 500 },
			});

			await expect(store.restart({ pluginName: 'devices-shelly-v1', serviceId: 'connector' })).rejects.toThrow(
				ExtensionsApiException
			);
		});
	});

	describe('semaphore states', () => {
		it('should track fetching state during fetch', async () => {
			let fetchingDuringRequest = false;

			(backendClient.GET as Mock).mockImplementation(async () => {
				fetchingDuringRequest = store.fetching();

				return {
					data: { data: [mockServiceRes] },
					error: undefined,
					response: { status: 200 },
				};
			});

			await store.fetch();

			expect(fetchingDuringRequest).toBe(true);
			expect(store.fetching()).toBe(false);
		});

		it('should track getting state during get', async () => {
			let gettingDuringRequest = false;

			(backendClient.GET as Mock).mockImplementation(async () => {
				gettingDuringRequest = store.getting('devices-shelly-v1', 'connector');

				return {
					data: { data: mockServiceRes },
					error: undefined,
					response: { status: 200 },
				};
			});

			await store.get({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			expect(gettingDuringRequest).toBe(true);
			expect(store.getting('devices-shelly-v1', 'connector')).toBe(false);
		});

		it('should track acting state during start', async () => {
			let actingDuringRequest = false;

			(backendClient.POST as Mock).mockImplementation(async () => {
				actingDuringRequest = store.acting('devices-shelly-v1', 'connector');

				return {
					data: { data: mockServiceRes },
					error: undefined,
					response: { status: 200 },
				};
			});

			await store.start({ pluginName: 'devices-shelly-v1', serviceId: 'connector' });

			expect(actingDuringRequest).toBe(true);
			expect(store.acting('devices-shelly-v1', 'connector')).toBe(false);
		});
	});
});
