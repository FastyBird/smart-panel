import type { Handler } from 'mitt';

import { type Events, injectEventBus } from '../services';

import type { IUseEventBus } from './types';

export function useEventBus(): IUseEventBus {
	const eventBus = injectEventBus();

	const register = <Key extends keyof Events>(event: Key, listener: Handler<Events[Key]>): void => {
		eventBus.on(event, listener);
	};

	const unregister = <Key extends keyof Events>(event: Key, listener: Handler<Events[Key]>): void => {
		eventBus.off(event, listener);
	};

	const emit = <Key extends keyof Events>(event: Key, payload: Events[Key]): void => {
		eventBus.emit(event, payload);
	};

	return {
		eventBus,
		register,
		unregister,
		emit,
	};
}
