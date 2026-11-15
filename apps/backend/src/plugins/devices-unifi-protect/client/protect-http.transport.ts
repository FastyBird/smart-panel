import * as http from 'http';
import * as https from 'https';

import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectHeaders } from './protect-rate-pacer';

export interface ProtectTransportRequest {
	method: 'GET' | 'POST';
	path: string;
	headers: Record<string, string>;
	/** One timer per request: it covers connect, headers and body. */
	timeoutMs: number;
	maxBytes: number;
	signal?: AbortSignal;
	/** Sent as `application/json` with its `Content-Length`. */
	body?: Buffer;
}

export interface ProtectTransportResponse {
	status: number;
	headers: ProtectHeaders;
	body: Buffer;
}

export interface ProtectTransport {
	request(request: ProtectTransportRequest): Promise<ProtectTransportResponse>;
	close(): void;
}

// Failures that the transport itself decides carry this placeholder; the client rewrites the operation.
const TRANSPORT_OPERATION = 'meta/info';

/**
 * Plain `https` transport over the given agent. It always asks the agent's configured host and port, never follows
 * redirects, caps the body, and rejects with the raw Node error for connection failures so the caller can tell a
 * reset socket from other failures. Protocol failures (oversized body), timeouts and cancellation are
 * `ProtectApiError`s.
 */
export class NodeProtectTransport implements ProtectTransport {
	private readonly host: string;
	private readonly port: number;
	private readonly agent: https.Agent;

	constructor(options: { host: string; port: number; agent: https.Agent }) {
		this.host = options.host;
		this.port = options.port;
		this.agent = options.agent;
	}

	request(request: ProtectTransportRequest): Promise<ProtectTransportResponse> {
		return new Promise((resolve, reject) => {
			if (request.signal?.aborted) {
				reject(new ProtectApiError(ProtectErrorCategory.CANCELLED, TRANSPORT_OPERATION));

				return;
			}

			let settled = false;
			const settle = (): boolean => {
				if (settled) {
					return false;
				}

				settled = true;
				clearTimeout(timer);
				request.signal?.removeEventListener('abort', onAbort);

				return true;
			};
			const succeed = (response: ProtectTransportResponse): void => {
				if (settle()) {
					resolve(response);
				}
			};
			// Not assigned yet when `https.request()` itself throws, e.g. for a header value Node refuses.
			let req: http.ClientRequest | undefined;
			const fail = (error: Error): void => {
				if (settle()) {
					req?.destroy();
					reject(error);
				}
			};
			const onAbort = (): void => fail(new ProtectApiError(ProtectErrorCategory.CANCELLED, TRANSPORT_OPERATION));
			const timer = setTimeout(
				() => fail(new ProtectApiError(ProtectErrorCategory.TIMEOUT, TRANSPORT_OPERATION)),
				request.timeoutMs,
			);

			request.signal?.addEventListener('abort', onAbort, { once: true });

			try {
				req = https.request(
					{
						host: this.host,
						port: this.port,
						method: request.method,
						path: request.path,
						headers:
							request.body === undefined
								? request.headers
								: {
										...request.headers,
										'Content-Type': 'application/json',
										'Content-Length': String(request.body.length),
									},
						agent: this.agent,
					},
					(res: http.IncomingMessage) => {
						const declared = Number(res.headers['content-length']);

						if (Number.isFinite(declared) && declared > request.maxBytes) {
							res.destroy();
							fail(new ProtectApiError(ProtectErrorCategory.PROTOCOL, TRANSPORT_OPERATION));

							return;
						}

						const chunks: Buffer[] = [];
						let received = 0;

						res.on('data', (chunk: Buffer) => {
							received += chunk.length;

							if (received > request.maxBytes) {
								res.destroy();
								fail(new ProtectApiError(ProtectErrorCategory.PROTOCOL, TRANSPORT_OPERATION));

								return;
							}

							chunks.push(chunk);
						});
						res.on('end', () =>
							succeed({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks, received) }),
						);
						res.on('error', (error) => fail(error));
						res.on('close', () => {
							if (!res.complete) {
								fail(new ProtectApiError(ProtectErrorCategory.PROTOCOL, TRANSPORT_OPERATION));
							}
						});
					},
				);
			} catch (error) {
				fail(error as Error);

				return;
			}

			req.on('error', (error) => fail(error));
			req.end(request.body);
		});
	}

	close(): void {
		this.agent.destroy();
	}
}
