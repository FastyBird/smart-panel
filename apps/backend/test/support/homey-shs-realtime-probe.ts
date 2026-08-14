import { HomeyAPI } from 'homey-api';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const WRITE_ACKNOWLEDGEMENT = 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE';
const DEFAULT_OBSERVE_MS = 2_000;
const MAX_OBSERVE_MS = 60_000;
const SAFE_EVENT_LABELS = new Set([
	'capability.update',
	'device.create',
	'device.delete',
	'device.update',
	'device.unsubscribe.failed',
	'device.unsubscribe.resolved',
	'manager.subscribe.resolved',
	'manager.unsubscribe.failed',
	'manager.unsubscribe.resolved',
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
]);

type HomeyScalar = boolean | number | string;
type EventListener = (...arguments_: unknown[]) => void;

class HomeyShsSdkTimeoutError extends Error {
	constructor(label: string, timeoutMs: number) {
		super(`Homey ${label} timed out after ${timeoutMs} ms`);
		this.name = 'HomeyShsSdkTimeoutError';
	}
}

interface EventSource {
	on(event: string, listener: EventListener): unknown;
	off?(event: string, listener: EventListener): unknown;
}

interface HomeyCapabilityMetadata {
	max?: unknown;
	min?: unknown;
	setable?: unknown;
	type?: unknown;
	value?: unknown;
	values?: unknown;
}

interface HomeyDevice extends EventSource {
	capabilitiesObj?: Record<string, HomeyCapabilityMetadata>;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
}

interface HomeyDevicesManager extends EventSource {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getCapabilityValue(options: { $timeout?: number; capabilityId: string; deviceId: string }): Promise<unknown>;
	getDevices(options?: { $timeout?: number }): Promise<Record<string, HomeyDevice>>;
	setCapabilityValue(options: {
		$timeout?: number;
		capabilityId: string;
		deviceId: string;
		value: HomeyScalar;
	}): Promise<unknown>;
}

interface HomeySdkClient extends EventSource {
	destroy(): void;
	disconnect(): Promise<void>;
	devices: HomeyDevicesManager;
}

export interface HomeySdkFactory {
	createLocalApi(options: { address: string; token: string }): Promise<HomeySdkClient>;
}

interface HomeyShsWriteConfig {
	capabilityId: string;
	deviceId: string;
	value: HomeyScalar;
}

export interface HomeyShsRealtimeProbeConfig extends HomeyShsProbeConfig {
	observeMs: number;
	write: HomeyShsWriteConfig | null;
}

export interface HomeyShsRealtimeReport {
	metadata: {
		probe: 'homey-shs-realtime';
		schemaVersion: 1;
		sdkVersion: string;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: string; order: number }>;
		managerSubscribed: boolean;
	};
	invalidKey: {
		category: 'authentication';
		rejected: true;
		statusCode: 401 | 403;
	};
	write: {
		attempted: boolean;
		eventObserved: boolean;
		readBackMatched: boolean;
		restoreReadBackMatched: boolean;
		restored: boolean;
	};
}

const sdkFactory: HomeySdkFactory = {
	createLocalApi: async ({ address, token }) =>
		(await HomeyAPI.createLocalAPI({ address, token, debug: null })) as HomeySdkClient,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_OBSERVE_MS;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_OBSERVE_MS) {
		throw new Error(`FB_HOMEY_SHS_REALTIME_OBSERVE_MS must be an integer between 0 and ${MAX_OBSERVE_MS}`);
	}

	return parsed;
};

const parseWriteValue = (value: string): HomeyScalar => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(value) as unknown;
	} catch {
		throw new Error('FB_HOMEY_SHS_WRITE_VALUE must be a JSON boolean, finite number, or string');
	}

	if (
		!['boolean', 'number', 'string'].includes(typeof parsed) ||
		(typeof parsed === 'number' && !Number.isFinite(parsed))
	) {
		throw new Error('FB_HOMEY_SHS_WRITE_VALUE must be a JSON boolean, finite number, or string');
	}

	return parsed as HomeyScalar;
};

