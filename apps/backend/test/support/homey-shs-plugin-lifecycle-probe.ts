import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConfigService as NestConfigService } from '@nestjs/config';

import { ConfigService } from '../../src/modules/config/services/config.service';
import { PluginConfigValidatorService } from '../../src/modules/config/services/plugin-config-validator.service';
import { PluginServiceManagerService } from '../../src/modules/extensions/services/plugin-service-manager.service';
import { HomeyConnectorFactory } from '../../src/plugins/devices-homey/connectors/homey-connector.factory';
import { HomeyConnector } from '../../src/plugins/devices-homey/connectors/homey-connector.interface';
import { HomeyLocalConnectorFactory } from '../../src/plugins/devices-homey/connectors/homey-local-connector.factory';
import {
	type HomeySdkClient,
	type HomeySdkClientFactory,
	HomeySdkClientFactoryService,
} from '../../src/plugins/devices-homey/connectors/homey-sdk.client';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionState,
} from '../../src/plugins/devices-homey/devices-homey.constants';
import { HomeyConfigModel } from '../../src/plugins/devices-homey/models/config.model';
import { HomeyEvent } from '../../src/plugins/devices-homey/models/homey-event.model';
import {
	type HomeyOperationalDiagnostics,
	HomeySynchronizerService,
} from '../../src/plugins/devices-homey/services/homey-synchronizer.service';
import { HomeyService } from '../../src/plugins/devices-homey/services/homey.service';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const ENABLE_ACKNOWLEDGEMENT = 'I_WILL_VERIFY_HOMEY_PLUGIN_DISABLE_ENABLE_AND_BACKEND_SHUTDOWN';
const RECONCILIATION_INTERVAL_MS = 30_000;
const DEFAULT_OBSERVE_MS = 35_000;
const MIN_OBSERVE_MS = RECONCILIATION_INTERVAL_MS + 1_000;
const MAX_OBSERVE_MS = 120_000;
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const CONFLICTING_PREFIXES = [
	'FB_HOMEY_SHS_BURST_COMMAND_',
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_MAPPING_CONTROL_',
	'FB_HOMEY_SHS_ORIGIN_EVENT_',
	'FB_HOMEY_SHS_REALTIME_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_RESTART_EVENT_FLOW_',
	'FB_HOMEY_SHS_STARTUP_',
	'FB_HOMEY_SHS_WRITE_',
] as const;

type PluginLifecycleEvent =
	| 'backend.shutdown.requested'
	| 'backend.shutdown.resolved'
	| 'backend.shutdown.quiescence.verified'
	| 'manager.bootstrap.requested'
	| 'manager.bootstrap.resolved'
	| 'plugin.disable.requested'
	| 'plugin.disable.resolved'
	| 'plugin.disable.quiescence.verified'
	| 'plugin.enable.requested'
	| 'plugin.enable.resolved'
	| 'plugin.initial.connected.verified'
	| 'plugin.reenabled.connected.verified';

const SAFE_EVENTS: ReadonlySet<PluginLifecycleEvent> = new Set([
	'backend.shutdown.requested',
	'backend.shutdown.resolved',
	'backend.shutdown.quiescence.verified',
	'manager.bootstrap.requested',
	'manager.bootstrap.resolved',
	'plugin.disable.requested',
	'plugin.disable.resolved',
	'plugin.disable.quiescence.verified',
	'plugin.enable.requested',
	'plugin.enable.resolved',
	'plugin.initial.connected.verified',
	'plugin.reenabled.connected.verified',
]);

export interface HomeyShsPluginLifecycleConfig extends HomeyShsProbeConfig {
	observeMs: number;
}

export interface HomeyPluginLifecycleSnapshot {
	activityRevision: number;
	activeConnections: number;
	activeSubscriptions: number;
	connectorGeneration: number;
	connected: boolean;
	sdkActivityRevision: number;
	sdkActiveClients: number;
	sdkActiveListeners: number;
	sdkActiveSockets: number;
	sdkActiveSubscriptions: number;
	sdkActiveTimers: number;
	serviceStopped: boolean;
}

