/**
 * Live UniFi Protect Integration API spike (UP-0, design doc section 6).
 *
 * Runs only against a real console and is strictly READ-ONLY: every request is a GET (a test-local guard enforces
 * it) and the WebSockets are only opened and closed. It never POSTs a stream, never PATCHes a setting.
 *
 *   FB_UNIFI_SPIKE_HOST=192.168.1.1 \
 *   FB_UNIFI_SPIKE_SERVER_NAME=<console>.id.ui.direct \
 *   FB_UNIFI_SPIKE_API_KEY_FILE=/path/to/key.txt \
 *   pnpm --filter ./apps/backend run test:unifi-spike
 *
 * Environment:
 *   FB_UNIFI_SPIKE_HOST           console address, `host` or `host:port` (required, enables the suite)
 *   FB_UNIFI_SPIKE_API_KEY_FILE   file holding the Protect API key (required, enables the suite); the key is only
 *                                 read from this file and is never logged
 *   FB_UNIFI_SPIKE_SERVER_NAME    trust anchor (one of the two is required): the console's `*.id.ui.direct` name. The
 *                                 suite connects to HOST, uses this name as SNI and fully verifies the certificate
 *   FB_UNIFI_SPIKE_FINGERPRINT    trust anchor (alternative / additional): SHA-256 fingerprint of the console's
 *                                 certificate; verified before any request byte is written
 *   FB_UNIFI_SPIKE_TIMEOUT_MS     per-request / WebSocket-open timeout, default 10000
 *   FB_UNIFI_SPIKE_MAX_CAMERAS    upper bound the snapshot / stream test budgets are sized for, default 16
 *   FB_UNIFI_SPIKE_WS_IDLE_MS     optional: keep both WebSockets idle this long and assert they stay open
 *   FB_UNIFI_SPIKE_BURST          optional: `1` sends 15 parallel GETs to observe the 429 / Retry-After behaviour
 *
 * The trust anchor must come from the environment, supplied independently of the console. Nothing the console reports
 * about itself (such as `directConnectDomain`) ever establishes trust. Without an anchor the authenticated tests are
 * skipped; if verification fails they fail before the key is written to any socket. The key is never sent over an
 * unverified connection. The unauthenticated probes carry no credentials.
 *
 * Output never contains the API key, stream URLs (RTSPS aliases are bearer secrets) or device names.
 */
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import { type TLSSocket, connect } from 'node:tls';
import WebSocket from 'ws';

const HOST = process.env.FB_UNIFI_SPIKE_HOST?.trim();
const API_KEY_FILE = process.env.FB_UNIFI_SPIKE_API_KEY_FILE?.trim();
const SERVER_NAME = process.env.FB_UNIFI_SPIKE_SERVER_NAME?.trim() || undefined;

const normalizeFingerprint = (value: string): string => {
	const normalized = value.replace(/[:\s]/g, '').toUpperCase();

	if (!/^[0-9A-F]{64}$/.test(normalized)) {
		throw new Error('FB_UNIFI_SPIKE_FINGERPRINT must be a SHA-256 fingerprint (64 hex digits, colons allowed)');
	}

	return normalized;
};

const FINGERPRINT = process.env.FB_UNIFI_SPIKE_FINGERPRINT?.trim()
	? normalizeFingerprint(process.env.FB_UNIFI_SPIKE_FINGERPRINT)
	: undefined;

const CONFIGURED = Boolean(HOST) && Boolean(API_KEY_FILE);
const HAS_TRUST_ANCHOR = SERVER_NAME !== undefined || FINGERPRINT !== undefined;
const LIVE = CONFIGURED && HAS_TRUST_ANCHOR;

const TIMEOUT_MS = Number(process.env.FB_UNIFI_SPIKE_TIMEOUT_MS ?? '10000');
const WS_IDLE_MS = Number(process.env.FB_UNIFI_SPIKE_WS_IDLE_MS ?? '0');
const MAX_CAMERAS = Number(process.env.FB_UNIFI_SPIKE_MAX_CAMERAS ?? '16');
const BURST = process.env.FB_UNIFI_SPIKE_BURST === '1';

/** Test budgets: an operation's own timeout plus headroom for the spacing delay. */
const SLACK_MS = 5000;
const MAX_RETRY_AFTER_WAIT_S = 5;

