import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	HomeyConnectorContractFixtures,
	HomeyConnectorContractHarness,
	describeHomeyConnectorContract,
} from '../../../../test/support/homey-connector.contract';
import { HomeyConnectorErrorCategory, HomeyConnectorOperation } from '../errors/homey-connector.error';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyLocalConnector } from './homey-local.connector';
import {
	HomeyLocalTransport,
	HomeyLocalTransportEvent,
	HomeyLocalTransportEventListener,
	HomeyLocalTransportUnsubscribe,
} from './homey-local.transport';

interface CapabilityWrite {
	deviceId: string;
	capabilityId: string;
	value: unknown;
}

const fixtureRoot = resolve(__dirname, '../__fixtures__');
const expectedRoot = resolve(fixtureRoot, 'expected/v1');
const sourceRoot = resolve(fixtureRoot, 'versions/2026-08-13-shs-13.4.0');
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

const rawZones = readJson(resolve(sourceRoot, 'zones.json'));
const rawDevice = readJson(resolve(sourceRoot, 'devices/repeated-capabilities.json'));
const expectedZones = readJson(resolve(expectedRoot, 'zones.json')) as HomeyZone[];
const expectedDevice = readJson(resolve(expectedRoot, 'devices/repeated-capabilities.json')) as HomeyDevice;

const contractFixtures: HomeyConnectorContractFixtures = {
	systemInfo: {
		id: 'homey-1',
		name: 'Homey Pro',
		version: '12.4.0',
		tier: 'pro',
		model: 'Homey Pro',
	},
	zones: expectedZones,
	devices: [expectedDevice],
	events: [
		{
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: expectedDevice.id,
			capabilityId: 'measure_temperature.capability-suffix-000001',
			value: 22,
			lastUpdatedAt: '2026-08-13T10:01:00.000Z',
			occurredAt: '2026-08-13T10:01:00.000Z',
			sequence: 1,
		},
		{
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: expectedDevice.id,
			available: false,
			availabilityMessage: 'Device unavailable',
			occurredAt: '2026-08-13T10:02:00.000Z',
			sequence: 2,
		},
	],
	writeTarget: {
		deviceId: expectedDevice.id,
		capabilityId: 'measure_temperature.capability-suffix-000001',
	},
};

const rawFailure = (category: HomeyConnectorErrorCategory): Error => {
	switch (category) {
		case HomeyConnectorErrorCategory.AUTHENTICATION:
			return Object.assign(new Error('sentinel-secret'), { statusCode: 401 });
		case HomeyConnectorErrorCategory.AUTHORIZATION:
			return Object.assign(new Error('sentinel-secret'), { statusCode: 403 });
		case HomeyConnectorErrorCategory.TIMEOUT:
			return Object.assign(new Error('sentinel-secret'), { name: 'TimeoutError' });
		case HomeyConnectorErrorCategory.UNAVAILABLE:
			return Object.assign(new Error('sentinel-secret'), { code: 'ECONNREFUSED' });
		case HomeyConnectorErrorCategory.VALIDATION:
			return Object.assign(new Error('sentinel-secret'), { statusCode: 422 });
		case HomeyConnectorErrorCategory.UNSUPPORTED:
			return Object.assign(new Error('sentinel-secret'), { code: 'HOMEY_UNSUPPORTED' });
		case HomeyConnectorErrorCategory.PROTOCOL:
			return new Error('sentinel-secret');
	}
};

const toRawEvent = (event: HomeyEvent): HomeyLocalTransportEvent => {
	switch (event.type) {
		case HomeyEventType.CAPABILITY_VALUE_CHANGED:
			return {
				type: 'capability',
				deviceId: event.deviceId,
				payload: {
					capabilityId: event.capabilityId,
					lastUpdatedAt: event.lastUpdatedAt,
					occurredAt: event.occurredAt,
					sequence: event.sequence,
					value: event.value,
				},
			};
		case HomeyEventType.DEVICE_AVAILABILITY_CHANGED:
			return {
				type: 'device.availability',
				payload: {
					available: event.available,
					availabilityMessage: event.availabilityMessage,
					id: event.deviceId,
					occurredAt: event.occurredAt,
					sequence: event.sequence,
				},
			};
		case HomeyEventType.DEVICE_ADDED:
			return { type: 'device.create', payload: { id: event.deviceId } };
		case HomeyEventType.DEVICE_UPDATED:
			return { type: 'device.update', payload: { id: event.deviceId } };
		case HomeyEventType.DEVICE_REMOVED:
			return { type: 'device.delete', payload: { id: event.deviceId } };
		case HomeyEventType.ZONE_ADDED:
			return { type: 'zone.create', payload: { id: event.zoneId } };
		case HomeyEventType.ZONE_UPDATED:
			return { type: 'zone.update', payload: { id: event.zoneId } };
		case HomeyEventType.ZONE_REMOVED:
			return { type: 'zone.delete', payload: { id: event.zoneId } };
	}
};

class FakeHomeyLocalTransport implements HomeyLocalTransport {
	private connected = false;
	private readonly listeners = new Set<HomeyLocalTransportEventListener>();
	private readonly failures = new Map<HomeyConnectorOperation, HomeyConnectorErrorCategory>();
	private readonly capabilityWrites: CapabilityWrite[] = [];
	private transportConnectCount = 0;
	private transportDisconnectCount = 0;
	private connectGate: Promise<void> | null = null;

	get writes(): readonly CapabilityWrite[] {
		return this.capabilityWrites;
	}

