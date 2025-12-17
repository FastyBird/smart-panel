import { createPinia, setActivePinia } from 'pinia';

import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionKind, EXTENSIONS_MODULE_PREFIX } from '../extensions.constants';
import { ExtensionsApiException, ExtensionsValidationException } from '../extensions.exceptions';

import type { IExtensionRes } from './extensions.store.types';
import { useExtensions } from './extensions.store';

const mockExtensionRes: IExtensionRes = {
	type: 'devices-module',
	kind: 'module',
	name: 'Devices Module',
	description: 'Manage devices',
	version: '1.0.0',
	author: 'FastyBird',
	enabled: true,
	is_core: true,
	can_toggle_enabled: false,
};

const mockPluginRes: IExtensionRes = {
	type: 'pages-tiles-plugin',
	kind: 'plugin',
	name: 'Pages Tiles Plugin',
	enabled: true,
	is_core: true,
	can_toggle_enabled: true,
};

const backendClient = {
	GET: vi.fn(),
	PATCH: vi.fn(),
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

describe('Extensions Store', () => {
	let store: ReturnType<typeof useExtensions>;

	beforeEach(() => {
		setActivePinia(createPinia());

		store = useExtensions();

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
		it('should set extension data successfully', () => {
			const extension = {
				type: 'test-module',
				kind: ExtensionKind.MODULE,
				name: 'Test Module',
				enabled: true,
				isCore: false,
				canToggleEnabled: true,
			};

			const result = store.set({ type: extension.type, data: extension });

			expect(result.type).toBe('test-module');
			expect(store.data['test-module']).toEqual(extension);
		});

		it('should update existing extension', () => {
			const extension = {
				type: 'test-module',
				kind: ExtensionKind.MODULE,
				name: 'Test Module',
				enabled: true,
				isCore: false,
				canToggleEnabled: true,
			};

			store.set({ type: extension.type, data: extension });

			const updated = store.set({
				type: extension.type,
				data: { ...extension, enabled: false },
			});

			expect(updated.enabled).toBe(false);
			expect(store.data['test-module'].enabled).toBe(false);
		});

		it('should throw validation error for invalid data', () => {
			expect(() =>
				store.set({
					type: 'test',
					data: { type: 'test', kind: 'invalid' } as never,
				})
			).toThrow(ExtensionsValidationException);
		});
	});

	describe('findAll', () => {
		it('should return all extensions', () => {
			store.set({
				type: 'module-1',
				data: {
					type: 'module-1',
					kind: ExtensionKind.MODULE,
					name: 'Module 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			store.set({
				type: 'plugin-1',
				data: {
					type: 'plugin-1',
					kind: ExtensionKind.PLUGIN,
					name: 'Plugin 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			const all = store.findAll();

			expect(all).toHaveLength(2);
		});
	});

	describe('findByKind', () => {
		it('should return only modules', () => {
			store.set({
				type: 'module-1',
				data: {
					type: 'module-1',
					kind: ExtensionKind.MODULE,
					name: 'Module 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			store.set({
				type: 'plugin-1',
				data: {
					type: 'plugin-1',
					kind: ExtensionKind.PLUGIN,
					name: 'Plugin 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			const modules = store.findByKind(ExtensionKind.MODULE);

			expect(modules).toHaveLength(1);
			expect(modules[0].type).toBe('module-1');
		});

		it('should return only plugins', () => {
			store.set({
				type: 'module-1',
				data: {
					type: 'module-1',
					kind: ExtensionKind.MODULE,
					name: 'Module 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			store.set({
				type: 'plugin-1',
				data: {
					type: 'plugin-1',
					kind: ExtensionKind.PLUGIN,
					name: 'Plugin 1',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			const plugins = store.findByKind(ExtensionKind.PLUGIN);

			expect(plugins).toHaveLength(1);
			expect(plugins[0].type).toBe('plugin-1');
		});
	});

	describe('findByType', () => {
		it('should return extension by type', () => {
			store.set({
				type: 'test-module',
				data: {
					type: 'test-module',
					kind: ExtensionKind.MODULE,
					name: 'Test Module',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			const extension = store.findByType('test-module');

			expect(extension).not.toBeNull();
			expect(extension?.type).toBe('test-module');
		});

		it('should return null for unknown type', () => {
			const extension = store.findByType('unknown-module');

			expect(extension).toBeNull();
		});
	});

	describe('get', () => {
		it('should fetch single extension successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockExtensionRes },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.get({ type: 'devices-module' });

			expect(result.type).toBe('devices-module');
			expect(result.kind).toBe(ExtensionKind.MODULE);
			expect(store.data['devices-module']).toBeDefined();
			expect(backendClient.GET).toHaveBeenCalledWith(`/${EXTENSIONS_MODULE_PREFIX}/extensions/{type}`, {
				params: { path: { type: 'devices-module' } },
			});
		});

		it('should throw error on fetch failure', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Network error'),
				response: { status: 500 },
			});

			await expect(store.get({ type: 'devices-module' })).rejects.toThrow(ExtensionsApiException);
		});

		it('should deduplicate concurrent requests', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockExtensionRes },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.get({ type: 'devices-module' });
			const promise2 = store.get({ type: 'devices-module' });

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('fetch', () => {
		it('should fetch all extensions successfully', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockExtensionRes, mockPluginRes] },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.fetch();

			expect(result).toHaveLength(2);
			expect(store.firstLoadFinished()).toBe(true);
			expect(store.data['devices-module']).toBeDefined();
			expect(store.data['pages-tiles-plugin']).toBeDefined();
		});

		it('should fetch only modules when kind is MODULE', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch({ kind: ExtensionKind.MODULE });

			expect(backendClient.GET).toHaveBeenCalledWith(`/${EXTENSIONS_MODULE_PREFIX}/extensions/modules`);
		});

		it('should fetch only plugins when kind is PLUGIN', async () => {
			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: [mockPluginRes] },
				error: undefined,
				response: { status: 200 },
			});

			await store.fetch({ kind: ExtensionKind.PLUGIN });

			expect(backendClient.GET).toHaveBeenCalledWith(`/${EXTENSIONS_MODULE_PREFIX}/extensions/plugins`);
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
				data: { data: [mockExtensionRes] },
				error: undefined,
				response: { status: 200 },
			});

			const promise1 = store.fetch();
			const promise2 = store.fetch();

			await Promise.all([promise1, promise2]);

			expect(backendClient.GET).toHaveBeenCalledTimes(1);
		});
	});

	describe('update', () => {
		it('should update extension enabled status successfully', async () => {
			// First set the extension in state
			store.set({
				type: 'devices-module',
				data: {
					type: 'devices-module',
					kind: ExtensionKind.MODULE,
					name: 'Devices Module',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			(backendClient.PATCH as Mock).mockResolvedValue({
				data: { data: { ...mockExtensionRes, enabled: false } },
				error: undefined,
				response: { status: 200 },
			});

			const result = await store.update({
				type: 'devices-module',
				data: { enabled: false },
			});

			expect(result.enabled).toBe(false);
			expect(store.data['devices-module'].enabled).toBe(false);
		});

		it('should throw validation error for invalid payload', async () => {
			await expect(
				store.update({
					type: 'devices-module',
					data: { enabled: 'invalid' } as never,
				})
			).rejects.toThrow(ExtensionsValidationException);
		});

		it('should throw error on update failure', async () => {
			store.set({
				type: 'devices-module',
				data: {
					type: 'devices-module',
					kind: ExtensionKind.MODULE,
					name: 'Devices Module',
					enabled: true,
					isCore: false,
					canToggleEnabled: true,
				},
			});

			(backendClient.PATCH as Mock).mockResolvedValue({
				data: undefined,
				error: new Error('Update failed'),
				response: { status: 500 },
			});

			(backendClient.GET as Mock).mockResolvedValue({
				data: { data: mockExtensionRes },
				error: undefined,
				response: { status: 200 },
			});

			await expect(
				store.update({
					type: 'devices-module',
					data: { enabled: false },
				})
			).rejects.toThrow(ExtensionsApiException);
		});
	});

	describe('semaphore states', () => {
		it('should track fetching state during fetch', async () => {
			let fetchingDuringRequest = false;

			(backendClient.GET as Mock).mockImplementation(async () => {
				fetchingDuringRequest = store.fetching();

				return {
					data: { data: [mockExtensionRes] },
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
				gettingDuringRequest = store.getting('devices-module');

				return {
					data: { data: mockExtensionRes },
					error: undefined,
					response: { status: 200 },
				};
			});

			await store.get({ type: 'devices-module' });

			expect(gettingDuringRequest).toBe(true);
			expect(store.getting('devices-module')).toBe(false);
		});
	});
});
