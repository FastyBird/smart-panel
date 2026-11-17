/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from 'fs';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import { FAKE_PROTECT_API_KEY } from '../../../../test/support/fake-protect-server';
import { DataTypeType, PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ProtectApiClient } from '../client/protect-api.client';
import { ProtectCamera, ProtectLight } from '../client/protect-api.types';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from '../entities/devices-unifi-protect.entity';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';
import { ProtectConnectorService, ProtectSessionListener } from '../services/protect-connector.service';
import { ProtectRealtimeService } from '../services/protect-realtime.service';
import { ProtectSynchronizerService } from '../services/protect-synchronizer.service';

import { UnifiProtectDevicePlatform } from './unifi-protect-device.platform';

type Raw = Record<string, any>;

const read = (name: string): any => JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8'));
const lights = read('lights.json') as Raw[];
const cameras = read('cameras.json') as Raw[];
const NVR_ID = (read('nvrs.json') as Raw).id as string;
const LIGHT_ID = lights[0].id as string;
const CAMERA_ID = cameras[0].id as string;
const IDENTITY = { nvrId: NVR_ID, nvrMacKey: '0cea14003a69' };
const LIGHT_KEY = `light\u0000${LIGHT_ID}`;
const ENDPOINT = 'lights/{id}' as const;

const light = (overrides: Raw = {}, ledLevel = 6, force = false): Raw => ({
	...structuredClone(lights[0]),
	isLightForceEnabled: force,
	lightDeviceSettings: { ...lights[0].lightDeviceSettings, ledLevel },
	...overrides,
});
/** The wrapper the client returns for a light: the console's object stays in `raw`. */
const protectLight = (raw: Raw): ProtectLight => ({
	id: raw.id as string,
	modelKey: 'light',
	state: raw.state as string,
	name: (raw.name as string | undefined) ?? null,
	mac: (raw.mac as string | undefined) ?? null,
	cameraId: (raw.camera as string | undefined) ?? null,
	raw,
});
/** The wrapper the client returns for a camera. */
const protectCamera = (raw: Raw): ProtectCamera => ({
	id: raw.id as string,
	modelKey: 'camera',
	state: raw.state as string,
	name: (raw.name as string | undefined) ?? null,
	type: (raw.type as string | undefined) ?? null,
	mac: (raw.mac as string | undefined) ?? null,
	hasPackageCamera: false,
	featureFlags: {
		supportFullHdSnapshot: false,
		hasHdr: false,
		hasMic: true,
		hasSpeaker: false,
		hasLedStatus: true,
		smartDetectTypes: [],
		smartDetectAudioTypes: [],
		videoModes: [],
	},
	raw,
});
/** What the console shows after `light_on true` + brightness 50. */
const lightOn50 = (): Raw => light({}, 3, true);

const apiError = (category: ProtectErrorCategory, status: number | null = null): ProtectApiError =>
	new ProtectApiError(category, ENDPOINT, { status });

const device = (id: string, protectDeviceId: string, modelKey: 'light' | 'camera'): ProtectDeviceEntity =>
	Object.assign(new ProtectDeviceEntity(), {
		id,
		enabled: true,
		protectNvrId: NVR_ID,
		protectDeviceId,
		protectModelKey: modelKey,
	});

const channelOf = (id: string, identifier: string, owner: ProtectDeviceEntity): ProtectChannelEntity =>
	Object.assign(new ProtectChannelEntity(), { id, identifier, device: owner.id });

const propertyOf = (
	id: string,
	identifier: string,
	mappingName: string,
	channel: ProtectChannelEntity,
	extra: Partial<ProtectChannelPropertyEntity> = {},
): ProtectChannelPropertyEntity =>
	Object.assign(new ProtectChannelPropertyEntity(), {
		id,
		identifier,
		channel: channel.id,
		protectMappingName: mappingName,
		permissions: [PermissionType.READ_WRITE],
		dataType: DataTypeType.BOOL,
		format: null,
		invalid: null,
		step: null,
		...extra,
	});

const lightDevice = device('aaaaaaaa-0000-4000-8000-000000000001', LIGHT_ID, 'light');
const lightChannel = channelOf('aaaaaaaa-0000-4000-8000-000000000002', 'light', lightDevice);
const lightOnProperty = propertyOf('aaaaaaaa-0000-4000-8000-000000000003', 'on', 'light_on', lightChannel);
const brightnessProperty = propertyOf(
	'aaaaaaaa-0000-4000-8000-000000000004',
	'brightness',
	'light_brightness',
	lightChannel,
	{ dataType: DataTypeType.UCHAR, format: [0, 100] },
);

