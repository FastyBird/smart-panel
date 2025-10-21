import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { ConsolaInstance } from 'consola';

export const loggerKey: InjectionKey<ConsolaInstance | undefined> = Symbol('FB-App-Logger');

export const injectLogger = (app?: App): ConsolaInstance => {
	if (app && app._context && app._context.provides && app._context.provides[loggerKey]) {
		return app._context.provides[loggerKey];
	}

	if (hasInjectionContext()) {
		const logger = _inject(loggerKey, undefined);

		if (logger) {
			return logger;
		}
	}

	throw new Error('A logger has not been provided.');
};

export const provideLogger = (app: App, logger: ConsolaInstance): void => {
	app.provide(loggerKey, logger);
};
