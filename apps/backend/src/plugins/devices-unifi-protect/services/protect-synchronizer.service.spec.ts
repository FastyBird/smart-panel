/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { readFileSync } from 'fs';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';

import { ProtectFrame, parseProtectFrame } from './protect-frame-merge';
import { ProtectInventoryEntry } from './protect-inventory.service';
import { ProtectSnapshot, ProtectSynchronizerService } from './protect-synchronizer.service';

type Raw = Record<string, any>;

const FIXTURES = join(__dirname, '..', '__fixtures__');
const read = (name: string): any => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
const cameras = read('cameras.json') as Raw[];
const sensors = read('sensors.json') as Raw[];
const nvrs = read('nvrs.json') as Raw;
const goldenCamera = read('expected/camera.json') as Raw;
const goldenSensor = read('expected/sensor.json') as Raw;
const deviceLines = readFileSync(join(FIXTURES, 'ws-devices.jsonl'), 'utf8')
	.split('\n')
	.filter((line) => line.trim() !== '');

const IDENTITY = { nvrId: nvrs.id as string, nvrMacKey: '0cea14003a69' };
const CAMERA_ID = cameras[0].id as string;
const SENSOR_ID = sensors[0].id as string;
const CAMERA_PANEL = '11111111-1111-4111-8111-111111111111';
const SENSOR_PANEL = '22222222-2222-4222-8222-222222222222';
const REMOVAL_KEY = `device_removed:${SENSOR_ID}`;
const FAILURE_TEXT = 'UniFi Protect property update failed';

const entry = (modelKey: 'camera' | 'sensor', raw: Raw): ProtectInventoryEntry => ({ modelKey, id: raw.id, raw });
const snapshot = (entries: ProtectInventoryEntry[], complete = true): ProtectSnapshot => ({ complete, entries });
const frameOf = (line: string): ProtectFrame => {
	const parsed = parseProtectFrame(line);

	if (!('frame' in parsed)) {
		throw new Error('fixture line rejected');
	}

	return parsed.frame;
};
const frameFor = (type: 'add' | 'update' | 'remove', item: Raw): ProtectFrame =>
	frameOf(JSON.stringify({ type, item }));
const lineWith = (needle: string): ProtectFrame => frameOf(deviceLines.find((line) => line.includes(needle)));

const propertyId = (panelId: string, channel: string, mappingName: string): string =>
	`${panelId}|${channel}|${mappingName}`;

