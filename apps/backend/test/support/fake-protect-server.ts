import { readFileSync } from 'fs';
import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as net from 'net';
import { join, resolve } from 'path';
import { Duplex } from 'stream';
import * as tls from 'tls';
import { TLSSocket } from 'tls';
import { WebSocket, WebSocketServer } from 'ws';

import {
	PROTECT_RTSPS_QUALITIES,
	ProtectRtspsQuality,
} from '../../src/plugins/devices-unifi-protect/devices-unifi-protect.constants';

import { PROTECT_TEST_DIRECT_DOMAIN, PROTECT_TEST_TLS, protectTlsServerOptions } from './protect-tls';

// TEST SUPPORT ONLY: a loopback HTTPS stand-in for a UniFi Protect console, serving the UP-0 fixtures with the
// committed test certificates, plus the two subscription WebSockets (`subscribe/devices`, `subscribe/events`).

export const FAKE_PROTECT_API_KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
export const FAKE_PROTECT_ALIAS = 'SENTINELALIASprotect0123456789';

/** The alias of one quality; `high` keeps the alias that earlier tests know. */
export const fakeProtectStreamAlias = (quality: ProtectRtspsQuality): string =>
	quality === 'high' ? FAKE_PROTECT_ALIAS : `SENTINELALIAS${quality}0123456789`;

export interface FakeProtectRequest {
	method: string;
	path: string;
	query: Record<string, string>;
	hadApiKey: boolean;
	servername: string | null;
}

export type FakeProtectTopic = 'devices' | 'events';
export type FakeProtectDeviceResource = 'cameras' | 'sensors' | 'lights';

export interface FakeProtectResponse {
	status: number;
	headers?: Record<string, string>;
	body?: string | Buffer;
}

export interface FakeProtectServerOptions {
	apiKey: string;
	/** Null serves `meta-info.json` as captured. */
	applicationVersion: string | null;
	/** Sliding window per key; null disables the limit. */
	rateLimit: { quota: number; windowSeconds: number } | null;
	/** Matching paths send their headers and never end the body. */
	hangPaths: RegExp[];
	/** Fixtures whose cameras the console lists, in order; the first entry of an id wins. */
	cameraFixtures: string[];
	/** Opt-in: `start()` also opens a TLS RTSP endpoint, and stream URLs point at it instead of `:7441`. */
	rtsps: boolean;
	/**
	 * Certificate of the RTSP endpoint, read per connection: `mirror` serves what the API port serves (the console
	 * certificate under SNI `fakeconsole.id.ui.direct`, else the self-signed one); `console` the CA-signed console
	 * certificate whatever the SNI, including none.
	 */
	rtspsCertificate: 'mirror' | 'console';
}

interface RateLimitFixture {
	ok: Record<string, string>;
	rate_limited: Record<string, string>;
}

const FIXTURES = resolve(__dirname, '../../src/plugins/devices-unifi-protect/__fixtures__');
const BASE = '/proxy/protect/integration/v1/';

const readFixture = (name: string): Buffer => readFileSync(join(FIXTURES, name));
const readJson = <T>(name: string): T => JSON.parse(readFixture(name).toString('utf8')) as T;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const MAX_POST_BYTES = 4 * 1024;
const BAD_QUALITIES = { error: 'Invalid qualities', name: 'BAD_REQUEST' };
const DEFAULT_RATE_LIMIT = { quota: 10, windowSeconds: 1 };
const MAX_RTSP_REQUEST_BYTES = 16 * 1024;
const RTSP_HEADER_END = '\r\n\r\n';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Recursive object merge into a copy; arrays and scalars are replaced. Skips prototype-polluting keys. */
function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...target };

	for (const [name, value] of Object.entries(patch)) {
		if (UNSAFE_KEYS.has(name)) {
			continue;
		}

		const existing = result[name];

		result[name] = isRecord(value) && isRecord(existing) ? deepMerge(existing, value) : value;
	}

	return result;
}

const json = (status: number, value: unknown): FakeProtectResponse => ({
	status,
	headers: JSON_HEADERS,
	body: JSON.stringify(value),
});

const unauthorized = (): FakeProtectResponse => json(401, { error: 'Unauthorized', name: 'UNAUTHORIZED' });
const notFound = (): FakeProtectResponse => json(404, { error: 'Not found', name: 'NOT_FOUND' });

