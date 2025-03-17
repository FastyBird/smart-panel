import type { InjectionKey } from 'vue';
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import type { StateTree, Store } from 'pinia';

import type { IAppUser } from '../../app.types';

export type StoreInjectionKey<Id extends string = string, S extends StateTree = object, G = object, A = object> = InjectionKey<Store<Id, S, G, A>>;

export interface IStoresManager {
	addStore<Id extends string = string, S extends StateTree = object, G = object, A = object>(
		key: StoreInjectionKey<Id, S, G, A>,
		store: Store<Id, S, G, A>
	): void;

	getStore<Id extends string = string, S extends StateTree = object, G = object, A = object>(key: StoreInjectionKey<Id, S, G, A>): Store<Id, S, G, A>;
}

export interface IRouterGuards {
	register: (guard: RouteGuard) => void;
	handle: (appUser: IAppUser | undefined, to: RouteRecordRaw) => Error | boolean | RouteLocationRaw;
}

export type RouteGuard = (appUser: IAppUser | undefined, route: RouteRecordRaw) => Error | boolean | RouteLocationRaw;
