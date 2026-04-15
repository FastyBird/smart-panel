import { onBeforeUnmount, onMounted, ref } from 'vue';

import { v4 as uuid } from 'uuid';

import { injectSockets } from '../services/sockets';

import type { IUseSockets } from './types';

export const useSockets = (): IUseSockets => {
	const sockets = injectSockets();

	const connected = ref<boolean>(sockets.connected);
	const active = ref<boolean>(sockets.active);

	const onConnect = (): void => {
		connected.value = true;
		active.value = true;
	};

	const onDisconnect = (): void => {
		connected.value = false;
		active.value = false;
	};

	onMounted(() => {
		// Sync initial state (may have changed since ref was created)
		connected.value = sockets.connected;
		active.value = sockets.active;

		sockets.on('connect', onConnect);
		sockets.on('disconnect', onDisconnect);
	});

	onBeforeUnmount(() => {
		sockets.off('connect', onConnect);
		sockets.off('disconnect', onDisconnect);
	});

	const sendCommand = async <Payload extends object>(
		event: string,
		payload: Payload | null,
		handler: string,
		timeout = 1000
	): Promise<true | string> => {
		// Generate a unique request ID for tracking this command through the intent system
		const requestId = uuid();

		const response: { status: 'ok' | 'err'; message: string; results: { handler: string; success: boolean; reason?: string }[] } | undefined =
			await sockets.timeout(timeout).emitWithAck('command', {
				event,
				payload: payload !== null ? { ...payload, request_id: requestId } : { request_id: requestId },
			});

		if (!response || response.status === 'err') {
			return response?.message ?? 'err';
		}

		const result = response?.results.find((result) => result.handler === handler);

		if (result && !result.success) {
			return result.reason ?? 'err';
		}

		return true;
	};

	return {
		sockets,
		connected,
		active,
		sendCommand,
	};
};