const parseWriteConfig = (environment: NodeJS.ProcessEnv): HomeyShsWriteConfig | null => {
	const names = [
		'FB_HOMEY_SHS_WRITE_ENABLE',
		'FB_HOMEY_SHS_WRITE_DEVICE_ID',
		'FB_HOMEY_SHS_WRITE_CAPABILITY_ID',
		'FB_HOMEY_SHS_WRITE_VALUE',
	] as const;
	const present = names.filter((name) => environment[name] !== undefined);

	if (present.length === 0) {
		return null;
	}

	if (present.length !== names.length) {
		throw new Error('All four FB_HOMEY_SHS_WRITE_* variables are required to enable a write probe');
	}

	if (environment.FB_HOMEY_SHS_WRITE_ENABLE !== WRITE_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_WRITE_ENABLE does not contain the required acknowledgement');
	}

	const deviceId = environment.FB_HOMEY_SHS_WRITE_DEVICE_ID?.trim();
	const capabilityId = environment.FB_HOMEY_SHS_WRITE_CAPABILITY_ID?.trim();
	const rawValue = environment.FB_HOMEY_SHS_WRITE_VALUE;

	if (!deviceId || !capabilityId || rawValue === undefined) {
		throw new Error('The Homey write allowlist target and value must not be empty');
	}

	return { deviceId, capabilityId, value: parseWriteValue(rawValue) };
};

export const loadHomeyShsRealtimeProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsRealtimeProbeConfig => ({
	...loadHomeyShsProbeConfig(environment, workingDirectory),
	observeMs: parseObserveMs(environment.FB_HOMEY_SHS_REALTIME_OBSERVE_MS),
	write: parseWriteConfig(environment),
});

const sleep = async (milliseconds: number): Promise<void> => {
	if (milliseconds > 0) {
		await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
	}
};

const settleSdkOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	// Invoke first so manager operations register the SDK-native $timeout before this outer watchdog.
	// A timed-out write therefore settles inside the SDK before restoration is sent on the same ordered transport.
	const operationPromise = operation();
	const timeoutPromise = new Promise<never>((_resolvePromise, rejectPromise) => {
		timeout = setTimeout(() => rejectPromise(new HomeyShsSdkTimeoutError(label, timeoutMs)), timeoutMs);
	});

	try {
		return await Promise.race([operationPromise, timeoutPromise]);
	} finally {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
	}
};

const settleSdkClientCreation = async (
	label: string,
	timeoutMs: number,
	operation: () => Promise<HomeySdkClient>,
): Promise<HomeySdkClient> => {
	const creationPromise = operation();

	try {
		return await settleSdkOperation(label, timeoutMs, () => creationPromise);
	} catch (error: unknown) {
		if (error instanceof HomeyShsSdkTimeoutError) {
			// The SDK does not expose cancellation for createLocalAPI. If it resolves after the watchdog,
			// destroy the otherwise-unreachable client immediately so its socket cannot outlive the probe.
			void creationPromise.then(
				(lateClient) => {
					try {
						lateClient.destroy();
					} catch {
						// The probe has already failed with the sanitized creation timeout.
					}
				},
				() => undefined,
			);
		}

		throw error;
	}
};

const runSdkOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	try {
		return await settleSdkOperation(label, timeoutMs, operation);
	} catch (error: unknown) {
		if (error instanceof HomeyShsSdkTimeoutError) {
			throw error;
		}

		if (statusCodeOf(error) === 408) {
			throw new HomeyShsSdkTimeoutError(label, timeoutMs);
		}

		// eslint-disable-next-line preserve-caught-error -- SDK causes may contain endpoints or credential-bearing detail.
		throw new Error(`Homey ${label} failed`);
	}
};

const runSdkClientCreation = async (
	label: string,
	timeoutMs: number,
	operation: () => Promise<HomeySdkClient>,
): Promise<HomeySdkClient> => {
	try {
		return await settleSdkClientCreation(label, timeoutMs, operation);
	} catch (error: unknown) {
		if (error instanceof HomeyShsSdkTimeoutError) {
			throw error;
		}

		if (statusCodeOf(error) === 408) {
			throw new HomeyShsSdkTimeoutError(label, timeoutMs);
		}

		// eslint-disable-next-line preserve-caught-error -- SDK causes may contain endpoints or credential-bearing detail.
		throw new Error(`Homey ${label} failed`);
	}
};

const statusCodeOf = (error: unknown): number | null => {
	if (!isRecord(error)) {
		return null;
	}

	return typeof error.statusCode === 'number' ? error.statusCode : null;
};

const scalarCapabilityValue = (response: unknown): unknown =>
	isRecord(response) && Object.hasOwn(response, 'value') ? response.value : response;

