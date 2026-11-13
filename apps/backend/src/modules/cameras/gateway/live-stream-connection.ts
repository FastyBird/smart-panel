import WebSocket, { RawData } from 'ws';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CamerasNotFoundException,
	Go2rtcUnavailableException,
	errorName,
} from '../cameras.exceptions';
import { CameraStreamSession } from '../services/camera-session.service';
import { Go2rtcStreamLease } from '../services/go2rtc-streams.service';

import {
	LIVE_CLOSE,
	LIVE_HEARTBEAT_INTERVAL_MS,
	LIVE_HIGH_WATER_BYTES,
	LIVE_LOW_WATER_BYTES,
	LIVE_MAX_LIFETIME_MS,
	LIVE_STALL_TIMEOUT_MS,
	LIVE_UPSTREAM_CONNECT_TIMEOUT_MS,
	LIVE_UPSTREAM_MAX_PAYLOAD_BYTES,
	LiveCloseKind,
} from './live-stream.constants';

const MAX_REQUEST_VALUE_LENGTH = 1024;
const NORMAL_CLOSURE = 1000;
/** Reason logged when the client left; the client's own close reason is never read. */
const CLIENT_CLOSED_REASON = 'client_closed';

export interface LiveStreamConnectionOptions {
	client: WebSocket;
	session: CameraStreamSession;
	connectUpstream: (signal: AbortSignal) => Promise<Go2rtcStreamLease>;
	onClosed: (connection: LiveStreamConnection) => void;
	/** Test seam. */
	createUpstream?: (url: string, headers: Record<string, string>) => WebSocket;
}

/**
 * One proxied browser to go2rtc MSE socket.
 *
 * The browser may only send the `mse` request (text, small, validated); everything go2rtc sends is relayed with
 * backpressure. Close reasons are fixed codes and log lines carry ids and fixed codes only: the lease authorization,
 * the upstream url and whatever the peers put in their own close reasons or error messages never leave this class.
 */
