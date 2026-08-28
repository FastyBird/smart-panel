import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PropertyCommandValue } from '../../src/modules/devices/utils/property-command-value.utils';

import {
	HOMEY_MAPPING_CONTROL_FAMILIES,
	HOMEY_MAPPING_CONTROL_MAPPINGS,
	type HomeyMappingControlBinding,
	type HomeyMappingControlFamily,
	type HomeyMappingControlRuntime,
	type HomeyMappingControlRuntimeFactory,
	type HomeyShsMappingControlConfig,
	createHomeyMappingControlRuntime,
} from './homey-shs-mapping-control-probe';
import { loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const ENABLE_ACKNOWLEDGEMENT = 'I_WILL_RUN_AND_RESTORE_CONCURRENT_COMMANDS_ONLY_ON_THE_ALLOWLISTED_HOMEY_TARGET';
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const CONFLICTING_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_MAPPING_CONTROL_',
	'FB_HOMEY_SHS_ORIGIN_EVENT_',
	'FB_HOMEY_SHS_PLUGIN_LIFECYCLE_',
	'FB_HOMEY_SHS_REALTIME_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_RESTART_EVENT_FLOW_',
	'FB_HOMEY_SHS_STARTUP_',
	'FB_HOMEY_SHS_WRITE_',
] as const;

type BurstCommandEvent =
	| 'baseline.read.verified'
	| 'commands.concurrent.requested'
	| 'commands.concurrent.resolved'
	| 'events.ordered.verified'
	| 'final.readback.verified'
	| 'inventory.verified'
	| 'restoration.readback.verified'
	| 'restoration.requested'
	| 'restoration.resolved'
	| 'service.start.requested'
	| 'service.start.resolved'
	| 'service.stop.resolved'
	| 'target.bound';

const SAFE_EVENTS: ReadonlySet<BurstCommandEvent> = new Set([
	'baseline.read.verified',
	'commands.concurrent.requested',
	'commands.concurrent.resolved',
	'events.ordered.verified',
	'final.readback.verified',
	'inventory.verified',
	'restoration.readback.verified',
	'restoration.requested',
	'restoration.resolved',
	'service.start.requested',
	'service.start.resolved',
	'service.stop.resolved',
	'target.bound',
]);

export type HomeyShsBurstCommandConfig = HomeyShsMappingControlConfig;

export interface HomeyShsBurstCommandReport {
	metadata: {
		probe: 'homey-shs-burst-command';
		schemaVersion: 1;
		sdkVersion: string;
	};
	observation: {
		baselineRead: boolean;
		concurrentCommandsAccepted: boolean;
		finalReadBackMatched: boolean;
		orderedCapabilityEventsObserved: boolean;
		restorationAccepted: boolean;
		restorationReadBackMatched: boolean;
		restored: boolean;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: BurstCommandEvent; order: number }>;
		serviceStarted: boolean;
	};
}

type HomeyBurstCommandTerminationSignal = 'SIGINT' | 'SIGTERM';

export interface HomeyBurstCommandSignalSource {
	on(signal: HomeyBurstCommandTerminationSignal, listener: () => void): unknown;
	off(signal: HomeyBurstCommandTerminationSignal, listener: () => void): unknown;
}

