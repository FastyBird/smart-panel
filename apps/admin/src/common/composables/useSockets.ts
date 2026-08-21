import { getCurrentScope, ref } from 'vue';

import { v4 as uuid } from 'uuid';

import { tryOnMounted, tryOnScopeDispose } from '@vueuse/core';

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

	// Captured at call time — the same condition `tryOnScopeDispose` keys off. Without a
	// scope the dispose hook is a silent no-op, so attaching listeners here would leak them
	// on the app-lifetime socket.
	const canDispose = getCurrentScope() !== undefined;

	// `tryOnMounted`, not `onMounted`: this composable is also called from a Pinia store setup
	// (`scenes_module-scenes`) and from composables that stores reach through, none of which run
	// with an active component instance. Plain `onMounted` only warns and declines to register
	// there, so the listeners were never attached and `connected` / `active` stayed frozen at
	// their initial values. `tryOnMounted` runs the callback immediately when there is no
	// instance to defer to.
	tryOnMounted(() => {
		// Sync initial state (may have changed since ref was created)
		connected.value = sockets.connected;
		active.value = sockets.active;

		if (canDispose) {
			sockets.on('connect', onConnect);
			sockets.on('disconnect', onDisconnect);
		}
	});

	// Scope-based rather than `onBeforeUnmount` for the same reason, and because it is the
	// correct counterpart: a store's effect scope outlives every component, so its listeners are
	// released when the scope is disposed instead of when some unrelated component unmounts.
	tryOnScopeDispose(() => {
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
