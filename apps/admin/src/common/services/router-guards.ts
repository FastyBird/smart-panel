import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import type { IAppUser } from '../../app.types';

import type { IRouterGuards, RouteGuard } from './types';

export const routerGuardKey: InjectionKey<RouterGuards | undefined> = Symbol('FB-App-RouterGuard');

export class RouterGuards implements IRouterGuards {
	private readonly guards: RouteGuard[] = [];

	public register(guard: RouteGuard): void {
		this.guards.push(guard);
	}

	public handle(appUser: IAppUser | undefined, to: RouteRecordRaw) {
		for (const guard of this.guards) {
			const result = guard(appUser, to);

			if (result !== true) {
				return result;
			}
		}

		return true;
	}
}

export const injectRouterGuard = (app?: App): RouterGuards => {
	if (app && app._context && app._context.provides && app._context.provides[routerGuardKey]) {
		return app._context.provides[routerGuardKey];
	}

	if (hasInjectionContext()) {
		const manager = _inject(routerGuardKey, undefined);

		if (manager) {
			return manager;
		}
	}

	throw new Error('A router guard has not been provided.');
};

export const provideRouterGuards = (app: App, manager: RouterGuards): void => {
	app.provide(routerGuardKey, manager);
};
