import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { ProtectRtspsStreams } from '../client/protect-api.types';

import {
	ProtectMappedDevice,
	ProtectStreamAvailability,
	evaluateProtectMapping,
	toStreamAvailability,
	toValidationInput,
} from './mapping-evaluator';
import { ProtectMappingLoaderService } from './mapping-loader.service';

type Raw = Record<string, any>;

const FIXTURES = join(__dirname, '..', '__fixtures__');
const EXPECTED = join(FIXTURES, 'expected');
const NVR = { id: '68b3ace392bf98c9fb76f70c', macKey: '0cea14003a69' };

const fixture = (name: string): Raw[] => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Raw[];

const ALL_FALSE: ProtectStreamAvailability = { high: false, medium: false, low: false, package: false };

interface Golden {
	name: string;
	device: Raw;
	streams: ProtectStreamAvailability | null;
	category: string;
	identifier: string;
	channels: string[];
}

const GOLDENS: Golden[] = [
	{
		name: 'camera',
		device: fixture('cameras.json')[0],
		streams: { ...ALL_FALSE, high: true },
		category: 'camera',
		identifier: '0cea14003a69:600cefafd5f365d6f83c4ef3',
		channels: [
			'device_information',
			'camera.main',
			'motion',
			'object_detection.person',
			'object_detection.vehicle',
			'object_detection.animal',
			'smoke',
			'carbon_monoxide',
			'sound_detection.baby_cry',
			'sound_detection.speech',
			'indicator',
			'microphone',
		],
	},
	{
		name: 'doorbell',
		device: fixture('cameras-doorbell.json')[0],
		streams: ALL_FALSE,
		category: 'doorbell',
		identifier: '0cea14003a69:5f0000000000000000000a01',
		channels: [
			'device_information',
			'camera.main',
			'doorbell',
			'motion',
			'object_detection.person',
			'object_detection.vehicle',
			'object_detection.animal',
			'indicator',
			'microphone',
		],
	},
	{
		name: 'doorbell-package',
		device: fixture('cameras-doorbell.json')[1],
		streams: ALL_FALSE,
		category: 'doorbell',
		identifier: '0cea14003a69:5f0000000000000000000a02',
		channels: [
			'device_information',
			'camera.main',
			'camera.package',
			'doorbell',
			'motion',
			'object_detection.person',
			'object_detection.vehicle',
			'object_detection.animal',
			'object_detection.package',
			'indicator',
			'microphone',
		],
	},
	{
		name: 'sensor',
		device: fixture('sensors.json')[0],
		streams: null,
		category: 'sensor',
		identifier: '0cea14003a69:5f0000000000000000000b01',
		channels: ['device_information', 'contact', 'motion', 'temperature', 'humidity', 'illuminance', 'battery'],
	},
	{
		name: 'sensor-leak',
		device: fixture('sensors.json')[3],
		streams: null,
		category: 'sensor',
		identifier: '0cea14003a69:5f0000000000000000000b01',
		channels: ['device_information', 'motion', 'leak', 'temperature', 'humidity', 'illuminance', 'battery'],
	},
	{
		name: 'floodlight',
		device: fixture('lights.json')[0],
		streams: null,
		category: 'lighting',
		identifier: '0cea14003a69:5f0000000000000000000c01',
		channels: ['device_information', 'light'],
	},
];

