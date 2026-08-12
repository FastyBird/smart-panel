import type { HomeyShsCapture } from './support/homey-shs-probe';
import {
	assertHomeyCaptureSafe,
	captureHomeyShs,
	createSanitizationAliases,
	loadHomeyShsProbeConfig,
	sanitizeHomeyDevices,
	sanitizeHomeyPayload,
	sanitizeHomeyZones,
} from './support/homey-shs-probe';

const createConfig = (environment: NodeJS.ProcessEnv = {}) =>
	loadHomeyShsProbeConfig(
		{
			FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
			FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
			FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
			FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
			...environment,
		},
		'/tmp/homey-spike',
	);

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('Homey SHS compatibility probe', () => {
	it('requires an exact expected host and rejects credential-bearing URLs', () => {
		const ipv6Config = loadHomeyShsProbeConfig({
			FB_HOMEY_SHS_URL: 'http://[fe80::1]:4859',
			FB_HOMEY_SHS_API_KEY: 'secret',
			FB_HOMEY_SHS_EXPECTED_HOST: 'fe80::1',
		});

		expect(ipv6Config.expectedHost).toBe('fe80::1');

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

		expect(() =>
			loadHomeyShsProbeConfig({
				FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
				FB_HOMEY_SHS_API_KEY: 'secret',
				FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
				FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Bo',
			}),
		).toThrow('at least three characters');
	});

	it('preserves capability identifiers while replacing household identities', () => {
		const aliases = createSanitizationAliases();
		const zones = sanitizeHomeyZones(
			{
				'private-zone-id': { id: 'private-zone-id', name: 'Private Room', parent: null, active: true },
			},
			[],
			aliases,
		);
		const devices = sanitizeHomeyDevices(
			{
				'private-device-id': {
					id: 'private-device-id',
					name: 'Private Device',
					zone: 'private-zone-id',
					deviceIds: ['private-device-id'],
					zoneIds: ['private-zone-id'],
					capabilities: ['onoff', 'measure_temperature.inside', 'secret_token_status', 'homealarm_state'],
					capabilitiesObj: {
						homealarm_state: { id: 'homealarm_state', value: false },
						secret_token_status: {
							id: 'secret_token_status',
							value: true,
							authorization: 'private-capability-authorization',
						},
						onoff: {
							id: 'onoff',
							value: true,
							accountId: 'private-capability-account-id',
							hardware_id: 'private-capability-hardware-id',
							metadata: { id: 'private-capability-metadata-id' },
						},
						'measure_temperature.inside': { id: 'measure_temperature.inside', value: 21.5 },
						lastUpdated: {
							id: 'lastUpdated',
							value: true,
							accountId: 'private-timestamp-capability-account-id',
						},
						deviceId: { id: 'deviceId', value: 'capability-value' },
					},
					settings: {
						pin: 1234,
						passcode: 5678,
						access_code: 9012,
						address: '192.168.1.25',
						serial: 'aa:bb:cc:dd:ee:ff',
						gateway: 'fd12:3456:789a::1',
						endpoint: 'https://[fe80::1%eth0]:4860/api',
						mappedAddress: '::ffff:192.168.1.1',
						bridgeIdentifier: 'private-bridge-id',
					},
					data: {
						node: 123_456_789,
						'opaque-direct-id': { reachable: true },
						'42': { reachable: false },
						configuration: { button1: true, enabled: true, threshold: false },
						nodes: {
							'opaque-device-id': { reachable: true },
							'123456789': { reachable: false },
							'node-42': { enabled: false, reachable: true },
							'42-node': { enabled: true, reachable: false },
							'node.42': { enabled: false, reachable: false },
							'0x2a': { enabled: true, reachable: true },
						},
						outputs: { output2: { enabled: true } },
						device_id: 'private-driver-device-id',
						hardware_id: 'private-hardware-id',
						accountId: 'private-account-id',
						model: 'private-driver-model',
					},
					ui: { title: 'Recoverable Room Name' },
				},
			},
			['home'],
			aliases,
		);
		const sanitizedZoneId = Object.keys(zones)[0];
		const sanitizedDeviceId = Object.keys(devices)[0];
		const serialized = JSON.stringify({ zones, devices });

		expect(devices[sanitizedDeviceId]).toMatchObject({
			zone: sanitizedZoneId,
			deviceIds: [sanitizedDeviceId],
			zoneIds: [sanitizedZoneId],
			capabilitiesObj: {
				homealarm_state: { id: 'homealarm_state', value: false },
				secret_token_status: {
					id: 'secret_token_status',
					value: true,
					authorization: '[~3~]',
				},
			},
			settings: {
				pin: '[~3~]',
				passcode: '[~3~]',
				access_code: '[~3~]',
			},
			data: {
				node: '[~7~]',
			},
		});
		expect((devices[sanitizedDeviceId] as { capabilities: string[] }).capabilities).toContain('homealarm_state');
		const sanitizedNodes = (devices[sanitizedDeviceId] as { data: { nodes: Record<string, unknown> } }).data.nodes;
		const sanitizedData = (devices[sanitizedDeviceId] as { data: Record<string, unknown> }).data;

		expect(Object.keys(sanitizedNodes)).toHaveLength(6);
		expect(Object.keys(sanitizedNodes).every((key) => /^id-/.test(key))).toBe(true);
		expect(Object.values(sanitizedNodes)).toEqual(
			expect.arrayContaining([{ reachable: true }, { reachable: false }, { enabled: false, reachable: true }]),
		);
		expect(Object.values(sanitizedData)).toEqual(expect.arrayContaining([{ reachable: true }, { reachable: false }]));
		expect(sanitizedData.configuration).toEqual({ button1: true, enabled: true, threshold: false });
		expect(sanitizedData.outputs).toEqual({ output2: { enabled: true } });
		expect(() => assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones, devices }, [], ['home'])).not.toThrow();

		expect(serialized).not.toContain('Private Room');
		expect(serialized).not.toContain('Private Device');
		expect(serialized).not.toContain('private-device-id');
		expect(serialized).not.toContain('192.168.1.25');
		expect(serialized).not.toContain('aa:bb:cc:dd:ee:ff');
		expect(serialized).not.toContain('fd12:3456:789a::1');
		expect(serialized).not.toContain('fe80::1');
		expect(serialized).not.toContain('::ffff:192.168.1.1');
		expect(serialized).not.toContain('private-bridge-id');
		expect(serialized).not.toContain('private-driver-device-id');
		expect(serialized).not.toContain('opaque-device-id');
		expect(serialized).not.toContain('node-42');
		expect(serialized).not.toContain('42-node');
		expect(serialized).not.toContain('node.42');
		expect(serialized).not.toContain('0x2a');
		expect(serialized).not.toContain('opaque-direct-id');
		expect(serialized).not.toContain('"42"');
		expect(serialized).not.toContain('private-hardware-id');
		expect(serialized).not.toContain('private-account-id');
		expect(serialized).not.toContain('private-capability-account-id');
		expect(serialized).not.toContain('private-capability-hardware-id');
		expect(serialized).not.toContain('private-capability-metadata-id');
		expect(serialized).not.toContain('private-timestamp-capability-account-id');
		expect(serialized).not.toContain('private-driver-model');
		expect(serialized).not.toContain('Recoverable Room Name');
		expect(serialized).not.toContain('1234');
		expect(serialized).not.toContain('5678');
		expect(serialized).not.toContain('9012');
		expect(serialized).toContain('[~7~]');
		expect(serialized).toContain('measure_temperature.inside');
		expect(serialized).toContain('lastUpdated');
		expect(serialized).toContain('deviceId');
	});

	it('redacts generic personal labels without publishing a value-derived hash', () => {
		const sanitized = sanitizeHomeyPayload({
			title: 'Common Kitchen',
			accountId: 'family',
			hardware_id: 'switch-1',
			serialNumber: 123_456_789,
			deviceId: 987_654_321,
			deviceIds: ['device-one', 'device-two'],
			zone_ids: ['zone-one'],
			grid: 'preserved non-identifier',
			solids: ['preserved-array-value'],
			filename: 'preserved filename',
			codename: 'preserved codename',
			typename: 'preserved typename',
			diagnostic: 'gateway_192.168.1.25_backup',
			macTag: 'mac_aa:bb:cc:dd:ee:ff_backup',
			dottedMacTag: 'mac_aabb.ccdd.eeff_backup',
			compactMacTag: 'mac_AABBCCDDEEFF_backup',
			compactAdjacentMacTag: 'macaabbccddeeffbackup',
			ipv6Tag: 'deadfd12:3456:789a::1backup',
			emailTag: 'owner_alice@example.com_backup',
			activityTag: 'prefix_hpat_abcdefghijklmnop1234',
			urlTag: 'prefix_https://user:pass@private-host.local/api',
			brokerUrl: 'mqtt://broker.private/topic',
			endpoint: 'private-host.local:1883',
			format: { type: 'json' },
			thermostat: true,
			chip: 'preserved chip',
			membership: { type: 'standard' },
			tooltip: 'preserved tooltip',
			candidate: 'preserved candidate',
			update: { available: true },
			lastUpdated: '2026-08-12T20:15:30.123Z',
			lastModified: 1_786_579_200_000,
			customActivityField: '2026-08-12T20:16:31+02:00',
		});
		const collisionSafeDevices = sanitizeHomeyDevices({
			'DEVICE-000001': { id: 'DEVICE-000001', name: 'DEVICE-LABEL-000001' },
		});

		expect(sanitized).toEqual({
			title: '[~2~]',
			accountId: '[~7~]',
			hardware_id: '[~7~]',
			serialNumber: '[~0~]',
			deviceId: '[~7~]',
			deviceIds: [expect.stringMatching(/^device-/), expect.stringMatching(/^device-/)],
			zone_ids: [expect.stringMatching(/^zone-/)],
			grid: 'preserved non-identifier',
			solids: ['preserved-array-value'],
			filename: 'preserved filename',
			codename: 'preserved codename',
			typename: 'preserved typename',
			diagnostic: 'gateway_[~0~]_backup',
			macTag: 'mac_[~0~]_backup',
			dottedMacTag: 'mac_[~0~]_backup',
			compactMacTag: 'mac_[~0~]_backup',
			compactAdjacentMacTag: 'm[~0~]ffbackup',
			ipv6Tag: 'dead[~0~]kup',
			emailTag: '[~1~]_backup',
			activityTag: 'prefix_[~3~]',
			urlTag: 'prefix_[~5~]',
			brokerUrl: '[~5~]',
			endpoint: '[~5~]',
			format: { type: 'json' },
			thermostat: true,
			chip: 'preserved chip',
			membership: { type: 'standard' },
			tooltip: 'preserved tooltip',
			candidate: 'preserved candidate',
			update: { available: true },
			lastUpdated: '2000-01-01T00:00:00.000Z',
			lastModified: '2000-01-01T00:00:00.000Z',
			customActivityField: '2000-01-01T00:00:00.000Z',
		});
		expect(Object.keys(collisionSafeDevices)).toEqual(['device-000002']);
		expect(collisionSafeDevices['device-000002']).toMatchObject({
			id: 'device-000002',
			name: 'device-label-000002',
		});
		const privateTermCollisionDevices = sanitizeHomeyDevices(
			{
				'private-device-id': { id: 'private-device-id', name: 'my device-000001 room' },
			},
			['device-000001'],
		);

		expect(Object.keys(privateTermCollisionDevices)).toEqual(['device-000002']);
		expect(JSON.stringify(privateTermCollisionDevices)).not.toContain('device-000001');
		const privateSubstringCollisionDevices = sanitizeHomeyDevices(
			{
				'private-device-id': { id: 'private-device-id', name: 'Private device' },
			},
			['000001'],
		);

		expect(Object.keys(privateSubstringCollisionDevices)).toEqual(['device-000002']);
		expect(privateSubstringCollisionDevices['device-000002']).toMatchObject({ name: 'device-label-000002' });
		expect(JSON.stringify(privateSubstringCollisionDevices)).not.toContain('000001');
		const privatePrefixCollisionDevices = sanitizeHomeyDevices(
			{
				'private-device-id': { id: 'private-device-id', name: 'Private source' },
			},
			['device'],
		);
		const privatePrefixSerialized = JSON.stringify(privatePrefixCollisionDevices);

		expect(privatePrefixSerialized).not.toContain('device-');
		expect(privatePrefixSerialized).not.toContain('device-label');
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

		assertHomeyCaptureSafe(capture, [config.apiKey], config.privateTerms, config.expectedHost);

		const hostCollisionConfig = createConfig({
			FB_HOMEY_SHS_URL: 'http://homey-000001:4859',
			FB_HOMEY_SHS_EXPECTED_HOST: 'homey-000001',
		});
		const hostCollisionCapture = await captureHomeyShs(hostCollisionConfig, fetchMock as typeof fetch);

		expect((hostCollisionCapture.metadata.homey as { id: string }).id).toBe('homey-000002');
		expect(() =>
			assertHomeyCaptureSafe(
				hostCollisionCapture,
				[hostCollisionConfig.apiKey],
				hostCollisionConfig.privateTerms,
				hostCollisionConfig.expectedHost,
			),
		).not.toThrow();
	});

	it('checks an expected host against values rather than fixed metadata keys', () => {
		const capture: HomeyShsCapture = {
			metadata: { homey: { id: 'synthetic-source-id', tier: 'shs' } },
			systemInfo: {},
			zones: {},
			devices: {},
		};

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey')).not.toThrow();
		expect(() => assertHomeyCaptureSafe(capture, [], [], 'shs')).not.toThrow();
		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey.local')).not.toThrow();

		capture.systemInfo = { endpoint: 'http://homey:4859' };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey')).toThrow('expected host in a value');

		capture.systemInfo = { description: 'controller homey.local' };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey.local')).toThrow('expected host in a value');

		capture.systemInfo = { description: 'prefixhomey.localbackup' };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey.local')).toThrow('expected host in a value');

		capture.systemInfo = { aliases: { 'homey.local': true } };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey.local')).toThrow('expected host in a value');

		capture.systemInfo = { aliases: { 'http://homey:4859': true } };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey')).toThrow('expected host in a value');

		capture.systemInfo = { aliases: { homey: true } };

		expect(() => assertHomeyCaptureSafe(capture, [], [], 'homey')).toThrow('expected host in a value');
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

		expect(() =>
			assertHomeyCaptureSafe(
				{
					metadata: { schemaVersion: 1, homey: { id: 'homey-000001' } },
					systemInfo: {},
					zones: { 'zone-000001': { id: 'zone-000001', name: 'zone-label-000001' } },
					devices: {
						'device-000001': {
							id: 'device-000001',
							name: 'device-label-000001',
							capabilities: ['device_status'],
							capabilitiesObj: { device_status: { id: 'device_status', value: true } },
						},
					},
				},
				[],
				['home', 'device', 'system'],
			),
		).not.toThrow();
	});

	it('rejects captures containing a configured forbidden value', () => {
		const unsafeCapture: HomeyShsCapture = {
			metadata: {},
			systemInfo: { leaked: 'known-private-value' },
			zones: {},
			devices: {},
		};

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['known-private-value'])).toThrow('private term');

		for (const escapedForbiddenValue of ['abc"def', 'abc\\def']) {
			unsafeCapture.systemInfo = { echoedCredential: escapedForbiddenValue };

			expect(() => assertHomeyCaptureSafe(unsafeCapture, [escapedForbiddenValue])).toThrow('forbidden value');
		}

		unsafeCapture.systemInfo = { aliases: { 'Private Room': true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['Private Room'])).toThrow('private term');

		unsafeCapture.systemInfo = { aliases: { PrivateRoom: true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['Private'])).toThrow('private term');

		for (const dynamicKey of ['PrivateName', 'PrivateAddress', 'PrivateUpdated', 'PrivateToken']) {
			unsafeCapture.systemInfo = { aliases: { [dynamicKey]: true } };

			expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['Private'])).toThrow('private term');
		}

		unsafeCapture.systemInfo = { aliases: { deviceId: true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['device'])).toThrow('private term');

		unsafeCapture.systemInfo = { aliases: { id: 'record', deviceId: true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['device'])).toThrow('private term');

		unsafeCapture.systemInfo = { householdCode: 123_456 };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['123456'])).toThrow('private term');

		unsafeCapture.systemInfo = {};
		unsafeCapture.devices = sanitizeHomeyDevices({
			'driver-metadata-device': {
				id: 'driver-metadata-device',
				name: 'Synthetic source',
				data: { capabilitiesObj: { PrivateRoom: true } },
			},
		});

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [], ['Private'])).toThrow('private term');

		unsafeCapture.systemInfo = { leaked: 'hpat_abcdefghijklmnop1234' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { leaked: 'prefix_hpat_abcdefghijklmnop1234' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { leaked: 'owner_alice@example.com_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { leaked: 'prefix_https://user:pass@private-host.local/api' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { aliases: { 'https://user:pass@private-host.local/api': true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { brokerUrl: 'mqtt://broker.private/topic' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('unredacted endpoint');

		unsafeCapture.systemInfo = { endpoint: 'private-host.local:1883' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('unredacted endpoint');

		unsafeCapture.systemInfo = { gateway: 'fd12:3456:789a::1' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { description: 'gateway fd12:3456:789a::1.' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'gateway_192.168.1.25_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'mac_aa:bb:cc:dd:ee:ff_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'mac_aabb.ccdd.eeff_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'mac_AABBCCDDEEFF_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'macaabbccddeeffbackup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'deadfd12:3456:789a::1backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');
	});
});
