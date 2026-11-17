/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { readFileSync } from 'fs';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';

import { ProtectFrame, parseProtectFrame, valueKey } from './protect-frame-merge';
import { ProtectInventoryEntry } from './protect-inventory.service';
import { ProtectStreamAvailabilityStore } from './protect-stream-availability.store';
import { ProtectSnapshot, ProtectSynchronizerService } from './protect-synchronizer.service';

type Raw = Record<string, any>;

const FIXTURES = join(__dirname, '..', '__fixtures__');
const read = (name: string): any => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
const cameras = read('cameras.json') as Raw[];
const sensors = read('sensors.json') as Raw[];
const nvrs = read('nvrs.json') as Raw;
const goldenCamera = read('expected/camera.json') as Raw;
const goldenSensor = read('expected/sensor.json') as Raw;
const goldenLeak = read('expected/sensor-leak.json') as Raw;
const goldenDoorbell = read('expected/doorbell.json') as Raw;
const goldenPackage = read('expected/doorbell-package.json') as Raw;
const doorbells = read('cameras-doorbell.json') as Raw[];
const goldenFloodlight = read('expected/floodlight.json') as Raw;
const lights = read('lights.json') as Raw[];
const eventLines = readFileSync(join(FIXTURES, 'ws-events.jsonl'), 'utf8')
	.split('\n')
	.filter((line) => line.trim() !== '');
const deviceLines = readFileSync(join(FIXTURES, 'ws-devices.jsonl'), 'utf8')
	.split('\n')
	.filter((line) => line.trim() !== '');

const IDENTITY = { nvrId: nvrs.id as string, nvrMacKey: '0cea14003a69' };
const CAMERA_ID = cameras[0].id as string;
const SENSOR_ID = sensors[0].id as string;
const CAMERA_PANEL = '11111111-1111-4111-8111-111111111111';
const SENSOR_PANEL = '22222222-2222-4222-8222-222222222222';
const DOORBELL_PANEL = '33333333-3333-4333-8333-333333333333';
const LIGHT_PANEL = '44444444-4444-4444-8444-444444444444';
const LIGHT_ID = lights[0].id as string;
const eventId = (suffix: string): string => `5f00000000000000000e${suffix}`;
const eventFrame = (suffix: string, type: 'add' | 'update'): ProtectFrame =>
	frameOf(eventLines.find((line) => line.includes(`"type":"${type}"`) && line.includes(`"id":"${eventId(suffix)}"`)));
const REMOVAL_KEY = `device_removed:${SENSOR_ID}`;
const FAILURE_TEXT = 'UniFi Protect property update failed';

