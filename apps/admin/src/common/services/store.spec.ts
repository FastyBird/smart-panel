/*
eslint-disable @typescript-eslint/no-explicit-any,
vue/one-component-per-file
*/
import { createApp, hasInjectionContext, inject } from 'vue';

import { type Store, createPinia, defineStore, setActivePinia } from 'pinia';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoresManager, injectStoresManager, provideStoresManager, storesManagerKey } from './store';

vi.mock('vue', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue')>();
	return {
		...actual,
		inject: vi.fn(actual.inject),
		hasInjectionContext: vi.fn(() => false),
	};
});

describe('Store Service', () => {
	it('provides and injects store manager correctly', () => {
		const app = createApp({});
		const mockStoreManager = new StoresManager();

		// Provide store manager
		provideStoresManager(app, mockStoreManager);

		// Ensure the client is provided in Vue app context
		expect(app._context.provides[storesManagerKey]).toBe(mockStoreManager);
	});

	it('injects store manager from app context', () => {
		const app = createApp({});
		const mockStoreManager = new StoresManager();

		// Provide store manager
		provideStoresManager(app, mockStoreManager);

		// Inject store manager
		const injectedClient = injectStoresManager(app);

		expect(injectedClient).toBe(mockStoreManager);
	});

	it('injects store manager via Vue injection', () => {
		const mockStoreManager = new StoresManager();

		vi.mocked(inject).mockReturnValue(mockStoreManager);
		vi.mocked(hasInjectionContext).mockReturnValue(true);

		expect(injectStoresManager()).toBe(mockStoreManager);
	});

	it('throws error if store manager is not provided', () => {
		vi.mocked(hasInjectionContext).mockReturnValue(false);

		expect(() => injectStoresManager()).toThrowError('A stores manager has not been provided.');
	});

	it('throws error if store manager is not provided', () => {
		vi.mocked(inject).mockReturnValue(undefined);

		expect(() => injectStoresManager()).toThrowError('A stores manager has not been provided.');
	});
});

describe('StoresManager', () => {
	let storesManager: StoresManager;
	let mockStore: Store<any, any, any, any>;

	beforeEach(() => {
		const pinia = createPinia();
		setActivePinia(pinia);

		storesManager = new StoresManager();

		mockStore = defineStore('test', { state: () => ({ value: 42 }) })();

		vi.clearAllMocks();
	});

	it('should add and retrieve a store', () => {
		storesManager.addStore(storesManagerKey, mockStore);

		const retrievedStore = storesManager.getStore(storesManagerKey);

		expect(retrievedStore).toBe(mockStore);
	});

	it('should throw an error when getting an unregistered store', () => {
		expect(() => storesManager.getStore(storesManagerKey)).toThrowError('Something went wrong, store is not registered');
	});
});
