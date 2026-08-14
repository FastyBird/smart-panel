import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyConnector } from './homey-connector.interface';
import { HomeyEventListener, HomeyUnsubscribe } from './homey-connector.types';
import { mapHomeyLocalTransportError } from './homey-local.error-mapper';
import {
	transformHomeyLocalDevice,
	transformHomeyLocalDevices,
	transformHomeyLocalEvent,
	transformHomeyLocalSystemInfo,
	transformHomeyLocalZones,
} from './homey-local.transformer';
import { HomeyLocalTransport, HomeyLocalTransportUnsubscribe } from './homey-local.transport';

interface HomeyLocalSubscription {
	active: boolean;
	cleanup: HomeyLocalTransportUnsubscribe;
	cleanupNeeded: boolean;
	cleanupPromise: Promise<void> | null;
}

/**
 * Transport-neutral local connector orchestration. A separate adapter owns the
 * eventual SDK or direct HTTP/realtime implementation selected by live proof.
 */
export class HomeyLocalConnector implements HomeyConnector {
	private connected = false;
	private transportCleanupNeeded = false;
	private connectionGeneration = 0;
	private lifecycleTail: Promise<void> = Promise.resolve();
	private readonly subscriptions = new Set<HomeyLocalSubscription>();

	constructor(private readonly transport: HomeyLocalTransport) {}

	connect(): Promise<void> {
		return this.enqueueLifecycle(async () => {
			if (!this.connected) {
				await this.connectTransport();
			}
		});
	}

	disconnect(): Promise<void> {
		return this.enqueueLifecycle(() => this.disconnectTransport());
	}