const MINIMUM_PROTECT_VERSION = '7.2.105';
const INTEGRATION = '/proxy/protect/integration/v1';
/** Stay below the advertised 10 requests/s budget (80 %). */
const REQUEST_SPACING_MS = 130;

interface HttpResult {
	status: number;
	headers: IncomingHttpHeaders;
	body: Buffer;
}

/** Where to connect and what proves the console's identity. Without `servername` / `fingerprint` it is unverified. */
interface Transport {
	host: string;
	port: number;
	/** Trusted name: used as SNI, the certificate must be valid for it. */
	servername?: string;
	/** Trusted SHA-256 certificate fingerprint (64 upper-case hex digits). */
	fingerprint?: string;
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

const hasTrustAnchor = (transport: Transport): boolean =>
	transport.servername !== undefined || transport.fingerprint !== undefined;

const fingerprintMatches = (actual: string | undefined, expected: string): boolean => {
	if (actual === undefined) {
		return false;
	}

	const left = Buffer.from(actual.replace(/:/g, '').toUpperCase());
	const right = Buffer.from(expected);

	return left.length === right.length && timingSafeEqual(left, right);
};

/** Builds the GET options. Refuses to attach the API key unless the transport carries a trust anchor. */
const buildGetOptions = (
	transport: Transport,
	path: string,
	apiKey?: string,
): {
	method: 'GET';
	host: string;
	port: number;
	path: string;
	headers: Record<string, string>;
} => {
	assertReadOnly('GET');

	const headers: Record<string, string> = { accept: '*/*', connection: 'close' };

	if (apiKey !== undefined) {
		if (!hasTrustAnchor(transport)) {
			throw new Error('Refusing to attach the API key to a request over an unverified TLS connection');
		}

		headers['x-api-key'] = apiKey;
	}

	return { method: 'GET', host: transport.host, port: transport.port, path, headers };
};

/**
 * Opens a TLS socket and proves the console's identity (certificate valid for the trusted name and / or matching the
 * pinned fingerprint) BEFORE it is handed out, so nothing is written to it unverified. Never falls back to an
 * unverified socket.
 */
const openVerifiedSocket = (transport: Transport, signal: AbortSignal): Promise<TLSSocket> =>
	new Promise((resolve, reject) => {
		if (!hasTrustAnchor(transport)) {
			reject(new Error('No trust anchor configured, refusing to open an authenticated connection'));

			return;
		}

		const socket = connect({
			host: transport.host,
			port: transport.port,
			servername: transport.servername,
			// Name verification is only skipped when a pinned fingerprint is the (sole) anchor.
			rejectUnauthorized: transport.servername !== undefined,
		});
		const onAbort = (): void => {
			socket.destroy(new Error(`TLS connection timed out after ${TIMEOUT_MS} ms`));
		};
		const fail = (error: Error): void => {
			signal.removeEventListener('abort', onAbort);
			socket.destroy();
			reject(error);
		};

		if (signal.aborted) {
			onAbort();
		}

		signal.addEventListener('abort', onAbort, { once: true });

		socket.once('error', fail);
		socket.once('secureConnect', () => {
			signal.removeEventListener('abort', onAbort);

			if (transport.servername !== undefined && !socket.authorized) {
				fail(new Error('TLS verification failed: certificate not valid for the trusted server name'));

				return;
			}

			if (
				transport.fingerprint !== undefined &&
				!fingerprintMatches(socket.getPeerCertificate().fingerprint256, transport.fingerprint)
			) {
				fail(new Error('TLS verification failed: certificate fingerprint does not match the pinned one'));

				return;
			}

			socket.removeListener('error', fail);
			resolve(socket);
		});
	});

describe('UniFi spike safety checks (no network)', () => {
	it('refuses every non-GET method (read-only guard)', () => {
		for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
			expect(() => assertReadOnly(method)).toThrow('read-only');
		}

		expect(() => assertReadOnly('GET')).not.toThrow();
	});

	it('refuses to attach the API key when TLS is unverified', () => {
		const unverified: Transport = { host: '192.0.2.1', port: 443 };

		expect(() => buildGetOptions(unverified, '/x', 'dummy-key')).toThrow('unverified');
		expect(buildGetOptions(unverified, '/x').headers['x-api-key']).toBeUndefined();
	});

	it('attaches the API key only when a trust anchor is present', () => {
		for (const trusted of [
			{ host: '192.0.2.1', port: 443, servername: 'console.id.ui.direct' },
			{ host: '192.0.2.1', port: 443, fingerprint: 'AB'.repeat(32) },
		]) {
			expect(buildGetOptions(trusted, '/x', 'dummy-key').headers['x-api-key']).toBe('dummy-key');
		}
	});

	it('compares fingerprints case- and colon-insensitively and rejects mismatches', () => {
		const expected = normalizeFingerprint('ab:'.repeat(31) + 'ab');

		expect(fingerprintMatches('AB:'.repeat(31) + 'AB', expected)).toBe(true);
		expect(fingerprintMatches('CD:'.repeat(31) + 'CD', expected)).toBe(false);
		expect(fingerprintMatches(undefined, expected)).toBe(false);
		expect(() => normalizeFingerprint('abc')).toThrow('SHA-256');
	});
});

