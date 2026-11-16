import { IncomingMessage } from 'http';
import { Agent } from 'https';
import WebSocket, { RawData } from 'ws';

import { ProtectEndpoint, ProtectSubscriptionTopic } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory, toProtectApiError } from '../errors/protect-api.error';

import { ProtectHeaders } from './protect-rate-pacer';

export interface ProtectSubscriptionHandlers {
	/** Text frames only. */
	message(text: string): void;
	pong(): void;
	/** Called once when the open socket ends for any reason other than close(); never after close(). */
	closed(failure: ProtectApiError): void;
}

export interface ProtectSubscription {
	readonly topic: ProtectSubscriptionTopic;
	ping(): void;
	/** Idempotent; terminates the socket and suppresses `closed`. */
	close(): void;
}

export const protectSubscriptionEndpoint = (topic: ProtectSubscriptionTopic): ProtectEndpoint =>
	topic === 'devices' ? 'subscribe/devices' : 'subscribe/events';

export interface ProtectSubscriptionConnection {
	url: string;
	topic: ProtectSubscriptionTopic;
	agent: Agent;
	apiKey: string;
	handshakeTimeoutMs: number;
	maxPayload: number;
	signal: AbortSignal;
	handlers: ProtectSubscriptionHandlers;
	/** Maps a refused upgrade to a typed failure (and applies any pacing consequence); no body is ever read. */
	onRejected(status: number, headers: ProtectHeaders): ProtectApiError;
	debug(message: string): void;
	/** Called once when the socket is gone, however it ended. */
	ended(subscription: ProtectSubscription): void;
}

const HANDSHAKE_TIMEOUT_MESSAGE = 'Opening handshake has timed out';
const MAX_PAYLOAD_CODE = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
const CLOSE_MESSAGE_TOO_BIG = 1009;

const codeOf = (error: unknown): string | null =>
	typeof (error as { code?: unknown } | null)?.code === 'string' ? (error as { code: string }).code : null;

/** Never forwards a `ws` or Node message: only the endpoint template and a category reach the failure. */
function openFailure(error: unknown, endpoint: ProtectEndpoint): ProtectApiError {
	if ((error as { message?: unknown } | null)?.message === HANDSHAKE_TIMEOUT_MESSAGE) {
		return new ProtectApiError(ProtectErrorCategory.TIMEOUT, endpoint);
	}

	const typed = toProtectApiError(error, endpoint);

	return typed.operation === endpoint
		? typed
		: new ProtectApiError(typed.category, endpoint, { status: typed.status, retryAfterMs: typed.retryAfterMs });
}

/** One `ws` WebSocket over the client's verified TLS agent. */
export class NodeProtectSubscription implements ProtectSubscription {
	/** Resolves once the upgrade succeeded; rejects with a typed failure and leaves no socket behind. */
	static open(connection: ProtectSubscriptionConnection): Promise<NodeProtectSubscription> {
		const endpoint = protectSubscriptionEndpoint(connection.topic);

		return new Promise<NodeProtectSubscription>((resolve, reject) => {
			const socket = new WebSocket(connection.url, {
				agent: connection.agent,
				headers: { 'X-API-KEY': connection.apiKey },
				handshakeTimeout: connection.handshakeTimeoutMs,
				maxPayload: connection.maxPayload,
				perMessageDeflate: false,
				followRedirects: false,
			});
			let finished = false;

			const finish = (outcome: () => void): void => {
				if (finished) {
					return;
				}

				finished = true;
				connection.signal.removeEventListener('abort', onAbort);
				socket.removeListener('open', onOpen);
				socket.removeListener('error', onError);
				socket.removeListener('unexpected-response', onUnexpectedResponse);
				outcome();
			};
			const fail = (failure: ProtectApiError): void =>
				finish(() => {
					// A late socket error after this point must never go unhandled.
					socket.on('error', () => undefined);
					socket.terminate();
					reject(failure);
				});
			const onAbort = (): void => fail(new ProtectApiError(ProtectErrorCategory.CANCELLED, endpoint));
			const onError = (error: unknown): void => fail(openFailure(error, endpoint));
			const onUnexpectedResponse = (request: { destroy(): void }, response: IncomingMessage): void => {
				const failure = connection.onRejected(response.statusCode ?? 0, response.headers);

				response.resume();
				request.destroy();
				fail(failure);
			};
			const onOpen = (): void =>
				finish(() => resolve(new NodeProtectSubscription(socket, connection.topic, endpoint, connection)));

			socket.once('open', onOpen);
			socket.once('error', onError);
			socket.once('unexpected-response', onUnexpectedResponse);
			connection.signal.addEventListener('abort', onAbort, { once: true });

			if (connection.signal.aborted) {
				onAbort();
			}
		});
	}

	private settled = false;

	/** True once the socket ended or was closed; an opened subscription can already be settled (oversized first frame). */
	get isSettled(): boolean {
		return this.settled;
	}

	private constructor(
		private readonly socket: WebSocket,
		readonly topic: ProtectSubscriptionTopic,
		private readonly endpoint: ProtectEndpoint,
		private readonly connection: ProtectSubscriptionConnection,
	) {
		let tooBig = false;

		socket.on('message', (data: RawData, isBinary: boolean) => {
			if (this.settled) {
				return;
			}

			if (isBinary) {
				connection.debug(`${endpoint} dropped a binary frame`);

				return;
			}

			connection.handlers.message(rawToText(data));
		});
		socket.on('pong', () => {
			if (!this.settled) {
				connection.handlers.pong();
			}
		});
		socket.on('error', (error: unknown) => {
			tooBig = tooBig || codeOf(error) === MAX_PAYLOAD_CODE;
			this.end(tooBig);
		});
		socket.on('close', (code: number) => this.end(tooBig || code === CLOSE_MESSAGE_TOO_BIG));
	}

	ping(): void {
		if (this.settled) {
			return;
		}

		try {
			this.socket.ping();
		} catch {
			// A socket that is no longer open reports its end through `close`.
		}
	}

	close(): void {
		if (this.settled) {
			return;
		}

		this.settled = true;
		this.socket.terminate();
		this.connection.ended(this);
	}

	private end(protocol: boolean): void {
		if (this.settled) {
			return;
		}

		this.settled = true;
		this.socket.terminate();
		this.connection.ended(this);
		this.connection.handlers.closed(
			new ProtectApiError(protocol ? ProtectErrorCategory.PROTOCOL : ProtectErrorCategory.UNAVAILABLE, this.endpoint),
		);
	}
}

function rawToText(data: RawData): string {
	if (Array.isArray(data)) {
		return Buffer.concat(data).toString('utf8');
	}

	return Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.from(data).toString('utf8');
}
