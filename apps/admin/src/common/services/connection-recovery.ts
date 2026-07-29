import { ensureSocketConnection } from './socket-connection';
import type { IConnectionRecovery, IConnectionRecoveryOptions } from './types';

/**
 * Keeps the websocket alive across browser suspensions.
 *
 * While the machine sleeps nothing runs: the access token can expire unnoticed and the transport
 * dies. On wake the client reconnects with the stale token, the backend rejects the handshake with
 * a server side `disconnect()`, and `socket.io-client` stops reconnecting for good. Until this
 * service existed the only thing that brought the socket back was a route change, because the
 * router guard is what refreshes the session and calls `connect()`.
 *
 * Two things are watched:
 *
 *  - wake signals (`visibilitychange`, `focus`, `online`) reconnect a socket that is down
 *  - every reconnect triggers `onReconnected`, so the stores can re-fetch what they missed. It
 *    hangs off the socket's own `connect` event, which also covers reconnects socket.io managed
 *    on its own without any wake signal.
 */
export const createConnectionRecovery = (options: IConnectionRecoveryOptions): IConnectionRecovery => {
	const { socket, session, onReconnected, onFailure, timeout } = options;

	let listening = false;
	let recovering = false;
	// The first connect is the app start-up one - views fetch their own data on mount, so there is
	// nothing to reconcile yet. Only later connects mean we missed events.
	let hasConnected = false;

	const recover = async (): Promise<void> => {
		// A wake fires focus, online and visibilitychange in quick succession. One attempt is enough.
		if (recovering || socket.connected) {
			return;
		}

		// Signed out, so the socket is down on purpose and there is nothing to recover. Without
		// this, every focus on the login page would raise a "could not be restored" toast.
		//
		// A session that slept past its refresh token still has its stale access token here, so
		// that case is not caught by this and is still reported as the failure it is.
		if (session.accessToken() === null) {
			return;
		}

		recovering = true;

		try {
			if (!(await ensureSocketConnection(socket, session, timeout !== undefined ? { timeout } : undefined))) {
				onFailure?.();
			}
		} catch {
			// Nothing awaits this, so anything escaping here would become an unhandled rejection
			// and the user would be left with a silent, permanently disconnected panel.
			onFailure?.();
		} finally {
			recovering = false;
		}
	};

	const onWake = (): void => {
		void recover();
	};

	const onVisibilityChange = (): void => {
		if (document.visibilityState === 'visible') {
			onWake();
		}
	};

	const onConnect = (): void => {
		if (!hasConnected) {
			hasConnected = true;

			return;
		}

		void onReconnected?.();
	};

	return {
		start: (): void => {
			if (listening) {
				return;
			}

			listening = true;

			document.addEventListener('visibilitychange', onVisibilityChange);
			window.addEventListener('focus', onWake);
			window.addEventListener('online', onWake);

			socket.on('connect', onConnect);
		},

		stop: (): void => {
			if (!listening) {
				return;
			}

			listening = false;

			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('focus', onWake);
			window.removeEventListener('online', onWake);

			socket.off('connect', onConnect);
		},
	};
};
