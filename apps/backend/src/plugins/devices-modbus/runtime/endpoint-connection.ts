import { createExtensionLogger } from '../../../common/logger';
import { DEVICES_MODBUS_PLUGIN_NAME, ModbusFraming } from '../devices-modbus.constants';
import {
	ModbusConnectionError,
	ModbusEndpointUnavailableError,
	ModbusExceptionError,
	ModbusTimeoutError,
} from '../lib/errors';
import { ModbusReadRequest, ModbusTransport, ModbusWriteRequest } from '../transport/modbus-transport';

export interface EndpointConnectionConfig {
	endpointId: string;
	framing: ModbusFraming;
	maxInFlight: number;
	interRequestDelayMs: number;
}

/** `stopped` covers both a disabled endpoint and a stopped plugin (no connection is running in either case). */
export type EndpointConnectionState = 'connecting' | 'connected' | 'backoff' | 'stopped';

export interface EndpointHealth {
	/** `stopped` covers both a disabled endpoint and a stopped plugin. */
	state: EndpointConnectionState;
	lastError: string | null;
	lastErrorAt: Date | null;
	/** Exponential moving average (alpha 0.2) of successful request round-trips; `null` until the first success. */
	averageLatencyMs: number | null;
	/** Requests sent on the wire. */
	requests: number;
	/** Requests that ended with `ModbusTimeoutError`. */
	timeouts: number;
	overloaded: boolean;
}

/** TCP framing tolerates sporadic timeouts; the socket is replaced after this many in a row. */
const TCP_CONSECUTIVE_TIMEOUT_LIMIT = 3;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 60000;
/** Above this attempt the uncapped delay already exceeds the cap; keeps `2 ** n` finite. */
const BACKOFF_MAX_EXPONENT = 16;
const LATENCY_SMOOTHING = 0.2;

interface QueuedRequest {
	execute: (transport: ModbusTransport) => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
}

/**
 * Owns one transport to one endpoint and serialises every request through it.
 *
 * - At most `maxInFlight` requests are on the wire (always 1 for `rtu_over_tcp`, whose frames carry no transaction
 *   ID). Writes are queued ahead of reads but never pre-empt a request already sent.
 * - `interRequestDelayMs` is kept between a response and the next send, and before the first send on a socket
 *   opened by a reset (quiet time on the bus while a slow slave may still be answering).
 * - A request timeout resets the socket on `rtu_over_tcp` (a late answer would be read as the next response) and
 *   after 3 consecutive timeouts on `tcp`. The `rtu_over_tcp` reset reconnects at once and queued requests wait for
 *   it; the `tcp` reset does so only when the socket has answered before, otherwise it backs off (see below).
 *   A `ModbusConnectionError` from a request (lost socket, CRC or length error) resets the socket on both framings:
 *   at once when the socket has already answered, otherwise as a failed attempt (see backoff).
 *   A `ModbusExceptionError` is a regular device answer and counts like a success.
 * - A failed connect, an unexpected socket close, or a connection error before the socket's first answer enters
 *   `backoff`: queued and new requests fail fast with `ModbusEndpointUnavailableError` until the next attempt,
 *   delayed `min(1000 * 2^(n-1), 60000)` ms scaled by `0.8 + 0.4 * random()`. Only the first answer on a socket
 *   (a success or a Modbus exception) restarts the sequence, not a bare successful connect: a gateway that accepts
 *   and then drops, or a link that only produces garbage, is never hammered.
 * - Each transport is used once. Callbacks from a replaced transport are ignored by identity.
 * - Timers are unreferenced, so they never keep the process alive; `stop()` clears them.
 */
