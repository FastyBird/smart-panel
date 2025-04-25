import type { Handler } from 'mitt';

import type { Events } from '../services/event-bus';
import { injectEventBus } from '../services/event-bus';

import type { IUseEventBus } from './types';

export const useEventBus = (): IUseEventBus => {
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
};
