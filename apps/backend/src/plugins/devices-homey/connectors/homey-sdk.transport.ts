import { HomeyConnectorFactoryConfig } from './homey-connector.factory';
import {
	HomeyLocalTransport,
	HomeyLocalTransportEvent,
	HomeyLocalTransportEventListener,
	HomeyLocalTransportUnsubscribe,
} from './homey-local.transport';
import {
	HomeySdkClient,
	HomeySdkClientFactory,
	HomeySdkDevice,
	HomeySdkEventListener,
	HomeySdkEventSource,
} from './homey-sdk.client';

interface HomeySdkEventBinding {
	source: HomeySdkEventSource;
	event: string;
	listener: HomeySdkEventListener;
}

interface HomeySdkDeviceBinding {
	device: HomeySdkDevice;
	bindings: HomeySdkEventBinding[];
}

class HomeySdkTimeoutError extends Error {
	constructor() {
		super('Homey SDK operation timed out');
		this.name = 'TimeoutError';
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const identifierOf = (value: unknown): string | null => {
	if (!isRecord(value)) {
		return null;
	}

	return typeof value.id === 'string' && value.id.length > 0 ? value.id : null;
};

const statusCodeOf = (error: unknown): number | null => {
	if (!isRecord(error)) {
		return null;
	}

	for (const value of [error.statusCode, error.status, error.code]) {
		if (typeof value === 'number' && Number.isInteger(value)) {
			return value;
		}
	}

	return null;
};

/**
 * Production adapter for the Homey local SDK. Raw SDK values and failures stay
 * behind HomeyLocalTransport and are normalized by HomeyLocalConnector.
 */
export class HomeySdkTransport implements HomeyLocalTransport {
	private client: HomeySdkClient | null = null;
	private readonly subscribers = new Set<HomeyLocalTransportEventListener>();
	private readonly managerBindings: HomeySdkEventBinding[] = [];
	private readonly deviceBindings = new Map<string, HomeySdkDeviceBinding>();
	private realtimeActive = false;
	private lifecycleTail: Promise<void> = Promise.resolve();
	private deliveryTail: Promise<void> = Promise.resolve();

	constructor(
		private readonly config: HomeyConnectorFactoryConfig,
		private readonly sdkFactory: HomeySdkClientFactory,
	) {}

	connect(): Promise<void> {
		return this.enqueueLifecycle(async () => {
			if (this.client !== null) {
				return;
			}

			const client = await this.createClient();

			try {
				// createLocalAPI proves only that a Homey answered the unauthenticated ping.
				// An authenticated system read makes connect() honor the connector contract.
				await this.runSdkOperation(() => client.system.getInfo({ $timeout: this.config.connectionTimeout }));
				this.client = client;
			} catch (error) {
				await this.disposeClient(client);
				throw error;
			}
		});
	}

	disconnect(): Promise<void> {
		return this.enqueueLifecycle(async () => {
			const client = this.client;
			this.client = null;
			this.subscribers.clear();
			let failure: unknown;

			try {
				await this.stopRealtime(client);
			} catch (error) {
				failure = error;
			}

			if (client !== null) {
				try {
					await this.runSdkOperation(() => client.disconnect());
				} catch (error) {
					failure ??= error;
				}

				try {
					client.destroy();
				} catch (error) {
					failure ??= error;
				}
			}

			if (failure !== undefined) {
				throw failure;
			}
		});
	}

	async getSystemInfo(): Promise<unknown> {
		const client = this.requireClient();
		const systemInfo = await this.runSdkOperation(() =>
			client.system.getInfo({ $timeout: this.config.connectionTimeout }),
		);

		if (!isRecord(systemInfo)) {
			return systemInfo;
		}

		return {
			...systemInfo,
			...(client.id === null ? {} : { id: client.id }),
			...(client.name === null ? {} : { name: client.name }),
			...(client.version === null ? {} : { version: client.version }),
		};
	}

	getZones(): Promise<unknown> {
		const client = this.requireClient();

		return this.runSdkOperation(() =>
			client.zones.getZones({
				$cache: false,
				$timeout: this.config.connectionTimeout,
				$updateCache: true,
			}),
		);
	}

	getDevices(): Promise<unknown> {
		const client = this.requireClient();

		return this.runSdkOperation(() =>
			client.devices.getDevices({
				$cache: false,
				$timeout: this.config.connectionTimeout,
				$updateCache: true,
			}),
		);
	}

	async getDevice(deviceId: string): Promise<unknown> {
		const client = this.requireClient();

		try {
			return await this.runSdkOperation(() =>
				client.devices.getDevice({
					$cache: false,
					$timeout: this.config.connectionTimeout,
					$updateCache: true,
					id: deviceId,
				}),
			);
		} catch (error) {
			if (statusCodeOf(error) === 404) {
				return null;
			}

			throw error;
		}
	}

	setCapabilityValue(deviceId: string, capabilityId: string, value: unknown): Promise<void> {
		const client = this.requireClient();

		return this.runSdkOperation(async () => {
			await client.devices.setCapabilityValue({
				$timeout: this.config.connectionTimeout,
				capabilityId,
				deviceId,
				value,
			});
		});
	}

	async subscribe(listener: HomeyLocalTransportEventListener): Promise<HomeyLocalTransportUnsubscribe> {
		let active = true;

		await this.enqueueLifecycle(async () => {
			this.requireClient();
			this.subscribers.add(listener);

			if (this.realtimeActive) {
				return;
			}

			try {
				await this.startRealtime();
			} catch (error) {
				this.subscribers.delete(listener);
				throw error;
			}
		});

		return async () => {
			if (!active) {
				return;
			}

			active = false;

			await this.enqueueLifecycle(async () => {
				this.subscribers.delete(listener);

				if (this.subscribers.size === 0) {
					await this.stopRealtime(this.client);
				}
			});
		};
	}

	private async createClient(): Promise<HomeySdkClient> {
		const creation = this.sdkFactory.createLocalApi({
			address: this.config.url,
			token: this.config.apiKey,
		});

		try {
			return await this.runSdkOperation(() => creation);
		} catch (error) {
			if (error instanceof HomeySdkTimeoutError) {
				void creation.then(
					(lateClient) => {
						try {
							lateClient.destroy();
						} catch {
							// The sanitized timeout has already been returned to the connector.
						}
					},
					() => undefined,
				);
			}

			throw error;
		}
	}

	private async startRealtime(): Promise<void> {
		const client = this.requireClient();
		this.bindManagerEvents(client);

		try {
			await this.runSdkOperation(() => client.devices.connect());
			await this.runSdkOperation(() => client.zones.connect());
			const devices = await this.runSdkOperation(() =>
				client.devices.getDevices({
					$cache: false,
					$timeout: this.config.connectionTimeout,
					$updateCache: true,
				}),
			);

			for (const device of Object.values(devices)) {
				await this.attachDevice(device);
			}

			this.realtimeActive = true;
		} catch (error) {
			try {
				await this.stopRealtime(client);
			} catch {
				// Preserve the original categorized subscription failure.
			}

			throw error;
		}
	}

	private bindManagerEvents(client: HomeySdkClient): void {
		this.bind(client.devices, 'device.create', (payload) => {
			this.routeRuntimeDeviceEvent('device.create', payload);
		});
		this.bind(client.devices, 'device.update', (payload) => {
			this.routeRuntimeDeviceEvent('device.update', payload);
		});
		this.bind(client.devices, 'device.delete', (payload) => {
			this.routeRuntimeDeviceEvent('device.delete', payload);
		});
		this.bind(client.zones, 'zone.create', (payload) => this.queueEvent({ type: 'zone.create', payload }));
		this.bind(client.zones, 'zone.update', (payload) => this.queueEvent({ type: 'zone.update', payload }));
		this.bind(client.zones, 'zone.delete', (payload) => this.queueEvent({ type: 'zone.delete', payload }));
	}

	private routeRuntimeDeviceEvent(type: 'device.create' | 'device.update' | 'device.delete', payload: unknown): void {
		void this.handleRuntimeDeviceEvent(type, payload).catch(() => undefined);
	}

	private async handleRuntimeDeviceEvent(
		type: 'device.create' | 'device.update' | 'device.delete',
		payload: unknown,
	): Promise<void> {
		try {
			const deviceId = identifierOf(payload);

			if (type === 'device.delete') {
				if (deviceId !== null) {
					await this.detachDevice(deviceId);
				}
			} else if (deviceId !== null && !this.deviceBindings.has(deviceId)) {
				await this.attachDevice(payload as HomeySdkDevice);
			}
		} catch {
			// The SDK emitter does not observe returned promises. Keep failures settled;
			// a later update can retry attachment, while the lifecycle event still routes.
		}

		await this.queueEvent({ type, payload });
	}

	private async attachDevice(device: HomeySdkDevice): Promise<void> {
		const deviceId = identifierOf(device);

		if (deviceId === null || this.deviceBindings.has(deviceId)) {
			return;
		}

		const bindings: HomeySdkEventBinding[] = [];
		const capabilityListener: HomeySdkEventListener = (payload) =>
			this.queueEvent({ type: 'capability', deviceId, payload });
		const updateListener: HomeySdkEventListener = (payload) => {
			if (
				!isRecord(payload) ||
				(!Object.hasOwn(payload, 'available') && !Object.hasOwn(payload, 'unavailableMessage'))
			) {
				return;
			}

			const available = typeof payload.available === 'boolean' ? payload.available : device.available;

			if (typeof available !== 'boolean') {
				return;
			}

			return this.queueEvent({
				type: 'device.availability',
				payload: { ...payload, available, id: deviceId },
			});
		};

		bindings.push(this.bind(device, 'capability', capabilityListener, false));
		bindings.push(this.bind(device, 'update', updateListener, false));
		this.deviceBindings.set(deviceId, { device, bindings });

		try {
			await this.runSdkOperation(() => device.connect());
		} catch (error) {
			this.unbindAll(bindings);
			this.deviceBindings.delete(deviceId);
			throw error;
		}
	}

	private async detachDevice(deviceId: string): Promise<void> {
		const binding = this.deviceBindings.get(deviceId);

		if (binding === undefined) {
			return;
		}

		this.deviceBindings.delete(deviceId);
		this.unbindAll(binding.bindings);
		await this.runSdkOperation(() => binding.device.disconnect());
	}

	private async stopRealtime(client: HomeySdkClient | null): Promise<void> {
		const hadResources = this.realtimeActive || this.managerBindings.length > 0 || this.deviceBindings.size > 0;
		this.realtimeActive = false;
		this.unbindAll(this.managerBindings);
		this.managerBindings.length = 0;

		const deviceBindings = [...this.deviceBindings.values()];
		this.deviceBindings.clear();
		deviceBindings.forEach((binding) => this.unbindAll(binding.bindings));

		if (client === null || !hadResources) {
			await this.deliveryTail;
			return;
		}

		const results = await Promise.allSettled([
			...deviceBindings.map((binding) => this.runSdkOperation(() => binding.device.disconnect())),
			this.runSdkOperation(() => client.devices.disconnect()),
			this.runSdkOperation(() => client.zones.disconnect()),
		]);
		await this.deliveryTail;
		const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

		if (failure !== undefined) {
			throw failure.reason as unknown;
		}
	}

	private bind(
		source: HomeySdkEventSource,
		event: string,
		listener: HomeySdkEventListener,
		manager = true,
	): HomeySdkEventBinding {
		const binding = { source, event, listener };
		source.on(event, listener);

		if (manager) {
			this.managerBindings.push(binding);
		}

		return binding;
	}

	private unbindAll(bindings: readonly HomeySdkEventBinding[]): void {
		for (const binding of bindings) {
			binding.source.off?.(binding.event, binding.listener);
		}
	}

	private queueEvent(event: HomeyLocalTransportEvent): Promise<void> {
		const delivery = this.deliveryTail.then(async () => {
			await Promise.allSettled(
				[...this.subscribers].map(async (listener) => {
					await listener(event);
				}),
			);
		});
		this.deliveryTail = this.settleDelivery(delivery);

		return delivery;
	}

	private requireClient(): HomeySdkClient {
		if (this.client === null) {
			throw Object.assign(new Error('Homey SDK client is disconnected'), { code: 'ECONNRESET' });
		}

		return this.client;
	}

	private async runSdkOperation<T>(operation: () => Promise<T>): Promise<T> {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		const operationPromise = operation();
		const timeoutPromise = new Promise<never>((_resolve, reject) => {
			timeout = setTimeout(() => reject(new HomeySdkTimeoutError()), this.config.connectionTimeout);
		});

		try {
			return await Promise.race([operationPromise, timeoutPromise]);
		} finally {
			if (timeout !== undefined) {
				clearTimeout(timeout);
			}
		}
	}

	private async disposeClient(client: HomeySdkClient): Promise<void> {
		try {
			await this.runSdkOperation(() => client.disconnect());
		} catch {
			// Authentication/connect failure remains the primary categorized error.
		}

		try {
			client.destroy();
		} catch {
			// Authentication/connect failure remains the primary categorized error.
		}
	}

	private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
		const result: Promise<T> = this.lifecycleTail.then(async () => await operation());
		this.lifecycleTail = this.settleLifecycle(result);

		return result;
	}

	private async settleLifecycle(operation: Promise<unknown>): Promise<void> {
		try {
			await operation;
		} catch {
			// Keep SDK lifecycle serialization usable after a caller observes a failure.
		}
	}

	private async settleDelivery(operation: Promise<void>): Promise<void> {
		try {
			await operation;
		} catch {
			// A consumer failure cannot break ordering for later Homey events.
		}
	}
}
