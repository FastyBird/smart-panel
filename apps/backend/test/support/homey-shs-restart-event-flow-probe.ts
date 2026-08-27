import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';
import {
	type HomeyDevice,
	type HomeyScalar,
	type HomeySdkClient,
	type HomeySdkFactory,
	type HomeyShsWriteConfig,
	assertRestorableHomeyValue,
	assertSafeHomeyWriteTarget,
	homeyRealtimeSdkFactory,
	homeyScalarCapabilityValue,
	parseHomeyShsWriteConfig,
	runHomeyShsSdkClientCreation,
	runHomeyShsSdkOperation,
} from './homey-shs-realtime-probe';

const ACKNOWLEDGEMENT = 'I_WILL_RESTART_THE_TEST_SHS_WHILE_A_DISPOSABLE_CAPABILITY_IS_CHANGED';
const SDK_VERSION = '3.19.2';
const DEFAULT_RECOVERY_OBSERVE_MS = 90_000;
const DEFAULT_EVENT_OBSERVE_MS = 10_000;
const MIN_OBSERVE_MS = 1_000;
const MAX_OBSERVE_MS = 300_000;
const POLL_MS = 100;
const RESTORE_RETRY_MS = 5_000;
const MAX_RESTORE_ATTEMPTS = 3;
const CONFLICTING_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_REALTIME_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_STARTUP_',
];
const SAFE_EVENTS = new Set([
	'device.subscribe.resolved',
	'device.unsubscribe.failed',
	'device.unsubscribe.resolved',
	'inventory.read.resolved',
	'manager.resubscribe.observed',
	'manager.subscribe.resolved',
	'manager.unsubscribe.failed',
	'manager.unsubscribe.resolved',
	'pre.write.event.observed',
	'pre.write.readback.verified',
	'pre.write.requested',
	'restart.window.open',
	'restore.readback.verified',
	'restore.write.event.observed',
	'restore.write.requested',
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
type CapabilityPhase = 'pre' | 'restore' | null;

export interface HomeyShsRestartEventFlowConfig extends HomeyShsProbeConfig {
	eventObserveMs: number;
	recoveryObserveMs: number;
	write: HomeyShsWriteConfig;
}

export interface HomeyShsRestartEventFlowReport {
	metadata: { probe: 'homey-shs-restart-event-flow'; schemaVersion: 1; sdkVersion: string };
	flow: {
		disconnectObserved: boolean;
		managerResubscribed: boolean;
		postRestartEventObserved: boolean;
		preRestartEventObserved: boolean;
		preRestartReadBackMatched: boolean;
		restorationReadBackMatched: boolean;
		restored: boolean;
		transportReconnected: boolean;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: string; order: number }>;
		managerSubscribed: boolean;
	};
}

export type HomeyRestartEventFlowWait = (milliseconds: number) => Promise<void>;

const sleep: HomeyRestartEventFlowWait = async (milliseconds) =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const parseObserveMs = (name: string, value: string | undefined, fallback: number): number => {
	if (value === undefined) {
		return fallback;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(`${name} must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`);
	}

	return parsed;
};

export const loadHomeyShsRestartEventFlowConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsRestartEventFlowConfig => {
	if (environment.FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE !== ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE does not contain the required acknowledgement');
	}

	if (Object.keys(environment).some((name) => CONFLICTING_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
		throw new Error('Unrelated Homey probe gates must be unset during the restart event-flow probe');
	}

	const write = parseHomeyShsWriteConfig(environment);

	if (write === null) {
		throw new Error('The complete Homey write allowlist is required for the restart event-flow probe');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		eventObserveMs: parseObserveMs(
			'FB_HOMEY_SHS_RESTART_EVENT_FLOW_EVENT_OBSERVE_MS',
			environment.FB_HOMEY_SHS_RESTART_EVENT_FLOW_EVENT_OBSERVE_MS,
			DEFAULT_EVENT_OBSERVE_MS,
		),
		recoveryObserveMs: parseObserveMs(
			'FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS',
			environment.FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS,
			DEFAULT_RECOVERY_OBSERVE_MS,
		),
		write,
	};
};

const appendEvent = (report: HomeyShsRestartEventFlowReport, event: string): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

const waitUntil = async (
	label: string,
	timeoutMs: number,
	predicate: () => boolean,
	wait: HomeyRestartEventFlowWait,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	while (!predicate()) {
		const remaining = deadline - Date.now();

		if (remaining <= 0) {
			throw new Error(`Homey restart event-flow ${label} timed out after ${timeoutMs} ms`);
		}

		await wait(Math.min(POLL_MS, remaining));
	}
};

const managerConnected = (client: HomeySdkClient): boolean => {
	const manager = client.devices as HomeySdkClient['devices'] & { isConnected?: () => boolean };

	return manager.isConnected?.() === true;
};

const scalarRead = async (client: HomeySdkClient, config: HomeyShsRestartEventFlowConfig): Promise<unknown> =>
	homeyScalarCapabilityValue(
		await runHomeyShsSdkOperation('capability read', config.timeoutMs, () =>
			client.devices.getCapabilityValue({
				$timeout: config.timeoutMs,
				capabilityId: config.write.capabilityId,
				deviceId: config.write.deviceId,
			}),
		),
	);

const capabilityWrite = async (
	client: HomeySdkClient,
	config: HomeyShsRestartEventFlowConfig,
	value: HomeyScalar,
): Promise<void> => {
	await runHomeyShsSdkOperation('capability write', config.timeoutMs, () =>
		client.devices.setCapabilityValue({
			$timeout: config.timeoutMs,
			capabilityId: config.write.capabilityId,
			deviceId: config.write.deviceId,
			value,
		}),
	);
};

const restoreCapabilityValue = async (
	client: HomeySdkClient,
	config: HomeyShsRestartEventFlowConfig,
	originalValue: HomeyScalar,
	wait: HomeyRestartEventFlowWait,
): Promise<boolean> => {
	const deadline = Date.now() + config.recoveryObserveMs;

	for (let attempt = 0; attempt < MAX_RESTORE_ATTEMPTS; attempt += 1) {
		if (attempt > 0 && Date.now() >= deadline) break;
		let currentValue: unknown;

		try {
			currentValue = await scalarRead(client, config);
		} catch {
			// SHS can accept its socket namespace before the device API is ready after a container restart.
		}

		if (currentValue !== undefined) {
			if (Object.is(currentValue, originalValue)) return true;

			try {
				await capabilityWrite(client, config, originalValue);
			} catch {
				// Read back before retrying because an idempotent write may apply despite a timed-out response.
			}
		}

		const remaining = deadline - Date.now();

		if (remaining <= 0) break;
		await wait(Math.min(RESTORE_RETRY_MS, remaining));
	}

	try {
		return Object.is(await scalarRead(client, config), originalValue);
	} catch {
		return false;
	}
};

export const probeHomeyShsRestartEventFlow = async (
	config: HomeyShsRestartEventFlowConfig,
	factory: HomeySdkFactory = homeyRealtimeSdkFactory,
	wait: HomeyRestartEventFlowWait = sleep,
	onRestartWindowOpen: () => void = () => undefined,
): Promise<HomeyShsRestartEventFlowReport> => {
	const report: HomeyShsRestartEventFlowReport = {
		metadata: { probe: 'homey-shs-restart-event-flow', schemaVersion: 1, sdkVersion: SDK_VERSION },
		flow: {
			disconnectObserved: false,
			managerResubscribed: false,
			postRestartEventObserved: false,
			preRestartEventObserved: false,
			preRestartReadBackMatched: false,
			restorationReadBackMatched: false,
			restored: false,
			transportReconnected: false,
		},
		session: { cleanupCompleted: false, events: [], managerSubscribed: false },
	};
	const client = await runHomeyShsSdkClientCreation('client creation', config.timeoutMs, () =>
		factory.createLocalApi({ address: config.origin.origin, token: config.apiKey }),
	);
	appendEvent(report, 'sdk.create.resolved');
	let device: HomeyDevice | undefined;
	let originalValue: HomeyScalar | undefined;
	let writeAttempted = false;
	let restartWindowOpen = false;
	let phase: CapabilityPhase = null;
	let operationError: unknown;
	const cleanupFailures: string[] = [];
	const cleanupListeners: Array<() => void> = [];
	const attach = (
		source: {
			on(event: string, listener: EventListener): unknown;
			off?(event: string, listener: EventListener): unknown;
		},
		event: string,
		listener: EventListener,
	): void => {
		source.on(event, listener);
		cleanupListeners.push(() => source.off?.(event, listener));
	};

	attach(client, 'disconnect', () => {
		if (restartWindowOpen && !report.flow.disconnectObserved) {
			report.flow.disconnectObserved = true;
			appendEvent(report, 'socket.disconnect');
		}
	});
	for (const event of ['reconnect_attempt', 'reconnect_error', 'reconnecting']) {
		attach(client, event, () => {
			if (restartWindowOpen && report.flow.disconnectObserved && !report.flow.transportReconnected) {
				appendEvent(report, `socket.${event}`);
			}
		});
	}
	for (const event of ['connect', 'reconnect']) {
		attach(client, event, () => {
			if (restartWindowOpen && report.flow.disconnectObserved && !report.flow.transportReconnected) {
				report.flow.transportReconnected = true;
				appendEvent(report, `socket.${event}`);
			}
		});
	}

	try {
		await runHomeyShsSdkOperation('manager subscription', config.timeoutMs, () => client.devices.connect());
		report.session.managerSubscribed = true;
		appendEvent(report, 'manager.subscribe.resolved');
		const devices = await runHomeyShsSdkOperation('device inventory read', config.timeoutMs, () =>
			client.devices.getDevices({ $timeout: config.timeoutMs }),
		);
		device = assertSafeHomeyWriteTarget(devices, config.write);
		const boundDevice = device;
		attach(boundDevice, 'capability', (payload: unknown) => {
			if (typeof payload !== 'object' || payload === null) return;
			const event = payload as { capabilityId?: unknown; value?: unknown };
			if (event.capabilityId !== config.write.capabilityId) return;
			if (phase === 'pre' && Object.is(event.value, config.write.value) && !report.flow.preRestartEventObserved) {
				report.flow.preRestartEventObserved = true;
				appendEvent(report, 'pre.write.event.observed');
			}
			if (phase === 'restore' && Object.is(event.value, originalValue) && !report.flow.postRestartEventObserved) {
				report.flow.postRestartEventObserved = true;
				appendEvent(report, 'restore.write.event.observed');
			}
		});
		await runHomeyShsSdkOperation('device subscription', config.timeoutMs, () => boundDevice.connect());
		appendEvent(report, 'device.subscribe.resolved');
		originalValue = assertRestorableHomeyValue(await scalarRead(client, config), config.write.value);

		phase = 'pre';
		writeAttempted = true;
		appendEvent(report, 'pre.write.requested');
		await capabilityWrite(client, config, config.write.value);
		await waitUntil(
			'pre-restart capability event',
			config.eventObserveMs,
			() => report.flow.preRestartEventObserved,
			wait,
		);
		report.flow.preRestartReadBackMatched = Object.is(await scalarRead(client, config), config.write.value);
		if (!report.flow.preRestartReadBackMatched) throw new Error('Homey pre-restart capability read-back failed');
		appendEvent(report, 'pre.write.readback.verified');

		phase = null;
		restartWindowOpen = true;
		appendEvent(report, 'restart.window.open');
		onRestartWindowOpen();
		await waitUntil(
			'operator restart recovery',
			config.recoveryObserveMs,
			() => report.flow.disconnectObserved && report.flow.transportReconnected,
			wait,
		);
		await waitUntil('manager resubscription', config.timeoutMs, () => managerConnected(client), wait);
		report.flow.managerResubscribed = true;
		appendEvent(report, 'manager.resubscribe.observed');
		const recoveredDevices = await runHomeyShsSdkOperation('post-restart inventory read', config.timeoutMs, () =>
			client.devices.getDevices({ $cache: false, $timeout: config.timeoutMs, $updateCache: true }),
		);
		appendEvent(report, 'inventory.read.resolved');
		assertSafeHomeyWriteTarget(recoveredDevices, config.write);

		phase = 'restore';
		appendEvent(report, 'restore.write.requested');
		report.flow.restored = await restoreCapabilityValue(client, config, originalValue, wait);
		if (!report.flow.restored) throw new Error('Homey capability restoration timed out after SHS restart');
		await waitUntil(
			'post-restart restoration event',
			config.eventObserveMs,
			() => report.flow.postRestartEventObserved,
			wait,
		);
		report.flow.restorationReadBackMatched = Object.is(await scalarRead(client, config), originalValue);
		if (!report.flow.restorationReadBackMatched) throw new Error('Homey restoration read-back failed');
		appendEvent(report, 'restore.readback.verified');
	} catch (error: unknown) {
		operationError =
			error instanceof Error && error.message.startsWith('Homey ')
				? error
				: new Error('Homey restart event-flow verification failed');
	} finally {
		restartWindowOpen = false;
		if (writeAttempted && originalValue !== undefined && !report.flow.restorationReadBackMatched) {
			report.flow.restored = await restoreCapabilityValue(client, config, originalValue, wait);
			report.flow.restorationReadBackMatched = report.flow.restored;
			if (!report.flow.restorationReadBackMatched) cleanupFailures.push('capability restoration');
		}
		phase = null;
		const cleanup = async (
			label: string,
			resolved: string,
			failed: string,
			operation: () => Promise<unknown>,
		): Promise<void> => {
			try {
				await runHomeyShsSdkOperation(label, config.timeoutMs, operation);
				appendEvent(report, resolved);
			} catch {
				cleanupFailures.push(label);
				appendEvent(report, failed);
			}
		};
		if (device !== undefined)
			await cleanup('device unsubscribe', 'device.unsubscribe.resolved', 'device.unsubscribe.failed', () =>
				device.disconnect(),
			);
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

	if (cleanupFailures.length > 0)
		throw new Error(`Homey restart event-flow cleanup failed: ${cleanupFailures.join(', ')}`);
	if (operationError !== undefined) throw operationError;
	return report;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
		throw new Error(`Homey restart event-flow report ${label} schema is invalid`);
	}

	return value;
};

export function assertHomeyShsRestartEventFlowReportSafe(
	value: unknown,
	config: HomeyShsRestartEventFlowConfig,
): asserts value is HomeyShsRestartEventFlowReport {
	const report = requireExactKeys(value, ['flow', 'metadata', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const flow = requireExactKeys(
		report.flow,
		[
			'disconnectObserved',
			'managerResubscribed',
			'postRestartEventObserved',
			'preRestartEventObserved',
			'preRestartReadBackMatched',
			'restorationReadBackMatched',
			'restored',
			'transportReconnected',
		],
		'flow',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'managerSubscribed'], 'session');

	if (
		metadata.probe !== 'homey-shs-restart-event-flow' ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION
	)
		throw new Error('Homey restart event-flow report metadata is invalid');
	if (Object.values(flow).some((result) => result !== true))
		throw new Error('Homey restart event-flow report did not verify the complete flow');
	if (session.cleanupCompleted !== true || session.managerSubscribed !== true || !Array.isArray(session.events))
		throw new Error('Homey restart event-flow report session is invalid');
	for (const [index, item] of session.events.entries()) {
		if (
			!isRecord(item) ||
			Object.keys(item).sort().join() !== 'event,order' ||
			typeof item.event !== 'string' ||
			!SAFE_EVENTS.has(item.event) ||
			item.order !== index + 1
		)
			throw new Error('Homey restart event-flow report event is invalid');
	}
	const labels = session.events.map((item) => (item as { event: string }).event);
	let previousIndex = -1;
	for (const label of [
		'manager.subscribe.resolved',
		'device.subscribe.resolved',
		'pre.write.requested',
		'pre.write.event.observed',
		'pre.write.readback.verified',
		'restart.window.open',
		'socket.disconnect',
		'manager.resubscribe.observed',
		'inventory.read.resolved',
		'restore.write.requested',
		'restore.write.event.observed',
		'restore.readback.verified',
	]) {
		const index = labels.indexOf(label);

		if (index <= previousIndex) throw new Error('Homey restart event-flow report ordering is invalid');
		previousIndex = index;
	}
	const disconnectIndex = labels.indexOf('socket.disconnect');
	const resubscribeIndex = labels.indexOf('manager.resubscribe.observed');
	const reconnectIndex = labels.findIndex(
		(label, index) => index > disconnectIndex && (label === 'socket.connect' || label === 'socket.reconnect'),
	);

	if (reconnectIndex <= disconnectIndex || reconnectIndex >= resubscribeIndex) {
		throw new Error('Homey restart event-flow report recovery ordering is invalid');
	}
	const serialized = JSON.stringify(value).toLowerCase();
	const forbidden = [
		config.apiKey,
		config.expectedHost,
		config.write.deviceId,
		config.write.capabilityId,
		...config.privateTerms,
		...(typeof config.write.value === 'string' ? [config.write.value] : []),
	]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !['home', 'homey'].includes(item));
	if (
		forbidden.some((item) => serialized.includes(item)) ||
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	)
		throw new Error('Sanitized Homey restart event-flow report contains a private value');
}

export const writeHomeyShsRestartEventFlowReport = async (
	report: HomeyShsRestartEventFlowReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `restart-event-flow-${suffix}`);
	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});
	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsRestartEventFlowConfig(process.env);
	const report = await probeHomeyShsRestartEventFlow(config, homeyRealtimeSdkFactory, sleep, () => {
		process.stdout.write(
			`Homey restart event-flow window is open for ${config.recoveryObserveMs} ms. Restart only the test SHS now.\n`,
		);
	});
	assertHomeyShsRestartEventFlowReportSafe(report, config);
	const outputDirectory = await writeHomeyShsRestartEventFlowReport(report, config.outputRoot);
	process.stdout.write(`Sanitized Homey restart event-flow report written to ${outputDirectory}.\n`);
};

if (require.main === module) {
	void run().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey restart event-flow probe failed'}\n`);
		process.exitCode = 1;
	});
}
