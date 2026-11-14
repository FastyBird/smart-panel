/**
 * Live UniFi Protect Integration API spike (UP-0, design doc section 6).
 *
 * Runs only against a real console and is strictly READ-ONLY: every request is a GET (a test-local guard enforces
 * it) and the WebSockets are only opened and closed. It never POSTs a stream, never PATCHes a setting.
 *
 *   FB_UNIFI_SPIKE_HOST=192.168.1.1 \
 *   FB_UNIFI_SPIKE_API_KEY_FILE=/path/to/key.txt \
 *   pnpm --filter ./apps/backend run test:unifi-spike
 *
 * Environment:
 *   FB_UNIFI_SPIKE_HOST           console address, `host` or `host:port` (required, enables the suite)
 *   FB_UNIFI_SPIKE_API_KEY_FILE   file holding the Protect API key (required, enables the suite); the key is only
 *                                 read from this file and is never logged
 *   FB_UNIFI_SPIKE_TIMEOUT_MS     per-request / WebSocket-open timeout, default 10000
 *   FB_UNIFI_SPIKE_WS_IDLE_MS     optional: keep both WebSockets idle this long and assert they stay open
 *   FB_UNIFI_SPIKE_BURST          optional: `1` sends 15 parallel GETs to observe the 429 / Retry-After behaviour
 *
 * Output never contains the API key, stream URLs (RTSPS aliases are bearer secrets) or device names.
 */
import { readFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import { connect } from 'node:tls';
import WebSocket from 'ws';

const HOST = process.env.FB_UNIFI_SPIKE_HOST?.trim();
const API_KEY_FILE = process.env.FB_UNIFI_SPIKE_API_KEY_FILE?.trim();
const LIVE = Boolean(HOST) && Boolean(API_KEY_FILE);

const TIMEOUT_MS = Number(process.env.FB_UNIFI_SPIKE_TIMEOUT_MS ?? '10000');
const WS_IDLE_MS = Number(process.env.FB_UNIFI_SPIKE_WS_IDLE_MS ?? '0');
const BURST = process.env.FB_UNIFI_SPIKE_BURST === '1';

const MINIMUM_PROTECT_VERSION = '7.2.105';
const INTEGRATION = '/proxy/protect/integration/v1';
/** Stay below the advertised 10 requests/s budget (80 %). */
const REQUEST_SPACING_MS = 130;

interface HttpResult {
	status: number;
	headers: IncomingHttpHeaders;
	body: Buffer;
}

interface TlsMode {
	servername?: string;
	rejectUnauthorized: boolean;
}

interface Camera {
	id: string;
	modelKey: string;
	state: string;
	featureFlags: { supportFullHdSnapshot: boolean; smartDetectTypes: string[] };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const compareVersions = (a: string, b: string): number => {
	const left = a.split('.').map(Number);
	const right = b.split('.').map(Number);

	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);

		if (difference !== 0) {
			return difference;
		}
	}

	return 0;
};

const isRtspsUrl = (value: unknown): boolean => typeof value === 'string' && /^rtsps:\/\/[^/\s]+\/[^\s?]+/.test(value);

/** The spike must never change the console: refuse anything but GET before a request is built. */
const assertReadOnly = (method: string): void => {
	if (method.toUpperCase() !== 'GET') {
		throw new Error(`UniFi spike is read-only, refusing ${method.toUpperCase()}`);
	}
};

const describeLive = LIVE ? describe : describe.skip;