const DEVICE_FIXTURES: Record<string, string> = {
	nvrs: 'nvrs.json',
	cameras: 'cameras.json',
	sensors: 'sensors.json',
	lights: 'lights.json',
	chimes: 'chimes.json',
};

export class FakeProtectServer {
	static async start(options: Partial<FakeProtectServerOptions> = {}): Promise<FakeProtectServer> {
		const fake = new FakeProtectServer(options);

		await new Promise<void>((resolveListen) => fake.server.listen(0, '127.0.0.1', resolveListen));

		fake.port = (fake.server.address() as AddressInfo).port;

		if (fake.options.rtsps) {
			const rtspsServer = fake.createRtspsServer();

			await new Promise<void>((resolveListen) => rtspsServer.listen(0, '127.0.0.1', resolveListen));

			fake.rtspsServer = rtspsServer;
			fake.rtspsPort = (rtspsServer.address() as AddressInfo).port;
		}

		return fake;
	}

	readonly host = '127.0.0.1' as const;
	port = 0;
	readonly requests: FakeProtectRequest[] = [];
	readonly writes: FakeProtectRequest[] = [];
	/** Accepted PATCH bodies, in order. Cleared by `reset()`. */
	readonly patches: { resource: 'cameras' | 'lights'; id: string; body: Record<string, unknown> }[] = [];
	readonly streamPosts: { cameraId: string; qualities: string[] }[] = [];
	/** Every upgrade attempt (accepted or refused); never part of `requests`. Cleared by `reset()`. */
	readonly upgrades: FakeProtectRequest[] = [];
	pingsReceived = 0;
	forbiddenHits = 0;
	rateLimited = 0;
	/** Port of the TLS RTSP endpoint; 0 unless started with `rtsps: true`. */
	rtspsPort = 0;
	/**
	 * First line of every RTSP request received over TLS, in order (memory only, never logged: it carries the alias).
	 * Cleared by `reset()`.
	 */
	readonly rtspRequestLines: string[] = [];
	/** Decrypted bytes received on each RTSP connection that completed its handshake, in accept order. */
	readonly rtspsBytesReceived: number[] = [];

	private options: FakeProtectServerOptions;
	private readonly queue: { match: RegExp; response: FakeProtectResponse; method?: string }[] = [];
	private readonly streams = new Map<string, Set<ProtectRtspsQuality>>();
	private readonly windows = new Map<string, number[]>();
	private readonly sockets = new Set<net.Socket>();
	private readonly server: https.Server;
	private readonly wss = new WebSocketServer({ noServer: true });
	private readonly topicSockets: Record<FakeProtectTopic, Set<WebSocket>> = { devices: new Set(), events: new Set() };
	private readonly overlays = new Map<string, Record<string, unknown>>();
	private readonly removals = new Set<string>();
	private upgradeRefusals: { status: number; headers?: Record<string, string> }[] = [];
	private pongs = true;
	private echo = false;
	private rtspsServer: net.Server | null = null;
	private readonly rtspsSockets = new Set<net.Socket>();
	private readonly rtspAnswers: string[] = [];
	private readonly rateHeaders = readJson<RateLimitFixture>('rate-limit-headers.json');

	private constructor(options: Partial<FakeProtectServerOptions>) {
		this.options = {
			apiKey: FAKE_PROTECT_API_KEY,
			applicationVersion: null,
			rateLimit: DEFAULT_RATE_LIMIT,
			hangPaths: [],
			cameraFixtures: ['cameras.json'],
			rtsps: false,
			rtspsCertificate: 'mirror',
			...options,
		};
		this.server = https.createServer(protectTlsServerOptions(), (req, res) => this.handle(req, res));
		// Tracked from the TCP connection, so stop() also ends a client still negotiating TLS (it never reaches
		// `secureConnection`), instead of waiting for the handshake timeout.
		this.server.on('connection', (socket: net.Socket) => {
			this.sockets.add(socket);
			socket.on('close', () => this.sockets.delete(socket));
			socket.on('error', () => undefined);
		});
		this.server.on('secureConnection', (socket: TLSSocket) => {
			socket.on('error', () => undefined);
		});
		this.server.on('tlsClientError', () => undefined);
		this.server.on('upgrade', (req: http.IncomingMessage, socket: Duplex, head: Buffer) =>
			this.handleUpgrade(req, socket, head),
		);
	}

