import type { HomeyShsCapture } from './support/homey-shs-probe';
import {
	assertHomeyCaptureSafe,
	captureHomeyShs,
	loadHomeyShsProbeConfig,
	sanitizeHomeyDevices,
	sanitizeHomeyPayload,
	sanitizeHomeyZones,
} from './support/homey-shs-probe';

const createConfig = () =>
	loadHomeyShsProbeConfig(
		{
			FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
			FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
			FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
			FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
		},
		'/tmp/homey-spike',
	);

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('Homey SHS compatibility probe', () => {
	it('requires an exact expected host and rejects credential-bearing URLs', () => {
		expect(() =>
			loadHomeyShsProbeConfig({
				FB_HOMEY_SHS_URL: 'http://user:password@127.0.0.1:4859',
				FB_HOMEY_SHS_API_KEY: 'secret',
				FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
			}),
		).toThrow('must not contain credentials');

		expect(() =>
			loadHomeyShsProbeConfig({
				FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
				FB_HOMEY_SHS_API_KEY: 'secret',
				FB_HOMEY_SHS_EXPECTED_HOST: 'homey.local',
			}),
		).toThrow('does not match');
	});

	it('preserves capability identifiers while replacing household identities', () => {
		const zones = sanitizeHomeyZones({
			'private-zone-id': { id: 'private-zone-id', name: 'Private Room', parent: null, active: true },
		});
		const devices = sanitizeHomeyDevices({
			'private-device-id': {
				id: 'private-device-id',
				name: 'Private Device',
				zone: 'private-zone-id',
				capabilities: ['onoff', 'measure_temperature.inside'],
				capabilitiesObj: {
					onoff: { id: 'onoff', value: true },
					'measure_temperature.inside': { id: 'measure_temperature.inside', value: 21.5 },
				},
				settings: {
					address: '192.168.1.25',
					serial: 'aa:bb:cc:dd:ee:ff',
					gateway: 'fd12:3456:789a::1',
					endpoint: 'https://[fe80::1%eth0]:4860/api',
					mappedAddress: '::ffff:192.168.1.1',
				},
			},
		});
		const serialized = JSON.stringify({ zones, devices });

		expect(serialized).not.toContain('Private Room');
		expect(serialized).not.toContain('Private Device');
		expect(serialized).not.toContain('private-device-id');
		expect(serialized).not.toContain('192.168.1.25');
		expect(serialized).not.toContain('aa:bb:cc:dd:ee:ff');
		expect(serialized).not.toContain('fd12:3456:789a::1');
		expect(serialized).not.toContain('fe80::1');
		expect(serialized).not.toContain('::ffff:192.168.1.1');
		expect(serialized).toContain('measure_temperature.inside');
	});

	it('uses unauthenticated ping, bounded read-only calls, and blocks redirects', async () => {
		const config = createConfig();
		const calls: Array<{ input: string; init?: RequestInit }> = [];
		const fetchMock = jest.fn((input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

			calls.push({ input: url, init });

			if (url.endsWith('/api/manager/system/ping')) {
				return Promise.resolve(
					jsonResponse({}, 200, {
						'x-homey-id': 'private-homey-id',
						'x-homey-version': '12.3.4',
						'x-homey-tier': 'shs',
					}),
				);
			}

			if (url.endsWith('/api/manager/system/')) {
				return Promise.resolve(jsonResponse({ name: 'Private Homey', hostname: 'homey.private' }));
			}

			if (url.endsWith('/api/manager/zones/zone')) {
				return Promise.resolve(jsonResponse({ 'private-zone-id': { id: 'private-zone-id', name: 'Private Room' } }));
			}

			return Promise.resolve(
				jsonResponse({
					'private-device-id': {
						id: 'private-device-id',
						name: 'Private Device',
						capabilities: ['onoff'],
						capabilitiesObj: { onoff: { id: 'onoff', value: false } },
					},
				}),
			);
		});

		const capture = await captureHomeyShs(config, fetchMock as typeof fetch);

		expect(calls).toHaveLength(4);
		expect(new Headers(calls[0].init?.headers).has('authorization')).toBe(false);

		for (const call of calls.slice(1)) {
			expect(call.init?.method).toBe('GET');
			expect(call.init?.redirect).toBe('error');
			expect(new Headers(call.init?.headers).get('authorization')).toBe(`Bearer ${config.apiKey}`);
		}

		assertHomeyCaptureSafe(capture, [config.apiKey, config.expectedHost], config.privateTerms);
	});

	it('does not confuse opaque redaction markers with configured private terms', () => {
		const capture: HomeyShsCapture = {
			metadata: {},
			systemInfo: { description: 'red private term' },
			zones: {},
			devices: {},
		};
		const sanitizedCapture: HomeyShsCapture = {
			...capture,
			systemInfo: sanitizeHomeyPayload(capture.systemInfo, ['red', 'private', 'term']),
		};
		const serialized = JSON.stringify(sanitizedCapture);

		expect(serialized).toContain('[~2~]');
		expect(serialized).not.toContain('red');
		expect(serialized).not.toContain('private');
		expect(serialized).not.toContain('term');
		expect(() => assertHomeyCaptureSafe(sanitizedCapture, [], ['red', 'private', 'term'])).not.toThrow();
	});

	it('rejects captures containing a configured forbidden value', () => {
		const unsafeCapture: HomeyShsCapture = {
			metadata: {},
			systemInfo: { leaked: 'known-private-value' },
			zones: {},
			devices: {},
		};

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['known-private-value'])).toThrow('private term');

		unsafeCapture.systemInfo = { leaked: 'hpat_abcdefghijklmnop1234' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { gateway: 'fd12:3456:789a::1' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');
	});
});
