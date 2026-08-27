import { HomeyAPI } from 'homey-api';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const SDK_VERSION = '3.19.2';
const LIFECYCLE_ACKNOWLEDGEMENT = 'I_ACKNOWLEDGE_THIS_MUTATES_A_DISPOSABLE_DEVICE';
const LIFECYCLE_OPERATIONS = 'add,rename,zone-move,availability,remove';
const TEST_APP_AVAILABILITY_SETTING_ID = 'fbsp_lifecycle_availability';
const TEST_APP_PROFILE = {
	deviceMarker: 'fbsp-lifecycle-disposable-device',
	expectedDriverId: 'homey:app:com.fastybird.smartpanel.lifecycletest:driver:lifecycle-test-device',
	expectedOwnerUri: 'homey:app:com.fastybird.smartpanel.lifecycletest',
	initialName: 'FBSP Lifecycle Initial',
	renamedName: 'FBSP Lifecycle Renamed',
} as const;
const DEFAULT_OBSERVE_MS = 90_000;
const MIN_OBSERVE_MS = 10_000;
const MAX_OBSERVE_MS = 300_000;
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const CONFLICTING_GATE_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_WRITE_',
];
const EXPECTED_EVENTS = [
	'sdk.create.resolved',
	'manager.subscribe.resolved',
	'baseline.absence.verified',
	'add.window.open',
	'device.create.observed',
	'add.readback.resolved',
	'flows.absence.verified',
	'device.rename.requested',
	'device.update.rename.observed',
	'rename.readback.resolved',
	'device.zone-move.requested',
	'device.update.zone-move.observed',
	'zone-move.readback.resolved',
	'availability.unavailable.requested',
	'device.update.unavailable.observed',
	'unavailable.readback.resolved',
	'availability.restore.requested',
	'device.update.available.observed',
	'availability.readback.resolved',
	'device.remove.requested',
	'device.delete.observed',
	'final.absence.verified',
	'manager.unsubscribe.resolved',
	'socket.disconnect.resolved',
	'sdk.destroyed',
] as const;

type EventListener = (...arguments_: unknown[]) => void;
type LifecycleEvent = (typeof EXPECTED_EVENTS)[number];

class HomeyShsLifecycleTimeoutError extends Error {
	constructor(label: string, timeoutMs: number) {
		super(`Homey lifecycle ${label} timed out after ${timeoutMs} ms`);
		this.name = 'HomeyShsLifecycleTimeoutError';
	}
}

interface EventSource {
	off?(event: string, listener: EventListener): unknown;
	on(event: string, listener: EventListener): unknown;
}

interface HomeyLifecycleDevice extends EventSource, Record<string, unknown> {
	available?: unknown;
	data?: unknown;
	driverId?: unknown;
	id: string;
	name?: unknown;
	ownerUri?: unknown;
	zone?: unknown;
}

interface HomeyLifecycleFlowManager {
	getAdvancedFlows(options?: {
		$cache?: boolean;
		$timeout?: number;
		$updateCache?: boolean;
	}): Promise<Record<string, unknown>>;
	getFlows(options?: { $cache?: boolean; $timeout?: number; $updateCache?: boolean }): Promise<Record<string, unknown>>;
}

interface HomeyLifecycleDriversManager {
	getPairSession(options: { $timeout?: number; id: string }): Promise<unknown>;
}

interface HomeyLifecycleDevicesManager extends EventSource {
	connect(): Promise<void>;
	deleteDevice(options: { $timeout?: number; id: string }): Promise<unknown>;
	disconnect(): Promise<void>;
	getDevices(options?: {
		$cache?: boolean;
		$timeout?: number;
		$updateCache?: boolean;
	}): Promise<Record<string, HomeyLifecycleDevice>>;
	setDeviceSettings(options: { $timeout?: number; id: string; settings: Record<string, unknown> }): Promise<unknown>;
	updateDevice(options: { $timeout?: number; device: { name?: string; zone?: string }; id: string }): Promise<unknown>;
}

interface HomeyLifecycleZonesManager {
	getZones(options?: { $cache?: boolean; $timeout?: number; $updateCache?: boolean }): Promise<Record<string, unknown>>;
}

interface HomeyLifecycleSystemManager {
	getInfo(options?: { $timeout?: number }): Promise<unknown>;
}