export interface HomeyPluginLifecycleRuntime {
	bootstrap(): Promise<void>;
	setEnabled(enabled: boolean): Promise<void>;
	shutdown(): Promise<void>;
	snapshot(): HomeyPluginLifecycleSnapshot;
}

export type HomeyPluginLifecycleRuntimeFactory = (config: HomeyShsPluginLifecycleConfig) => HomeyPluginLifecycleRuntime;
export type HomeyPluginLifecycleWait = (milliseconds: number) => Promise<void>;

export interface HomeyShsPluginLifecycleReport {
	metadata: {
		probe: 'homey-shs-plugin-lifecycle';
		schemaVersion: 1;
		sdkVersion: string;
	};
	observation: {
		backendShutdownDisconnected: boolean;
		backendShutdownQuiescent: boolean;
		disableDisconnected: boolean;
		disableQuiescent: boolean;
		freshConnectorAfterEnable: boolean;
		initialStartupConnected: boolean;
		reenableConnected: boolean;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: PluginLifecycleEvent; order: number }>;
	};
}

type HomeyPluginLifecycleSignal = 'SIGINT' | 'SIGTERM';

export interface HomeyPluginLifecycleSignalSource {
	on(signal: HomeyPluginLifecycleSignal, listener: () => void): unknown;
	off(signal: HomeyPluginLifecycleSignal, listener: () => void): unknown;
}

class HomeyPluginLifecycleTerminationError extends Error {
	constructor(readonly signal: HomeyPluginLifecycleSignal) {
		super(`Homey plugin-lifecycle probe received ${signal}; managed shutdown completed before termination`);
	}
}

interface HomeyConnectorTracker {
	activeConnections: number;
	activeSubscriptions: number;
	activityRevision: number;
	connectorGeneration: number;
}

interface HomeySdkResourceSnapshot {
	activityRevision: number;
	activeClients: number;
	activeListeners: number;
	activeSockets: number;
	activeSubscriptions: number;
	activeTimers: number;
}

interface HomeySdkResourceTracker {
	factory: HomeySdkClientFactory;
	snapshot(): HomeySdkResourceSnapshot;
}

const EMPTY_DIAGNOSTICS: HomeyOperationalDiagnostics = {
	adopted: 0,
	adoptedDevices: [],
	missing: 0,
	unsupported: 0,
	unavailable: 0,
};

