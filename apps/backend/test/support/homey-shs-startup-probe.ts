import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConfigService } from '../../src/modules/config/services/config.service';
import { HomeyLocalConnectorFactory } from '../../src/plugins/devices-homey/connectors/homey-local-connector.factory';
import { HomeySdkClientFactoryService } from '../../src/plugins/devices-homey/connectors/homey-sdk.client';
import {
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionState,
} from '../../src/plugins/devices-homey/devices-homey.constants';
import { HomeyConfigModel } from '../../src/plugins/devices-homey/models/config.model';
import {
	type HomeyOperationalDiagnostics,
	HomeySynchronizerService,
} from '../../src/plugins/devices-homey/services/homey-synchronizer.service';
import { HomeyService } from '../../src/plugins/devices-homey/services/homey.service';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const STARTUP_ACKNOWLEDGEMENTS = {
	'offline-recovery': 'I_WILL_START_WITH_TEST_SHS_BLOCKED_AND_RESTORE_ONLY_WHEN_PROMPTED',
	online: 'I_WILL_VERIFY_A_FRESH_ONLINE_HOMEY_STARTUP',
} as const;
const DEFAULT_OBSERVE_MS = 90_000;
const MIN_OBSERVE_MS = 10_000;
const MAX_OBSERVE_MS = 300_000;
const STATUS_POLL_MS = 100;
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const CONFLICTING_GATE_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_PLUGIN_LIFECYCLE_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_WRITE_',
];

export type HomeyShsStartupScenario = keyof typeof STARTUP_ACKNOWLEDGEMENTS;

type StartupEvent =
	| 'initial.reconnecting.verified'
	| 'inventory.verified'
	| 'recovery.window.open'
	| 'service.connected.observed'
	| 'service.start.requested'
	| 'service.start.resolved'
	| 'service.stop.resolved';

const SAFE_EVENT_LABELS: ReadonlySet<StartupEvent> = new Set([
	'initial.reconnecting.verified',
	'inventory.verified',
	'recovery.window.open',
	'service.connected.observed',
	'service.start.requested',
	'service.start.resolved',
	'service.stop.resolved',
]);

class HomeyShsStartupTimeoutError extends Error {
	constructor(label: string, timeoutMs: number) {
		super(`Homey startup ${label} timed out after ${timeoutMs} ms`);
		this.name = 'HomeyShsStartupTimeoutError';
	}
}

export interface HomeyShsStartupProbeConfig extends HomeyShsProbeConfig {
	observeMs: number;
	scenario: HomeyShsStartupScenario;
}

export interface HomeyShsStartupReport {
	metadata: {
		probe: 'homey-shs-startup';
		scenario: HomeyShsStartupScenario;
		schemaVersion: 1;
		sdkVersion: string;
	};
	startup: {
		cleanupCompleted: boolean;
		initialUnavailableVerified: boolean;
		inventoryVerified: boolean;
		recoveryObserved: boolean;
		serviceConnected: boolean;
	};
	session: {
		events: Array<{ event: StartupEvent; order: number }>;
	};
}

export interface HomeyStartupRuntime {
	getInventorySnapshot(): readonly unknown[] | null;
	getStatus(): {
		connectionState: HomeyConnectionState;
		healthy: boolean;
		reconnectCount: number;
	};
	start(): Promise<void>;
	stop(): Promise<void>;
}

export type HomeyStartupRuntimeFactory = (config: HomeyShsStartupProbeConfig) => HomeyStartupRuntime;
export type HomeyStartupWait = (milliseconds: number) => Promise<void>;

const sleep: HomeyStartupWait = async (milliseconds) =>
	new Promise((resolvePromise) => {
		setTimeout(resolvePromise, milliseconds);
	});

const EMPTY_DIAGNOSTICS: HomeyOperationalDiagnostics = {
	adopted: 0,
	adoptedDevices: [],
	missing: 0,
	unsupported: 0,
	unavailable: 0,
};

