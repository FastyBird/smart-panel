import { ref } from 'vue';

/**
 * Reactive singleton to hold update status received via WebSocket events.
 * The system module writes to it on WS events; the useUpdateStatus composable reads from it.
 */
const updateEventPayload = ref<Record<string, unknown> | null>(null);

let listeners: Array<(payload: Record<string, unknown>) => void> = [];

export const onUpdateEvent = (callback: (payload: Record<string, unknown>) => void): (() => void) => {
	listeners.push(callback);

	return () => {
		listeners = listeners.filter((l) => l !== callback);
	};
};

export const emitUpdateEvent = (payload: Record<string, unknown>): void => {
	updateEventPayload.value = payload;

	for (const listener of listeners) {
		listener(payload);
	}
};

export const getLastUpdateEvent = (): Record<string, unknown> | null => {
	return updateEventPayload.value;
};
