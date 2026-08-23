import { ConfigService } from '../../../modules/config/services/config.service';
import { HomeyConnectorFactory } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import { HomeyEventListener } from '../connectors/homey-connector.types';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS,
	HOMEY_COMMAND_WRITE_TIMEOUT_MS,
	HomeyConnectionState,
} from '../devices-homey.constants';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyCapabilityType, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeySynchronizerService } from './homey-synchronizer.service';
import { HomeyService } from './homey.service';

const INITIAL_TIME = new Date('2026-08-15T10:00:00.000Z');

const systemInfo: HomeySystemInfo = {
	id: 'homey-system',
	name: 'Homey Pro',
	version: '13.4.0',
	tier: 'pro',
	model: 'Homey Pro',
};

const zones: readonly HomeyZone[] = [
	{ id: 'zone-living', name: 'Living room', parentId: null, active: true, path: ['Living room'] },
];

const staleDevice: HomeyDevice = {
	id: 'device-light',
	name: 'Light',
	class: 'light',
	zoneId: 'zone-living',
	zoneName: 'Living room',
	zonePath: ['Living room'],
	available: true,
	availabilityMessage: null,
	driverId: 'homey:app:driver:light',
	manufacturer: 'Example',
	model: 'Light',
	energy: null,
	capabilities: [],
};

function createConnectorMock(onSubscribe: (listener: HomeyEventListener) => void, unsubscribe: jest.Mock) {
	return {
		connect: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined),
		getSystemInfo: jest.fn().mockResolvedValue(systemInfo),
		getZones: jest.fn().mockResolvedValue(zones),
		getDevices: jest.fn().mockResolvedValue([staleDevice]),
		getDevice: jest.fn().mockResolvedValue(staleDevice),
		setCapabilityValue: jest.fn().mockResolvedValue(undefined),
		subscribe: jest.fn().mockImplementation((nextListener: HomeyEventListener) => {
			onSubscribe(nextListener);

			return Promise.resolve(unsubscribe);
		}),
	} satisfies jest.Mocked<HomeyConnector>;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = (): void => undefined;
	const promise = new Promise<void>((nextResolve) => {
		resolve = nextResolve;
	});

	return { promise, resolve };
}

function acceptedCapabilityValues(devices: readonly HomeyDevice[]) {
	return devices.flatMap((device) =>
		device.capabilities
			.filter((capability) => capability.readable && capability.available !== false)
			.map((capability) => ({
				deviceId: device.id,
				capabilityId: capability.id,
				value: capability.value,
			})),
	);
}

async function flushMicrotasks(): Promise<void> {
	for (let index = 0; index < 10; index += 1) {
		await Promise.resolve();
	}
}

