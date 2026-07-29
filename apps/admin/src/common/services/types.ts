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
	unlock?: () => Promise<boolean>;
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

/**
 * The slice of the socket.io client the connection helper needs. Keeping it structural lets the
 * helper be exercised without standing up a real socket.
 */
export interface IAuthenticatedSocket {
	connected: boolean;
	auth: Record<string, unknown> | ((cb: (data: object) => void) => void);
	connect(): unknown;
	disconnect(): unknown;
	// Mirrors the socket.io listener signature so the real client satisfies this structurally.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, listener: (...args: any[]) => void): unknown;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	off(event: string, listener: (...args: any[]) => void): unknown;
}

/**
 * The slice of the session store the connection helper needs.
 */
export interface ISocketSession {
	isExpired(): boolean;
	refresh(): Promise<boolean>;
	accessToken(): string | null;
}

export interface IConnectionRecovery {
	start(): void;
	stop(): void;
}

export interface IConnectionRecoveryOptions {
	socket: IAuthenticatedSocket;
	session: ISocketSession;
	/** Run after the socket comes back, to reconcile the events missed while it was down. */
	onReconnected?: () => Promise<void> | void;
	/** Run when the socket could not be brought back up. */
	onFailure?: () => void;
	/** Handshake timeout, in milliseconds. */
	timeout?: number;
	/** How long to wait after `connect` for a server side rejection, in milliseconds. */
	authGrace?: number;
}

export interface IRefreshableStore {
	/** Whether the store already holds data, i.e. whether refreshing it is worthwhile. */
	loaded: () => boolean;
	refresh: () => Promise<unknown>;
}

export type DataRefreshKey = symbol;

export type DataRefreshHandler = () => Promise<void>;

export type DataRefreshErrorHandler = (error: unknown) => void;

export interface IDataRefreshRegistry {
	register(key: DataRefreshKey, handler: DataRefreshHandler): void;

	unregister(key: DataRefreshKey): void;

	refreshAll(): Promise<void>;
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
