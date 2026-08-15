import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HomeyConnectorErrorCategory, HomeyConnectorOperation } from '../errors/homey-connector.error';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyLocalConnector } from './homey-local.connector';
import {
	HomeySdkClient,
	HomeySdkClientFactory,
	HomeySdkDevice,
	HomeySdkDevicesManager,
	HomeySdkEventListener,
	HomeySdkEventSource,
	HomeySdkOperationOptions,
	HomeySdkSystemManager,
	HomeySdkZonesManager,
} from './homey-sdk.client';
import { HomeySdkTransport } from './homey-sdk.transport';

const fixtureRoot = resolve(__dirname, '../__fixtures__');
const sourceRoot = resolve(fixtureRoot, 'versions/2026-08-13-shs-13.4.0');
const expectedRoot = resolve(fixtureRoot, 'expected/v1');
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;
const rawSystemInfo = {
	homeyModelName: 'Homey Pro',
	homeyTier: 'pro',
	homeyVersion: '13.4.0',
};
const rawZones = readJson(resolve(sourceRoot, 'zones.json')) as Record<string, unknown>;
const rawDevice = readJson(resolve(sourceRoot, 'devices/repeated-capabilities.json')) as Record<string, unknown>;
const expectedZones = readJson(resolve(expectedRoot, 'zones.json')) as HomeyZone[];
const expectedDevice = readJson(resolve(expectedRoot, 'devices/repeated-capabilities.json')) as HomeyDevice;

const config = {
	url: 'http://homey.invalid:4859',
	apiKey: 'sentinel-api-key',
	connectionTimeout: 1000,
} as const;

const rawFailure = (category: HomeyConnectorErrorCategory): Error => {
	switch (category) {
		case HomeyConnectorErrorCategory.AUTHENTICATION:
			return Object.assign(new Error('private authentication response'), { statusCode: 401 });
		case HomeyConnectorErrorCategory.AUTHORIZATION:
			return Object.assign(new Error('private authorization response'), { statusCode: 403 });
		case HomeyConnectorErrorCategory.TIMEOUT:
			return Object.assign(new Error('private timeout response'), { name: 'TimeoutError' });
		case HomeyConnectorErrorCategory.UNAVAILABLE:
			return Object.assign(new Error('private unavailable response'), { code: 'ECONNREFUSED' });
		case HomeyConnectorErrorCategory.VALIDATION:
			return Object.assign(new Error('private validation response'), { statusCode: 422 });
		case HomeyConnectorErrorCategory.UNSUPPORTED:
			return Object.assign(new Error('private unsupported response'), { code: 'HOMEY_UNSUPPORTED' });
		case HomeyConnectorErrorCategory.PROTOCOL:
			return new Error('private protocol response');
	}
};

class FakeEventSource implements HomeySdkEventSource {
	private readonly listeners = new Map<string, Set<HomeySdkEventListener>>();

	on(event: string, listener: HomeySdkEventListener): void {
		const listeners = this.listeners.get(event) ?? new Set<HomeySdkEventListener>();
		listeners.add(listener);
		this.listeners.set(event, listeners);
	}

	off(event: string, listener: HomeySdkEventListener): void {
		this.listeners.get(event)?.delete(listener);
	}

	async emit(event: string, payload: unknown): Promise<void> {
		await Promise.all([...(this.listeners.get(event) ?? [])].map(async (listener) => await listener(payload)));
	}

	emitSynchronously(event: string, payload: unknown): void {
		for (const listener of this.listeners.get(event) ?? []) {
			void listener(payload);
		}
	}

	listenerCount(event: string): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}

class FakeSdkDevice extends FakeEventSource implements HomeySdkDevice {
	readonly id: string;
	readonly available?: unknown;
	readonly connect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

	constructor(raw: Record<string, unknown>) {
		super();

		if (typeof raw.id !== 'string') {
			throw new Error('Fake Homey SDK device requires an ID');
		}

		Object.assign(this, structuredClone(raw));
		this.id = raw.id;
		this.available = raw.available;
	}
}