interface HomeyLifecycleClient {
	destroy(): void;
	disconnect(): Promise<void>;
	devices: HomeyLifecycleDevicesManager;
	drivers: HomeyLifecycleDriversManager;
	flow: HomeyLifecycleFlowManager;
	system: HomeyLifecycleSystemManager;
	zones: HomeyLifecycleZonesManager;
}

export interface HomeyLifecycleSdkFactory {
	createLocalApi(options: { address: string; token: string }): Promise<HomeyLifecycleClient>;
}

export interface HomeyShsLifecycleProbeConfig extends HomeyShsProbeConfig {
	availabilityControl: 'operator' | 'test-app-setting';
	destinationZoneId: string;
	deviceMarker: string;
	expectedDriverId: string;
	expectedOwnerUri: string;
	initialName: string;
	observeMs: number;
	renamedName: string;
	sourceZoneId: string;
}

export interface HomeyShsLifecycleReport {
	lifecycle: {
		addVerified: boolean;
		availabilityRestored: boolean;
		finalAbsenceVerified: boolean;
		flowAbsenceVerified: boolean;
		removeVerified: boolean;
		renameVerified: boolean;
		unavailableVerified: boolean;
		zoneMoveVerified: boolean;
	};
	metadata: {
		probe: 'homey-shs-lifecycle';
		schemaVersion: 1;
		sdkVersion: string;
	};
	session: {
		cleanupCompleted: boolean;
		events: Array<{ event: LifecycleEvent; order: number }>;
		managerSubscribed: boolean;
	};
}

export interface HomeyLifecycleOperatorHooks {
	onAddWindowOpen?(): void;
	onAvailabilityRestoreRequested?(): void;
	onUnavailableRequested?(): void;
}

const sdkFactory: HomeyLifecycleSdkFactory = {
	createLocalApi: async ({ address, token }) =>
		(await HomeyAPI.createLocalAPI({ address, token, debug: null })) as HomeyLifecycleClient,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey lifecycle report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey lifecycle report ${label} schema is invalid`);
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
			`FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

const requireEnvironmentValue = (environment: NodeJS.ProcessEnv, name: string): string => {
	const value = environment[name]?.trim();

	if (!value) {
		throw new Error(`${name} is required and must not be empty`);
	}

	return value;
};

export const loadHomeyShsLifecycleProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsLifecycleProbeConfig => {
	if (environment.FB_HOMEY_SHS_LIFECYCLE_ENABLE !== LIFECYCLE_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_LIFECYCLE_ENABLE does not contain the required acknowledgement');
	}

	if (environment.FB_HOMEY_SHS_LIFECYCLE_OPERATIONS !== LIFECYCLE_OPERATIONS) {
		throw new Error('FB_HOMEY_SHS_LIFECYCLE_OPERATIONS must exactly list add,rename,zone-move,availability,remove');
	}

	const conflictingGate = Object.keys(environment).find((name) =>
		CONFLICTING_GATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);

	if (conflictingGate !== undefined) {
		throw new Error('Homey write, recovery, and credential-rotation gates must be unset during the lifecycle probe');
	}

	const deviceMarker = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER');
	const expectedDriverId = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID');
	const expectedOwnerUri = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_OWNER_URI');
	const initialName = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME');
	const renamedName = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME');
	const sourceZoneId = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID');
	const destinationZoneId = requireEnvironmentValue(environment, 'FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID');

	if (!/^fbsp-lifecycle-[a-z0-9][a-z0-9-]{7,63}$/.test(deviceMarker)) {
		throw new Error('FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER must be a specific synthetic fbsp-lifecycle-* marker');
	}

	if (!initialName.startsWith('FBSP Lifecycle ') || !renamedName.startsWith('FBSP Lifecycle ')) {
		throw new Error('Homey lifecycle names must use the synthetic FBSP Lifecycle prefix');
	}

	if (initialName === renamedName) {
		throw new Error('Homey lifecycle initial and renamed names must differ');
	}

	const ownerId = expectedOwnerUri.slice('homey:app:'.length);

	if (!expectedOwnerUri.startsWith('homey:app:') || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(ownerId)) {
		throw new Error('FB_HOMEY_SHS_LIFECYCLE_OWNER_URI must identify the dedicated Homey test app');
	}

	const driverPrefix = `${expectedOwnerUri}:driver:`;
	const driverId = expectedDriverId.slice(driverPrefix.length);

	if (!expectedDriverId.startsWith(driverPrefix) || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(driverId)) {
		throw new Error('FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID must belong to the dedicated Homey test app');
	}

	if (sourceZoneId === destinationZoneId) {
		throw new Error('Homey lifecycle source and destination zones must differ');
	}

	return {
		...loadHomeyShsProbeConfig(environment, workingDirectory),
		availabilityControl:
			deviceMarker === TEST_APP_PROFILE.deviceMarker &&
			expectedDriverId === TEST_APP_PROFILE.expectedDriverId &&
			expectedOwnerUri === TEST_APP_PROFILE.expectedOwnerUri &&
			initialName === TEST_APP_PROFILE.initialName &&
			renamedName === TEST_APP_PROFILE.renamedName
				? 'test-app-setting'
				: 'operator',
		destinationZoneId,
		deviceMarker,
		expectedDriverId,
		expectedOwnerUri,
		initialName,
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS),
		renamedName,
		sourceZoneId,
	};
};

