import { readFileSync } from 'fs';
import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as net from 'net';
import { join, resolve } from 'path';
import { TLSSocket } from 'tls';

import { PROTECT_TEST_DIRECT_DOMAIN, protectTlsServerOptions } from './protect-tls';

// TEST SUPPORT ONLY: a loopback HTTPS stand-in for a UniFi Protect console, serving the UP-0 fixtures with the
// committed test certificates. Plan 5 adds the two WebSockets here.

export const FAKE_PROTECT_API_KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
export const FAKE_PROTECT_ALIAS = 'SENTINELALIASprotect0123456789';

export interface FakeProtectRequest {
	method: string;
	path: string;
	query: Record<string, string>;
	hadApiKey: boolean;
	servername: string | null;
}

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
const DEFAULT_RATE_LIMIT = { quota: 10, windowSeconds: 1 };

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

		return fake;
	}

	readonly host = '127.0.0.1' as const;
	port = 0;
	readonly requests: FakeProtectRequest[] = [];
	readonly writes: FakeProtectRequest[] = [];
	forbiddenHits = 0;
	rateLimited = 0;

	private options: FakeProtectServerOptions;
	private readonly queue: { match: RegExp; response: FakeProtectResponse }[] = [];
	private readonly windows = new Map<string, number[]>();
	private readonly sockets = new Set<net.Socket>();
	private readonly server: https.Server;
	private readonly rateHeaders = readJson<RateLimitFixture>('rate-limit-headers.json');

	private constructor(options: Partial<FakeProtectServerOptions>) {
		this.options = {
			apiKey: FAKE_PROTECT_API_KEY,
			applicationVersion: null,
			rateLimit: DEFAULT_RATE_LIMIT,
			hangPaths: [],
			...options,
		};
		this.server = https.createServer(protectTlsServerOptions(), (req, res) => this.handle(req, res));
		this.server.on('secureConnection', (socket: TLSSocket) => {
			this.sockets.add(socket);
			socket.on('close', () => this.sockets.delete(socket));
			socket.on('error', () => undefined);
		});
		this.server.on('tlsClientError', () => undefined);
	}

	set(options: Partial<FakeProtectServerOptions>): void {
		this.options = { ...this.options, ...options };
	}

	/** Consumed once, before normal routing, by the first request whose path matches. */
	enqueue(match: RegExp, response: FakeProtectResponse): void {
		this.queue.push({ match, response });
	}

	reset(): void {
		this.requests.length = 0;
		this.writes.length = 0;
		this.queue.length = 0;
		this.windows.clear();
		this.forbiddenHits = 0;
		this.rateLimited = 0;
	}

	stop(): Promise<void> {
		return new Promise<void>((resolveStop) => {
			this.sockets.forEach((socket) => socket.destroy());
			this.server.close(() => resolveStop());
		});
	}

	private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
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
		req.resume();

		if (method !== 'GET') {
			this.writes.push(record);
		}

		if (path.includes('disable-mic-permanently')) {
			this.forbiddenHits += 1;
		}

		const queuedIndex = this.queue.findIndex((entry) => entry.match.test(path));

		if (queuedIndex >= 0) {
			const [{ response }] = this.queue.splice(queuedIndex, 1);

			this.send(res, response, this.rateHeaders.ok);

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

		if (resource === undefined || !(resource in DEVICE_FIXTURES) || segments.length > 3) {
			return notFound();
		}

		if (id === undefined) {
			return json(200, readJson<unknown>(DEVICE_FIXTURES[resource]));
		}

		if (resource !== 'cameras') {
			return notFound();
		}

		const camera = readJson<{ id: string; featureFlags?: { supportFullHdSnapshot?: boolean } }[]>('cameras.json').find(
			(entry) => entry.id === id,
		);

		if (camera === undefined) {
			return notFound();
		}

		if (action === undefined) {
			return json(200, camera);
		}

		if (action === 'rtsps-stream') {
			const body = readFixture('rtsps-stream.json')
				.toString('utf8')
				.replace('REDACTEDALIAS00000', FAKE_PROTECT_ALIAS)
				.replace('192.0.2.10', this.host);

			return { status: 200, headers: JSON_HEADERS, body };
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