const assertSafeWriteTarget = (devices: Record<string, HomeyDevice>, write: HomeyShsWriteConfig): HomeyDevice => {
	const device = devices[write.deviceId];
	const capability = device?.capabilitiesObj?.[write.capabilityId];

	if (device === undefined || capability === undefined) {
		throw new Error('The allowlisted Homey write target was not found exactly');
	}

	if (capability.setable !== true) {
		throw new Error('The allowlisted Homey capability is not settable');
	}

	if (typeof write.value === 'number') {
		if (typeof capability.min === 'number' && write.value < capability.min) {
			throw new Error('The requested Homey write value is below the capability minimum');
		}

		if (typeof capability.max === 'number' && write.value > capability.max) {
			throw new Error('The requested Homey write value is above the capability maximum');
		}
	}

	if (typeof write.value === 'string' && Array.isArray(capability.values)) {
		const allowedValues = capability.values
			.map((entry) => (isRecord(entry) ? entry.id : undefined))
			.filter((entry): entry is string => typeof entry === 'string');

		if (allowedValues.length > 0 && !allowedValues.includes(write.value)) {
			throw new Error('The requested Homey write value is not an allowed enum option');
		}
	}

	return device;
};

const assertRestorableOriginalValue = (value: unknown, writeValue: HomeyScalar): HomeyScalar => {
	if (!['boolean', 'number', 'string'].includes(typeof value)) {
		throw new Error('The allowlisted Homey capability has no safely restorable scalar value');
	}

	const originalValue = value as HomeyScalar;

	if (typeof originalValue !== typeof writeValue) {
		throw new Error('The requested Homey write value does not match the current capability value type');
	}

	if (Object.is(originalValue, writeValue)) {
		throw new Error('The requested Homey write value must differ from the current value');
	}

	return originalValue;
};

const attachSequenceListener = (
	source: EventSource,
	event: string,
	report: HomeyShsRealtimeReport,
	label = event,
): (() => void) => {
	const listener = (): void => {
		report.session.events.push({ event: label, order: report.session.events.length + 1 });
	};

	source.on(event, listener);

	return () => source.off?.(event, listener);
};

const assertInvalidKeyRejected = async (
	config: HomeyShsRealtimeProbeConfig,
	factory: HomeySdkFactory,
): Promise<HomeyShsRealtimeReport['invalidKey']> => {
	let client: HomeySdkClient | undefined;
	let operationError: unknown;
	let operationFailed = false;
	let result: HomeyShsRealtimeReport['invalidKey'] | undefined;

	try {
		client = await settleSdkClientCreation('invalid-key client creation', config.timeoutMs, () =>
			factory.createLocalApi({
				address: config.origin.origin,
				token: `invalid-homey-probe-${randomBytes(24).toString('hex')}`,
			}),
		);
		const invalidClient = client;

		await settleSdkOperation('invalid-key inventory read', config.timeoutMs, () =>
			invalidClient.devices.getDevices({ $timeout: config.timeoutMs }),
		);
	} catch (error: unknown) {
		if (error instanceof HomeyShsSdkTimeoutError) {
			operationFailed = true;
			operationError = error;
		} else {
			const statusCode = statusCodeOf(error);

			if (statusCode === 401 || statusCode === 403) {
				result = { category: 'authentication', rejected: true, statusCode };
			} else {
				operationFailed = true;
				operationError = new Error('The Homey invalid-key probe did not return an authentication rejection');
			}
		}
	}

	if (client !== undefined) {
		const invalidClient = client;
		let cleanupFailed = false;

		try {
			await runSdkOperation('invalid-key client disconnect', config.timeoutMs, () => invalidClient.disconnect());
		} catch {
			cleanupFailed = true;
		}

		try {
			client.destroy();
		} catch {
			cleanupFailed = true;
		}

		if (cleanupFailed) {
			throw new Error('Homey invalid-key probe cleanup failed');
		}
	}

	if (operationFailed) {
		throw operationError;
	}

	if (result !== undefined) {
		return result;
	}

	throw new Error('The Homey invalid-key probe unexpectedly authenticated');
};

