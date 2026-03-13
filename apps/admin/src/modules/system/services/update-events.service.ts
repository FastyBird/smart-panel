/**
 * Listener-based event bridge for WebSocket update events.
 * The system module emits events on WS messages; composables and components subscribe via onUpdateEvent.
 */
let listeners: Array<(payload: Record<string, unknown>) => void> = [];

export const onUpdateEvent = (callback: (payload: Record<string, unknown>) => void): (() => void) => {
	listeners.push(callback);

	return () => {
		listeners = listeners.filter((l) => l !== callback);
	};
};

export const emitUpdateEvent = (payload: Record<string, unknown>): void => {
	for (const listener of listeners) {
		listener(payload);
	}
};
