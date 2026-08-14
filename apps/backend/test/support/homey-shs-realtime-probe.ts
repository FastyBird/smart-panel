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
	'manager.subscribe.resolved',
	'manager.unsubscribe.resolved',
	'sdk.create.resolved',
	'sdk.destroyed',
	'socket.connect',
	'socket.disconnect',
	'socket.disconnect.resolved',
	'socket.reconnect',
	'socket.reconnect_attempt',
	'socket.reconnect_error',
]);

type HomeyScalar = boolean | number | string;
type EventListener = (...arguments_: unknown[]) => void;

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
	getCapabilityValue(options: { capabilityId: string; deviceId: string }): Promise<unknown>;
	getDevices(): Promise<Record<string, HomeyDevice>>;
	setCapabilityValue(options: { capabilityId: string; deviceId: string; value: HomeyScalar }): Promise<unknown>;
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

	try {
		client = await factory.createLocalApi({
			address: config.origin.origin,
			token: `invalid-homey-probe-${randomBytes(24).toString('hex')}`,
		});
		await client.devices.getDevices();
	} catch (error: unknown) {
		const statusCode = statusCodeOf(error);

		if (statusCode === 401 || statusCode === 403) {
			return { category: 'authentication', rejected: true, statusCode };
		}

		// eslint-disable-next-line preserve-caught-error -- SDK causes may contain the endpoint or credential-bearing detail.
		throw new Error('The Homey invalid-key probe did not return an authentication rejection');
	} finally {
		if (client !== undefined) {
			await client.disconnect().catch(() => undefined);
			client.destroy();
		}
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
	const client = await factory.createLocalApi({ address: config.origin.origin, token: config.apiKey });
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

	try {
		await client.devices.connect();
		report.session.managerSubscribed = true;
		report.session.events.push({ event: 'manager.subscribe.resolved', order: report.session.events.length + 1 });

		if (config.write === null) {
			await wait(config.observeMs);
		} else {
			const devices = await client.devices.getDevices();
			const device = assertSafeWriteTarget(devices, config.write);
			connectedDevice = device;
			const capabilityListener = (payload: unknown): void => {
				if (
					isRecord(payload) &&
					payload.capabilityId === config.write?.capabilityId &&
					Object.is(payload.value, config.write.value)
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
				await device.connect();
				const originalValue = assertRestorableOriginalValue(
					scalarCapabilityValue(
						await client.devices.getCapabilityValue({
							capabilityId: config.write.capabilityId,
							deviceId: config.write.deviceId,
						}),
					),
					config.write.value,
				);

				try {
					report.write.attempted = true;
					await client.devices.setCapabilityValue({
						capabilityId: config.write.capabilityId,
						deviceId: config.write.deviceId,
						value: config.write.value,
					});
					await wait(config.observeMs);
					const readBack = scalarCapabilityValue(
						await client.devices.getCapabilityValue({
							capabilityId: config.write.capabilityId,
							deviceId: config.write.deviceId,
						}),
					);

					report.write.readBackMatched = Object.is(readBack, config.write.value);
				} finally {
					if (report.write.attempted) {
						await client.devices.setCapabilityValue({
							capabilityId: config.write.capabilityId,
							deviceId: config.write.deviceId,
							value: originalValue,
						});
						report.write.restored = true;
						const restored = scalarCapabilityValue(
							await client.devices.getCapabilityValue({
								capabilityId: config.write.capabilityId,
								deviceId: config.write.deviceId,
							}),
						);

						report.write.restoreReadBackMatched = Object.is(restored, originalValue);
					}
				}
			} finally {
				device.off?.('capability', capabilityListener);
			}
		}
	} finally {
		if (connectedDevice !== undefined) {
			await connectedDevice.disconnect().catch(() => undefined);
		}

		await client.devices.disconnect().catch(() => undefined);
		report.session.events.push({ event: 'manager.unsubscribe.resolved', order: report.session.events.length + 1 });
		await client.disconnect().catch(() => undefined);
		report.session.events.push({ event: 'socket.disconnect.resolved', order: report.session.events.length + 1 });
		cleanupListeners.forEach((cleanup) => cleanup());
		client.destroy();
		report.session.cleanupCompleted = true;
		report.session.events.push({ event: 'sdk.destroyed', order: report.session.events.length + 1 });
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