export const probeHomeyShsRealtime = async (
	config: HomeyShsRealtimeProbeConfig,
	factory: HomeySdkFactory = sdkFactory,
	wait: (milliseconds: number) => Promise<void> = sleep,
): Promise<HomeyShsRealtimeReport> => {
	const report: HomeyShsRealtimeReport = {
		metadata: { probe: 'homey-shs-realtime', schemaVersion: 1, sdkVersion: SDK_VERSION },
		session: { cleanupCompleted: false, events: [], managerSubscribed: false },
		invalidKey: { category: 'authentication', rejected: true, statusCode: 401 },
		write: {
			attempted: false,
			eventObserved: false,
			readBackMatched: false,
			restoreReadBackMatched: false,
			restored: false,
		},
	};
	const client = await runSdkClientCreation('client creation', config.timeoutMs, () =>
		factory.createLocalApi({ address: config.origin.origin, token: config.apiKey }),
	);
	report.session.events.push({ event: 'sdk.create.resolved', order: 1 });
	const cleanupListeners = [
		attachSequenceListener(client, 'connect', report, 'socket.connect'),
		attachSequenceListener(client, 'disconnect', report, 'socket.disconnect'),
		attachSequenceListener(client, 'reconnect', report, 'socket.reconnect'),
		attachSequenceListener(client, 'reconnect_attempt', report, 'socket.reconnect_attempt'),
		attachSequenceListener(client, 'reconnect_error', report, 'socket.reconnect_error'),
		attachSequenceListener(client.devices, 'device.create', report),
		attachSequenceListener(client.devices, 'device.update', report),
		attachSequenceListener(client.devices, 'device.delete', report),
	];
	let connectedDevice: HomeyDevice | undefined;
	let operationError: unknown;
	let operationFailed = false;
	const cleanupFailures: string[] = [];

	try {
		await runSdkOperation('manager subscription', config.timeoutMs, () => client.devices.connect());
		report.session.managerSubscribed = true;
		report.session.events.push({ event: 'manager.subscribe.resolved', order: report.session.events.length + 1 });

		if (config.write === null) {
			await wait(config.observeMs);
		} else {
			const write = config.write;
			const devices = await runSdkOperation('device inventory read', config.timeoutMs, () =>
				client.devices.getDevices({ $timeout: config.timeoutMs }),
			);
			const device = assertSafeWriteTarget(devices, write);
			connectedDevice = device;
			let acceptCapabilityEvents = false;
			const capabilityListener = (payload: unknown): void => {
				if (
					acceptCapabilityEvents &&
					isRecord(payload) &&
					payload.capabilityId === write.capabilityId &&
					Object.is(payload.value, write.value)
				) {
					report.write.eventObserved = true;
					report.session.events.push({
						event: 'capability.update',
						order: report.session.events.length + 1,
					});
				}
			};

			device.on('capability', capabilityListener);

			try {
				await runSdkOperation('device subscription', config.timeoutMs, () => device.connect());
				const originalValue = assertRestorableOriginalValue(
					scalarCapabilityValue(
						await runSdkOperation('pre-write capability read', config.timeoutMs, () =>
							client.devices.getCapabilityValue({
								$timeout: config.timeoutMs,
								capabilityId: write.capabilityId,
								deviceId: write.deviceId,
							}),
						),
					),
					write.value,
				);

				try {
					report.write.attempted = true;
					acceptCapabilityEvents = true;

					try {
						await runSdkOperation('capability write', config.timeoutMs, () =>
							client.devices.setCapabilityValue({
								$timeout: config.timeoutMs,
								capabilityId: write.capabilityId,
								deviceId: write.deviceId,
								value: write.value,
							}),
						);
						await wait(config.observeMs);
					} finally {
						acceptCapabilityEvents = false;
					}

					const readBack = scalarCapabilityValue(
						await runSdkOperation('post-write capability read', config.timeoutMs, () =>
							client.devices.getCapabilityValue({
								$timeout: config.timeoutMs,
								capabilityId: write.capabilityId,
								deviceId: write.deviceId,
							}),
						),
					);

					report.write.readBackMatched = Object.is(readBack, write.value);
				} finally {
					if (report.write.attempted) {
						await runSdkOperation('capability restoration', config.timeoutMs, () =>
							client.devices.setCapabilityValue({
								$timeout: config.timeoutMs,
								capabilityId: write.capabilityId,
								deviceId: write.deviceId,
								value: originalValue,
							}),
						);
						report.write.restored = true;
						const restored = scalarCapabilityValue(
							await runSdkOperation('restoration capability read', config.timeoutMs, () =>
								client.devices.getCapabilityValue({
									$timeout: config.timeoutMs,
									capabilityId: write.capabilityId,
									deviceId: write.deviceId,
								}),
							),
						);

						report.write.restoreReadBackMatched = Object.is(restored, originalValue);
					}
				}
			} finally {
				device.off?.('capability', capabilityListener);
			}
		}
	} catch (error: unknown) {
		operationError = error;
		operationFailed = true;
	} finally {
		const cleanup = async (
			label: string,
			resolvedEvent: string,
			failedEvent: string,
			operation: () => Promise<unknown>,
		): Promise<void> => {
			try {
				await runSdkOperation(label, config.timeoutMs, operation);
				report.session.events.push({ event: resolvedEvent, order: report.session.events.length + 1 });
			} catch {
				cleanupFailures.push(label);
				report.session.events.push({ event: failedEvent, order: report.session.events.length + 1 });
			}
		};

		if (connectedDevice !== undefined) {
			const device = connectedDevice;

			await cleanup('device unsubscribe', 'device.unsubscribe.resolved', 'device.unsubscribe.failed', () =>
				device.disconnect(),
			);
		}

		await cleanup('manager unsubscribe', 'manager.unsubscribe.resolved', 'manager.unsubscribe.failed', () =>
			client.devices.disconnect(),
		);
		await cleanup('socket disconnect', 'socket.disconnect.resolved', 'socket.disconnect.failed', () =>
			client.disconnect(),
		);
		cleanupListeners.forEach((cleanup) => cleanup());

		try {
			client.destroy();
			report.session.events.push({ event: 'sdk.destroyed', order: report.session.events.length + 1 });
		} catch {
			cleanupFailures.push('client destroy');
			report.session.events.push({ event: 'sdk.destroy.failed', order: report.session.events.length + 1 });
		}

		report.session.cleanupCompleted = cleanupFailures.length === 0;
	}

	if (cleanupFailures.length > 0) {
		throw new Error(`Homey realtime cleanup failed: ${cleanupFailures.join(', ')}`);
	}

	if (operationFailed) {
		throw operationError;
	}

	report.invalidKey = await assertInvalidKeyRejected(config, factory);

	return report;
};

