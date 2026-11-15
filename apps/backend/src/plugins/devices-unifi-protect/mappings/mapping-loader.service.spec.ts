/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';

import { ProtectMappingLoaderService } from './mapping-loader.service';
import { PROTECT_MAPPING_FILE_NAMES } from './mapping.constants';
import { ProtectMappingConfigurationError } from './protect-mapping.error';

type Definitions = { devices: any; channels: any; properties: any };
type Mutator = (definitions: Definitions) => void;

const file = (kind: string, mappings: unknown[]) => ({ version: 1, kind, mappings });

const property = (name: string, channel: string, identifier: string, category: string, extra: object = {}) => ({
	name,
	channel,
	property: { identifier, category },
	...extra,
});

const minimal = (): Definitions => ({
	devices: file('devices', [{ name: 'sensor', match: { model_key: 'sensor' }, device: { category: 'sensor' } }]),
	channels: file('channels', [
		{
			name: 'device_information',
			devices: ['sensor'],
			channel: { identifier: 'device_information', category: 'device_information', name: 'Device information' },
		},
		{
			name: 'temperature',
			devices: ['sensor'],
			when: [{ path: 'temperatureSettings.isEnabled', equals: true }],
			channel: { identifier: 'temperature', category: 'temperature', name: 'Temperature' },
		},
	]),
	properties: file('properties', [
		property('manufacturer', 'device_information', 'manufacturer', 'manufacturer', {
			value: { constant: 'Ubiquiti' },
		}),
		property('model', 'device_information', 'model', 'model', { value: { path: 'marketName' } }),
		property('serial_number', 'device_information', 'serial_number', 'serial_number', { value: { path: 'mac' } }),
		property('temperature', 'temperature', 'temperature', 'temperature', {
			value: { path: 'stats.temperature.value', transform: { type: 'round', precision: 1 } },
		}),
	]),
});