	/** Open subscription sockets of a topic. */
	subscriptionCount(topic: FakeProtectTopic): number {
		return [...this.topicSockets[topic]].filter((socket) => socket.readyState === WebSocket.OPEN).length;
	}

	/** JSON.stringify of the frame to every open socket of the topic. */
	sendFrame(topic: FakeProtectTopic, frame: unknown): void {
		this.sendRaw(topic, JSON.stringify(frame));
	}

	sendRaw(topic: FakeProtectTopic, data: string | Buffer, binary = false): void {
		this.topicSockets[topic].forEach((socket) => {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(data, { binary });
			}
		});
	}

	/** Terminates every open subscription socket. */
	dropSubscriptions(): void {
		Object.values(this.topicSockets).forEach((sockets) => sockets.forEach((socket) => socket.terminate()));
	}

	/** Each queued answer refuses one upgrade (before the key check); null clears the queue. */
	refuseUpgrades(response: { status: number; headers?: Record<string, string> } | null): void {
		this.upgradeRefusals = response === null ? [] : [...this.upgradeRefusals, response];
	}

	answerPings(enabled: boolean): void {
		this.pongs = enabled;
	}

	/** When enabled, an accepted PATCH is echoed as one devices `update` frame to every open devices socket. */
	echoPatches(enabled: boolean): void {
		this.echo = enabled;
	}

	/** Shallow overlay on the list and by-id reads of the resource. */
	updateDevice(resource: FakeProtectDeviceResource, id: string, patch: Record<string, unknown>): void {
		const key = `${resource}/${id}`;

		this.overlays.set(key, { ...this.overlays.get(key), ...patch });
	}

	/** Hides the device from the list and by-id reads. */
	removeDevice(resource: FakeProtectDeviceResource, id: string): void {
		this.removals.add(`${resource}/${id}`);
	}

	private handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): void {
		socket.on('error', () => undefined);

		const url = new URL(req.url ?? '/', 'https://fake.invalid');
		const presentedKey = req.headers['x-api-key'];
		const topic = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : '';
		const reject = (response: { status: number; headers?: Record<string, string> }): void => {
			const headers = { connection: 'close', 'content-length': '0', ...response.headers };

			socket.end(
				`HTTP/1.1 ${response.status} Refused\r\n${Object.entries(headers)
					.map(([name, value]) => `${name}: ${value}`)
					.join('\r\n')}\r\n\r\n`,
			);
		};

		if ((req.method ?? 'GET') !== 'GET' || (topic !== 'subscribe/devices' && topic !== 'subscribe/events')) {
			reject({ status: 404 });

			return;
		}

		this.upgrades.push({
			method: 'GET',
			path: url.pathname,
			query: Object.fromEntries(url.searchParams.entries()),
			hadApiKey: typeof presentedKey === 'string' && presentedKey.length > 0,
			servername: (req.socket as TLSSocket).servername || null,
		});

		const refusal = this.upgradeRefusals.shift();

		if (refusal !== undefined) {
			reject(refusal);

			return;
		}

		if (presentedKey !== this.options.apiKey) {
			reject({ status: 401 });

			return;
		}

		const sockets = this.topicSockets[topic === 'subscribe/devices' ? 'devices' : 'events'];

		this.wss.handleUpgrade(req, socket, head, (ws) => {
			sockets.add(ws);
			ws.on('error', () => undefined);
			ws.on('close', () => sockets.delete(ws));
			ws.on('ping', () => {
				this.pingsReceived += 1;
			});
			ws.on('message', () => undefined);

			// `ws` answers a ping while `_autoPong` is true; reading the flag live lets `answerPings` switch it per test.
			Object.defineProperty(ws, '_autoPong', { get: () => this.pongs });
		});
	}

	/**
	 * Queues the answer to the next RTSP request (sent verbatim, e.g. a `302` with a `Location`); null clears the queue.
	 * Without one the endpoint answers `RTSP/1.0 200 OK` with the request's `CSeq`.
	 */
	rtspAnswer(response: string | null): void {
		if (response === null) {
			this.rtspAnswers.length = 0;

			return;
		}

		this.rtspAnswers.push(response);
	}

	set(options: Partial<FakeProtectServerOptions>): void {
		this.options = { ...this.options, ...options };
	}

	/** Replaces the enabled stream qualities of a camera. */
	setStreams(cameraId: string, qualities: ProtectRtspsQuality[]): void {
		this.streams.set(cameraId, new Set(qualities));
	}

	/** Consumed once, before normal routing, by the first request whose path (and method, when given) matches. */
	enqueue(match: RegExp, response: FakeProtectResponse, method?: string): void {
		this.queue.push({ match, response, method });
	}

	reset(): void {
		this.requests.length = 0;
		this.writes.length = 0;
		this.streamPosts.length = 0;
		this.streams.clear();
		this.queue.length = 0;
		this.windows.clear();
		this.forbiddenHits = 0;
		this.rateLimited = 0;
		this.upgrades.length = 0;
		this.pingsReceived = 0;
		this.overlays.clear();
		this.removals.clear();
		this.upgradeRefusals = [];
		this.pongs = true;
		this.echo = false;
		this.patches.length = 0;
		this.rtspRequestLines.length = 0;
		this.rtspsBytesReceived.length = 0;
		this.rtspAnswers.length = 0;
		this.options = { ...this.options, rtspsCertificate: 'mirror' };
	}

	stop(): Promise<void> {
		return new Promise<void>((resolveStop) => {
			this.dropSubscriptions();
			this.wss.close();
			this.sockets.forEach((socket) => socket.destroy());
			this.rtspsSockets.forEach((socket) => socket.destroy());

			const rtspsServer = this.rtspsServer;

			this.rtspsServer = null;

			if (rtspsServer === null) {
				this.server.close(() => resolveStop());

				return;
			}

			let pending = 2;
			const done = (): void => {
				pending -= 1;

				if (pending === 0) {
					resolveStop();
				}
			};

			this.server.close(done);
			rtspsServer.close(done);
		});
	}

	/**
	 * A plain TCP server whose sockets are wrapped in TLS one by one, so the certificate (also the default one, served
	 * when the client sends no SNI) is chosen per connection from the live `rtspsCertificate`.
	 */
	private createRtspsServer(): net.Server {
		const consoleContext = tls.createSecureContext(PROTECT_TEST_TLS.console);
		const selfSignedContext = tls.createSecureContext(PROTECT_TEST_TLS.selfSigned);
		const contextFor = (servername: string | null): tls.SecureContext =>
			this.options.rtspsCertificate === 'console' || servername === PROTECT_TEST_DIRECT_DOMAIN
				? consoleContext
				: selfSignedContext;

		return net.createServer((raw) => {
			this.rtspsSockets.add(raw);
			raw.on('close', () => this.rtspsSockets.delete(raw));
			raw.on('error', () => undefined);

			const socket = new tls.TLSSocket(raw, {
				isServer: true,
				secureContext: contextFor(null),
				SNICallback: (servername, callback) => callback(null, contextFor(servername)),
			});

			socket.on('error', () => raw.destroy());
			socket.once('secure', () => this.serveRtsp(socket));
		});
	}

	/** Reads text RTSP requests (bounded; bodies are not expected), records each request line and answers each once. */
	private serveRtsp(socket: tls.TLSSocket): void {
		const index = this.rtspsBytesReceived.push(0) - 1;
		let pending = '';

		socket.on('data', (chunk: Buffer) => {
			this.rtspsBytesReceived[index] += chunk.length;
			pending += chunk.toString('latin1');

			let end = pending.indexOf(RTSP_HEADER_END);

			while (end !== -1) {
				const header = pending.slice(0, end);

				pending = pending.slice(end + RTSP_HEADER_END.length);

				const [requestLine, ...fields] = header.split('\r\n');
				const cseq = fields.map((field) => /^cseq:\s*(\d+)\s*$/i.exec(field)?.[1]).find((value) => value !== undefined);

				this.rtspRequestLines.push(requestLine);
				socket.write(this.rtspAnswers.shift() ?? `RTSP/1.0 200 OK\r\nCSeq: ${cseq ?? '0'}\r\n\r\n`);

				end = pending.indexOf(RTSP_HEADER_END);
			}

			if (pending.length > MAX_RTSP_REQUEST_BYTES) {
				socket.destroy();
			}
		});
	}

	private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
		const method = req.method ?? 'GET';

		if (method !== 'POST' && method !== 'PATCH') {
			req.resume();
			this.dispatch(req, res, Buffer.alloc(0));

			return;
		}

		const chunks: Buffer[] = [];
		let received = 0;

		req.on('data', (chunk: Buffer) => {
			received += chunk.length;

			if (received <= MAX_POST_BYTES) {
				chunks.push(chunk);
			}
		});
		req.on('end', () => this.dispatch(req, res, received > MAX_POST_BYTES ? null : Buffer.concat(chunks)));
	}

	private dispatch(req: http.IncomingMessage, res: http.ServerResponse, body: Buffer | null): void {
		const url = new URL(req.url ?? '/', 'https://fake.invalid');
		const path = url.pathname;
		const method = req.method ?? 'GET';
		const presentedKey = req.headers['x-api-key'];
		const record: FakeProtectRequest = {
			method,
			path,
			query: Object.fromEntries(url.searchParams.entries()),
			hadApiKey: typeof presentedKey === 'string' && presentedKey.length > 0,
			servername: (req.socket as TLSSocket).servername || null,
		};

		this.requests.push(record);
		if (method !== 'GET') {
			this.writes.push(record);
		}

		if (path.includes('disable-mic-permanently')) {
			this.forbiddenHits += 1;
		}

		const queuedIndex = this.queue.findIndex(
			(entry) => entry.match.test(path) && (entry.method === undefined || entry.method === method),
		);

		if (queuedIndex >= 0) {
			const [{ response }] = this.queue.splice(queuedIndex, 1);

			this.send(res, response, this.rateHeaders.ok);

			return;
		}

		if (method === 'PATCH') {
			if (presentedKey !== this.options.apiKey) {
				this.send(res, unauthorized(), this.rateHeaders.ok);

				return;
			}

			if (this.rateLimit(this.options.apiKey)) {
				this.rateLimited += 1;
				this.send(res, json(429, { error: 'Too Many Requests', name: 'RATE_LIMITED' }), this.rateHeaders.rate_limited);

				return;
			}

			this.send(res, this.routePatch(path, body), this.remaining());

			return;
		}

		if (method === 'POST') {
			const keyedPost = path.startsWith('/proxy/protect/');

			if (keyedPost && presentedKey !== this.options.apiKey) {
				this.send(res, unauthorized(), this.rateHeaders.ok);

				return;
			}

			this.send(res, this.routePost(path, body), this.rateHeaders.ok);

			return;
		}

		if (method !== 'GET') {
			this.send(res, json(405, { error: 'Method not allowed', name: 'METHOD_NOT_ALLOWED' }), this.rateHeaders.ok);

			return;
		}

		if (path === '/api/system') {
			const system = readJson<Record<string, unknown>>('system.json');

			system.directConnectDomain = PROTECT_TEST_DIRECT_DOMAIN;
			this.send(res, json(200, system), {});

			return;
		}

		const keyed = path.startsWith('/proxy/protect/');

		if (keyed && presentedKey !== this.options.apiKey) {
			this.send(res, unauthorized(), this.rateHeaders.ok);

			return;
		}

		if (keyed) {
			const limited = this.rateLimit(this.options.apiKey);

			if (limited) {
				this.rateLimited += 1;
				this.send(res, json(429, { error: 'Too Many Requests', name: 'RATE_LIMITED' }), this.rateHeaders.rate_limited);

				return;
			}
		}

		if (this.options.hangPaths.some((pattern) => pattern.test(path))) {
			res.writeHead(200, { ...this.rateHeaders.ok, 'content-type': 'image/jpeg', 'content-length': '1048576' });
			res.flushHeaders();
			res.write(Buffer.alloc(16));

			return;
		}

		this.send(res, path === '/proxy/protect/api' ? unauthorized() : this.route(path, record.query), this.remaining());
	}

	/** True when the key has used up its window; otherwise records the request. */
	private rateLimit(key: string): boolean {
		const limit = this.options.rateLimit;

		if (limit === null) {
			return false;
		}

		const now = Date.now();
		const used = (this.windows.get(key) ?? []).filter((at) => now - at < limit.windowSeconds * 1000);

		if (used.length >= limit.quota) {
			this.windows.set(key, used);

			return true;
		}

		used.push(now);
		this.windows.set(key, used);

		return false;
	}

	private remaining(): Record<string, string> {
		const limit = this.options.rateLimit;

		if (limit === null) {
			return this.rateHeaders.ok;
		}

		const used = this.windows.get(this.options.apiKey)?.length ?? 0;

		return {
			...this.rateHeaders.ok,
			ratelimit: `"${limit.quota}-in-${limit.windowSeconds}sec"; r=${Math.max(0, limit.quota - used)}; t=${limit.windowSeconds}`,
			'ratelimit-policy': `"${limit.quota}-in-${limit.windowSeconds}sec"; q=${limit.quota}; w=${limit.windowSeconds}; pk=:REDACTED:`,
		};
	}

	private cameras(): { id: string; featureFlags?: { supportFullHdSnapshot?: boolean } }[] {
		const seen = new Set<string>();
		const union: { id: string; featureFlags?: { supportFullHdSnapshot?: boolean } }[] = [];

		for (const fixture of this.options.cameraFixtures) {
			for (const camera of readJson<{ id: string; featureFlags?: { supportFullHdSnapshot?: boolean } }[]>(fixture)) {
				if (!seen.has(camera.id)) {
					seen.add(camera.id);
					union.push(camera);
				}
			}
		}

		return union;
	}

	/** Cameras of `cameras.json` start with `high`, all others with none, until `setStreams` or a POST changes it. */
	private enabledStreams(cameraId: string): Set<ProtectRtspsQuality> {
		let enabled = this.streams.get(cameraId);

		if (enabled === undefined) {
			const original = readJson<{ id: string }[]>('cameras.json').some((camera) => camera.id === cameraId);

			enabled = new Set<ProtectRtspsQuality>(original ? ['high'] : []);
			this.streams.set(cameraId, enabled);
		}

		return enabled;
	}

	private streamMap(cameraId: string): Record<ProtectRtspsQuality, string | null> {
		const enabled = this.enabledStreams(cameraId);

		return Object.fromEntries(
			PROTECT_RTSPS_QUALITIES.map((quality) => [
				quality,
				enabled.has(quality)
					? `rtsps://${this.host}:${this.rtspsPort === 0 ? 7441 : this.rtspsPort}/${fakeProtectStreamAlias(quality)}?enableSrtp`
					: null,
			]),
		) as Record<ProtectRtspsQuality, string | null>;
	}

	private routePatch(path: string, body: Buffer | null): FakeProtectResponse {
		const segments = path.startsWith(BASE) ? path.slice(BASE.length).split('/').filter(Boolean) : [];
		const [resource, id] = segments;

		if (segments.length !== 2 || (resource !== 'cameras' && resource !== 'lights')) {
			return notFound();
		}

		let parsed: unknown;

		try {
			parsed = body === null ? undefined : JSON.parse(body.toString('utf8'));
		} catch {
			parsed = undefined;
		}

		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return json(400, { error: 'Invalid body', name: 'BAD_REQUEST' });
		}

		const key = `${resource}/${id}`;
		const found = (resource === 'cameras' ? this.cameras() : readJson<{ id: string }[]>(DEVICE_FIXTURES.lights)).find(
			(entry) => entry.id === id,
		);

		if (found === undefined || this.removals.has(key)) {
			return notFound();
		}

		const current = { ...found, ...this.overlays.get(key) } as Record<string, unknown>;
		const merged = deepMerge(current, parsed as Record<string, unknown>);
		const touched = Object.keys(parsed as Record<string, unknown>).filter((name) => !UNSAFE_KEYS.has(name));

		// Synthetic console rule: forcing the light on or off is what turns it on or off.
		if (
			resource === 'lights' &&
			typeof merged.isLightForceEnabled === 'boolean' &&
			touched.includes('isLightForceEnabled')
		) {
			merged.isLightOn = merged.isLightForceEnabled;
			touched.push('isLightOn');
		}

		this.overlays.set(key, {
			...this.overlays.get(key),
			...Object.fromEntries(touched.map((name) => [name, merged[name]])),
		});
		this.patches.push({ resource, id, body: parsed as Record<string, unknown> });

		if (this.echo) {
			this.sendFrame('devices', {
				type: 'update',
				item: {
					id,
					modelKey: resource === 'cameras' ? 'camera' : 'light',
					...Object.fromEntries(touched.map((name) => [name, merged[name]])),
				},
			});
		}

		return json(200, merged);
	}

	private routePost(path: string, body: Buffer | null): FakeProtectResponse {
		const segments = path.startsWith(BASE) ? path.slice(BASE.length).split('/').filter(Boolean) : [];

		if (segments.length !== 3 || segments[0] !== 'cameras' || segments[2] !== 'rtsps-stream') {
			return json(405, { error: 'Method not allowed', name: 'METHOD_NOT_ALLOWED' });
		}

		const cameraId = segments[1];

		if (!this.cameras().some((camera) => camera.id === cameraId)) {
			return notFound();
		}

		let qualities: unknown;

		try {
			qualities = body === null ? undefined : (JSON.parse(body.toString('utf8')) as { qualities?: unknown }).qualities;
		} catch {
			qualities = undefined;
		}

		if (
			!Array.isArray(qualities) ||
			qualities.length === 0 ||
			new Set(qualities).size !== qualities.length ||
			!qualities.every((quality) => (PROTECT_RTSPS_QUALITIES as readonly unknown[]).includes(quality))
		) {
			return json(400, BAD_QUALITIES);
		}

		const enabled = this.enabledStreams(cameraId);

		(qualities as ProtectRtspsQuality[]).forEach((quality) => enabled.add(quality));
		this.streamPosts.push({ cameraId, qualities: [...(qualities as string[])] });

		return json(200, this.streamMap(cameraId));
	}

	/** The list without removed devices, with the overlays applied. */
	private visible<T extends { id: string }>(resource: FakeProtectDeviceResource, items: T[]): T[] {
		return items
			.filter((item) => !this.removals.has(`${resource}/${item.id}`))
			.map((item) => ({ ...item, ...this.overlays.get(`${resource}/${item.id}`) }));
	}

	private route(path: string, query: Record<string, string>): FakeProtectResponse {
		if (!path.startsWith(BASE)) {
			return notFound();
		}

		const segments = path.slice(BASE.length).split('/').filter(Boolean);
		const [resource, id, action] = segments;

		if (segments.length === 2 && resource === 'meta' && id === 'info') {
			const meta = readJson<Record<string, unknown>>('meta-info.json');

			return json(
				200,
				this.options.applicationVersion === null
					? meta
					: { ...meta, applicationVersion: this.options.applicationVersion },
			);
		}

		if (resource === undefined || !Object.hasOwn(DEVICE_FIXTURES, resource) || segments.length > 3) {
			return notFound();
		}

		if (id === undefined) {
			if (resource === 'nvrs' || resource === 'chimes') {
				return json(200, readJson<unknown>(DEVICE_FIXTURES[resource]));
			}

			return json(
				200,
				this.visible(
					resource as FakeProtectDeviceResource,
					resource === 'cameras' ? this.cameras() : readJson<{ id: string }[]>(DEVICE_FIXTURES[resource]),
				),
			);
		}

		if (resource === 'sensors' || resource === 'lights') {
			const entry =
				segments.length === 2
					? readJson<{ id: string }[]>(DEVICE_FIXTURES[resource]).find((e) => e.id === id)
					: undefined;

			return entry === undefined || this.removals.has(`${resource}/${id}`)
				? notFound()
				: json(200, { ...entry, ...this.overlays.get(`${resource}/${id}`) });
		}

		if (resource !== 'cameras') {
			return notFound();
		}

		const found = this.cameras().find((entry) => entry.id === id);

		if (found === undefined || this.removals.has(`cameras/${id}`)) {
			return notFound();
		}

		const camera = { ...found, ...this.overlays.get(`cameras/${id}`) };

		if (action === undefined) {
			return json(200, camera);
		}

		if (action === 'rtsps-stream') {
			return json(200, this.streamMap(id));
		}

		if (action === 'snapshot') {
			if (query.highQuality === 'true' && camera.featureFlags?.supportFullHdSnapshot !== true) {
				return { status: 400, headers: JSON_HEADERS, body: readFixture('snapshot-hq-unsupported.json') };
			}

			return { status: 200, headers: { 'content-type': 'image/jpeg' }, body: readFixture('snapshot.jpg') };
		}

		return notFound();
	}

	private send(res: http.ServerResponse, response: FakeProtectResponse, base: Record<string, string>): void {
		const body = response.body === undefined ? Buffer.alloc(0) : Buffer.from(response.body);

		res.writeHead(response.status, {
			...base,
			...response.headers,
			'content-length': String(body.length),
		});
		res.end(body);
	}
}
