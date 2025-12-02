import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { Client } from 'openapi-fetch';
import type { MediaType } from 'openapi-typescript-helpers';

import type { OpenApiPaths } from '../../openapi.constants';

export const backendKey: InjectionKey<Client<object, MediaType> | undefined> = Symbol('FB-App-Backend');

export const injectBackendClient = <Paths extends object = OpenApiPaths>(app?: App): Client<Paths> => {
	if (app && app._context && app._context.provides && app._context.provides[backendKey]) {
		return app._context.provides[backendKey];
	}

	if (hasInjectionContext()) {
		const backend = _inject(backendKey, undefined);

		if (backend) {
			return backend as Client<Paths, MediaType>;
		}
	}

	throw new Error('A backend client has not been provided.');
};

export const provideBackendClient = <Paths extends object = OpenApiPaths>(app: App, backend: Client<Paths, MediaType>): void => {
	app.provide(backendKey, backend as Client<Paths, MediaType>);
};