export const assertHomeyShsRealtimeReportSafe = (
	report: HomeyShsRealtimeReport,
	config: HomeyShsRealtimeProbeConfig,
): void => {
	const serialized = JSON.stringify(report).toLowerCase();
	const forbidden = [
		config.apiKey,
		config.expectedHost,
		...config.privateTerms,
		...(config.write === null ? [] : [config.write.deviceId, config.write.capabilityId]),
		...(typeof config.write?.value === 'string' ? [config.write.value] : []),
	]
		.map((value) => value.trim().toLowerCase())
		.filter((value) => value.length >= 3 && !['home', 'homey'].includes(value));

	if (forbidden.some((value) => serialized.includes(value))) {
		throw new Error('Sanitized Homey realtime report contains a configured secret or private value');
	}

	if (!report.session.managerSubscribed || !report.session.cleanupCompleted) {
		throw new Error('Homey realtime probe did not complete subscription cleanup');
	}

	if (report.session.events.some(({ event, order }, index) => !SAFE_EVENT_LABELS.has(event) || order !== index + 1)) {
		throw new Error('Homey realtime report contains an unsafe or unordered event label');
	}

	if (
		report.write.attempted &&
		(!report.write.eventObserved ||
			!report.write.readBackMatched ||
			!report.write.restored ||
			!report.write.restoreReadBackMatched)
	) {
		throw new Error('Homey realtime probe did not verify the allowlisted write, event, read-back, and restoration');
	}
};

export const writeHomeyShsRealtimeReport = async (
	report: HomeyShsRealtimeReport,
	outputRoot: string,
): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `realtime-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsRealtimeProbeConfig(process.env);
	const report = await probeHomeyShsRealtime(config);

	assertHomeyShsRealtimeReportSafe(report, config);

	const outputDirectory = await writeHomeyShsRealtimeReport(report, config.outputRoot);

	process.stdout.write(
		`Sanitized Homey realtime report written to ${outputDirectory} ` +
			`(${report.session.events.length} ordered events, write ${report.write.attempted ? 'enabled' : 'disabled'}).\n`,
	);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS realtime probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
