import { HomeyConnector } from '../../src/plugins/devices-homey/connectors/homey-connector.interface';
import { HomeyEventListener, HomeyUnsubscribe } from '../../src/plugins/devices-homey/connectors/homey-connector.types';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../../src/plugins/devices-homey/errors/homey-connector.error';
import { HomeyDevice } from '../../src/plugins/devices-homey/models/homey-device.model';
import { HomeyEvent } from '../../src/plugins/devices-homey/models/homey-event.model';
import { HomeySystemInfo } from '../../src/plugins/devices-homey/models/homey-system-info.model';
import { HomeyZone } from '../../src/plugins/devices-homey/models/homey-zone.model';

export interface FakeHomeyConnectorFixtures {
	systemInfo: HomeySystemInfo;
	zones: readonly HomeyZone[];
	devices: readonly HomeyDevice[];
}

export interface FakeHomeyCapabilityWrite {
	deviceId: string;
	capabilityId: string;
	value: unknown;
}

/** Deterministic connector used by the shared connector contract and service tests. */
export class FakeHomeyConnector implements HomeyConnector {
	private connected = false;
	private readonly listeners = new Set<HomeyEventListener>();
	private readonly failures = new Map<HomeyConnectorOperation, HomeyConnectorErrorCategory>();
	private readonly capabilityWrites: FakeHomeyCapabilityWrite[] = [];
	private transportConnectCount = 0;
	private transportDisconnectCount = 0;

	constructor(private readonly fixtures: FakeHomeyConnectorFixtures) {}

	get writes(): readonly FakeHomeyCapabilityWrite[] {
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

	connect(): Promise<void> {
		return this.execute(() => {
			if (this.connected) {
				return;
			}

			this.throwNextFailure(HomeyConnectorOperation.CONNECT);
			this.transportConnectCount += 1;
			this.connected = true;
		});
	}

	disconnect(): Promise<void> {
		return this.execute(() => {
			if (!this.connected) {
				return;
			}

			const failure = this.takeNextFailure(HomeyConnectorOperation.DISCONNECT);

			this.transportDisconnectCount += 1;
			this.connected = false;
			this.listeners.clear();

			if (failure) {
				throw failure;
			}
		});
	}

	getSystemInfo(): Promise<HomeySystemInfo> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.GET_SYSTEM_INFO);
			this.throwNextFailure(HomeyConnectorOperation.GET_SYSTEM_INFO);

			return structuredClone(this.fixtures.systemInfo);
		});
	}

	getZones(): Promise<readonly HomeyZone[]> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.GET_ZONES);
			this.throwNextFailure(HomeyConnectorOperation.GET_ZONES);

			return structuredClone(this.fixtures.zones);
		});
	}

	getDevices(): Promise<readonly HomeyDevice[]> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.GET_DEVICES);
			this.throwNextFailure(HomeyConnectorOperation.GET_DEVICES);

			return structuredClone(this.fixtures.devices);
		});
	}

	getDevice(deviceId: string): Promise<HomeyDevice | null> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.GET_DEVICE);
			this.throwNextFailure(HomeyConnectorOperation.GET_DEVICE);

			const device = this.fixtures.devices.find((item) => item.id === deviceId);

			return device ? structuredClone(device) : null;
		});
	}

	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.SET_CAPABILITY_VALUE);
			this.throwNextFailure(HomeyConnectorOperation.SET_CAPABILITY_VALUE);
			this.capabilityWrites.push({ deviceId, capabilityId, value });
		});
	}

	subscribe(listener: HomeyEventListener): Promise<HomeyUnsubscribe> {
		return this.execute(() => {
			this.assertConnected(HomeyConnectorOperation.SUBSCRIBE);
			this.throwNextFailure(HomeyConnectorOperation.SUBSCRIBE);
			this.listeners.add(listener);

			let subscribed = true;

			return () => {
				if (!subscribed) {
					return;
				}

				subscribed = false;
				this.listeners.delete(listener);
			};
		});
	}

	async emit(event: HomeyEvent): Promise<void> {
		if (!this.connected) {
			return;
		}

		for (const listener of [...this.listeners]) {
			try {
				await listener(structuredClone(event));
			} catch {
				// Consumer failures are isolated from the connector and other listeners.
			}
		}
	}

	private assertConnected(operation: HomeyConnectorOperation): void {
		if (!this.connected) {
			throw new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, operation);
		}
	}

	private throwNextFailure(operation: HomeyConnectorOperation): void {
		const failure = this.takeNextFailure(operation);

		if (failure) {
			throw failure;
		}
	}

	private takeNextFailure(operation: HomeyConnectorOperation): HomeyConnectorError | null {
		const category = this.failures.get(operation);

		if (!category) {
			return null;
		}

		this.failures.delete(operation);

		return new HomeyConnectorError(category, operation);
	}

	private execute<T>(operation: () => T): Promise<T> {
		try {
			return Promise.resolve(operation());
		} catch (error) {
			return Promise.reject(error);
		}
	}
}