class FakeDevicesManager extends FakeEventSource implements HomeySdkDevicesManager {
	readonly connect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly getDevices = jest
		.fn<Promise<Record<string, HomeySdkDevice>>, [HomeySdkOperationOptions?]>()
		.mockImplementation(() => Promise.resolve(this.devices));
	readonly getDevice = jest
		.fn<Promise<HomeySdkDevice>, [HomeySdkOperationOptions & { id: string }]>()
		.mockImplementation(({ id }) => {
			const device = this.devices[id];

			if (device === undefined) {
				throw Object.assign(new Error('private missing-device response'), { statusCode: 404 });
			}

			return Promise.resolve(device);
		});
	readonly setCapabilityValue = jest
		.fn<
			Promise<unknown>,
			[
				HomeySdkOperationOptions & {
					capabilityId: string;
					deviceId: string;
					value: unknown;
				},
			]
		>()
		.mockResolvedValue(undefined);

	constructor(readonly devices: Record<string, FakeSdkDevice>) {
		super();
	}
}

class FakeZonesManager extends FakeEventSource implements HomeySdkZonesManager {
	readonly connect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly getZones = jest
		.fn<Promise<Record<string, unknown>>, [HomeySdkOperationOptions?]>()
		.mockResolvedValue(structuredClone(rawZones));
}

class FakeSystemManager implements HomeySdkSystemManager {
	readonly getInfo = jest
		.fn<Promise<unknown>, [HomeySdkOperationOptions?]>()
		.mockResolvedValue(structuredClone(rawSystemInfo));
}

class FakeSdkClient implements HomeySdkClient {
	readonly id = 'homey-system';
	readonly name = 'Homey';
	readonly version = '13.4.0';
	readonly devices: FakeDevicesManager;
	readonly zones = new FakeZonesManager();
	readonly system = new FakeSystemManager();
	readonly disconnect = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
	readonly destroy = jest.fn<void, []>();

	constructor(device = new FakeSdkDevice(rawDevice)) {
		this.devices = new FakeDevicesManager({ [device.id]: device });
	}
}

class FakeSdkFactory implements HomeySdkClientFactory {
	readonly createLocalApi = jest.fn<Promise<HomeySdkClient>, [{ address: string; token: string }]>();

	constructor(client: HomeySdkClient) {
		this.createLocalApi.mockResolvedValue(client);
	}
}

const createConnector = (client = new FakeSdkClient()) => {
	const factory = new FakeSdkFactory(client);
	const transport = new HomeySdkTransport(config, factory);
	const connector = new HomeyLocalConnector(transport);

	return { client, connector, factory, transport };
};

const createDeviceEventRecorder = () => {
	const events: HomeyEvent[] = [];
	let expectedEvent: { deviceId: string; resolve: () => void; type: HomeyEventType } | null = null;

	return {
		events,
		listener: (event: HomeyEvent): void => {
			events.push(event);

			if (
				expectedEvent !== null &&
				event.type === expectedEvent.type &&
				'deviceId' in event &&
				event.deviceId === expectedEvent.deviceId
			) {
				expectedEvent.resolve();
				expectedEvent = null;
			}
		},
		waitFor: (type: HomeyEventType, deviceId: string): Promise<void> =>
			new Promise((resolvePromise) => {
				expectedEvent = { deviceId, resolve: resolvePromise, type };
			}),
	};
};