const sleep: HomeyPluginLifecycleWait = (milliseconds) =>
	new Promise((resolvePromise) => {
		setTimeout(resolvePromise, milliseconds);
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const callBooleanMethod = (value: unknown, method: string): boolean => {
	if (!isRecord(value) || typeof value[method] !== 'function') return false;

	try {
		return (value[method] as () => unknown).call(value) === true;
	} catch {
		return true;
	}
};

const eventListenerCount = (value: unknown): number => {
	if (!isRecord(value)) return 0;
	let storedListeners = 0;

	for (const field of ['__listeners', '_callbacks']) {
		const listenerMap = isRecord(value[field]) ? value[field] : undefined;

		if (listenerMap === undefined) continue;
		storedListeners += Object.values(listenerMap).reduce<number>((count, listeners) => {
			if (Array.isArray(listeners)) return count + listeners.length;

			return count + (typeof listeners === 'function' ? 1 : 0);
		}, 0);
	}

	if (storedListeners > 0) return storedListeners;
	if (typeof value.eventNames !== 'function' || typeof value.listenerCount !== 'function') return 0;
	const eventSource = value as unknown as {
		eventNames(): unknown;
		listenerCount(event: unknown): unknown;
	};

	try {
		const eventNames = eventSource.eventNames();

		if (!Array.isArray(eventNames)) return 0;
		let count = 0;

		for (const eventName of eventNames as unknown[]) {
			const listeners = eventSource.listenerCount(eventName);

			if (typeof listeners === 'number' && Number.isInteger(listeners)) count += listeners;
		}

		return count;
	} catch {
		return 1;
	}
};

const activeRegistrySubscriptions = (client: HomeySdkClient): number => {
	const registry = (client as unknown as Record<string, unknown>).__subscriptionRegistry;
	const entries = isRecord(registry) ? registry.__entries : undefined;

	if (!(entries instanceof Map)) return 0;

	let active = 0;

	for (const entry of entries.values()) {
		if (!isRecord(entry)) {
			active += 1;
			continue;
		}

		const consumers = entry.consumers;
		active += consumers instanceof Set ? consumers.size : 0;
		if (entry.subscribePromise !== null && entry.subscribePromise !== undefined) active += 1;
		if (entry.reconnectPromise !== null && entry.reconnectPromise !== undefined) active += 1;
	}

	return active;
};

const activeSdkListeners = (client: HomeySdkClient): number => {
	const concrete = client as unknown as Record<string, unknown>;

	return eventListenerCount(client) + eventListenerCount(concrete.__socketSession);
};

const activeSdkTimers = (client: HomeySdkClient): number => {
	const concrete = client as unknown as Record<string, unknown>;
	const session = isRecord(concrete.__socketSession) ? concrete.__socketSession : undefined;
	const refreshMap = isRecord(concrete.__refreshMap) ? concrete.__refreshMap : undefined;
	let active = session?.__readyPromise === null || session?.__readyPromise === undefined ? 0 : 1;

	if (refreshMap !== undefined) {
		active += Object.entries(refreshMap).filter(
			([key, value]) => key.endsWith('timeout') && value !== null && value !== undefined,
		).length;
	}

	return active;
};

const isSocketResourceActive = (value: unknown): boolean => {
	if (!isRecord(value)) return false;

	const manager = isRecord(value.io) ? value.io : undefined;
	const engine = manager !== undefined && isRecord(manager.engine) ? manager.engine : undefined;
	const readyStates = [value.readyState, value._readyState, engine?.readyState];

	return (
		value.connected === true ||
		value.active === true ||
		manager?._reconnecting === true ||
		readyStates.some((state) => state === 'open' || state === 'opening') ||
		eventListenerCount(value) > 0
	);
};

const createHomeySdkResourceTracker = (delegate: HomeySdkClientFactory): HomeySdkResourceTracker => {
	const clients = new Set<HomeySdkClient>();
	const sockets = new Set<unknown>();
	let activityRevision = 0;
	const markActivity = (): void => {
		activityRevision += 1;
	};
	const trackClient = (client: HomeySdkClient): void => {
		clients.add(client);
		const eventSource = client as unknown as Record<string, unknown>;

		if (typeof eventSource.on !== 'function') return;
		for (const event of [
			'connect',
			'connect_error',
			'disconnect',
			'error',
			'reconnect',
			'reconnect_attempt',
			'reconnect_error',
			'reconnecting',
		]) {
			(eventSource.on as (event: string, listener: () => void) => unknown).call(client, event, markActivity);
		}
	};
	const captureSockets = (client: HomeySdkClient): void => {
		const concrete = client as unknown as Record<string, unknown>;

		if (concrete.__socket !== null && concrete.__socket !== undefined) sockets.add(concrete.__socket);
		if (concrete.__homeySocket !== null && concrete.__homeySocket !== undefined) sockets.add(concrete.__homeySocket);
	};

	return {
		factory: {
			createLocalApi: async (options) => {
				const client = await delegate.createLocalApi(options);
				trackClient(client);

				return client;
			},
		},
		snapshot: () => {
			for (const client of clients) captureSockets(client);

			return {
				activityRevision,
				activeClients: [...clients].filter(
					(client) =>
						!callBooleanMethod(client, 'isDestroyed') ||
						callBooleanMethod(client, 'isConnected') ||
						callBooleanMethod(client, 'isConnecting'),
				).length,
				activeListeners: [...clients].reduce((count, client) => count + activeSdkListeners(client), 0),
				activeSockets: [...sockets].filter(isSocketResourceActive).length,
				activeSubscriptions: [...clients].reduce((count, client) => count + activeRegistrySubscriptions(client), 0),
				activeTimers: [...clients].reduce((count, client) => count + activeSdkTimers(client), 0),
			};
		},
	};
};

const createSynchronizer = (): HomeySynchronizerService =>
	({
		filterEvents: (events: readonly unknown[]): readonly unknown[] => [...events],
		getOperationalDiagnostics: (): Promise<HomeyOperationalDiagnostics> => Promise.resolve(EMPTY_DIAGNOSTICS),
		hasReadableCapabilityBinding: (): Promise<boolean> => Promise.resolve(false),
		invalidateIndex: (): void => undefined,
		reset: (): void => undefined,
		synchronizeDevices: (_devices: readonly unknown[], _missing: readonly string[], events: readonly unknown[]) =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
		synchronizeEvents: (events: readonly HomeyEvent[]) =>
			Promise.resolve({ acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
		synchronizeSnapshot: (_devices: readonly unknown[], events: readonly unknown[] = []) =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
	}) as unknown as HomeySynchronizerService;

const createTrackedConnector = (connector: HomeyConnector, tracker: HomeyConnectorTracker): HomeyConnector => {
	let connected = false;
	const subscriptions = new Set<{ active: boolean }>();
	const markActivity = (): void => {
		tracker.activityRevision += 1;
	};

	return {
		connect: async () => {
			markActivity();
			await connector.connect();

			if (!connected) {
				connected = true;
				tracker.activeConnections += 1;
			}
		},
		disconnect: async () => {
			markActivity();
			await connector.disconnect();

			if (connected) {
				connected = false;
				tracker.activeConnections -= 1;
			}
			for (const subscription of subscriptions) {
				if (subscription.active) tracker.activeSubscriptions -= 1;
				subscription.active = false;
			}
			subscriptions.clear();
		},
		getDevice: (deviceId) => {
			markActivity();

			return connector.getDevice(deviceId);
		},
		getDevices: () => {
			markActivity();

			return connector.getDevices();
		},
		getSystemInfo: () => {
			markActivity();

			return connector.getSystemInfo();
		},
		getZones: () => {
			markActivity();

			return connector.getZones();
		},
		setCapabilityValue: (deviceId, capabilityId, value) => {
			markActivity();

			return connector.setCapabilityValue(deviceId, capabilityId, value);
		},
		subscribe: async (listener) => {
			markActivity();
			const unsubscribe = await connector.subscribe(async (event) => {
				markActivity();
				await listener(event);
			});
			const subscription = { active: true };

			subscriptions.add(subscription);
			tracker.activeSubscriptions += 1;

			return async () => {
				if (!subscription.active) return;

				markActivity();
				await unsubscribe();
				subscription.active = false;
				subscriptions.delete(subscription);
				tracker.activeSubscriptions -= 1;
			};
		},
	};
};

export const createHomeyPluginLifecycleRuntime: HomeyPluginLifecycleRuntimeFactory = (config) => {
	const pluginConfig = Object.assign(new HomeyConfigModel(), {
		apiKey: config.apiKey,
		connectionTimeout: config.timeoutMs,
		enabled: true,
		reconciliationInterval: RECONCILIATION_INTERVAL_MS,
		url: config.origin.origin,
	});
	const configService = {
		getPluginConfig: (pluginName: string): HomeyConfigModel => {
			if (pluginName !== DEVICES_HOMEY_PLUGIN_NAME) {
				throw new Error('Homey plugin-lifecycle probe requested an unexpected plugin configuration');
			}

			return pluginConfig;
		},
	};
	const tracker: HomeyConnectorTracker = {
		activeConnections: 0,
		activeSubscriptions: 0,
		activityRevision: 0,
		connectorGeneration: 0,
	};
	const sdkResources = createHomeySdkResourceTracker(new HomeySdkClientFactoryService());
	const localConnectorFactory = new HomeyLocalConnectorFactory(sdkResources.factory);
	const connectorFactory: HomeyConnectorFactory = {
		create: (connectorConfig) => {
			tracker.connectorGeneration += 1;

			return createTrackedConnector(localConnectorFactory.create(connectorConfig), tracker);
		},
	};
	const homeyService = new HomeyService(
		configService as unknown as ConfigService,
		createSynchronizer(),
		connectorFactory,
	);
	const nestConfigService = { get: (): null => null };
	const pluginConfigValidator = {
		hasValidator: (): boolean => false,
		validate: (): Promise<{ valid: true }> => Promise.resolve({ valid: true }),
	};
	const manager = new PluginServiceManagerService(
		configService as unknown as ConfigService,
		nestConfigService as unknown as NestConfigService,
		pluginConfigValidator as unknown as PluginConfigValidatorService,
	);

	manager.register(homeyService);

	return {
		bootstrap: () => manager.onApplicationBootstrap(),
		setEnabled: async (enabled) => {
			pluginConfig.enabled = enabled;
			await manager.handleConfigUpdated({ source: DEVICES_HOMEY_PLUGIN_NAME, type: 'plugin' });
		},
		shutdown: () => manager.onModuleDestroy(),
		snapshot: () => {
			const status = homeyService.getStatus();
			const sdkSnapshot = sdkResources.snapshot();

			return {
				...tracker,
				connected: status.connectionState === HomeyConnectionState.CONNECTED && status.healthy,
				sdkActivityRevision: sdkSnapshot.activityRevision,
				sdkActiveClients: sdkSnapshot.activeClients,
				sdkActiveListeners: sdkSnapshot.activeListeners,
				sdkActiveSockets: sdkSnapshot.activeSockets,
				sdkActiveSubscriptions: sdkSnapshot.activeSubscriptions,
				sdkActiveTimers: sdkSnapshot.activeTimers,
				serviceStopped: status.connectionState === HomeyConnectionState.STOPPED && status.serviceState === 'stopped',
			};
		},
	};
};

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) return DEFAULT_OBSERVE_MS;
	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(
			`FB_HOMEY_SHS_PLUGIN_LIFECYCLE_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

export const loadHomeyShsPluginLifecycleConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsPluginLifecycleConfig => {
	if (environment.FB_HOMEY_SHS_PLUGIN_LIFECYCLE_ENABLE !== ENABLE_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_PLUGIN_LIFECYCLE_ENABLE does not contain the required acknowledgement');
	}
	if (Object.keys(environment).some((name) => CONFLICTING_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
		throw new Error('Unrelated Homey probe gates must be unset during the plugin-lifecycle probe');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_PLUGIN_LIFECYCLE_OBSERVE_MS),
	};
};

const isConnectedExactly = (snapshot: HomeyPluginLifecycleSnapshot, generation: number): boolean =>
	snapshot.connected &&
	!snapshot.serviceStopped &&
	snapshot.activeConnections === 1 &&
	snapshot.activeSubscriptions === 1 &&
	snapshot.sdkActiveClients === 1 &&
	snapshot.sdkActiveListeners > 0 &&
	snapshot.sdkActiveSockets > 0 &&
	snapshot.sdkActiveSubscriptions > 0 &&
	snapshot.connectorGeneration === generation;

const isStoppedExactly = (snapshot: HomeyPluginLifecycleSnapshot, generation: number): boolean =>
	!snapshot.connected &&
	snapshot.serviceStopped &&
	snapshot.activeConnections === 0 &&
	snapshot.activeSubscriptions === 0 &&
	snapshot.sdkActiveClients === 0 &&
	snapshot.sdkActiveListeners === 0 &&
	snapshot.sdkActiveSockets === 0 &&
	snapshot.sdkActiveSubscriptions === 0 &&
	snapshot.sdkActiveTimers === 0 &&
	snapshot.connectorGeneration === generation;

export const probeHomeyShsPluginLifecycle = async (
	config: HomeyShsPluginLifecycleConfig,
	createRuntime: HomeyPluginLifecycleRuntimeFactory = createHomeyPluginLifecycleRuntime,
	wait: HomeyPluginLifecycleWait = sleep,
	signalSource: HomeyPluginLifecycleSignalSource = process,
): Promise<HomeyShsPluginLifecycleReport> => {
	const runtime = createRuntime(config);
	const events: Array<{ event: PluginLifecycleEvent; order: number }> = [];
	const record = (event: PluginLifecycleEvent): void => {
		events.push({ event, order: events.length + 1 });
	};
	let shutdownCompleted = false;
	let operationError: unknown;
	let terminationSignal: HomeyPluginLifecycleSignal | undefined;
	const handleSigint = (): void => {
		terminationSignal ??= 'SIGINT';
	};
	const handleSigterm = (): void => {
		terminationSignal ??= 'SIGTERM';
	};
	const throwIfTerminated = (): void => {
		if (terminationSignal !== undefined) throw new HomeyPluginLifecycleTerminationError(terminationSignal);
	};

	signalSource.on('SIGINT', handleSigint);
	signalSource.on('SIGTERM', handleSigterm);

	try {
		record('manager.bootstrap.requested');
		await runtime.bootstrap();
		throwIfTerminated();
		record('manager.bootstrap.resolved');

		if (!isConnectedExactly(runtime.snapshot(), 1)) {
			throw new Error('Homey plugin-lifecycle initial managed startup verification failed');
		}
		record('plugin.initial.connected.verified');
		record('plugin.disable.requested');
		await runtime.setEnabled(false);
		throwIfTerminated();
		record('plugin.disable.resolved');
		const disabled = runtime.snapshot();

		if (!isStoppedExactly(disabled, 1)) {
			throw new Error('Homey plugin-lifecycle disable did not release its runtime');
		}
		await wait(config.observeMs);
		throwIfTerminated();
		const disabledAfterObservation = runtime.snapshot();

		if (
			!isStoppedExactly(disabledAfterObservation, 1) ||
			disabledAfterObservation.activityRevision !== disabled.activityRevision ||
			disabledAfterObservation.sdkActivityRevision !== disabled.sdkActivityRevision
		) {
			throw new Error('Homey plugin-lifecycle activity survived disable');
		}
		record('plugin.disable.quiescence.verified');
		record('plugin.enable.requested');
		await runtime.setEnabled(true);
		throwIfTerminated();
		record('plugin.enable.resolved');

		if (!isConnectedExactly(runtime.snapshot(), 2)) {
			throw new Error('Homey plugin-lifecycle re-enable did not create a fresh healthy runtime');
		}
		record('plugin.reenabled.connected.verified');
		record('backend.shutdown.requested');
		await runtime.shutdown();
		shutdownCompleted = true;
		record('backend.shutdown.resolved');
		const shutdown = runtime.snapshot();

		if (!isStoppedExactly(shutdown, 2)) {
			throw new Error('Homey plugin-lifecycle backend shutdown did not release its runtime');
		}
		await wait(config.observeMs);
		throwIfTerminated();
		const shutdownAfterObservation = runtime.snapshot();

		if (
			!isStoppedExactly(shutdownAfterObservation, 2) ||
			shutdownAfterObservation.activityRevision !== shutdown.activityRevision ||
			shutdownAfterObservation.sdkActivityRevision !== shutdown.sdkActivityRevision
		) {
			throw new Error('Homey plugin-lifecycle activity survived backend shutdown');
		}
		record('backend.shutdown.quiescence.verified');
	} catch (error) {
		operationError = error;
	} finally {
		if (!shutdownCompleted) {
			try {
				await runtime.shutdown();
				shutdownCompleted = true;
			} catch {
				operationError = new Error('Homey plugin-lifecycle managed cleanup failed');
			}
		}

		signalSource.off('SIGINT', handleSigint);
		signalSource.off('SIGTERM', handleSigterm);
	}

	if (terminationSignal !== undefined && !(operationError instanceof HomeyPluginLifecycleTerminationError)) {
		throw new HomeyPluginLifecycleTerminationError(terminationSignal);
	}
	if (operationError !== undefined) throw operationError;
	if (!shutdownCompleted) throw new Error('Homey plugin-lifecycle verification failed');

	return {
		metadata: { probe: 'homey-shs-plugin-lifecycle', schemaVersion: 1, sdkVersion: SDK_VERSION },
		observation: {
			backendShutdownDisconnected: true,
			backendShutdownQuiescent: true,
			disableDisconnected: true,
			disableQuiescent: true,
			freshConnectorAfterEnable: true,
			initialStartupConnected: true,
			reenableConnected: true,
		},
		session: { cleanupCompleted: true, events },
	};
};

const requireExactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
		throw new Error(`Homey plugin-lifecycle report ${label} schema is invalid`);
	}

	return value;
};

export function assertHomeyShsPluginLifecycleReportSafe(
	value: unknown,
	config: HomeyShsPluginLifecycleConfig,
): asserts value is HomeyShsPluginLifecycleReport {
	const report = requireExactKeys(value, ['metadata', 'observation', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const observation = requireExactKeys(
		report.observation,
		[
			'backendShutdownDisconnected',
			'backendShutdownQuiescent',
			'disableDisconnected',
			'disableQuiescent',
			'freshConnectorAfterEnable',
			'initialStartupConnected',
			'reenableConnected',
		],
		'observation',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events'], 'session');

	if (
		metadata.probe !== 'homey-shs-plugin-lifecycle' ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION ||
		Object.values(observation).some((result) => result !== true) ||
		session.cleanupCompleted !== true ||
		!Array.isArray(session.events)
	) {
		throw new Error('Homey plugin-lifecycle report is invalid');
	}
	for (const [index, event] of session.events.entries()) {
		if (
			!isRecord(event) ||
			Object.keys(event).sort().join() !== 'event,order' ||
			typeof event.event !== 'string' ||
			!SAFE_EVENTS.has(event.event as PluginLifecycleEvent) ||
			event.order !== index + 1
		) {
			throw new Error('Homey plugin-lifecycle report event is invalid');
		}
	}
	const labels = session.events.map((event) => (event as { event: string }).event);

	if (labels.length !== SAFE_EVENTS.size || labels.some((label) => !SAFE_EVENTS.has(label as PluginLifecycleEvent))) {
		throw new Error('Homey plugin-lifecycle report ordering is invalid');
	}
	const expectedOrder = [
		'manager.bootstrap.requested',
		'manager.bootstrap.resolved',
		'plugin.initial.connected.verified',
		'plugin.disable.requested',
		'plugin.disable.resolved',
		'plugin.disable.quiescence.verified',
		'plugin.enable.requested',
		'plugin.enable.resolved',
		'plugin.reenabled.connected.verified',
		'backend.shutdown.requested',
		'backend.shutdown.resolved',
		'backend.shutdown.quiescence.verified',
	];

	if (labels.some((label, index) => label !== expectedOrder[index])) {
		throw new Error('Homey plugin-lifecycle report ordering is invalid');
	}
	const serialized = JSON.stringify(value).toLowerCase();
	const forbidden = [config.apiKey, config.expectedHost, ...config.privateTerms]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (
		forbidden.some((item) => serialized.includes(item)) ||
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey plugin-lifecycle report contains a private value');
	}
}

export const writeHomeyShsPluginLifecycleReport = async (
	report: HomeyShsPluginLifecycleReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `plugin-lifecycle-${suffix}`);

	await mkdir(outputRoot, { mode: 0o700, recursive: true });
	await mkdir(outputDirectory, { mode: 0o700, recursive: false });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const main = async (): Promise<void> => {
	try {
		const config = loadHomeyShsPluginLifecycleConfig(process.env);
		process.stdout.write(
			`Homey plugin-lifecycle probe will observe disable and shutdown quiescence for ${config.observeMs} ms each.\n`,
		);
		const report = await probeHomeyShsPluginLifecycle(config);
		assertHomeyShsPluginLifecycleReportSafe(report, config);
		const outputDirectory = await writeHomeyShsPluginLifecycleReport(report, config.outputRoot);
		process.stdout.write(`Sanitized Homey plugin-lifecycle report written to ${outputDirectory}.\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey plugin-lifecycle probe failed'}\n`);
		process.exitCode = 1;
	}
};

if (require.main === module) void main();
