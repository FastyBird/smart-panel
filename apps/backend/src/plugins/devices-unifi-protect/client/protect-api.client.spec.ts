import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { Logger } from '@nestjs/common';

import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { ProtectApiClient } from './protect-api.client';
import { ProtectTransport, ProtectTransportRequest, ProtectTransportResponse } from './protect-http.transport';
import { ProtectRatePacer } from './protect-rate-pacer';

const FIXTURES = resolve(__dirname, '../__fixtures__');
const KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
const ALIAS = 'SENTINELALIASprotect0123456789';
const BASE = '/proxy/protect/integration/v1';

const text = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');
const json = (name: string): unknown => JSON.parse(text(name)) as unknown;
const rateHeaders = json('rate-limit-headers.json') as Record<'ok' | 'rate_limited', Record<string, string>>;

type Answer = ProtectTransportResponse | Error | 'hang';

class FakeTransport implements ProtectTransport {
	readonly requests: ProtectTransportRequest[] = [];
	closed = false;

	private readonly answers: Answer[] = [];

	queue(status: number, body: string | Buffer = '{}', headers: Record<string, string> = {}): void {
		this.answers.push({ status, headers, body: Buffer.isBuffer(body) ? body : Buffer.from(body) });
	}

	queueError(error: Error): void {
		this.answers.push(error);
	}

	queueHang(): void {
		this.answers.push('hang');
	}

	request(request: ProtectTransportRequest): Promise<ProtectTransportResponse> {
		this.requests.push(request);

		const answer = this.answers.shift();

		if (answer === undefined) {
			return Promise.reject(new Error('unexpected request'));
		}

		if (answer === 'hang') {
			return new Promise((_resolve, reject) => {
				request.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
			});
		}

		return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
	}

	close(): void {
		this.closed = true;
	}
}

const reset = (): Error => Object.assign(new Error(`read ECONNRESET to ${KEY}`), { code: 'ECONNRESET' });

