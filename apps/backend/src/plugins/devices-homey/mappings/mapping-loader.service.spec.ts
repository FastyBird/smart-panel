import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { HomeyCapabilityType, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';

import { HomeyMappingConfigurationError } from './homey-mapping.error';
import { HomeyMappingLoaderService } from './mapping-loader.service';
import { HOMEY_MAPPING_FILE_NAMES, HOMEY_USER_MAPPING_FILE_NAMES } from './mapping.constants';
import { HomeyMappingKind } from './mapping.types';

const emptyConfig = (kind: HomeyMappingKind) => ({ version: 1, kind, mappings: [] });

const deviceDefinition = (overrides: Record<string, unknown> = {}) => ({
	name: 'sensor-device',
	priority: 100,
	match: {
		classes: ['sensor'],
		all_capabilities: ['measure_temperature'],
	},
	device: { category: 'sensor' },
	...overrides,
});

const channelDefinition = (overrides: Record<string, unknown> = {}) => ({
	name: 'temperature-channel',
	priority: 100,
	match: {
		classes: ['sensor'],
		all_capabilities: ['measure_temperature'],
	},
	channel: { identifier: 'temperature', category: 'temperature' },
	...overrides,
});

const propertyDefinition = (overrides: Record<string, unknown> = {}) => ({
	name: 'measured-temperature',
	priority: 100,
	match: {
		classes: ['sensor'],
		capability_base_ids: ['measure_temperature'],
	},
	property: {
		channel: 'temperature',
		category: 'temperature',
		data_type: 'float',
		direction: 'read_only',
		unit: '°C',
		range: { minimum: -50, maximum: 100, step: 0.1 },
		transform: {
			type: 'round',
			precision: 1,
		},
	},
	...overrides,
});

const createCapability = (id: string, value: number) =>
	createHomeyCapability({
		id,
		title: id,
		value,
		type: HomeyCapabilityType.NUMBER,
		unit: '°C',
		minimum: -50,
		maximum: 100,
		step: 0.1,
		enumValues: [],
		readable: true,
		writable: false,
		available: true,
		lastUpdatedAt: null,
	});

const createDevice = (overrides: Partial<HomeyDevice> = {}): HomeyDevice => ({
	id: 'homey-device-1',
	name: 'Synthetic sensor',
	class: 'sensor',
	zoneId: null,
	zoneName: null,
	zonePath: [],
	available: true,
	availabilityMessage: null,
	driverId: 'homey:app:test:driver:synthetic',
	manufacturer: 'Synthetic vendor',
	model: 'Synthetic model',
	energy: null,
	capabilities: [
		createCapability('measure_temperature.inside', 21.5),
		createCapability('measure_temperature.outside', 12.25),
	],
	...overrides,
});

describe('HomeyMappingLoaderService', () => {
	let rootPath: string;
	let builtinMappingsPath: string;
	let userDataPath: string;
	let service: HomeyMappingLoaderService;

	const writeConfig = (path: string, config: unknown): void => {
		writeFileSync(path, stringifyYaml(config));
	};

	const writeBuiltin = (kind: HomeyMappingKind, mappings: unknown[]): void => {
		writeConfig(join(builtinMappingsPath, HOMEY_MAPPING_FILE_NAMES[kind]), { version: 1, kind, mappings });
	};

	const writeUser = (kind: HomeyMappingKind, mappings: unknown[]): void => {
		writeConfig(join(userDataPath, HOMEY_USER_MAPPING_FILE_NAMES[kind]), { version: 1, kind, mappings });
	};

	const createService = (): HomeyMappingLoaderService =>
		new HomeyMappingLoaderService({
			builtinMappingsPath,
			userDataPath,
			schemaPath: join(__dirname, 'schema', 'mapping-schema.json'),
		});

	beforeEach(() => {
		rootPath = mkdtempSync(join(tmpdir(), 'homey-mappings-'));
		builtinMappingsPath = join(rootPath, 'builtin');
		userDataPath = join(rootPath, 'user');
		mkdirSync(builtinMappingsPath);
		mkdirSync(userDataPath);

		for (const kind of ['devices', 'channels', 'properties'] as const) {
			writeConfig(join(builtinMappingsPath, HOMEY_MAPPING_FILE_NAMES[kind]), emptyConfig(kind));
		}

		service = createService();
	});

	afterEach(() => {
		rmSync(rootPath, { recursive: true, force: true });
	});

	it('loads strict device, channel, and property descriptors', () => {
		writeBuiltin('devices', [deviceDefinition()]);
		writeBuiltin('channels', [channelDefinition()]);
		writeBuiltin('properties', [propertyDefinition()]);

		service.loadAllMappings();

		expect(service.getDeviceMappings()).toHaveLength(1);
		expect(service.getChannelMappings()).toHaveLength(1);
		expect(service.getPropertyMappings()).toHaveLength(1);
		expect(service.getDeviceMappings()[0]).toMatchObject({
			name: 'sensor-device',
			deviceCategory: DeviceCategory.SENSOR,
			priority: 100,
			exclusive: false,
			conflict: 'error',
		});
	});

	it('matches suffixed capabilities by base ID and selects one full ID deterministically', () => {
		writeBuiltin('properties', [propertyDefinition()]);
		service.loadAllMappings();

		const resolution = service.resolvePropertyMappings(createDevice());

		expect(resolution.conflicts).toEqual([]);
		expect(resolution.mappings.map((binding) => binding.capabilityBaseId)).toEqual(['measure_temperature']);
		expect(resolution.mappings.map((binding) => binding.capabilityId)).toEqual(['measure_temperature.inside']);
	});

	it('prefers the unsuffixed primary capability over repeated instances', () => {
		writeBuiltin('properties', [propertyDefinition()]);
		service.loadAllMappings();

		const resolution = service.resolvePropertyMappings(
			createDevice({
				capabilities: [
					createCapability('measure_temperature.suffix', 18),
					createCapability('measure_temperature', 21.5),
				],
			}),
		);

		expect(resolution.mappings.map((binding) => binding.capabilityId)).toEqual(['measure_temperature']);
	});

	it('replaces a built-in descriptor with a same-name user override', () => {
		writeBuiltin('devices', [deviceDefinition({ priority: 500 })]);
		writeUser('devices', [
			deviceDefinition({
				priority: 5,
				device: { category: 'thermostat' },
			}),
		]);

		service.loadAllMappings();

		expect(service.getDeviceMappings()).toHaveLength(1);
		expect(service.getDeviceMappings()[0]).toMatchObject({
			name: 'sensor-device',
			source: 'user',
			priority: 5,
			deviceCategory: DeviceCategory.THERMOSTAT,
		});
	});

	it('orders added user mappings deterministically by priority, source, and name', () => {
		writeBuiltin('devices', [deviceDefinition({ name: 'zeta', priority: 10 })]);
		writeUser('devices', [
			deviceDefinition({ name: 'beta', priority: 10 }),
			deviceDefinition({ name: 'alpha', priority: 10 }),
			deviceDefinition({ name: 'highest', priority: 20 }),
		]);

		service.loadAllMappings();

		expect(service.getDeviceMappings().map((mapping) => mapping.name)).toEqual(['highest', 'alpha', 'beta', 'zeta']);
	});

	it('isolates an invalid user file and retains valid built-ins', () => {
		writeBuiltin('devices', [deviceDefinition()]);
		writeConfig(join(userDataPath, HOMEY_USER_MAPPING_FILE_NAMES.devices), {
			version: 1,
			kind: 'devices',
			mappings: [{ ...deviceDefinition(), unexpected: true }],
		});

		service.loadAllMappings();

		expect(service.getDeviceMappings()).toHaveLength(1);
		expect(service.getDeviceMappings()[0]?.source).toBe('builtin');
		expect(service.getLoadResults()).toEqual(
			expect.arrayContaining([expect.objectContaining({ source: 'user', kind: 'devices', success: false })]),
		);
	});

	it('fails plugin initialization for an invalid built-in file', () => {
		writeBuiltin('devices', [{ ...deviceDefinition(), unexpected: true }]);

		expect(() => service.onModuleInit()).toThrow(HomeyMappingConfigurationError);
	});

	it('fails plugin initialization when a required built-in file is missing', () => {
		unlinkSync(join(builtinMappingsPath, HOMEY_MAPPING_FILE_NAMES.channels));

		try {
			service.onModuleInit();
			throw new Error('Expected the missing built-in file to fail');
		} catch (error) {
			expect(error).toBeInstanceOf(HomeyMappingConfigurationError);
			expect((error as HomeyMappingConfigurationError).issues).toEqual(['Mapping file does not exist']);
		}
	});

	it('rejects a mapping symlink that escapes the allowed directory', () => {
		const externalPath = join(rootPath, 'external.yaml');
		const linkPath = join(userDataPath, HOMEY_USER_MAPPING_FILE_NAMES.devices);
		writeConfig(externalPath, { version: 1, kind: 'devices', mappings: [deviceDefinition()] });
		symlinkSync(externalPath, linkPath);

		const result = service.loadMappingFile(linkPath, 'user', 'devices', userDataPath);

		expect(result).toMatchObject({ success: false, errors: ['Mapping path is outside its allowed directory'] });
	});

	it('rejects duplicate names within one file', () => {
		writeBuiltin('devices', [deviceDefinition(), deviceDefinition()]);

		try {
			service.loadAllMappings();
			throw new Error('Expected duplicate mapping names to fail');
		} catch (error) {
			expect(error).toBeInstanceOf(HomeyMappingConfigurationError);
			expect((error as HomeyMappingConfigurationError).issues).toContain("Duplicate mapping name 'sensor-device'");
		}
	});

	it('reports an error conflict instead of choosing an ambiguous mapping', () => {
		writeBuiltin('channels', [
			channelDefinition({ name: 'beta', conflict: 'error' }),
			channelDefinition({ name: 'alpha', conflict: 'warn' }),
		]);
		service.loadAllMappings();

		const resolution = service.resolveChannelMappings(createDevice());

		expect(resolution.mappings).toEqual([]);
		expect(resolution.conflicts).toEqual([
			{
				kind: 'channels',
				key: 'temperature',
				policy: 'error',
				mappings: ['alpha', 'beta'],
			},
		]);
	});

	it('selects a deterministic winner while retaining a warning conflict', () => {
		writeBuiltin('channels', [
			channelDefinition({ name: 'beta', conflict: 'warn' }),
			channelDefinition({ name: 'alpha', conflict: 'warn' }),
		]);
		service.loadAllMappings();

		const resolution = service.resolveChannelMappings(createDevice());

		expect(resolution.mappings.map((mapping) => mapping.name)).toEqual(['alpha']);
		expect(resolution.conflicts[0]).toMatchObject({ policy: 'warn', mappings: ['alpha', 'beta'] });
	});

	it('lets the highest-priority exclusive mapping suppress other channel targets', () => {
		writeBuiltin('channels', [
			channelDefinition({ name: 'exclusive', exclusive: true, priority: 200 }),
			channelDefinition({
				name: 'secondary',
				priority: 100,
				channel: { identifier: 'secondary', category: 'generic' },
			}),
		]);
		service.loadAllMappings();

		const resolution = service.resolveChannelMappings(createDevice());

		expect(resolution.mappings.map((mapping) => mapping.name)).toEqual(['exclusive']);
	});

	it('applies optional driver and manufacturer narrowing only when declared', () => {
		writeBuiltin('devices', [
			deviceDefinition({
				match: {
					classes: ['sensor'],
					all_capabilities: ['measure_temperature'],
					driver_ids: ['homey:app:test:driver:synthetic'],
					manufacturers: ['Synthetic vendor'],
				},
			}),
		]);
		service.loadAllMappings();

		expect(service.resolveDeviceMappings(createDevice()).mappings).toHaveLength(1);
		expect(service.resolveDeviceMappings(createDevice({ manufacturer: 'Different vendor' })).mappings).toHaveLength(0);
	});

	it('applies required and excluded device capability filters to property mappings', () => {
		writeBuiltin('properties', [
			propertyDefinition({
				match: {
					classes: ['sensor'],
					capability_base_ids: ['measure_temperature'],
					all_capabilities: ['measure_humidity'],
					none_capabilities: ['alarm_temperature'],
				},
			}),
		]);
		service.loadAllMappings();

		expect(service.resolvePropertyMappings(createDevice()).mappings).toHaveLength(0);
		expect(
			service.resolvePropertyMappings(
				createDevice({
					capabilities: [createCapability('measure_temperature', 21.5), createCapability('measure_humidity', 45)],
				}),
			).mappings,
		).toHaveLength(1);
		expect(
			service.resolvePropertyMappings(
				createDevice({
					capabilities: [
						createCapability('measure_temperature', 21.5),
						createCapability('measure_humidity', 45),
						createCapability('alarm_temperature', 0),
					],
				}),
			).mappings,
		).toHaveLength(0);
	});

	it('isolates semantically invalid ranges and transforms in user overrides', () => {
		writeBuiltin('properties', [propertyDefinition()]);
		writeUser('properties', [
			propertyDefinition({
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'float',
					direction: 'read_only',
					range: { minimum: 100, maximum: -50 },
					transform: { type: 'scale', input_range: [1, 1], output_range: [0, 100] },
				},
			}),
		]);

		service.loadAllMappings();

		expect(service.getPropertyMappings()).toHaveLength(1);
		expect(service.getPropertyMappings()[0]?.source).toBe('builtin');
		expect(service.getLoadResults().at(-1)).toMatchObject({ source: 'user', success: false });
	});

	it.each(['bidirectional', 'write_only'] as const)(
		'rejects a %s map transform without an explicit write table',
		(direction) => {
			writeBuiltin('properties', [
				propertyDefinition({
					property: {
						channel: 'temperature',
						category: 'temperature',
						data_type: 'float',
						direction,
						transform: { type: 'map', read: { cold: 0, warm: 1 } },
					},
				}),
			]);

			try {
				service.loadAllMappings();
				throw new Error('Expected writable map validation to fail');
			} catch (error) {
				expect(error).toBeInstanceOf(HomeyMappingConfigurationError);
				expect((error as HomeyMappingConfigurationError).issues).toContain(
					`Mapping 'measured-temperature' is invalid: map transform requires a write table for ${direction} direction`,
				);
			}
		},
	);

	it('accepts direction-complete map transforms', () => {
		writeBuiltin('properties', [
			propertyDefinition({
				name: 'read-map',
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'enum',
					direction: 'read_only',
					transform: { type: 'map', read: { cold: 0, warm: 1 } },
				},
			}),
			propertyDefinition({
				name: 'write-map',
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'enum',
					direction: 'write_only',
					transform: { type: 'map', write: { '0': 'cold', '1': 'warm' } },
				},
			}),
			propertyDefinition({
				name: 'bidirectional-map',
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'enum',
					direction: 'bidirectional',
					transform: {
						type: 'map',
						read: { cold: 0, warm: 1 },
						write: { '0': 'cold', '1': 'warm' },
					},
				},
			}),
		]);

		service.loadAllMappings();

		expect(service.getPropertyMappings().map((mapping) => mapping.name)).toEqual([
			'bidirectional-map',
			'read-map',
			'write-map',
		]);
	});

	it('accepts an explicit thermostat mode write strategy on a bidirectional boolean map', () => {
		writeBuiltin('properties', [
			propertyDefinition({
				match: {
					classes: ['thermostat'],
					capability_base_ids: ['thermostat_mode'],
				},
				property: {
					channel: 'heater',
					category: 'on',
					data_type: 'bool',
					direction: 'bidirectional',
					write_strategy: 'thermostat_heater_mode',
					transform: {
						type: 'map',
						read: { off: false, heat: true, cool: false, auto: true },
						write: { false: 'off', true: 'heat' },
					},
				},
			}),
		]);

		service.loadAllMappings();

		expect(service.getPropertyMappings()[0]?.property.writeStrategy).toBe('thermostat_heater_mode');
	});

	it('rejects a thermostat mode write strategy without a bidirectional boolean map', () => {
		writeBuiltin('properties', [
			propertyDefinition({
				property: {
					channel: 'heater',
					category: 'on',
					data_type: 'bool',
					direction: 'read_only',
					write_strategy: 'thermostat_heater_mode',
					transform: { type: 'map', read: { off: false, heat: true } },
				},
			}),
		]);

		expect(() => service.loadAllMappings()).toThrow(HomeyMappingConfigurationError);
	});

	it.each([
		{ type: 'constant', value: 'static' },
		{ type: 'threshold', threshold: 20, less_than_or_equal: 'low', greater_than: 'ok' },
		{ type: 'thresholds', thresholds: [{ minimum: 20, value: 'high' }], default: 'low' },
	])('rejects the read-derived $type transform on a writable property', (transform) => {
		writeBuiltin('properties', [
			propertyDefinition({
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'float',
					direction: 'bidirectional',
					transform,
				},
			}),
		]);

		expect(() => service.loadAllMappings()).toThrow(HomeyMappingConfigurationError);
	});

	it('rejects unordered multi-threshold transforms', () => {
		writeBuiltin('properties', [
			propertyDefinition({
				property: {
					channel: 'temperature',
					category: 'temperature',
					data_type: 'enum',
					direction: 'read_only',
					transform: {
						type: 'thresholds',
						thresholds: [
							{ minimum: 10, value: 'low' },
							{ minimum: 20, value: 'high' },
						],
						default: 'none',
					},
				},
			}),
		]);

		expect(() => service.loadAllMappings()).toThrow(HomeyMappingConfigurationError);
	});
});