describeLive('UniFi Protect Integration API (live, read-only)', () => {
	let apiKey = '';
	let hostname = '';
	let port = 443;
	let tlsMode: TlsMode = { rejectUnauthorized: false };
	let directConnectDomain = '';
	let lastRequestAt = 0;
	let cameras: Camera[] = [];

	const get = async (path: string, options: { authenticated?: boolean; mode?: TlsMode } = {}): Promise<HttpResult> => {
		const method = 'GET';

		assertReadOnly(method);

		const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();

		if (wait > 0) {
			await sleep(wait);
		}

		lastRequestAt = Date.now();

		const mode = options.mode ?? tlsMode;
		const headers: Record<string, string> = { accept: '*/*' };

		if (options.authenticated !== false) {
			headers['x-api-key'] = apiKey;
		}

		return new Promise<HttpResult>((resolve, reject) => {
			const req = request({ method, host: hostname, port, path, headers, timeout: TIMEOUT_MS, ...mode }, (response) => {
				const chunks: Buffer[] = [];

				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('end', () =>
					resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
				);
				response.on('error', reject);
			});

			req.on('timeout', () => req.destroy(new Error(`GET timed out after ${TIMEOUT_MS} ms`)));
			// Error messages never include request headers, so the key cannot leak through them.
			req.on('error', reject);
			req.end();
		});
	};

	const getJson = async <T>(path: string, options?: { authenticated?: boolean; mode?: TlsMode }): Promise<T> => {
		const result = await get(path, options);

		expect(result.status).toBe(200);

		return JSON.parse(result.body.toString('utf8')) as T;
	};

	const verifiedTls = (servername: string): Promise<{ authorized: boolean; issuer: string | string[] | undefined }> =>
		new Promise((resolve, reject) => {
			const socket = connect(
				{ host: hostname, port, servername, rejectUnauthorized: true, timeout: TIMEOUT_MS },
				() => {
					const certificate = socket.getPeerCertificate();

					resolve({ authorized: socket.authorized, issuer: certificate.issuer?.O });
					socket.end();
				},
			);

			socket.on('timeout', () => socket.destroy(new Error('TLS handshake timed out')));
			socket.on('error', reject);
		});

	const openWebSocket = (path: string): Promise<WebSocket> =>
		new Promise((resolve, reject) => {
			const socket = new WebSocket(`wss://${hostname}:${port}${INTEGRATION}${path}`, {
				headers: { 'x-api-key': apiKey },
				handshakeTimeout: TIMEOUT_MS,
				...tlsMode,
			});

			socket.once('open', () => resolve(socket));
			socket.once('error', reject);
		});

	beforeAll(async () => {
		apiKey = readFileSync(API_KEY_FILE, 'utf8').trim();

		if (apiKey.length === 0) {
			throw new Error('FB_UNIFI_SPIKE_API_KEY_FILE is empty');
		}

		const url = new URL(`https://${HOST}`);

		hostname = url.hostname;
		port = url.port ? Number(url.port) : 443;

		// The unauthenticated probe never sends the key, so it may use an unverified connection.
		const system = await get('/api/system', { authenticated: false, mode: { rejectUnauthorized: false } });

		directConnectDomain =
			(JSON.parse(system.body.toString('utf8')) as { directConnectDomain?: string }).directConnectDomain ?? '';

		// Send the key over a verified connection whenever the directConnectDomain certificate allows it.
		if (directConnectDomain) {
			try {
				if ((await verifiedTls(directConnectDomain)).authorized) {
					tlsMode = { servername: directConnectDomain, rejectUnauthorized: true };
				}
			} catch {
				// Reported by the dedicated TLS test; fall through to the unverified mode.
			}
		}

		console.info(
			`UniFi spike TLS mode: ${tlsMode.rejectUnauthorized ? 'verified via directConnectDomain SNI' : 'UNVERIFIED'}`,
		);
	});

	it('refuses every non-GET method (read-only guard)', () => {
		for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
			expect(() => assertReadOnly(method)).toThrow('read-only');
		}

		expect(() => assertReadOnly('GET')).not.toThrow();
	});

	describe('console probe (unauthenticated)', () => {
		it('GET /api/system describes the console', async () => {
			const system = await getJson<{
				hardware: { shortname: string };
				name: string;
				mac: string;
				directConnectDomain?: string;
			}>('/api/system', { authenticated: false, mode: { rejectUnauthorized: false } });

			expect(typeof system.hardware.shortname).toBe('string');
			expect(typeof system.name).toBe('string');
			expect(typeof system.mac).toBe('string');
			expect(typeof system.directConnectDomain).toBe('string');
		});

		it('GET /proxy/protect/api without a key is 401 (Protect is installed)', async () => {
			const result = await get('/proxy/protect/api', { authenticated: false, mode: { rejectUnauthorized: false } });

			expect(result.status).toBe(401);
		});

		it('presents a valid certificate for directConnectDomain when it is used as SNI', async () => {
			expect(directConnectDomain).not.toBe('');

			const tls = await verifiedTls(directConnectDomain);

			expect(tls.authorized).toBe(true);
		});
	});

	describe('REST', () => {
		it(`meta/info reports Protect >= ${MINIMUM_PROTECT_VERSION}`, async () => {
			const info = await getJson<{ applicationVersion: string }>(`${INTEGRATION}/meta/info`);

			expect(info.applicationVersion).toMatch(/^\d+\.\d+\.\d+$/);
			expect(compareVersions(info.applicationVersion, MINIMUM_PROTECT_VERSION)).toBeGreaterThanOrEqual(0);

			console.info(`UniFi spike Protect version: ${info.applicationVersion}`);
		});

		it('sends rate-limit headers on every response', async () => {
			const result = await get(`${INTEGRATION}/meta/info`);

			expect(result.status).toBe(200);
			expect(String(result.headers['ratelimit'])).toMatch(/r=\d+/);
			expect(String(result.headers['ratelimit-policy'])).toMatch(/"\d+-in-\d+sec";\s*q=\d+;\s*w=\d+/);
		});

		(BURST ? it : it.skip)('answers a burst beyond the budget with 429 and Retry-After', async () => {
			const results: (HttpResult | undefined)[] = await Promise.all(
				Array.from({ length: 15 }, () => get(`${INTEGRATION}/meta/info`).catch((): undefined => undefined)),
			);
			const limited = results.filter((result) => result?.status === 429);

			expect(limited.length).toBeGreaterThan(0);

			for (const result of limited) {
				expect(Number(result?.headers['retry-after'])).toBeGreaterThanOrEqual(1);
			}
		});

		it('nvrs returns the NVR object', async () => {
			const nvr = await getJson<{ id: string; modelKey: string }>(`${INTEGRATION}/nvrs`);

			expect(nvr.modelKey).toBe('nvr');
			expect(typeof nvr.id).toBe('string');
		});

		it('cameras returns camera objects with the feature flags the mapper needs', async () => {
			cameras = await getJson<Camera[]>(`${INTEGRATION}/cameras`);

			expect(Array.isArray(cameras)).toBe(true);

			for (const camera of cameras) {
				expect(camera.modelKey).toBe('camera');
				expect(['CONNECTED', 'CONNECTING', 'DISCONNECTED']).toContain(camera.state);
				expect(typeof camera.featureFlags.supportFullHdSnapshot).toBe('boolean');
				expect(Array.isArray(camera.featureFlags.smartDetectTypes)).toBe(true);
			}

			console.info(`UniFi spike cameras: ${cameras.length}`);
		});

		it.each(['sensors', 'lights', 'chimes', 'viewers', 'liveviews'])('%s returns a list', async (collection) => {
			const items = await getJson<unknown[]>(`${INTEGRATION}/${collection}`);

			expect(Array.isArray(items)).toBe(true);

			console.info(`UniFi spike ${collection}: ${items.length}`);
		});

		it('rtsps-stream (GET) has the quality shape and never exposes a URL here', async () => {
			for (const camera of cameras.filter((entry) => entry.state === 'CONNECTED')) {
				const streams = await getJson<Record<string, unknown>>(`${INTEGRATION}/cameras/${camera.id}/rtsps-stream`);

				expect(Object.keys(streams).sort()).toEqual(['high', 'low', 'medium', 'package']);

				// Compare booleans so a failure never prints the alias (a bearer secret).
				for (const value of Object.values(streams)) {
					expect(value === null || isRtspsUrl(value)).toBe(true);
				}
			}
		});

		it('snapshot returns a JPEG; HQ only where supported, otherwise 400', async () => {
			for (const camera of cameras.filter((entry) => entry.state === 'CONNECTED')) {
				const normal = await get(`${INTEGRATION}/cameras/${camera.id}/snapshot?highQuality=false`);

				expect(normal.status).toBe(200);
				expect(String(normal.headers['content-type'])).toContain('image/jpeg');
				expect(normal.body.subarray(0, 2).toString('hex')).toBe('ffd8');

				const hq = await get(`${INTEGRATION}/cameras/${camera.id}/snapshot?highQuality=true`);

				if (camera.featureFlags.supportFullHdSnapshot) {
					expect(hq.status).toBe(200);
					expect(String(hq.headers['content-type'])).toContain('image/jpeg');
				} else {
					expect(hq.status).toBe(400);
					expect((JSON.parse(hq.body.toString('utf8')) as { name: string }).name).toBe('BAD_REQUEST');
				}
			}
		});
	});

	describe('WebSockets', () => {
		it.each(['/subscribe/devices', '/subscribe/events'])(
			'%s opens within the timeout',
			async (path) => {
				const socket = await openWebSocket(path);
				let closed = false;

				socket.on('close', () => {
					closed = true;
				});

				try {
					expect(socket.readyState).toBe(WebSocket.OPEN);

					if (WS_IDLE_MS > 0) {
						await sleep(WS_IDLE_MS);

						expect(closed).toBe(false);
					}
				} finally {
					socket.terminate();
				}
			},
			TIMEOUT_MS + WS_IDLE_MS + 5000,
		);
	});
});
