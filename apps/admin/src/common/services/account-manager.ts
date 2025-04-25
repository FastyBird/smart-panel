import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { IAccountManager } from './types';

export * from './types';

const accountManagerKey: InjectionKey<IAccountManager | undefined> = Symbol('Tools-AccountManager');

export function injectAccountManager(app?: App): IAccountManager | undefined {
	if (app && app._context && app._context.provides && app._context.provides[accountManagerKey]) {
		return app._context.provides[accountManagerKey];
	}

	if (hasInjectionContext()) {
		return _inject(accountManagerKey, undefined);
	}

	return undefined;
}

export function provideAccountManager(app: App, manager: IAccountManager): void {
	app.provide(accountManagerKey, manager);
}
