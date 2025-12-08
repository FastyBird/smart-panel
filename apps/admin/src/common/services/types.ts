/*
eslint-disable @typescript-eslint/no-empty-object-type
*/
import type { ComputedRef, InjectionKey } from 'vue';
import type { RouteLocationRaw, RouteRecordRaw } from 'vue-router';

import type { StateTree, Store } from 'pinia';

import type { IAppUser } from '../../app.types';

export interface IAccountManager {
	isSignedIn: ComputedRef<boolean>;
	isLocked: ComputedRef<boolean>;
	details: ComputedRef<IAppUser | null>;
	signIn: (credentials: { username: string; password: string }) => Promise<boolean>;
	signOut: () => Promise<boolean>;
	lock?: () => Promise<boolean>;
	canAccess: (resource: string, action: string) => Promise<boolean>;
	routes: {
		signIn: string;
		signUp: string;
		lock?: string;
		unlock?: string;
		edit?: string;
		security?: string;
	};
}

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

export interface IPluginElement<Components = {}, Schemas = {}> {
	type: string;
	name?: string;
	description?: string;
	components?: Components;
	schemas?: Schemas;
	modules?: string[];
}

export interface IPlugin<Components = {}, Schemas = {}, Routes = {}> {
	type: string;
	source: string;
	name: string;
	description: string;
	icon?: {
		small?: string;
		large?: string;
	};
	links: {
		documentation: string;
		devDocumentation: string;
		bugsTracking: string;
	};
	elements: IPluginElement<Components, Schemas>[];
	modules?: string[];
	routes?: Routes;
	isCore: boolean;
	version?: string;
	author?: string;
}

export type PluginInjectionKey<T extends IPlugin = IPlugin> = InjectionKey<T>;

export interface IPluginsManager {
	addPlugin<T extends IPlugin>(key: PluginInjectionKey<T>, plugin: T): void;

	getPlugin<T extends IPlugin>(key: PluginInjectionKey<T>): T;

	getPlugins<T extends IPlugin>(): T[];
}

export interface IModuleElement<Components = {}, Schemas = {}> {
	type: string;
	name?: string;
	description?: string;
	components?: Components;
	schemas?: Schemas;
	modules?: string[];
}

export interface IModule<Components = {}, Schemas = {}> {
	type: string;
	name: string;
	description?: string;
	elements: IModuleElement<Components, Schemas>[];
	modules?: string[];
	isCore?: boolean;
}

export type ModuleInjectionKey<T extends IModule = IModule> = InjectionKey<T>;

export interface IModulesManager {
	addModule<T extends IModule>(key: ModuleInjectionKey<T>, module: T): void;

	getModule<T extends IModule>(key: ModuleInjectionKey<T>): T;

	getModules<T extends IModule>(): T[];
}
