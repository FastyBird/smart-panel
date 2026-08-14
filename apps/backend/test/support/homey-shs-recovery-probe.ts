import { HomeyAPI } from 'homey-api';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const RECOVERY_ACKNOWLEDGEMENTS = {
	'network-interruption': 'I_WILL_INTERRUPT_AND_RESTORE_THE_TEST_SHS_NETWORK_DURING_THIS_PROBE',
	restart: 'I_WILL_RESTART_THE_TEST_SHS_DURING_THIS_PROBE',
} as const;
const DEFAULT_OBSERVE_MS = 90_000;
const MIN_OBSERVE_MS = 10_000;
const MAX_OBSERVE_MS = 300_000;
const RESUBSCRIBE_POLL_MS = 100;
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const MUTATION_GATE_PREFIXES = ['FB_HOMEY_SHS_WRITE_', 'FB_HOMEY_SHS_LIFECYCLE_'];
const SAFE_EVENT_LABELS = new Set([
	'inventory.read.resolved',
	'manager.resubscribe.observed',
	'manager.subscribe.resolved',
	'manager.unsubscribe.failed',
	'manager.unsubscribe.resolved',
	'recovery.window.open',
	'sdk.create.resolved',
	'sdk.destroy.failed',
	'sdk.destroyed',
	'socket.connect',
	'socket.disconnect',
	'socket.disconnect.failed',
	'socket.disconnect.resolved',
	'socket.reconnect',
	'socket.reconnect_attempt',
	'socket.reconnect_error',
	'socket.reconnecting',
]);

type EventListener = (...arguments_: unknown[]) => void;

export type HomeyShsRecoveryScenario = keyof typeof RECOVERY_ACKNOWLEDGEMENTS;

class HomeyShsRecoveryTimeoutError extends Error {
	constructor(label: string, timeoutMs: number) {
		super(`Homey recovery ${label} timed out after ${timeoutMs} ms`);
		this.name = 'HomeyShsRecoveryTimeoutError';
	}
}

interface EventSource {
	off?(event: string, listener: EventListener): unknown;
	on(event: string, listener: EventListener): unknown;
}

interface HomeyRecoveryDevicesManager {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getDevices(options?: { $timeout?: number }): Promise<Record<string, unknown>>;
	isConnected(): boolean;
}

interface HomeyRecoveryClient extends EventSource {
	destroy(): void;
	disconnect(): Promise<void>;
	devices: HomeyRecoveryDevicesManager;
}

export interface HomeyRecoverySdkFactory {
	createLocalApi(options: { address: string; token: string }): Promise<HomeyRecoveryClient>;
}

export interface HomeyShsRecoveryProbeConfig extends HomeyShsProbeConfig {
	observeMs: number;
	scenario: HomeyShsRecoveryScenario;
}

export interface HomeyShsRecoveryReport {
	metadata: {
		probe: 'homey-shs-recovery';
		scenario: HomeyShsRecoveryScenario;
		schemaVersion: 2;
		sdkVersion: string;
	};
	recovery: {
		disconnectObserved: boolean;
		inventoryReadSucceeded: boolean;
		managerResubscribed: boolean;
		transportReconnected: boolean;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: string; order: number }>;
		managerSubscribed: boolean;
	};
}

export type HomeyRecoveryWait = (milliseconds: number) => Promise<void>;

const sdkFactory: HomeyRecoverySdkFactory = {
	createLocalApi: async ({ address, token }) =>
		(await HomeyAPI.createLocalAPI({ address, token, debug: null })) as HomeyRecoveryClient,
};

const sleep: HomeyRecoveryWait = async (milliseconds) =>
	new Promise((resolvePromise) => {
		setTimeout(resolvePromise, milliseconds);
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey recovery report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey recovery report ${label} schema is invalid`);
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
			`FB_HOMEY_SHS_RECOVERY_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

const parseScenario = (value: string | undefined): HomeyShsRecoveryScenario => {
	const scenario = value ?? 'restart';

	if (scenario !== 'network-interruption' && scenario !== 'restart') {
		throw new Error('FB_HOMEY_SHS_RECOVERY_SCENARIO must be network-interruption or restart');
	}

	return scenario;
};

export const loadHomeyShsRecoveryProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsRecoveryProbeConfig => {
	const scenario = parseScenario(environment.FB_HOMEY_SHS_RECOVERY_SCENARIO);

	if (environment.FB_HOMEY_SHS_RECOVERY_ENABLE !== RECOVERY_ACKNOWLEDGEMENTS[scenario]) {
		throw new Error('FB_HOMEY_SHS_RECOVERY_ENABLE does not contain the required operator acknowledgement');
	}

	const mutationGate = Object.keys(environment).find((name) =>
		MUTATION_GATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);

	if (mutationGate !== undefined) {
		throw new Error('Homey write and lifecycle mutation gates must be unset during the recovery probe');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_RECOVERY_OBSERVE_MS),
		scenario,
	};
};

const settleOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const operationPromise = operation();
	const timeoutPromise = new Promise<never>((_resolvePromise, rejectPromise) => {
		timeout = setTimeout(() => rejectPromise(new HomeyShsRecoveryTimeoutError(label, timeoutMs)), timeoutMs);
	});

	try {
		return await Promise.race([operationPromise, timeoutPromise]);
	} finally {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
	}
};

const runOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	try {
		return await settleOperation(label, timeoutMs, operation);
	} catch (error: unknown) {
		if (error instanceof HomeyShsRecoveryTimeoutError) {
			throw error;
		}

		// eslint-disable-next-line preserve-caught-error -- SDK causes may expose endpoint or credential-bearing detail.
		throw new Error(`Homey recovery ${label} failed`);
	}
};

const createClient = async (
	config: HomeyShsRecoveryProbeConfig,
	factory: HomeyRecoverySdkFactory,
): Promise<HomeyRecoveryClient> => {
	const creationPromise = factory.createLocalApi({ address: config.origin.origin, token: config.apiKey });

	try {
		return await runOperation('client creation', config.timeoutMs, () => creationPromise);
	} catch (error: unknown) {
		if (error instanceof HomeyShsRecoveryTimeoutError) {
			void creationPromise.then(
				(lateClient) => {
					try {
						lateClient.destroy();
					} catch {
						// The caller already receives the fixed, sanitized creation timeout.
					}
				},
				() => undefined,
			);
		}

		throw error;
	}
};

const appendEvent = (report: HomeyShsRecoveryReport, event: string): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

const attachListener = (source: EventSource, event: string, listener: EventListener): (() => void) => {
	source.on(event, listener);

	return () => source.off?.(event, listener);
};

const waitForManagerResubscription = async (
	client: HomeyRecoveryClient,
	config: HomeyShsRecoveryProbeConfig,
	wait: HomeyRecoveryWait,
): Promise<void> => {
	const deadline = Date.now() + config.timeoutMs;

	while (!client.devices.isConnected()) {
		if (Date.now() >= deadline) {
			throw new HomeyShsRecoveryTimeoutError('manager resubscription', config.timeoutMs);
		}

		await wait(Math.min(RESUBSCRIBE_POLL_MS, Math.max(1, deadline - Date.now())));
	}
};

const waitForTransportRecovery = async (
	recoveryDetected: Promise<void>,
	config: HomeyShsRecoveryProbeConfig,
): Promise<void> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const label = config.scenario === 'restart' ? 'operator restart observation' : 'operator network restoration';
	const timeoutPromise = new Promise<never>((_resolvePromise, rejectPromise) => {
		timeout = setTimeout(
			() => rejectPromise(new HomeyShsRecoveryTimeoutError(label, config.observeMs)),
			config.observeMs,
		);
	});

	try {
		await Promise.race([recoveryDetected, timeoutPromise]);
	} finally {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
	}
};