	get subscriberCount(): number {
		return this.listeners.size;
	}

	get connectCount(): number {
		return this.transportConnectCount;
	}

	get disconnectCount(): number {
		return this.transportDisconnectCount;
	}

	failNext(operation: HomeyConnectorOperation, category: HomeyConnectorErrorCategory): void {
		this.failures.set(operation, category);
	}

	deferNextConnect(): () => void {
		let release = (): void => undefined;
		this.connectGate = new Promise((resolve) => {
			release = resolve;
		});

		return release;
	}

	async connect(): Promise<void> {
		const gate = this.connectGate;
		this.connectGate = null;

		if (gate !== null) {
			await gate;
		}

		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.CONNECT);
			this.transportConnectCount += 1;
			this.connected = true;
		});
	}

	disconnect(): Promise<void> {
		return this.execute(() => {
			const failure = this.takeNextFailure(HomeyConnectorOperation.DISCONNECT);
			this.transportDisconnectCount += 1;
			this.connected = false;
			this.listeners.clear();

			if (failure !== undefined) {
				throw failure;
			}
		});
	}

	getSystemInfo(): Promise<unknown> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.GET_SYSTEM_INFO);
			return {
				homeyId: contractFixtures.systemInfo.id,
				homeyModelName: contractFixtures.systemInfo.model,
				homeyName: contractFixtures.systemInfo.name,
				homeyTier: contractFixtures.systemInfo.tier,
				homeyVersion: contractFixtures.systemInfo.version,
			};
		});
	}

	getZones(): Promise<unknown> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.GET_ZONES);
			return structuredClone(rawZones);
		});
	}

	getDevices(): Promise<unknown> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.GET_DEVICES);
			return { [expectedDevice.id]: structuredClone(rawDevice) };
		});
	}

	getDevice(deviceId: string): Promise<unknown> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.GET_DEVICE);
			return deviceId === expectedDevice.id ? structuredClone(rawDevice) : null;
		});
	}

	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.SET_CAPABILITY_VALUE);
			this.capabilityWrites.push({ deviceId, capabilityId, value });
		});
	}

	subscribe(listener: HomeyLocalTransportEventListener): Promise<HomeyLocalTransportUnsubscribe> {
		return this.execute(() => {
			this.throwNextFailure(HomeyConnectorOperation.SUBSCRIBE);
			this.listeners.add(listener);
			let active = true;

			return () => {
				if (!active) {
					return;
				}

				active = false;
				this.listeners.delete(listener);
			};
		});
	}

	async emit(event: HomeyEvent): Promise<void> {
		if (!this.connected) {
			return;
		}

		await Promise.all(
			[...this.listeners].map((listener) => Promise.resolve(listener(structuredClone(toRawEvent(event))))),
		);
	}

	private throwNextFailure(operation: HomeyConnectorOperation): void {
		const failure = this.takeNextFailure(operation);

		if (failure !== undefined) {
			throw failure;
		}
	}

	private takeNextFailure(operation: HomeyConnectorOperation): Error | undefined {
		const category = this.failures.get(operation);

		if (category === undefined) {
			return undefined;
		}

		this.failures.delete(operation);

		return rawFailure(category);
	}

	private execute<T>(operation: () => T): Promise<T> {
		try {
			return Promise.resolve(operation());
		} catch (error) {
			return Promise.reject(error instanceof Error ? error : new Error('Fake Homey local transport failed'));
		}
	}
}

describeHomeyConnectorContract('Local', (): HomeyConnectorContractHarness => {
	const transport = new FakeHomeyLocalTransport();
	const connector = new HomeyLocalConnector(transport);

	return {
		connector,
		fixtures: contractFixtures,
		emit: (event) => transport.emit(event),
		failNext: (operation, category) => transport.failNext(operation, category),
		get writes() {
			return transport.writes;
		},
		get subscriberCount() {
			return transport.subscriberCount;
		},
		get connectCount() {
			return transport.connectCount;
		},
		get disconnectCount() {
			return transport.disconnectCount;
		},
		dispose: () => connector.disconnect(),
	};
});

describe('Homey local connector lifecycle serialization', () => {
	it('honors connect, disconnect, connect call order while the first connection is pending', async () => {
		const transport = new FakeHomeyLocalTransport();
		const connector = new HomeyLocalConnector(transport);
		const releaseConnect = transport.deferNextConnect();

		const firstConnect = connector.connect();
		const disconnect = connector.disconnect();
		const finalConnect = connector.connect();

		releaseConnect();
		await expect(Promise.all([firstConnect, disconnect, finalConnect])).resolves.toBeDefined();
		expect(transport.connectCount).toBe(2);
		expect(transport.disconnectCount).toBe(1);
		await expect(connector.getSystemInfo()).resolves.toStrictEqual(contractFixtures.systemInfo);
		await connector.disconnect();
	});

	it('allows a fresh connection after transport disconnect fails', async () => {
		const transport = new FakeHomeyLocalTransport();
		const connector = new HomeyLocalConnector(transport);

		await connector.connect();
		transport.failNext(HomeyConnectorOperation.DISCONNECT, HomeyConnectorErrorCategory.UNAVAILABLE);

		await expect(connector.disconnect()).rejects.toMatchObject({
			category: HomeyConnectorErrorCategory.UNAVAILABLE,
			operation: HomeyConnectorOperation.DISCONNECT,
		});
		await expect(connector.connect()).resolves.toBeUndefined();
		expect(transport.connectCount).toBe(2);
		await connector.disconnect();
	});
});
