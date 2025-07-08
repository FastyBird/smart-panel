import { computed } from 'vue';

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
		const response: { status: 'ok' | 'err'; message: string; results: { handler: string; success: boolean; reason?: string }[] } | undefined =
			await sockets.timeout(1000).emitWithAck('command', {
				event,
				payload,
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