export const probeHomeyShsRecovery = async (
	config: HomeyShsRecoveryProbeConfig,
	factory: HomeyRecoverySdkFactory = sdkFactory,
	wait: HomeyRecoveryWait = sleep,
	onWindowOpen: () => void = () => undefined,
	onDisconnectObserved: () => void = () => undefined,
): Promise<HomeyShsRecoveryReport> => {
	const report: HomeyShsRecoveryReport = {
		metadata: {
			probe: 'homey-shs-recovery',
			scenario: config.scenario,
			schemaVersion: 2,
			sdkVersion: SDK_VERSION,
		},
		recovery: {
			disconnectObserved: false,
			inventoryReadSucceeded: false,
			managerResubscribed: false,
			transportReconnected: false,
		},
		session: { cleanupCompleted: false, events: [], managerSubscribed: false },
	};
	const client = await createClient(config, factory);
	appendEvent(report, 'sdk.create.resolved');
	let recoveryWindowOpen = false;
	let resolveTransportRecovery: (() => void) | undefined;
	const transportRecoveryDetected = new Promise<void>((resolvePromise) => {
		resolveTransportRecovery = resolvePromise;
	});
	const cleanupListeners: Array<() => void> = [];
	let verificationPromise: Promise<void> | null = null;
	let operationError: unknown;
	const cleanupFailures: string[] = [];
	const beginRecoveryVerification = (event: 'socket.connect' | 'socket.reconnect'): void => {
		if (!recoveryWindowOpen || !report.recovery.disconnectObserved || report.recovery.transportReconnected) {
			return;
		}

		report.recovery.transportReconnected = true;
		appendEvent(report, event);
		verificationPromise = (async () => {
			await waitForManagerResubscription(client, config, wait);
			report.recovery.managerResubscribed = true;
			appendEvent(report, 'manager.resubscribe.observed');
			await runOperation('post-reconnect inventory read', config.timeoutMs, () =>
				client.devices.getDevices({ $timeout: config.timeoutMs }),
			);
			report.recovery.inventoryReadSucceeded = true;
			appendEvent(report, 'inventory.read.resolved');
		})();
		void verificationPromise.catch(() => undefined);
		resolveTransportRecovery?.();
	};

	cleanupListeners.push(
		attachListener(client, 'connect', () => {
			beginRecoveryVerification('socket.connect');
		}),
		attachListener(client, 'disconnect', () => {
			if (recoveryWindowOpen && !report.recovery.disconnectObserved) {
				report.recovery.disconnectObserved = true;
				appendEvent(report, 'socket.disconnect');
				onDisconnectObserved();
			}
		}),
		...['reconnect_attempt', 'reconnect_error', 'reconnecting'].map((event) =>
			attachListener(client, event, () => {
				if (recoveryWindowOpen && report.recovery.disconnectObserved) {
					appendEvent(report, `socket.${event}`);
				}
			}),
		),
		attachListener(client, 'reconnect', () => {
			beginRecoveryVerification('socket.reconnect');
		}),
	);

	try {
		await runOperation('manager subscription', config.timeoutMs, () => client.devices.connect());
		report.session.managerSubscribed = true;
		appendEvent(report, 'manager.subscribe.resolved');
		recoveryWindowOpen = true;
		appendEvent(report, 'recovery.window.open');
		onWindowOpen();

		await waitForTransportRecovery(transportRecoveryDetected, config);

		if (verificationPromise === null) {
			throw new Error('Homey recovery verification did not start');
		}

		await verificationPromise;
	} catch (error: unknown) {
		operationError = error;
	} finally {
		recoveryWindowOpen = false;

		if (verificationPromise !== null) {
			try {
				await verificationPromise;
			} catch {
				// The fixed verification error is already captured as operationError.
			}
		}

		const cleanup = async (
			label: string,
			resolvedEvent: string,
			failedEvent: string,
			operation: () => Promise<unknown>,
		): Promise<void> => {
			try {
				await runOperation(label, config.timeoutMs, operation);
				appendEvent(report, resolvedEvent);
			} catch {
				cleanupFailures.push(label);
				appendEvent(report, failedEvent);
			}
		};

		await cleanup('manager unsubscribe', 'manager.unsubscribe.resolved', 'manager.unsubscribe.failed', () =>
			client.devices.disconnect(),
		);
		await cleanup('socket disconnect', 'socket.disconnect.resolved', 'socket.disconnect.failed', () =>
			client.disconnect(),
		);
		cleanupListeners.forEach((cleanupListener) => cleanupListener());

		try {
			client.destroy();
			appendEvent(report, 'sdk.destroyed');
		} catch {
			cleanupFailures.push('client destroy');
			appendEvent(report, 'sdk.destroy.failed');
		}

		report.session.cleanupCompleted = cleanupFailures.length === 0;
	}

	if (cleanupFailures.length > 0) {
		throw new Error(`Homey recovery cleanup failed: ${cleanupFailures.join(', ')}`);
	}

	if (operationError !== undefined) {
		throw operationError;
	}

	return report;
};

