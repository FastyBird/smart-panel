/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { IModule, IModulesManager, ModuleInjectionKey } from './types';

export const modulesManagerKey: InjectionKey<ModulesManager | undefined> = Symbol('FB-App-ModulesManager');

export class ModulesManager implements IModulesManager {
	private modules = new Map<ModuleInjectionKey<any>, IModule>();

	addModule<T extends IModule>(key: ModuleInjectionKey<T>, module: T): void {
		this.modules.set(key, module);
	}

	getModule<T extends IModule>(key: ModuleInjectionKey<T>): T {
		if (!this.modules.has(key)) {
			throw new Error('Module is not registered');
		}

		return this.modules.get(key) as T;
	}

	getModules<T extends IModule>(): T[] {
		return Array.from(this.modules.values()) as T[];
	}
}

export const injectModulesManager = (app?: App): ModulesManager => {
	if (app && app._context && app._context.provides && app._context.provides[modulesManagerKey]) {
		return app._context.provides[modulesManagerKey];
	}

	if (hasInjectionContext()) {
		const manager = _inject(modulesManagerKey, undefined);

		if (manager) {
			return manager;
		}
	}

	throw new Error('A modules manager has not been provided.');
};

export const provideModulesManager = (app: App, manager: ModulesManager): void => {
	app.provide(modulesManagerKey, manager);
};

