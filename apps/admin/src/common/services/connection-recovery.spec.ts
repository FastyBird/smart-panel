import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeSocket } from './__fixtures__/fake-socket';
import { createConnectionRecovery } from './connection-recovery';
import type { IConnectionRecovery, ISocketSession } from './types';

const createSession = (overrides: Partial<ISocketSession> = {}): ISocketSession => ({
	isExpired: (): boolean => false,
	refresh: async (): Promise<boolean> => true,
	accessToken: (): string | null => 'valid-token',
	...overrides,
});

const setVisibility = (state: 'visible' | 'hidden'): void => {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
};

/** Lets every queued microtask and the recovery chain settle, including the auth grace window. */
const flush = async (): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 20));
};

describe('createConnectionRecovery', () => {
	let socket: FakeSocket;
	let recovery: IConnectionRecovery | undefined;

	beforeEach(() => {
		socket = new FakeSocket();
		setVisibility('visible');
	});

	afterEach(() => {
		recovery?.stop();
		recovery = undefined;
	});

	it('reconnects when the tab becomes visible while disconnected', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(socket.connectCalls).toBe(1);
		expect(socket.connected).toBe(true);
	});

	it('does nothing when the tab becomes visible while already connected', async () => {
		socket.connected = true;

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(socket.connectCalls).toBe(0);
	});

	it('ignores the visibility event when the tab went hidden', async () => {
		setVisibility('hidden');

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(socket.connectCalls).toBe(0);
	});

	it('reconnects when the window regains focus', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(socket.connectCalls).toBe(1);
	});

	it('reconnects when the browser reports it is back online', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		window.dispatchEvent(new Event('online'));

		await flush();

		expect(socket.connectCalls).toBe(1);
	});

	it('collapses the burst of triggers a wake produces into one attempt', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		window.dispatchEvent(new Event('focus'));
		window.dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(socket.connectCalls).toBe(1);
	});

	it('reports a failed recovery', async () => {
		const onFailure = vi.fn();

		socket.handshake = 'connect_error';

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('stays quiet when there is no session to recover', async () => {
		const onFailure = vi.fn();

		// Signed out: the socket is meant to be down, so focusing the login page must not be
		// reported as a failed recovery.
		const session = createSession({ accessToken: (): string | null => null });

		recovery = createConnectionRecovery({ authGrace: 5, socket, session, onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));
		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(onFailure).not.toHaveBeenCalled();
		expect(socket.connectCalls).toBe(0);
	});

	it('still reports a failure when a session exists but cannot be refreshed', async () => {
		const onFailure = vi.fn();

		// Slept past the refresh token lifetime: the stale access token is still in the store,
		// so this is a genuine recovery failure and the user needs to be told.
		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => false,
			accessToken: (): string | null => 'stale-token',
		});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session, onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('reports a failed recovery when the session refresh throws', async () => {
		const onFailure = vi.fn();

		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => {
				throw new Error('backend unreachable');
			},
		});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session, onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('keeps recovering after a trigger threw, instead of latching', async () => {
		const session = createSession({
			isExpired: (): boolean => true,
			refresh: async (): Promise<boolean> => {
				throw new Error('backend unreachable');
			},
		});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		// A stuck `recovering` flag would make every later wake a silent no-op.
		recovery.stop();
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(socket.connected).toBe(true);
	});

	it('retries on the next trigger after a failed recovery', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();

		socket.handshake = 'connect_error';

		window.dispatchEvent(new Event('focus'));

		await flush();

		socket.handshake = 'connect';

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(socket.connectCalls).toBe(2);
		expect(socket.connected).toBe(true);
	});

	it('refreshes data on a reconnect but not on the first connect', async () => {
		const onReconnected = vi.fn(async (): Promise<void> => {});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onReconnected });
		recovery.start();

		// First connect after app start - the views already fetched their data.
		socket.connected = true;
		socket.emit('connect');

		await flush();

		expect(onReconnected).not.toHaveBeenCalled();

		socket.connected = false;
		socket.emit('disconnect', 'transport close');
		socket.connected = true;
		socket.emit('connect');

		await flush();

		expect(onReconnected).toHaveBeenCalledTimes(1);
	});

	it('refreshes data after a reconnect socket.io recovered on its own', async () => {
		const onReconnected = vi.fn(async (): Promise<void> => {});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onReconnected });
		recovery.start();

		socket.connected = true;
		socket.emit('connect');
		socket.connected = false;
		socket.emit('disconnect', 'ping timeout');

		await flush();

		// No wake trigger at all - socket.io reconnected by itself.
		socket.connected = true;
		socket.emit('connect');

		await flush();

		expect(onReconnected).toHaveBeenCalledTimes(1);
	});

	it('does not refresh when the server rejects the reconnect', async () => {
		const onReconnected = vi.fn(async (): Promise<void> => {});

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onReconnected });
		recovery.start();

		socket.connected = true;
		socket.emit('connect');

		await flush();

		socket.connected = false;
		socket.emit('disconnect', 'transport close');

		// The gateway accepts the handshake and only then rejects the token, so `connect` is
		// followed immediately by `disconnect`. Refreshing over that socket is pointless.
		socket.connected = true;
		socket.emit('connect');
		socket.connected = false;
		socket.emit('disconnect', 'io server disconnect');

		await flush();

		expect(onReconnected).not.toHaveBeenCalled();
	});

	it('reports a rejection that lands after the attempt already settled', async () => {
		const onFailure = vi.fn();

		// The gateway does two database round trips before it decides, so the rejection can
		// arrive well after any fixed grace window has elapsed.
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(onFailure).not.toHaveBeenCalled();

		socket.connected = false;
		socket.emit('disconnect', 'io server disconnect');

		await flush();

		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('ignores a disconnect the server did not initiate', async () => {
		const onFailure = vi.fn();

		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession(), onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		// A dropped transport is not a refusal - recovery handles it on the next wake.
		socket.connected = false;
		socket.emit('disconnect', 'transport close');

		await flush();

		expect(onFailure).not.toHaveBeenCalled();
	});

	it('reports a rejection inside the attempt window only once', async () => {
		const onFailure = vi.fn();

		socket.handshake = 'rejected_after_connect';

		recovery = createConnectionRecovery({ authGrace: 50, socket, session: createSession(), onFailure });
		recovery.start();

		window.dispatchEvent(new Event('focus'));

		await flush();

		expect(onFailure).toHaveBeenCalledTimes(1);
	});

	it('stops listening once stopped', async () => {
		recovery = createConnectionRecovery({ authGrace: 5, socket, session: createSession() });
		recovery.start();
		recovery.stop();

		window.dispatchEvent(new Event('focus'));
		document.dispatchEvent(new Event('visibilitychange'));

		await flush();

		expect(socket.connectCalls).toBe(0);
	});
});