const cameraDevice = device('bbbbbbbb-0000-4000-8000-000000000001', CAMERA_ID, 'camera');
const microphoneChannel = channelOf('bbbbbbbb-0000-4000-8000-000000000002', 'microphone', cameraDevice);
const volumeProperty = propertyOf(
	'bbbbbbbb-0000-4000-8000-000000000003',
	'volume',
	'microphone_volume',
	microphoneChannel,
	{ dataType: DataTypeType.UCHAR, format: [0, 100] },
);
const microphoneActiveProperty = propertyOf(
	'bbbbbbbb-0000-4000-8000-000000000004',
	'active',
	'microphone_active',
	microphoneChannel,
);

const onUpdate = (value = true): IDevicePropertyData => ({
	device: lightDevice,
	channel: lightChannel,
	property: lightOnProperty,
	value,
});
const brightnessUpdate = (value: number): IDevicePropertyData => ({
	device: lightDevice,
	channel: lightChannel,
	property: brightnessProperty,
	value,
});
const volumeUpdate = (value: number): IDevicePropertyData => ({
	device: cameraDevice,
	channel: microphoneChannel,
	property: volumeProperty,
	value,
});

describe('UnifiProtectDevicePlatform', () => {
	let cache: Map<string, Raw>;
	let stored: Map<string, Raw>;
	let observers: Set<(modelKey: string, id: string, raw: Raw) => void>;
	let sequences: Map<string, number>;
	let sessionListener: ProtectSessionListener | null;
	let unsubscribeObserver: jest.Mock;
	let unsubscribeSession: jest.Mock;
	let realtimeState: ReturnType<ProtectRealtimeService['getState']>;
	let consoleUp: boolean;

	let client: jest.Mocked<Pick<ProtectApiClient, 'patchDevice' | 'getLight' | 'getCamera'>>;
	let connector: jest.Mocked<Pick<ProtectConnectorService, 'getClient' | 'getConsoleIdentity' | 'onSessionChange'>>;
	let realtime: jest.Mocked<Pick<ProtectRealtimeService, 'getState'>>;
	let synchronizer: jest.Mocked<
		Pick<
			ProtectSynchronizerService,
			'observeDevices' | 'getCachedDevice' | 'getStoredDevice' | 'getDeviceSequence' | 'applyDeviceReadback'
		>
	>;
	let platform: UnifiProtectDevicePlatform;

	const keyOf = (modelKey: string, id: string): string => `${modelKey}\u0000${id}`;

	/** A console object reaching the synchronizer: cached, stored and reported to the observers. */
	const emit = (modelKey: string, id: string, raw: Raw): void => {
		cache.set(keyOf(modelKey, id), raw);
		stored.set(keyOf(modelKey, id), raw);
		sequences.set(keyOf(modelKey, id), (sequences.get(keyOf(modelKey, id)) ?? 0) + 1);

		for (const observer of [...observers]) {
			observer(modelKey, id, raw);
		}
	};
	const seed = (modelKey: string, id: string, raw: Raw): void => {
		cache.set(keyOf(modelKey, id), raw);
		stored.set(keyOf(modelKey, id), raw);
	};
	const flush = (): Promise<void> => jest.advanceTimersByTimeAsync(0);
	const loggedLines = (): string[] =>
		(['log', 'debug', 'warn', 'error', 'verbose'] as const).flatMap((level) =>
			(jest.mocked(Logger.prototype[level]) as jest.Mock).mock.calls.map((call) => JSON.stringify(call)),
		);

	beforeEach(() => {
		jest.useFakeTimers();

		for (const level of ['log', 'debug', 'warn', 'error', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
		}

		cache = new Map();
		stored = new Map();
		observers = new Set();
		sequences = new Map();
		sessionListener = null;
		realtimeState = 'streaming';
		consoleUp = true;
		unsubscribeObserver = jest.fn();
		unsubscribeSession = jest.fn();

		client = {
			patchDevice: jest.fn().mockResolvedValue(undefined),
			getLight: jest.fn().mockResolvedValue(protectLight(lightOn50())),
			getCamera: jest.fn().mockResolvedValue(protectCamera(cameras[0])),
		};
		connector = {
			// The one cast the fake needs: the real client has private members a Pick cannot carry.
			getClient: jest.fn(() => (consoleUp ? (client as unknown as ProtectApiClient) : null)),
			getConsoleIdentity: jest.fn(() => (consoleUp ? IDENTITY : null)),
			onSessionChange: jest.fn((listener: ProtectSessionListener) => {
				sessionListener = listener;

				return unsubscribeSession;
			}),
		};
		realtime = { getState: jest.fn(() => realtimeState) };
		synchronizer = {
			observeDevices: jest.fn((observer) => {
				observers.add(observer);

				return () => {
					unsubscribeObserver();
					observers.delete(observer);
				};
			}),
			getCachedDevice: jest.fn((modelKey: string, id: string) => cache.get(keyOf(modelKey, id)) ?? null),
			getStoredDevice: jest.fn((modelKey: string, id: string) => stored.get(keyOf(modelKey, id)) ?? null),
			// Like the real synchronizer: 0 for a device that was never cached, then one step per cache write.
			getDeviceSequence: jest.fn((modelKey, id) => sequences.get(keyOf(modelKey, id)) ?? 0),
			applyDeviceReadback: jest.fn((_identity, entry, sinceSequence) => {
				// Like the real one: nothing is written when a newer write moved the device's sequence on.
				if ((sequences.get(keyOf(entry.modelKey, entry.id)) ?? 0) !== sinceSequence) {
					return Promise.resolve(false);
				}

				emit(entry.modelKey, entry.id, entry.raw as Raw);

				return Promise.resolve(true);
			}),
		};

		// The one injection cast: the fakes carry only the methods the platform uses, the services have private members.
		platform = new UnifiProtectDevicePlatform(
			connector as unknown as ProtectConnectorService,
			realtime as unknown as ProtectRealtimeService,
			synchronizer as unknown as ProtectSynchronizerService,
		);
		platform.onModuleInit();
		seed('light', LIGHT_ID, light());
		seed('camera', CAMERA_ID, cameras[0]);
	});

	afterEach(async () => {
		platform.onModuleDestroy();
		await flush();
		expect(jest.getTimerCount()).toBe(0);
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it('registers for the plugin type and asks the core not to persist commanded values', () => {
		expect(platform.getType()).toBe(DEVICES_UNIFI_PROTECT_TYPE);
		expect(platform.getType()).toBe('devices-unifi-protect');
		expect(platform.usesAuthoritativePropertyReadback(brightnessProperty)).toBe(true);
		expect(platform.usesAuthoritativePropertyReadback(new ChannelPropertyEntity())).toBe(false);
		expect([0, 1, 3].map((count) => platform.getCommandTimeoutMs(count))).toEqual([0, 24000, 24000]);
	});

	it('sends one PATCH per Protect device and confirms by the next frame', async () => {
		const result = platform.processBatch([onUpdate(true), brightnessUpdate(50)]);

		await flush();

		expect(client.patchDevice).toHaveBeenCalledTimes(1);
		expect(client.patchDevice).toHaveBeenCalledWith(
			'lights',
			LIGHT_ID,
			{ isLightForceEnabled: true, lightDeviceSettings: { ledLevel: 3 } },
			{ deadlineMs: 5000 },
		);

		emit('light', LIGHT_ID, lightOn50());

		await expect(result).resolves.toBe(true);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('confirms at once when the cache already shows the values', async () => {
		seed('light', LIGHT_ID, light({}, 3));

		await expect(platform.processBatch([brightnessUpdate(50)])).resolves.toBe(true);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('falls back to a GET readback after 3 s without a frame', async () => {
		sequences.set(LIGHT_KEY, 7);

		const result = platform.processBatch([onUpdate(true), brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(2999);
		expect(client.getLight).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		expect(client.getLight).toHaveBeenCalledWith(LIGHT_ID, { deadlineMs: 4000 });
		expect(synchronizer.applyDeviceReadback).toHaveBeenCalledWith(
			IDENTITY,
			{ modelKey: 'light', id: LIGHT_ID, raw: lightOn50() },
			7,
		);
		await expect(result).resolves.toBe(true);
	});

	it('reports not_confirmed when the readback shows other values', async () => {
		client.getLight.mockResolvedValue(protectLight(light({}, 6, false)));

		const outcomes = platform.executeBatch([onUpdate(true), brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([
			{ propertyId: lightOnProperty.id, mappingName: 'light_on', outcome: 'not_confirmed' },
			{ propertyId: brightnessProperty.id, mappingName: 'light_brightness', outcome: 'not_confirmed' },
		]);

		const result = platform.processBatch([onUpdate(true), brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);
		await expect(result).resolves.toBe(false);
	});

	it('confirms by GET after 500 ms while realtime is polling', async () => {
		realtimeState = 'polling';

		const result = platform.processBatch([onUpdate(true), brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(499);
		expect(client.getLight).not.toHaveBeenCalled();

		await jest.advanceTimersByTimeAsync(1);

		expect(client.getLight).toHaveBeenCalledTimes(1);
		await expect(result).resolves.toBe(true);
	});

	it('confirms an ambiguous PATCH failure from the readback', async () => {
		client.patchDevice.mockRejectedValue(apiError(ProtectErrorCategory.TIMEOUT));

		await expect(platform.executeBatch([onUpdate(true), brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'confirmed' }),
			expect.objectContaining({ outcome: 'confirmed' }),
		]);
		expect(client.getLight).toHaveBeenCalledTimes(1);

		client.getLight.mockResolvedValue(protectLight(light({}, 6, false)));

		await expect(platform.executeBatch([onUpdate(true), brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'failed' }),
			expect.objectContaining({ outcome: 'failed' }),
		]);
	});

	it('treats a protocol failure without a 4xx status as ambiguous and with one as rejected', async () => {
		client.patchDevice.mockRejectedValueOnce(apiError(ProtectErrorCategory.PROTOCOL, 502));

		await expect(platform.executeBatch([onUpdate(true), brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'confirmed' }),
			expect.objectContaining({ outcome: 'confirmed' }),
		]);

		client.getLight.mockClear();
		client.patchDevice.mockRejectedValueOnce(apiError(ProtectErrorCategory.PROTOCOL, 422));

		await expect(platform.executeBatch([onUpdate(true), brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'rejected' }),
			expect.objectContaining({ outcome: 'rejected' }),
		]);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it.each([
		[ProtectErrorCategory.BAD_REQUEST, 'rejected'],
		[ProtectErrorCategory.AUTHENTICATION, 'unauthorized'],
		[ProtectErrorCategory.AUTHORIZATION, 'unauthorized'],
		[ProtectErrorCategory.NOT_FOUND, 'not_found'],
		[ProtectErrorCategory.RATE_LIMITED, 'rate_limited'],
		[ProtectErrorCategory.CANCELLED, 'unavailable'],
		[ProtectErrorCategory.VALIDATION, 'failed'],
		[ProtectErrorCategory.TLS_UNTRUSTED, 'unavailable'],
		[ProtectErrorCategory.UNSUPPORTED, 'failed'],
		[ProtectErrorCategory.VERSION_UNSUPPORTED, 'failed'],
	])('fails a rejected PATCH without a readback (%s -> %s)', async (category, outcome) => {
		client.patchDevice.mockRejectedValue(apiError(category));

		const outcomes = await platform.executeBatch([brightnessUpdate(50)]);

		expect(outcomes).toEqual([{ propertyId: brightnessProperty.id, mappingName: 'light_brightness', outcome }]);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('fails an error that is not a ProtectApiError without a readback', async () => {
		client.patchDevice.mockRejectedValue(new Error('socket exploded'));

		await expect(platform.executeBatch([brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'failed' }),
		]);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('fails before any request while the console is disconnected', async () => {
		consoleUp = false;

		await expect(platform.executeBatch([brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'unavailable' }),
		]);
		expect(client.patchDevice).not.toHaveBeenCalled();
		await expect(platform.processBatch([brightnessUpdate(50)])).resolves.toBe(false);
	});

	it('fails before any request for a device of another console', async () => {
		const foreign = Object.assign(new ProtectDeviceEntity(), { ...lightDevice, protectNvrId: 'other-console' });

		await expect(
			platform.executeBatch([{ device: foreign, channel: lightChannel, property: brightnessProperty, value: 50 }]),
		).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		expect(client.patchDevice).not.toHaveBeenCalled();
	});

	it('fails before any request for an uncached or disconnected device', async () => {
		cache.delete(LIGHT_KEY);

		await expect(platform.executeBatch([brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'unavailable' }),
		]);

		seed('light', LIGHT_ID, light({ state: 'DISCONNECTED' }));

		await expect(platform.executeBatch([brightnessUpdate(50)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'unavailable' }),
		]);
		expect(client.patchDevice).not.toHaveBeenCalled();
	});

	it('looks a device without a stored model key up under the mapping model key', async () => {
		const legacy = Object.assign(new ProtectDeviceEntity(), { ...lightDevice, protectModelKey: null });

		const result = platform.processBatch([
			{ device: legacy, channel: lightChannel, property: brightnessProperty, value: 50 },
		]);

		await flush();
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		emit('light', LIGHT_ID, light({}, 3));
		await expect(result).resolves.toBe(true);
	});

	it('refuses the whole batch when one property is not controllable', async () => {
		const outcomes = await platform.executeBatch([
			onUpdate(true),
			{ device: cameraDevice, channel: microphoneChannel, property: microphoneActiveProperty, value: false },
		]);

		expect(outcomes.map((entry) => entry.outcome)).toEqual(['skipped', 'not_controllable']);
		expect(client.patchDevice).not.toHaveBeenCalled();
	});

	it('refuses a property without write permission or with an invalid value', async () => {
		const readOnly = propertyOf(
			'cccccccc-0000-4000-8000-000000000001',
			'brightness',
			'light_brightness',
			lightChannel,
			{
				permissions: [PermissionType.READ_ONLY],
				dataType: DataTypeType.UCHAR,
				format: [0, 100],
			},
		);

		await expect(
			platform.executeBatch([{ device: lightDevice, channel: lightChannel, property: readOnly, value: 50 }]),
		).resolves.toEqual([expect.objectContaining({ outcome: 'not_controllable' })]);
		await expect(platform.executeBatch([brightnessUpdate(101)])).resolves.toEqual([
			expect.objectContaining({ outcome: 'invalid_value' }),
		]);
		expect(client.patchDevice).not.toHaveBeenCalled();
	});

	it('refuses a disabled device and entities of another plugin', async () => {
		const disabled = Object.assign(new ProtectDeviceEntity(), { ...lightDevice, enabled: false });

		await expect(
			platform.executeBatch([{ device: disabled, channel: lightChannel, property: brightnessProperty, value: 50 }]),
		).resolves.toEqual([expect.objectContaining({ outcome: 'not_controllable' })]);
		await expect(
			platform.executeBatch([
				{ device: lightDevice, channel: lightChannel, property: new ChannelPropertyEntity(), value: 50 },
			]),
		).resolves.toEqual([expect.objectContaining({ outcome: 'not_controllable' })]);
		expect(client.patchDevice).not.toHaveBeenCalled();
	});

	it('answers an empty batch with success', async () => {
		await expect(platform.processBatch([])).resolves.toBe(true);
		await expect(platform.executeBatch([])).resolves.toEqual([]);
	});

	it('stops at the first failed device and skips the rest', async () => {
		client.patchDevice.mockRejectedValueOnce(apiError(ProtectErrorCategory.BAD_REQUEST));

		const outcomes = await platform.executeBatch([volumeUpdate(40), onUpdate(true)]);

		expect(outcomes.map((entry) => entry.outcome)).toEqual(['rejected', 'skipped']);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);
		expect(client.patchDevice).toHaveBeenCalledWith('cameras', CAMERA_ID, { micVolume: 40 }, { deadlineMs: 5000 });
	});

	it('runs commands for one device one after another', async () => {
		const first = platform.processBatch([brightnessUpdate(50)]);
		const second = platform.processBatch([brightnessUpdate(100)]);

		await flush();
		expect(client.patchDevice).toHaveBeenCalledTimes(1);
		expect(client.patchDevice.mock.calls[0][2]).toEqual({ lightDeviceSettings: { ledLevel: 3 } });

		await jest.advanceTimersByTimeAsync(1000);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		emit('light', LIGHT_ID, light({}, 3));
		await expect(first).resolves.toBe(true);
		await flush();

		expect(client.patchDevice).toHaveBeenCalledTimes(2);
		expect(client.patchDevice.mock.calls[1][2]).toEqual({ lightDeviceSettings: { ledLevel: 6 } });

		emit('light', LIGHT_ID, light({}, 6));
		await expect(second).resolves.toBe(true);
	});

	it('refuses a fifth waiting batch as busy', async () => {
		client.getLight.mockReturnValue(new Promise(() => undefined));

		const batches = [1, 2, 3, 4, 5].map((level) => platform.executeBatch([brightnessUpdate(level * 10)]));

		await jest.advanceTimersByTimeAsync(3000);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		const refused = await platform.executeBatch([brightnessUpdate(90)]);

		expect(refused.map((entry) => entry.outcome)).toEqual(['busy']);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		sessionListener?.(null, 'lost');
		await Promise.all(batches);
	});

	it('answers busy for a turn not reached within the queue wait', async () => {
		client.getLight.mockReturnValue(new Promise(() => undefined));

		const first = platform.executeBatch([brightnessUpdate(50)]);
		const second = platform.executeBatch([brightnessUpdate(100)]);

		await jest.advanceTimersByTimeAsync(11999);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(1);

		await expect(second).resolves.toEqual([expect.objectContaining({ outcome: 'busy' })]);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		sessionListener?.(null, 'lost');
		await first;
	});

	it('ends pending confirmations when the session ends', async () => {
		const result = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(1000);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);

		sessionListener?.(null, 'lost');

		await expect(result).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		await jest.advanceTimersByTimeAsync(5000);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('sends no request for a command whose queue wait spans the session end', async () => {
		client.getLight.mockReturnValue(new Promise(() => undefined));

		const first = platform.executeBatch([brightnessUpdate(50)]);
		const second = platform.executeBatch([brightnessUpdate(100)]);

		await jest.advanceTimersByTimeAsync(3000);
		sessionListener?.(null, 'lost');

		await expect(first).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		await expect(second).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		expect(client.patchDevice).toHaveBeenCalledTimes(1);
	});

	it('discards a readback that finished after the session ended', async () => {
		let finishGet: (raw: Raw) => void = () => undefined;

		client.getLight.mockReturnValue(
			new Promise<ProtectLight>((resolve) => {
				finishGet = (raw: Raw) => resolve(protectLight(raw));
			}),
		);

		const result = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);
		expect(client.getLight).toHaveBeenCalledTimes(1);

		sessionListener?.(null, 'lost');
		finishGet(light({}, 3));

		await expect(result).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		expect(synchronizer.applyDeviceReadback).not.toHaveBeenCalled();
	});

	it('never confirms from a match before the PATCH resolved that a later frame contradicted', async () => {
		client.getLight.mockResolvedValue(protectLight(light({}, 6)));
		client.patchDevice.mockImplementation(() => {
			emit('light', LIGHT_ID, light({}, 3));
			emit('light', LIGHT_ID, light({}, 5));

			return Promise.resolve();
		});

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'not_confirmed' })]);
		expect(client.getLight).toHaveBeenCalledTimes(1);
	});

	it('evaluates the stored state, not the readback, when the readback was discarded', async () => {
		synchronizer.applyDeviceReadback.mockResolvedValue(false);
		client.getLight.mockResolvedValue(protectLight(light({}, 3)));
		seed('light', LIGHT_ID, light({}, 5));

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'not_confirmed' })]);
	});

	it('confirms from the stored state when the readback was discarded in favour of a matching frame', async () => {
		synchronizer.applyDeviceReadback.mockImplementation(() => {
			stored.set(LIGHT_KEY, light({}, 3));

			return Promise.resolve(false);
		});
		client.getLight.mockResolvedValue(protectLight(light({}, 6)));

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'confirmed' })]);
	});

	it('treats a failed readback as a non-match', async () => {
		client.getLight.mockRejectedValue(apiError(ProtectErrorCategory.TIMEOUT));

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'not_confirmed' })]);
		expect(synchronizer.applyDeviceReadback).not.toHaveBeenCalled();
	});

	it('subscribes on init and unsubscribes both listeners on destroy, cancelling pending commands', async () => {
		expect(synchronizer.observeDevices).toHaveBeenCalledTimes(1);
		expect(connector.onSessionChange).toHaveBeenCalledTimes(1);

		const result = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(1000);
		platform.onModuleDestroy();

		expect(unsubscribeObserver).toHaveBeenCalledTimes(1);
		expect(unsubscribeSession).toHaveBeenCalledTimes(1);
		await expect(result).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
	});

	it('logs failures without values, bodies or the key', async () => {
		client.patchDevice.mockRejectedValue(apiError(ProtectErrorCategory.BAD_REQUEST));

		await platform.executeBatch([brightnessUpdate(50)]);
		await platform.executeBatch([brightnessUpdate(50)]);

		const lines = loggedLines();
		const failures = lines.filter((line) => line.includes('UniFi Protect command failed'));

		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain(
			`UniFi Protect command failed (rejected) property=${brightnessProperty.id} mapping=light_brightness`,
		);

		for (const line of lines) {
			expect(line).not.toContain('ledLevel');
			expect(line).not.toContain('"50"');
			expect(line).not.toContain(FAKE_PROTECT_API_KEY);
		}
	});

	it('logs a confirmation at debug level with its source and no value', async () => {
		seed('light', LIGHT_ID, light({}, 3));

		await platform.processBatch([brightnessUpdate(50)]);

		const debug = (Logger.prototype.debug as jest.Mock).mock.calls.map((call) => JSON.stringify(call));

		expect(debug.some((line) => line.includes(`UniFi Protect command confirmed (cache) device=${LIGHT_ID}`))).toBe(
			true,
		);
	});

	describe('session listeners', () => {
		let addSpy: jest.SpyInstance;
		let removeSpy: jest.SpyInstance;

		const abortCalls = (spy: jest.SpyInstance): number =>
			spy.mock.calls.filter((call: unknown[]) => call[0] === 'abort').length;

		beforeEach(() => {
			addSpy = jest.spyOn(AbortSignal.prototype, 'addEventListener');
			removeSpy = jest.spyOn(AbortSignal.prototype, 'removeEventListener');
		});

		it('leaves no session listener behind after a confirmed command', async () => {
			const result = platform.processBatch([brightnessUpdate(50)]);

			await flush();
			emit('light', LIGHT_ID, light({}, 3));
			await expect(result).resolves.toBe(true);

			expect(abortCalls(addSpy)).toBeGreaterThan(0);
			expect(abortCalls(removeSpy)).toBe(abortCalls(addSpy));
		});

		it('leaves no session listener behind after a readback and after a failed command', async () => {
			const readback = platform.processBatch([brightnessUpdate(50)]);

			await jest.advanceTimersByTimeAsync(3000);
			await expect(readback).resolves.toBe(true);

			client.patchDevice.mockRejectedValue(apiError(ProtectErrorCategory.BAD_REQUEST));
			await platform.executeBatch([brightnessUpdate(50)]);

			expect(abortCalls(addSpy)).toBeGreaterThan(0);
			expect(abortCalls(removeSpy)).toBe(abortCalls(addSpy));
		});
	});

	it('ends an in-flight command when a new session is announced during the confirmation wait', async () => {
		const result = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(1000);
		sessionListener?.({ generation: 2, client, identity: IDENTITY } as never, null);

		await expect(result).resolves.toEqual([expect.objectContaining({ outcome: 'unavailable' })]);
		await jest.advanceTimersByTimeAsync(5000);
		expect(client.getLight).not.toHaveBeenCalled();
	});

	it('confirms from the stored state, never from a cache that runs ahead of it', async () => {
		cache.set(LIGHT_KEY, light({}, 3));
		client.getLight.mockResolvedValue(protectLight(light({}, 6)));

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'not_confirmed' })]);
	});

	it('logs only the class name of an unexpected error', async () => {
		class SocketBoom extends Error {}

		client.patchDevice.mockRejectedValue(new SocketBoom('secret detail https://console/key'));

		await platform.executeBatch([brightnessUpdate(50)]);

		const failure = loggedLines().find((line) => line.includes('UniFi Protect command failed (failed)'));

		expect(failure).toContain('error=SocketBoom');
		expect(failure).not.toContain('secret detail');
		expect(failure).not.toContain('https://');
	});

	it('logs the Protect category of a readback that failed', async () => {
		client.getLight.mockRejectedValue(apiError(ProtectErrorCategory.AUTHENTICATION, 401));

		const outcomes = platform.executeBatch([brightnessUpdate(50)]);

		await jest.advanceTimersByTimeAsync(3000);

		await expect(outcomes).resolves.toEqual([expect.objectContaining({ outcome: 'not_confirmed' })]);

		const failure = loggedLines().find((line) => line.includes('UniFi Protect command failed (not_confirmed)'));

		expect(failure).toContain(`error=${ProtectErrorCategory.AUTHENTICATION}`);
	});
});
