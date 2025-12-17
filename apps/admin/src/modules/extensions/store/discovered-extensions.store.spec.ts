import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionKind, ExtensionSource, ExtensionSurface, EXTENSIONS_MODULE_PREFIX } from '../extensions.constants';
import { ExtensionsApiException } from '../extensions.exceptions';

import type { IDiscoveredExtensionRes } from './discovered-extensions.store.types';
import { useDiscoveredExtensions } from './discovered-extensions.store';

const mockAdminExtensionRes: IDiscoveredExtensionRes = {
	name: 'test-module',
	kind: ExtensionKind.MODULE,
	surface: ExtensionSurface.ADMIN,
	display_name: 'Test Module',
	description: 'A test module',
	version: '1.0.0',
	source: ExtensionSource.BUNDLED,
	remote_url: 'http://localhost:3000',
	type: 'admin',
};

const mockBackendExtensionRes: IDiscoveredExtensionRes = {
	name: 'test-module',
	kind: ExtensionKind.MODULE,
	surface: ExtensionSurface.BACKEND,
	display_name: 'Test Module',
	description: 'A test module',
	version: '1.0.0',
	source: ExtensionSource.BUNDLED,
	route_prefix: '/api/v1/test-module',
	type: 'backend',
};

const backendClient = {
	GET: vi.fn(),
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

describe('Discovered Extensions Store', () => {
	let store: ReturnType<typeof useDiscoveredExtensions>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useDiscoveredExtensions();

		vi.clearAllMocks();
	});

	describe('initial state', () => {
		it('should have empty initial state', () => {
			expect(store.data).toEqual({});
			expect(store.firstLoadFinished()).toBe(false);
			expect(store.fetching()).toBe(false);
		});
	});

	describe('findAll', () => {
		it('should return all discovered extensions', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockAdminExtensionRes, mockBackendExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch();

			const all = store.findAll();

			expect(all).toHaveLength(1);
			expect(all[0].admin).toBeDefined();
			expect(all[0].backend).toBeDefined();
		});
	});

	describe('findByName', () => {
		it('should return extension by name', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockAdminExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch();

			const extension = store.findByName('test-module');

			expect(extension).not.toBeNull();
			expect(extension?.admin).toBeDefined();
		});

		it('should return null for unknown name', () => {
			const extension = store.findByName('unknown-module');

			expect(extension).toBeNull();
		});
	});

	describe('get', () => {
		it('should fetch single discovered extension successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockAdminExtensionRes, mockBackendExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get({ name: 'test-module' });

			expect(result.admin).toBeDefined();
			expect(result.backend).toBeDefined();
			expect(store.data['test-module']).toBeDefined();
		});

		it('should throw error on fetch failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.get({ name: 'test-module' })).rejects.toThrow(ExtensionsApiException);
		});

		it('should deduplicate concurrent requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockAdminExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.get({ name: 'test-module' });
			const promise2 = store.get({ name: 'test-module' });

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('fetch', () => {
		it('should fetch all discovered extensions successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockAdminExtensionRes, mockBackendExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.fetch();

			expect(result).toHaveLength(1);
			expect(store.firstLoadFinished()).toBe(true);
			expect(store.data['test-module']).toBeDefined();
			expect(store.data['test-module'].admin).toBeDefined();
			expect(store.data['test-module'].backend).toBeDefined();
			expect(backendClient.GET).toHaveBeenCalledWith(`/${EXTENSIONS_MODULE_PREFIX}/discovered`);
		});

		it('should merge admin and backend extensions by name', async () => {
			const adminExt: IDiscoveredExtensionRes = {
				...mockAdminExtensionRes,
				name: 'devices-module',
			};

			const backendExt: IDiscoveredExtensionRes = {
				...mockBackendExtensionRes,
				name: 'devices-module',
			};

			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [adminExt, backendExt] },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch();

			expect(Object.keys(store.data)).toHaveLength(1);
			expect(store.data['devices-module'].admin).toBeDefined();
			expect(store.data['devices-module'].backend).toBeDefined();
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
				data: { data: [mockAdminExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.fetch();
			const promise2 = store.fetch();

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('semaphore states', () => {
		it('should track fetching state during fetch', async () => {
			let fetchingDuringRequest = false;

			(backendClient.GET as Mock).mockImplementation(async () => {
				fetchingDuringRequest = store.fetching();

				return {
					data: { data: [mockAdminExtensionRes] },
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
				gettingDuringRequest = store.getting('test-module');

				return {
					data: { data: [mockAdminExtensionRes] },
					error: undefined,
					response: { status: 200 },
				};
			});

			await store.get({ name: 'test-module' });

			expect(gettingDuringRequest).toBe(true);
			expect(store.getting('test-module')).toBe(false);
		});
	});
});