const runtimeFactory: HomeyStartupRuntimeFactory = (config) => {
	const pluginConfig = Object.assign(new HomeyConfigModel(), {
		apiKey: config.apiKey,
		connectionTimeout: config.timeoutMs,
		enabled: true,
		reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		url: config.origin.origin,
	});
	const configService = {
		getPluginConfig: (pluginName: string): HomeyConfigModel => {
			if (pluginName !== DEVICES_HOMEY_PLUGIN_NAME) {
				throw new Error('Homey startup probe requested an unexpected plugin configuration');
			}

			return pluginConfig;
		},
	};
	const synchronizer = {
		filterEvents: (events: readonly unknown[]): readonly unknown[] => [...events],
		getOperationalDiagnostics: (): Promise<HomeyOperationalDiagnostics> => Promise.resolve(EMPTY_DIAGNOSTICS),
		hasReadableCapabilityBinding: (): Promise<boolean> => Promise.resolve(false),
		invalidateIndex: (): void => undefined,
		reset: (): void => undefined,
		synchronizeDevices: (): Promise<object> =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [], failed: 0, ignored: 0, updated: 0 }),
		synchronizeEvents: (events: readonly unknown[]): Promise<object> =>
			Promise.resolve({ acceptedEvents: [...events], failed: 0, ignored: 0, updated: 0 }),
		synchronizeSnapshot: (): Promise<object> =>
			Promise.resolve({ acceptedCapabilityValues: [], acceptedEvents: [], failed: 0, ignored: 0, updated: 0 }),
	};
	const connectorFactory = new HomeyLocalConnectorFactory(new HomeySdkClientFactoryService());

	return new HomeyService(
		configService as unknown as ConfigService,
		synchronizer as unknown as HomeySynchronizerService,
		connectorFactory,
	);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey startup report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey startup report ${label} schema is invalid`);
	}

	return value;
};

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_OBSERVE_MS;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(
			`FB_HOMEY_SHS_STARTUP_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

export const loadHomeyShsStartupProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsStartupProbeConfig => {
	const scenario = environment.FB_HOMEY_SHS_STARTUP_SCENARIO?.trim();

	if (scenario !== 'online' && scenario !== 'offline-recovery') {
		throw new Error('FB_HOMEY_SHS_STARTUP_SCENARIO must be exactly online or offline-recovery');
	}

	if (environment.FB_HOMEY_SHS_STARTUP_ENABLE !== STARTUP_ACKNOWLEDGEMENTS[scenario]) {
		throw new Error('FB_HOMEY_SHS_STARTUP_ENABLE does not contain the required scenario acknowledgement');
	}

	const conflictingGate = Object.keys(environment).find((name) =>
		CONFLICTING_GATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);

	if (conflictingGate !== undefined) {
		throw new Error('Homey mutation, recovery, and credential-rotation gates must be unset during the startup probe');
	}

	const sharedConfig = loadHomeyShsProbeConfig(environment, workingDirectory);
	const observeMs = parseObserveMs(environment.FB_HOMEY_SHS_STARTUP_OBSERVE_MS);

	if (observeMs <= sharedConfig.timeoutMs) {
		throw new Error('FB_HOMEY_SHS_STARTUP_OBSERVE_MS must be greater than FB_HOMEY_SHS_TIMEOUT_MS');
	}

	return {
		...sharedConfig,
		observeMs,
		scenario,
	};
};

const settleOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const operationPromise = operation();
	const observedOperation = operationPromise.then(
		(value) => ({ status: 'fulfilled' as const, value }),
		(error: unknown) => ({ error, status: 'rejected' as const }),
	);
	const timeoutPromise = new Promise<{ status: 'timed_out' }>((resolvePromise) => {
		timeout = setTimeout(() => resolvePromise({ status: 'timed_out' }), timeoutMs);
	});
	const result = await Promise.race([observedOperation, timeoutPromise]);

	if (timeout !== undefined) {
		clearTimeout(timeout);
	}

	if (result.status === 'timed_out') {
		// HomeyService has no external cancellation signal. Its connector operations are internally bounded, so wait for
		// the active lock holder to settle before cleanup rather than returning while sockets or timers may still exist.
		await observedOperation;

		throw new HomeyShsStartupTimeoutError(label, timeoutMs);
	}

	if (result.status === 'rejected') {
		throw result.error;
	}

	return result.value;
};

