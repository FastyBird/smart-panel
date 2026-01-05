import { computed } from 'vue';

import { v4 as uuid } from 'uuid';

import { injectSockets } from '../services/sockets';

import type { IUseSockets } from './types';

export const useSockets = (): IUseSockets => {
	const sockets = injectSockets();

	const connected = computed<boolean>((): boolean => {
		return sockets.connected;
	});

	const active = computed<boolean>((): boolean => {
		return sockets.active;
	});

	const sendCommand = async <Payload extends object>(event: string, payload: Payload | null, handler: string): Promise<true | string> => {
		// Generate a unique request ID for tracking this command through the intent system
		const requestId = uuid();

		const response: { status: 'ok' | 'err'; message: string; results: { handler: string; success: boolean; reason?: string }[] } | undefined =
			await sockets.timeout(1000).emitWithAck('command', {
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