describe('HomeyService', () => {
	let config: HomeyConfigModel;
	let configService: jest.Mocked<Pick<ConfigService, 'getPluginConfig'>>;
	let connector: jest.Mocked<HomeyConnector>;
	let connectorFactory: jest.Mocked<HomeyConnectorFactory>;
	let synchronizer: jest.Mocked<
		Pick<
			HomeySynchronizerService,
			| 'filterEvents'
			| 'hasReadableCapabilityBinding'
			| 'synchronizeSnapshot'
			| 'synchronizeDevices'
			| 'synchronizeEvents'
			| 'reset'
		>
	>;
	let listener: HomeyEventListener | null;
	let unsubscribe: jest.Mock;
	let service: HomeyService;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(INITIAL_TIME);
		jest.spyOn(Math, 'random').mockReturnValue(0.5);
		listener = null;
		unsubscribe = jest.fn();
		config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
			reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		});
		configService = { getPluginConfig: jest.fn().mockReturnValue(config) };
		connector = createConnectorMock((nextListener) => {
			listener = nextListener;
		}, unsubscribe);
		connectorFactory = { create: jest.fn().mockReturnValue(connector) };
		synchronizer = {
			filterEvents: jest.fn((events) => [...events]),
			hasReadableCapabilityBinding: jest.fn().mockResolvedValue(true),
			synchronizeSnapshot: jest.fn((devices: readonly HomeyDevice[]) =>
				Promise.resolve({
					updated: 0,
					ignored: 0,
					failed: 0,
					acceptedEvents: [],
					acceptedCapabilityValues: acceptedCapabilityValues(devices),
				}),
			),
			synchronizeDevices: jest.fn((devices: readonly HomeyDevice[]) =>
				Promise.resolve({
					updated: 0,
					ignored: 0,
					failed: 0,
					acceptedEvents: [],
					acceptedCapabilityValues: acceptedCapabilityValues(devices),
				}),
			),
			synchronizeEvents: jest.fn((events: readonly HomeyEvent[], _currentDevices: ReadonlyMap<string, HomeyDevice>) =>
				Promise.resolve({ updated: 0, ignored: 0, failed: 0, acceptedEvents: [...events] }),
			),
			reset: jest.fn(),
		};
		service = new HomeyService(
			configService as unknown as ConfigService,
			synchronizer as unknown as HomeySynchronizerService,
			connectorFactory,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	async function emitLiveEvent(event: HomeyEvent): Promise<void> {
		void listener?.(event);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();
	}

	it('exposes the managed connector identity and starts stopped', () => {
		expect(service.pluginName).toBe(DEVICES_HOMEY_PLUGIN_NAME);
		expect(service.serviceId).toBe(DEVICES_HOMEY_CONNECTOR_SERVICE_ID);
		expect(service.getState()).toBe('stopped');
	});

	it('connects, subscribes before inventory, and stops idempotently', async () => {
		const order: string[] = [];
		expect(service.getInventorySnapshot()).toBeNull();
		connector.connect.mockImplementation(() => {
			order.push('connect');
			return Promise.resolve();
		});
		connector.getSystemInfo.mockImplementation(() => {
			order.push('system');
			return Promise.resolve(systemInfo);
		});
		connector.getZones.mockImplementation(() => {
			order.push('zones');
			return Promise.resolve(zones);
		});
		connector.subscribe.mockImplementation((nextListener: HomeyEventListener) => {
			order.push('subscribe');
			listener = nextListener;
			return Promise.resolve(unsubscribe);
		});
		connector.getDevices.mockImplementation(() => {
			order.push('devices');
			return Promise.resolve([staleDevice]);
		});

		await service.start();
		await service.start();

		expect(order).toEqual(['connect', 'system', 'zones', 'subscribe', 'devices']);
		expect(connectorFactory.create.mock.calls[0]?.[0]).toEqual({
			url: config.url,
			apiKey: config.apiKey,
			connectionTimeout: config.connectionTimeout,
		});
		expect(service.getState()).toBe('started');
		expect(await service.isHealthy()).toBe(true);
		const inventory = service.getInventorySnapshot();
		expect(inventory).toStrictEqual([staleDevice]);
		expect(inventory?.[0]).not.toBe(staleDevice);
		if (inventory) {
			(inventory[0]?.zonePath as string[]).push('mutated');
		}
		expect(service.getInventorySnapshot()).toStrictEqual([staleDevice]);
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.CONNECTED,
			degraded: false,
			homeyId: systemInfo.id,
			homeyName: systemInfo.name,
			homeyVersion: systemInfo.version,
			lastConnectedAt: INITIAL_TIME.toISOString(),
			lastInventorySyncAt: INITIAL_TIME.toISOString(),
			lastEventAt: null,
			reconnectCount: 0,
			reconciliationCount: 1,
			reconciliationFailureCount: 0,
			lastReconciliationDurationMs: 0,
			lastErrorCategory: null,
		});

		await service.stop();
		await service.stop();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(service.getState()).toBe('stopped');
		expect(await service.isHealthy()).toBe(false);
		expect(service.getInventorySnapshot()).toBeNull();
	});

	it('reads one fresh device only while connected and returns a defensive copy', async () => {
		await expect(service.getFreshDevice(staleDevice.id)).rejects.toBeInstanceOf(HomeyInventoryUnavailableError);

		await service.start();

		const fresh = await service.getFreshDevice(staleDevice.id);

		expect(connector.getDevice.mock.calls).toContainEqual([staleDevice.id]);
		expect(fresh).toStrictEqual(staleDevice);
		expect(fresh).not.toBe(staleDevice);
		(fresh?.zonePath as string[]).push('mutated');
		expect(staleDevice.zonePath).toStrictEqual(['Living room']);

		connector.getDevice.mockResolvedValueOnce(null);
		await expect(service.getFreshDevice('missing')).resolves.toBeNull();

		await service.stop();
		await expect(service.getFreshDevice(staleDevice.id)).rejects.toBeInstanceOf(HomeyInventoryUnavailableError);
	});

	it('tracks successful events and exposes every lifecycle transition', async () => {
		const connect = deferred();
		connector.connect.mockReturnValueOnce(connect.promise);
		const start = service.start();

		await flushMicrotasks();
		expect(service.getStatus()).toMatchObject({
			serviceState: 'starting',
			connectionState: HomeyConnectionState.CONNECTING,
		});

		connect.resolve();
		await start;
		jest.setSystemTime(new Date('2026-08-15T10:01:00.000Z'));
		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});

		expect(service.getStatus().lastEventAt).toBe('2026-08-15T10:01:00.000Z');

		const disconnect = deferred();
		connector.disconnect.mockReturnValueOnce(disconnect.promise);
		const stop = service.stop();
		await flushMicrotasks();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'stopping',
			connectionState: HomeyConnectionState.STOPPED,
		});

		disconnect.resolve();
		await stop;
		expect(service.getStatus().serviceState).toBe('stopped');
	});

	it('batches live capability bursts without issuing a targeted read for each value event', async () => {
		await service.start();
		connector.getDevice.mockClear();
		synchronizer.synchronizeEvents.mockClear();
		const first: HomeyEvent = {
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'dim',
			value: 0.25,
			lastUpdatedAt: '2026-08-15T10:01:00.000Z',
			occurredAt: '2026-08-15T10:01:00.000Z',
			sequence: null,
		};
		const final: HomeyEvent = { ...first, value: 0.5, lastUpdatedAt: '2026-08-15T10:01:01.000Z' };

		void listener?.(first);
		void listener?.(final);

		expect(synchronizer.synchronizeEvents).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		expect(synchronizer.synchronizeEvents).toHaveBeenCalledTimes(1);
		expect(synchronizer.synchronizeEvents).toHaveBeenCalledWith(
			[expect.objectContaining(first), expect.objectContaining(final)],
			expect.any(Map),
		);
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('waits for a matching synchronized event as authoritative command confirmation', async () => {
		await service.start();
		connector.getDevice.mockClear();
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		expect(connector.setCapabilityValue.mock.calls).toContainEqual([staleDevice.id, 'onoff', true]);

		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});
		await jest.advanceTimersByTimeAsync(0);

		await expect(command).resolves.toBe(true);
		expect(synchronizer.synchronizeEvents).toHaveBeenCalled();
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('does not confirm a command from a matching event observed before the command started', async () => {
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(staleDevice);
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});

		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(false);
		expect(connector.getDevice.mock.calls).toEqual([[staleDevice.id]]);

		await service.stop();
	});

	it('ties command confirmation to the accepted event observation revision', async () => {
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(staleDevice);
		synchronizer.synchronizeEvents.mockImplementationOnce((events) =>
			Promise.resolve({
				updated: 1,
				ignored: 1,
				failed: 0,
				acceptedEvents: events.slice(0, 1),
			}),
		);
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});

		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(false);
		expect(connector.getDevice.mock.calls).toEqual([[staleDevice.id]]);

		await service.stop();
	});

	it('confirms from a capability event accepted through a targeted device refresh', async () => {
		const refreshedDevice = {
			...staleDevice,
			capabilities: staleDevice.capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, value: true } : capability,
			),
		};
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(refreshedDevice);
		synchronizer.synchronizeDevices.mockImplementationOnce((_devices, _missingDeviceIds, events) =>
			Promise.resolve({
				updated: 1,
				ignored: 0,
				failed: 0,
				acceptedEvents: events.filter((event) => event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED),
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		void listener?.({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 2,
		});
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		await expect(command).resolves.toBe(true);
		expect(connector.getDevice.mock.calls).toEqual([[staleDevice.id]]);

		await service.stop();
	});

	it('confirms from a capability event accepted through a zone-triggered snapshot', async () => {
		const refreshedDevice = {
			...staleDevice,
			capabilities: staleDevice.capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, value: true } : capability,
			),
		};
		await service.start();
		connector.getDevice.mockClear();
		connector.getDevices.mockResolvedValueOnce([refreshedDevice]);
		synchronizer.synchronizeSnapshot.mockImplementationOnce((_devices, events) =>
			Promise.resolve({
				updated: 1,
				ignored: 0,
				failed: 0,
				acceptedEvents: events.filter((event) => event.type === HomeyEventType.CAPABILITY_VALUE_CHANGED),
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		void listener?.({
			type: HomeyEventType.ZONE_UPDATED,
			zoneId: 'zone-living',
			occurredAt: null,
			sequence: 2,
		});
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		await expect(command).resolves.toBe(true);
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('does not confirm a command from a matching event rejected by synchronization ordering', async () => {
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(staleDevice);
		synchronizer.synchronizeDevices.mockClear();
		synchronizer.synchronizeEvents.mockResolvedValueOnce({
			updated: 0,
			ignored: 1,
			failed: 0,
			acceptedEvents: [],
		});
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		let settled = false;
		void command.then(() => {
			settled = true;
		});

		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});
		await jest.advanceTimersByTimeAsync(0);

		expect(settled).toBe(false);

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(false);
		expect(connector.getDevice.mock.calls).toEqual([[staleDevice.id]]);
		expect(synchronizer.synchronizeDevices).not.toHaveBeenCalled();

		await service.stop();
	});

	it('performs one targeted read and synchronizes it when event confirmation times out', async () => {
		const confirmedDevice: HomeyDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'dim',
					title: 'Dim',
					value: 0.5,
					type: HomeyCapabilityType.NUMBER,
					unit: null,
					minimum: 0,
					maximum: 1,
					step: 0.01,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(confirmedDevice);
		synchronizer.synchronizeEvents.mockClear();
		const command = service.executeCapabilityCommand(staleDevice.id, 'dim', 0.5);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(true);
		expect(connector.getDevice.mock.calls).toHaveLength(1);
		expect(connector.getDevice.mock.calls[0]).toEqual([staleDevice.id]);
		expect(synchronizer.synchronizeEvents).toHaveBeenCalledWith(
			[
				expect.objectContaining({
					type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
					deviceId: staleDevice.id,
					capabilityId: 'dim',
					value: 0.5,
				}),
			],
			expect.any(Map),
		);

		await service.stop();
	});

	it('accepts an authoritative idempotent readback without requiring a newer persistence event', async () => {
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: true,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: '2026-08-15T10:00:00.000Z',
				}),
			],
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(currentDevice);
		synchronizer.synchronizeEvents.mockClear();
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(true);
		expect(connector.getDevice.mock.calls).toEqual([[staleDevice.id]]);
		expect(synchronizer.synchronizeEvents.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('accepts a changed authoritative readback for a write-only capability binding', async () => {
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const confirmedDevice = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({ ...capability, value: true })),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(confirmedDevice);
		synchronizer.hasReadableCapabilityBinding.mockResolvedValueOnce(false);
		synchronizer.synchronizeEvents.mockClear();
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(true);
		expect(synchronizer.synchronizeEvents.mock.calls).toHaveLength(0);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(true);

		await service.stop();
	});

	it('merges a targeted readback without rolling back a newer sibling capability', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
				createHomeyCapability({
					id: 'dim',
					title: 'Brightness',
					value: 0.2,
					type: HomeyCapabilityType.NUMBER,
					unit: null,
					minimum: 0,
					maximum: 1,
					step: 0.01,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const confirmedDevice = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, value: true } : capability,
			),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await emitLiveEvent({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'dim',
			value: 0.9,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		resolveReadback?.(confirmedDevice);
		await flushMicrotasks();

		await expect(command).resolves.toBe(true);
		expect(service.getInventorySnapshot()?.[0].capabilities).toEqual([
			expect.objectContaining({ id: 'onoff', value: true }),
			expect.objectContaining({ id: 'dim', value: 0.9 }),
		]);

		await service.stop();
	});

	it('does not resurrect a device removed while a targeted readback is in flight', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const confirmedDevice = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({ ...capability, value: true })),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_REMOVED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 2,
		});
		resolveReadback?.(confirmedDevice);
		await flushMicrotasks();

		await expect(command).resolves.toBe(false);
		expect(service.getInventorySnapshot()).toEqual([]);

		await service.stop();
	});

	it('bounds waiting for queued fallback synchronization without dropping the operation', async () => {
		const blocker = deferred();
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const confirmedDevice = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({ ...capability, value: true })),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(confirmedDevice);
		const internal = service as unknown as {
			enqueueSynchronization(operation: () => Promise<void>): Promise<void>;
		};
		const blockedSynchronization = internal.enqueueSynchronization(() => blocker.promise);
		await flushMicrotasks();
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_WRITE_TIMEOUT_MS);

		await expect(command).resolves.toBe(false);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(false);

		blocker.resolve();
		await blockedSynchronization;
		await flushMicrotasks();

		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(true);

		await service.stop();
	});

	it('prevents a timed-out queued readback from superseding a later command', async () => {
		const blocker = deferred();
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const firstReadback = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({ ...capability, value: true })),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockResolvedValueOnce(firstReadback).mockResolvedValueOnce(currentDevice);
		const internal = service as unknown as {
			enqueueSynchronization(operation: () => Promise<void>): Promise<void>;
		};
		const blockedSynchronization = internal.enqueueSynchronization(() => blocker.promise);
		await flushMicrotasks();
		const first = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_WRITE_TIMEOUT_MS);
		await expect(first).resolves.toBe(false);

		const second = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await flushMicrotasks();
		blocker.resolve();
		await blockedSynchronization;
		await flushMicrotasks();

		await expect(second).resolves.toBe(true);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(false);

		await service.stop();
	});

	it('rejects a stale matching readback after a newer queued event was accepted', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const staleReadback = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, value: true, lastUpdatedAt: null } : capability,
			),
		};
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		synchronizer.synchronizeEvents
			.mockImplementationOnce((events) =>
				Promise.resolve({ updated: 1, ignored: 0, failed: 0, acceptedEvents: [...events] }),
			)
			.mockResolvedValueOnce({ updated: 0, ignored: 1, failed: 0, acceptedEvents: [] });
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();
		resolveReadback?.(staleReadback);
		await flushMicrotasks();

		await expect(command).resolves.toBe(false);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(false);

		await service.stop();
	});

	it('rejects a delayed readback after periodic reconciliation records newer snapshot evidence', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: null,
				}),
			],
		};
		const staleReadback = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({ ...capability, value: true })),
		};
		config.reconciliationInterval = HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS + 1;
		connector.getDevices.mockResolvedValue([currentDevice]);
		await service.start();
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await jest.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		resolveReadback?.(staleReadback);
		await flushMicrotasks();

		await expect(command).resolves.toBe(false);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(false);

		await service.stop();
	});

	it('does not record rejected periodic snapshot values as command evidence', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: '2026-08-15T10:02:00.000Z',
				}),
			],
		};
		const rejectedSnapshot = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({
				...capability,
				value: true,
				lastUpdatedAt: '2026-08-15T10:01:00.000Z',
			})),
		};
		config.reconciliationInterval = HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS + 1;
		connector.getDevices.mockResolvedValueOnce([currentDevice]);
		await service.start();
		connector.getDevices.mockResolvedValueOnce([rejectedSnapshot]);
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		synchronizer.synchronizeSnapshot.mockResolvedValueOnce({
			updated: 0,
			ignored: 1,
			failed: 0,
			acceptedEvents: [],
			acceptedCapabilityValues: [],
		});
		synchronizer.synchronizeEvents.mockResolvedValueOnce({
			updated: 0,
			ignored: 1,
			failed: 0,
			acceptedEvents: [],
		});
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await jest.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		resolveReadback?.(rejectedSnapshot);
		await flushMicrotasks();

		await expect(command).resolves.toBe(false);
		expect(synchronizer.synchronizeEvents).toHaveBeenCalledTimes(1);

		await service.stop();
	});

	it('rejects an older write-only readback after a newer inventory snapshot', async () => {
		let resolveReadback: ((device: HomeyDevice | null) => void) | undefined;
		const currentDevice = {
			...staleDevice,
			capabilities: [
				createHomeyCapability({
					id: 'onoff',
					title: 'Power',
					value: false,
					type: HomeyCapabilityType.BOOLEAN,
					unit: null,
					minimum: null,
					maximum: null,
					step: null,
					enumValues: [],
					readable: true,
					writable: true,
					available: true,
					lastUpdatedAt: '2026-08-15T10:02:00.000Z',
				}),
			],
		};
		const olderReadback = {
			...currentDevice,
			capabilities: currentDevice.capabilities.map((capability) => ({
				...capability,
				value: true,
				lastUpdatedAt: '2026-08-15T10:01:00.000Z',
			})),
		};
		const noReadableEvidence = {
			updated: 0,
			ignored: 1,
			failed: 0,
			acceptedEvents: [],
			acceptedCapabilityValues: [],
		};
		config.reconciliationInterval = HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS + 1;
		connector.getDevices.mockResolvedValue([currentDevice]);
		synchronizer.synchronizeSnapshot.mockResolvedValueOnce(noReadableEvidence);
		await service.start();
		synchronizer.synchronizeSnapshot.mockResolvedValueOnce(noReadableEvidence);
		synchronizer.hasReadableCapabilityBinding.mockResolvedValueOnce(false);
		connector.getDevice.mockClear().mockReturnValueOnce(
			new Promise((resolve) => {
				resolveReadback = resolve;
			}),
		);
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);
		await jest.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		resolveReadback?.(olderReadback);
		await flushMicrotasks();

		await expect(command).resolves.toBe(false);
		expect(
			service.getInventorySnapshot()?.[0].capabilities.find((capability) => capability.id === 'onoff')?.value,
		).toBe(false);

		await service.stop();
	});

	it('rejects an unconfirmed command after exactly one mismatching readback', async () => {
		await service.start();
		connector.getDevice.mockClear().mockResolvedValue(staleDevice);
		synchronizer.synchronizeDevices.mockClear();
		const command = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		let settled = false;
		void command.then(() => {
			settled = true;
		});
		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});
		await jest.advanceTimersByTimeAsync(0);

		expect(settled).toBe(false);

		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_CONFIRMATION_TIMEOUT_MS);

		await expect(command).resolves.toBe(false);
		expect(connector.getDevice.mock.calls).toHaveLength(1);
		expect(synchronizer.synchronizeDevices.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('serializes concurrent writes to the same device capability', async () => {
		await service.start();
		connector.setCapabilityValue.mockClear();
		const first = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		const second = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();

		expect(connector.setCapabilityValue.mock.calls).toEqual([[staleDevice.id, 'onoff', true]]);

		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});
		await jest.advanceTimersByTimeAsync(0);
		await expect(first).resolves.toBe(true);
		await flushMicrotasks();

		expect(connector.setCapabilityValue.mock.calls).toEqual([
			[staleDevice.id, 'onoff', true],
			[staleDevice.id, 'onoff', false],
		]);

		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});
		await jest.advanceTimersByTimeAsync(0);

		await expect(second).resolves.toBe(true);
		await service.stop();
	});

	it('bounds a queued caller without releasing the timed-out transport barrier', async () => {
		const pendingWrite = deferred();
		await service.start();
		connector.setCapabilityValue
			.mockClear()
			.mockImplementationOnce(() => pendingWrite.promise)
			.mockResolvedValueOnce(undefined);
		const first = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		const second = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();

		expect(connector.setCapabilityValue.mock.calls).toEqual([[staleDevice.id, 'onoff', true]]);
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_WRITE_TIMEOUT_MS);
		await expect(first).resolves.toBe(false);
		await expect(second).resolves.toBe(false);
		expect(connector.setCapabilityValue.mock.calls).toHaveLength(1);
		const third = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();
		expect(connector.setCapabilityValue.mock.calls).toHaveLength(1);

		pendingWrite.resolve();
		await flushMicrotasks();
		expect(connector.setCapabilityValue.mock.calls).toEqual([
			[staleDevice.id, 'onoff', true],
			[staleDevice.id, 'onoff', false],
		]);

		void listener?.({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 1,
		});
		await jest.advanceTimersByTimeAsync(0);

		await expect(third).resolves.toBe(true);
		await service.stop();
	});

	it('retains a timed-out transport barrier across connector generations', async () => {
		const pendingWrite = deferred();
		let replacementListener: HomeyEventListener | null = null;
		const replacement = createConnectorMock((nextListener) => {
			replacementListener = nextListener;
		}, jest.fn());
		connectorFactory.create.mockReturnValueOnce(connector).mockReturnValueOnce(replacement);
		connector.setCapabilityValue.mockClear().mockImplementationOnce(() => pendingWrite.promise);
		await service.start();
		const first = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_WRITE_TIMEOUT_MS);
		await expect(first).resolves.toBe(false);
		const cancelledQueued = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();
		await service.stop();
		await expect(cancelledQueued).resolves.toBe(false);
		await service.start();

		const second = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();
		expect(replacement.setCapabilityValue.mock.calls).toHaveLength(0);

		pendingWrite.resolve();
		await flushMicrotasks();
		expect(replacement.setCapabilityValue.mock.calls).toEqual([[staleDevice.id, 'onoff', false]]);
		expect(replacementListener).not.toBeNull();

		await service.stop();
		await expect(second).resolves.toBe(false);
	});

	it('cancels an active write and its queued successor when the connector stops', async () => {
		await service.start();
		connector.setCapabilityValue.mockClear().mockImplementationOnce(() => new Promise(() => undefined));
		const active = service.executeCapabilityCommand(staleDevice.id, 'onoff', true);
		const queued = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();

		await service.stop();

		await expect(active).resolves.toBe(false);
		await expect(queued).resolves.toBe(false);
		expect(connector.setCapabilityValue.mock.calls).toEqual([[staleDevice.id, 'onoff', true]]);
		expect(jest.getTimerCount()).toBe(0);
	});

	it('rejects connector write failures and bounds a stalled write without readback', async () => {
		await service.start();
		connector.getDevice.mockClear();
		connector.setCapabilityValue.mockRejectedValueOnce(new Error('transport detail'));

		await expect(service.executeCapabilityCommand(staleDevice.id, 'onoff', true)).resolves.toBe(false);

		connector.setCapabilityValue.mockImplementationOnce(() => new Promise(() => undefined));
		const stalled = service.executeCapabilityCommand(staleDevice.id, 'onoff', false);
		await flushMicrotasks();
		await jest.advanceTimersByTimeAsync(HOMEY_COMMAND_WRITE_TIMEOUT_MS);

		await expect(stalled).resolves.toBe(false);
		expect(connector.getDevice.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('filters stale device events before mutating the inventory cache', async () => {
		await service.start();
		const update: HomeyEvent = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 2,
		};
		const removal: HomeyEvent = {
			type: HomeyEventType.DEVICE_REMOVED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 1,
		};
		synchronizer.filterEvents.mockReturnValueOnce([update]);

		void listener?.(update);
		void listener?.(removal);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		expect(synchronizer.filterEvents).toHaveBeenCalledWith([update, removal]);
		expect(synchronizer.synchronizeDevices).toHaveBeenCalledWith([staleDevice], [], [update]);
		expect(synchronizer.synchronizeEvents).not.toHaveBeenCalled();
		expect(service.getInventorySnapshot()).toStrictEqual([staleDevice]);

		await service.stop();
	});

	it('applies a targeted refresh independently when a newer availability event arrived first', async () => {
		await service.start();
		synchronizer.synchronizeDevices.mockClear();
		synchronizer.synchronizeEvents.mockClear();
		const freshDevice = {
			...staleDevice,
			capabilities: staleDevice.capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, value: false } : capability,
			),
		};
		connector.getDevice.mockResolvedValueOnce(freshDevice);
		const availability: HomeyEvent = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: staleDevice.id,
			available: false,
			availabilityMessage: 'Offline',
			occurredAt: null,
			sequence: 2,
		};
		const delayedUpdate: HomeyEvent = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 1,
		};

		void listener?.(availability);
		void listener?.(delayedUpdate);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		expect(connector.getDevice.mock.calls).toContainEqual([staleDevice.id]);
		expect(synchronizer.synchronizeDevices).toHaveBeenCalledWith([freshDevice], [], [availability, delayedUpdate]);
		expect(synchronizer.synchronizeEvents).not.toHaveBeenCalled();

		await service.stop();
	});

	it('keeps authoritative inventory available in degraded polling mode', async () => {
		connector.subscribe.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNSUPPORTED, HomeyConnectorOperation.SUBSCRIBE),
		);

		await service.start();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: HomeyConnectionState.DEGRADED_POLLING,
			healthy: false,
			degraded: true,
			lastInventorySyncAt: INITIAL_TIME.toISOString(),
			lastErrorCategory: HomeyConnectorErrorCategory.UNSUPPORTED,
			lastError: 'Homey event subscription is unavailable; polling is active',
		});
		expect(service.getInventorySnapshot()).toStrictEqual([staleDevice]);
		expect(jest.getTimerCount()).toBe(1);

		jest.setSystemTime(new Date('2026-08-15T10:05:00.000Z'));
		await jest.advanceTimersByTimeAsync(config.reconciliationInterval);

		expect(connector.getDevices.mock.calls).toHaveLength(2);
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.DEGRADED_POLLING,
			degraded: true,
			lastInventorySyncAt: '2026-08-15T10:10:00.000Z',
			reconnectCount: 0,
			reconciliationCount: 2,
			reconciliationFailureCount: 0,
			lastReconciliationDurationMs: 0,
		});

		await service.stop();
	});

	it('reconnects from transient degraded polling and counts the executed attempt', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connector.subscribe.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.SUBSCRIBE),
		);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);

		await service.start();

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.DEGRADED_POLLING,
			degraded: true,
			reconnectCount: 0,
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
		});
		expect(jest.getTimerCount()).toBe(2);

		await jest.advanceTimersByTimeAsync(1000);

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.CONNECTED,
			healthy: true,
			degraded: false,
			lastConnectedAt: '2026-08-15T10:00:01.000Z',
			reconnectCount: 1,
			reconciliationCount: 2,
			reconciliationFailureCount: 0,
			lastErrorCategory: null,
		});

		await service.stop();
	});

	it('fails closed when event subscription lacks authorization', async () => {
		connector.subscribe.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHORIZATION, HomeyConnectorOperation.SUBSCRIBE),
		);

		await expect(service.start()).rejects.toThrow('Homey authentication or authorization failed');
		expect(service.getStatus()).toMatchObject({
			serviceState: 'error',
			connectionState: HomeyConnectionState.AUTHENTICATION_FAILED,
			degraded: false,
			lastErrorCategory: HomeyConnectorErrorCategory.AUTHORIZATION,
		});
	});

	it('recovers from a retryable initial startup failure without a config change', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connector.connect.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.CONNECT),
		);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);

		await service.start();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: HomeyConnectionState.RECONNECTING,
			healthy: false,
			reconnectCount: 0,
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
			lastError: 'Homey connection is temporarily unavailable',
		});
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(replacementConnector.connect.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: HomeyConnectionState.CONNECTED,
			healthy: true,
			reconnectCount: 1,
			lastErrorCategory: null,
			lastError: null,
		});

		await service.stop();
	});

	it('records startup metadata read failures as reconciliation attempts', async () => {
		connector.getZones.mockImplementationOnce(() => {
			jest.setSystemTime(new Date(INITIAL_TIME.getTime() + 125));

			return Promise.reject(
				new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_ZONES),
			);
		});

		await service.start();

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.RECONNECTING,
			reconciliationCount: 1,
			reconciliationFailureCount: 1,
			lastReconciliationDurationMs: 125,
			lastInventorySyncAt: null,
		});
		expect(connector.subscribe.mock.calls).toHaveLength(0);
		expect(connector.getDevices.mock.calls).toHaveLength(0);

		await service.stop();
	});

	it('performs a targeted authoritative read for an event received during the startup snapshot', async () => {
		const freshDevice = { ...staleDevice, available: false, availabilityMessage: 'Offline' };
		connector.getDevice.mockResolvedValue(freshDevice);
		connector.getDevices.mockImplementation(async () => {
			await listener?.({
				type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
				deviceId: staleDevice.id,
				available: false,
				availabilityMessage: 'Offline',
				occurredAt: null,
				sequence: null,
			});

			return [staleDevice];
		});

		await service.start();

		expect(connector.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
			connector.getDevices.mock.invocationCallOrder[0],
		);
		expect(connector.getDevice.mock.calls).toContainEqual([staleDevice.id]);
		expect(synchronizer.synchronizeSnapshot).toHaveBeenCalledWith([staleDevice]);
		expect(synchronizer.synchronizeDevices).toHaveBeenCalledWith(
			[freshDevice],
			[],
			[
				{
					type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
					deviceId: staleDevice.id,
					available: false,
					availabilityMessage: 'Offline',
					occurredAt: null,
					sequence: null,
				},
			],
		);
		expect(synchronizer.synchronizeSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
			synchronizer.synchronizeDevices.mock.invocationCallOrder[0],
		);
		expect(await service.isHealthy()).toBe(true);

		await service.stop();
	});

	it('serializes periodic reconciliation and does not schedule an overlapping run', async () => {
		let resolveInventory: ((devices: readonly HomeyDevice[]) => void) | null = null;

		await service.start();
		connector.getDevices.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveInventory = resolve;
				}),
		);

		jest.advanceTimersByTime(config.reconciliationInterval);
		await Promise.resolve();
		await Promise.resolve();

		expect(connector.getDevices.mock.calls).toHaveLength(2);

		jest.advanceTimersByTime(config.reconciliationInterval * 2);
		await Promise.resolve();

		expect(connector.getDevices.mock.calls).toHaveLength(2);

		resolveInventory?.([staleDevice]);

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(service.getStatus()).toMatchObject({
			reconciliationCount: 2,
			reconciliationFailureCount: 0,
			lastReconciliationDurationMs: config.reconciliationInterval * 2,
		});
		expect(jest.getTimerCount()).toBe(1);

		await service.stop();
	});

	it('waits for every periodic inventory read to settle before reconnecting', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();

		let rejectZones: (error: Error) => void = () => undefined;
		let resolveDevices: (devices: readonly HomeyDevice[]) => void = () => undefined;
		connector.getZones.mockImplementationOnce(
			() =>
				new Promise<readonly HomeyZone[]>((_, reject) => {
					rejectZones = reject;
				}),
		);
		connector.getDevices.mockImplementationOnce(
			() =>
				new Promise<readonly HomeyDevice[]>((resolve) => {
					resolveDevices = resolve;
				}),
		);

		jest.advanceTimersByTime(config.reconciliationInterval);
		await Promise.resolve();
		await Promise.resolve();
		rejectZones(new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_ZONES));

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(jest.getTimerCount()).toBe(0);
		expect(connector.disconnect.mock.calls).toHaveLength(0);

		resolveDevices([staleDevice]);

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);
		expect(service.getStatus()).toMatchObject({
			lastInventorySyncAt: INITIAL_TIME.toISOString(),
			reconciliationCount: 2,
			reconciliationFailureCount: 1,
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
		});
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);

		await service.stop();
	});

	it('replaces the connector after a transient live synchronization failure', async () => {
		let replacementListener: HomeyEventListener | null = null;
		const replacementUnsubscribe = jest.fn();
		const replacementConnector = createConnectorMock((nextListener) => {
			replacementListener = nextListener;
		}, replacementUnsubscribe);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.RECONNECTING,
			healthy: false,
			lastEventAt: null,
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
			lastError: 'Homey connection is temporarily unavailable',
		});
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(999);
		expect(connectorFactory.create.mock.calls).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);
		expect(replacementListener).not.toBeNull();
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.CONNECTED,
			healthy: true,
			lastError: null,
		});

		await service.stop();
		expect(replacementUnsubscribe).toHaveBeenCalledTimes(1);
		expect(replacementConnector.disconnect.mock.calls).toHaveLength(1);
	});

	it('backs off exponentially after consecutive transient reconnect failures', async () => {
		const failingReplacement = createConnectorMock(() => undefined, jest.fn());
		failingReplacement.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.TIMEOUT, HomeyConnectorOperation.CONNECT),
		);
		const recoveredConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create
			.mockReset()
			.mockReturnValueOnce(connector)
			.mockReturnValueOnce(failingReplacement)
			.mockReturnValueOnce(recoveredConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});
		await jest.advanceTimersByTimeAsync(1000);

		expect(connectorFactory.create.mock.calls).toHaveLength(2);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);

		await jest.advanceTimersByTimeAsync(1999);
		expect(connectorFactory.create.mock.calls).toHaveLength(2);

		await jest.advanceTimersByTimeAsync(1);

		expect(connectorFactory.create.mock.calls).toHaveLength(3);
		expect(recoveredConnector.connect.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.CONNECTED,
			reconnectCount: 2,
		});

		await service.stop();
	});

	it('cancels a pending reconnect when authoritative traffic recovers', async () => {
		await service.start();
		connector.getDevice
			.mockRejectedValueOnce(
				new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
			)
			.mockResolvedValue(staleDevice);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		await emitLiveEvent(event);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);

		await emitLiveEvent(event);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connectorFactory.create.mock.calls).toHaveLength(1);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);

		await service.stop();
	});

	it('keeps a pending reconnect after locally processed capability traffic', async () => {
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: 1,
		});
		await emitLiveEvent({
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: true,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		});

		expect(connector.getDevice.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.RECONNECTING,
			healthy: false,
			lastErrorCategory: HomeyConnectorErrorCategory.UNAVAILABLE,
			lastError: 'Homey connection is temporarily unavailable',
		});
		expect(jest.getTimerCount()).toBe(1);

		await service.stop();
	});

	it('does not retry authentication failures encountered while reconnecting', async () => {
		const rejectedConnector = createConnectorMock(() => undefined, jest.fn());
		rejectedConnector.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHORIZATION, HomeyConnectorOperation.CONNECT),
		);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(rejectedConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});
		await jest.advanceTimersByTimeAsync(1000);

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.AUTHENTICATION_FAILED,
			healthy: false,
			lastErrorCategory: HomeyConnectorErrorCategory.AUTHORIZATION,
			lastError: 'Homey authentication or authorization failed',
		});
		expect(jest.getTimerCount()).toBe(0);

		await service.stop();
	});

	it('stops periodic work after a live authentication failure', async () => {
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.GET_DEVICE),
		);

		await emitLiveEvent({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});

		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.AUTHENTICATION_FAILED);
		expect(jest.getTimerCount()).toBe(0);

		await service.stop();
	});

	it('coalesces concurrent reconnect requests and cancels the pending attempt on stop', async () => {
		await service.start();
		connector.getDevice.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		void listener?.(event);
		void listener?.(event);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		expect(jest.getTimerCount()).toBe(1);
		expect(connectorFactory.create.mock.calls).toHaveLength(1);

		await service.stop();
		await jest.advanceTimersByTimeAsync(30000);

		expect(connectorFactory.create.mock.calls).toHaveLength(1);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.STOPPED);
	});

	it('drains an active reconciliation before disconnecting for reconnect', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		await emitLiveEvent(event);

		let rejectRead: (error: Error) => void = () => undefined;
		connector.getDevice.mockImplementationOnce(
			() =>
				new Promise((_, reject) => {
					rejectRead = reject;
				}),
		);
		void listener?.(event);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		await jest.advanceTimersByTimeAsync(1000);

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(0);

		rejectRead(new Error('in-flight read ended'));
		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);

		await service.stop();
	});

	it('refreshes device zone paths after a live zone change', async () => {
		await service.start();
		connector.getZones.mockClear();
		connector.getDevices.mockClear();
		synchronizer.synchronizeSnapshot.mockClear();
		const zoneEvent: HomeyEvent = {
			type: HomeyEventType.ZONE_UPDATED,
			zoneId: zones[0].id,
			occurredAt: null,
			sequence: 1,
		};
		const capabilityEvent: HomeyEvent = {
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: staleDevice.id,
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		};

		void listener?.(zoneEvent);
		void listener?.(capabilityEvent);
		await jest.advanceTimersByTimeAsync(0);
		await flushMicrotasks();

		expect(connector.getZones.mock.calls).toHaveLength(1);
		expect(connector.getDevices.mock.calls).toHaveLength(1);
		expect(synchronizer.synchronizeSnapshot).toHaveBeenCalledWith(
			[staleDevice],
			[zoneEvent, expect.objectContaining(capabilityEvent)],
		);

		await service.stop();
	});

	it('categorizes authentication failures and cleans up partial startup', async () => {
		connector.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.CONNECT),
		);

		await expect(service.start()).rejects.toThrow('Homey authentication or authorization failed');
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			serviceState: 'error',
			connectionState: HomeyConnectionState.AUTHENTICATION_FAILED,
			healthy: false,
			lastErrorCategory: HomeyConnectorErrorCategory.AUTHENTICATION,
			lastError: 'Homey authentication or authorization failed',
		});
	});

	it('cleans up a subscription after a failed inventory snapshot without exposing raw details', async () => {
		connector.getDevices.mockRejectedValue(new Error('configured-secret at http://homey.local:4859'));

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(JSON.stringify(service.getStatus())).not.toContain('configured-secret');
		expect(JSON.stringify(service.getStatus())).not.toContain('homey.local');
	});

	it('retries connector cleanup after a sanitized stop failure', async () => {
		await service.start();
		connector.disconnect.mockRejectedValueOnce(new Error('configured-secret cleanup detail'));

		await expect(service.stop()).rejects.toThrow('Homey service failed to stop');
		expect(service.getState()).toBe('error');
		expect(service.getStatus().lastError).toBe('Homey service failed to stop');

		await service.stop();

		expect(connector.disconnect.mock.calls).toHaveLength(2);
		expect(service.getState()).toBe('stopped');
	});

	it('fails safely when the production connector factory is not registered', async () => {
		service = new HomeyService(
			configService as unknown as ConfigService,
			synchronizer as unknown as HomeySynchronizerService,
		);

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.ERROR,
			healthy: false,
			lastErrorCategory: HomeyConnectorErrorCategory.UNSUPPORTED,
			lastError: 'Homey service failed to start',
		});
	});

	it('does not create a connector from incomplete saved configuration', async () => {
		config.apiKey = null;

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(connectorFactory.create.mock.calls).toHaveLength(0);
		expect(service.getStatus()).toMatchObject({
			configured: false,
			healthy: false,
			lastErrorCategory: HomeyConnectorErrorCategory.VALIDATION,
		});
	});

	it('reports configuration without exposing its URL or API key', () => {
		const status = service.getStatus();

		expect(status).toMatchObject({
			serviceState: 'stopped',
			connectionState: HomeyConnectionState.STOPPED,
			enabled: true,
			configured: true,
			healthy: false,
			degraded: false,
			homeyId: null,
			homeyName: null,
			homeyVersion: null,
			lastConnectedAt: null,
			lastInventorySyncAt: null,
			lastEventAt: null,
			reconnectCount: 0,
			reconciliationCount: 0,
			reconciliationFailureCount: 0,
			lastReconciliationDurationMs: null,
			lastErrorCategory: null,
			lastError: null,
		});
		expect(status).not.toHaveProperty('apiKey');
		expect(status).not.toHaveProperty('url');
	});

	it('reads current configuration for each status snapshot while stopped', () => {
		expect(service.getStatus()).toMatchObject({ enabled: true, configured: true });

		configService.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), {
				enabled: false,
				url: null,
				apiKey: null,
			}),
		);

		expect(service.getStatus()).toMatchObject({ enabled: false, configured: false });
		expect(configService.getPluginConfig).toHaveBeenCalledTimes(2);
	});

	it('requests a restart only when connector configuration changes', async () => {
		await service.start();

		expect(await service.onConfigChanged()).toEqual({ restartRequired: false });

		configService.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), config, { apiKey: 'next-key' }),
		);

		expect(await service.onConfigChanged()).toEqual({ restartRequired: true });

		await service.stop();
	});
});