export class LiveStreamConnection {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'LiveStreamConnection');

	private readonly abort = new AbortController();
	/** The one `mse` request received before the upstream opened. */
	private pending: string | null = null;
	private requested = false;

	private upstream: WebSocket | null = null;
	private upstreamOpen = false;
	private lease: Go2rtcStreamLease | null = null;

	private started = false;
	private isClosed = false;
	private clientAlive = true;
	private paused = false;

	private lifetimeTimer: NodeJS.Timeout | null = null;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private stallTimer: NodeJS.Timeout | null = null;

	constructor(private readonly options: LiveStreamConnectionOptions) {}

	get session(): CameraStreamSession {
		return this.options.session;
	}

	get closed(): boolean {
		return this.isClosed;
	}

	start(): void {
		if (this.started || this.isClosed) {
			return;
		}

		this.started = true;

		const { client } = this.options;

		client.on('message', (data: RawData, isBinary: boolean) => this.onClientMessage(data, isBinary));
		client.on('pong', () => {
			this.clientAlive = true;
		});
		client.on('close', (code: number) => this.finish(code, CLIENT_CLOSED_REASON, 'gone'));
		client.on('error', () => this.finish(NORMAL_CLOSURE, CLIENT_CLOSED_REASON, 'terminate'));

		this.lifetimeTimer = setTimeout(() => this.close('MAX_LIFETIME'), LIVE_MAX_LIFETIME_MS);
		this.lifetimeTimer.unref();

		this.heartbeatTimer = setInterval(() => this.heartbeat(), LIVE_HEARTBEAT_INTERVAL_MS);
		this.heartbeatTimer.unref();

		void this.connect();
	}

	close(kind: LiveCloseKind): void {
		const [code, reason] = LIVE_CLOSE[kind];

		this.finish(code, reason, 'close');
	}

	private async connect(): Promise<void> {
		let lease: Go2rtcStreamLease;

		try {
			lease = await this.options.connectUpstream(this.abort.signal);
		} catch (error) {
			if (this.isClosed) {
				return;
			}

			this.logFailure('connect', error);
			this.close(this.closeKindFor(error));

			return;
		}

		if (this.isClosed) {
			lease.release();

			return;
		}

		this.lease = lease;

		try {
			const headers = lease.authorization === null ? {} : { Authorization: lease.authorization };
			const upstream = this.options.createUpstream
				? this.options.createUpstream(lease.wsUrl, headers)
				: new WebSocket(lease.wsUrl, {
						headers,
						handshakeTimeout: LIVE_UPSTREAM_CONNECT_TIMEOUT_MS,
						maxPayload: LIVE_UPSTREAM_MAX_PAYLOAD_BYTES,
					});

			this.upstream = upstream;
			this.attachUpstream(upstream);
		} catch (error) {
			this.logFailure('connect', error);
			this.close('UPSTREAM_FAILED');
		}
	}

	private closeKindFor(error: unknown): LiveCloseKind {
		if (error instanceof Go2rtcUnavailableException) {
			return 'RELAY_UNAVAILABLE';
		}

		if (
			error instanceof CamerasNotFoundException ||
			error instanceof CameraProfileUnavailableException ||
			error instanceof CameraOfflineException
		) {
			return 'REVOKED';
		}

		return 'UPSTREAM_FAILED';
	}

	private attachUpstream(upstream: WebSocket): void {
		upstream.on('open', () => {
			if (this.isClosed) {
				return;
			}

			this.upstreamOpen = true;

			if (this.pending !== null) {
				this.sendUpstream(upstream, this.pending);
				this.pending = null;
			}
		});

		upstream.on('message', (data: RawData, isBinary: boolean) => this.onUpstreamMessage(data, isBinary));

		upstream.on('error', (error: Error) => {
			if (this.isClosed) {
				return;
			}

			this.logFailure('upstream', error);
			this.close(this.upstreamOpen ? 'UPSTREAM_CLOSED' : 'UPSTREAM_FAILED');
		});

		upstream.on('close', () => {
			if (!this.isClosed) {
				this.close(this.upstreamOpen ? 'UPSTREAM_CLOSED' : 'UPSTREAM_FAILED');
			}
		});
	}

	private onClientMessage(data: RawData, isBinary: boolean): void {
		if (this.isClosed) {
			return;
		}

		if (isBinary) {
			this.close('UNSUPPORTED_DATA');

			return;
		}

		const request = parseRequest(rawToString(data));

		// Each `mse` request adds a consumer on the go2rtc socket, so a connection carries exactly one.
		if (request === null || this.requested) {
			this.close('PROTOCOL_VIOLATION');

			return;
		}

		this.requested = true;

		if (this.upstream && this.upstreamOpen) {
			this.sendUpstream(this.upstream, request);

			return;
		}

		this.pending = request;
	}

	private sendUpstream(upstream: WebSocket, frame: string): void {
		upstream.send(frame, () => undefined);
	}

	private onUpstreamMessage(data: RawData, isBinary: boolean): void {
		const { client } = this.options;

		if (this.isClosed || client.readyState !== WebSocket.OPEN) {
			return;
		}

		client.send(data, { binary: isBinary }, () => this.onClientSent());

		if (!this.paused && this.upstream && client.bufferedAmount > LIVE_HIGH_WATER_BYTES) {
			this.paused = true;
			this.upstream.pause();
			this.stallTimer = setTimeout(() => this.close('SLOW_CONSUMER'), LIVE_STALL_TIMEOUT_MS);
			this.stallTimer.unref();
		}
	}

	private onClientSent(): void {
		if (!this.paused || this.isClosed || this.options.client.bufferedAmount >= LIVE_LOW_WATER_BYTES) {
			return;
		}

		this.paused = false;
		this.clearTimer('stallTimer');
		this.upstream?.resume();
	}

	private heartbeat(): void {
		if (!this.clientAlive) {
			this.logger.warn(`Live stream client unresponsive session=${this.session.id} device=${this.session.deviceId}`);
			this.finish(NORMAL_CLOSURE, CLIENT_CLOSED_REASON, 'terminate');

			return;
		}

		this.clientAlive = false;

		try {
			this.options.client.ping();
		} catch {
			// The socket is going away; its close event finishes the connection.
		}
	}

	private finish(code: number, reason: string, clientAction: 'close' | 'terminate' | 'gone'): void {
		if (this.isClosed) {
			return;
		}

		this.isClosed = true;

		this.clearTimer('lifetimeTimer');
		this.clearTimer('heartbeatTimer');
		this.clearTimer('stallTimer');
		this.abort.abort();

		const { client } = this.options;

		try {
			if (clientAction === 'close') {
				client.close(code, reason);
			} else if (clientAction === 'terminate') {
				client.terminate();
			}
		} catch {
			client.terminate();
		}

		this.closeUpstream();

		try {
			this.lease?.release();
		} finally {
			this.lease = null;
			this.pending = null;

			this.logger.log(
				`Live stream closed session=${this.session.id} device=${this.session.deviceId} code=${code} reason=${reason}`,
			);

			this.options.onClosed(this);
		}
	}

	private closeUpstream(): void {
		const upstream = this.upstream;

		if (!upstream) {
			return;
		}

		try {
			if (upstream.readyState === WebSocket.CONNECTING || (upstream.readyState === WebSocket.OPEN && this.paused)) {
				// A connecting socket cannot be closed, and a paused one would never process the close frame.
				upstream.terminate();
			} else if (upstream.readyState === WebSocket.OPEN) {
				upstream.close(NORMAL_CLOSURE);
			}
		} catch {
			upstream.terminate();
		}
	}

	private clearTimer(name: 'lifetimeTimer' | 'heartbeatTimer' | 'stallTimer'): void {
		const timer = this[name];

		if (timer) {
			clearTimeout(timer);
			clearInterval(timer);
			this[name] = null;
		}
	}

	private logFailure(stage: 'connect' | 'upstream', error: unknown): void {
		this.logger.warn(
			`Live stream failed session=${this.session.id} device=${this.session.deviceId} stage=${stage} error=${errorName(error)}`,
		);
	}
}

function rawToString(data: RawData): string {
	if (Array.isArray(data)) {
		return Buffer.concat(data).toString('utf8');
	}

	return Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.from(data).toString('utf8');
}

/**
 * The only request a browser may send: `{ "type": "mse", "value"?: string }`, with no other key.
 *
 * Returns the message to forward, rebuilt from the validated fields: go2rtc's decoder matches keys case-insensitively
 * and keeps the last duplicate, so the raw text is never forwarded. `null` when the frame is not acceptable.
 */
function parseRequest(frame: string): string | null {
	let parsed: unknown;

	try {
		parsed = JSON.parse(frame);
	} catch {
		return null;
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return null;
	}

	const keys = Object.keys(parsed);

	if (keys.some((key) => key !== 'type' && key !== 'value')) {
		return null;
	}

	const { type, value } = parsed as Record<string, unknown>;

	if (type !== 'mse') {
		return null;
	}

	if (value === undefined) {
		return JSON.stringify({ type: 'mse' });
	}

	if (typeof value !== 'string' || value.length > MAX_REQUEST_VALUE_LENGTH) {
		return null;
	}

	return JSON.stringify({ type: 'mse', value });
}