class HomeyBurstCommandTerminationError extends Error {
	constructor(readonly signal: HomeyBurstCommandTerminationSignal) {
		super(`Homey burst-command probe received ${signal}; restoration completed before termination`);
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const loadHomeyShsBurstCommandConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsBurstCommandConfig => {
	if (environment.FB_HOMEY_SHS_BURST_COMMAND_ENABLE !== ENABLE_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_BURST_COMMAND_ENABLE does not contain the required acknowledgement');
	}
	if (Object.keys(environment).some((name) => CONFLICTING_PREFIXES.some((prefix) => name.startsWith(prefix)))) {
		throw new Error('Unrelated Homey mutation and recovery probe gates must be unset during the burst-command probe');
	}
	const family = environment.FB_HOMEY_SHS_BURST_COMMAND_FAMILY?.trim() as HomeyMappingControlFamily | undefined;

	if (family === undefined || !HOMEY_MAPPING_CONTROL_FAMILIES.includes(family)) {
		throw new Error('FB_HOMEY_SHS_BURST_COMMAND_FAMILY must be exactly cover, lighting, lock, or switch');
	}
	const mappingName = environment.FB_HOMEY_SHS_BURST_COMMAND_MAPPING_NAME?.trim() ?? '';

	if (!HOMEY_MAPPING_CONTROL_MAPPINGS[family].includes(mappingName)) {
		throw new Error('FB_HOMEY_SHS_BURST_COMMAND_MAPPING_NAME is not allowed for the selected family');
	}
	const deviceId = environment.FB_HOMEY_SHS_BURST_COMMAND_DEVICE_ID?.trim() ?? '';
	const capabilityId = environment.FB_HOMEY_SHS_BURST_COMMAND_CAPABILITY_ID?.trim() ?? '';
	const panelValue = environment.FB_HOMEY_SHS_BURST_COMMAND_PANEL_VALUE?.trim() ?? '';

	if (deviceId.length === 0 || capabilityId.length === 0 || panelValue.length === 0) {
		throw new Error('The exact Homey burst-command target and panel value are required');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		family,
		mappingName,
		panelValue,
		target: { capabilityId, deviceId },
	};
};

export const probeHomeyShsBurstCommand = async (
	config: HomeyShsBurstCommandConfig,
	runtimeFactory: HomeyMappingControlRuntimeFactory = createHomeyMappingControlRuntime,
	signalSource: HomeyBurstCommandSignalSource = process,
): Promise<HomeyShsBurstCommandReport> => {
	let runtime: HomeyMappingControlRuntime = runtimeFactory(config);
	let runtimeStarted = false;
	const events: Array<{ event: BurstCommandEvent; order: number }> = [];
	const record = (event: BurstCommandEvent): void => {
		events.push({ event, order: events.length + 1 });
	};
	let binding: HomeyMappingControlBinding | undefined;
	let commandsAttempted = false;
	let restored = false;
	let operationError: unknown;
	const cleanupFailures: string[] = [];
	let terminationSignal: HomeyBurstCommandTerminationSignal | undefined;
	const handleSigint = (): void => {
		terminationSignal ??= 'SIGINT';
	};
	const handleSigterm = (): void => {
		terminationSignal ??= 'SIGTERM';
	};
	const throwIfTerminated = (): void => {
		if (terminationSignal !== undefined) throw new HomeyBurstCommandTerminationError(terminationSignal);
	};
	const settleWithin = <T>(operation: Promise<T>): Promise<{ settled: boolean; value?: T }> =>
		new Promise((resolve) => {
			let settled = false;
			const finish = (result: { settled: boolean; value?: T }): void => {
				if (settled) return;

				settled = true;
				clearTimeout(timer);
				resolve(result);
			};
			const timer = setTimeout(() => finish({ settled: false }), config.timeoutMs);

			void operation.then(
				(value) => finish({ settled: true, value }),
				() => finish({ settled: false }),
			);
		});
	const stopRuntime = async (): Promise<boolean> => {
		if (!runtimeStarted) return true;

		const stopped = await settleWithin(runtime.stop());

		if (stopped.settled) runtimeStarted = false;

		return stopped.settled;
	};
	const waitForIdle = async (activeBinding: HomeyMappingControlBinding): Promise<boolean> =>
		(await settleWithin(activeBinding.waitForCommandIdle())).settled;
	const restoreBaseline = async (): Promise<boolean> => {
		if (binding === undefined) return false;
		const baselinePanelValue = binding.baselinePanelValue;
		let restorationBinding = binding;

		if (!(await waitForIdle(restorationBinding))) {
			if (!(await stopRuntime())) return false;

			runtime = runtimeFactory(config);
			runtimeStarted = true;
			await runtime.start();
			restorationBinding = await runtime.bind(config, { allowUnchangedTarget: true });
		}

		const restorationAccepted = await restorationBinding.command(baselinePanelValue);

		if (!restorationAccepted || !(await waitForIdle(restorationBinding))) return false;

		return restorationBinding.readBackMatches(baselinePanelValue);
	};

	signalSource.on('SIGINT', handleSigint);
	signalSource.on('SIGTERM', handleSigterm);

	try {
		record('service.start.requested');
		runtimeStarted = true;
		await runtime.start();
		throwIfTerminated();
		record('service.start.resolved');
		binding = await runtime.bind(config);
		throwIfTerminated();
		record('inventory.verified');
		record('target.bound');
		record('baseline.read.verified');
		binding.resetObservedPanelSequence();
		const commandSequence: readonly PropertyCommandValue[] = [
			binding.targetPanelValue,
			binding.baselinePanelValue,
			binding.targetPanelValue,
		];
		record('commands.concurrent.requested');
		commandsAttempted = true;
		const commandResults = await Promise.all(commandSequence.map((value) => binding?.command(value)));
		throwIfTerminated();

		if (commandResults.some((accepted) => accepted !== true)) {
			throw new Error('One or more Homey burst-command requests were rejected or unconfirmed');
		}
		record('commands.concurrent.resolved');
		if (!(await waitForIdle(binding))) throw new Error('Homey burst-command queue did not become idle');

		if (!binding.observedPanelSequenceMatches(commandSequence)) {
			throw new Error('Homey burst-command ordered capability events were not observed');
		}
		record('events.ordered.verified');

		if (!(await binding.readBackMatches(binding.targetPanelValue))) {
			throw new Error('Homey burst-command final read-back did not match');
		}
		record('final.readback.verified');
		throwIfTerminated();
		record('restoration.requested');
		const restorationAccepted = await binding.command(binding.baselinePanelValue);
		throwIfTerminated();

		if (!restorationAccepted) throw new Error('Homey burst-command restoration was rejected or unconfirmed');
		record('restoration.resolved');
		if (!(await waitForIdle(binding))) throw new Error('Homey burst-command restoration queue did not become idle');

		if (!(await binding.readBackMatches(binding.baselinePanelValue))) {
			throw new Error('Homey burst-command restoration read-back did not match');
		}
		record('restoration.readback.verified');
		restored = true;
	} catch (error) {
		operationError = error;
	} finally {
		if (commandsAttempted && binding !== undefined && !restored) {
			try {
				if (!(await restoreBaseline())) cleanupFailures.push('capability restoration');
				else restored = true;
			} catch {
				cleanupFailures.push('capability restoration');
			}
		}

		if (await stopRuntime()) {
			record('service.stop.resolved');
		} else {
			cleanupFailures.push('service stop');
		}

		signalSource.off('SIGINT', handleSigint);
		signalSource.off('SIGTERM', handleSigterm);
	}

	if (cleanupFailures.length > 0) throw new Error(`Homey burst-command cleanup failed: ${cleanupFailures.join(', ')}`);
	if (terminationSignal !== undefined && !(operationError instanceof HomeyBurstCommandTerminationError)) {
		throw new HomeyBurstCommandTerminationError(terminationSignal);
	}
	if (operationError !== undefined) throw operationError;
	if (binding === undefined || !restored) throw new Error('Homey burst-command verification failed');

	return {
		metadata: { probe: 'homey-shs-burst-command', schemaVersion: 1, sdkVersion: SDK_VERSION },
		observation: {
			baselineRead: true,
			concurrentCommandsAccepted: true,
			finalReadBackMatched: true,
			orderedCapabilityEventsObserved: true,
			restorationAccepted: true,
			restorationReadBackMatched: true,
			restored: true,
		},
		session: { cleanupCompleted: true, events, serviceStarted: true },
	};
};

const requireExactKeys = (value: unknown, keys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) {
		throw new Error(`Homey burst-command report ${label} schema is invalid`);
	}

	return value;
};

export function assertHomeyShsBurstCommandReportSafe(
	value: unknown,
	config: HomeyShsBurstCommandConfig,
): asserts value is HomeyShsBurstCommandReport {
	const report = requireExactKeys(value, ['metadata', 'observation', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const observation = requireExactKeys(
		report.observation,
		[
			'baselineRead',
			'concurrentCommandsAccepted',
			'finalReadBackMatched',
			'orderedCapabilityEventsObserved',
			'restorationAccepted',
			'restorationReadBackMatched',
			'restored',
		],
		'observation',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'serviceStarted'], 'session');

	if (
		metadata.probe !== 'homey-shs-burst-command' ||
		metadata.schemaVersion !== 1 ||
		metadata.sdkVersion !== SDK_VERSION
	) {
		throw new Error('Homey burst-command report metadata is invalid');
	}
	for (const key of [
		'baselineRead',
		'concurrentCommandsAccepted',
		'finalReadBackMatched',
		'orderedCapabilityEventsObserved',
		'restorationAccepted',
		'restorationReadBackMatched',
		'restored',
	] as const) {
		if (observation[key] !== true) throw new Error('Homey burst-command report did not verify the complete sequence');
	}
	if (session.cleanupCompleted !== true || session.serviceStarted !== true || !Array.isArray(session.events)) {
		throw new Error('Homey burst-command report session is invalid');
	}
	for (const [index, event] of session.events.entries()) {
		if (
			!isRecord(event) ||
			Object.keys(event).sort().join() !== 'event,order' ||
			typeof event.event !== 'string' ||
			!SAFE_EVENTS.has(event.event as BurstCommandEvent) ||
			event.order !== index + 1
		) {
			throw new Error('Homey burst-command report event is invalid');
		}
	}
	const labels = session.events.map((event) => (event as { event: string }).event);
	let previousIndex = -1;

	for (const label of [
		'service.start.requested',
		'service.start.resolved',
		'inventory.verified',
		'target.bound',
		'baseline.read.verified',
		'commands.concurrent.requested',
		'commands.concurrent.resolved',
		'events.ordered.verified',
		'final.readback.verified',
		'restoration.requested',
		'restoration.resolved',
		'restoration.readback.verified',
		'service.stop.resolved',
	]) {
		const index = labels.indexOf(label);

		if (index <= previousIndex) throw new Error('Homey burst-command report ordering is invalid');
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
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (
		forbidden.some((item) => serialized.includes(item)) ||
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey burst-command report contains a private value');
	}
}

export const writeHomeyShsBurstCommandReport = async (
	report: HomeyShsBurstCommandReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `burst-command-${suffix}`);

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
		const config = loadHomeyShsBurstCommandConfig(process.env);
		process.stdout.write(
			'Homey burst-command probe is using the Smart Panel production command path and will restore the original value.\n',
		);
		const report = await probeHomeyShsBurstCommand(config);
		assertHomeyShsBurstCommandReportSafe(report, config);
		const outputDirectory = await writeHomeyShsBurstCommandReport(report, config.outputRoot);
		process.stdout.write(`Sanitized Homey burst-command report written to ${outputDirectory}.\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : 'Homey burst-command probe failed'}\n`);
		process.exitCode = 1;
	}
};

if (require.main === module) void main();
