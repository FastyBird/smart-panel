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

export type EndpointConnectionState = 'connecting' | 'connected' | 'backoff' | 'stopped';

export interface EndpointHealth {
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
 * - `interRequestDelayMs` is kept between a response and the next send.
 * - A request timeout resets the socket on `rtu_over_tcp` (a late answer would be read as the next response) and
 *   after 3 consecutive timeouts on `tcp`. A `ModbusConnectionError` from a request (lost socket, CRC or length
 *   error) resets the socket on both framings. A reset reconnects at once; requests still queued wait for it.
 *   A `ModbusExceptionError` is a regular device answer and counts like a success.
 * - A failed connect or an unexpected socket close enters `backoff`: new requests fail fast with
 *   `ModbusEndpointUnavailableError` until the next attempt, delayed `min(1000 * 2^(n-1), 60000)` ms scaled by
 *   `0.8 + 0.4 * random()`. A successful connect restarts the sequence.
 * - Each transport is used once. Callbacks from a replaced transport are ignored by identity.
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

				this.consecutiveTimeouts = 0;
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
			this.consecutiveTimeouts = 0;
			this.afterResponse();

			return;
		}

		if (error instanceof ModbusTimeoutError) {
			this.timeouts++;
			this.consecutiveTimeouts++;
			this.recordError(error.message);

			if (
				this.config.framing === ModbusFraming.RTU_OVER_TCP ||
				this.consecutiveTimeouts >= TCP_CONSECUTIVE_TIMEOUT_LIMIT
			) {
				this.resetTransport(transport, `${this.consecutiveTimeouts} consecutive timeout(s)`);
			} else {
				this.afterResponse();
			}

			return;
		}

		if (error instanceof ModbusConnectionError) {
			this.recordError(error.message);
			this.resetTransport(transport, error.message);

			return;
		}

		// Anything else (e.g. a request rejected by the transport's validation) never reached the wire as a frame.
		this.afterResponse();
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

		transport.onClose((error) => this.handleTransportClosed(transport, error));

		transport.connect().then(
			() => {
				if (this.transport !== transport || this.generation !== generation) {
					return;
				}

				this.backoffAttempt = 0;
				this.consecutiveTimeouts = 0;
				this.setState('connected');
				this.pump();
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

	/** Drops a socket that can no longer be trusted and reconnects at once; queued requests wait for the new one. */
	private resetTransport(transport: ModbusTransport, reason: string): void {
		if (this.transport !== transport) {
			return;
		}

		this.logger.warn(`Resetting connection to endpoint ${this.config.endpointId}: ${reason}`);

		this.transport = null;
		this.consecutiveTimeouts = 0;
		this.clearDelayTimer();
		this.rejectInFlight(new ModbusConnectionError(`Modbus connection reset: ${reason}`));
		this.setState('connecting');

		const generation = ++this.generation;

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