const settleOperation = async <T>(label: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const operationPromise = operation();
	const timeoutPromise = new Promise<never>((_resolvePromise, rejectPromise) => {
		timeout = setTimeout(() => rejectPromise(new HomeyShsLifecycleTimeoutError(label, timeoutMs)), timeoutMs);
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
		if (error instanceof HomeyShsLifecycleTimeoutError) {
			throw error;
		}

		// eslint-disable-next-line preserve-caught-error -- SDK errors may contain private endpoint or device detail.
		throw new Error(`Homey lifecycle ${label} failed`);
	}
};

const createClient = async (
	config: HomeyShsLifecycleProbeConfig,
	factory: HomeyLifecycleSdkFactory,
): Promise<HomeyLifecycleClient> => {
	const creationPromise = factory.createLocalApi({ address: config.origin.origin, token: config.apiKey });

	try {
		return await runOperation('client creation', config.timeoutMs, () => creationPromise);
	} catch (error: unknown) {
		if (error instanceof HomeyShsLifecycleTimeoutError) {
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

const appendEvent = (report: HomeyShsLifecycleReport, event: LifecycleEvent): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

const deviceMarkerOf = (device: HomeyLifecycleDevice): unknown => (isRecord(device.data) ? device.data.id : undefined);

const hasImmutableOwnership = (device: HomeyLifecycleDevice, config: HomeyShsLifecycleProbeConfig): boolean =>
	deviceMarkerOf(device) === config.deviceMarker &&
	device.driverId === config.expectedDriverId &&
	device.ownerUri === config.expectedOwnerUri;

const isInitialDevice = (device: HomeyLifecycleDevice, config: HomeyShsLifecycleProbeConfig): boolean =>
	hasImmutableOwnership(device, config) && device.name === config.initialName && device.zone === config.sourceZoneId;

const freshDevices = async (
	client: HomeyLifecycleClient,
	config: HomeyShsLifecycleProbeConfig,
): Promise<Record<string, HomeyLifecycleDevice>> =>
	runOperation('fresh inventory read', config.timeoutMs, () =>
		client.devices.getDevices({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
	);

const requireSingleOwnedDevice = (
	devices: Record<string, HomeyLifecycleDevice>,
	config: HomeyShsLifecycleProbeConfig,
	expectedId?: string,
): HomeyLifecycleDevice => {
	const matches = Object.values(devices).filter((device) => hasImmutableOwnership(device, config));

	if (matches.length !== 1 || (expectedId !== undefined && matches[0].id !== expectedId)) {
		throw new Error('Homey lifecycle ownership verification failed');
	}

	return matches[0];
};

const assertDedicatedOwnerIsolation = (
	devices: Record<string, HomeyLifecycleDevice>,
	config: HomeyShsLifecycleProbeConfig,
	expectedId?: string,
): void => {
	const ownerMatches = Object.values(devices).filter((device) => device.ownerUri === config.expectedOwnerUri);

	if (
		(expectedId === undefined && ownerMatches.length !== 0) ||
		(expectedId !== undefined && (ownerMatches.length !== 1 || ownerMatches[0].id !== expectedId))
	) {
		throw new Error('The dedicated Homey lifecycle app is not isolated to the run-owned device');
	}
};

const hasLifecycleResidue = (
	devices: Record<string, HomeyLifecycleDevice>,
	config: HomeyShsLifecycleProbeConfig,
	boundDeviceId: string,
): boolean =>
	Object.hasOwn(devices, boundDeviceId) ||
	Object.values(devices).some(
		(device) => deviceMarkerOf(device) === config.deviceMarker || device.ownerUri === config.expectedOwnerUri,
	);

const observeManagerEvent = async (
	source: EventSource,
	event: string,
	label: string,
	timeoutMs: number,
	predicate: (payload: unknown) => boolean,
	trigger: () => Promise<void> | void,
): Promise<unknown> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let resolveEvent: (payload: unknown) => void = () => undefined;
	const eventPromise = new Promise<unknown>((resolvePromise) => {
		resolveEvent = resolvePromise;
	});
	const listener: EventListener = (payload: unknown): void => {
		if (predicate(payload)) {
			resolveEvent(payload);
		}
	};

	try {
		source.on(event, listener);
	} catch {
		throw new Error(`Homey lifecycle ${label} listener registration failed`);
	}

	const timeoutPromise = new Promise<never>((_resolvePromise, rejectPromise) => {
		timeout = setTimeout(() => rejectPromise(new HomeyShsLifecycleTimeoutError(label, timeoutMs)), timeoutMs);
	});

	const triggerPromise = Promise.resolve().then(async () => {
		try {
			await trigger();
		} catch (error: unknown) {
			if (
				error instanceof HomeyShsLifecycleTimeoutError ||
				(error instanceof Error && error.message.startsWith('Homey lifecycle '))
			) {
				throw error;
			}

			// eslint-disable-next-line preserve-caught-error -- Operator/SDK hook errors may contain private detail.
			throw new Error(`Homey lifecycle ${label} trigger failed`);
		}
	});
	let observationError: unknown;
	let observationFailed = false;
	let listenerRemovalFailed = false;
	let result: unknown;

	try {
		await Promise.race([triggerPromise, timeoutPromise]);
		result = await Promise.race([eventPromise, timeoutPromise]);
	} catch (error: unknown) {
		observationError = error;
		observationFailed = true;
	} finally {
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
		try {
			source.off?.(event, listener);
		} catch {
			listenerRemovalFailed = true;
		}
	}

	if (listenerRemovalFailed) {
		throw new Error(`Homey lifecycle ${label} listener removal failed`);
	}

	if (observationFailed) {
		throw observationError;
	}

	return result;
};

const flowCardReferencesDevice = (card: unknown, deviceUri: string): boolean => {
	if (!isRecord(card) || typeof card.id !== 'string') {
		return false;
	}

	return card.id === deviceUri || card.id.startsWith(`${deviceUri}:`);
};

const standardFlowReferencesDevice = (flow: unknown, deviceUri: string): boolean => {
	if (!isRecord(flow)) {
		return false;
	}

	return (
		flowCardReferencesDevice(flow.trigger, deviceUri) ||
		(Array.isArray(flow.conditions) && flow.conditions.some((card) => flowCardReferencesDevice(card, deviceUri))) ||
		(Array.isArray(flow.actions) && flow.actions.some((card) => flowCardReferencesDevice(card, deviceUri)))
	);
};

const advancedFlowReferencesDevice = (flow: unknown, deviceUri: string): boolean => {
	if (!isRecord(flow) || !isRecord(flow.cards)) {
		return false;
	}

	return Object.values(flow.cards).some(
		(card) =>
			isRecord(card) &&
			typeof card.type === 'string' &&
			['action', 'condition', 'trigger'].includes(card.type) &&
			flowCardReferencesDevice(card, deviceUri),
	);
};

const assertNoAttachedFlows = async (
	client: HomeyLifecycleClient,
	deviceId: string,
	config: HomeyShsLifecycleProbeConfig,
): Promise<void> => {
	const flowResults = await Promise.allSettled([
		runOperation('flow safety read', config.timeoutMs, () =>
			client.flow.getFlows({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
		runOperation('advanced-flow safety read', config.timeoutMs, () =>
			client.flow.getAdvancedFlows({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
	]);

	if (flowResults.some((result) => result.status === 'rejected')) {
		throw new Error('Homey lifecycle flow safety verification failed');
	}

	const [flows, advancedFlows] = flowResults.map((result) => (result.status === 'fulfilled' ? result.value : {}));

	const deviceUri = `homey:device:${deviceId}`;

	if (
		Object.values(flows).some((flow) => standardFlowReferencesDevice(flow, deviceUri)) ||
		Object.values(advancedFlows).some((flow) => advancedFlowReferencesDevice(flow, deviceUri))
	) {
		throw new Error('The disposable Homey lifecycle device is referenced by a flow');
	}
};

const statusCodeOf = (error: unknown): number | null =>
	isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : null;

const proveDeviceWriteScope = async (
	client: HomeyLifecycleClient,
	config: HomeyShsLifecycleProbeConfig,
): Promise<void> => {
	const missingPairSessionId = `fbsp-lifecycle-scope-preflight-${randomBytes(16).toString('hex')}`;

	try {
		await settleOperation('device write-scope preflight', config.timeoutMs, () =>
			client.drivers.getPairSession({ $timeout: config.timeoutMs, id: missingPairSessionId }),
		);
	} catch (error: unknown) {
		if (statusCodeOf(error) === 404) {
			return;
		}

		if (error instanceof HomeyShsLifecycleTimeoutError) {
			throw error;
		}

		// eslint-disable-next-line preserve-caught-error -- API errors can contain endpoint and authorization detail.
		throw new Error('Homey lifecycle device write-scope preflight failed');
	}

	throw new Error('Homey lifecycle device write-scope preflight returned an unexpected pair session');
};

const assertPermissionPreflight = async (
	client: HomeyLifecycleClient,
	config: HomeyShsLifecycleProbeConfig,
): Promise<void> => {
	const results = await Promise.allSettled([
		runOperation('system permission preflight', config.timeoutMs, () =>
			client.system.getInfo({ $timeout: config.timeoutMs }),
		),
		runOperation('device-read permission preflight', config.timeoutMs, () =>
			client.devices.getDevices({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
		runOperation('zone permission preflight', config.timeoutMs, () =>
			client.zones.getZones({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
		runOperation('flow permission preflight', config.timeoutMs, () =>
			client.flow.getFlows({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
		runOperation('advanced-flow permission preflight', config.timeoutMs, () =>
			client.flow.getAdvancedFlows({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
		),
		proveDeviceWriteScope(client, config),
	]);

	if (results.some((result) => result.status === 'rejected')) {
		throw new Error('The dedicated Homey lifecycle key failed the required permission preflight');
	}
};

const deviceIdOf = (payload: unknown): string | null =>
	isRecord(payload) && typeof payload.id === 'string' ? payload.id : null;

const assertZonePreflight = async (
	client: HomeyLifecycleClient,
	config: HomeyShsLifecycleProbeConfig,
): Promise<void> => {
	const zones = await runOperation('zone preflight read', config.timeoutMs, () =>
		client.zones.getZones({ $cache: false, $timeout: config.timeoutMs, $updateCache: false }),
	);

	if (!Object.hasOwn(zones, config.sourceZoneId) || !Object.hasOwn(zones, config.destinationZoneId)) {
		throw new Error('The allowlisted Homey lifecycle zones were not found exactly');
	}
};

export const probeHomeyShsLifecycle = async (
	config: HomeyShsLifecycleProbeConfig,
	factory: HomeyLifecycleSdkFactory = sdkFactory,
	hooks: HomeyLifecycleOperatorHooks = {},
): Promise<HomeyShsLifecycleReport> => {
	const report = {
		lifecycle: {
			addVerified: true,
			availabilityRestored: true,
			finalAbsenceVerified: true,
			flowAbsenceVerified: true,
			removeVerified: true,
			renameVerified: true,
			unavailableVerified: true,
			zoneMoveVerified: true,
		},
		metadata: { probe: 'homey-shs-lifecycle', schemaVersion: 1, sdkVersion: SDK_VERSION },
		session: { cleanupCompleted: true, events: [], managerSubscribed: true },
	} as HomeyShsLifecycleReport;
	const client = await createClient(config, factory);
	appendEvent(report, 'sdk.create.resolved');
	let boundDeviceId: string | undefined;
	let createdDuringRun = false;
	let deletionAuthorized = false;
	let deleteAttempted = false;
	let finalAbsenceVerified = false;
	let operationError: unknown;
	let manualCleanupRequired = false;
	const transportCleanupFailures: string[] = [];

	try {
		await assertPermissionPreflight(client, config);
		await runOperation('manager subscription', config.timeoutMs, () => client.devices.connect());
		appendEvent(report, 'manager.subscribe.resolved');
		await assertZonePreflight(client, config);
		const baseline = await freshDevices(client, config);

		if (Object.values(baseline).some((device) => deviceMarkerOf(device) === config.deviceMarker)) {
			throw new Error('The disposable Homey lifecycle marker already exists at baseline');
		}

		assertDedicatedOwnerIsolation(baseline, config);

		appendEvent(report, 'baseline.absence.verified');
		appendEvent(report, 'add.window.open');
		const createdPayload = await observeManagerEvent(
			client.devices,
			'device.create',
			'operator add observation',
			config.observeMs,
			(payload) => {
				const matches = isRecord(payload) && isInitialDevice(payload as HomeyLifecycleDevice, config);

				if (matches) {
					boundDeviceId = deviceIdOf(payload) ?? undefined;
					manualCleanupRequired = boundDeviceId !== undefined;
				}

				return matches;
			},
			() => hooks.onAddWindowOpen?.(),
		);
		boundDeviceId = deviceIdOf(createdPayload) ?? undefined;
		manualCleanupRequired = boundDeviceId !== undefined;

		if (boundDeviceId === undefined) {
			throw new Error('Homey lifecycle create event did not contain a device identifier');
		}

		appendEvent(report, 'device.create.observed');
		const createdInventory = await freshDevices(client, config);
		const createdDevice = requireSingleOwnedDevice(createdInventory, config, boundDeviceId);
		const boundEventDevice = createdPayload as HomeyLifecycleDevice;

		if (!isInitialDevice(createdDevice, config)) {
			throw new Error('The created Homey lifecycle device failed its fresh identity read-back');
		}

		if (createdDevice.available !== true) {
			throw new Error('The created Homey lifecycle device must initially be available');
		}

		if (typeof boundEventDevice.on !== 'function' || typeof boundEventDevice.off !== 'function') {
			throw new Error('The created Homey lifecycle device does not expose safe update events');
		}

		createdDuringRun = true;
		manualCleanupRequired = false;
		assertDedicatedOwnerIsolation(createdInventory, config, boundDeviceId);
		appendEvent(report, 'add.readback.resolved');
		await assertNoAttachedFlows(client, boundDeviceId, config);
		deletionAuthorized = true;
		appendEvent(report, 'flows.absence.verified');

		await observeManagerEvent(
			boundEventDevice,
			'update',
			'rename event observation',
			config.observeMs,
			(payload) => isRecord(payload) && payload.name === config.renamedName,
			async () => {
				appendEvent(report, 'device.rename.requested');
				await runOperation('device rename', config.timeoutMs, () =>
					client.devices.updateDevice({
						$timeout: config.timeoutMs,
						device: { name: config.renamedName },
						id: boundDeviceId,
					}),
				);
			},
		);
		appendEvent(report, 'device.update.rename.observed');
		const renamedDevice = requireSingleOwnedDevice(await freshDevices(client, config), config, boundDeviceId);

		if (renamedDevice.name !== config.renamedName) {
			throw new Error('Homey lifecycle rename read-back did not match');
		}

		appendEvent(report, 'rename.readback.resolved');

		await observeManagerEvent(
			boundEventDevice,
			'update',
			'zone-move event observation',
			config.observeMs,
			(payload) => isRecord(payload) && payload.zone === config.destinationZoneId,
			async () => {
				appendEvent(report, 'device.zone-move.requested');
				await runOperation('device zone move', config.timeoutMs, () =>
					client.devices.updateDevice({
						$timeout: config.timeoutMs,
						device: { zone: config.destinationZoneId },
						id: boundDeviceId,
					}),
				);
			},
		);
		appendEvent(report, 'device.update.zone-move.observed');
		const movedDevice = requireSingleOwnedDevice(await freshDevices(client, config), config, boundDeviceId);

		if (movedDevice.zone !== config.destinationZoneId) {
			throw new Error('Homey lifecycle zone-move read-back did not match');
		}

		appendEvent(report, 'zone-move.readback.resolved');
		const preUnavailableInventory = await freshDevices(client, config);
		const preUnavailableDevice = requireSingleOwnedDevice(preUnavailableInventory, config, boundDeviceId);
		assertDedicatedOwnerIsolation(preUnavailableInventory, config, boundDeviceId);

		if (preUnavailableDevice.available !== true) {
			throw new Error('The Homey lifecycle device must be available before unavailable observation');
		}

		appendEvent(report, 'availability.unavailable.requested');
		await observeManagerEvent(
			boundEventDevice,
			'update',
			'unavailable event observation',
			config.observeMs,
			(payload) => isRecord(payload) && payload.available === false,
			async () => {
				hooks.onUnavailableRequested?.();

				if (config.availabilityControl === 'test-app-setting') {
					await runOperation('test-app unavailable request', config.timeoutMs, () =>
						client.devices.setDeviceSettings({
							$timeout: config.timeoutMs,
							id: boundDeviceId,
							settings: { [TEST_APP_AVAILABILITY_SETTING_ID]: 'unavailable' },
						}),
					);
				}
			},
		);
		appendEvent(report, 'device.update.unavailable.observed');
		const unavailableInventory = await freshDevices(client, config);
		const unavailableDevice = requireSingleOwnedDevice(unavailableInventory, config, boundDeviceId);
		assertDedicatedOwnerIsolation(unavailableInventory, config, boundDeviceId);

		if (unavailableDevice.available !== false) {
			throw new Error('Homey lifecycle unavailable read-back did not match');
		}

		appendEvent(report, 'unavailable.readback.resolved');
		appendEvent(report, 'availability.restore.requested');
		await observeManagerEvent(
			boundEventDevice,
			'update',
			'availability restoration event observation',
			config.observeMs,
			(payload) => isRecord(payload) && payload.available === true,
			async () => {
				hooks.onAvailabilityRestoreRequested?.();

				if (config.availabilityControl === 'test-app-setting') {
					await runOperation('test-app availability restoration', config.timeoutMs, () =>
						client.devices.setDeviceSettings({
							$timeout: config.timeoutMs,
							id: boundDeviceId,
							settings: { [TEST_APP_AVAILABILITY_SETTING_ID]: 'available' },
						}),
					);
				}
			},
		);
		appendEvent(report, 'device.update.available.observed');
		const availableInventory = await freshDevices(client, config);
		const availableDevice = requireSingleOwnedDevice(availableInventory, config, boundDeviceId);
		assertDedicatedOwnerIsolation(availableInventory, config, boundDeviceId);

		if (availableDevice.available !== true) {
			throw new Error('Homey lifecycle availability restoration read-back did not match');
		}

		appendEvent(report, 'availability.readback.resolved');
		deletionAuthorized = false;
		await assertNoAttachedFlows(client, boundDeviceId, config);
		deletionAuthorized = true;
		appendEvent(report, 'device.remove.requested');
		deleteAttempted = true;
		await observeManagerEvent(
			client.devices,
			'device.delete',
			'delete event observation',
			config.observeMs,
			(payload) => deviceIdOf(payload) === boundDeviceId,
			async () => {
				await runOperation('device removal', config.timeoutMs, () =>
					client.devices.deleteDevice({ $timeout: config.timeoutMs, id: boundDeviceId }),
				);
			},
		);
		appendEvent(report, 'device.delete.observed');

		if (hasLifecycleResidue(await freshDevices(client, config), config, boundDeviceId)) {
			throw new Error('The disposable Homey lifecycle device still exists after removal');
		}

		finalAbsenceVerified = true;
		appendEvent(report, 'final.absence.verified');
	} catch (error: unknown) {
		operationError = error;
	} finally {
		if (createdDuringRun && !finalAbsenceVerified && boundDeviceId !== undefined) {
			try {
				const currentDevices = await freshDevices(client, config);

				if (!hasLifecycleResidue(currentDevices, config, boundDeviceId)) {
					finalAbsenceVerified = true;
				} else if (deletionAuthorized && !deleteAttempted) {
					const cleanupDevice = requireSingleOwnedDevice(currentDevices, config, boundDeviceId);
					assertDedicatedOwnerIsolation(currentDevices, config, boundDeviceId);

					if (cleanupDevice.available === true) {
						await assertNoAttachedFlows(client, boundDeviceId, config);
						deleteAttempted = true;
						await runOperation('failure cleanup removal', config.timeoutMs, () =>
							client.devices.deleteDevice({ $timeout: config.timeoutMs, id: boundDeviceId }),
						);
						finalAbsenceVerified = !hasLifecycleResidue(await freshDevices(client, config), config, boundDeviceId);
					}
				}
			} catch {
				finalAbsenceVerified = false;
			}

			manualCleanupRequired ||= !finalAbsenceVerified;
		}

		try {
			await runOperation('manager unsubscribe', config.timeoutMs, () => client.devices.disconnect());
			if (operationError === undefined) appendEvent(report, 'manager.unsubscribe.resolved');
		} catch {
			transportCleanupFailures.push('manager unsubscribe');
		}

		try {
			await runOperation('socket disconnect', config.timeoutMs, () => client.disconnect());
			if (operationError === undefined) appendEvent(report, 'socket.disconnect.resolved');
		} catch {
			transportCleanupFailures.push('socket disconnect');
		}

		try {
			client.destroy();
			if (operationError === undefined) appendEvent(report, 'sdk.destroyed');
		} catch {
			transportCleanupFailures.push('client destroy');
		}
	}

	if (manualCleanupRequired) {
		throw new Error('Homey lifecycle failed; manual disposable-device cleanup required');
	}

	if (transportCleanupFailures.length > 0) {
		throw new Error('Homey lifecycle transport cleanup failed');
	}

	if (operationError !== undefined) {
		throw operationError;
	}

	return report;
};

/** Validates every persisted key, scalar, and event before lifecycle evidence is accepted. */
export function assertHomeyShsLifecycleReportSchema(value: unknown): asserts value is HomeyShsLifecycleReport {
	const report = requireExactKeys(value, ['lifecycle', 'metadata', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion', 'sdkVersion'], 'metadata');
	const lifecycle = requireExactKeys(
		report.lifecycle,
		[
			'addVerified',
			'availabilityRestored',
			'finalAbsenceVerified',
			'flowAbsenceVerified',
			'removeVerified',
			'renameVerified',
			'unavailableVerified',
			'zoneMoveVerified',
		],
		'lifecycle',
	);
	const session = requireExactKeys(report.session, ['cleanupCompleted', 'events', 'managerSubscribed'], 'session');

	if (metadata.probe !== 'homey-shs-lifecycle' || metadata.schemaVersion !== 1 || metadata.sdkVersion !== SDK_VERSION) {
		throw new Error('Homey lifecycle report metadata schema is invalid');
	}

	if (Object.values(lifecycle).some((result) => result !== true)) {
		throw new Error('Homey lifecycle report result schema is invalid');
	}

	if (session.cleanupCompleted !== true || session.managerSubscribed !== true || !Array.isArray(session.events)) {
		throw new Error('Homey lifecycle report session schema is invalid');
	}

	if (session.events.length !== EXPECTED_EVENTS.length) {
		throw new Error('Homey lifecycle report event schema is invalid');
	}

	for (const [index, eventValue] of session.events.entries()) {
		const event = requireExactKeys(eventValue, ['event', 'order'], 'event');

		if (event.event !== EXPECTED_EVENTS[index] || event.order !== index + 1) {
			throw new Error('Homey lifecycle report event schema is invalid');
		}
	}
}

export function assertHomeyShsLifecycleReportSafe(
	value: unknown,
	config: HomeyShsLifecycleProbeConfig,
): asserts value is HomeyShsLifecycleReport {
	assertHomeyShsLifecycleReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenValues = [
		config.apiKey,
		config.expectedHost,
		config.deviceMarker,
		config.expectedDriverId,
		config.expectedOwnerUri,
		config.initialName,
		config.renamedName,
		config.sourceZoneId,
		config.destinationZoneId,
		...config.privateTerms,
	]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (forbiddenValues.some((item) => serialized.includes(item))) {
		throw new Error('Sanitized Homey lifecycle report contains a configured secret or private value');
	}

	if (
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized) ||
		/(?:[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}|[0-9a-f]{4}(?:\.[0-9a-f]{4}){2})/i.test(serialized)
	) {
		throw new Error('Sanitized Homey lifecycle report contains an address, email, or URL');
	}
}

export const writeHomeyShsLifecycleReport = async (
	report: HomeyShsLifecycleReport,
	outputRoot: string,
): Promise<string> => {
	assertHomeyShsLifecycleReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `lifecycle-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsLifecycleProbeConfig(process.env);
	const report = await probeHomeyShsLifecycle(config, sdkFactory, {
		onAddWindowOpen: () => {
			process.stdout.write(
				'Homey lifecycle add window is open. Add only the allowlisted disposable test device now.\n',
			);
		},
		onAvailabilityRestoreRequested: () => {
			process.stdout.write(
				'Homey lifecycle availability restoration window is open. Restore only the bound test device now.\n',
			);
		},
		onUnavailableRequested: () => {
			process.stdout.write(
				'Homey lifecycle unavailable window is open. Make only the bound disposable test device unavailable now.\n',
			);
		},
	});

	assertHomeyShsLifecycleReportSafe(report, config);
	const outputDirectory = await writeHomeyShsLifecycleReport(report, config.outputRoot);

	process.stdout.write(`Sanitized Homey lifecycle report written to ${outputDirectory}.\n`);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS lifecycle probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
