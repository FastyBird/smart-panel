import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { Client } from 'openapi-fetch';
import type { MediaType } from 'openapi-typescript-helpers';

import type { paths } from '../../openapi';

export const backendKey: InjectionKey<Client<paths, MediaType> | undefined> = Symbol('FB-App-Backend');

export const injectBackendClient = (app?: App): Client<paths> => {
	if (app && app._context && app._context.provides && app._context.provides[backendKey]) {
		return app._context.provides[backendKey];
	}

	if (hasInjectionContext()) {
		const backend = _inject(backendKey, undefined);

		if (backend) {
			return backend;
		}
	}

	throw new Error('A backend client has not been provided.');
};

export const provideBackendClient = (app: App, backend: Client<paths>): void => {
	app.provide(backendKey, backend);
};
