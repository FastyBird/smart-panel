import type { IAuthenticatedSocket, ISocketSession } from './types';

/**
 * How long to wait for the handshake before treating the attempt as failed.
 */
const DEFAULT_CONNECTION_TIMEOUT = 10000;

const currentToken = (socket: IAuthenticatedSocket): unknown =>
	typeof socket.auth === 'object' && socket.auth !== null ? socket.auth.token : undefined;

const dropConnection = (socket: IAuthenticatedSocket): void => {
	if (socket.connected) {
		socket.disconnect();
	}

	socket.auth = {};
};

const waitForConnection = (socket: IAuthenticatedSocket, timeout: number): Promise<boolean> =>
	new Promise<boolean>((resolve) => {
		const settle = (result: boolean): void => {
			clearTimeout(timer);

			socket.off('connect', onConnect);
			socket.off('connect_error', onError);

			resolve(result);
		};

		const onConnect = (): void => settle(true);
		const onError = (): void => settle(false);

		// Declared last so it can be a const - `settle` only ever runs after this line.
		const timer = setTimeout(() => settle(false), timeout);

		socket.on('connect', onConnect);
		socket.on('connect_error', onError);
	});

/**
 * Brings the websocket up with a valid access token, refreshing the session first when needed.
 *
 * The backend validates the token during the handshake and rejects a stale one with a
 * server side `disconnect()`. `socket.io-client` treats that as a permanent stop - it tears down
 * its manager subscriptions so nothing reconnects afterwards. Refreshing before we (re)connect is
 * therefore what makes recovery work at all, not an optimisation.
 *
 * Resolves `true` once the socket is connected, `false` when there is no usable session or the
 * handshake failed.
 */
export const ensureSocketConnection = async (
	socket: IAuthenticatedSocket,
	session: ISocketSession,
	options?: { timeout?: number }
): Promise<boolean> => {
	if (session.isExpired() && !(await session.refresh())) {
		dropConnection(socket);

		return false;
	}

	const token = session.accessToken();

	if (token === null) {
		dropConnection(socket);

		return false;
	}

	if (socket.connected && currentToken(socket) === token) {
		return true;
	}

	if (socket.connected) {
		socket.disconnect();
	}

	socket.auth = { token };

	const connected = waitForConnection(socket, options?.timeout ?? DEFAULT_CONNECTION_TIMEOUT);

	socket.connect();

	return connected;
};