const appendEvent = (report: HomeyShsStartupReport, event: StartupEvent): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

const isConnected = (runtime: HomeyStartupRuntime): boolean => {
	const status = runtime.getStatus();

	return status.connectionState === HomeyConnectionState.CONNECTED && status.healthy;
};

const waitForRecovery = async (
	runtime: HomeyStartupRuntime,
	config: HomeyShsStartupProbeConfig,
	wait: HomeyStartupWait,
): Promise<void> => {
	const deadline = Date.now() + config.observeMs;

	while (!isConnected(runtime) || runtime.getStatus().reconnectCount < 1 || runtime.getInventorySnapshot() === null) {
		const remainingMs = deadline - Date.now();

		if (remainingMs <= 0) {
			throw new HomeyShsStartupTimeoutError('offline recovery observation', config.observeMs);
		}

		await wait(Math.min(STATUS_POLL_MS, remainingMs));
	}
};

export const probeHomeyShsStartup = async (
	config: HomeyShsStartupProbeConfig,
	createRuntime: HomeyStartupRuntimeFactory = runtimeFactory,
	wait: HomeyStartupWait = sleep,
	onRecoveryWindowOpen: () => void = () => undefined,
): Promise<HomeyShsStartupReport> => {
	let runtime: HomeyStartupRuntime | undefined;
	const report: HomeyShsStartupReport = {
		metadata: { probe: 'homey-shs-startup', scenario: config.scenario, schemaVersion: 1, sdkVersion: SDK_VERSION },
		startup: {
			cleanupCompleted: false,
			initialUnavailableVerified: false,
			inventoryVerified: false,
			recoveryObserved: false,
			serviceConnected: false,
		},
		session: { events: [] },
	};
	let operationError: unknown;

	try {
		runtime = createRuntime(config);
		appendEvent(report, 'service.start.requested');
		await settleOperation('service start', config.observeMs, () => runtime.start());
		appendEvent(report, 'service.start.resolved');

		if (config.scenario === 'offline-recovery') {
			const status = runtime.getStatus();

			if (status.connectionState !== HomeyConnectionState.RECONNECTING || status.healthy) {
				throw new Error('Homey startup offline-recovery scenario did not begin unavailable');
			}

			report.startup.initialUnavailableVerified = true;
			appendEvent(report, 'initial.reconnecting.verified');
			onRecoveryWindowOpen();
			appendEvent(report, 'recovery.window.open');
			await waitForRecovery(runtime, config, wait);
			report.startup.recoveryObserved = true;
		} else if (!isConnected(runtime)) {
			throw new Error('Homey startup online scenario did not connect');
		}

		report.startup.serviceConnected = true;
		appendEvent(report, 'service.connected.observed');

		if (runtime.getInventorySnapshot() === null) {
			throw new Error('Homey startup inventory verification failed');
		}

		report.startup.inventoryVerified = true;
		appendEvent(report, 'inventory.verified');
	} catch (error: unknown) {
		operationError =
			error instanceof HomeyShsStartupTimeoutError
				? error
				: new Error(`Homey startup ${config.scenario} verification failed`);
	} finally {
		if (runtime !== undefined) {
			try {
				await settleOperation('service cleanup', config.observeMs, () => runtime.stop());
				report.startup.cleanupCompleted = true;
				appendEvent(report, 'service.stop.resolved');
			} catch {
				operationError = new Error('Homey startup service cleanup failed');
			}
		}
	}

	if (operationError !== undefined) {
		throw operationError;
	}

	return report;
};