describe('ProtectMappingLoaderService', () => {
	const directories: string[] = [];

	const write = (definitions: Definitions): string => {
		const dir = mkdtempSync(join(tmpdir(), 'protect-mappings-'));
		directories.push(dir);
		mkdirSync(dir, { recursive: true });
		for (const kind of ['devices', 'channels', 'properties'] as const) {
			writeFileSync(join(dir, PROTECT_MAPPING_FILE_NAMES[kind]), stringifyYaml(definitions[kind]));
		}
		return dir;
	};

	const build = (mutate?: Mutator): ProtectMappingLoaderService => {
		const definitions = minimal();
		mutate?.(definitions);
		return new ProtectMappingLoaderService({ definitionsPath: write(definitions) });
	};

	const batteryChannel = () => ({
		name: 'battery',
		devices: ['sensor'],
		channel: { identifier: 'battery', category: 'battery', name: 'Battery' },
	});

	afterAll(() => {
		for (const dir of directories) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('loads a minimal valid set and takes property attributes from the spec', () => {
		const mappings = build().load();

		expect(mappings.devices.map((device) => device.name)).toEqual(['sensor']);
		expect(mappings.channels.map((channel) => channel.name)).toEqual(['device_information', 'temperature']);

		const temperature = mappings.properties.find((candidate) => candidate.name === 'temperature');
		expect(temperature).toMatchObject({
			channel: 'temperature',
			identifier: 'temperature',
			category: 'temperature',
			displayName: 'Temperature',
			dataType: 'float',
			permissions: ['ro'],
			unit: '°C',
			format: [0, 100],
			devices: null,
		});

		const serial = mappings.properties.find((candidate) => candidate.name === 'serial_number');
		expect(serial?.displayName).toBe('Serial number');
		expect(mappings.channels[1]).toMatchObject({
			forEach: null,
			identifier: 'temperature',
			channelName: 'Temperature',
		});
	});

	it('selects a data type variant', () => {
		const loader = build((definitions) => {
			definitions.channels.mappings.push(batteryChannel());
			definitions.properties.mappings.push(
				property('battery_percentage', 'battery', 'percentage', 'percentage', {
					property: { identifier: 'percentage', category: 'percentage', variant: 'percentage' },
					value: { path: 'batteryStatus.percentage' },
				}),
				property('battery_status', 'battery', 'status', 'status', { value: { constant: 'ok' } }),
			);
		});

		const battery = loader.load().properties.find((candidate) => candidate.name === 'battery_percentage');

		expect(battery).toMatchObject({ dataType: 'uchar', unit: '%', format: [0, 100] });
	});

	it('orders device mappings by priority, then name', () => {
		const loader = build((definitions) => {
			definitions.devices.mappings = [
				{ name: 'zeta', match: { model_key: 'sensor' }, device: { category: 'sensor' } },
				{ name: 'alpha', match: { model_key: 'sensor' }, device: { category: 'sensor' } },
				{ name: 'top', priority: 5, match: { model_key: 'sensor' }, device: { category: 'sensor' } },
			];
			definitions.channels.mappings.forEach((channel: any) => (channel.devices = ['zeta', 'alpha', 'top']));
		});

		expect(loader.load().devices.map((device) => device.name)).toEqual(['top', 'alpha', 'zeta']);
	});

	it('returns the same resolved object from repeated getMappings calls', () => {
		const loader = build();

		expect(loader.getMappings()).toBe(loader.getMappings());
		expect(loader.load()).not.toBe(loader.getMappings());
	});

	const cases: [string, string, Mutator][] = [
		[
			'an unknown key',
			'must NOT have additional properties',
			(d) => {
				d.devices.mappings[0].bogus = 1;
			},
		],
		[
			'a kind that does not match the file',
			'kind',
			(d) => {
				d.devices.kind = 'channels';
			},
		],
		[
			'a duplicate name',
			'duplicate mapping name',
			(d) => {
				d.properties.mappings.push(structuredClone(d.properties.mappings[0]));
			},
		],
		[
			'the generic category',
			'generic category is not allowed',
			(d) => {
				d.devices.mappings[0].device.category = 'generic';
			},
		],
		[
			'a channel the device spec does not allow',
			'not allowed on',
			(d) => {
				d.channels.mappings[1].channel.category = 'light';
			},
		],
		[
			'a property the channel spec lacks',
			'not defined by the spec',
			(d) => {
				d.properties.mappings[3].property.category = 'humidity';
			},
		],
		[
			'an enum constant outside the format',
			'not in the spec format',
			(d) => {
				d.channels.mappings.push(batteryChannel());
				d.properties.mappings.push(
					property('battery_status', 'battery', 'status', 'status', { value: { constant: 'bogus' } }),
				);
			},
		],
		[
			'a for_each key outside the enum',
			'not in the spec format',
			(d) => {
				d.devices.mappings.push({ name: 'camera', match: { model_key: 'camera' }, device: { category: 'camera' } });
				d.channels.mappings.push({
					name: 'object_detection',
					devices: ['camera'],
					for_each: {
						path: 'featureFlags.smartDetectTypes',
						values: { bogus: { key: 'bogus', name: 'Bogus' } },
					},
					channel: { identifier: 'object_detection.{key}', category: 'object_detection', name: '{name}' },
				});
				d.properties.mappings.push(
					property('object_type', 'object_detection', 'object_type', 'object_type', { value: { template: '{key}' } }),
				);
			},
		],
		[
			'a channel without a required property',
			'missing required property',
			(d) => {
				d.properties.mappings = d.properties.mappings.filter((m: any) => m.name !== 'serial_number');
			},
		],
		[
			'a device without a required channel',
			'missing required channel',
			(d) => {
				d.channels.mappings = d.channels.mappings.filter((m: any) => m.name !== 'device_information');
				d.properties.mappings = d.properties.mappings.filter((m: any) => m.channel !== 'device_information');
			},
		],
		[
			'a template with {mac}',
			'unknown placeholder',
			(d) => {
				d.properties.mappings[0].value = { template: 'unifi-{mac}' };
			},
		],
		[
			'ascending thresholds',
			'thresholds must be descending',
			(d) => {
				d.properties.mappings[3].value = {
					path: 'stats.temperature.value',
					transform: {
						type: 'thresholds',
						thresholds: [
							{ minimum: 0, value: 1 },
							{ minimum: 10, value: 2 },
						],
						default: 0,
					},
				};
			},
		],
		[
			'two motion channels on one device',
			'must be multiple',
			(d) => {
				d.channels.mappings.push(
					{ name: 'motion_a', devices: ['sensor'], channel: { identifier: 'motion', category: 'motion', name: 'A' } },
					{ name: 'motion_b', devices: ['sensor'], channel: { identifier: 'motion2', category: 'motion', name: 'B' } },
				);
			},
		],
		[
			'two static channels with one identifier',
			'duplicate channel identifier',
			(d) => {
				d.devices.mappings.push({ name: 'camera', match: { model_key: 'camera' }, device: { category: 'camera' } });
				d.channels.mappings.push(
					{
						name: 'a',
						devices: ['camera'],
						channel: { identifier: 'object_detection.x', category: 'object_detection', name: 'S' },
					},
					{
						name: 'b',
						devices: ['camera'],
						channel: { identifier: 'object_detection.x', category: 'object_detection', name: 'S' },
					},
				);
			},
		],
		[
			'a static identifier a for_each template can produce',
			'duplicate channel identifier',
			(d) => {
				d.devices.mappings.push({ name: 'camera', match: { model_key: 'camera' }, device: { category: 'camera' } });
				d.channels.mappings.push(
					{
						name: 'each',
						devices: ['camera'],
						for_each: { path: 'featureFlags.smartDetectTypes', values: { person: { key: 'person', name: 'Person' } } },
						channel: { identifier: 'object_detection.{key}', category: 'object_detection', name: '{name}' },
					},
					{
						name: 'fixed',
						devices: ['camera'],
						channel: { identifier: 'object_detection.person', category: 'object_detection', name: 'S' },
					},
				);
			},
		],
		[
			'two for_each templates that can overlap',
			'duplicate channel identifier',
			(d) => {
				d.devices.mappings.push({ name: 'camera', match: { model_key: 'camera' }, device: { category: 'camera' } });
				d.channels.mappings.push(
					{
						name: 'each_a',
						devices: ['camera'],
						for_each: { path: 'featureFlags.smartDetectTypes', values: { person: { key: 'person', name: 'Person' } } },
						channel: { identifier: 'object_detection.{key}', category: 'object_detection', name: '{name}' },
					},
					{
						name: 'each_b',
						devices: ['camera'],
						for_each: { path: 'featureFlags.smartDetectTypes', values: { person: { key: 'person', name: 'Person' } } },
						channel: { identifier: 'object_detection.{key}', category: 'object_detection', name: '{name}' },
					},
				);
			},
		],
		[
			'a __proto__ path segment',
			'path',
			(d) => {
				d.devices.mappings[0].match.when = [{ path: 'a.__proto__.b', exists: true }];
			},
		],
		[
			'a missing variant on a multi-type property',
			'variant',
			(d) => {
				d.channels.mappings.push(batteryChannel());
				d.properties.mappings.push(
					property('battery_percentage', 'battery', 'percentage', 'percentage', {
						value: { path: 'batteryStatus.percentage' },
					}),
					property('battery_status', 'battery', 'status', 'status', { value: { constant: 'ok' } }),
				);
			},
		],
	];

	it.each(cases)('rejects %s', (_case, message, mutate) => {
		const loader = build(mutate);

		expect(() => loader.load()).toThrow(
			expect.objectContaining({ errors: expect.arrayContaining([expect.stringContaining(message)]) }),
		);
	});

	it('names the failing file in the error', () => {
		const loader = build((d) => {
			d.channels.mappings[0].devices = ['missing'];
		});

		try {
			loader.load();
			throw new Error('expected load to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ProtectMappingConfigurationError);
			expect((error as ProtectMappingConfigurationError).file.endsWith('channels.yaml')).toBe(true);
			expect((error as ProtectMappingConfigurationError).errors.join('\n')).toContain('channels.yaml');
		}
	});

	it('fails module initialization for an invalid built-in file', () => {
		const loader = build((d) => {
			d.devices.mappings[0].device.category = 'generic';
		});

		expect(() => loader.onModuleInit()).toThrow(ProtectMappingConfigurationError);
	});
});
