import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';
import {
	type HomeyDevice,
	type HomeyScalar,
	type HomeySdkClient,
	type HomeySdkFactory,
	homeyRealtimeSdkFactory,
	homeyScalarCapabilityValue,
	runHomeyShsSdkClientCreation,
	runHomeyShsSdkOperation,
} from './homey-shs-realtime-probe';

const ACKNOWLEDGEMENT = 'I_WILL_CHANGE_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_CAPABILITY_OUTSIDE_SMART_PANEL';
const SDK_VERSION = '3.19.2';
const DEFAULT_OBSERVE_MS = 90_000;
const MIN_OBSERVE_MS = 1_000;
const MAX_OBSERVE_MS = 300_000;
const POLL_MS = 100;
const SCENARIOS = ['physical', 'homey', 'flow'] as const;
const CONFLICTING_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_REALTIME_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_RESTART_EVENT_FLOW_',
	'FB_HOMEY_SHS_STARTUP_',
	'FB_HOMEY_SHS_WRITE_',
];
const SAFE_EVENTS = new Set([
	'baseline.read.verified',
	'change.event.observed',
	'change.readback.verified',
	'change.window.open',
	'device.subscribe.resolved',
	'device.unsubscribe.failed',
	'device.unsubscribe.resolved',
	'inventory.read.resolved',
	'manager.subscribe.resolved',
	'manager.unsubscribe.failed',
	'manager.unsubscribe.resolved',
	'restore.event.observed',
	'restore.readback.verified',
	'restore.window.open',
	'sdk.create.resolved',
	'sdk.destroy.failed',
	'sdk.destroyed',
	'socket.disconnect.failed',
	'socket.disconnect.resolved',
]);

type EventListener = (...arguments_: unknown[]) => void;
type ObservationPhase = 'change' | 'restore' | null;
export type HomeyOriginEventScenario = (typeof SCENARIOS)[number];
export type HomeyOriginEventWait = (milliseconds: number) => Promise<void>;

export interface HomeyShsOriginEventTarget {
	capabilityId: string;
	deviceId: string;
}

export interface HomeyShsOriginEventConfig extends HomeyShsProbeConfig {
	observeMs: number;
	scenario: HomeyOriginEventScenario;
	target: HomeyShsOriginEventTarget;
}

export interface HomeyShsOriginEventReport {
	metadata: { probe: 'homey-shs-origin-event'; schemaVersion: 1; sdkVersion: string };
	observation: {
		baselineRead: boolean;
		changeEventObserved: boolean;
		changeReadBackMatched: boolean;
		restorationEventObserved: boolean;
		restorationReadBackMatched: boolean;
		restored: boolean;
		scenario: HomeyOriginEventScenario;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: string; order: number }>;
		managerSubscribed: boolean;
	};
}