describe('built-in UniFi Protect mappings', () => {
	const mappings = new ProtectMappingLoaderService().load();
	const validation = new DeviceValidationService({} as never);

	const evaluate = (golden: Golden): ProtectMappedDevice => {
		const result = evaluateProtectMapping(mappings, {
			nvr: NVR,
			modelKey: golden.device.modelKey as string,
			device: golden.device,
			streams: golden.streams,
		});

		if (!('device' in result)) {
			throw new Error(`unexpected ${result.reason}`);
		}

		return result.device;
	};

	const value = (device: ProtectMappedDevice, channel: string, property: string): unknown =>
		device.channels.find((c) => c.identifier === channel)?.properties.find((p) => p.identifier === property)?.value;

	describe.each(GOLDENS)('$name', (golden) => {
		it('matches its golden output', () => {
			const device = evaluate(golden);
			const path = join(EXPECTED, `${golden.name}.json`);

			if (process.env.PROTECT_UPDATE_GOLDEN === '1') {
				mkdirSync(EXPECTED, { recursive: true });
				writeFileSync(path, `${JSON.stringify(device, null, '\t')}\n`);
			}

			expect(existsSync(path)).toBe(true);
			expect(device).toEqual(JSON.parse(readFileSync(path, 'utf8')));
		});

		it('has the expected category, identifier and channels', () => {
			const device = evaluate(golden);

			expect(device.category).toBe(golden.category);
			expect(device.identifier).toBe(golden.identifier);
			expect(device.channels.map((channel) => channel.identifier)).toEqual(golden.channels);
		});

		it('passes the device spec validation', () => {
			expect(validation.validateDeviceStructure(toValidationInput(evaluate(golden)))).toEqual({
				isValid: true,
				issues: [],
			});
		});
	});

	it('maps the camera values', () => {
		const device = evaluate(GOLDENS[0]);

		expect(device.name).toBe('Front door');
		expect(value(device, 'device_information', 'model')).toBe('UVC G5 Dome');
		expect(value(device, 'device_information', 'serial_number')).toBe('0CEA14008183');
		expect(value(device, 'device_information', 'connection_state')).toBe('connected');
		expect(value(device, 'camera.main', 'status')).toBe('available');
		expect(value(device, 'camera.main', 'source')).toBe('unifi-protect:600cefafd5f365d6f83c4ef3:main');
		expect(value(device, 'indicator', 'on')).toBe(false);
		expect(value(device, 'microphone', 'active')).toBe(true);
		expect(value(device, 'microphone', 'volume')).toBe(100);
	});

	it('maps the doorbell values', () => {
		const device = evaluate(GOLDENS[1]);

		expect(value(device, 'camera.main', 'status')).toBe('unavailable');
		expect(value(device, 'doorbell', 'event')).toBeNull();
		expect(value(device, 'indicator', 'on')).toBe(true);

		const withPackage = evaluate(GOLDENS[2]);

		expect(value(withPackage, 'camera.package', 'source')).toBe('unifi-protect:5f0000000000000000000a02:package');
		expect(value(withPackage, 'camera.package', 'status')).toBe('unavailable');
	});

	it('maps the sensor values', () => {
		const device = evaluate(GOLDENS[3]);

		expect(value(device, 'device_information', 'model')).toBe('UP-Sense');
		expect(value(device, 'contact', 'detected')).toBe(false);
		expect(value(device, 'temperature', 'temperature')).toBe(21.4);
		expect(value(device, 'humidity', 'humidity')).toBe(41);
		expect(value(device, 'illuminance', 'illuminance')).toBe(120);
		expect(value(device, 'illuminance', 'level')).toBe('moderate');
		expect(value(device, 'battery', 'percentage')).toBe(87);
		expect(value(device, 'battery', 'status')).toBe('ok');

		const leak = evaluate(GOLDENS[4]);

		expect(value(leak, 'leak', 'detected')).toBe(false);
		expect(value(leak, 'leak', 'level')).toBe('low');
	});

	it('maps the floodlight values', () => {
		const device = evaluate(GOLDENS[5]);

		expect(value(device, 'device_information', 'model')).toBe('UP Floodlight');
		expect(value(device, 'light', 'on')).toBe(false);
		expect(value(device, 'light', 'brightness')).toBe(100);
	});

	it('gives every channel a unique identifier and every property a unique identifier per channel', () => {
		for (const golden of GOLDENS) {
			const device = evaluate(golden);
			const identifiers = device.channels.map((channel) => channel.identifier);

			expect(new Set(identifiers).size).toBe(identifiers.length);

			for (const channel of device.channels) {
				const properties = channel.properties.map((property) => property.identifier);

				expect(new Set(properties).size).toBe(properties.length);
			}
		}
	});

	it('keeps stream URLs out of every golden', () => {
		const streams = toStreamAvailability({
			high: 'rtsps://192.0.2.1:7441/SENTINELALIAS1',
			medium: null,
			low: null,
			package: null,
		} as ProtectRtspsStreams);

		for (const golden of GOLDENS) {
			expect(
				JSON.stringify(
					evaluateProtectMapping(mappings, {
						nvr: NVR,
						modelKey: golden.device.modelKey as string,
						device: golden.device,
						streams,
					}),
				),
			).not.toMatch(/rtsps|SENTINELALIAS/);
		}
	});
});
