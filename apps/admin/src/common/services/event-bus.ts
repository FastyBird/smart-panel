import { type App, type InjectionKey, inject as _inject, hasInjectionContext } from 'vue';

import type { Emitter } from 'mitt';

export type Events = { [key: string]: unknown };

export const eventBusKey: InjectionKey<Emitter<Events> | undefined> = Symbol('FB-App-EventBus');

export const injectEventBus = (app?: App): Emitter<Events> => {
	if (app && app._context && app._context.provides && app._context.provides[eventBusKey]) {
		return app._context.provides[eventBusKey];
	}

	if (hasInjectionContext()) {
		const eventBus = _inject(eventBusKey, undefined);

		if (eventBus) {
			return eventBus;
		}
	}

	throw new Error('A event bus has not been provided.');
};

export const provideEventBus = (app: App, eventBus: Emitter<Events>): void => {
	app.provide(eventBusKey, eventBus);
};