	async getSystemInfo(): Promise<HomeySystemInfo> {
		this.assertConnected(HomeyConnectorOperation.GET_SYSTEM_INFO);

		try {
			return transformHomeyLocalSystemInfo(await this.transport.getSystemInfo());
		} catch (error) {
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.GET_SYSTEM_INFO);
		}
	}

	async getZones(): Promise<readonly HomeyZone[]> {
		this.assertConnected(HomeyConnectorOperation.GET_ZONES);

		try {
			return transformHomeyLocalZones(await this.transport.getZones());
		} catch (error) {
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.GET_ZONES);
		}
	}

	async getDevices(): Promise<readonly HomeyDevice[]> {
		this.assertConnected(HomeyConnectorOperation.GET_DEVICES);

		try {
			const [rawZones, rawDevices] = await Promise.all([this.transport.getZones(), this.transport.getDevices()]);
			return transformHomeyLocalDevices(rawDevices, transformHomeyLocalZones(rawZones));
		} catch (error) {
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.GET_DEVICES);
		}
	}

	async getDevice(deviceId: string): Promise<HomeyDevice | null> {
		this.assertConnected(HomeyConnectorOperation.GET_DEVICE);

		try {
			const [rawZones, rawDevice] = await Promise.all([this.transport.getZones(), this.transport.getDevice(deviceId)]);

			return rawDevice === null ? null : transformHomeyLocalDevice(rawDevice, transformHomeyLocalZones(rawZones));
		} catch (error) {
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.GET_DEVICE);
		}
	}

	async setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void> {
		this.assertConnected(HomeyConnectorOperation.SET_CAPABILITY_VALUE);

		try {
			await this.transport.setCapabilityValue(deviceId, capabilityId, value);
		} catch (error) {
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.SET_CAPABILITY_VALUE);
		}
	}

	async subscribe(listener: HomeyEventListener): Promise<HomeyUnsubscribe> {
		this.assertConnected(HomeyConnectorOperation.SUBSCRIBE);
		const connectionGeneration = this.connectionGeneration;

		const subscription: HomeyLocalSubscription = {
			active: true,
			cleanup: () => undefined,
			cleanupNeeded: false,
			cleanupPromise: null,
		};

		try {
			subscription.cleanup = await this.transport.subscribe(async (rawEvent) => {
				if (!subscription.active || !this.connected || connectionGeneration !== this.connectionGeneration) {
					return;
				}

				try {
					await listener(transformHomeyLocalEvent(rawEvent));
				} catch {
					// Malformed upstream events and consumer failures cannot stop sibling subscribers.
				}
			});
			subscription.cleanupNeeded = true;
			this.subscriptions.add(subscription);
		} catch (error) {
			subscription.active = false;
			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.SUBSCRIBE);
		}

		if (!this.connected || connectionGeneration !== this.connectionGeneration) {
			subscription.active = false;

			try {
				await this.cleanupSubscription(subscription);
			} catch (error) {
				this.transportCleanupNeeded = true;
				throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.SUBSCRIBE);
			}

			throw new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.SUBSCRIBE);
		}

		return async () => {
			if (!subscription.cleanupNeeded) {
				return;
			}

			subscription.active = false;

			try {
				await this.cleanupSubscription(subscription);
			} catch (error) {
				throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.SUBSCRIBE);
			}
		};
	}

	private async connectTransport(): Promise<void> {
		if (this.transportCleanupNeeded) {
			try {
				await this.transport.disconnect();
				this.markTransportCleaned();
			} catch (error) {
				throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.CONNECT);
			}
		}

		this.transportCleanupNeeded = true;

		try {
			await this.transport.connect();
			this.connected = true;
			this.connectionGeneration += 1;
		} catch (error) {
			this.connected = false;

			try {
				await this.transport.disconnect();
				this.markTransportCleaned();
			} catch {
				// Preserve the categorized connect failure after best-effort partial cleanup.
			}

			throw mapHomeyLocalTransportError(error, HomeyConnectorOperation.CONNECT);
		}
	}

	private async disconnectTransport(): Promise<void> {
		if (!this.connected && !this.transportCleanupNeeded && this.subscriptions.size === 0) {
			return;
		}

		const shouldDisconnectTransport = this.connected || this.transportCleanupNeeded;
		const subscriptions = [...this.subscriptions];
		this.connected = false;
		this.connectionGeneration += 1;
		for (const subscription of subscriptions) {
			subscription.active = false;
		}

		const cleanupResults = await Promise.allSettled(
			subscriptions.map((subscription) => this.cleanupSubscription(subscription)),
		);
		let failed = false;
		let failureReason: unknown;

		for (const result of cleanupResults) {
			if (result.status === 'rejected') {
				failed = true;
				failureReason = result.reason as unknown;
				break;
			}
		}

		if (shouldDisconnectTransport) {
			try {
				await this.transport.disconnect();
				this.markTransportCleaned();
			} catch (error) {
				this.transportCleanupNeeded = true;

				if (!failed) {
					failed = true;
					failureReason = error;
				}
			}
		}

		if (failed) {
			throw mapHomeyLocalTransportError(failureReason, HomeyConnectorOperation.DISCONNECT);
		}
	}

	private enqueueLifecycle(operation: () => Promise<void>): Promise<void> {
		const result: Promise<void> = this.lifecycleTail.then(() => operation());
		this.lifecycleTail = this.settleLifecycle(result);

		return result;
	}

	private async settleLifecycle(operation: Promise<void>): Promise<void> {
		try {
			await operation;
		} catch {
			// Keep the serialization queue usable after a caller observes an operation failure.
		}
	}

	private async cleanupSubscription(subscription: HomeyLocalSubscription): Promise<void> {
		if (!subscription.cleanupNeeded) {
			return;
		}

		if (subscription.cleanupPromise !== null) {
			return subscription.cleanupPromise;
		}

		subscription.cleanupPromise = this.performSubscriptionCleanup(subscription);

		try {
			await subscription.cleanupPromise;
		} finally {
			subscription.cleanupPromise = null;
		}
	}

	private async performSubscriptionCleanup(subscription: HomeyLocalSubscription): Promise<void> {
		await subscription.cleanup();
		subscription.cleanupNeeded = false;
		this.subscriptions.delete(subscription);
	}

	private markTransportCleaned(): void {
		this.transportCleanupNeeded = false;

		for (const subscription of this.subscriptions) {
			subscription.active = false;
			subscription.cleanupNeeded = false;
		}

		this.subscriptions.clear();
	}

	private assertConnected(operation: HomeyConnectorOperation): void {
		if (!this.connected) {
			throw new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, operation);
		}
	}
}