describe('HomeySdkTransport', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it('authenticates during connect and forwards every authoritative operation with explicit timeouts', async () => {
		const { client, connector, factory } = createConnector();

		await connector.connect();

		expect(factory.createLocalApi).toHaveBeenCalledWith({ address: config.url, token: config.apiKey });
		expect(client.system.getInfo).toHaveBeenCalledWith({ $timeout: config.connectionTimeout });
		await expect(connector.getSystemInfo()).resolves.toStrictEqual({
			id: client.id,
			model: rawSystemInfo.homeyModelName,
			name: client.name,
			tier: rawSystemInfo.homeyTier,
			version: client.version,
		});
		await expect(connector.getZones()).resolves.toStrictEqual(expectedZones);
		await expect(connector.getDevices()).resolves.toStrictEqual([expectedDevice]);
		await expect(connector.getDevice(expectedDevice.id)).resolves.toStrictEqual(expectedDevice);
		await expect(connector.getDevice('missing-device')).resolves.toBeNull();
		await connector.setCapabilityValue(expectedDevice.id, 'measure_temperature.inside', null);

		expect(client.zones.getZones).toHaveBeenLastCalledWith({
			$cache: false,
			$timeout: config.connectionTimeout,
			$updateCache: true,
		});
		expect(client.devices.getDevices).toHaveBeenLastCalledWith({
			$cache: false,
			$timeout: config.connectionTimeout,
			$updateCache: true,
		});
		expect(client.devices.getDevice).toHaveBeenCalledWith({
			$cache: false,
			$timeout: config.connectionTimeout,
			$updateCache: true,
			id: expectedDevice.id,
		});
		expect(client.devices.setCapabilityValue).toHaveBeenCalledWith({
			$timeout: config.connectionTimeout,
			capabilityId: 'measure_temperature.inside',
			deviceId: expectedDevice.id,
			value: null,
		});

		await connector.disconnect();
		expect(client.disconnect).toHaveBeenCalledTimes(1);
		expect(client.destroy).toHaveBeenCalledTimes(1);
	});

	it.each(Object.values(HomeyConnectorErrorCategory))(
		'normalizes the SDK error category %s without retaining raw detail',
		async (category) => {
			const { client, connector } = createConnector();
			await connector.connect();
			client.system.getInfo.mockRejectedValueOnce(rawFailure(category));
			let observedError: unknown;

			try {
				await connector.getSystemInfo();
			} catch (error) {
				observedError = error;
			}

			expect(observedError).toMatchObject({
				category,
				operation: HomeyConnectorOperation.GET_SYSTEM_INFO,
			});
			expect(JSON.stringify(observedError)).not.toContain('private');

			await connector.disconnect();
		},
	);

	it.each([
		HomeyConnectorOperation.GET_ZONES,
		HomeyConnectorOperation.GET_DEVICES,
		HomeyConnectorOperation.GET_DEVICE,
		HomeyConnectorOperation.SET_CAPABILITY_VALUE,
		HomeyConnectorOperation.SUBSCRIBE,
		HomeyConnectorOperation.DISCONNECT,
	])('maps an SDK failure to the public %s operation', async (operation) => {
		const { client, connector } = createConnector();
		await connector.connect();
		const failure = rawFailure(HomeyConnectorErrorCategory.PROTOCOL);
		let invocation: Promise<unknown>;

		switch (operation) {
			case HomeyConnectorOperation.GET_ZONES:
				client.zones.getZones.mockRejectedValueOnce(failure);
				invocation = connector.getZones();
				break;
			case HomeyConnectorOperation.GET_DEVICES:
				client.devices.getDevices.mockRejectedValueOnce(failure);
				invocation = connector.getDevices();
				break;
			case HomeyConnectorOperation.GET_DEVICE:
				client.devices.getDevice.mockRejectedValueOnce(failure);
				invocation = connector.getDevice(expectedDevice.id);
				break;
			case HomeyConnectorOperation.SET_CAPABILITY_VALUE:
				client.devices.setCapabilityValue.mockRejectedValueOnce(failure);
				invocation = connector.setCapabilityValue(expectedDevice.id, 'onoff', true);
				break;
			case HomeyConnectorOperation.SUBSCRIBE:
				client.devices.connect.mockRejectedValueOnce(failure);
				invocation = connector.subscribe(() => undefined);
				break;
			case HomeyConnectorOperation.DISCONNECT:
				client.disconnect.mockRejectedValueOnce(failure);
				invocation = connector.disconnect();
				break;
			default:
				throw new Error(`Unexpected test operation: ${operation}`);
		}

		await expect(invocation).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.PROTOCOL,
			operation,
		});

		if (operation !== HomeyConnectorOperation.DISCONNECT) {
			await connector.disconnect();
		}
	});

	it('maps an authenticated SDK bootstrap failure to connect and destroys the partial client', async () => {
		const { client, connector } = createConnector();
		client.system.getInfo.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.AUTHENTICATION));

		await expect(connector.connect()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.AUTHENTICATION,
			operation: HomeyConnectorOperation.CONNECT,
		});
		expect(client.disconnect).toHaveBeenCalledTimes(1);
		expect(client.destroy).toHaveBeenCalledTimes(1);
	});

	it('subscribes managers and devices once, then emits normalized device, capability, availability, and zone events', async () => {
		const { client, connector } = createConnector();
		const device = Object.values(client.devices.devices)[0];
		const events: HomeyEvent[] = [];
		const secondEvents: HomeyEvent[] = [];
		await connector.connect();
		const unsubscribe = await connector.subscribe((event) => {
			events.push(event);
		});
		const unsubscribeSecond = await connector.subscribe((event) => {
			secondEvents.push(event);
		});

		expect(client.devices.connect).toHaveBeenCalledTimes(1);
		expect(client.zones.connect).toHaveBeenCalledTimes(1);
		expect(device.connect).toHaveBeenCalledTimes(1);

		await device.emit('capability', {
			capabilityId: 'measure_temperature.inside',
			lastUpdated: '2026-08-15T10:00:00.000Z',
			value: 0,
		});
		await device.emit('update', { available: false, unavailableMessage: 'Unavailable' });
		await client.devices.emit('device.update', device);
		await client.zones.emit('zone.update', { id: expectedZones[0].id });

		expect(events).toStrictEqual([
			expect.objectContaining({
				type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
				deviceId: expectedDevice.id,
				capabilityId: 'measure_temperature.inside',
				value: 0,
			}),
			expect.objectContaining({
				type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
				deviceId: expectedDevice.id,
				available: false,
			}),
			expect.objectContaining({ type: HomeyEventType.DEVICE_UPDATED, deviceId: expectedDevice.id }),
			expect.objectContaining({ type: HomeyEventType.ZONE_UPDATED, zoneId: expectedZones[0].id }),
		]);
		expect(secondEvents).toStrictEqual(events);

		await unsubscribe();
		expect(client.devices.disconnect).not.toHaveBeenCalled();
		await unsubscribeSecond();
		expect(device.disconnect).toHaveBeenCalledTimes(1);
		expect(client.devices.disconnect).toHaveBeenCalledTimes(1);
		expect(client.zones.disconnect).toHaveBeenCalledTimes(1);
		await connector.disconnect();
	});

	it('attaches and detaches devices announced after subscription without leaking item listeners', async () => {
		const { client, connector } = createConnector();
		const recorder = createDeviceEventRecorder();
		const addedDevice = new FakeSdkDevice({ ...rawDevice, id: 'added-device' });
		await connector.connect();
		await connector.subscribe(recorder.listener);

		const createdEvent = recorder.waitFor(HomeyEventType.DEVICE_ADDED, addedDevice.id);
		await client.devices.emit('device.create', addedDevice);
		await createdEvent;
		expect(addedDevice.connect).toHaveBeenCalledTimes(1);
		expect(addedDevice.listenerCount('capability')).toBe(1);
		expect(recorder.events.at(-1)).toMatchObject({
			type: HomeyEventType.DEVICE_ADDED,
			deviceId: addedDevice.id,
		});

		const deletedEvent = recorder.waitFor(HomeyEventType.DEVICE_REMOVED, addedDevice.id);
		await client.devices.emit('device.delete', { id: addedDevice.id });
		await deletedEvent;
		expect(addedDevice.disconnect).toHaveBeenCalledTimes(1);
		expect(addedDevice.listenerCount('capability')).toBe(0);
		expect(recorder.events.at(-1)).toMatchObject({
			type: HomeyEventType.DEVICE_REMOVED,
			deviceId: addedDevice.id,
		});

		await connector.disconnect();
	});

	it('settles runtime attach and detach failures from synchronous SDK emitters while routing lifecycle events', async () => {
		const { client, connector } = createConnector();
		const recorder = createDeviceEventRecorder();
		const failingAttachDevice = new FakeSdkDevice({ ...rawDevice, id: 'failing-attach-device' });
		const failingDetachDevice = new FakeSdkDevice({ ...rawDevice, id: 'failing-detach-device' });
		failingAttachDevice.connect.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.TIMEOUT));
		await connector.connect();
		await connector.subscribe(recorder.listener);

		const attachEvent = recorder.waitFor(HomeyEventType.DEVICE_ADDED, failingAttachDevice.id);
		client.devices.emitSynchronously('device.create', failingAttachDevice);
		await attachEvent;
		expect(failingAttachDevice.listenerCount('capability')).toBe(0);

		const createdEvent = recorder.waitFor(HomeyEventType.DEVICE_ADDED, failingDetachDevice.id);
		client.devices.emitSynchronously('device.create', failingDetachDevice);
		await createdEvent;
		expect(failingDetachDevice.listenerCount('capability')).toBe(1);
		failingDetachDevice.disconnect.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.UNAVAILABLE));

		const detachEvent = recorder.waitFor(HomeyEventType.DEVICE_REMOVED, failingDetachDevice.id);
		client.devices.emitSynchronously('device.delete', { id: failingDetachDevice.id });
		await detachEvent;
		expect(failingDetachDevice.listenerCount('capability')).toBe(0);

		await connector.disconnect();
	});

	it('cleans partial realtime setup while preserving the original subscription category', async () => {
		const { client, connector } = createConnector();
		await connector.connect();
		client.zones.connect.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.UNAVAILABLE));

		await expect(connector.subscribe(() => undefined)).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.UNAVAILABLE,
			operation: HomeyConnectorOperation.SUBSCRIBE,
		});
		expect(client.devices.disconnect).toHaveBeenCalledTimes(1);
		expect(client.zones.disconnect).toHaveBeenCalledTimes(1);

		await connector.disconnect();
	});

	it('bounds SDK client creation and destroys a client that resolves after the timeout', async () => {
		jest.useFakeTimers();
		const client = new FakeSdkClient();
		let resolveCreation = (_client: HomeySdkClient): void => undefined;
		const creation = new Promise<HomeySdkClient>((resolvePromise) => {
			resolveCreation = resolvePromise;
		});
		const factory: HomeySdkClientFactory = { createLocalApi: jest.fn().mockReturnValue(creation) };
		const connector = new HomeyLocalConnector(new HomeySdkTransport(config, factory));
		const connecting = connector.connect();

		await jest.advanceTimersByTimeAsync(config.connectionTimeout);
		await expect(connecting).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.TIMEOUT,
			operation: HomeyConnectorOperation.CONNECT,
		});

		resolveCreation(client);
		await Promise.resolve();
		expect(client.destroy).toHaveBeenCalledTimes(1);
	});

	it('destroys the SDK client even when realtime and socket cleanup fail', async () => {
		const { client, connector } = createConnector();
		await connector.connect();
		await connector.subscribe(() => undefined);
		client.devices.disconnect.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.UNAVAILABLE));
		client.disconnect.mockRejectedValueOnce(rawFailure(HomeyConnectorErrorCategory.UNAVAILABLE));

		await expect(connector.disconnect()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.UNAVAILABLE,
			operation: HomeyConnectorOperation.DISCONNECT,
		});
		expect(client.zones.disconnect).toHaveBeenCalledTimes(1);
		expect(client.destroy).toHaveBeenCalledTimes(1);
	});
});
