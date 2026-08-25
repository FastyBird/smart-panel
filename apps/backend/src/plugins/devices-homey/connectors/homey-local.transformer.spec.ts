import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { HomeyCapabilityType } from '../models/homey-capability.model';
import { HomeyEventType } from '../models/homey-event.model';

import {
	transformHomeyLocalDevice,
	transformHomeyLocalDevices,
	transformHomeyLocalEvent,
	transformHomeyLocalSystemInfo,
	transformHomeyLocalZones,
} from './homey-local.transformer';

interface HomeyNormalizedFixtureManifest {
	fixtures: string[];
	sourceFixtureVersion: string;
	syntheticDeviceFixtures: string[];
	syntheticFixtureVersion: string;
}

const FIXTURE_ROOT = resolve(__dirname, '../__fixtures__');
const EXPECTED_ROOT = resolve(FIXTURE_ROOT, 'expected/v1');

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;
const manifest = readJson(resolve(EXPECTED_ROOT, 'manifest.json')) as HomeyNormalizedFixtureManifest;
const sourceRoot = resolve(FIXTURE_ROOT, 'versions', manifest.sourceFixtureVersion);
const syntheticSourceRoot = resolve(FIXTURE_ROOT, 'synthetic', manifest.syntheticFixtureVersion);
const rawZones = readJson(resolve(sourceRoot, 'zones.json'));
const expectedZones = readJson(resolve(EXPECTED_ROOT, 'zones.json'));