export class EndpointConnection {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'EndpointConnection');
	private readonly maxInFlight: number;

	private state: EndpointConnectionState = 'stopped';
	private transport: ModbusTransport | null = null;
	/** Bumped on every start, stop and reset so stale async continuations can tell they are outdated. */
	private generation = 0;

	private readonly writeQueue: QueuedRequest[] = [];
	private readonly readQueue: QueuedRequest[] = [];
	private readonly inFlight = new Set<QueuedRequest>();

	private delayTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private backoffAttempt = 0;
	private consecutiveTimeouts = 0;
	/** The current socket has produced at least one answer (a success or a Modbus exception). */
	private answered = false;
	/** The next socket was opened by a reset and keeps `interRequestDelayMs` before its first send. */
	private quietAfterReset = false;

	private lastError: string | null = null;
	private lastErrorAt: Date | null = null;
	private averageLatencyMs: number | null = null;
	private requests = 0;
	private timeouts = 0;
	private overloaded = false;

	private readonly listeners = new Set<(state: EndpointConnectionState) => void>();

	constructor(
		private readonly config: EndpointConnectionConfig,
		private readonly transportFactory: () => ModbusTransport,
		private readonly random: () => number = Math.random,
	) {
		this.maxInFlight = config.framing === ModbusFraming.RTU_OVER_TCP ? 1 : Math.max(1, Math.floor(config.maxInFlight));
	}

	start(): void {
		if (this.state !== 'stopped') {
			return;
		}

		this.generation++;
		this.backoffAttempt = 0;
		this.consecutiveTimeouts = 0;
		this.quietAfterReset = false;
		this.openTransport();
	}

	async stop(): Promise<void> {
		if (this.state === 'stopped') {
			return;
		}

		this.generation++;
		this.clearTimers();

		const transport = this.transport;

		this.transport = null;
		this.setState('stopped');
		this.rejectInFlight(new ModbusConnectionError('Modbus endpoint connection stopped'));
		this.rejectQueued(new ModbusEndpointUnavailableError('Modbus endpoint connection stopped'));

		if (transport) {
			await this.closeQuietly(transport);
		}
	}

	read(request: ModbusReadRequest): Promise<boolean[] | number[]> {
		return this.enqueue(this.readQueue, (transport) => transport.read(request));
	}

	write(request: ModbusWriteRequest): Promise<void> {
		return this.enqueue(this.writeQueue, (transport) => transport.write(request));
	}

	get framing(): ModbusFraming {
		return this.config.framing;
	}

	markOverloaded(overloaded: boolean): void {
		this.overloaded = overloaded;
	}

	getHealth(): EndpointHealth {
		return {
			state: this.state,
			lastError: this.lastError,
			lastErrorAt: this.lastErrorAt,
			averageLatencyMs: this.averageLatencyMs,
			requests: this.requests,
			timeouts: this.timeouts,
			overloaded: this.overloaded,
		};
	}

	onStateChange(listener: (state: EndpointConnectionState) => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	private enqueue<T>(queue: QueuedRequest[], execute: (transport: ModbusTransport) => Promise<T>): Promise<T> {
		if (this.state === 'stopped') {
			return Promise.reject(new ModbusEndpointUnavailableError(`Modbus endpoint ${this.config.endpointId} is stopped`));
		}

		if (this.state === 'backoff') {
			return Promise.reject(
				new ModbusEndpointUnavailableError(`Modbus endpoint ${this.config.endpointId} is waiting to reconnect`),
			);
		}

		return new Promise<T>((resolve, reject) => {
			queue.push({ execute, resolve: resolve as (value: unknown) => void, reject });
			this.pump();
		});
	}

	private pump(): void {
		while (
			this.state === 'connected' &&
			this.transport !== null &&
			this.delayTimer === null &&
			this.inFlight.size < this.maxInFlight
		) {
			const entry = this.writeQueue.shift() ?? this.readQueue.shift();

			if (!entry) {
				return;
			}

			this.send(this.transport, entry);
		}
	}

	private send(transport: ModbusTransport, entry: QueuedRequest): void {
		const startedAt = Date.now();

		this.inFlight.add(entry);
		this.requests++;

		let pending: Promise<unknown>;

		try {
			pending = entry.execute(transport);
		} catch (error) {
			pending = Promise.reject(toError(error));
		}

		pending.then(
			(result) => {
				// Already settled by a reset, a close or stop(): this answer belongs to a socket that is gone.
				if (!this.inFlight.delete(entry)) {
					return;
				}

				this.markAnswered();
				this.recordLatency(Date.now() - startedAt);
				entry.resolve(result);
				this.afterResponse();
			},
			(reason: unknown) => {
				if (!this.inFlight.delete(entry)) {
					return;
				}

				const error = toError(reason);

				entry.reject(error);
				this.handleRequestError(transport, error);
			},
		);
	}

	private handleRequestError(transport: ModbusTransport, error: Error): void {
		if (error instanceof ModbusExceptionError) {
			this.markAnswered();
			this.afterResponse();

			return;
		}

		if (error instanceof ModbusTimeoutError) {
			this.timeouts++;
			this.consecutiveTimeouts++;
			this.recordError(error.message);

			if (this.config.framing === ModbusFraming.RTU_OVER_TCP) {
				this.resetTransport(transport, `${this.consecutiveTimeouts} consecutive timeout(s)`, true);
			} else if (this.consecutiveTimeouts >= TCP_CONSECUTIVE_TIMEOUT_LIMIT) {
				// A socket that never answered is unproven, like one that failed with a connection error.
				this.resetTransport(transport, `${this.consecutiveTimeouts} consecutive timeout(s)`, this.answered);
			} else {
				this.afterResponse();
			}

			return;
		}

		if (error instanceof ModbusConnectionError) {
			this.recordError(error.message);
			// Without an answer on this socket the link is unproven: count it as a failed attempt and back off.
			this.resetTransport(transport, error.message, this.answered);

			return;
		}

		// Anything else (e.g. a request rejected by the transport's validation) never reached the wire as a frame.
		this.afterResponse();
	}

	/** An answer proves the link works: it ends a timeout streak and restarts the backoff sequence. */
	private markAnswered(): void {
		this.answered = true;
		this.consecutiveTimeouts = 0;
		this.backoffAttempt = 0;
	}

	private afterResponse(): void {
		if (this.config.interRequestDelayMs > 0 && this.state === 'connected') {
			if (this.delayTimer !== null) {
				clearTimeout(this.delayTimer);
			}

			this.delayTimer = setTimeout(() => {
				this.delayTimer = null;
				this.pump();
			}, this.config.interRequestDelayMs);
			this.delayTimer.unref?.();

			return;
		}

		this.pump();
	}

	private openTransport(): void {
		const generation = this.generation;
		let transport: ModbusTransport;

		this.setState('connecting');

		try {
			transport = this.transportFactory();
		} catch (error) {
			this.handleConnectFailure(toError(error));

			return;
		}

		this.transport = transport;
		this.answered = false;

		transport.onClose((error) => this.handleTransportClosed(transport, error));

		transport.connect().then(
			() => {
				if (this.transport !== transport || this.generation !== generation) {
					return;
				}

				// The backoff sequence is not restarted here: only an answer proves the link works.
				this.consecutiveTimeouts = 0;
				this.setState('connected');

				if (this.quietAfterReset) {
					this.quietAfterReset = false;
					this.afterResponse();
				} else {
					this.pump();
				}
			},
			(reason: unknown) => {
				if (this.transport !== transport || this.generation !== generation) {
					return;
				}

				this.transport = null;
				void this.closeQuietly(transport);
				this.handleConnectFailure(toError(reason));
			},
		);
	}

	private handleConnectFailure(error: Error): void {
		this.recordError(error.message);
		this.rejectQueued(
			new ModbusEndpointUnavailableError(`Modbus endpoint ${this.config.endpointId} could not connect`, {
				cause: error,
			}),
		);
		this.scheduleReconnect();
	}

	private handleTransportClosed(transport: ModbusTransport, error?: Error): void {
		// Explicit closes (reset, stop) clear `this.transport` first, and replaced transports are never current.
		if (this.transport !== transport) {
			return;
		}

		this.transport = null;
		this.generation++;
		this.clearDelayTimer();

		const message = error ? `Modbus connection closed: ${error.message}` : 'Modbus connection closed';

		this.recordError(message);

		const closed = new ModbusConnectionError(message, error ? { cause: error } : undefined);

		this.rejectInFlight(closed);
		this.rejectQueued(closed);
		this.scheduleReconnect();
	}

	/**
	 * Drops a socket that can no longer be trusted. With `immediate`, it reconnects at once and queued requests wait
	 * for the new socket; otherwise the reset counts as a failed attempt: queued requests reject and backoff follows.
	 */
	private resetTransport(transport: ModbusTransport, reason: string, immediate: boolean): void {
		if (this.transport !== transport) {
			return;
		}

		this.logger.warn(
			`Resetting connection to endpoint ${this.config.endpointId}${immediate ? '' : ' (backing off)'}: ${reason}`,
		);

		this.transport = null;
		this.consecutiveTimeouts = 0;
		this.quietAfterReset = true;
		this.clearDelayTimer();
		this.rejectInFlight(new ModbusConnectionError(`Modbus connection reset: ${reason}`));

		const generation = ++this.generation;

		if (!immediate) {
			void this.closeQuietly(transport);
			this.rejectQueued(
				new ModbusEndpointUnavailableError(
					`Modbus endpoint ${this.config.endpointId} failed before answering: ${reason}`,
				),
			);
			this.scheduleReconnect();

			return;
		}

		this.setState('connecting');

		// Wait for the old socket to go away: some gateways accept a single client connection.
		void this.closeQuietly(transport).then(() => {
			if (this.generation === generation && this.state === 'connecting') {
				this.openTransport();
			}
		});
	}

	private scheduleReconnect(): void {
		this.backoffAttempt++;

		const exponent = Math.min(this.backoffAttempt - 1, BACKOFF_MAX_EXPONENT);
		const delay = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS) * (0.8 + 0.4 * this.random());
		const generation = this.generation;

		this.setState('backoff');

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			if (this.generation === generation && this.state === 'backoff') {
				this.openTransport();
			}
		}, delay);
		this.reconnectTimer.unref?.();
	}

	private rejectInFlight(error: Error): void {
		const entries = [...this.inFlight];

		this.inFlight.clear();

		for (const entry of entries) {
			entry.reject(error);
		}
	}

	private rejectQueued(error: Error): void {
		const entries = [...this.writeQueue, ...this.readQueue];

		this.writeQueue.length = 0;
		this.readQueue.length = 0;

		for (const entry of entries) {
			entry.reject(error);
		}
	}

	private async closeQuietly(transport: ModbusTransport): Promise<void> {
		try {
			await transport.close();
		} catch (error) {
			this.logger.warn(
				`Closing the connection to endpoint ${this.config.endpointId} failed: ${toError(error).message}`,
			);
		}
	}

	private clearTimers(): void {
		this.clearDelayTimer();

		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearDelayTimer(): void {
		if (this.delayTimer !== null) {
			clearTimeout(this.delayTimer);
			this.delayTimer = null;
		}
	}

	private recordError(message: string): void {
		this.lastError = message;
		this.lastErrorAt = new Date();
	}

	private recordLatency(latencyMs: number): void {
		this.averageLatencyMs =
			this.averageLatencyMs === null
				? latencyMs
				: this.averageLatencyMs + LATENCY_SMOOTHING * (latencyMs - this.averageLatencyMs);
	}

	private setState(state: EndpointConnectionState): void {
		if (this.state === state) {
			return;
		}

		this.state = state;

		for (const listener of [...this.listeners]) {
			try {
				listener(state);
			} catch (error) {
				this.logger.error(`A state listener for endpoint ${this.config.endpointId} threw: ${toError(error).message}`);
			}
		}
	}
}

const toError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