const sleep: HomeyOriginEventWait = async (milliseconds) =>
	new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) return DEFAULT_OBSERVE_MS;
	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(
			`FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

const parseScenario = (value: string | undefined): HomeyOriginEventScenario => {
	if (!SCENARIOS.includes(value as HomeyOriginEventScenario)) {
		throw new Error('FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO must be exactly physical, homey, or flow');
	}

	return value as HomeyOriginEventScenario;
};

export const loadHomeyShsOriginEventConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsOriginEventConfig => {
	if (environment.FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE !== ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE does not contain the required acknowledgement');
	}

	if (Object.keys(environment).some((name) => CONFLICTING_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
		throw new Error('Mutation, recovery, and unrelated Homey probe gates must be unset during the origin-event probe');
	}

	const deviceId = environment.FB_HOMEY_SHS_ORIGIN_EVENT_DEVICE_ID?.trim();
	const capabilityId = environment.FB_HOMEY_SHS_ORIGIN_EVENT_CAPABILITY_ID?.trim();

	if (!deviceId || !capabilityId) {
		throw new Error('The exact Homey origin-event device and capability allowlist is required');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS),
		scenario: parseScenario(environment.FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO),
		target: { capabilityId, deviceId },
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isScalar = (value: unknown): value is HomeyScalar =>
	['boolean', 'number', 'string'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value));

const appendEvent = (report: HomeyShsOriginEventReport, event: string): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

const requireTargetDevice = (devices: Record<string, HomeyDevice>, target: HomeyShsOriginEventTarget): HomeyDevice => {
	const device = devices[target.deviceId];

	if (device === undefined || device.capabilitiesObj?.[target.capabilityId] === undefined) {
		throw new Error('The allowlisted Homey origin-event target was not found exactly');
	}

	return device;
};

const scalarRead = async (client: HomeySdkClient, config: HomeyShsOriginEventConfig): Promise<HomeyScalar> => {
	const value = homeyScalarCapabilityValue(
		await runHomeyShsSdkOperation('origin-event capability read', config.timeoutMs, () =>
			client.devices.getCapabilityValue({
				$timeout: config.timeoutMs,
				capabilityId: config.target.capabilityId,
				deviceId: config.target.deviceId,
			}),
		),
	);

	if (!isScalar(value)) throw new Error('Homey origin-event capability value is not a finite scalar');

	return value;
};

const waitUntil = async (
	label: string,
	timeoutMs: number,
	predicate: () => boolean,
	wait: HomeyOriginEventWait,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	while (!predicate()) {
		const remaining = deadline - Date.now();

		if (remaining <= 0) throw new Error(`Homey origin-event ${label} timed out after ${timeoutMs} ms`);
		await wait(Math.min(POLL_MS, remaining));
	}
};

const waitForReadBack = async (
	label: string,
	expected: HomeyScalar,
	config: HomeyShsOriginEventConfig,
	client: HomeySdkClient,
	wait: HomeyOriginEventWait,
): Promise<void> => {
	const deadline = Date.now() + config.observeMs;

	while (Date.now() <= deadline) {
		try {
			if (Object.is(await scalarRead(client, config), expected)) return;
		} catch {
			// A transient read failure exposes no private SDK detail and does not replace the event requirement.
		}

		const remaining = deadline - Date.now();

		if (remaining <= 0) break;
		await wait(Math.min(POLL_MS, remaining));
	}

	throw new Error(`Homey origin-event ${label} timed out after ${config.observeMs} ms`);
};

export const probeHomeyShsOriginEvent = async (
	config: HomeyShsOriginEventConfig,
	factory: HomeySdkFactory = homeyRealtimeSdkFactory,
	wait: HomeyOriginEventWait = sleep,
	onChangeWindowOpen: () => void = () => undefined,
	onRestoreWindowOpen: () => void = () => undefined,
): Promise<HomeyShsOriginEventReport> => {
	const report: HomeyShsOriginEventReport = {
		metadata: { probe: 'homey-shs-origin-event', schemaVersion: 1, sdkVersion: SDK_VERSION },
		observation: {
			baselineRead: false,
			changeEventObserved: false,
			changeReadBackMatched: false,
			restorationEventObserved: false,
			restorationReadBackMatched: false,
			restored: false,
			scenario: config.scenario,
		},
		session: { cleanupCompleted: false, events: [], managerSubscribed: false },
	};
	const client = await runHomeyShsSdkClientCreation('origin-event client creation', config.timeoutMs, () =>
		factory.createLocalApi({ address: config.origin.origin, token: config.apiKey }),
	);
	appendEvent(report, 'sdk.create.resolved');
	let device: HomeyDevice | undefined;
	let baseline: HomeyScalar | undefined;
	let changedValue: HomeyScalar | undefined;
	let phase: ObservationPhase = null;
	let operationError: unknown;
	const cleanupFailures: string[] = [];
	const cleanupListeners: Array<() => void> = [];
	const attach = (source: HomeyDevice, event: string, listener: EventListener): void => {
		source.on(event, listener);
		cleanupListeners.push(() => source.off?.(event, listener));
	};

	try {
		await runHomeyShsSdkOperation('origin-event manager subscription', config.timeoutMs, () =>
			client.devices.connect(),
		);
		report.session.managerSubscribed = true;
		appendEvent(report, 'manager.subscribe.resolved');
		const devices = await runHomeyShsSdkOperation('origin-event inventory read', config.timeoutMs, () =>
			client.devices.getDevices({ $cache: false, $timeout: config.timeoutMs, $updateCache: true }),
		);
		appendEvent(report, 'inventory.read.resolved');
		device = requireTargetDevice(devices, config.target);
		const boundDevice = device;
		attach(boundDevice, 'capability', (payload: unknown) => {
			if (!isRecord(payload) || payload.capabilityId !== config.target.capabilityId || !isScalar(payload.value)) return;
			if (phase === 'change' && baseline !== undefined && !Object.is(payload.value, baseline)) {
				if (!report.observation.changeEventObserved) {
					changedValue = payload.value;
					report.observation.changeEventObserved = true;
					appendEvent(report, 'change.event.observed');
				}
			} else if (phase === 'restore' && baseline !== undefined && Object.is(payload.value, baseline)) {
				if (!report.observation.restorationEventObserved) {
					report.observation.restorationEventObserved = true;
					appendEvent(report, 'restore.event.observed');
				}
			}
		});
		await runHomeyShsSdkOperation('origin-event device subscription', config.timeoutMs, () => boundDevice.connect());
		appendEvent(report, 'device.subscribe.resolved');
		baseline = await scalarRead(client, config);
		report.observation.baselineRead = true;
		appendEvent(report, 'baseline.read.verified');

		phase = 'change';
		appendEvent(report, 'change.window.open');
		onChangeWindowOpen();
		await waitUntil(
			'operator change event observation',
			config.observeMs,
			() => report.observation.changeEventObserved,
			wait,
		);
		if (changedValue === undefined) throw new Error('Homey origin-event changed scalar was not captured');
		await waitForReadBack('change read-back', changedValue, config, client, wait);
		report.observation.changeReadBackMatched = true;
		appendEvent(report, 'change.readback.verified');

		phase = 'restore';
		appendEvent(report, 'restore.window.open');
		onRestoreWindowOpen();
		await waitUntil(
			'operator restoration event observation',
			config.observeMs,
			() => report.observation.restorationEventObserved,
			wait,
		);
		await waitForReadBack('restoration read-back', baseline, config, client, wait);
		report.observation.restorationReadBackMatched = true;
		report.observation.restored = true;
		appendEvent(report, 'restore.readback.verified');
	} catch (error: unknown) {
		operationError =
			error instanceof Error && error.message.startsWith('Homey ')
				? error
				: new Error('Homey origin-event verification failed');
	} finally {
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
			await cleanup('origin-event device unsubscribe', 'device.unsubscribe.resolved', 'device.unsubscribe.failed', () =>
				device.disconnect(),
			);
		await cleanup(
			'origin-event manager unsubscribe',
			'manager.unsubscribe.resolved',
			'manager.unsubscribe.failed',
			() => client.devices.disconnect(),
		);
		await cleanup('origin-event socket disconnect', 'socket.disconnect.resolved', 'socket.disconnect.failed', () =>
			client.disconnect(),
		);
		cleanupListeners.forEach((cleanupListener) => cleanupListener());
		try {
			client.destroy();
			appendEvent(report, 'sdk.destroyed');
		} catch {
			cleanupFailures.push('origin-event client destroy');
			appendEvent(report, 'sdk.destroy.failed');
		}
		report.session.cleanupCompleted = cleanupFailures.length === 0;
	}

	if (cleanupFailures.length > 0) throw new Error(`Homey origin-event cleanup failed: ${cleanupFailures.join(', ')}`);
	if (operationError !== undefined) throw operationError;
	return report;
};

const requireExactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
		throw new Error(`Homey origin-event report ${label} schema is invalid`);
	}

	return value;
};

export function assertHomeyShsOriginEventReportSafe(
	value: unknown,
	config: HomeyShsOriginEventConfig,
): asserts value is HomeyShsOriginEventReport {
	const report = requireExactKeys(value, ['metadata', 'observation', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const observation = requireExactKeys(
		report.observation,
		[
			'baselineRead',
			'changeEventObserved',
			'changeReadBackMatched',
			'restorationEventObserved',
			'restorationReadBackMatched',
			'restored',
			'scenario',
		],
		'observation',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'managerSubscribed'], 'session');

	if (
		metadata.probe !== 'homey-shs-origin-event' ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION
	)
		throw new Error('Homey origin-event report metadata is invalid');
	if (!SCENARIOS.includes(observation.scenario as HomeyOriginEventScenario))
		throw new Error('Homey origin-event report scenario is invalid');
	for (const key of [
		'baselineRead',
		'changeEventObserved',
		'changeReadBackMatched',
		'restorationEventObserved',
		'restorationReadBackMatched',
		'restored',
	] as const) {
		if (observation[key] !== true) throw new Error('Homey origin-event report did not verify the complete observation');
	}
	if (session.cleanupCompleted !== true || session.managerSubscribed !== true || !Array.isArray(session.events))
		throw new Error('Homey origin-event report session is invalid');
	for (const [index, item] of session.events.entries()) {
		if (
			!isRecord(item) ||
			Object.keys(item).sort().join() !== 'event,order' ||
			typeof item.event !== 'string' ||
			!SAFE_EVENTS.has(item.event) ||
			item.order !== index + 1
		)
			throw new Error('Homey origin-event report event is invalid');
	}
	const labels = session.events.map((item) => (item as { event: string }).event);
	let previousIndex = -1;
	for (const label of [
		'manager.subscribe.resolved',
		'inventory.read.resolved',
		'device.subscribe.resolved',
		'baseline.read.verified',
		'change.window.open',
		'change.event.observed',
		'change.readback.verified',
		'restore.window.open',
		'restore.event.observed',
		'restore.readback.verified',
		'device.unsubscribe.resolved',
		'manager.unsubscribe.resolved',
		'socket.disconnect.resolved',
		'sdk.destroyed',
	]) {
		const index = labels.indexOf(label);

		if (index <= previousIndex) throw new Error('Homey origin-event report ordering is invalid');
		previousIndex = index;
	}
	const serialized = JSON.stringify(value).toLowerCase();
	const forbidden = [
		config.apiKey,
		config.expectedHost,
		config.target.deviceId,
		config.target.capabilityId,
		...config.privateTerms,
	]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !['home', 'homey'].includes(item));
	if (
		forbidden.some((item) => serialized.includes(item)) ||
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	)
		throw new Error('Sanitized Homey origin-event report contains a private value');
}

export const writeHomeyShsOriginEventReport = async (
	report: HomeyShsOriginEventReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `origin-event-${suffix}`);
	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});
	return outputDirectory;
};

const scenarioLabel = (scenario: HomeyOriginEventScenario): string =>
	scenario === 'physical' ? 'physical control' : scenario === 'homey' ? 'the Homey app' : 'the designated Homey Flow';

const run = async (): Promise<void> => {
	const config = loadHomeyShsOriginEventConfig(process.env);
	const report = await probeHomeyShsOriginEvent(
		config,
		homeyRealtimeSdkFactory,
		sleep,
		() => {
			process.stdout.write(
				`Homey ${config.scenario}-origin change window is open for ${config.observeMs} ms. Change only the allowlisted capability using ${scenarioLabel(config.scenario)} now.\n`,
			);
		},
		() => {
			process.stdout.write(
				`Homey ${config.scenario}-origin restoration window is open for ${config.observeMs} ms. Restore only the allowlisted capability using ${scenarioLabel(config.scenario)} now.\n`,
			);
		},
	);
	assertHomeyShsOriginEventReportSafe(report, config);
	const outputDirectory = await writeHomeyShsOriginEventReport(report, config.outputRoot);
	process.stdout.write(`Sanitized Homey ${config.scenario}-origin event report written to ${outputDirectory}.\n`);
};

if (require.main === module) {
	void run().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey origin-event probe failed'}\n`);
		process.exitCode = 1;
	});
}