describe('Homey local protocol transformer', () => {
	it('normalizes local system aliases without retaining the source object', () => {
		const raw = {
			homeyId: 'homey-1',
			homeyModelName: 'Homey Pro',
			homeyName: 'House',
			homeyTier: 'pro',
			homeyVersion: '12.4.0',
			privateField: 'must-not-leak',
		};

		expect(transformHomeyLocalSystemInfo(raw)).toStrictEqual({
			id: 'homey-1',
			model: 'Homey Pro',
			name: 'House',
			tier: 'pro',
			version: '12.4.0',
		});
	});

	it('normalizes the captured zone hierarchy in source order', () => {
		expect(transformHomeyLocalZones(rawZones)).toStrictEqual(expectedZones);
	});

	it.each(manifest.fixtures)('matches the golden normalized output for %s', (fixturePath) => {
		const zones = transformHomeyLocalZones(rawZones);
		const expected = readJson(resolve(EXPECTED_ROOT, 'devices', basename(fixturePath)));

		expect(transformHomeyLocalDevice(readJson(resolve(sourceRoot, fixturePath)), zones)).toStrictEqual(expected);
	});

	it.each(manifest.syntheticDeviceFixtures)('matches the synthetic golden normalized output for %s', (fixturePath) => {
		const zones = transformHomeyLocalZones(rawZones);
		const expected = readJson(resolve(EXPECTED_ROOT, 'synthetic', fixturePath));
		const raw = readJson(resolve(syntheticSourceRoot, fixturePath)) as { fixtureProvenance?: string };

		expect(raw.fixtureProvenance).toBe('synthetic-published-protocol-contract');
		expect(transformHomeyLocalDevice(raw, zones)).toStrictEqual(expected);
	});

	it('keeps the complete golden output free of endpoints and credential-shaped values', () => {
		const serialized = JSON.stringify([
			expectedZones,
			...manifest.fixtures.map((fixturePath) => readJson(resolve(EXPECTED_ROOT, 'devices', basename(fixturePath)))),
			...manifest.syntheticDeviceFixtures.map((fixturePath) =>
				readJson(resolve(EXPECTED_ROOT, 'synthetic', fixturePath)),
			),
		]);

		expect(serialized).not.toMatch(/https?:\\?\/\\?\//i);
		expect(serialized).not.toMatch(
			/(?:^|[^\d])(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/,
		);
		expect(serialized).not.toMatch(/(?:api[_-]?key|authorization|bearer|token|secret)/i);
	});

	it('preserves source order, full suffixed IDs, false, zero, and null values independently of availability', () => {
		const zones = transformHomeyLocalZones(rawZones);
		const rawDevice = readJson(resolve(sourceRoot, 'devices/repeated-capabilities.json'));
		const device = transformHomeyLocalDevices({ first: rawDevice }, zones)[0];
		const capabilities = new Map(device.capabilities.map((capability) => [capability.id, capability]));

		expect(device.capabilities.map((capability) => capability.id)).toStrictEqual(
			(rawDevice as { capabilities: string[] }).capabilities,
		);
		expect(capabilities.get('onoff')).toMatchObject({
			available: null,
			baseId: 'onoff',
			value: false,
		});
		expect(capabilities.get('measure_power')).toMatchObject({ value: 0 });
		expect(capabilities.get('meter_power.capability-suffix-000007')).toMatchObject({
			baseId: 'meter_power',
			value: null,
		});
		expect(capabilities.get('measure_temperature.capability-suffix-000001')).toMatchObject({
			baseId: 'measure_temperature',
		});
	});

	it('normalizes explicit enum metadata without accepting a caller-supplied base ID', () => {
		const enumCapability = readJson(resolve(sourceRoot, 'synthetic/enum-capability.json'));
		const device = transformHomeyLocalDevice(
			{
				available: true,
				capabilities: ['synthetic_mode.instance'],
				capabilitiesObj: { 'synthetic_mode.instance': enumCapability },
				class: 'sensor',
				id: 'synthetic-device',
				name: 'Synthetic device',
			},
			[],
		);

		expect(device.capabilities).toStrictEqual([
			expect.objectContaining({
				baseId: 'synthetic_mode',
				enumValues: [
					{ id: 'mode_a', title: 'Synthetic mode A' },
					{ id: 'mode_b', title: 'Synthetic mode B' },
					{ id: 'mode_c', title: 'Synthetic mode C' },
				],
				id: 'synthetic_mode.instance',
				type: HomeyCapabilityType.ENUM,
				value: 'mode_a',
			}),
		]);
	});

	it('keeps unknown capability metadata plain and conservative', () => {
		const device = transformHomeyLocalDevice(
			{
				available: false,
				capabilities: ['vendor_capability'],
				class: 'other',
				id: 'device-id',
				name: 'Device name',
			},
			[],
		);

		expect(device.capabilities).toStrictEqual([
			{
				available: null,
				baseId: 'vendor_capability',
				enumValues: [],
				id: 'vendor_capability',
				lastUpdatedAt: null,
				maximum: null,
				minimum: null,
				readable: false,
				step: null,
				title: 'vendor_capability',
				type: HomeyCapabilityType.UNKNOWN,
				unit: null,
				value: null,
				writable: false,
			},
		]);
	});

	it('rejects cyclic zones and malformed required identifiers with fixed messages', () => {
		expect(() =>
			transformHomeyLocalZones({
				first: { active: true, id: 'first', name: 'First', parent: 'second' },
				second: { active: true, id: 'second', name: 'Second', parent: 'first' },
			}),
		).toThrow('Homey protocol zone hierarchy contains a cycle');
		expect(() => transformHomeyLocalDevice({ class: 'other', id: 'private-source-value' }, [])).toThrow(
			'Homey protocol device name is missing',
		);
	});

	it('normalizes capability and availability events with full IDs and metadata', () => {
		expect(
			transformHomeyLocalEvent({
				type: 'capability',
				deviceId: 'device-1',
				payload: {
					capabilityId: 'measure_temperature.inside',
					lastUpdated: '2026-08-13T10:01:00.000Z',
					sequence: 1,
					value: 0,
				},
			}),
		).toStrictEqual({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: 'device-1',
			capabilityId: 'measure_temperature.inside',
			value: 0,
			lastUpdatedAt: '2026-08-13T10:01:00.000Z',
			occurredAt: '2026-08-13T10:01:00.000Z',
			sequence: 1,
		});

		expect(
			transformHomeyLocalEvent({
				type: 'device.availability',
				payload: {
					available: false,
					id: 'device-1',
					sequence: 'event-2',
					unavailableMessage: 'Device unavailable',
				},
			}),
		).toStrictEqual({
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'device-1',
			available: false,
			availabilityMessage: 'Device unavailable',
			occurredAt: null,
			sequence: 'event-2',
		});
	});

	it('preserves explicit null capability events and rejects missing or malformed values', () => {
		const event = {
			type: 'capability' as const,
			deviceId: 'device-1',
			payload: { capabilityId: 'meter_power.instance', value: null },
		};

		expect(transformHomeyLocalEvent(event)).toMatchObject({ value: null });
		expect(() => transformHomeyLocalEvent({ ...event, payload: { capabilityId: 'meter_power.instance' } })).toThrow(
			'Homey protocol event capability value is missing',
		);
		expect(() =>
			transformHomeyLocalEvent({
				...event,
				payload: { capabilityId: 'meter_power.instance', value: { leaked: 'invalid' } },
			}),
		).toThrow('Homey protocol event capability value is malformed');
		expect(() =>
			transformHomeyLocalEvent({
				...event,
				payload: { capabilityId: 'meter_power.instance', value: Number.NaN },
			}),
		).toThrow('Homey protocol event capability value is malformed');
	});

	it.each([
		['device.create', HomeyEventType.DEVICE_ADDED, 'deviceId'],
		['device.update', HomeyEventType.DEVICE_UPDATED, 'deviceId'],
		['device.delete', HomeyEventType.DEVICE_REMOVED, 'deviceId'],
		['zone.create', HomeyEventType.ZONE_ADDED, 'zoneId'],
		['zone.update', HomeyEventType.ZONE_UPDATED, 'zoneId'],
		['zone.delete', HomeyEventType.ZONE_REMOVED, 'zoneId'],
	] as const)('normalizes %s lifecycle events', (type, normalizedType, idKey) => {
		expect(transformHomeyLocalEvent({ type, payload: { id: 'entity-1' } })).toStrictEqual({
			type: normalizedType,
			[idKey]: 'entity-1',
			occurredAt: null,
			sequence: null,
		});
	});
});
