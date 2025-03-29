/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { IPlugin, IPluginsManager, PluginInjectionKey } from './types';

export const pluginsManagerKey: InjectionKey<PluginsManager | undefined> = Symbol('FB-App-PluginsManager');

export class PluginsManager implements IPluginsManager {
	private plugins = new Map<PluginInjectionKey<any>, IPlugin>();

	addPlugin<T extends IPlugin>(key: PluginInjectionKey<T>, plugin: T): void {
		this.plugins.set(key, plugin);
	}

	getPlugin<T extends IPlugin>(key: PluginInjectionKey<T>): T {
		if (!this.plugins.has(key)) {
			throw new Error('Plugin is not registered');
		}

		return this.plugins.get(key) as T;
	}

	getPlugins<T extends IPlugin>(): T[] {
		return Array.from(this.plugins.values()) as T[];
	}
}

export const injectPluginsManager = (app?: App): PluginsManager => {
	if (app && app._context && app._context.provides && app._context.provides[pluginsManagerKey]) {
		return app._context.provides[pluginsManagerKey];
	}

	if (hasInjectionContext()) {
		const manager = _inject(pluginsManagerKey, undefined);

		if (manager) {
			return manager;
		}
	}

	throw new Error('A plugins manager has not been provided.');
};

export const providePluginsManager = (app: App, manager: PluginsManager): void => {
	app.provide(pluginsManagerKey, manager);
};
