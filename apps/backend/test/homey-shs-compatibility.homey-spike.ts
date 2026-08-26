import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import {
	assertDistinctHomeyEnumCapabilityOptionIds,
	assertDistinctHomeyEnumOptionIds,
	deriveKnownCoverageGaps,
	deriveKnownDeviceClassGaps,
	deriveKnownMetadataGaps,
} from './support/homey-shs-fixture-coverage';
import { buildHomeyFixtureProvenance } from './support/homey-shs-fixture-manifest';
import { publishHomeyFixtureCorpus } from './support/homey-shs-fixture-publication';
import { selectHomeyFixtures } from './support/homey-shs-fixture-selection';
import type { HomeyShsCapture } from './support/homey-shs-probe';
import {
	assertHomeyCaptureRedacted,
	assertHomeyCaptureSafe,
	captureHomeyShs,
	createSanitizationAliases,
	loadHomeyShsProbeConfig,
	sanitizeHomeyDevices,
	sanitizeHomeyPayload,
	sanitizeHomeyPublishedMetadata,
	sanitizeHomeyZones,
} from './support/homey-shs-probe';
import { resolveHomeyTransportPort } from './support/homey-shs-transport';

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
	it('keeps the reviewed Homey SDK available to production installs with its license', () => {
		const rootPackage = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')) as {
			engines: { node: string };
		};
		const backendPackage = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
			engines: { node: string };
		};
		const packagedServer = JSON.parse(readFileSync(resolve(__dirname, '../../../build/package.json'), 'utf8')) as {
			engines: { node: string };
		};
		const homeyPackagePath = require.resolve('homey-api/package.json');
		const homeyPackage = JSON.parse(readFileSync(homeyPackagePath, 'utf8')) as {
			engines: { node: string };
			license: string;
			version: string;
		};
		const license = readFileSync(resolve(dirname(homeyPackagePath), 'LICENSE'), 'utf8');

		expect(backendPackage.dependencies['homey-api']).toBe('3.19.2');
		expect(backendPackage.devDependencies).not.toHaveProperty('homey-api');
		expect([rootPackage.engines.node, backendPackage.engines.node, packagedServer.engines.node]).toEqual([
			'>=24',
			'>=24',
			'>=24',
		]);
		expect(homeyPackage).toMatchObject({ engines: { node: '>=24' }, license: 'SEE LICENSE', version: '3.19.2' });
		expect(license).toContain('Package may be used freely with Homey products');
	});

	it('keeps the Homey Socket.IO 2 client on its callback-based parser generation', () => {
		const requireFromHomeyApi = createRequire(require.resolve('homey-api/package.json'));
		const socketIoClientPackagePath = requireFromHomeyApi.resolve('socket.io-client/package.json');
		const socketIoClientPackage = requireFromHomeyApi(socketIoClientPackagePath) as { version: string };
		const requireFromSocketIoClient = createRequire(socketIoClientPackagePath);
		const parser = requireFromSocketIoClient('socket.io-parser') as {
			Encoder: new () => {
				encode(packet: Record<string, unknown>, callback: (packets: unknown[]) => void): void;
			};
			protocol: number;
		};
		let encodedPackets: unknown[] | undefined;

		new parser.Encoder().encode({ data: ['probe'], nsp: '/', type: 2 }, (packets) => {
			encodedPackets = packets;
		});

		expect(socketIoClientPackage.version).toBe('2.5.0');
		expect(parser.protocol).toBe(4);
		expect(encodedPackets).toEqual(['2["probe"]']);
	});

	it('keeps the promoted live fixture corpus safe and representative', () => {
		const fixtureCollectionRoot = resolve(__dirname, '../src/plugins/devices-homey/__fixtures__');
		const fixtureRoot = resolve(fixtureCollectionRoot, 'current');

		expect(lstatSync(fixtureRoot).isSymbolicLink()).toBe(true);
		expect(readlinkSync(fixtureRoot)).toMatch(/^versions\/[A-Za-z0-9._-]+$/);

		const readFixture = (path: string): unknown =>
			JSON.parse(readFileSync(resolve(fixtureRoot, path), 'utf8')) as unknown;
		const fixtureNames = [
			'light',
			'switch',
			'climate',
			'cover',
			'sensor-air-quality',
			'sensor-safety',
			'energy-meter',
			'repeated-capabilities',
			'unavailable',
		];
		const fixtures = Object.fromEntries(
			fixtureNames.map((name) => [name, readFixture(`devices/${name}.json`) as Record<string, unknown>]),
		);
		const capabilities = (name: string): string[] => fixtures[name].capabilities as string[];
		const bases = (name: string): string[] => capabilities(name).map((capability) => capability.split('.', 1)[0]);
		const expectCapabilities = (name: string, ...expected: string[]): void => {
			expect(bases(name)).toEqual(expect.arrayContaining(expected));
		};

		assertHomeyCaptureSafe(
			{
				metadata: readFixture('manifest.json') as Record<string, unknown>,
				systemInfo: readFixture('system-info.json'),
				zones: readFixture('zones.json'),
				devices: fixtures,
			},
			[],
		);
		expect(() =>
			assertHomeyCaptureSafe(
				{
					metadata: {},
					systemInfo: readFixture('system-info.json'),
					zones: readFixture('zones.json'),
					devices: fixtures,
				},
				[],
				['home'],
			),
		).not.toThrow();
		assertHomeyCaptureRedacted({
			metadata: {},
			systemInfo: readFixture('system-info.json'),
			zones: readFixture('zones.json'),
			devices: Object.fromEntries(Object.values(fixtures).map((fixture) => [fixture.id as string, fixture])),
		});

		expect(new Set(Object.values(fixtures).map((fixture) => fixture.id)).size).toBe(fixtureNames.length);
		expect(
			Object.values(fixtures).every(
				(fixture) => typeof fixture.name === 'string' && /^device-label-\d{6}$/.test(fixture.name),
			),
		).toBe(true);
		expectCapabilities('light', 'onoff', 'dim');
		expectCapabilities('switch', 'onoff');
		expectCapabilities('climate', 'measure_temperature', 'measure_humidity');
		expectCapabilities('cover', 'windowcoverings_state', 'windowcoverings_set');
		expectCapabilities('sensor-air-quality', 'measure_temperature', 'measure_humidity', 'measure_luminance');
		expect(bases('sensor-safety').some((base) => base === 'alarm_motion' || base === 'alarm_battery')).toBe(true);
		expectCapabilities('energy-meter', 'measure_power', 'meter_power');
		expect(fixtures.unavailable.available).toBe(false);

		const repeatedCapabilities = capabilities('repeated-capabilities');
		const repeatedBases = bases('repeated-capabilities');

		expect(repeatedCapabilities.some((capability) => capability.includes('.'))).toBe(true);
		expect(new Set(repeatedBases).size).toBeLessThan(repeatedBases.length);
		const manifest = readFixture('manifest.json') as {
			knownCoverageGaps: string[];
			knownDeviceClassGaps: string[];
			knownMetadataGaps: string[];
			provenance: Record<string, unknown>;
			syntheticFixtures: string[];
		};

		expect(manifest.provenance).toEqual({
			captureDate: '2026-08-13',
			homeyVersion: '13.4.0',
			transport: { protocol: 'http', port: 4859 },
			sanitized: true,
		});
		expect(manifest.knownCoverageGaps).toEqual(
			expect.arrayContaining(['target_temperature', 'measure_co2', 'windowcoverings_tilt_set']),
		);
		expect(manifest.knownDeviceClassGaps).toEqual(['lock']);
		expect(manifest.knownMetadataGaps).toEqual(['live_enum_option_ids']);
		expect(manifest.syntheticFixtures).toEqual(['synthetic/enum-capability.json']);
		const syntheticEnum = readFixture('synthetic/enum-capability.json') as {
			provenance: string;
			values: Array<{ id: string }>;
		};

		expect(syntheticEnum.provenance).toBe('synthetic-protocol-contract');
		expect(syntheticEnum.values.map(({ id }) => id)).toEqual(['mode_a', 'mode_b', 'mode_c']);
		assertDistinctHomeyEnumCapabilityOptionIds(syntheticEnum);

		const syntheticManifest = JSON.parse(
			readFileSync(resolve(fixtureCollectionRoot, 'synthetic/manifest.json'), 'utf8'),
		) as { deviceFixtures: string[]; version: string };
		expect(syntheticManifest).toEqual({
			deviceFixtures: ['devices/lock.json'],
			schemaVersion: 1,
			version: 'v1',
		});
		const syntheticLock = JSON.parse(
			readFileSync(resolve(fixtureCollectionRoot, 'synthetic', syntheticManifest.version, 'devices/lock.json'), 'utf8'),
		) as {
			capabilities: string[];
			class: string;
			fixtureProvenance: string;
		};

		expect(syntheticLock.fixtureProvenance).toBe('synthetic-published-protocol-contract');
		expect(syntheticLock.class).toBe('lock');
		expect(syntheticLock.capabilities).toEqual(['locked']);
		assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices: { lock: syntheticLock } }, []);
	});

	it('finds a deterministic global fixture assignment instead of choosing greedily', () => {
		const devices = {
			plainSocket: { class: 'socket', capabilities: ['onoff'] },
			powerSocket: {
				class: 'socket',
				capabilities: ['onoff', 'measure_power', 'meter_power', 'measure_power.second'],
			},
			secondPowerMeter: {
				class: 'sensor',
				capabilities: ['measure_power', 'meter_power', 'measure_power.second'],
			},
			light: { class: 'light', capabilities: ['onoff', 'dim'] },
			climate: { class: 'sensor', capabilities: ['measure_temperature', 'measure_humidity'] },
			cover: { class: 'windowcoverings', capabilities: ['windowcoverings_state', 'windowcoverings_set'] },
			air: {
				class: 'sensor',
				capabilities: ['measure_temperature', 'measure_humidity', 'measure_luminance'],
			},
			safety: { class: 'sensor', capabilities: ['alarm_motion'] },
			unavailable: { class: 'other', capabilities: [], available: false },
		};
		const fixtures = selectHomeyFixtures(devices);

		expect(fixtures.get('switch')).toBe(devices.plainSocket);
		expect(fixtures.get('energy-meter')).toBe(devices.powerSocket);
		expect(fixtures.get('repeated-capabilities')).toBe(devices.secondPowerMeter);
	});

	it('rejects collapsed live enum option IDs before fixture writes', () => {
		expect(() =>
			assertDistinctHomeyEnumCapabilityOptionIds({
				type: 'enum',
				values: [
					{ id: '[~7~]', title: '[~2~]' },
					{ id: '[~7~]', title: '[~2~]' },
				],
			}),
		).toThrow('redacted, or duplicate enum option IDs');
	});

	it('derives the live enum evidence gap from the sanitized inventory', () => {
		expect(deriveKnownMetadataGaps({ device: { capabilitiesObj: {} } })).toEqual(['live_enum_option_ids']);
		expect(
			deriveKnownMetadataGaps({
				device: { capabilitiesObj: {}, ui: { type: 'enum', values: [{ id: 'ui-only' }] } },
			}),
		).toEqual(['live_enum_option_ids']);
		expect(
			deriveKnownMetadataGaps({
				device: { capabilitiesObj: { mode: { type: 'enum', values: [{ id: 'home' }, { id: 'away' }] } } },
			}),
		).toEqual([]);
		expect(() =>
			assertDistinctHomeyEnumOptionIds({
				device: {
					capabilitiesObj: {},
					ui: { type: 'enum', values: [{ id: '[~7~]' }, { id: '[~7~]' }] },
				},
			}),
		).not.toThrow();
	});

	it('derives tracked capability gaps from the full captured inventory', () => {
		expect(
			deriveKnownCoverageGaps({
				first: { capabilities: ['target_temperature', 'alarm_contact.front'] },
				second: { capabilities: ['measure_co2'] },
			}),
		).toEqual(['alarm_smoke', 'alarm_co', 'windowcoverings_tilt_set', 'measure_pressure']);
	});

	it('records lock-class evidence separately from child-lock capabilities', () => {
		expect(deriveKnownDeviceClassGaps({ fan: { class: 'fan', capabilities: ['locked.child'] } })).toEqual(['lock']);
		expect(deriveKnownDeviceClassGaps({ lock: { class: 'lock', capabilities: ['locked'] } })).toEqual([]);
	});

	it('resolves numeric fixture ports for explicit and default origins', () => {
		expect(resolveHomeyTransportPort('http', 'default')).toBe(80);
		expect(resolveHomeyTransportPort('https', '')).toBe(443);
		expect(resolveHomeyTransportPort('http', '4859')).toBe(4859);
		expect(() => resolveHomeyTransportPort('http', 'invalid')).toThrow('must be an integer');
		for (const invalidPort of ['0x50', '1e2', '+80', '80.0']) {
			expect(() => resolveHomeyTransportPort('http', invalidPort)).toThrow('must be an integer');
		}
	});

	it('rejects unredacted source locale and human timestamp metadata', () => {
		const capture: HomeyShsCapture = {
			metadata: {},
			systemInfo: { dateHuman: 'Private capture date', country: 'Private country', timezone: 'Private/timezone' },
			zones: {},
			devices: {},
		};

		expect(() => assertHomeyCaptureSafe(capture, [])).toThrow('unredacted metadata, icons, or host fingerprint');

		capture.systemInfo = sanitizeHomeyPublishedMetadata({
			dateHuman: 'Private capture date',
			country: 'Private country',
			timezone: 'Private/timezone',
		});

		expect(() => assertHomeyCaptureSafe(capture, [])).not.toThrow();

		capture.systemInfo = {};
		capture.devices = { 'device-000001': { country: 'Private country' } };

		expect(() => assertHomeyCaptureSafe(capture, [])).toThrow('unredacted metadata, icons, or host fingerprint');
	});

	it('redacts and rejects household zone icon semantics', () => {
		const zones = sanitizeHomeyZones({
			'private-zone': { id: 'private-zone', name: 'Private room', icon: 'private-room-kind' },
		});
		const sanitizedCapture: HomeyShsCapture = { metadata: {}, systemInfo: {}, zones, devices: {} };

		expect(zones['zone-000001']).toMatchObject({ icon: '[~2~]' });
		expect(() => assertHomeyCaptureSafe(sanitizedCapture, [])).not.toThrow();
		expect(() =>
			assertHomeyCaptureSafe({ ...sanitizedCapture, zones: { 'zone-000001': { icon: null } } }, []),
		).not.toThrow();
		expect(() =>
			assertHomeyCaptureSafe({ ...sanitizedCapture, zones: { 'zone-000001': { icon: 'private-room-kind' } } }, []),
		).toThrow('unredacted metadata, icons, or host fingerprint');
	});

	it('redacts device icons and source host fingerprints', () => {
		const devices = sanitizeHomeyDevices({
			'private-device': {
				id: 'private-device',
				name: 'Private device',
				icon: 'private-device-icon',
				iconOverride: 'private-assignment-icon',
			},
		});
		const systemInfo = sanitizeHomeyPublishedMetadata(
			{
				nodeVersion: 'private-version',
				platform: 'private-platform',
				totalmem: 123,
				freemem: 45,
				uptime: 67,
				loadavg: [1, 2, 3],
				cpus: [{ model: 'private-cpu', speed: 123, times: { user: 1 } }],
			},
			{ redactSystemFingerprint: true },
		);
		const capture: HomeyShsCapture = { metadata: {}, systemInfo, zones: {}, devices };

		expect(devices['device-000001']).toMatchObject({ icon: '[~2~]', iconOverride: '[~2~]' });
		expect(systemInfo).toMatchObject({
			nodeVersion: '[~7~]',
			platform: '[~7~]',
			totalmem: 0,
			freemem: 0,
			uptime: 0,
			loadavg: [0, 0, 0],
		});
		expect(() => assertHomeyCaptureSafe(capture, [])).not.toThrow();
		expect(() =>
			assertHomeyCaptureSafe({ ...capture, devices: { 'device-000001': { icon: null, iconOverride: null } } }, []),
		).not.toThrow();

		capture.devices = { 'device-000001': { icon: 'private-device-icon' } };

		expect(() => assertHomeyCaptureSafe(capture, [])).toThrow('unredacted metadata, icons, or host fingerprint');

		capture.devices = devices;
		capture.systemInfo = { totalmem: 123 };

		expect(() => assertHomeyCaptureSafe(capture, [])).toThrow('unredacted metadata, icons, or host fingerprint');
	});

	it('preserves capability bases while rejecting private raw suffixes', () => {
		const capture: HomeyShsCapture = {
			metadata: {},
			systemInfo: {},
			zones: {},
			devices: {},
			individualDevice: {
				id: 'device-000001',
				name: 'device-label-000001',
				capabilities: ['homealarm_state', 'measure_temperature.capability-suffix-000001'],
				capabilitiesObj: {
					homealarm_state: { id: 'homealarm_state', value: false },
					'measure_temperature.capability-suffix-000001': {
						id: 'measure_temperature.capability-suffix-000001',
						value: 21,
					},
				},
			},
		};

		expect(() => assertHomeyCaptureSafe(capture, [], ['home'])).not.toThrow();
		expect(() => assertHomeyCaptureRedacted(capture)).not.toThrow();

		(capture.individualDevice as { capabilities: string[] }).capabilities[1] = 'measure_temperature.kids_room';

		expect(() => assertHomeyCaptureSafe(capture, [], ['kids_room'])).toThrow('private term');
		expect(() => assertHomeyCaptureRedacted(capture)).toThrow('unredacted sensitive field');
	});

	it('pseudonymizes private custom capability bases consistently', () => {
		const devices = sanitizeHomeyDevices(
			{
				'private-device': {
					id: 'private-device',
					name: 'Private device',
					capabilities: ['kids_room_temperature', 'measure_temperature.kids_room', 'homealarm_state'],
					capabilitiesObj: {
						kids_room_temperature: { id: 'kids_room_temperature', value: 21 },
						'measure_temperature.kids_room': {
							id: 'measure_temperature.kids_room',
							value: 21,
						},
						homealarm_state: { id: 'homealarm_state', value: false },
					},
					ui: {
						quickAction: 'measure_temperature.kids_room',
						uiIndicator: 'measure_temperature.kids_room',
						components: [{ capabilities: ['measure_temperature.kids_room'] }],
					},
					energy: { cumulativeExportedCapability: 'measure_temperature.kids_room' },
				},
			},
			['kids_room', 'home'],
		);
		const device = devices['device-000001'] as {
			capabilities: string[];
			capabilitiesObj: Record<string, { id: string }>;
			energy: { cumulativeExportedCapability: string };
			ui: {
				quickAction: string;
				uiIndicator: string;
				components: Array<{ capabilities: string[] }>;
			};
		};
		const privateAlias = 'capability-base-000001';
		const suffixedAlias = 'measure_temperature.capability-suffix-000001';

		expect(device.capabilities).toEqual([privateAlias, suffixedAlias, 'homealarm_state']);
		expect(device.capabilitiesObj[privateAlias]?.id).toBe(privateAlias);
		expect(device.capabilitiesObj[suffixedAlias]?.id).toBe(suffixedAlias);
		expect(device.ui.quickAction).toBe(suffixedAlias);
		expect(device.ui.uiIndicator).toBe(suffixedAlias);
		expect(device.ui.components[0].capabilities).toEqual([suffixedAlias]);
		expect(device.energy.cumulativeExportedCapability).toBe(suffixedAlias);
		expect(JSON.stringify(device)).not.toContain('kids_room');
		expect(() =>
			assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices }, [], ['kids_room', 'home']),
		).not.toThrow();
		expect(() => assertHomeyCaptureRedacted({ metadata: {}, systemInfo: {}, zones: {}, devices })).not.toThrow();

		const temperatureDevices = sanitizeHomeyDevices(
			{
				'private-device': {
					id: 'private-device',
					name: 'Private device',
					capabilities: ['measure_temperature'],
					capabilitiesObj: { measure_temperature: { id: 'measure_temperature', value: 21 } },
				},
			},
			['temperature'],
		);

		expect((temperatureDevices['device-000001'] as { capabilities: string[] }).capabilities).toEqual([
			'measure_temperature',
		]);
	});

	it('rewrites capability references without changing equal ordinary state values', () => {
		const sourceIdentifier = 'measure_temperature.room';
		const devices = sanitizeHomeyDevices({
			'private-device': {
				id: 'private-device',
				name: 'Private device',
				capabilities: [sourceIdentifier, 'status_text'],
				capabilitiesObj: {
					[sourceIdentifier]: { id: sourceIdentifier, value: 21 },
					status_text: { id: 'status_text', type: 'string', value: sourceIdentifier },
				},
				ui: { quickAction: sourceIdentifier },
			},
		});
		const device = devices['device-000001'] as {
			capabilitiesObj: Record<string, { value: unknown }>;
			ui: { quickAction: string };
		};
		const alias = 'measure_temperature.capability-suffix-000001';

		expect(device.ui.quickAction).toBe(alias);
		expect(device.capabilitiesObj.status_text.value).toBe(sourceIdentifier);
	});

	it('accepts declared public capability references that overlap private terms', () => {
		const devices = sanitizeHomeyDevices(
			{
				'private-device': {
					id: 'private-device',
					name: 'Private device',
					capabilities: ['measure_temperature'],
					capabilitiesObj: { measure_temperature: { id: 'measure_temperature', value: 21 } },
					ui: { uiIndicator: 'measure_temperature' },
				},
			},
			['temperature'],
		);

		expect(() =>
			assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices }, [], ['temperature']),
		).not.toThrow();
	});

	it('pseudonymizes distinct enum option IDs and remaps the current value', () => {
		const devices = sanitizeHomeyDevices(
			{
				'private-device': {
					id: 'private-device',
					name: 'Private device',
					capabilities: ['private_mode', 'status_text'],
					capabilitiesObj: {
						private_mode: {
							id: 'private_mode',
							type: 'enum',
							value: 'home',
							values: [
								{ id: 'home', title: 'At home' },
								{ id: 'away', title: 'Away' },
							],
						},
						status_text: {
							id: 'status_text',
							type: 'string',
							value: 'away',
						},
					},
				},
			},
			['home'],
		);
		const device = devices['device-000001'] as {
			capabilitiesObj: {
				private_mode: { value: string; values: Array<{ id: string; title: string }> };
				status_text: { value: string };
			};
		};
		const capability = device.capabilitiesObj.private_mode;
		const values = capability.values;

		expect(values.map(({ id }) => id)).toEqual(['enum-option-000001', 'enum-option-000002']);
		expect(values.map(({ title }) => title)).toEqual(['[~2~]', '[~2~]']);
		expect(capability.value).toBe('enum-option-000001');
		expect(device.capabilitiesObj.status_text.value).toBe('away');
		expect(() =>
			assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices }, [], ['home']),
		).not.toThrow();
	});

	it('requires pseudonymized enum values when option metadata is absent', () => {
		const devices = sanitizeHomeyDevices({
			'private-device': {
				id: 'private-device',
				name: 'Private device',
				capabilities: ['private_mode'],
				capabilitiesObj: {
					private_mode: { id: 'private_mode', type: 'enum', value: 'Kids Room' },
				},
			},
		});
		const sanitizedValue = (devices['device-000001'] as { capabilitiesObj: { private_mode: { value: string } } })
			.capabilitiesObj.private_mode.value;

		expect(sanitizedValue).toBe('enum-option-000001');
		expect(() => assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices }, [])).not.toThrow();
		expect(() =>
			assertHomeyCaptureRedacted({
				metadata: {},
				systemInfo: {},
				zones: {},
				devices: {
					device: {
						capabilitiesObj: {
							private_mode: { type: 'enum', value: 'Kids Room' },
						},
					},
				},
			}),
		).toThrow('unredacted sensitive field');
	});

	it('preserves recognized public enum states without exposing unknown states', () => {
		const devices = sanitizeHomeyDevices({
			'cover-device': {
				id: 'cover-device',
				name: 'Cover device',
				capabilities: ['windowcoverings_state'],
				capabilitiesObj: {
					windowcoverings_state: { id: 'windowcoverings_state', type: 'enum', value: 'down' },
				},
			},
			'private-device': {
				id: 'private-device',
				name: 'Private device',
				capabilities: ['private_mode'],
				capabilitiesObj: {
					private_mode: { id: 'private_mode', type: 'enum', value: 'Kids Room' },
				},
			},
		});
		const publicState = (devices['device-000001'] as { capabilitiesObj: { windowcoverings_state: { value: string } } })
			.capabilitiesObj.windowcoverings_state.value;
		const unknownState = (devices['device-000002'] as { capabilitiesObj: { private_mode: { value: string } } })
			.capabilitiesObj.private_mode.value;

		expect(publicState).toBe('down');
		expect(unknownState).toMatch(/^enum-option-\d{6}$/);
		expect(() => assertHomeyCaptureRedacted({ metadata: {}, systemInfo: {}, zones: {}, devices })).not.toThrow();
	});

	it('exempts recognized public enum states from overlapping private-term scans', () => {
		const devices = sanitizeHomeyDevices(
			{
				'light-device': {
					id: 'light-device',
					name: 'Light device',
					capabilities: ['light_mode'],
					capabilitiesObj: {
						light_mode: {
							id: 'light_mode',
							type: 'enum',
							value: 'color',
							values: [{ id: 'color', title: 'Color' }],
						},
					},
				},
			},
			['color'],
		);
		const lightMode = (
			devices['device-000001'] as {
				capabilitiesObj: { light_mode: { value: string; values: Array<{ id: string; title: string }> } };
			}
		).capabilitiesObj.light_mode;

		expect(lightMode.value).toBe('color');
		expect(lightMode.values).toEqual([{ id: 'color', title: '[~2~]' }]);
		expect(() =>
			assertHomeyCaptureSafe({ metadata: {}, systemInfo: {}, zones: {}, devices }, [], ['color']),
		).not.toThrow();
	});

	it('reuses an identical fixture version after an interrupted publication', async () => {
		const outputRoot = await mkdtemp(resolve(tmpdir(), 'homey-fixture-publication-'));
		const versionName = 'capture-000001';

		try {
			await mkdir(resolve(outputRoot, 'versions'), { recursive: true });
			const firstStagingRoot = resolve(outputRoot, 'versions/first');

			await mkdir(firstStagingRoot);
			await writeFile(resolve(firstStagingRoot, 'manifest.json'), '{"schemaVersion":1}\n');
			await publishHomeyFixtureCorpus(outputRoot, firstStagingRoot, versionName);
			await rm(resolve(outputRoot, 'current'));

			const retryStagingRoot = resolve(outputRoot, 'versions/retry');

			await mkdir(retryStagingRoot);
			await writeFile(resolve(retryStagingRoot, 'manifest.json'), '{"schemaVersion":1}\n');
			await publishHomeyFixtureCorpus(outputRoot, retryStagingRoot, versionName);

			expect(await readlink(resolve(outputRoot, 'current'))).toBe(`versions/${versionName}`);
			expect(readFileSync(resolve(outputRoot, 'current/manifest.json'), 'utf8')).toBe('{"schemaVersion":1}\n');

			const conflictingStagingRoot = resolve(outputRoot, 'versions/conflict');

			await mkdir(conflictingStagingRoot);
			await writeFile(resolve(conflictingStagingRoot, 'manifest.json'), '{"schemaVersion":2}\n');
			await expect(publishHomeyFixtureCorpus(outputRoot, conflictingStagingRoot, versionName)).rejects.toThrow(
				'already exists with different content',
			);
		} finally {
			await rm(outputRoot, { force: true, recursive: true });
		}
	});

	it('redacts structured personal labels as whole values', () => {
		const devices = sanitizeHomeyDevices(
			{
				'private-device': {
					id: 'private-device',
					name: 'Private device',
					capabilities: ['private_mode'],
					capabilitiesObj: {
						private_mode: {
							id: 'private_mode',
							type: 'enum',
							values: [{ id: 'mode', title: { en: 'Kids Room' } }],
						},
					},
				},
			},
			['Kids Room'],
		);
		const serialized = JSON.stringify(devices);

		expect(serialized).not.toContain('Kids Room');
		expect(serialized).not.toContain('"en"');
		expect(serialized).toContain('"title":"[~2~]"');
		expect(() => assertHomeyCaptureRedacted({ metadata: {}, systemInfo: {}, zones: {}, devices })).not.toThrow();
	});

	it('sanitizes source metadata recursively without changing unrelated values', () => {
		expect(
			sanitizeHomeyPublishedMetadata(
				{ nested: { dateHuman: 'Private date', timezone: 'Private/timezone', icon: 'private-room-kind' } },
				{ redactZoneIcons: true },
			),
		).toEqual({
			nested: {
				dateHuman: '2000-01-01T00:00:00.000Z',
				timezone: '[~2~]',
				icon: '[~2~]',
			},
		});
	});

	it('requires a complete valid ISO timestamp for fixture provenance', () => {
		const metadata = {
			capturedAt: '2026-08-13T18:18:49.593Z',
			homey: { version: '13.4.0' },
			transport: { protocol: 'http', port: 4859 },
		};

		expect(buildHomeyFixtureProvenance(metadata)).toMatchObject({ captureDate: '2026-08-13' });

		for (const capturedAt of ['2026-99-99Tgarbage', '2026-08-13T18:18:49.593Ztrailing', 'not-a-date']) {
			expect(() => buildHomeyFixtureProvenance({ ...metadata, capturedAt })).toThrow('invalid fixture provenance');
		}

		for (const version of ['', 'unknown', '[~7~]', '13.4']) {
			expect(() => buildHomeyFixtureProvenance({ ...metadata, homey: { version } })).toThrow(
				'invalid fixture provenance',
			);
		}

		expect(buildHomeyFixtureProvenance({ ...metadata, homey: { version: '13.4.0-rc.1+build.2' } })).toMatchObject({
			homeyVersion: '13.4.0-rc.1+build.2',
		});
	});

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
						updateinterval: 60,
						map_rotation: 90,
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
				pin: 0,
				passcode: 0,
				access_code: 0,
				updateinterval: 0,
				map_rotation: 0,
			},
			data: {
				node: 0,
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
		expect(serialized).toContain('measure_temperature.capability-suffix-000001');
		expect(serialized).not.toContain('measure_temperature.inside');
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
			networkPath: '//broker.private/api',
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
			dateHuman: 'Wed Aug 12 2026 20:15:30 GMT+0200',
			country: 'Private Country',
			language: 'Private Language',
			timezone: 'Private/Timezone',
		});
		const collisionSafeDevices = sanitizeHomeyDevices({
			'DEVICE-000001': { id: 'DEVICE-000001', name: 'DEVICE-LABEL-000001' },
		});
		const genericIdentifierMap = sanitizeHomeyPayload(
			{
				aliases: { 'opaque-user-id': true, 'p-000001': false },
				mappings: { 'another-opaque-user-id': true },
			},
			['000001'],
		) as { aliases: Record<string, boolean>; mappings: Record<string, boolean> };

		expect(sanitized).toEqual({
			title: '[~2~]',
			accountId: '[~7~]',
			hardware_id: '[~7~]',
			serialNumber: 0,
			deviceId: 0,
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
			networkPath: '[~5~]',
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
			lastModified: 0,
			customActivityField: '2000-01-01T00:00:00.000Z',
			dateHuman: '2000-01-01T00:00:00.000Z',
			country: '[~2~]',
			language: '[~2~]',
			timezone: '[~2~]',
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
		expect(Object.keys(genericIdentifierMap.aliases).every((key) => /^id-/.test(key))).toBe(true);
		expect(Object.keys(genericIdentifierMap.mappings).every((key) => /^id-/.test(key))).toBe(true);
		expect(JSON.stringify(genericIdentifierMap)).not.toContain('opaque-user-id');
		expect(JSON.stringify(genericIdentifierMap)).not.toContain('another-opaque-user-id');
		expect(JSON.stringify(genericIdentifierMap)).not.toContain('p-000001');
		const blockedNeutralPrefixDevices = sanitizeHomeyDevices(
			{
				'private-device-id': { id: 'private-device-id', name: 'Private source' },
			},
			['device', ...Array.from({ length: 10 }, (_, digit) => `p-${digit}`)],
		);

		expect(Object.keys(blockedNeutralPrefixDevices)[0]).toMatch(/^q-/);
		expect((Object.values(blockedNeutralPrefixDevices)[0] as { name: string }).name).toMatch(/^q-/);
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

			if (url.endsWith('/api/manager/devices/device/private-device-id/capability/onoff')) {
				return Promise.resolve(jsonResponse({ value: false }));
			}

			const device = {
				id: 'private-device-id',
				name: 'Private Device',
				capabilities: ['onoff'],
				capabilitiesObj: { onoff: { id: 'onoff', value: false, getable: true } },
			};

			if (url.endsWith('/api/manager/devices/device/private-device-id')) {
				return Promise.resolve(jsonResponse(device));
			}

			return Promise.resolve(
				jsonResponse({
					'private-device-id': device,
				}),
			);
		});

		const capture = await captureHomeyShs(config, fetchMock as typeof fetch);

		expect(calls).toHaveLength(6);
		expect(new Headers(calls[0].init?.headers).has('authorization')).toBe(false);

		for (const call of calls.slice(1)) {
			expect(call.init?.method).toBe('GET');
			expect(call.init?.redirect).toBe('error');
			expect(new Headers(call.init?.headers).get('authorization')).toBe(`Bearer ${config.apiKey}`);
		}

		assertHomeyCaptureRedacted(capture);
		assertHomeyCaptureSafe(capture, [config.apiKey], config.privateTerms, config.expectedHost);
		expect(capture.individualDevice).toMatchObject({ id: 'device-000001', name: 'device-label-000001' });
		expect(capture.capabilityValue).toEqual({
			deviceId: 'device-000001',
			capabilityId: 'onoff',
			response: { value: false },
		});

		const hostCollisionConfig = createConfig({
			FB_HOMEY_SHS_URL: 'http://homey-000001:4859',
			FB_HOMEY_SHS_EXPECTED_HOST: 'homey-000001',
		});
		const hostCollisionCapture = await captureHomeyShs(hostCollisionConfig, fetchMock as typeof fetch);

		assertHomeyCaptureRedacted(hostCollisionCapture);
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

	it('rejects missing or mismatched raw individual-device identities', async () => {
		const createIdentityFetch = (individualDevice: Record<string, unknown>) =>
			jest.fn((input: URL | RequestInfo): Promise<Response> => {
				const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
				const inventoryDevice = {
					id: 'private-device-id',
					name: 'Private Device',
					capabilities: ['onoff'],
					capabilitiesObj: { onoff: { id: 'onoff', value: false, getable: true } },
				};

				if (url.endsWith('/api/manager/system/ping')) {
					return Promise.resolve(jsonResponse({}, 200, { 'x-homey-id': 'private-homey-id' }));
				}

				if (url.endsWith('/api/manager/system/')) {
					return Promise.resolve(jsonResponse({}));
				}

				if (url.endsWith('/api/manager/zones/zone')) {
					return Promise.resolve(jsonResponse({}));
				}

				if (url.endsWith('/api/manager/devices/device/private-device-id/capability/onoff')) {
					return Promise.resolve(jsonResponse({ value: false }));
				}

				if (url.endsWith('/api/manager/devices/device/private-device-id')) {
					return Promise.resolve(jsonResponse(individualDevice));
				}

				return Promise.resolve(jsonResponse({ 'private-device-id': inventoryDevice }));
			});

		for (const individualDevice of [{ name: 'Missing ID' }, { id: 'different-device-id' }]) {
			await expect(
				captureHomeyShs(createConfig(), createIdentityFetch(individualDevice) as typeof fetch),
			).rejects.toThrow('response identity did not match');
		}
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

		capture.systemInfo = { description: 'homey' };

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
					metadata: { schemaVersion: 1, homey: { id: 'p-000003' } },
					systemInfo: {},
					zones: { 'zone-000001': { id: 'zone-000001', name: 'zone-label-000001' } },
					devices: {
						'p-000001': {
							id: 'p-000001',
							name: 'p-000002',
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

	it('rejects sanitizer-sensitive fields that were not redacted before promotion', () => {
		const aliases = createSanitizationAliases();
		const capture: HomeyShsCapture = {
			metadata: {},
			systemInfo: sanitizeHomeyPayload({ hostname: 'private-host', password: 'hunter2', serial: 'ABC123' }),
			zones: sanitizeHomeyZones(
				{ 'private-zone': { id: 'private-zone', name: 'Private zone', parent: null } },
				[],
				aliases,
			),
			devices: sanitizeHomeyDevices(
				{
					'private-device': {
						id: 'private-device',
						name: 'Private device',
						zone: 'private-zone',
						settings: { hostname: 'private-host', password: 'hunter2', serial: 'ABC123' },
					},
				},
				[],
				aliases,
			),
		};

		expect(() => assertHomeyCaptureRedacted(capture)).not.toThrow();

		for (const [key, value] of [
			['password', 'hunter2'],
			['hostname', 'private-host'],
			['serial', 'ABC123'],
		] as const) {
			expect(() => assertHomeyCaptureRedacted({ ...capture, systemInfo: { [key]: value } })).toThrow(
				'unredacted sensitive field',
			);
		}

		expect(() =>
			assertHomeyCaptureRedacted({
				...capture,
				devices: {
					'device-000001': {
						id: 'device-000001',
						name: 'device-label-000001',
						capabilities: ['last_seen'],
						capabilitiesObj: {
							last_seen: {
								id: 'last_seen',
								value: '2026-08-13T18:18:49.593Z',
							},
						},
					},
				},
			}),
		).toThrow('unredacted sensitive field');
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

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: homey-token, section: systemInfo)',
		);

		unsafeCapture.systemInfo = { leaked: 'prefix_hpat_abcdefghijklmnop1234' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { leaked: 'owner_alice@example.com_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: email, section: systemInfo)',
		);

		unsafeCapture.systemInfo = { leaked: 'prefix_https://user:pass@private-host.local/api' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret');

		unsafeCapture.systemInfo = { aliases: { 'https://user:pass@private-host.local/api': true } };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: url, section: systemInfo)',
		);

		unsafeCapture.systemInfo = { leaked: '//broker.private/api' };

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

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: ipv4, section: systemInfo)',
		);

		unsafeCapture.systemInfo = { diagnostic: 'mac_aa:bb:cc:dd:ee:ff_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: mac, section: systemInfo)',
		);

		unsafeCapture.systemInfo = { diagnostic: 'mac_aabb.ccdd.eeff_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'mac_AABBCCDDEEFF_backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'macaabbccddeeffbackup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow('still contains a secret, address');

		unsafeCapture.systemInfo = { diagnostic: 'deadfd12:3456:789a::1backup' };

		expect(() => assertHomeyCaptureSafe(unsafeCapture, [])).toThrow(
			'still contains a secret, address, or email-like value (category: ipv6, section: systemInfo)',
		);
	});

	it('does not report forbidden values in safe diagnostics or match across JSON token boundaries', () => {
		const crossTokenCapture: HomeyShsCapture = {
			metadata: {},
			systemInfo: { first: 'aa:bb:cc', second: 'dd:ee:ff' },
			zones: {},
			devices: {},
		};

		expect(() => assertHomeyCaptureSafe(crossTokenCapture, [])).not.toThrow();

		const unsafeValue = 'owner_alice@example.com';
		crossTokenCapture.devices = { leaked: unsafeValue };

		try {
			assertHomeyCaptureSafe(crossTokenCapture, []);
			throw new Error('Expected capture safety validation to fail');
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain('category: email, section: devices');
			expect((error as Error).message).not.toContain(unsafeValue);
		}
	});
});
