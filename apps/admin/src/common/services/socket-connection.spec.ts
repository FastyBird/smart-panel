import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeSocket } from './__fixtures__/fake-socket';
import { ensureSocketConnection } from './socket-connection';
import type { ISocketSession } from './types';

const createSession = (overrides: Partial<ISocketSession> = {}): ISocketSession => ({
	isExpired: (): boolean => false,
	refresh: async (): Promise<boolean> => true,
	accessToken: (): string | null => 'valid-token',
	...overrides,
});

describe('ensureSocketConnection', () => {
	let socket: FakeSocket;

	beforeEach(() => {
		socket = new FakeSocket();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('connects with the current access token', async () => {
		await expect(ensureSocketConnection(socket, createSession())).resolves.toBe(true);

		expect(socket.connectCalls).toBe(1);
		expect(socket.auth).toEqual({ token: 'valid-token' });
	});

	it('refreshes an expired session before connecting', async () => {
		const refresh = vi.fn(async (): Promise<boolean> => true);
		let token = 'expired-token';

		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => {
				token = 'refreshed-token';

				return refresh();
			},
			accessToken: (): string | null => token,
		});

		await expect(ensureSocketConnection(socket, session)).resolves.toBe(true);

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(socket.auth).toEqual({ token: 'refreshed-token' });
	});

	it('does not connect when the session refresh fails', async () => {
		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => false,
		});

		await expect(ensureSocketConnection(socket, session)).resolves.toBe(false);

		expect(socket.connectCalls).toBe(0);
		expect(socket.auth).toEqual({});
	});

	it('reports failure when the session refresh throws', async () => {
		// The store awaits the refresh request inside a try/finally with no catch, so an
		// unreachable backend rejects instead of returning false.
		socket.connected = true;

		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => {
				throw new Error('backend unreachable');
			},
		});

		await expect(ensureSocketConnection(socket, session)).resolves.toBe(false);

		expect(socket.connectCalls).toBe(0);
		expect(socket.disconnectCalls).toBe(1);
		expect(socket.auth).toEqual({});
	});

	it('drops an existing connection when there is no access token', async () => {
		socket.connected = true;

		const session = createSession({ accessToken: (): string | null => null });

		await expect(ensureSocketConnection(socket, session)).resolves.toBe(false);

		expect(socket.disconnectCalls).toBe(1);
		expect(socket.connectCalls).toBe(0);
		expect(socket.auth).toEqual({});
	});

	it('leaves an already healthy connection untouched', async () => {
		socket.connected = true;
		socket.auth = { token: 'valid-token' };

		await expect(ensureSocketConnection(socket, createSession())).resolves.toBe(true);

		expect(socket.connectCalls).toBe(0);
		expect(socket.disconnectCalls).toBe(0);
	});

	it('reconnects when the socket is connected with a stale token', async () => {
		socket.connected = true;
		socket.auth = { token: 'stale-token' };

		await expect(ensureSocketConnection(socket, createSession())).resolves.toBe(true);

		expect(socket.disconnectCalls).toBe(1);
		expect(socket.connectCalls).toBe(1);
		expect(socket.auth).toEqual({ token: 'valid-token' });
	});

	it('resolves false when the server rejects the token right after the handshake', async () => {
		// socket.io sends the namespace CONNECT packet before the gateway gets to authorise the
		// client, so an unauthorised token arrives as `connect` followed by `disconnect`.
		// Treating `connect` alone as success would skip the failure toast.
		socket.handshake = 'rejected_after_connect';

		await expect(ensureSocketConnection(socket, createSession(), { authGrace: 20 })).resolves.toBe(false);
	});

	it('resolves false when the connection attempt errors', async () => {
		socket.handshake = 'connect_error';

		await expect(ensureSocketConnection(socket, createSession())).resolves.toBe(false);
	});

	it('resolves false when the connection attempt times out', async () => {
		vi.useFakeTimers();

		socket.handshake = 'silent';

		const pending = ensureSocketConnection(socket, createSession(), { timeout: 5000 });

		await vi.advanceTimersByTimeAsync(5000);

		await expect(pending).resolves.toBe(false);
	});

	it('removes its listeners once the attempt settled', async () => {
		await ensureSocketConnection(socket, createSession());

		expect(socket.listenerCount('connect')).toBe(0);
		expect(socket.listenerCount('connect_error')).toBe(0);
	});
});