if (CONFIGURED && !HAS_TRUST_ANCHOR) {
	console.warn(
		'UniFi spike: authenticated tests skipped. Set FB_UNIFI_SPIKE_SERVER_NAME (the console *.id.ui.direct name) or FB_UNIFI_SPIKE_FINGERPRINT (SHA-256 pin); trust is never taken from the console itself.',
	);

	describe.skip('UniFi Protect Integration API (live): skipped, set FB_UNIFI_SPIKE_SERVER_NAME or FB_UNIFI_SPIKE_FINGERPRINT', () => {
		it('needs an independent trust anchor', () => undefined);
	});
}

const describeLive = LIVE ? describe : describe.skip;

describeLive('UniFi Protect Integration API (live, read-only)', () => {
	const REQUEST_BUDGET_MS = TIMEOUT_MS + SLACK_MS;

	let apiKey = '';
	let trusted: Transport = { host: '', port: 443 };
	let probe: Transport = { host: '', port: 443 };
	let directConnectDomain = '';
	let lastRequestAt = 0;
	let cameras: Camera[] = [];

	const connectedCameras = (): Camera[] => cameras.filter((entry) => entry.state === 'CONNECTED');

	/** Fails loudly instead of passing vacuously when the inventory has nothing to iterate. */
	const requireConnectedCameras = (): void => {
		if (connectedCameras().length === 0) {
			throw new Error('No CONNECTED camera in the console inventory, so this check has nothing to verify');
		}
	};

	/** One request, always aborted after TIMEOUT_MS. Authenticated requests only ever use a verified socket. */
	const get = async (path: string, options: { authenticated?: boolean; burst?: boolean } = {}): Promise<HttpResult> => {
		const authenticated = options.authenticated !== false;

		if (!options.burst) {
			const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();

			if (wait > 0) {
				await sleep(wait);
			}
		}

		lastRequestAt = Date.now();

		const requestOptions = buildGetOptions(authenticated ? trusted : probe, path, authenticated ? apiKey : undefined);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const socket = authenticated ? await openVerifiedSocket(trusted, controller.signal) : undefined;

			return await new Promise<HttpResult>((resolve, reject) => {
				const req = request(
					{
						...requestOptions,
						signal: controller.signal,
						// `agent: false` would make Node build its own agent and ignore `createConnection`, opening an
						// unverified-by-name connection; without an agent the pre-verified socket is used as is.
						...(socket ? { createConnection: () => socket } : { agent: false, rejectUnauthorized: false }),
					},
					(response) => {
						const chunks: Buffer[] = [];

						response.on('data', (chunk: Buffer) => chunks.push(chunk));
						response.on('end', () =>
							resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) }),
						);
						response.on('error', reject);
					},
				);

				// Error messages never include request headers, so the key cannot leak through them.
				req.on('error', (error) =>
					reject(controller.signal.aborted ? new Error(`GET timed out after ${TIMEOUT_MS} ms`) : error),
				);
				req.end();
			});
		} finally {
			clearTimeout(timer);
		}
	};

	const getJson = async <T>(path: string, options?: { authenticated?: boolean }): Promise<T> => {
		const result = await get(path, options);

		expect(result.status).toBe(200);

		return JSON.parse(result.body.toString('utf8')) as T;
	};

	const openWebSocket = async (path: string): Promise<WebSocket> => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const socket = await openVerifiedSocket(trusted, controller.signal);

			return await new Promise<WebSocket>((resolve, reject) => {
				const ws = new WebSocket(`wss://${trusted.host}:${trusted.port}${INTEGRATION}${path}`, {
					headers: { 'x-api-key': apiKey },
					handshakeTimeout: TIMEOUT_MS,
					createConnection: () => socket,
				});

				// The TLS deadline no longer applies once the socket is verified, so the Upgrade needs its own.
				const upgradeTimer = setTimeout(() => {
					ws.terminate();
					socket.destroy();
					reject(new Error(`WebSocket upgrade timed out after ${TIMEOUT_MS} ms`));
				}, TIMEOUT_MS);

				ws.once('open', () => {
					clearTimeout(upgradeTimer);
					resolve(ws);
				});
				ws.once('error', (error) => {
					clearTimeout(upgradeTimer);
					socket.destroy();
					reject(error);
				});
			});
		} finally {
			clearTimeout(timer);
		}
	};

	beforeAll(
		async () => {
			const url = new URL(`https://${HOST}`);

			probe = { host: url.hostname, port: url.port ? Number(url.port) : 443 };
			trusted = { ...probe, servername: SERVER_NAME, fingerprint: FINGERPRINT };

			// Fail closed before the key is even read: the identity must verify against the independent anchor.
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

			try {
				(await openVerifiedSocket(trusted, controller.signal)).destroy();
			} finally {
				clearTimeout(timer);
			}

			apiKey = readFileSync(API_KEY_FILE, 'utf8').trim();

			if (apiKey.length === 0) {
				throw new Error('FB_UNIFI_SPIKE_API_KEY_FILE is empty');
			}

			const system = await get('/api/system', { authenticated: false });

			directConnectDomain =
				(JSON.parse(system.body.toString('utf8')) as { directConnectDomain?: string }).directConnectDomain ?? '';

			cameras = await getJson<Camera[]>(`${INTEGRATION}/cameras`);

			console.info(`UniFi spike TLS identity verified via ${SERVER_NAME ? 'server name' : 'pinned fingerprint'}`);
		},
		// Three sequential operations (TLS verification, /api/system, /cameras), each aborted after TIMEOUT_MS, so the
		// hook can never expire while one of them is still running.
		TIMEOUT_MS * 3 + SLACK_MS,
	);

	describe('console probe (unauthenticated)', () => {
		it(
			'GET /api/system describes the console',
			async () => {
				const system = await getJson<{
					hardware: { shortname: string };
					name: string;
					mac: string;
					directConnectDomain?: string;
				}>('/api/system', { authenticated: false });

				expect(typeof system.hardware.shortname).toBe('string');
				expect(typeof system.name).toBe('string');
				expect(typeof system.mac).toBe('string');
				expect(typeof system.directConnectDomain).toBe('string');
			},
			REQUEST_BUDGET_MS,
		);

		it(
			'GET /proxy/protect/api without a key is 401 (Protect is installed)',
			async () => {
				const result = await get('/proxy/protect/api', { authenticated: false });

				expect(result.status).toBe(401);
			},
			REQUEST_BUDGET_MS,
		);

		it('reports the configured server name as its directConnectDomain (informational, never trust)', () => {
			if (SERVER_NAME !== undefined) {
				expect(directConnectDomain).toBe(SERVER_NAME);
			}
		});
	});

	describe('REST', () => {
		it(
			`meta/info reports Protect >= ${MINIMUM_PROTECT_VERSION}`,
			async () => {
				const info = await getJson<{ applicationVersion: string }>(`${INTEGRATION}/meta/info`);

				expect(info.applicationVersion).toMatch(/^\d+\.\d+\.\d+$/);
				expect(compareVersions(info.applicationVersion, MINIMUM_PROTECT_VERSION)).toBeGreaterThanOrEqual(0);

				console.info(`UniFi spike Protect version: ${info.applicationVersion}`);
			},
			REQUEST_BUDGET_MS,
		);

		it(
			'sends rate-limit headers on every response',
			async () => {
				const result = await get(`${INTEGRATION}/meta/info`);

				expect(result.status).toBe(200);
				expect(String(result.headers['ratelimit'])).toMatch(/r=\d+/);
				expect(String(result.headers['ratelimit-policy'])).toMatch(/"\d+-in-\d+sec";\s*q=\d+;\s*w=\d+/);
			},
			REQUEST_BUDGET_MS,
		);

		it(
			'nvrs returns the NVR object',
			async () => {
				const nvr = await getJson<{ id: string; modelKey: string }>(`${INTEGRATION}/nvrs`);

				expect(nvr.modelKey).toBe('nvr');
				expect(typeof nvr.id).toBe('string');
			},
			REQUEST_BUDGET_MS,
		);

		it(
			'cameras returns camera objects with the feature flags the mapper needs',
			() => {
				expect(Array.isArray(cameras)).toBe(true);
				// The snapshot / stream test budgets are sized for MAX_CAMERAS.
				expect(cameras.length).toBeLessThanOrEqual(MAX_CAMERAS);

				for (const camera of cameras) {
					expect(camera.modelKey).toBe('camera');
					expect(['CONNECTED', 'CONNECTING', 'DISCONNECTED']).toContain(camera.state);
					expect(typeof camera.featureFlags.supportFullHdSnapshot).toBe('boolean');
					expect(Array.isArray(camera.featureFlags.smartDetectTypes)).toBe(true);
				}

				console.info(`UniFi spike cameras: ${cameras.length}`);
			},
			REQUEST_BUDGET_MS,
		);

		it.each(['sensors', 'lights', 'chimes', 'viewers', 'liveviews'])(
			'%s returns a list',
			async (collection) => {
				const items = await getJson<unknown[]>(`${INTEGRATION}/${collection}`);

				expect(Array.isArray(items)).toBe(true);

				console.info(`UniFi spike ${collection}: ${items.length}`);
			},
			REQUEST_BUDGET_MS,
		);

		it(
			'rtsps-stream (GET) has the quality shape and never exposes a URL here',
			async () => {
				requireConnectedCameras();

				for (const camera of connectedCameras()) {
					const streams = await getJson<Record<string, unknown>>(`${INTEGRATION}/cameras/${camera.id}/rtsps-stream`);

					expect(Object.keys(streams).sort()).toEqual(['high', 'low', 'medium', 'package']);

					// Compare booleans so a failure never prints the alias (a bearer secret).
					for (const value of Object.values(streams)) {
						expect(value === null || isRtspsUrl(value)).toBe(true);
					}
				}
			},
			MAX_CAMERAS * TIMEOUT_MS + SLACK_MS,
		);

		it(
			'snapshot returns a JPEG; HQ only where supported, otherwise 400',
			async () => {
				requireConnectedCameras();

				for (const camera of connectedCameras()) {
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
			},
			MAX_CAMERAS * 2 * TIMEOUT_MS + SLACK_MS,
		);
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
			TIMEOUT_MS * 2 + WS_IDLE_MS + SLACK_MS,
		);
	});

	// Runs last: the burst exhausts the rate budget, so nothing else may follow it before the window has recovered.
	(BURST ? describe : describe.skip)('rate limit burst (last)', () => {
		it(
			'answers a burst beyond the budget with 429 and Retry-After',
			async () => {
				let waitSeconds = 0;

				try {
					const results: (HttpResult | undefined)[] = await Promise.all(
						Array.from({ length: 15 }, () =>
							get(`${INTEGRATION}/meta/info`, { burst: true }).catch((): undefined => undefined),
						),
					);
					const limited = results.filter((result) => result?.status === 429);

					for (const result of limited) {
						const retryAfter = Number(result?.headers['retry-after']);

						if (Number.isFinite(retryAfter)) {
							waitSeconds = Math.max(waitSeconds, retryAfter);
						}
					}

					expect(limited.length).toBeGreaterThan(0);

					for (const result of limited) {
						expect(Number(result?.headers['retry-after'])).toBeGreaterThanOrEqual(1);
					}
				} finally {
					// Let the console's rate window recover before leaving it.
					await sleep(Math.min(waitSeconds, MAX_RETRY_AFTER_WAIT_S) * 1000);
				}
			},
			TIMEOUT_MS + MAX_RETRY_AFTER_WAIT_S * 1000 + SLACK_MS,
		);
	});
});
