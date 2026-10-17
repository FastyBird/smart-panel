import { createHash, randomBytes } from 'node:crypto';
import { IncomingHttpHeaders, request as httpRequest } from 'node:http';

import { RemoteDewPointDeadline } from './remote-dew-point-lease.contract';

interface HttpReply {
	status: number;
	headers: IncomingHttpHeaders;
	body: string;
}
export class AuthenticatedShellyRequestError extends Error {
	constructor(
		message: string,
		readonly mutationMayHaveBeenSent = false,
	) {
		super(message);
	}
}
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Strict Digest SHA256 / qop=auth. Password and Authorization are never returned in diagnostics. */
export function shellyScriptDigest(
	challenge: string,
	deviceId: string,
	password: string,
	method: 'GET' | 'POST',
	uri: string,
	cnonce: string,
): string {
	if (
		typeof challenge !== 'string' ||
		challenge.length > 1024 ||
		!challenge.startsWith('Digest ') ||
		!/^\/[A-Za-z0-9/_-]+$/.test(uri) ||
		!/^[A-Za-z0-9_-]{1,80}$/.test(deviceId) ||
		!/^[a-f0-9]{32}$/.test(cnonce)
	)
		throw new AuthenticatedShellyRequestError('Invalid authentication challenge');
	const fields: Record<string, string> = {};
	const pattern = /([a-zA-Z_]+)=(?:"([^"\r\n]*)"|([A-Za-z0-9_-]+))(?:,\s*|$)/g;
	let consumed = 7;
	for (const match of challenge.matchAll(pattern)) {
		if (match.index !== consumed || fields[match[1]] !== undefined)
			throw new AuthenticatedShellyRequestError('Ambiguous authentication challenge');
		fields[match[1]] = match[2] ?? match[3];
		consumed = match.index + match[0].length;
	}
	if (
		consumed !== challenge.length ||
		fields.algorithm !== 'SHA-256' ||
		fields.realm !== deviceId ||
		fields.qop !== 'auth' ||
		!fields.nonce ||
		!/^[A-Za-z0-9+/_=-]{1,512}$/.test(fields.nonce)
	)
		throw new AuthenticatedShellyRequestError('Authentication realm, algorithm or nonce mismatch');
	const nc = '00000001';
	const response = sha256(
		`${sha256(`admin:${deviceId}:${password}`)}:${fields.nonce}:${nc}:${cnonce}:auth:${sha256(`${method}:${uri}`)}`,
	);
	return `Digest username="admin", realm="${deviceId}", nonce="${fields.nonce}", uri="${uri}", algorithm=SHA-256, response="${response}", qop=auth, nc=${nc}, cnonce="${cnonce}"`;
}

/** A separate authenticated script channel; no unauthenticated mutation and no automatic mutating retry. */
export class AuthenticatedShellyScriptHttp {
	constructor(
		private readonly endpoint: URL,
		private readonly deviceId: string,
		private readonly password: string,
		private readonly createRequest: typeof httpRequest = httpRequest,
	) {
		if (
			endpoint.protocol !== 'http:' ||
			endpoint.username ||
			endpoint.password ||
			endpoint.search ||
			endpoint.hash ||
			!/^\/script\/\d+\/remote-dew-point$/.test(endpoint.pathname) ||
			!password ||
			password.length > 256
		)
			throw new AuthenticatedShellyRequestError('Invalid authenticated script endpoint or credential');
		this.endpoint = new URL(endpoint);
	}

	async request<T>(
		method: 'GET' | 'POST',
		payload: object | null,
		deadline: RemoteDewPointDeadline,
		isCurrent: () => boolean,
		onMutatingSend?: () => void,
	): Promise<T> {
		// Firmware 1.7.5: ALWAYS fresh 401 from a read-only GET on this exact URI/host.
		const challenge = await this.exchange('GET', '', {}, deadline, isCurrent);
		if (challenge.status === 200) throw new AuthenticatedShellyRequestError('Device authentication disabled');
		if (challenge.status !== 401 || typeof challenge.headers['www-authenticate'] !== 'string')
			throw new AuthenticatedShellyRequestError('Fresh authentication challenge refused');
		if (!isCurrent() || deadline.remaining() <= 0)
			throw new AuthenticatedShellyRequestError('Authority expired before authentication');
		const authorization = shellyScriptDigest(
			challenge.headers['www-authenticate'],
			this.deviceId,
			this.password,
			method,
			this.endpoint.pathname,
			randomBytes(16).toString('hex'),
		);
		const body = payload === null ? '' : JSON.stringify(payload);
		const reply = await this.exchange(
			method,
			body,
			{ Authorization: authorization },
			deadline,
			isCurrent,
			onMutatingSend,
		);
		if (reply.status !== 200)
			throw new AuthenticatedShellyRequestError('Authenticated script request refused', method === 'POST');
		try {
			return JSON.parse(reply.body) as T;
		} catch {
			throw new AuthenticatedShellyRequestError('Invalid authenticated script response', method === 'POST');
		}
	}

	private exchange(
		method: 'GET' | 'POST',
		body: string,
		extra: Record<string, string>,
		deadline: RemoteDewPointDeadline,
		isCurrent: () => boolean,
		onSend?: () => void,
	): Promise<HttpReply> {
		if (!isCurrent() || deadline.remaining() <= 0)
			return Promise.reject(new AuthenticatedShellyRequestError('Script authority expired'));
		const headers = {
			Host: this.endpoint.host,
			Connection: 'close',
			'Content-Type': 'application/json',
			'Content-Length': String(Buffer.byteLength(body)),
			...extra,
		};
		const bytes = Buffer.byteLength(
			`${method} ${this.endpoint.pathname} HTTP/1.1\r\n${Object.entries(headers)
				.map(([k, v]) => `${k}: ${v}\r\n`)
				.join('')}\r\n${body}`,
		);
		if (bytes > 3072) return Promise.reject(new AuthenticatedShellyRequestError('Script request exceeds 3072 bytes'));
		return new Promise((resolve, reject) => {
			let sent = false;
			let settled = false;
			const finish = (error?: Error, reply?: HttpReply) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				if (error) reject(new AuthenticatedShellyRequestError(error.message, sent && method === 'POST'));
				else resolve(reply);
			};
			const request = this.createRequest(
				this.endpoint,
				{ method, headers, agent: false, setHost: false },
				(response) => {
					let text = '';
					response.setEncoding('utf8');
					response.on('data', (chunk: string) => {
						text += chunk;
						if (Buffer.byteLength(text) > 8192) request.destroy(new Error('Script response too large'));
					});
					response.on('error', (error) => finish(error));
					response.on('end', () => {
						if (!isCurrent() || deadline.remaining() <= 0)
							return finish(new Error('Script response authority expired'));
						finish(undefined, { status: response.statusCode, headers: response.headers, body: text });
					});
				},
			);
			const timer = setTimeout(
				() => {
					finish(new Error('Script request timed out'));
					request.destroy();
				},
				Math.min(3000, deadline.remaining()),
			);
			request.on('error', (error) => finish(error));
			request.once('socket', (socket) => {
				const send = () => {
					if (settled || !isCurrent() || deadline.remaining() <= 0) {
						request.destroy(new Error('Script authority expired before send'));
						return;
					}
					sent = true;
					try {
						if (method === 'POST') onSend?.();
						request.end(body);
					} catch {
						finish(new Error('Script send failed'));
						request.destroy();
					}
				};
				if (socket.connecting) socket.once('connect', send);
				else send();
			});
		});
	}
}
