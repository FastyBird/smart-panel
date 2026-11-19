/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'fs';
import { join } from 'path';

import { PROTECT_MAX_FRAME_BYTES } from '../devices-unifi-protect.constants';
import { ProtectMappedDevice, evaluateProtectMapping } from '../mappings/mapping-evaluator';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';

import {
	diffMappedValues,
	mappedConnectionState,
	mappedValueMap,
	mergeProtectItem,
	parseProtectFrame,
	streamStatusMappingNames,
	syncableMappingNames,
} from './protect-frame-merge';

type Raw = Record<string, any>;

const fixtureText = (name: string): string => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');
const fixture = (name: string): Raw[] => JSON.parse(fixtureText(name)) as Raw[];
const lines = (name: string): string[] =>
	fixtureText(name)
		.split('\n')
		.filter((line) => line.trim() !== '');

const nest = (depth: number): Record<string, unknown> => {
	let value: Record<string, unknown> = { leaf: 1 };

	for (let i = 0; i < depth; i++) {
		value = { n: value };
	}

	return value;
};

describe('protect frame merge', () => {
	const mappings = new ProtectMappingLoaderService().load();
	const NVR = { id: '68b3ace392bf98c9fb76f70c', macKey: '0cea14003a69' };

	const map = (device: Raw): ProtectMappedDevice => {
		const result = evaluateProtectMapping(mappings, {
			nvr: NVR,
			modelKey: device.modelKey as string,
			device,
			streams: null,
		});

		if (!('device' in result)) {
			throw new Error(`unexpected ${result.reason}`);
		}

		return result.device;
	};

	const camera = (): Raw => structuredClone(fixture('cameras.json')[0]);
	const sensor = (): Raw => structuredClone(fixture('sensors.json')[0]);

	it('names the stream status mappings', () => {
		const names = streamStatusMappingNames(mappings);

		expect([...names].sort()).toEqual(['camera_main_status', 'camera_package_status']);

		for (const name of names) {
			expect(syncableMappingNames(mappings).has(name)).toBe(false);
		}
	});

	it('parses every recorded device and event frame', () => {
		for (const name of ['ws-devices.jsonl', 'ws-events.jsonl']) {
			for (const line of lines(name)) {
				const parsed = parseProtectFrame(line);

				expect(parsed).toHaveProperty('frame');
				expect((parsed as { frame: { action: string } }).frame.action).toBe((JSON.parse(line) as Raw).type);
			}
		}
	});

	it.each([
		['too_large', 'x'.repeat(PROTECT_MAX_FRAME_BYTES + 1)],
		['not_json', '{'],
		['invalid_shape', '{"type":"patch","item":{"id":"a","modelKey":"camera"}}'],
		['invalid_shape', '{"type":"update","item":{"id":"../x","modelKey":"camera"}}'],
		['invalid_shape', '{"type":"update","item":[]}'],
		['too_deep', JSON.stringify({ type: 'update', item: { id: 'a', modelKey: 'camera', a: nest(20) } })],
	])('rejects %s frames', (rejected, text) => {
		expect(parseProtectFrame(text)).toEqual({ rejected });
	});

	it('merges a partial update into the cached object without touching siblings', () => {
		const original = camera();
		const snapshot = structuredClone(original);
		const merged = mergeProtectItem(original, { ledSettings: { isEnabled: true } });

		expect((merged.ledSettings as Raw).isEnabled).toBe(true);
		expect(merged.featureFlags).toEqual(snapshot.featureFlags);
		expect(original).toEqual(snapshot);
		expect(merged).not.toBe(original);
	});

	it('replaces arrays instead of merging them', () => {
		const original = camera();
		original.featureFlags.smartDetectTypes = ['person', 'vehicle', 'animal'];

		const merged = mergeProtectItem(original, { featureFlags: { smartDetectTypes: ['person'] } });

		expect((merged.featureFlags as Raw).smartDetectTypes).toEqual(['person']);
	});

	it('never pollutes a prototype', () => {
		const partial = JSON.parse(
			'{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},"ok":{"__proto__":{"polluted":1}}}',
		) as Record<string, unknown>;
		const merged = mergeProtectItem({}, partial);

		expect(({} as Raw).polluted).toBeUndefined();
		expect(Object.keys(merged)).not.toContain('__proto__');
		expect(Object.keys(merged)).not.toContain('constructor');
		expect(Object.keys(merged.ok as object)).toEqual([]);
	});

	it('drops keys beyond 512 per object', () => {
		const partial: Record<string, unknown> = {};

		for (let i = 0; i < 600; i++) {
			partial[`k${i}`] = i;
		}

		expect(Object.keys(mergeProtectItem({}, partial))).toHaveLength(512);
	});

	it('limits the merge depth', () => {
		const merged = mergeProtectItem({}, nest(30));
		let depth = 0;

		for (let node: unknown = merged; typeof node === 'object' && node !== null; node = (node as Raw).n) {
			depth++;
		}

		expect(depth).toBeLessThanOrEqual(9);
	});

	it.each([
		['an object', { value: true }],
		['an array', [1, 2]],
	])('keeps %s at the accepted depth limit through the parser and the merge', (_name, container) => {
		const at8 = { a: { b: { c: { d: { e: { f: { g: container } } } } } } };
		const text = JSON.stringify({ type: 'update', item: { id: 'a', modelKey: 'camera', ...at8 } });
		const parsed = parseProtectFrame(text);

		if (!('frame' in parsed)) {
			throw new Error(`rejected ${parsed.rejected}`);
		}

		const merged = mergeProtectItem({}, parsed.frame.item) as Raw;

		expect(merged.a.b.c.d.e.f.g).toEqual(container);
		expect((mergeProtectItem(merged, { a: { b: { c: { d: { e: { f: { h: 1 } } } } } } }) as Raw).a.b.c.d.e.f).toEqual({
			g: container,
			h: 1,
		});
	});

	it('diffs only syncable path values', () => {
		const syncable = syncableMappingNames(mappings);
		const baseline = map(sensor());
		const next = map(mergeProtectItem(sensor(), { stats: { light: { value: 8 } } }) as Raw);

		expect(diffMappedValues(mappedValueMap(baseline), next, syncable)).toEqual([
			{ channelIdentifier: 'illuminance', mappingName: 'illuminance', value: 8 },
			{ channelIdentifier: 'illuminance', mappingName: 'illuminance_level', value: 'dark' },
		]);
		expect(diffMappedValues(mappedValueMap(baseline), baseline, syncable)).toEqual([]);
		expect(diffMappedValues(null, baseline, syncable).length).toBeGreaterThan(0);
	});

	it('diffs the floodlight control fields of a recorded frame', () => {
		const syncable = syncableMappingNames(mappings);
		const frame = lines('ws-devices.jsonl')
			.map((line) => JSON.parse(line) as Raw)
			.find((entry) => entry.item?.lightDeviceSettings?.isIndicatorEnabled === false);
		const baselineRaw = structuredClone(fixture('lights.json')[0]);
		const baseline = map(baselineRaw);

		expect(frame).toBeDefined();

		const next = map(mergeProtectItem(baselineRaw, frame?.item as Raw) as Raw);

		expect(diffMappedValues(mappedValueMap(baseline), next, syncable)).toEqual([
			{ channelIdentifier: 'light', mappingName: 'light_brightness', value: 50 },
			{ channelIdentifier: 'indicator', mappingName: 'floodlight_indicator_on', value: false },
		]);
	});

	it('never reports constants, templates, stream status or connection_state', () => {
		const syncable = syncableMappingNames(mappings);

		for (const name of [
			'camera_motion_detected',
			'object_type',
			'camera_main_source',
			'camera_main_status',
			'connection_state',
			'leak_level',
		]) {
			expect(syncable.has(name)).toBe(false);
		}

		for (const name of ['contact_detected', 'battery_status', 'light_brightness', 'camera_indicator_on']) {
			expect(syncable.has(name)).toBe(true);
		}
	});

	it('skips a null value instead of clearing', () => {
		const syncable = syncableMappingNames(mappings);
		const baseline = map(camera());
		const next = map(mergeProtectItem(camera(), { micVolume: 'loud' }) as Raw);

		expect(diffMappedValues(mappedValueMap(baseline), next, syncable).map((c) => c.mappingName)).not.toContain(
			'microphone_volume',
		);
	});

	it('reports the mapped connection state', () => {
		expect(mappedConnectionState(map({ ...camera(), state: 'DISCONNECTED' }))).toBe('disconnected');
		expect(mappedConnectionState(map({ ...camera(), state: 'FOO' }))).toBe('unknown');
	});
});
