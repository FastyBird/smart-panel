import type { IAuthenticatedSocket, ISocketSession } from './types';

/**
 * How long to wait for the handshake before treating the attempt as failed.
 */
const DEFAULT_CONNECTION_TIMEOUT = 10000;

/**
 * How long to wait after `connect` for a server side rejection to arrive before calling the
 * connection good. Covers one round trip plus the gateway's token verification.
 */
export const DEFAULT_AUTH_GRACE = 500;

const currentToken = (socket: IAuthenticatedSocket): unknown =>
	typeof socket.auth === 'object' && socket.auth !== null ? socket.auth.token : undefined;

const dropConnection = (socket: IAuthenticatedSocket): void => {
	if (socket.connected) {
		socket.disconnect();
	}

	socket.auth = {};
};

const waitForConnection = (socket: IAuthenticatedSocket, timeout: number, authGrace: number): Promise<boolean> =>
	new Promise<boolean>((resolve) => {
		let graceTimer: ReturnType<typeof setTimeout> | undefined;

		const settle = (result: boolean): void => {
			clearTimeout(timer);
			clearTimeout(graceTimer);

			socket.off('connect', onConnect);
			socket.off('connect_error', onError);
			socket.off('disconnect', onDisconnect);

			resolve(result);
		};

		// `connect` is not proof that we are authorised. socket.io sends the namespace CONNECT
		// packet before the gateway runs handleConnection, which is where an unauthorised token is
		// rejected with a server side disconnect(). So a rejection reaches us as `connect`
		// immediately followed by `disconnect` - hold the verdict briefly to catch that.
		const onConnect = (): void => {
			graceTimer = setTimeout(() => settle(true), authGrace);
		};

		const onDisconnect = (): void => settle(false);
		const onError = (): void => settle(false);

		// Declared last so it can be a const - `settle` only ever runs after this line.
		const timer = setTimeout(() => settle(false), timeout);

		socket.on('connect', onConnect);
		socket.on('connect_error', onError);
		socket.on('disconnect', onDisconnect);
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
 * handshake failed. It never rejects - both call sites fire it without awaiting, so a rejection
 * would surface as an unhandled one rather than as a failed recovery.
 */
export const ensureSocketConnection = async (
	socket: IAuthenticatedSocket,
	session: ISocketSession,
	options?: { timeout?: number; authGrace?: number }
): Promise<boolean> => {
	if (session.isExpired()) {
		// The session store awaits the refresh request inside a try/finally with no catch, so an
		// unreachable backend rejects here instead of returning false.
		const refreshed = await session.refresh().catch((): boolean => false);

		if (!refreshed) {
			dropConnection(socket);

			return false;
		}
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

	const connected = waitForConnection(socket, options?.timeout ?? DEFAULT_CONNECTION_TIMEOUT, options?.authGrace ?? DEFAULT_AUTH_GRACE);

	socket.connect();

	return connected;
};