const entry = (modelKey: 'camera' | 'sensor' | 'light', raw: Raw): ProtectInventoryEntry => ({
	modelKey,
	id: raw.id,
	raw,
});
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
	let occurrences: { publishOccurrence: jest.Mock };
	let logged: unknown[][];
	let streamStore: ProtectStreamAvailabilityStore;

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
		notifications = {
			notify: jest.fn(() => Promise.resolve({ id: 'notification-1' })),
			resolve: jest.fn(() => Promise.resolve(true)),
		};
		occurrences = { publishOccurrence: jest.fn(() => Promise.resolve({})) };

		const loader = new ProtectMappingLoaderService();

		loader.onModuleInit();
		streamStore = new ProtectStreamAvailabilityStore();
		service = new ProtectSynchronizerService(
			loader,
			devicesService as never,
			properties as never,
			connectivity as never,
			propertyValue as never,
			notifications as never,
			occurrences as never,
			streamStore,
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

	it('writes nothing when the same unchanged snapshot is applied twice', async () => {
		const unchanged = snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]);

		await service.applySnapshot(IDENTITY, unchanged);
		properties.update.mockClear();
		await service.applySnapshot(IDENTITY, unchanged);

		expect(updatedIds()).toEqual([]);
	});

	it('writes nothing for an update frame that only moves lastSeen', async () => {
		await prime();

		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', lastSeen: 1_700_000_000_000 }),
		);
		await service.idle();

		expect(updatedIds()).toEqual([]);
	});

	it('sets the connection state through the connectivity service', async () => {
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', { ...cameras[0], state: 'DISCONNECTED' })]));

		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(CAMERA_PANEL, { state: 'disconnected' });
		expect(updatedIds().some((id) => id.endsWith('connection_state'))).toBe(false);
	});

	it('re-asserts the connection state on every snapshot so a change by another writer is repaired', async () => {
		const connected = snapshot([entry('camera', cameras[0])]);
		await service.applySnapshot(IDENTITY, connected);
		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(CAMERA_PANEL, { state: 'connected' });

		// Another writer (e.g. re-adoption) persists `disconnected`; the next snapshot must still report `connected`.
		connectivity.trySetConnectionState.mockClear();
		await service.applySnapshot(IDENTITY, connected);

		expect(connectivity.trySetConnectionState).toHaveBeenCalledWith(CAMERA_PANEL, { state: 'connected' });
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

	describe('camera stream status', () => {
		const MAIN = prop(CAMERA_PANEL, 'camera.main', 'camera_main_status');
		const baselines = (): Map<string, unknown> => (service as any).lastWritten as Map<string, unknown>;
		const statusFrame = (state: string): ProtectFrame =>
			frameFor('update', { id: CAMERA_ID, modelKey: 'camera', state });
		const writtenValue = (id: string): unknown =>
			properties.update.mock.calls.find((call) => call[0] === id)?.[1]?.value;

		it('writes offline when a camera disconnects', async () => {
			await prime();
			service.enqueueFrame(IDENTITY, statusFrame('DISCONNECTED'));
			await service.idle();

			expect(properties.update).toHaveBeenCalledWith(MAIN, { type: DEVICES_UNIFI_PROTECT_TYPE, value: 'offline' });
			expect(streamStore.get(CAMERA_ID)).toBeNull();
		});

		it('writes initializing while a camera connects', async () => {
			await prime();
			service.enqueueFrame(IDENTITY, statusFrame('CONNECTING'));
			await service.idle();

			expect(properties.update).toHaveBeenCalledWith(MAIN, {
				type: DEVICES_UNIFI_PROTECT_TYPE,
				value: 'initializing',
			});
		});

		it('keeps the stored stream status while availability is unknown', async () => {
			await prime();
			baselines().set(MAIN, 'offline');
			service.enqueueFrame(IDENTITY, statusFrame('CONNECTED'));
			await service.idle();

			expect(updatedIds()).not.toContain(MAIN);
		});

		it('writes available and unavailable from known availability', async () => {
			await prime();
			baselines().set(MAIN, 'offline');
			streamStore.set(CAMERA_ID, { high: true, medium: false, low: false, package: false });

			await expect(service.refreshDevice(IDENTITY, 'camera', CAMERA_ID)).resolves.toBe(true);
			expect(writtenValue(MAIN)).toBe('available');

			properties.update.mockClear();
			streamStore.set(CAMERA_ID, { high: false, medium: false, low: false, package: false });
			await service.refreshDevice(IDENTITY, 'camera', CAMERA_ID);

			expect(writtenValue(MAIN)).toBe('unavailable');
			expect(service.getDeviceSequence('camera', CAMERA_ID)).toBe(1);
		});

		it('does not notify observers or write the cache on a refresh', async () => {
			const observer = jest.fn();

			await prime();
			service.observeDevices(observer);
			baselines().set(MAIN, 'offline');
			streamStore.set(CAMERA_ID, { high: true, medium: false, low: false, package: false });
			const before = service.getCachedDevice('camera', CAMERA_ID);
			await service.refreshDevice(IDENTITY, 'camera', CAMERA_ID);

			expect(observer).not.toHaveBeenCalled();
			expect(service.getCachedDevice('camera', CAMERA_ID)).toBe(before);
		});

		it('writes the package status from the package stream', async () => {
			const packageId = doorbells[1].id as string;
			const packageMain = prop(DOORBELL_PANEL, 'camera.main', 'camera_main_status');
			const packagePackage = prop(DOORBELL_PANEL, 'camera.package', 'camera_package_status');

			devices = [adopt(goldenPackage, DOORBELL_PANEL)];
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', doorbells[1])]));
			properties.update.mockClear();
			baselines().set(packageMain, 'offline');
			baselines().set(packagePackage, 'offline');
			streamStore.set(packageId, { high: false, medium: true, low: false, package: false });

			await service.refreshDevice(IDENTITY, 'camera', packageId);

			expect(writtenValue(packageMain)).toBe('available');
			expect(writtenValue(packagePackage)).toBe('unavailable');
		});

		it('never writes the source template', async () => {
			const source = prop(CAMERA_PANEL, 'camera.main', 'camera_main_source');

			await prime();
			baselines().set(source, 'stale-source');
			baselines().set(MAIN, 'offline');
			streamStore.set(CAMERA_ID, { high: true, medium: true, low: true, package: true });
			await service.refreshDevice(IDENTITY, 'camera', CAMERA_ID);
			service.enqueueFrame(IDENTITY, statusFrame('DISCONNECTED'));
			await service.idle();

			expect(updatedIds()).not.toContain(source);
		});

		it('does not notify observers when a status write fails', async () => {
			const observer = jest.fn();

			await prime();
			service.observeDevices(observer);
			properties.update.mockRejectedValue(new Error('write failed'));
			service.enqueueFrame(IDENTITY, statusFrame('DISCONNECTED'));
			await service.idle();

			expect(observer).not.toHaveBeenCalled();
		});

		it('refreshes nothing for an unadopted or uncached device', async () => {
			await expect(service.refreshDevice(IDENTITY, 'camera', CAMERA_ID)).resolves.toBe(false);

			await prime();
			properties.update.mockClear();

			await expect(service.refreshDevice(IDENTITY, 'camera', 'ffffffffffffffffffffffff')).resolves.toBe(false);
			await expect(service.refreshDevice(IDENTITY, 'light', CAMERA_ID)).resolves.toBe(false);
			expect(properties.update).not.toHaveBeenCalled();
		});

		it('reports adoption', async () => {
			await prime();

			expect(service.isAdopted('camera', CAMERA_ID)).toBe(true);
			expect(service.isAdopted('camera', 'ffffffffffffffffffffffff')).toBe(false);
			expect(service.isAdopted('light', CAMERA_ID)).toBe(false);
		});
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

	it('never treats the cache cap as a removal for an adopted device listed beyond the limit', async () => {
		const filler = Array.from({ length: 4096 }, (_, index) =>
			entry('sensor', { ...sensors[0], id: `5f00000000000000ff${String(index).padStart(6, '0')}` }),
		);

		await service.applySnapshot(
			IDENTITY,
			snapshot([...filler, entry('camera', cameras[0]), entry('sensor', sensors[0])]),
		);

		expect(connectivity.trySetConnectionState).not.toHaveBeenCalledWith(SENSOR_PANEL, {
			state: ConnectionState.DISCONNECTED,
		});
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalledWith(CAMERA_PANEL, {
			state: ConnectionState.DISCONNECTED,
		});
		expect(notifications.notify).not.toHaveBeenCalled();
		expect((service as any).cache.size).toBe(4096);
		expect((service as any).cache.has(`sensor\u0000${SENSOR_ID}`)).toBe(true);
		expect((service as any).cache.has(`camera\u0000${CAMERA_ID}`)).toBe(true);

		properties.update.mockClear();
		service.enqueueFrame(IDENTITY, frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', isOpened: true }));
		await service.idle();

		expect(properties.update).toHaveBeenCalled();
	});

	describe('device add frames at the cache cap', () => {
		const fullCache = async (): Promise<void> => {
			const filler = Array.from({ length: 4096 }, (_, index) =>
				entry('sensor', { ...sensors[0], id: `5f00000000000000ff${String(index).padStart(6, '0')}` }),
			);

			await service.applySnapshot(IDENTITY, snapshot(filler, false));

			expect((service as any).cache.size).toBe(4096);
		};

		it('admits an adopted device by evicting an unadopted entry', async () => {
			await fullCache();

			service.enqueueFrame(IDENTITY, frameFor('add', sensors[0]));
			await service.idle();

			expect((service as any).cache.has(`sensor\u0000${SENSOR_ID}`)).toBe(true);
			expect((service as any).cache.size).toBe(4096);

			properties.update.mockClear();
			service.enqueueFrame(IDENTITY, frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', isOpened: true }));
			await service.idle();

			expect(properties.update).toHaveBeenCalled();
		});

		it('still discards an unadopted device', async () => {
			await fullCache();

			const id = '5f0000000000000000aaaa01';

			service.enqueueFrame(IDENTITY, frameFor('add', { ...sensors[0], id }));
			await service.idle();

			expect((service as any).cache.has(`sensor\u0000${id}`)).toBe(false);
			expect((service as any).cache.size).toBe(4096);
		});
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
		service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
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

	it('prunes the per-device and per-property bookkeeping of devices that left the index', async () => {
		await prime();

		const internals = service as any;
		const gone = SENSOR_ID;
		const kept = CAMERA_ID;
		const retry = { propertyId: 'x', value: true };

		for (const id of [gone, kept]) {
			internals.propagatedNames.set(id, 'Name');
			internals.eventOwned.set(id, new Map([['k', 'p']]));
			internals.removed.add(id);
			internals.removalNotifyPending.add(id);
			internals.removalChecked.add(id);
			internals.retries.set(id, [retry]);
		}

		const goneProperty = prop(SENSOR_PANEL, 'contact', 'contact_detected');
		const keptProperty = prop(CAMERA_PANEL, 'indicator', 'camera_indicator_on');

		internals.lastWritten.set(goneProperty, true);
		internals.lastWritten.set(keptProperty, true);
		internals.lastWritten.set('orphan-property', true);

		devices = devices.filter((device) => device.id !== SENSOR_PANEL);
		service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
		await internals.ensureIndex(IDENTITY);

		for (const name of [
			'propagatedNames',
			'eventOwned',
			'removed',
			'removalNotifyPending',
			'removalChecked',
			'retries',
		]) {
			const collection = internals[name] as Map<string, unknown> | Set<string>;

			expect(collection.has(gone)).toBe(false);
			expect(collection.has(kept)).toBe(true);
		}

		expect(internals.lastWritten.has(goneProperty)).toBe(false);
		expect(internals.lastWritten.has('orphan-property')).toBe(false);
		expect(internals.lastWritten.has(keptProperty)).toBe(true);
	});

	it('rebuilds the index after a device is created', async () => {
		devices = [];
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
		devices = [adopt(goldenCamera, CAMERA_PANEL)];

		const frame = frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } });

		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();

		service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
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

	it('drops a snapshot that a reset overtakes while the index is being read', async () => {
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

		expect((service as any).cache.size).toBe(0);
		expect(properties.update).not.toHaveBeenCalled();
		expect(connectivity.trySetConnectionState).not.toHaveBeenCalled();
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

	it('bumps the snapshot sequence for every snapshot, as soon as it is enqueued', async () => {
		expect(service.getSnapshotSequence()).toBe(0);

		const first = service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(service.getSnapshotSequence()).toBe(1);

		await first;
		await service.applySnapshot(IDENTITY, snapshot([], false));

		expect(service.getSnapshotSequence()).toBe(2);
	});

	it('resolves a removal issue raised before a reset when the device is seen again', async () => {
		await prime();
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(notifications.notify).toHaveBeenCalledTimes(1);

		service.reset();
		notifications.resolve.mockClear();
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]));

		expect(notifications.resolve).toHaveBeenCalledWith(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, REMOVAL_KEY);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]));

		expect(notifications.resolve.mock.calls.filter((call) => call[1] === REMOVAL_KEY)).toHaveLength(1);
	});

	it('retries a failed removal resolve on the next sync of the device', async () => {
		await prime();
		service.reset();
		notifications.resolve.mockClear();
		notifications.resolve.mockRejectedValueOnce(new Error('down'));
		await service.applySnapshot(IDENTITY, snapshot([entry('sensor', sensors[0])]));
		await service.applySnapshot(IDENTITY, snapshot([entry('sensor', sensors[0])]));
		await service.applySnapshot(IDENTITY, snapshot([entry('sensor', sensors[0])]));

		expect(notifications.resolve.mock.calls.filter((call) => call[1] === REMOVAL_KEY)).toHaveLength(2);
	});

	it('retries a failed disconnected write for a removed device on the next snapshot, notifying once', async () => {
		await prime();
		const sensorCalls = (): unknown[] =>
			connectivity.trySetConnectionState.mock.calls.filter((call) => call[0] === SENSOR_PANEL);
		connectivity.trySetConnectionState.mockResolvedValueOnce(false);
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(sensorCalls()).toHaveLength(1);
		expect(notifications.notify).toHaveBeenCalledTimes(1);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(sensorCalls()).toHaveLength(2);
		expect(connectivity.trySetConnectionState).toHaveBeenLastCalledWith(SENSOR_PANEL, { state: 'disconnected' });
		expect(notifications.notify).toHaveBeenCalledTimes(1);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		// Re-asserted on every removal; the connectivity service drops the write when the stored state already matches.
		expect(sensorCalls()).toHaveLength(3);
		expect(notifications.notify).toHaveBeenCalledTimes(1);
	});

	it('reasserts disconnected on every removal snapshot after another writer reconnects the device', async () => {
		await prime();
		const sensorCalls = (): unknown[] =>
			connectivity.trySetConnectionState.mock.calls.filter((call) => call[0] === SENSOR_PANEL);
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(sensorCalls()).toHaveLength(1);
		expect(notifications.notify).toHaveBeenCalledTimes(1);

		// Another writer (an in-flight adoption) sets the device connected; the persisted-state compare lives in the
		// connectivity service, so the synchronizer has to ask again on every confirmed removal.
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(sensorCalls()).toHaveLength(2);
		expect(connectivity.trySetConnectionState).toHaveBeenLastCalledWith(SENSOR_PANEL, {
			state: ConnectionState.DISCONNECTED,
		});
		expect(notifications.notify).toHaveBeenCalledTimes(1);
	});

	it('retries a removal notification that failed on a later removal snapshot', async () => {
		await prime();
		notifications.notify.mockRejectedValueOnce(new Error('storage down'));
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(notifications.notify).toHaveBeenCalledTimes(1);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(notifications.notify).toHaveBeenCalledTimes(2);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(notifications.notify).toHaveBeenCalledTimes(2);
	});

	it('keeps the removal marker when notify returns null and retries on the next removal snapshot', async () => {
		await prime();
		notifications.notify.mockResolvedValueOnce(null);
		service.enqueueFrame(IDENTITY, frameFor('remove', { id: SENSOR_ID, modelKey: 'sensor' }));
		await service.idle();

		expect(notifications.notify).toHaveBeenCalledTimes(1);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(notifications.notify).toHaveBeenCalledTimes(2);

		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));

		expect(notifications.notify).toHaveBeenCalledTimes(2);
	});

	it('retries a failed rename on the next frame until it lands', async () => {
		await prime();
		devicesService.update.mockRejectedValueOnce(new Error('db down'));
		service.enqueueFrame(IDENTITY, lineWith('"name":"Front porch"'));
		await service.idle();

		expect(devicesService.update).toHaveBeenCalledTimes(1);

		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } }),
		);
		await service.idle();

		expect(devicesService.update).toHaveBeenCalledTimes(2);
		expect(devicesService.update).toHaveBeenLastCalledWith(CAMERA_PANEL, {
			type: DEVICES_UNIFI_PROTECT_TYPE,
			name: 'Front porch',
		});

		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: false } }),
		);
		await service.idle();

		expect(devicesService.update).toHaveBeenCalledTimes(2);
	});

	it('stops retrying a failed rename once the user renamed the device', async () => {
		await prime();
		devicesService.update.mockRejectedValueOnce(new Error('db down'));
		service.enqueueFrame(IDENTITY, lineWith('"name":"Front porch"'));
		await service.idle();

		devices = [adopt(goldenCamera, CAMERA_PANEL, { name: 'My cam' })];
		service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
		devicesService.update.mockClear();
		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } }),
		);
		await service.idle();

		expect(devicesService.update).not.toHaveBeenCalled();
	});

	it('keeps the rename state cleared when a rename rejects after a reset', async () => {
		await prime();
		let reject: (error: Error) => void = () => undefined;

		devicesService.update.mockImplementationOnce(() => new Promise<void>((_, rejectWrite) => (reject = rejectWrite)));
		service.enqueueFrame(IDENTITY, lineWith('"name":"Front porch"'));
		await new Promise((resolve) => setImmediate(resolve));
		expect(devicesService.update).toHaveBeenCalledTimes(1);

		service.reset();
		reject(new Error('db down'));
		await service.idle();

		expect((service as any).propagatedNames.size).toBe(0);
	});

	it('does not rebuild the index for events of another plugin', async () => {
		devices = [];
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
		devices = [adopt(goldenCamera, CAMERA_PANEL)];

		const frame = frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } });

		service.invalidateIndex({ type: 'other-plugin' });
		service.enqueueFrame(IDENTITY, frame);
		await service.idle();

		expect(properties.update).not.toHaveBeenCalled();
		expect(devicesService.findAll).toHaveBeenCalledTimes(1);
	});

	it.each([EventType.CHANNEL_DELETED, EventType.CHANNEL_PROPERTY_DELETED])(
		'rebuilds the index on %s even when the spread payload lost its type',
		async (eventType) => {
			const listened = (
				Reflect.getMetadata('EVENT_LISTENER_METADATA', (service as any).invalidateIndexOnDelete) as {
					event: string;
				}[]
			).map((metadata) => metadata.event);

			expect(listened).toContain(eventType);

			devices = [];
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
			devices = [adopt(goldenCamera, CAMERA_PANEL)];

			const spreadLike = { ...{ id: 'channel-1' } };

			expect(spreadLike).not.toHaveProperty('type');

			// The core emits `{ ...entity }` copies; the TypeORM `type` discriminator is a prototype getter.
			service.invalidateIndexOnDelete();
			service.enqueueFrame(
				IDENTITY,
				frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } }),
			);
			await service.idle();

			expect(devicesService.findAll).toHaveBeenCalledTimes(2);
		},
	);

	it('keeps the index for a non-delete event whose payload type is another plugin', async () => {
		devices = [];
		await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
		devices = [adopt(goldenCamera, CAMERA_PANEL)];

		service.invalidateIndex({ type: 'other-plugin' });
		service.enqueueFrame(
			IDENTITY,
			frameFor('update', { id: CAMERA_ID, modelKey: 'camera', ledSettings: { isEnabled: true } }),
		);
		await service.idle();

		expect(devicesService.findAll).toHaveBeenCalledTimes(1);
	});

	it('zeroes the counters on reset', async () => {
		await prime();
		service.countIgnoredFrame();
		properties.update.mockRejectedValueOnce(new Error('down'));
		service.enqueueFrame(IDENTITY, lineWith('"ledSettings":{"isEnabled":true}'));
		await service.idle();

		expect(service.getCounters().framesIgnored).toBe(1);
		expect(service.getCounters().writesFailed).toBe(1);

		service.reset();

		expect(service.getCounters()).toEqual({
			framesIgnored: 0,
			writesFailed: 0,
			ignoredEventCount: 0,
			ignoredEventTypes: new Map(),
		});
	});

	describe('values persisted elsewhere', () => {
		const contact = (): string => prop(SENSOR_PANEL, 'contact', 'contact_detected');
		const persisted = (type: string, value: boolean): Raw => ({ id: contact(), type, value: { value } });

		it('records a value written by another writer so an identical frame writes nothing', async () => {
			await prime();
			service.recordPersistedValue(persisted(DEVICES_UNIFI_PROTECT_TYPE, true) as never);
			service.enqueueFrame(IDENTITY, lineWith('"isOpened":true'));
			await service.idle();

			expect(properties.update).not.toHaveBeenCalled();
		});

		it('ignores the property of another plugin', async () => {
			await prime();
			service.recordPersistedValue(persisted('other-plugin', true) as never);
			service.enqueueFrame(IDENTITY, lineWith('"isOpened":true'));
			await service.idle();

			expect(properties.update).toHaveBeenCalledWith(contact(), { type: DEVICES_UNIFI_PROTECT_TYPE, value: true });
		});
	});

	describe('command hooks', () => {
		const OBSERVER_FAILURE_TEXT = 'UniFi Protect device observer failed';
		const brightness = (): string => prop(LIGHT_PANEL, 'light', 'light_brightness');
		const smoke = (): string => prop(CAMERA_PANEL, 'smoke', 'smoke_alarm_sound_detected');
		const ledFrame = (): ProtectFrame => lineWith('"ledLevel":3');
		const lightSnapshot = (): ProtectSnapshot => snapshot([entry('light', lights[0]), entry('camera', cameras[0])]);
		const withLevel = (ledLevel: number): ProtectInventoryEntry =>
			entry('light', { ...lights[0], lightDeviceSettings: { ...lights[0].lightDeviceSettings, ledLevel } });
		const brightnessValues = (): unknown[] =>
			properties.update.mock.calls
				.filter((call) => call[0] === brightness())
				.map((call) => (call[1] as { value: unknown }).value);

		beforeEach(() => {
			jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
			devices = [adopt(goldenFloodlight, LIGHT_PANEL), adopt(goldenCamera, CAMERA_PANEL)];
		});

		afterEach(() => {
			service.reset();
			jest.useRealTimers();
		});

		const primeLight = async (): Promise<void> => {
			await service.applySnapshot(IDENTITY, lightSnapshot());
			properties.update.mockClear();
			connectivity.trySetConnectionState.mockClear();
		};

		it('reports every cache write to observers after the device was stored', async () => {
			const observer = jest.fn();
			const writesSeen: number[] = [];

			service.observeDevices((modelKey, id, raw) => {
				writesSeen.push(properties.update.mock.calls.length);
				observer(modelKey, id, raw);
			});
			await primeLight();
			observer.mockClear();
			writesSeen.length = 0;

			service.enqueueFrame(IDENTITY, ledFrame());
			await service.idle();

			expect(observer).toHaveBeenCalledTimes(1);
			expect(observer.mock.calls[0][0]).toBe('light');
			expect(observer.mock.calls[0][1]).toBe(LIGHT_ID);
			expect(observer.mock.calls[0][2].lightDeviceSettings.ledLevel).toBe(3);
			// Notified after syncDevice: the brightness and indicator writes already happened.
			expect(writesSeen).toEqual([2]);
			expect(brightnessValues()).toEqual([50]);
		});

		it('reports snapshot entries and stops after unsubscribe', async () => {
			const observer = jest.fn();
			const unsubscribe = service.observeDevices(observer);

			await service.applySnapshot(IDENTITY, lightSnapshot());

			expect(observer.mock.calls.map((call) => `${call[0]}:${call[1]}`).sort()).toEqual(
				[`camera:${CAMERA_ID}`, `light:${LIGHT_ID}`].sort(),
			);

			unsubscribe();
			observer.mockClear();
			service.enqueueFrame(IDENTITY, ledFrame());
			await service.idle();

			expect(observer).not.toHaveBeenCalled();
		});

		it('serves the cached object and its sequence', async () => {
			await primeLight();

			expect(service.getCachedDevice('light', LIGHT_ID)).toEqual(lights[0]);
			expect(service.getDeviceSequence('light', LIGHT_ID)).toBe(1);

			service.enqueueFrame(IDENTITY, ledFrame());
			await service.idle();

			expect(service.getDeviceSequence('light', LIGHT_ID)).toBe(2);
			expect(service.getCachedDevice('light', LIGHT_ID)?.lightDeviceSettings).toMatchObject({ ledLevel: 3 });
			expect(service.getCachedDevice('light', 'ffffffffffffffffffffffff')).toBeNull();
			expect(service.getDeviceSequence('light', 'ffffffffffffffffffffffff')).toBe(0);
		});

		it('serves the object last passed to the observers and clears it with the cache entry', async () => {
			expect(service.getStoredDevice('light', LIGHT_ID)).toBeNull();

			await primeLight();

			expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(lights[0]);
			expect(service.getStoredDevice('light', LIGHT_ID)).toBe(service.getCachedDevice('light', LIGHT_ID));

			service.enqueueFrame(IDENTITY, ledFrame());
			await service.idle();

			expect(service.getStoredDevice('light', LIGHT_ID)?.lightDeviceSettings).toMatchObject({ ledLevel: 3 });

			service.enqueueFrame(IDENTITY, frameFor('remove', { id: LIGHT_ID, modelKey: 'light' }));
			await service.idle();

			expect(service.getStoredDevice('light', LIGHT_ID)).toBeNull();

			await primeLight();
			expect(service.getStoredDevice('light', LIGHT_ID)).not.toBeNull();

			service.reset();
			expect(service.getStoredDevice('light', LIGHT_ID)).toBeNull();
		});

		it('moves the sequence when a device is removed, so an older readback is discarded', async () => {
			await primeLight();

			const since = service.getDeviceSequence('light', LIGHT_ID);

			service.enqueueFrame(IDENTITY, frameFor('remove', { id: LIGHT_ID, modelKey: 'light' }));
			await service.idle();

			expect(service.getCachedDevice('light', LIGHT_ID)).toBeNull();
			expect(service.getDeviceSequence('light', LIGHT_ID)).not.toBe(since);
			await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), since)).resolves.toBe(false);
			expect(service.getCachedDevice('light', LIGHT_ID)).toBeNull();
		});

		it('discards a readback requested before the device was removed and added again', async () => {
			await primeLight();

			const since = service.getDeviceSequence('light', LIGHT_ID);

			service.enqueueFrame(IDENTITY, frameFor('remove', { id: LIGHT_ID, modelKey: 'light' }));
			service.enqueueFrame(IDENTITY, frameFor('add', { ...lights[0], name: 'Re-added floodlight' }));
			await service.idle();

			const readded = service.getCachedDevice('light', LIGHT_ID);

			expect(readded?.name).toBe('Re-added floodlight');
			expect(service.getDeviceSequence('light', LIGHT_ID)).not.toBe(since);
			properties.update.mockClear();

			await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), since)).resolves.toBe(false);

			expect(service.getCachedDevice('light', LIGHT_ID)).toBe(readded);
			expect(properties.update).not.toHaveBeenCalled();
		});

		describe('a failed property write', () => {
			const previousLight = (): Raw => lights[0];

			it('neither stores nor announces an add frame for an adopted device', async () => {
				const observer = jest.fn();

				await primeLight();
				service.observeDevices(observer);
				properties.update.mockRejectedValueOnce(new Error('down'));

				service.enqueueFrame(IDENTITY, frameFor('add', withLevel(2).raw));
				await service.idle();

				expect(properties.update).toHaveBeenCalledTimes(1);
				expect(observer).not.toHaveBeenCalled();
				expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(previousLight());
			});

			it('neither stores nor announces an update frame for an adopted device', async () => {
				const observer = jest.fn();

				await primeLight();
				service.observeDevices(observer);
				properties.update.mockRejectedValueOnce(new Error('down'));

				service.enqueueFrame(IDENTITY, ledFrame());
				await service.idle();

				expect(properties.update).toHaveBeenCalled();
				expect(observer).not.toHaveBeenCalled();
				expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(previousLight());
			});

			it('skips only the failed adopted device in a snapshot and still announces an unadopted one', async () => {
				const observer = jest.fn();

				await primeLight();
				service.observeDevices(observer);
				properties.update.mockRejectedValueOnce(new Error('down'));

				await service.applySnapshot(
					IDENTITY,
					snapshot([withLevel(2), entry('camera', cameras[0]), entry('sensor', sensors[0])]),
				);

				const announced = observer.mock.calls.map((call) => `${call[0]}:${call[1]}`);

				expect(announced).not.toContain(`light:${LIGHT_ID}`);
				expect(announced).toContain(`sensor:${SENSOR_ID}`);
				expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(previousLight());
			});

			it('resolves a device readback false', async () => {
				await primeLight();

				const since = service.getDeviceSequence('light', LIGHT_ID);

				properties.update.mockRejectedValueOnce(new Error('down'));

				await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), since)).resolves.toBe(false);
				expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(previousLight());
			});

			it('writes the value and announces the device on a later sync carrying the same value', async () => {
				const observer = jest.fn();

				await primeLight();
				service.observeDevices(observer);
				properties.update.mockRejectedValueOnce(new Error('down'));
				service.enqueueFrame(IDENTITY, frameFor('add', withLevel(2).raw));
				await service.idle();
				properties.update.mockClear();

				service.enqueueFrame(IDENTITY, frameFor('add', withLevel(2).raw));
				await service.idle();

				expect(brightnessValues()).toEqual([33]);
				expect(observer).toHaveBeenCalledTimes(1);
				expect(service.getStoredDevice('light', LIGHT_ID)).toEqual(withLevel(2).raw);
			});
		});

		it('applies a device readback as an authoritative object', async () => {
			const observer = jest.fn();

			await primeLight();
			service.observeDevices(observer);

			const since = service.getDeviceSequence('light', LIGHT_ID);

			await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), since)).resolves.toBe(true);

			expect(properties.update).toHaveBeenCalledWith(brightness(), { type: DEVICES_UNIFI_PROTECT_TYPE, value: 33 });
			expect(observer).toHaveBeenCalledTimes(1);
			expect(observer.mock.calls[0][2].lightDeviceSettings.ledLevel).toBe(2);
			expect(service.getDeviceSequence('light', LIGHT_ID)).toBe(since + 1);
		});

		it('discards a readback older than a frame applied after it was requested', async () => {
			const observer = jest.fn();

			await primeLight();

			const since = service.getDeviceSequence('light', LIGHT_ID);

			service.enqueueFrame(IDENTITY, ledFrame());
			service.observeDevices(observer);

			await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), since)).resolves.toBe(false);

			expect(brightnessValues()).toEqual([50]);
			expect(service.getCachedDevice('light', LIGHT_ID)?.lightDeviceSettings).toMatchObject({ ledLevel: 3 });
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it('only refreshes the cache for a readback of a device that is not adopted', async () => {
			const observer = jest.fn();

			devices = [adopt(goldenCamera, CAMERA_PANEL)];
			service.observeDevices(observer);

			await expect(service.applyDeviceReadback(IDENTITY, withLevel(2), 0)).resolves.toBe(true);

			expect(properties.update).not.toHaveBeenCalled();
			expect(service.getDeviceSequence('light', LIGHT_ID)).toBe(1);
			expect(service.getCachedDevice('light', LIGHT_ID)?.lightDeviceSettings).toMatchObject({ ledLevel: 2 });
			expect(observer).toHaveBeenCalledTimes(1);
		});

		it('keeps an open detection when a readback arrives', async () => {
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
			properties.update.mockClear();
			service.enqueueFrame(IDENTITY, eventFrame('0005', 'add'));
			await service.idle();

			expect(properties.update).toHaveBeenCalledWith(smoke(), { type: DEVICES_UNIFI_PROTECT_TYPE, value: true });
			properties.update.mockClear();

			const since = service.getDeviceSequence('camera', CAMERA_ID);

			await expect(service.applyDeviceReadback(IDENTITY, entry('camera', cameras[0]), since)).resolves.toBe(true);

			expect(properties.update.mock.calls.filter((call) => call[0] === smoke())).toEqual([]);
		});

		it('resets a stored detection that has no open event on a readback, like a snapshot', async () => {
			stored.set(smoke(), true);
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
			properties.update.mockClear();
			(service as any).lastWritten.set(smoke(), true);

			await service.applyDeviceReadback(
				IDENTITY,
				entry('camera', cameras[0]),
				service.getDeviceSequence('camera', CAMERA_ID),
			);

			expect(properties.update).toHaveBeenCalledWith(smoke(), { type: DEVICES_UNIFI_PROTECT_TYPE, value: false });
		});

		it('keeps a poll that read before the readback from overwriting it', async () => {
			await primeLight();

			const before = service.getSnapshotSequence();

			await service.applyDeviceReadback(IDENTITY, withLevel(2), service.getDeviceSequence('light', LIGHT_ID));

			expect(service.getSnapshotSequence()).toBe(before + 1);
		});

		it('marks a readback for polling when it is queued, not when it runs', async () => {
			let release: () => void = () => undefined;

			await primeLight();
			properties.update.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = () => resolve({});
					}),
			);
			service.enqueueFrame(IDENTITY, ledFrame());
			await jest.advanceTimersByTimeAsync(0);

			const before = service.getSnapshotSequence();
			const pending = service.applyDeviceReadback(IDENTITY, withLevel(2), service.getDeviceSequence('light', LIGHT_ID));

			// The queue is still held by the frame's write.
			expect(service.getSnapshotSequence()).toBe(before + 1);

			release();
			await pending;
		});

		it('rejects a readback of an unknown model key without a cache write', async () => {
			const observer = jest.fn();

			service.observeDevices(observer);

			await expect(
				service.applyDeviceReadback(IDENTITY, { modelKey: 'event' as never, id: LIGHT_ID, raw: lights[0] }, 0),
			).resolves.toBe(false);

			expect(service.getCachedDevice('event', LIGHT_ID)).toBeNull();
			expect(service.getDeviceSequence('event', LIGHT_ID)).toBe(0);
			expect(observer).not.toHaveBeenCalled();
		});

		it('drops a queued event retry that the readback contradicts', async () => {
			const key = valueKey('smoke', 'smoke_alarm_sound_detected');
			const retries = (service as any).retries as Map<string, unknown[]>;

			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0])]));
			(service as any).queueRetry(CAMERA_ID, {
				kind: 'write',
				key,
				propertyId: smoke(),
				value: true,
				attempts: 0,
				dueAt: 0,
			});

			expect(retries.get(CAMERA_ID)).toHaveLength(1);

			await service.applyDeviceReadback(
				IDENTITY,
				entry('camera', cameras[0]),
				service.getDeviceSequence('camera', CAMERA_ID),
			);

			expect(retries.has(CAMERA_ID)).toBe(false);
			expect(properties.update.mock.calls.filter((call) => call[0] === smoke())).toEqual([]);
		});

		it('catches an observer that rejects asynchronously and logs it through the limiter', async () => {
			service.observeDevices((() => Promise.reject(new Error('SENTINEL async'))) as never);
			await primeLight();
			await jest.advanceTimersByTimeAsync(0);

			expect(logged.filter((args) => args[0] === `[ProtectSynchronizerService] ${OBSERVER_FAILURE_TEXT}`)).toHaveLength(
				1,
			);
			expect(JSON.stringify(logged)).not.toContain('SENTINEL');
		});

		it('keeps working and logs once when an observer throws', async () => {
			const healthy = jest.fn();

			service.observeDevices(() => {
				throw new Error('SENTINEL observer detail');
			});
			service.observeDevices(healthy);
			await primeLight();

			service.enqueueFrame(IDENTITY, ledFrame());
			await service.idle();
			service.enqueueFrame(IDENTITY, frameFor('update', { id: LIGHT_ID, modelKey: 'light', name: 'Again' }));
			await service.idle();

			expect(brightnessValues()).toEqual([50]);
			expect(healthy).toHaveBeenCalledTimes(4);
			expect(logged.filter((args) => args[0] === `[ProtectSynchronizerService] ${OBSERVER_FAILURE_TEXT}`)).toHaveLength(
				1,
			);
			expect(JSON.stringify(logged)).not.toContain('SENTINEL');

			await jest.advanceTimersByTimeAsync(60_000);
			service.enqueueFrame(IDENTITY, frameFor('update', { id: LIGHT_ID, modelKey: 'light', name: 'Third' }));
			await service.idle();

			expect(
				logged.some(
					(args) => args[0] === `[ProtectSynchronizerService] ${OBSERVER_FAILURE_TEXT} (3 similar suppressed)`,
				),
			).toBe(true);
		});

		it('forgets cache and sequences on reset but keeps observers', async () => {
			const observer = jest.fn();

			service.observeDevices(observer);
			await primeLight();

			const before = service.getDeviceSequence('light', LIGHT_ID);

			service.reset();

			expect(service.getCachedDevice('light', LIGHT_ID)).toBeNull();
			expect(service.getDeviceSequence('light', LIGHT_ID)).toBe(0);

			observer.mockClear();
			await service.applySnapshot(IDENTITY, lightSnapshot());

			expect(observer).toHaveBeenCalledTimes(2);
			// A value captured before the reset can never equal one of the new session.
			expect(service.getDeviceSequence('light', LIGHT_ID)).toBeGreaterThan(before);
		});

		it('writes nothing and notifies nobody for a readback a reset overtook while queued', async () => {
			const observer = jest.fn();

			await primeLight();
			service.observeDevices(observer);

			const pending = service.applyDeviceReadback(IDENTITY, withLevel(2), service.getDeviceSequence('light', LIGHT_ID));

			service.reset();

			await expect(pending).resolves.toBe(false);
			expect(properties.update).not.toHaveBeenCalled();
			expect(observer).not.toHaveBeenCalled();
		});

		it('stops a readback that a reset overtook mid-write', async () => {
			const observer = jest.fn();
			let release: () => void = () => undefined;

			await primeLight();
			service.observeDevices(observer);
			properties.update.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						release = () => resolve({});
					}),
			);

			const pending = service.applyDeviceReadback(IDENTITY, withLevel(2), service.getDeviceSequence('light', LIGHT_ID));

			await jest.advanceTimersByTimeAsync(0);
			service.reset();
			release();

			await expect(pending).resolves.toBe(false);
			expect(properties.update).toHaveBeenCalledTimes(1);
			expect(observer).not.toHaveBeenCalled();
			expect(service.getCachedDevice('light', LIGHT_ID)).toBeNull();
		});
	});

	describe('events', () => {
		const flush = async (): Promise<void> => {
			await service.idle();
		};
		const feed = async (frame: ProtectFrame): Promise<void> => {
			service.enqueueFrame(IDENTITY, frame);
			await flush();
		};
		const bellProperty = (): string => prop(DOORBELL_PANEL, 'doorbell', 'doorbell_event');
		const values = (id: string): unknown[] =>
			properties.update.mock.calls
				.filter((call) => call[0] === id)
				.map((call) => (call[1] as { value: unknown }).value);

		beforeEach(() => {
			jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
		});

		afterEach(() => {
			service.reset();
			jest.useRealTimers();
		});

		it('turns a recorded smoke alarm sound into smoke.detected and back', async () => {
			const smoke = prop(CAMERA_PANEL, 'smoke', 'smoke_alarm_sound_detected');

			await prime();
			await feed(eventFrame('0005', 'add'));

			expect(properties.update).toHaveBeenCalledWith(smoke, { type: DEVICES_UNIFI_PROTECT_TYPE, value: true });

			await feed(eventFrame('0005', 'update'));

			expect(values(smoke)).toEqual([true, false]);
		});

		it('writes leak detected and level together', async () => {
			devices = [adopt(goldenLeak, SENSOR_PANEL)];
			await feed(eventFrame('0011', 'add'));

			expect(values(prop(SENSOR_PANEL, 'leak', 'leak_detected'))).toEqual([true]);
			expect(values(prop(SENSOR_PANEL, 'leak', 'leak_level'))).toEqual(['high']);

			await feed(eventFrame('0011', 'update'));

			expect(values(prop(SENSOR_PANEL, 'leak', 'leak_detected'))).toEqual([true, false]);
			expect(values(prop(SENSOR_PANEL, 'leak', 'leak_level'))).toEqual(['high', 'low']);
		});

		it('clears a detection 60 s after its last frame and re-arms on update', async () => {
			const motion = prop(CAMERA_PANEL, 'motion', 'camera_motion_detected');
			const update = frameFor('update', { id: eventId('0001'), modelKey: 'event' });

			await feed(eventFrame('0001', 'add'));
			await jest.advanceTimersByTimeAsync(59_999);
			await flush();

			expect(values(motion)).toEqual([true]);

			await feed(update);
			await jest.advanceTimersByTimeAsync(59_999);
			await flush();

			expect(values(motion)).toEqual([true]);

			await jest.advanceTimersByTimeAsync(1);
			await flush();

			expect(values(motion)).toEqual([true, false]);
		});

		it('does not reset a detection on a snapshot while its event is open', async () => {
			const motion = prop(CAMERA_PANEL, 'motion', 'camera_motion_detected');

			await prime();
			await feed(eventFrame('0001', 'add'));
			properties.update.mockClear();
			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]));

			expect(values(motion)).toEqual([]);
		});

		it('publishes a recorded ring once with the Protect event id', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			await feed(eventFrame('0007', 'add'));

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(occurrences.publishOccurrence).toHaveBeenCalledWith({
				deviceId: DOORBELL_PANEL,
				channelId: `${DOORBELL_PANEL}|doorbell`,
				propertyId: bellProperty(),
				event: 'single_press',
				nativeEventType: 'ring',
				sourceOccurrenceId: '5f00000000000000000e0007',
				sourceTimestamp: '2026-11-11T12:26:47.000Z',
			});

			await feed(eventFrame('0007', 'add'));
			await feed(eventFrame('0007', 'update'));

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(updatedIds()).not.toContain(bellProperty());
		});

		it('skips a ring for a camera without a doorbell channel', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			devices[0].channels = devices[0].channels.filter((channel: Raw) => channel.identifier !== 'doorbell');
			await feed(eventFrame('0007', 'add'));

			expect(occurrences.publishOccurrence).not.toHaveBeenCalled();
			expect(service.getCounters().writesFailed).toBe(0);
		});

		it('counts unknown event and detection types', async () => {
			await prime();
			await feed(eventFrame('0019', 'add'));
			await feed(eventFrame('0020', 'add'));

			expect(service.getCounters().ignoredEventCount).toBe(2);
			expect(Object.fromEntries(service.getCounters().ignoredEventTypes)).toEqual({
				sensorExtremeValues: 1,
				pet: 1,
			});
		});

		it('bounds the ignored event names', async () => {
			await prime();

			for (let index = 0; index < 40; index++) {
				await feed(
					frameFor('add', {
						id: `5f0000000000000000${String(index).padStart(6, '0')}`,
						modelKey: 'event',
						type: `unknownType${index}`,
						start: 1,
						device: SENSOR_ID,
					}),
				);
			}

			const types = service.getCounters().ignoredEventTypes;

			expect(service.getCounters().ignoredEventCount).toBe(40);
			expect(types.size).toBe(33);
			expect(types.get('invalid')).toBe(8);
		});

		it('ignores events of devices that are not adopted', async () => {
			await prime();
			await feed(
				frameFor('add', {
					id: eventId('0030'),
					modelKey: 'event',
					type: 'sensorExtremeValues',
					start: 1,
					device: 'ffffffffffffffffffffffff',
				}),
			);
			await feed(
				frameFor('add', {
					id: eventId('0031'),
					modelKey: 'event',
					type: 'motion',
					start: 1,
					device: 'ffffffffffffffffffffffff',
				}),
			);

			expect(properties.update).not.toHaveBeenCalled();
			expect(service.getCounters().ignoredEventCount).toBe(0);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('does not count lightMotion or sensorBatteryLow as unknown', async () => {
			await prime();
			await feed(eventFrame('0013', 'add'));
			await feed(eventFrame('0018', 'add'));

			expect(service.getCounters().ignoredEventCount).toBe(0);
			expect(properties.update).not.toHaveBeenCalled();
		});

		it('keeps timers alive across snapshots and clears them on reset', async () => {
			await prime();
			await feed(eventFrame('0001', 'add'));

			expect(jest.getTimerCount()).toBe(1);

			await service.applySnapshot(IDENTITY, snapshot([entry('camera', cameras[0]), entry('sensor', sensors[0])]));

			expect(jest.getTimerCount()).toBe(1);

			service.reset();

			expect(jest.getTimerCount()).toBe(0);
		});

		it('writes nothing from a timer that fires after a reset', async () => {
			await prime();
			await feed(eventFrame('0001', 'add'));
			properties.update.mockClear();
			service.reset();
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(properties.update).not.toHaveBeenCalled();
		});

		it('retries a failed smoke start on the next frame of that device and never re-emits successes', async () => {
			const smoke = prop(CAMERA_PANEL, 'smoke', 'smoke_alarm_sound_detected');

			await prime();
			properties.update.mockRejectedValueOnce(new Error('SENTINEL detail'));
			await feed(eventFrame('0005', 'add'));

			expect(values(smoke)).toEqual([true]);
			expect(service.getCounters().writesFailed).toBe(1);

			await feed(eventFrame('0006', 'add'));

			expect(values(smoke)).toEqual([true, true]);
			expect(values(prop(CAMERA_PANEL, 'sound_detection.baby_cry', 'sound_detected'))).toEqual([true]);

			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(smoke)).toEqual([true, true, false]);
			expect(JSON.stringify(logged)).not.toContain('SENTINEL');
		});

		it('keeps no event ownership when a reset happens during a successful event write', async () => {
			await prime();

			let release: () => void = () => undefined;

			properties.update.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
			service.enqueueFrame(IDENTITY, eventFrame('0008', 'add'));
			await new Promise((resolve) => setImmediate(resolve));
			expect(properties.update).toHaveBeenCalledTimes(1);

			service.reset();
			release();
			await flush();

			expect((service as any).eventOwned.size).toBe(0);
			expect((service as any).retries.size).toBe(0);
		});

		it('keeps no event ownership when a reset happens during a successful retry write', async () => {
			await prime();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0008', 'add'));
			expect((service as any).retries.size).toBe(1);

			let release: () => void = () => undefined;

			properties.update.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
			service.enqueueFrame(
				IDENTITY,
				frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', lastSeen: 1_700_000_000_000 }),
			);
			await new Promise((resolve) => setImmediate(resolve));
			expect(properties.update).toHaveBeenCalledTimes(2);

			service.reset();
			release();
			await flush();

			expect((service as any).eventOwned.size).toBe(0);
			expect((service as any).retries.size).toBe(0);
		});

		it('drops a queued start that a later end supersedes', async () => {
			const smoke = prop(CAMERA_PANEL, 'smoke', 'smoke_alarm_sound_detected');

			await prime();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0005', 'add'));
			properties.update.mockClear();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0005', 'update'));
			properties.update.mockClear();
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(smoke)).toEqual([]);
		});

		it('retries a failed ring from the queue timer and publishes it exactly once', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValueOnce(new Error('SENTINEL detail'));
			await feed(eventFrame('0007', 'add'));

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(service.getCounters().writesFailed).toBe(1);
			expect(
				logged.some((args) => args[0] === '[ProtectSynchronizerService] UniFi Protect ring could not be published'),
			).toBe(true);

			await jest.advanceTimersByTimeAsync(5999);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

			await jest.advanceTimersByTimeAsync(1);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(2);
			expect(occurrences.publishOccurrence.mock.calls[1][0].sourceOccurrenceId).toBe(eventId('0007'));

			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(2);
			expect(jest.getTimerCount()).toBe(0);
			expect(JSON.stringify(logged)).not.toContain('SENTINEL');
		});

		it('drops a queued ring whose doorbell property was recreated before the retry', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0007', 'add'));

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];

			for (const channel of devices[0].channels as Raw[]) {
				if (channel.identifier === 'doorbell') {
					for (const property of channel.properties as Raw[]) {
						property.id = `${property.id}|recreated`;
					}
				}
			}

			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect((service as any).retries.size).toBe(0);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('drops a queued ring when the Protect device is re-adopted under another panel device', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0007', 'add'));
			devices = [adopt(goldenDoorbell, `${DOORBELL_PANEL}-readopted`)];
			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect((service as any).retries.size).toBe(0);
		});

		it('gives up on a ring after three retries at 6, 15 and 45 seconds', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValue(new Error('down'));
			await feed(eventFrame('0007', 'add'));

			for (const [advance, calls] of [
				[6000, 2],
				[15_000, 3],
				[45_000, 4],
				[120_000, 4],
			]) {
				await jest.advanceTimersByTimeAsync(advance);
				await flush();

				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(calls);
			}

			expect(jest.getTimerCount()).toBe(0);
		});

		it('logs each new ignored event type once at debug and never an unsafe name', async () => {
			const debugSpy = jest.spyOn(Logger.prototype, 'debug');
			const debugLines = (): string[] =>
				debugSpy.mock.calls
					.map((args) => args[0] as unknown)
					.filter((line): line is string => typeof line === 'string' && line.includes('ignored event type'));

			await prime();
			await feed(eventFrame('0019', 'add'));

			expect(debugLines()).toEqual([
				'[ProtectSynchronizerService] UniFi Protect ignored event type sensorExtremeValues',
			]);

			await feed(
				frameFor('add', {
					id: eventId('0090'),
					modelKey: 'event',
					type: 'sensorExtremeValues',
					start: 1,
					device: SENSOR_ID,
				}),
			);
			await feed(
				frameFor('add', {
					id: eventId('0091'),
					modelKey: 'event',
					type: 'bad name!',
					start: 1,
					device: SENSOR_ID,
				}),
			);

			expect(debugLines()).toHaveLength(1);
			expect(JSON.stringify(logged)).not.toContain('bad name');
		});

		it('stops logging names once the bounded name list is full', async () => {
			await prime();

			for (let index = 0; index < 40; index++) {
				await feed(
					frameFor('add', {
						id: `5f0000000000000000${String(index).padStart(6, '0')}`,
						modelKey: 'event',
						type: `unknownType${index}`,
						start: 1,
						device: SENSOR_ID,
					}),
				);
			}

			expect(
				logged.filter((args) => typeof args[0] === 'string' && args[0].includes('ignored event type')),
			).toHaveLength(32);
		});

		it('reschedules the retry timer when the index rebuild throws', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0007', 'add'));
			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			devicesService.findAll.mockRejectedValueOnce(new Error('db down'));
			await jest.advanceTimersByTimeAsync(6000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(1);

			// The failed rebuild used up an attempt, so the next timer waits the second delay, not 1 s.
			await jest.advanceTimersByTimeAsync(14_000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

			await jest.advanceTimersByTimeAsync(1000);
			await flush();

			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(2);
		});

		it('stops retrying after the cap while the index rebuild keeps failing', async () => {
			devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
			occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0007', 'add'));
			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			devicesService.findAll.mockRejectedValue(new Error('db down'));
			await jest.advanceTimersByTimeAsync(6000 + 15_000 + 45_000);
			await flush();

			const calls = devicesService.findAll.mock.calls.length;

			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(devicesService.findAll).toHaveBeenCalledTimes(calls);
			expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('drops a queued event write that a snapshot contradicts instead of draining it', async () => {
			const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

			await prime();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0008', 'add'));
			properties.update.mockClear();
			await service.applySnapshot(IDENTITY, sensorSnapshot({ isOpened: false }));
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(contact)).not.toContain(true);
			expect((service as any).lastWritten.get(contact)).toBe(false);
		});

		it('re-arms the expiry timer when the index rebuild fails inside it', async () => {
			const motion = prop(CAMERA_PANEL, 'motion', 'camera_motion_detected');

			await feed(eventFrame('0001', 'add'));
			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			devicesService.findAll.mockRejectedValueOnce(new Error('db down'));
			await jest.advanceTimersByTimeAsync(60_000);
			await flush();

			expect(values(motion)).toEqual([true]);
			// Re-armed with the minimum delay, so a past deadline cannot loop at zero delay.
			expect(jest.getTimerCount()).toBe(1);

			await jest.advanceTimersByTimeAsync(999);
			await flush();

			expect(values(motion)).toEqual([true]);

			await jest.advanceTimersByTimeAsync(1);
			await flush();

			expect(values(motion)).toEqual([true, false]);
		});

		it('never lets a retried sensorOpened overwrite the false that a snapshot reported', async () => {
			const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');
			const written = (service as any).lastWritten as Map<string, unknown>;

			await prime();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0008', 'add'));
			properties.update.mockRejectedValueOnce(new Error('down'));
			await jest.advanceTimersByTimeAsync(6000);
			await flush();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await service.applySnapshot(IDENTITY, sensorSnapshot({ isOpened: false }));
			properties.update.mockClear();
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(contact)).not.toContain(true);
			expect(written.get(contact)).toBe(false);
		});

		it('never lets a retried tamper latch overwrite the clear that a snapshot reported', async () => {
			const contact = prop(SENSOR_PANEL, 'contact', 'contact_tampered');
			const motion = prop(SENSOR_PANEL, 'motion', 'sensor_motion_tampered');
			const written = (service as any).lastWritten as Map<string, unknown>;
			const down = (times: number): void => {
				for (let index = 0; index < times; index++) {
					properties.update.mockRejectedValueOnce(new Error('down'));
				}
			};

			await prime();
			down(2);
			await feed(eventFrame('0012', 'add'));
			down(2);
			await jest.advanceTimersByTimeAsync(6000);
			await flush();
			down(2);
			await service.applySnapshot(IDENTITY, sensorSnapshot({ tamperingDetectedAt: null }));
			properties.update.mockClear();
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(contact)).not.toContain(true);
			expect(values(motion)).not.toContain(true);
			expect(written.get(contact)).toBe(false);
			expect(written.get(motion)).toBe(false);
		});

		describe('device update frames', () => {
			const down = (times: number): void => {
				for (let index = 0; index < times; index++) {
					properties.update.mockRejectedValueOnce(new Error('down'));
				}
			};
			const update = (patch: Raw): ProtectFrame => frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', ...patch });

			it('drops a queued sensorOpened that an update reporting isOpened false contradicts', async () => {
				const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

				await prime();
				down(1);
				await feed(eventFrame('0008', 'add'));
				down(1);
				properties.update.mockClear();
				await feed(update({ isOpened: false }));
				properties.update.mockClear();
				await jest.advanceTimersByTimeAsync(120_000);
				await flush();

				expect(values(contact)).not.toContain(true);
				expect((service as any).lastWritten.get(contact)).toBe(false);
			});

			it('drops a queued tamper latch that an update clearing tamperingDetectedAt contradicts', async () => {
				const contact = prop(SENSOR_PANEL, 'contact', 'contact_tampered');
				const motion = prop(SENSOR_PANEL, 'motion', 'sensor_motion_tampered');

				await prime();
				down(2);
				await feed(eventFrame('0012', 'add'));
				down(2);
				await feed(update({ tamperingDetectedAt: null }));
				properties.update.mockClear();
				await jest.advanceTimersByTimeAsync(120_000);
				await flush();

				expect(values(contact)).not.toContain(true);
				expect(values(motion)).not.toContain(true);
				expect((service as any).lastWritten.get(contact)).toBe(false);
				expect((service as any).lastWritten.get(motion)).toBe(false);
			});

			it('keeps a queued sensorOpened when the update does not carry isOpened', async () => {
				const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

				await prime();
				down(1);
				await feed(eventFrame('0008', 'add'));
				down(1);
				await feed(update({ lastSeen: 1_700_000_000_000 }));
				properties.update.mockClear();
				await jest.advanceTimersByTimeAsync(120_000);
				await flush();

				expect(values(contact)).toContain(true);
				expect((service as any).lastWritten.get(contact)).toBe(true);
			});

			it('keeps a queued sensorOpened when the update carries only a channel-selection field', async () => {
				const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

				await prime();
				down(1);
				await feed(eventFrame('0008', 'add'));
				down(1);
				await feed(update({ mountType: 'door' }));
				properties.update.mockClear();
				await jest.advanceTimersByTimeAsync(120_000);
				await flush();

				expect(values(contact)).toContain(true);
				expect((service as any).lastWritten.get(contact)).toBe(true);
			});

			describe('event-owned values', () => {
				const ownedContact = async (): Promise<string> => {
					const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

					await prime();
					down(1);
					await feed(eventFrame('0008', 'add'));
					await feed(update({ lastSeen: 1_700_000_000_000 }));

					return contact;
				};
				const finalValue = (id: string): unknown => values(id).at(-1);

				it('does not write a stale cached value back over a retried event write on an unrelated update', async () => {
					const contact = await ownedContact();

					expect((service as any).lastWritten.get(contact)).toBe(true);
					expect(finalValue(contact)).toBe(true);

					await feed(update({ lastSeen: 1_700_000_000_001 }));

					expect(finalValue(contact)).toBe(true);
					expect((service as any).lastWritten.get(contact)).toBe(true);
				});

				it('writes false when a later update carries isOpened false', async () => {
					const contact = await ownedContact();

					await feed(update({ isOpened: false }));

					expect(finalValue(contact)).toBe(false);
					expect((service as any).lastWritten.get(contact)).toBe(false);
				});

				it('keeps an event value owned when it equals the persisted value after a failed snapshot write', async () => {
					const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

					await prime();
					await service.applySnapshot(IDENTITY, sensorSnapshot({ isOpened: true }));
					expect((service as any).lastWritten.get(contact)).toBe(true);

					down(1);
					await service.applySnapshot(IDENTITY, sensorSnapshot({ isOpened: false }));
					expect((service as any).lastWritten.get(contact)).toBe(true);
					properties.update.mockClear();

					await feed(eventFrame('0008', 'add'));
					await feed(update({ lastSeen: 1_700_000_000_002 }));

					expect(values(contact)).not.toContain(false);
					expect((service as any).lastWritten.get(contact)).toBe(true);
				});

				it('keeps a queued event value owned when another writer persisted it before the retry', async () => {
					const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

					await prime();
					down(1);
					await feed(eventFrame('0008', 'add'));
					expect((service as any).lastWritten.get(contact)).not.toBe(true);

					service.recordPersistedValue({
						id: contact,
						type: DEVICES_UNIFI_PROTECT_TYPE,
						value: { value: true },
					} as never);
					properties.update.mockClear();

					await feed(update({ lastSeen: 1_700_000_000_003 }));

					expect(values(contact)).not.toContain(false);
					expect((service as any).lastWritten.get(contact)).toBe(true);
				});

				it('does not carry event ownership over to a property recreated on a retained device', async () => {
					const contact = await ownedContact();
					const recreated = 'recreated-contact-detected';

					expect(finalValue(contact)).toBe(true);

					for (const channel of devices[1].channels) {
						for (const property of channel.properties) {
							if (property.id === contact) {
								property.id = recreated;
							}
						}
					}

					stored.set(recreated, true);
					service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
					properties.update.mockClear();

					await feed(update({ lastSeen: 1_700_000_000_004 }));

					expect(values(recreated)).toEqual([false]);
				});

				it('writes false when a snapshot reports isOpened false', async () => {
					const contact = await ownedContact();

					await service.applySnapshot(IDENTITY, sensorSnapshot({ isOpened: false }));

					expect(finalValue(contact)).toBe(false);
					expect((service as any).lastWritten.get(contact)).toBe(false);
				});
			});
		});

		describe('ring retry deadlines', () => {
			const DOORBELL_ID = '5f0000000000000000000a01';
			const doorbellFrame = (action: 'add' | 'update', patch: Raw = {}): ProtectFrame =>
				frameFor(action, { id: DOORBELL_ID, modelKey: 'camera', ...patch });

			it('does not retry a failed ring on frames that arrive before its first delay, then publishes it once', async () => {
				devices = [adopt(goldenDoorbell, DOORBELL_PANEL)];
				await feed(doorbellFrame('add', { name: 'Door' }));
				occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
				await feed(eventFrame('0007', 'add'));

				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

				for (let index = 0; index < 5; index++) {
					await jest.advanceTimersByTimeAsync(1000);
					await feed(doorbellFrame('update', { name: `Door ${index}` }));
					await feed(eventFrame('0007', 'update'));
				}

				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);

				await jest.advanceTimersByTimeAsync(1000);
				await flush();

				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(2);

				await jest.advanceTimersByTimeAsync(120_000);
				await flush();

				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(2);
			});

			it('still retries a failed write on the next frame while a ring waits for its deadline', async () => {
				devices = [adopt(goldenDoorbell, DOORBELL_PANEL), adopt(goldenSensor, SENSOR_PANEL)];
				const contact = prop(SENSOR_PANEL, 'contact', 'contact_detected');

				await prime();
				occurrences.publishOccurrence.mockRejectedValueOnce(new Error('down'));
				await feed(eventFrame('0007', 'add'));
				properties.update.mockRejectedValueOnce(new Error('down'));
				await feed(eventFrame('0008', 'add'));
				properties.update.mockClear();
				await feed(frameFor('update', { id: SENSOR_ID, modelKey: 'sensor', lastSeen: 1 }));

				expect(values(contact)).toContain(true);
				expect(occurrences.publishOccurrence).toHaveBeenCalledTimes(1);
			});
		});

		it('repairs a leak level that failed to reset on the next snapshot', async () => {
			const detected = prop(SENSOR_PANEL, 'leak', 'leak_detected');
			const level = prop(SENSOR_PANEL, 'leak', 'leak_level');
			const leak = (): ProtectSnapshot => snapshot([entry('sensor', sensors[3])]);

			devices = [adopt(goldenLeak, SENSOR_PANEL)];
			stored.set(detected, true);
			stored.set(level, 'high');
			properties.update.mockImplementation((id: string, body: { value: unknown }) =>
				body.value === 'low' ? Promise.reject(new Error('down')) : Promise.resolve({}),
			);
			await service.applySnapshot(IDENTITY, leak());

			expect(values(detected)).toEqual([false]);
			expect(values(level)).toEqual(['low']);

			properties.update.mockImplementation(() => Promise.resolve({}));
			properties.update.mockClear();
			await service.applySnapshot(IDENTITY, leak());

			expect(values(detected)).toEqual([]);
			expect(values(level)).toEqual(['low']);
		});

		it('drops a queued tamper latch that a snapshot reporting it cleared contradicts', async () => {
			const contact = prop(SENSOR_PANEL, 'contact', 'contact_tampered');
			const motion = prop(SENSOR_PANEL, 'motion', 'sensor_motion_tampered');

			await prime();
			properties.update.mockRejectedValueOnce(new Error('down')).mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0012', 'add'));
			properties.update.mockClear();
			await service.applySnapshot(IDENTITY, sensorSnapshot({ tamperingDetectedAt: null }));
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(contact)).not.toContain(true);
			expect(values(motion)).not.toContain(true);
			expect((service as any).lastWritten.get(contact)).toBe(false);
			expect((service as any).lastWritten.get(motion)).toBe(false);
		});

		it('does not count updates of events dropped for a device that is not adopted', async () => {
			await prime();

			const add = frameFor('add', {
				id: eventId('0040'),
				modelKey: 'event',
				type: 'motion',
				start: 1,
				device: 'ffffffffffffffffffffffff',
			});

			await feed(add);
			await feed(frameFor('update', { id: eventId('0040'), modelKey: 'event', end: 2 }));
			await feed(frameFor('remove', { id: eventId('0040'), modelKey: 'event' }));

			expect(service.getCounters().framesIgnored).toBe(0);

			await feed(frameFor('update', { id: eventId('0041'), modelKey: 'event', end: 2 }));

			expect(service.getCounters().framesIgnored).toBe(1);
		});

		it('drops a queued write silently when its property is gone', async () => {
			const smoke = prop(CAMERA_PANEL, 'smoke', 'smoke_alarm_sound_detected');

			await prime();
			properties.update.mockRejectedValueOnce(new Error('down'));
			await feed(eventFrame('0005', 'add'));
			properties.update.mockClear();
			devices = [
				{
					...adopt(goldenCamera, CAMERA_PANEL),
					channels: adopt(goldenCamera, CAMERA_PANEL).channels.filter((channel: Raw) => channel.identifier !== 'smoke'),
				},
				adopt(goldenSensor, SENSOR_PANEL),
			];
			service.invalidateIndex({ type: DEVICES_UNIFI_PROTECT_TYPE });
			await jest.advanceTimersByTimeAsync(120_000);
			await flush();

			expect(values(smoke)).toEqual([]);
			expect(service.getCounters().writesFailed).toBe(1);
			expect(jest.getTimerCount()).toBe(0);
		});

		it('keeps at most 32 queued failures per device', () => {
			for (let index = 0; index < 40; index++) {
				(service as any).queueRetry('device', {
					kind: 'write',
					key: `key${index}`,
					propertyId: `p${index}`,
					value: true,
					attempts: 0,
					dueAt: 0,
				});
			}

			const entries = ((service as any).retries as Map<string, { key: string }[]>).get('device');

			expect(entries).toHaveLength(32);
			expect(entries[0].key).toBe('key8');
		});
	});
});