describe('ProtectApiClient', () => {
	let transport: FakeTransport;
	let sleep: jest.Mock<Promise<void>, [number, AbortSignal | undefined]>;
	let pacer: ProtectRatePacer;
	let client: ProtectApiClient;

	const build = (extra: Partial<ConstructorParameters<typeof ProtectApiClient>[0]> = {}): ProtectApiClient =>
		new ProtectApiClient({
			host: '192.0.2.10',
			port: 443,
			apiKey: KEY,
			tls: { mode: 'verify', serverName: null, fingerprintSha256: null },
			transport,
			pacer,
			sleep,
			random: () => 0.5,
			...extra,
		});

	beforeEach(() => {
		transport = new FakeTransport();
		sleep = jest.fn<Promise<void>, [number, AbortSignal | undefined]>().mockResolvedValue(undefined);
		// Pacing sleeps are skipped; the pacer still records pauses.
		pacer = new ProtectRatePacer({ sleep: () => Promise.resolve() });
		client = build();
	});

	describe('requests', () => {
		it('sends the key only as X-API-KEY and parses meta/info', async () => {
			transport.queue(200, text('meta-info.json'));

			expect(await client.getMetaInfo()).toEqual({ applicationVersion: '7.3.74' });
			expect(transport.requests).toHaveLength(1);
			expect(transport.requests[0]).toMatchObject({
				method: 'GET',
				path: `${BASE}/meta/info`,
				headers: { 'X-API-KEY': KEY, Accept: 'application/json' },
				timeoutMs: 10000,
				maxBytes: 2 * 1024 * 1024,
			});
			expect(Object.keys(transport.requests[0].headers).sort()).toEqual(['Accept', 'X-API-KEY']);
			expect(transport.requests[0].path).not.toContain(KEY);
		});

		it('builds the paths of all eight read-only methods and never a write or the forbidden endpoint', async () => {
			const calls: [string, () => Promise<unknown>, string][] = [
				['getMetaInfo', () => client.getMetaInfo(), `${BASE}/meta/info`],
				['getNvr', () => client.getNvr(), `${BASE}/nvrs`],
				['listCameras', () => client.listCameras(), `${BASE}/cameras`],
				['getCamera', () => client.getCamera('6541'), `${BASE}/cameras/6541`],
				['listSensors', () => client.listSensors(), `${BASE}/sensors`],
				['listLights', () => client.listLights(), `${BASE}/lights`],
				['getRtspsStreams', () => client.getRtspsStreams('6541'), `${BASE}/cameras/6541/rtsps-stream`],
				['getSnapshot', () => client.getSnapshot('6541'), `${BASE}/cameras/6541/snapshot`],
			];

			for (const [, call] of calls) {
				transport.queue(200, '{}');
				await call().catch(() => undefined);
			}

			expect(calls).toHaveLength(8);
			expect(transport.requests.map((r) => r.path)).toEqual(calls.map(([, , path]) => path));

			for (const request of transport.requests) {
				expect(request.method).toBe('GET');
				expect(request.path).not.toContain('disable-mic-permanently');
			}
		});

		it('asks for image/jpeg and the image cap on snapshots, with the quality and channel query', async () => {
			transport.queue(200, readFileSync(join(FIXTURES, 'snapshot.jpg')), { 'content-type': 'image/jpeg' });

			await client.getSnapshot('6541', { highQuality: false, channel: 'package' });

			expect(transport.requests[0]).toMatchObject({
				path: `${BASE}/cameras/6541/snapshot?highQuality=false&channel=package`,
				headers: { Accept: 'image/jpeg' },
				maxBytes: 8 * 1024 * 1024,
			});
		});

		it('refuses an invalid camera id without a request', async () => {
			await expect(client.getCamera('../disable-mic-permanently')).rejects.toMatchObject({
				category: ProtectErrorCategory.VALIDATION,
			});
			await expect(client.getSnapshot('a/b')).rejects.toMatchObject({ category: ProtectErrorCategory.VALIDATION });
			expect(transport.requests).toHaveLength(0);
		});

		it('feeds every answer to the pacer', async () => {
			const observe = jest.spyOn(pacer, 'observe');

			transport.queue(200, text('meta-info.json'), rateHeaders.ok);
			await client.getMetaInfo();

			expect(observe).toHaveBeenCalledWith(rateHeaders.ok);
		});
	});

	describe('parsing', () => {
		it('parses the captured fixtures', async () => {
			transport.queue(200, text('nvrs.json'));
			transport.queue(200, text('cameras.json'));
			transport.queue(200, text('rtsps-stream.json'));
			transport.queue(200, text('sensors.json'));
			transport.queue(200, text('lights.json'));
			transport.queue(200, readFileSync(join(FIXTURES, 'snapshot.jpg')), { 'content-type': 'image/jpeg' });

			const nvr = await client.getNvr();
			const cameras = await client.listCameras();
			const streams = await client.getRtspsStreams(cameras[0].id);
			const sensors = await client.listSensors();
			const lights = await client.listLights();
			const snapshot = await client.getSnapshot(cameras[0].id);

			expect(nvr).toMatchObject({
				id: '68b3ace392bf98c9fb76f70c',
				name: 'Home NVR',
				modelKey: 'nvr',
				mac: '0CEA14003A69',
			});
			expect(nvr.raw.type).toBe('UNVR4');
			expect(cameras).toHaveLength(2);
			expect(cameras[0]).toMatchObject({
				id: '600cefafd5f365d6f83c4ef3',
				modelKey: 'camera',
				state: 'CONNECTED',
				name: 'Front door',
				type: 'UVC G5 Dome',
				mac: '0CEA14008183',
				hasPackageCamera: false,
			});
			expect(cameras[0].featureFlags).toEqual({
				supportFullHdSnapshot: false,
				hasHdr: true,
				hasMic: true,
				hasSpeaker: true,
				hasLedStatus: true,
				smartDetectTypes: ['person', 'vehicle', 'animal'],
				smartDetectAudioTypes: ['alrmSmoke', 'alrmCmonx', 'alrmBabyCry', 'alrmSpeak'],
				videoModes: ['default', 'sport', 'slowShutter'],
			});
			expect(cameras[0].raw.micVolume).toBe(100);
			expect(streams).toEqual({
				high: 'rtsps://192.0.2.10:7441/REDACTEDALIAS00000?enableSrtp',
				medium: null,
				low: null,
				package: null,
			});
			expect(sensors).toHaveLength((json('sensors.json') as unknown[]).length);
			expect(sensors[0]).toMatchObject({ id: '5f0000000000000000000b01', modelKey: 'sensor', state: 'CONNECTED' });
			expect(lights).toHaveLength(1);
			expect(lights[0]).toMatchObject({
				id: '5f0000000000000000000c01',
				modelKey: 'light',
				name: 'Synthetic floodlight',
			});
			expect(snapshot.contentType).toBe('image/jpeg');
			expect(snapshot.data.equals(readFileSync(join(FIXTURES, 'snapshot.jpg')))).toBe(true);
		});

		it('keys devices by id, never by the guid the console shares between cameras', async () => {
			transport.queue(200, text('cameras.json'));

			const cameras = await client.listCameras();

			expect(cameras[0].raw.guid).toBe(cameras[1].raw.guid);
			expect(new Set(cameras.map((c) => c.id)).size).toBe(2);
			expect(cameras.every((c) => !('guid' in c))).toBe(true);
		});

		it('maps the light camera reference from the console key "camera"', async () => {
			transport.queue(
				200,
				JSON.stringify([
					{ id: 'l1', modelKey: 'light', camera: 'c9' },
					{ id: 'l2', modelKey: 'light' },
				]),
			);

			const lights = await client.listLights();

			expect(lights.map((l) => l.cameraId)).toEqual(['c9', null]);
			expect(lights.map((l) => l.state)).toEqual(['UNKNOWN', 'UNKNOWN']);
		});

		it('defaults missing feature flags to false and empty lists', async () => {
			transport.queue(200, JSON.stringify({ id: 'c1', modelKey: 'camera', state: 'CONNECTED' }));

			expect((await client.getCamera('c1')).featureFlags).toEqual({
				supportFullHdSnapshot: false,
				hasHdr: false,
				hasMic: false,
				hasSpeaker: false,
				hasLedStatus: false,
				smartDetectTypes: [],
				smartDetectAudioTypes: [],
				videoModes: [],
			});
		});

		it('accepts an nvrs array by taking the first entry', async () => {
			transport.queue(200, JSON.stringify([json('nvrs.json'), { id: 'other', modelKey: 'nvr' }]));

			expect((await client.getNvr()).id).toBe('68b3ace392bf98c9fb76f70c');
		});

		it('drops list entries without id or modelKey and logs only the count', async () => {
			const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
			const camera = { id: 'c1', modelKey: 'camera', state: 'CONNECTED' };

			try {
				transport.queue(
					200,
					JSON.stringify([{ id: 'a' }, camera, { modelKey: 'camera' }, null, 'x', { id: 7, modelKey: 'camera' }]),
				);

				const cameras = await client.listCameras();

				expect(cameras.map((c) => c.id)).toEqual(['c1']);
				expect(debug.mock.calls.map((c) => String(c[0])).some((m) => m.includes('dropped 5 entries'))).toBe(true);
			} finally {
				debug.mockRestore();
			}
		});

		it.each([
			['meta/info without a version', () => client.getMetaInfo(), '{"applicationVersion":7}'],
			['nvrs of an unexpected shape', () => client.getNvr(), '{"id":"n"}'],
			['an empty nvrs array', () => client.getNvr(), '[]'],
			['cameras that are not a list', () => client.listCameras(), '{}'],
			['a camera without modelKey', () => client.getCamera('c1'), '{"id":"c1"}'],
			['rtsps-stream that is not an object', () => client.getRtspsStreams('c1'), '[]'],
		])('rejects %s as protocol', async (_name, call, body) => {
			transport.queue(200, body);

			await expect(call()).rejects.toMatchObject({ category: ProtectErrorCategory.PROTOCOL });
		});

		it('rejects a non-JSON body as protocol', async () => {
			transport.queue(200, '<html>login</html>');

			await expect(client.listCameras()).rejects.toMatchObject({
				category: ProtectErrorCategory.PROTOCOL,
				status: 200,
			});
			expect(transport.requests).toHaveLength(1);
		});

		it.each([
			['a non-image content type', 'application/json', Buffer.from('{}')],
			['a missing content type', undefined, Buffer.from('x')],
			['an empty body', 'image/jpeg', Buffer.alloc(0)],
		])('rejects a snapshot with %s as protocol', async (_name, contentType, body) => {
			transport.queue(200, body, contentType === undefined ? {} : { 'content-type': contentType });

			await expect(client.getSnapshot('c1')).rejects.toMatchObject({ category: ProtectErrorCategory.PROTOCOL });
		});

		it('normalizes the snapshot content type to its media type', async () => {
			transport.queue(200, Buffer.from('jpeg'), { 'content-type': 'Image/JPEG; charset=binary' });

			expect((await client.getSnapshot('c1')).contentType).toBe('image/jpeg');
		});
	});

	describe('status mapping', () => {
		it.each([
			[401, ProtectErrorCategory.AUTHENTICATION],
			[403, ProtectErrorCategory.AUTHORIZATION],
			[404, ProtectErrorCategory.NOT_FOUND],
			[400, ProtectErrorCategory.BAD_REQUEST],
			[418, ProtectErrorCategory.PROTOCOL],
			[302, ProtectErrorCategory.PROTOCOL],
		])('maps %d to %s without retry', async (status, category) => {
			transport.queue(status);

			await expect(client.listCameras()).rejects.toMatchObject({ category, status, operation: 'cameras' });
			expect(transport.requests).toHaveLength(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it('maps the full-HD snapshot 400 to unsupported', async () => {
			transport.queue(400, text('snapshot-hq-unsupported.json'));

			await expect(client.getSnapshot('6541', { highQuality: true })).rejects.toMatchObject({
				category: ProtectErrorCategory.UNSUPPORTED,
				status: 400,
			});
			expect(transport.requests[0].path).toContain('highQuality=true');
			expect(transport.requests).toHaveLength(1);
		});

		it('keeps other 400 bodies, and the same body on another endpoint, as bad_request', async () => {
			transport.queue(400, '{"error":"something else","name":"BAD_REQUEST"}');
			transport.queue(400, text('snapshot-hq-unsupported.json'));
			transport.queue(400, 'not json');

			await expect(client.getSnapshot('6541', { highQuality: true })).rejects.toMatchObject({
				category: ProtectErrorCategory.BAD_REQUEST,
			});
			await expect(client.getCamera('6541')).rejects.toMatchObject({ category: ProtectErrorCategory.BAD_REQUEST });
			await expect(client.getSnapshot('6541')).rejects.toMatchObject({ category: ProtectErrorCategory.BAD_REQUEST });
		});
	});

	describe('retries', () => {
		it('retries a 429 after Retry-After and succeeds', async () => {
			transport.queue(429, '{}', rateHeaders.rate_limited);
			transport.queue(200, text('cameras.json'));

			expect(await client.listCameras()).toHaveLength(2);
			// The sleep carries the call deadline, so it stops with the call.
			expect(sleep).toHaveBeenCalledWith(1000, expect.any(AbortSignal));
			expect(transport.requests).toHaveLength(2);
		});

		it('pauses the pacer for the retry delay of a 429', async () => {
			const backOff = jest.spyOn(pacer, 'backOff');

			transport.queue(429, '{}', { 'retry-after': '3' });
			transport.queue(200, '[]');
			await client.listCameras();

			expect(backOff).toHaveBeenCalledWith(3000);
		});

		it('retries 502, 503 and 504 for lists and gives up after three attempts', async () => {
			transport.queue(502);
			transport.queue(503);
			transport.queue(504);

			await expect(client.listCameras()).rejects.toMatchObject({
				category: ProtectErrorCategory.UNAVAILABLE,
				status: 504,
			});
			expect(transport.requests).toHaveLength(3);
			expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
		});

		it.each([500, 408])('retries a %d and recovers', async (status) => {
			transport.queue(status);
			transport.queue(200, '[]');

			expect(await client.listSensors()).toEqual([]);
			expect(transport.requests).toHaveLength(2);
		});

		it('jitters the backoff between 80 and 120 percent', async () => {
			for (const [random, expected] of [
				[0, [400, 800]],
				[1, [600, 1200]],
			] as const) {
				sleep.mockClear();
				transport.queue(503);
				transport.queue(503);
				transport.queue(503);

				await expect(build({ random: () => random }).listLights()).rejects.toBeInstanceOf(ProtectApiError);
				expect(sleep.mock.calls.map((c) => c[0])).toEqual(expected);
			}
		});

		it('honours maxAttempts', async () => {
			transport.queue(503);
			transport.queue(503);

			await expect(build({ maxAttempts: 2 }).listCameras()).rejects.toMatchObject({ status: 503 });
			expect(transport.requests).toHaveLength(2);
		});

		it('does not retry a snapshot 503 and reports the camera unavailable', async () => {
			transport.queue(503);

			await expect(client.getSnapshot('6541')).rejects.toMatchObject({
				category: ProtectErrorCategory.UNAVAILABLE,
				status: 503,
			});
			expect(transport.requests).toHaveLength(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it('retries a snapshot 429 but not its 500', async () => {
			transport.queue(429, '{}', { 'retry-after': '1' });
			transport.queue(500);

			await expect(client.getSnapshot('6541')).rejects.toMatchObject({ status: 500 });
			expect(transport.requests).toHaveLength(2);
		});

		it('fails fast when Retry-After exceeds the remaining deadline', async () => {
			transport.queue(429, '{}', { 'retry-after': '60' });

			await expect(client.listCameras()).rejects.toMatchObject({
				category: ProtectErrorCategory.RATE_LIMITED,
				status: 429,
				retryAfterMs: 60000,
			});
			expect(transport.requests).toHaveLength(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it('throws a timeout instead of sending when the pacer held the call past its deadline', async () => {
			const slowPacer = new ProtectRatePacer({ sleep: () => Promise.resolve() });

			jest.spyOn(slowPacer, 'acquire').mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 80)));
			transport.queue(200, '[]');

			await expect(build({ pacer: slowPacer, deadlineMs: 30 }).listCameras()).rejects.toMatchObject({
				category: ProtectErrorCategory.TIMEOUT,
			});
			expect(transport.requests).toHaveLength(0);
		});

		it('ends the call at its deadline while the pacer is still holding it', async () => {
			const heldPacer = new ProtectRatePacer({ sleep: () => Promise.resolve() });
			let pacingSignal: AbortSignal | undefined;

			jest.spyOn(heldPacer, 'acquire').mockImplementation((signal) => {
				pacingSignal = signal;

				return new Promise(() => undefined);
			});
			transport.queue(200, '[]');

			const startedAt = Date.now();

			await expect(build({ pacer: heldPacer, deadlineMs: 30 }).listCameras()).rejects.toMatchObject({
				category: ProtectErrorCategory.TIMEOUT,
			});
			expect(Date.now() - startedAt).toBeLessThan(1000);
			// The pacer is told as well, so its own sleep timer stops with the call.
			expect(pacingSignal?.aborted).toBe(true);
			expect(transport.requests).toHaveLength(0);
		});

		it('waits once, not twice, for a 429 with the real pacer', async () => {
			let now = 0;
			const timers: { at: number; resolve: () => void }[] = [];
			const virtualSleep = (ms: number): Promise<void> =>
				new Promise((resolve) => timers.push({ at: now + ms, resolve }));
			const realPacer = new ProtectRatePacer({ now: () => now, sleep: virtualSleep });
			const sleeps: number[] = [];
			const paced = build({
				pacer: realPacer,
				sleep: (ms) => {
					sleeps.push(ms);

					return virtualSleep(ms);
				},
			});

			transport.queue(429, '{}', { 'retry-after': '1' });
			transport.queue(200, '[]');

			let done = false;
			const call = paced.listCameras().finally(() => {
				done = true;
			});

			// Bounded, and stopped by a rejection as well as a result, so a failure cannot spin forever.
			for (let pumps = 0; !done && pumps < 1000; pumps++) {
				await new Promise((resolve) => setImmediate(resolve));
				timers.sort((a, b) => a.at - b.at);

				const next = timers.shift();

				if (next) {
					now = Math.max(now, next.at);
					next.resolve();
				}
			}

			expect(await call).toEqual([]);
			expect(sleeps).toEqual([1000]);
			expect(now).toBe(1000);
			expect(transport.requests).toHaveLength(2);
		});

		it('retries a reset connection once and then gives up', async () => {
			transport.queueError(reset());
			transport.queue(200, '[]');

			expect(await client.listCameras()).toEqual([]);
			expect(transport.requests).toHaveLength(2);
			expect(sleep).not.toHaveBeenCalled();

			transport.queueError(reset());
			transport.queueError(reset());

			await expect(client.listCameras()).rejects.toMatchObject({ category: ProtectErrorCategory.UNREACHABLE });
			expect(transport.requests).toHaveLength(4);
		});

		it('does not retry a reset after the first attempt', async () => {
			transport.queue(503);
			transport.queueError(reset());

			await expect(client.listCameras()).rejects.toMatchObject({ category: ProtectErrorCategory.UNREACHABLE });
			expect(transport.requests).toHaveLength(2);
		});

		it.each([
			['a timeout', new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'meta/info'), ProtectErrorCategory.TIMEOUT],
			[
				'an oversized body',
				new ProtectApiError(ProtectErrorCategory.PROTOCOL, 'meta/info'),
				ProtectErrorCategory.PROTOCOL,
			],
			[
				'a TLS failure',
				new ProtectApiError(ProtectErrorCategory.TLS_UNTRUSTED, 'tls'),
				ProtectErrorCategory.TLS_UNTRUSTED,
			],
			[
				'a refused connection',
				Object.assign(new Error('x'), { code: 'ECONNREFUSED' }),
				ProtectErrorCategory.UNREACHABLE,
			],
			['a timed-out socket', Object.assign(new Error('x'), { code: 'ETIMEDOUT' }), ProtectErrorCategory.TIMEOUT],
		])('never retries %s', async (_name, error, category) => {
			transport.queueError(error);

			await expect(client.listCameras()).rejects.toMatchObject({ category, operation: 'cameras' });
			expect(transport.requests).toHaveLength(1);
			expect(sleep).not.toHaveBeenCalled();
		});

		it('caps each attempt at the remaining deadline', async () => {
			transport.queue(200, '[]');

			await build({ timeoutMs: 10000, deadlineMs: 4000 }).listCameras();

			expect(transport.requests[0].timeoutMs).toBeLessThanOrEqual(4000);
			expect(transport.requests[0].timeoutMs).toBeGreaterThan(3000);
		});
	});

	describe('cancellation', () => {
		it('close() cancels in-flight and later calls', async () => {
			transport.queueHang();

			const inFlight = client.listCameras();

			await new Promise((r) => setImmediate(r));
			client.close();

			await expect(inFlight).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			await expect(client.getMetaInfo()).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			expect(transport.closed).toBe(true);
			expect(transport.requests).toHaveLength(1);
		});

		it('close() cancels a call that waits for its retry delay', async () => {
			sleep.mockImplementation(() => new Promise<void>(() => undefined));
			transport.queue(503);

			const waiting = client.listCameras();

			await new Promise((r) => setImmediate(r));
			client.close();

			await expect(waiting).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			expect(transport.requests).toHaveLength(1);
		});

		it('cancels with the signal of the caller', async () => {
			const controller = new AbortController();

			transport.queueHang();

			const pending = client.getSnapshot('6541', { signal: controller.signal });

			await new Promise((r) => setImmediate(r));
			controller.abort();

			await expect(pending).rejects.toMatchObject({ category: ProtectErrorCategory.CANCELLED });
			await expect(client.getMetaInfo({ signal: controller.signal })).rejects.toMatchObject({
				category: ProtectErrorCategory.CANCELLED,
			});
			expect(transport.requests).toHaveLength(1);
		});
	});

	describe('secrets', () => {
		it('never puts the key or a stream alias into errors or log lines', async () => {
			const emitted: unknown[] = [];
			const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
				jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
					emitted.push(args);
				}),
			);
			const errors: unknown[] = [];

			try {
				transport.queue(
					200,
					JSON.stringify({
						high: `rtsps://127.0.0.1:7441/${ALIAS}?enableSrtp`,
						medium: null,
						low: null,
						package: null,
					}),
				);

				const streams = await client.getRtspsStreams('6541');

				expect(streams.high).toContain(ALIAS);

				transport.queue(500, JSON.stringify({ error: `X-API-KEY: ${KEY}`, alias: ALIAS }));
				transport.queue(500, `echo ${KEY}`);
				transport.queue(500, `echo ${KEY}`);
				transport.queueError(Object.assign(new Error(`connect failed for ${KEY} ${ALIAS}`), { code: 'ECONNREFUSED' }));
				transport.queue(401, KEY);
				transport.queue(200, `<html>${KEY}</html>`);

				await client.listCameras().catch((e: unknown) => errors.push(e));
				await client.listCameras().catch((e: unknown) => errors.push(e));
				await client.getCamera('6541').catch((e: unknown) => errors.push(e));
				await client.getMetaInfo().catch((e: unknown) => errors.push(e));
				await client.getSnapshot('6541').catch((e: unknown) => errors.push(e));
			} finally {
				spies.forEach((spy) => spy.mockRestore());
			}

			const serialized = JSON.stringify([
				emitted,
				errors,
				errors.map(String),
				errors.map((e) => (e as Error).stack),
				errors.map((e) => Object.getOwnPropertyNames(e).map((n) => (e as Record<string, unknown>)[n])),
			]);

			expect(errors.length).toBeGreaterThanOrEqual(4);
			expect(emitted.length).toBeGreaterThan(0);
			expect(serialized).not.toContain(KEY);
			expect(serialized).not.toContain('SENTINELALIAS');
		});

		it('logs only the endpoint template, status and duration', async () => {
			const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

			try {
				transport.queue(200, '[]');
				await client.getCamera('6541').catch(() => undefined);
				transport.queue(200, '[]');
				await client.listCameras();

				const lines = debug.mock.calls.map((c) => String(c[0]));

				expect(lines.some((l) => /GET cameras\/\{id\} 200 \d+ms/.test(l))).toBe(true);
				expect(lines.some((l) => /GET cameras 200 \d+ms/.test(l))).toBe(true);
				expect(lines.join('\n')).not.toContain('6541');
			} finally {
				debug.mockRestore();
			}
		});
	});

	it('reports no peer fingerprint for an injected transport', () => {
		expect(client.peerFingerprint).toBeNull();
	});
});