describe('ProtectSynchronizerService', () => {
	let service: ProtectSynchronizerService;
	let stored: Map<string, string | number | boolean | null>;
	let devices: Raw[];
	let devicesService: { findAll: jest.Mock; update: jest.Mock };
	let properties: { update: jest.Mock };
	let connectivity: { trySetConnectionState: jest.Mock };
	let propertyValue: { readLatestPersisted: jest.Mock };
	let notifications: { notify: jest.Mock; resolve: jest.Mock };
	let logged: unknown[][];

	const adopt = (
		golden: Raw,
		panelId: string,
		overrides: Partial<{ name: string; protectNvrId: string; enabled: boolean }> = {},
	): Raw => {
		const channels = golden.channels.map((channel: Raw) => ({
			id: `${panelId}|${channel.identifier}`,
			identifier: channel.identifier,
			properties: channel.properties.map((property: Raw) => {
				const id = propertyId(panelId, channel.identifier, property.mappingName);

				stored.set(id, property.value);

				return {
					id,
					identifier: property.identifier,
					type: DEVICES_UNIFI_PROTECT_TYPE,
					protectMappingName: property.mappingName,
				};
			}),
		}));

		return {
			id: panelId,
			type: DEVICES_UNIFI_PROTECT_TYPE,
			enabled: overrides.enabled ?? true,
			name: overrides.name ?? golden.name,
			identifier: golden.identifier,
			protectNvrId: overrides.protectNvrId ?? golden.protectNvrId,
			protectDeviceId: golden.protectDeviceId,
			protectModelKey: golden.protectModelKey,
			channels,
		};
	};

	const prop = (panelId: string, channel: string, mappingName: string): string =>
		propertyId(panelId, channel, mappingName);
	const updatedIds = (): string[] => properties.update.mock.calls.map((call) => call[0] as string);
	const sensorSnapshot = (patch: Raw = {}): ProtectSnapshot => snapshot([entry('sensor', { ...sensors[0], ...patch })]);

	beforeEach(() => {
		jest.restoreAllMocks();
		logged = [];

		for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args);
			});
		}

		stored = new Map();
		devices = [adopt(goldenCamera, CAMERA_PANEL), adopt(goldenSensor, SENSOR_PANEL)];
		devicesService = { findAll: jest.fn(() => Promise.resolve(devices)), update: jest.fn(() => Promise.resolve({})) };
		properties = { update: jest.fn(() => Promise.resolve({})) };
		connectivity = { trySetConnectionState: jest.fn(() => Promise.resolve(true)) };
		propertyValue = {
			readLatestPersisted: jest.fn((property: Raw) => Promise.resolve({ value: stored.get(property.id) ?? null })),
		};
		notifications = { notify: jest.fn(() => Promise.resolve(null)), resolve: jest.fn(() => Promise.resolve(true)) };

		const loader = new ProtectMappingLoaderService();

		loader.onModuleInit();
		service = new ProtectSynchronizerService(
			loader,
			devicesService as never,
			properties as never,
			connectivity as never,
			propertyValue as never,
			notifications as never,
		);
	});

	const prime = async (): Promise<void> => {
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]));
		properties.update.mockClear();
		connectivity.trySetConnectionState.mockClear();
		devicesService.update.mockClear();
	};

	it('writes only values that differ from the stored ones on a snapshot', async () => {
		await service.applySnapshot(
			IDENTITY,
			snapshot([entry('camera', { ...cameras[0], ledSettings: { ...cameras[0].ledSettings, isEnabled: true } })]),
		);

		expect(properties.update).toHaveBeenCalledTimes(1);
		expect(properties.update).toHaveBeenCalledWith(prop(CAMERA_PANEL, 'indicator', 'camera_indicator_on'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: true,
		});
	});

	it('sets the connection state through the connectivity service', async () => {
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', { ...cameras[0], state: 'DISCONNECTED' })]));

		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(CAMERA_PANEL, { state: 'disconnected' });
		expect(updatedIds().some((id) => id.endsWith('connection_state'))).toBe(false);
	});

	it('applies a recorded device frame within the same tick of the queue', async () => {
		await prime();

		expect(service.enqueueFrame(IDENTITY, lineWith('"isOpened":true'))).toBe(true);
		await service.idle();

		expect(properties.update).toHaveBeenCalledTimes(1);
		expect(properties.update).toHaveBeenCalledWith(prop(SENSOR_PANEL, 'contact', 'contact_detected'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: true,
		});
	});

	it('updates illuminance and its level from one light-level frame', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, lineWith('"light":{"value":8}'));
		await service.idle();

		expect(properties.update).toHaveBeenCalledWith(prop(SENSOR_PANEL, 'illuminance', 'illuminance'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: 8,
		});
		expect(properties.update).toHaveBeenCalledWith(prop(SENSOR_PANEL, 'illuminance', 'illuminance_level'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: 'dark',
		});
		expect(properties.update).toHaveBeenCalledTimes(2);
	});

	it('never writes constants, templates or camera status from a frame', async () => {
		await prime();

		const guarded = [
			prop(CAMERA_PANEL, 'motion', 'camera_motion_detected'),
			prop(CAMERA_PANEL, 'camera.main', 'camera_main_source'),
			prop(CAMERA_PANEL, 'camera.main', 'camera_main_status'),
		];
		const baselines = (service as any).lastWritten as Map<string, unknown>;

		// Stored values that differ from what the constant, template and stream status would evaluate to.
		baselines.set(guarded[0], true);
		baselines.set(guarded[1], 'stale-source');
		baselines.set(guarded[2], 'unavailable');

		service.enqueueFrame(
			IDENTITY,
			frameFor('update', {
				id: CAMERA_ID,
				modelKey: 'camera',
				state: 'CONNECTED',
				name: 'Other',
				isMotionDetected: true,
				isSmartDetected: true,
			}),
		);
		await service.idle();

		expect(updatedIds().filter((id) => guarded.includes(id))).toEqual([]);
		expect(properties.update).not.toHaveBeenCalled();
	});

	it('resets a stored detection without an open event on every snapshot', async () => {
		const motion = prop(CAMERA_PANEL, 'motion', 'camera_motion_detected');

		devices = [adopt(goldenCamera, CAMERA_PANEL)];
		stored.set(motion, true);
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(properties.update).toHaveBeenCalledTimes(1);
		expect(properties.update).toHaveBeenCalledWith(motion, { type: DEVICES_UNIFI_PROTECT_TYPE, value: false });
	});

	it('clears tamper when the console reports it cleared', async () => {
		const contact = prop(SENSOR_PANEL, 'contact', 'contact_tampered');
		const motion = prop(SENSOR_PANEL, 'motion', 'sensor_motion_tampered');

		stored.set(contact, true);
		stored.set(motion, true);
		await service.applySnapshot(IDENTITY, sensorSnapshot({ tamperingDetectedAt: 1794400015000 }));

		expect(properties.update).not.toHaveBeenCalled();

		service.enqueueFrame(IDENTITY, lineWith('"tamperingDetectedAt":null'));
		await service.idle();

		expect(properties.update).toHaveBeenCalledWith(contact, { type: DEVICES_UNIFI_PROTECT_TYPE, value: false });
		expect(properties.update).toHaveBeenCalledWith(motion, { type: DEVICES_UNIFI_PROTECT_TYPE, value: false });
		expect(properties.update).toHaveBeenCalledTimes(2);
	});

	it('ignores an update for a device it never saw', async () => {
		await prime();
		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: 'ffffffffffffffffffffffff', modelKey: 'sensor', isOpened: true }),
		);
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();
		expect(service.getCounters().framesIgnored).toBe(1);
	});

	it('counts frames the parser rejected and frames of other model keys', async () => {
		service.countIgnoredFrame();
		service.enqueueFrame(IDENTITY, frameFor('update', { id: CAMERA_ID, modelKey: 'event' }));
		await service.idle();

		expect(service.getCounters().framesIgnored).toBe(2);
	});

	it('ignores devices of another console and disabled devices', async () => {
		devices = [
			adopt(goldenCamera, CAMERA_PANEL, { protectNvrId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
			adopt(goldenSensor, SENSOR_PANEL, { enabled: false }),
		];
		await service.applySnapshot(
			IDENTITY,
			snapshot([
				entry('camera', { ...cameras[0], state: 'DISCONNECTED' }),
				entry('sensor', { ...sensors[0], isOpened: true }),
			]),
		);

		expect(properties.update).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
		expect(notifications.notify).not.toHaveBeenCalled();
	});

	it('marks a removed device disconnected and notifies once', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, lineWith('"type":"remove","item":{"id":"5f0000000000000000000b01"'));
		await service.idle();

		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(SENSOR_PANEL, {
			state: ConnectionState.DISCONNECTED,
		});
		expect(notifications.notify).toHaveBeenCalledTimes(1);
		expect(notifications.notify).toHaveBeenCalledWith(
			expect.objectContaining({
				source: DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
				kind: 'issue',
				key: REMOVAL_KEY,
				severity: 'warning',
				title: 'UniFi Protect device removed',
				data: { device_id: SENSOR_PANEL, protect_device_id: SENSOR_ID },
			}),
		);

		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(notifications.notify).toHaveBeenCalledTimes(1);
	});

	it('resolves the removal when the device reappears', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();
		service.enqueueFrame(IDENTITY, frameFor('add', sensors[0]));
		await service.idle();

		expect(notifications.resolve).toHaveBeenCalledWith(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, REMOVAL_KEY);
		expect(connectivity.trySetConnectionState).toHaveBeenLastCalledWith(SENSOR_PANEL, { state: 'connected' });
	});

	it('marks a device missing from a complete snapshot and keeps it on an incomplete one', async () => {
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])], false));

		expect(notifications.notify).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalledWith(SENSOR_PANEL, expect.anything());

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])], true));

		expect(notifications.notify).toHaveBeenCalledTimes(1);
		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(SENSOR_PANEL, { state: 'disconnected' });
	});

	it('never marks devices removed from an incomplete snapshot', async () => {
		await service.applySnapshot(IDENTITY, snapshot([], false));

		expect(notifications.notify).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('keeps the first entry per model key and id in a snapshot', async () => {
		await service.applySnapshot(
			IDENTITY,
			snapshot([
				entry('sensor', { ...sensors[0], isOpened: true }),
				entry('sensor', { ...sensors[0], isOpened: false }),
			]),
		);

		expect(properties.update).toHaveBeenCalledWith(prop(SENSOR_PANEL, 'contact', 'contact_detected'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: true,
		});
	});

	it('propagates a Protect rename only while the Smart Panel name is the derived one', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, lineWith('"name":"Front porch"'));
		await service.idle();

		expect(devicesService.update).toHaveBeenCalledTimes(1);
		expect(devicesService.update).toHaveBeenCalledWith(CAMERA_PANEL, {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			name: 'Front porch',
		});

		devices = [adopt(goldenCamera, CAMERA_PANEL, { name: 'My cam' })];
		service.invalidateIndex();
		devicesService.update.mockClear();
		service.enqueueFrame(IDENTITY, frameFor('update', { id: CAMERA_ID, modelKey: 'camera', name: 'Garage' }));
		await service.idle();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	it('keeps the last value when a write fails, logs a fixed text and retries on an identical frame', async () => {
		await prime();
		properties.update.mockRejectedValueOnce(new Error('SENTINEL detail'));
		const frame = lineWith('"ledSettings":{"isEnabled":true}');

		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(service.getCounters().writesFailed).toBe(1);
		expect(logged.some((args) => args[0] === `[ProtectSynchronizerService] ${FAILURE_TEXT}`)).toBe(true);
		expect(JSON.stringify(logged)).not.toContain('SENTINEL');

		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).toHaveBeenCalledTimes(2);
		expect(service.getCounters().writesFailed).toBe(1);

		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).toHaveBeenCalledTimes(2);
	});

	it('rebuilds the index after a device is created', async () => {
		devices = [];
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
		devices = [adopt(goldenCamera, CAMERA_PANEL)];

		const frame = frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } });

		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();

		service.invalidateIndex();
		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).toHaveBeenCalledWith(prop(CAMERA_PANEL, 'indicator', 'camera_indicator_on'), {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			value: true,
		});
	});

	it('never marks a device without a stored model key removed while the console lists it', async () => {
		devices = [adopt({ ...goldenSensor, protectModelKey: null }, SENSOR_PANEL)];
		await service.applySnapshot(IDENTITY, snapshot([entry('sensor', sensors[0])]));

		expect(notifications.notify).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalledWith(SENSOR_PANEL, {
			state: ConnectionState.DISCONNECTED,
		});

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(notifications.notify).toHaveBeenCalledTimes(1);
	});

	it('writes nothing after a reset that happens while a write is in flight', async () => {
		let release: () => void = () => undefined;

		properties.update.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));

		const pending = service.applySnapshot(
			IDENTITY,
			snapshot([entry('camera', { ...cameras[0], state: 'DISCONNECTED', ledSettings: { isEnabled: true } })]),
		);

		await new Promise((resolve) => setImmediate(resolve));
		expect(properties.update).toHaveBeenCalledTimes(1);

		service.reset();
		release();
		await pending;
		await service.idle();

		expect(properties.update).toHaveBeenCalledTimes(1);
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
		expect((service as any).lastWritten.size).toBe(0);
		expect((service as any).lastState.size).toBe(0);
	});

	it('keeps no index after a reset that happens while the index is being built', async () => {
		let release: (value: Raw[]) => void = () => undefined;

		devicesService.findAll.mockImplementationOnce(() => new Promise<Raw[]>((resolve) => (release = resolve)));

		const pending = service.applySnapshot(
			IDENTITY,
			snapshot([entry('camera', { ...cameras[0], state: 'DISCONNECTED' })]),
		);

		await new Promise((resolve) => setImmediate(resolve));
		service.reset();
		release(devices);
		await pending;
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
		expect((service as any).index.size).toBe(0);
		expect((service as any).indexNvrId).toBeNull();
		expect((service as any).lastWritten.size).toBe(0);
	});

	it('refuses frames beyond the queue limit', async () => {
		await prime();
		properties.update.mockImplementation(() => new Promise(() => undefined));

		const frame = frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } });

		for (let index = 0; index < 1000; index++) {
			expect(service.enqueueFrame(IDENTITY, frame)).toBe(true);
		}

		expect(service.enqueueFrame(IDENTITY, frame)).toBe(false);

		service.reset();
	});

	it('reset drops caches and writes nothing', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, lineWith('"isOpened":true'));
		service.reset();
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();

		service.enqueueFrame(IDENTITY, lineWith('"isOpened":true'));
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();
		expect(service.getCounters().framesIgnored).toBe(1);
	});
});