export function assertHomeyShsStartupReportSchema(value: unknown): asserts value is HomeyShsStartupReport {
	const report = requireExactKeys(value, ['metadata', 'session', 'startup'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'scenario', 'schemaVersion', 'sdkVersion'], 'metadata');
	const startup = requireExactKeys(
		report.startup,
		['cleanupCompleted', 'initialUnavailableVerified', 'inventoryVerified', 'recoveryObserved', 'serviceConnected'],
		'startup',
	);
	const session = requireExactKeys(report.session, ['events'], 'session');

	if (
		metadata.probe !== 'homey-shs-startup' ||
		(metadata.scenario !== 'online' && metadata.scenario !== 'offline-recovery') ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION ||
		Object.values(startup).some((result) => typeof result !== 'boolean') ||
		!Array.isArray(session.events)
	) {
		throw new Error('Homey startup report schema is invalid');
	}

	for (const [index, eventValue] of session.events.entries()) {
		const event = requireExactKeys(eventValue, ['event', 'order'], 'event');

		if (
			typeof event.event !== 'string' ||
			!SAFE_EVENT_LABELS.has(event.event as StartupEvent) ||
			typeof event.order !== 'number' ||
			event.order !== index + 1
		) {
			throw new Error('Homey startup report event schema is invalid');
		}
	}
}

export function assertHomeyShsStartupReportSafe(
	value: unknown,
	config: HomeyShsStartupProbeConfig,
): asserts value is HomeyShsStartupReport {
	assertHomeyShsStartupReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenValues = [config.apiKey, config.expectedHost, ...config.privateTerms]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (forbiddenValues.some((item) => serialized.includes(item))) {
		throw new Error('Sanitized Homey startup report contains a configured secret or private value');
	}

	if (
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey startup report contains an address, email, or URL');
	}

	if (
		value.metadata.scenario !== config.scenario ||
		!value.startup.cleanupCompleted ||
		!value.startup.inventoryVerified ||
		!value.startup.serviceConnected
	) {
		throw new Error('Homey startup report did not verify connection, inventory, and cleanup');
	}

	if (
		config.scenario === 'offline-recovery' &&
		(!value.startup.initialUnavailableVerified || !value.startup.recoveryObserved)
	) {
		throw new Error('Homey startup report did not verify initial unavailability and recovery');
	}

	if (config.scenario === 'online' && (value.startup.initialUnavailableVerified || value.startup.recoveryObserved)) {
		throw new Error('Homey startup online report contains recovery-only claims');
	}

	const expectedEvents: readonly StartupEvent[] =
		config.scenario === 'online'
			? [
					'service.start.requested',
					'service.start.resolved',
					'service.connected.observed',
					'inventory.verified',
					'service.stop.resolved',
				]
			: [
					'service.start.requested',
					'service.start.resolved',
					'initial.reconnecting.verified',
					'recovery.window.open',
					'service.connected.observed',
					'inventory.verified',
					'service.stop.resolved',
				];

	if (
		value.session.events.length !== expectedEvents.length ||
		value.session.events.some(({ event }, index) => event !== expectedEvents[index])
	) {
		throw new Error('Homey startup report contains unsafe or unexpected event ordering');
	}
}

export const writeHomeyShsStartupReport = async (
	report: HomeyShsStartupReport,
	outputRoot: string,
): Promise<string> => {
	assertHomeyShsStartupReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `startup-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsStartupProbeConfig(process.env);
	const report = await probeHomeyShsStartup(config, runtimeFactory, sleep, () => {
		process.stdout.write(
			`Homey offline-startup recovery window is open for ${config.observeMs} ms. Restore only the test SHS network now.\n`,
		);
	});

	assertHomeyShsStartupReportSafe(report, config);
	const outputDirectory = await writeHomeyShsStartupReport(report, config.outputRoot);

	process.stdout.write(`Sanitized Homey startup report written to ${outputDirectory}.\n`);
};

if (require.main === module) {
	void run().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey startup probe failed'}\n`);
		process.exitCode = 1;
	});
}