export function assertHomeyShsRecoveryReportSchema(value: unknown): asserts value is HomeyShsRecoveryReport {
	const report = requireExactKeys(value, ['metadata', 'recovery', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'scenario', 'schemaVersion', 'sdkVersion'], 'metadata');
	const recovery = requireExactKeys(
		report.recovery,
		['disconnectObserved', 'inventoryReadSucceeded', 'managerResubscribed', 'transportReconnected'],
		'recovery',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'managerSubscribed'], 'session');

	if (
		metadata.probe !== 'homey-shs-recovery' ||
		(metadata.scenario !== 'network-interruption' && metadata.scenario !== 'restart') ||
		metadata.schemaVersion !== 2 ||
		metadata.sdkVersion !== SDK_VERSION
	) {
		throw new Error('Homey recovery report metadata schema is invalid');
	}

	if (
		Object.values(recovery).some((item) => typeof item !== 'boolean') ||
		typeof session.cleanupCompleted !== 'boolean' ||
		typeof session.managerSubscribed !== 'boolean' ||
		!Array.isArray(session.events)
	) {
		throw new Error('Homey recovery report state schema is invalid');
	}

	for (const eventValue of session.events) {
		const event = requireExactKeys(eventValue, ['event', 'order'], 'event');

		if (
			typeof event.event !== 'string' ||
			!SAFE_EVENT_LABELS.has(event.event) ||
			typeof event.order !== 'number' ||
			!Number.isInteger(event.order) ||
			event.order < 1
		) {
			throw new Error('Homey recovery report event schema is invalid');
		}
	}
}

export function assertHomeyShsRecoveryReportSafe(
	value: unknown,
	config: HomeyShsRecoveryProbeConfig,
): asserts value is HomeyShsRecoveryReport {
	assertHomeyShsRecoveryReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenValues = [config.apiKey, config.expectedHost, ...config.privateTerms]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (forbiddenValues.some((item) => serialized.includes(item))) {
		throw new Error('Sanitized Homey recovery report contains a configured secret or private value');
	}

	if (value.metadata.scenario !== config.scenario) {
		throw new Error('Homey recovery report scenario does not match the requested scenario');
	}

	if (
		!value.session.managerSubscribed ||
		!value.session.cleanupCompleted ||
		!value.recovery.disconnectObserved ||
		!value.recovery.transportReconnected ||
		!value.recovery.managerResubscribed ||
		!value.recovery.inventoryReadSucceeded
	) {
		throw new Error(`Homey recovery probe did not verify ${config.scenario} recovery and cleanup`);
	}

	if (value.session.events.some(({ event, order }, index) => !SAFE_EVENT_LABELS.has(event) || order !== index + 1)) {
		throw new Error('Homey recovery report contains an unsafe or unordered event label');
	}

	const eventNames = value.session.events.map(({ event }) => event);
	const requiredBeforeRecovery = ['manager.subscribe.resolved', 'recovery.window.open', 'socket.disconnect'];
	let previousIndex = -1;

	for (const event of requiredBeforeRecovery) {
		const index = eventNames.indexOf(event);

		if (index <= previousIndex) {
			throw new Error('Homey recovery report does not contain the required recovery ordering');
		}

		previousIndex = index;
	}

	const recoveryIndex = eventNames.findIndex(
		(event, index) => index > previousIndex && (event === 'socket.connect' || event === 'socket.reconnect'),
	);

	if (recoveryIndex <= previousIndex) {
		throw new Error('Homey recovery report does not contain the required recovery ordering');
	}

	previousIndex = recoveryIndex;

	for (const event of ['manager.resubscribe.observed', 'inventory.read.resolved']) {
		const index = eventNames.indexOf(event);

		if (index <= previousIndex) {
			throw new Error('Homey recovery report does not contain the required recovery ordering');
		}

		previousIndex = index;
	}
}

export const writeHomeyShsRecoveryReport = async (
	report: HomeyShsRecoveryReport,
	outputRoot: string,
): Promise<string> => {
	assertHomeyShsRecoveryReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `recovery-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsRecoveryProbeConfig(process.env);
	const report = await probeHomeyShsRecovery(
		config,
		sdkFactory,
		sleep,
		() => {
			const instruction =
				config.scenario === 'restart'
					? 'Restart the test SHS now.'
					: 'Interrupt only the test SHS network now; wait for disconnect confirmation before restoring it.';

			process.stdout.write(
				`Homey ${config.scenario} recovery observation window is open for ${config.observeMs} ms. ${instruction}\n`,
			);
		},
		() => {
			if (config.scenario === 'network-interruption') {
				process.stdout.write('Homey network disconnect observed. Restore the test SHS network now.\n');
			}
		},
	);

	assertHomeyShsRecoveryReportSafe(report, config);

	const outputDirectory = await writeHomeyShsRecoveryReport(report, config.outputRoot);

	process.stdout.write(
		`Sanitized Homey recovery report written to ${outputDirectory} ` +
			`(${report.session.events.length} ordered events).\n`,
	);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS recovery probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
