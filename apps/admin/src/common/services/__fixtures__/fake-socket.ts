import type { IAuthenticatedSocket } from '../types';

type Listener = (...args: unknown[]) => void;

/**
 * Stands in for the socket.io client in tests. `connect()` settles the handshake asynchronously,
 * the way the real client does, so tests never depend on listeners being attached synchronously.
 */
export class FakeSocket implements IAuthenticatedSocket {
	public connected = false;

	public auth: Record<string, unknown> = {};

	public connectCalls = 0;

	public disconnectCalls = 0;

	/** What the next handshake should do. `silent` never settles, for the timeout case. */
	public handshake: 'connect' | 'connect_error' | 'silent' = 'connect';

	private listeners: Map<string, Set<Listener>> = new Map();

	public connect(): void {
		this.connectCalls += 1;

		if (this.handshake === 'silent') {
			return;
		}

		queueMicrotask(() => {
			if (this.handshake === 'connect') {
				this.connected = true;

				this.emit('connect');
			} else {
				this.emit('connect_error', new Error('backend unreachable'));
			}
		});
	}

	public disconnect(): void {
		this.disconnectCalls += 1;
		this.connected = false;
	}

	public on(event: string, listener: Listener): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}

		this.listeners.get(event)!.add(listener);
	}

	public off(event: string, listener: Listener): void {
		this.listeners.get(event)?.delete(listener);
	}

	public emit(event: string, ...args: unknown[]): void {
		[...(this.listeners.get(event) ?? [])].forEach((listener) => listener(...args));
	}

	public listenerCount(event: string): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}
