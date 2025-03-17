/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { StateTree, Store } from 'pinia';

import type { IStoresManager, StoreInjectionKey } from './types';

export const storesManagerKey: InjectionKey<StoresManager | undefined> = Symbol('FB-App-StoresManager');

export class StoresManager implements IStoresManager {
	private stores: Map<StoreInjectionKey<string, any, any, any>, Store<string, any, any, any>> = new Map();

	public addStore<Id extends string = string, S extends StateTree = object, G = object, A = object>(
		key: StoreInjectionKey<Id, S, G, A>,
		store: Store<Id, S, G, A>
	): void {
		this.stores.set(key, store);
	}

	public getStore<Id extends string = string, S extends StateTree = object, G = object, A = object>(
		key: StoreInjectionKey<Id, S, G, A>
	): Store<Id, S, G, A> {
		if (!this.stores.has(key)) {
			throw new Error('Something went wrong, store is not registered');
		}

		return this.stores.get(key) as Store<Id, S, G, A>;
	}
}

export const injectStoresManager = (app?: App): StoresManager => {
	if (app && app._context && app._context.provides && app._context.provides[storesManagerKey]) {
		return app._context.provides[storesManagerKey];
	}

	if (hasInjectionContext()) {
		const manager = _inject(storesManagerKey, undefined);

		if (manager) {
			return manager;
		}
	}

	throw new Error('A stores manager has not been provided.');
};

export const provideStoresManager = (app: App, manager: StoresManager): void => {
	app.provide(storesManagerKey, manager);
};
