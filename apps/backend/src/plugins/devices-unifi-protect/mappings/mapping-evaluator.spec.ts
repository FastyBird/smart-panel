/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'fs';
import { join } from 'path';

import { ProtectRtspsStreams } from '../client/protect-api.types';

import {
	ProtectMappedDevice,
	ProtectMappingInput,
	ProtectStreamAvailability,
	evaluateProtectMapping,
	toNvrMacKey,
	toStreamAvailability,
} from './mapping-evaluator';
import { ProtectMappingLoaderService } from './mapping-loader.service';

type Raw = Record<string, any>;

const fixture = <T = Raw[]>(name: string): T =>
	JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8')) as T;

const NVR = { id: '68b3ace392bf98c9fb76f70c', macKey: '0cea14003a69' };

describe('mapping evaluator', () => {
	const mappings = new ProtectMappingLoaderService().load();

	const evaluate = (device: Raw, streams: ProtectStreamAvailability | null = null, modelKey?: string) =>
		evaluateProtectMapping(mappings, {
			nvr: NVR,
			modelKey: modelKey ?? (device.modelKey as string),
			device,
			streams,
		} as ProtectMappingInput);

	const mapped = (device: Raw, streams: ProtectStreamAvailability | null = null): ProtectMappedDevice => {
		const result = evaluate(device, streams);

		if (!('device' in result)) {
			throw new Error(`unexpected ${result.reason}`);
		}

		return result.device;
	};

	const channelIdentifiers = (device: ProtectMappedDevice): string[] => device.channels.map((c) => c.identifier);

	const value = (device: ProtectMappedDevice, channel: string, property: string): unknown =>
		device.channels.find((c) => c.identifier === channel)?.properties.find((p) => p.identifier === property)?.value;

	const camera = (): Raw => structuredClone(fixture('cameras.json')[0]);
	const sensor = (index = 0): Raw => structuredClone(fixture('sensors.json')[index]);
	const light = (): Raw => structuredClone(fixture('lights.json')[0]);

	it('loads the built-in definitions', () => {
		expect(mappings.devices.map((device) => device.name)).toEqual(['doorbell', 'camera', 'floodlight', 'sensor']);
		expect(mappings.devices.map((device) => String(device.category))).not.toContain('generic');
	});

	it('recognises a doorbell by its LCD flag or its model name', () => {
		const byName = camera();
		byName.type = 'UVC G4 Doorbell';
		byName.featureFlags.hasLcdScreen = false;

		expect(mapped(byName).category).toBe('doorbell');

		const byFlag = camera();
		byFlag.featureFlags.hasLcdScreen = true;

		expect(mapped(byFlag).category).toBe('doorbell');
		expect(mapped(camera()).category).toBe('camera');
	});

	it('maps every Protect detection type to its spec value', () => {
		const device = camera();
		device.featureFlags.smartDetectTypes = ['person', 'vehicle', 'animal', 'package', 'licensePlate', 'face'];
		device.featureFlags.smartDetectAudioTypes = [
			'alrmGlassBreak',
			'alrmBurglar',
			'alrmSiren',
			'alrmBabyCry',
			'alrmSpeak',
			'alrmBark',
			'alrmCarHorn',
		];

		const identifiers = channelIdentifiers(mapped(device));

		expect(identifiers.filter((id) => id.startsWith('object_detection.'))).toEqual([
			'object_detection.person',
			'object_detection.vehicle',
			'object_detection.animal',
			'object_detection.package',
			'object_detection.license_plate',
			'object_detection.face',
		]);
		expect(identifiers.filter((id) => id.startsWith('sound_detection.'))).toEqual([
			'sound_detection.glass_break',
			'sound_detection.burglar_alarm',
			'sound_detection.siren',
			'sound_detection.baby_cry',
			'sound_detection.speech',
			'sound_detection.dog_bark',
			'sound_detection.car_horn',
		]);
	});

	it('skips an unknown detection type with a warning', () => {
		const device = camera();
		device.featureFlags.smartDetectTypes = ['person', 'pet'];
		device.featureFlags.smartDetectAudioTypes = ['alrmFuture', 'a/b'];

		const result = evaluate(device);

		expect('warnings' in result && result.warnings).toEqual([
			{ code: 'unsupported_detection_type', identifier: 'pet' },
			{ code: 'unsupported_detection_type', identifier: 'alrmFuture' },
			{ code: 'unsupported_detection_type', identifier: null },
		]);
		expect('device' in result && channelIdentifiers(result.device)).toEqual([
			'device_information',
			'camera.main',
			'motion',
			'object_detection.person',
			'indicator',
			'microphone',
		]);
	});

	it('creates one channel for a repeated detection type', () => {
		const device = camera();
		device.featureFlags.smartDetectTypes = ['person', 'person'];

		expect(channelIdentifiers(mapped(device)).filter((id) => id.startsWith('object_detection.'))).toEqual([
			'object_detection.person',
		]);
	});

	it.each([
		[0, 'dark'],
		[9.9, 'dark'],
		[10, 'dusky'],
		[49, 'dusky'],
		[50, 'moderate'],
		[499, 'moderate'],
		[500, 'bright'],
	])('derives illuminance level %s lx -> %s', (lux, level) => {
		const device = sensor();
		device.stats.light.value = lux;

		expect(value(mapped(device), 'illuminance', 'level')).toBe(level);
	});

	it.each([
		[1, 17],
		[2, 33],
		[3, 50],
		[4, 67],
		[5, 83],
		[6, 100],
	])('scales floodlight level %i to %i %%', (level, percent) => {
		const device = light();
		device.lightDeviceSettings.ledLevel = level;

		expect(value(mapped(device), 'light', 'brightness')).toBe(percent);
	});

	it.each([
		['CONNECTED', 'connected'],
		['CONNECTING', 'init'],
		['DISCONNECTED', 'disconnected'],
		['REBOOTING', 'unknown'],
	])('maps state %s', (state, expected) => {
		const device = camera();
		device.state = state;

		expect(value(mapped(device), 'device_information', 'connection_state')).toBe(expected);
	});

	it.each([
		['CONNECTED', { high: true }, 'available'],
		['CONNECTED', {}, 'unavailable'],
		['CONNECTED', null, 'unavailable'],
		['CONNECTING', { high: true }, 'initializing'],
		['DISCONNECTED', { high: true }, 'offline'],
		['REBOOTING', { high: true }, 'unavailable'],
	])('reports camera.main status for %s with %j as %s', (state, partial, expected) => {
		const device = camera();
		device.state = state;
		device.hasPackageCamera = true;

		const streams =
			partial === null
				? null
				: {
						high: false,
						medium: false,
						low: false,
						package: false,
						...(partial as Partial<ProtectStreamAvailability>),
					};
		const result = mapped(device, streams);

		expect(value(result, 'camera.main', 'status')).toBe(expected);

		// The package camera follows only the `package` availability.
		const packageStatus = value(result, 'camera.package', 'status');
		const withPackage = mapped(device, { high: false, medium: false, low: false, package: true });

		expect(packageStatus).toBe(
			state === 'CONNECTING' ? 'initializing' : state === 'DISCONNECTED' ? 'offline' : 'unavailable',
		);
		expect(value(withPackage, 'camera.package', 'status')).toBe(state === 'CONNECTED' ? 'available' : packageStatus);
	});

	it('does not derive detections from event timestamps', () => {
		const leak = mapped(sensor(3));

		expect(value(leak, 'leak', 'detected')).toBe(false);
		expect(value(mapped(sensor(4)), 'contact', 'tampered')).toBe(false);

		const stale = sensor();
		stale.alarmSettings.isEnabled = true;
		stale.alarmTriggeredAt = 1794400000000;

		expect(value(mapped(stale), 'smoke', 'detected')).toBe(false);
	});

	it('creates contact only for door, window and garage mounts and leak for a leak mount or an external probe', () => {
		for (const mountType of ['door', 'window', 'garage']) {
			const device = sensor();
			device.mountType = mountType;

			expect(channelIdentifiers(mapped(device))).toContain('contact');
			expect(channelIdentifiers(mapped(device))).not.toContain('leak');
		}

		const leak = sensor();
		leak.mountType = 'leak';

		expect(channelIdentifiers(mapped(leak))).not.toContain('contact');
		expect(channelIdentifiers(mapped(leak))).toContain('leak');

		const probe = sensor();
		probe.leakSettings.isExternalEnabled = true;

		expect(channelIdentifiers(mapped(probe))).toContain('leak');
		expect(channelIdentifiers(mapped(probe))).toContain('contact');
	});

	it('nulls a value whose type does not match', () => {
		const device = camera();
		device.micVolume = '100';

		expect(value(mapped(device), 'microphone', 'volume')).toBeNull();

		const warm = sensor();
		warm.stats.temperature.value = 'warm';

		expect(value(mapped(warm), 'temperature', 'temperature')).toBeNull();

		const infinite = sensor();
		infinite.stats.humidity.value = Number.POSITIVE_INFINITY;

		expect(value(mapped(infinite), 'humidity', 'humidity')).toBeNull();
	});

	it('returns unsupported_model for a chime and invalid_device for an id outside the pattern', () => {
		const chime = fixture('chimes.json')[0];

		expect(chime.modelKey).toBe('chime');
		expect(evaluate(chime)).toEqual({ ok: false, reason: 'unsupported_model' });

		const bad = camera();
		bad.id = '../x';

		expect(evaluate(bad)).toEqual({ ok: false, reason: 'invalid_device' });

		const missing = camera();
		delete missing.id;

		expect(evaluate(missing)).toEqual({ ok: false, reason: 'invalid_device' });
	});

	it('falls back to a generated name when the console name is unusable', () => {
		const device = camera();
		device.name = '\u0007';

		expect(mapped(device).name).toBe(`UniFi Protect camera ${device.id as string}`);

		device.name = 'x'.repeat(256);

		expect(mapped(device).name).toBe(`UniFi Protect camera ${device.id as string}`);

		device.name = '  Porch  ';

		expect(mapped(device).name).toBe('Porch');
	});

	it('toStreamAvailability drops the URLs', () => {
		const availability = toStreamAvailability(fixture<ProtectRtspsStreams>('rtsps-stream.json'));

		expect(availability).toEqual({ high: true, medium: false, low: false, package: false });
		expect(JSON.stringify(availability)).not.toContain('rtsps');
	});

	it.each([
		['0CEA14003A69', '0cea14003a69'],
		['0c:ea:14:00:3a:69', '0cea14003a69'],
		[null, null],
		['zz', null],
	])('toNvrMacKey(%j)', (mac, expected) => {
		expect(toNvrMacKey(mac)).toBe(expected);
	});

	it('never throws on a malformed console object', () => {
		const device = camera();
		device.featureFlags = 'broken';

		expect(() => evaluate(device)).not.toThrow();
	});
});
