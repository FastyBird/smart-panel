import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyLifecycleSdkFactory,
	type HomeyShsLifecycleProbeConfig,
	type HomeyShsLifecycleReport,
	assertHomeyShsLifecycleReportSafe,
	assertHomeyShsLifecycleReportSchema,
	loadHomeyShsLifecycleProbeConfig,
	probeHomeyShsLifecycle,
	writeHomeyShsLifecycleReport,
} from './support/homey-shs-lifecycle-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID: 'destination-zone-that-must-not-leak',
	FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER: 'fbsp-lifecycle-test-marker-that-must-not-leak',
	FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID: 'homey:app:test-owner-that-must-not-leak:driver:test-driver-that-must-not-leak',
	FB_HOMEY_SHS_LIFECYCLE_ENABLE: 'I_ACKNOWLEDGE_THIS_MUTATES_A_DISPOSABLE_DEVICE',
	FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME: 'FBSP Lifecycle Initial Private Name',
	FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS: '10000',
	FB_HOMEY_SHS_LIFECYCLE_OPERATIONS: 'add,rename,zone-move,availability,remove',
	FB_HOMEY_SHS_LIFECYCLE_OWNER_URI: 'homey:app:test-owner-that-must-not-leak',
	FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME: 'FBSP Lifecycle Renamed Private Name',
	FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID: 'source-zone-that-must-not-leak',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const COMPLETE_EVENTS = [
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

const REQUIRED_SCOPES = [
	'homey.device',
	'homey.device.readonly',
	'homey.flow.readonly',
	'homey.system.readonly',
	'homey.zone.readonly',
] as const;

const completeReport = (): HomeyShsLifecycleReport => ({
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
	metadata: { probe: 'homey-shs-lifecycle', schemaVersion: 1, sdkVersion: '3.19.2' },
	session: {
		cleanupCompleted: true,
		events: COMPLETE_EVENTS.map((event, index) => ({ event, order: index + 1 })),
		managerSubscribed: true,
	},
});

type FakeDevice = EventEmitter &
	Record<string, unknown> & {
		available: boolean;
		data: { id: string };
		driverId: string;
		id: string;
		name: string;
		ownerUri: string;
		zone: string;
	};

class FakeLifecycleFlowManager {
	advancedFlows: Record<string, unknown> = {};
	readonly advancedFlowReadOptions: Array<{ $cache?: boolean; $timeout?: number; $updateCache?: boolean }> = [];
	failFlowRead = false;
	flows: Record<string, unknown> = {};
	readonly flowReadOptions: Array<{ $cache?: boolean; $timeout?: number; $updateCache?: boolean }> = [];
	hangAdvancedFlowRead = false;

	getAdvancedFlows(
		options: { $cache?: boolean; $timeout?: number; $updateCache?: boolean } = {},
	): Promise<Record<string, unknown>> {
		this.advancedFlowReadOptions.push(options);

		if (this.hangAdvancedFlowRead) {
			return new Promise((_resolvePromise) => undefined);
		}

		return Promise.resolve({ ...this.advancedFlows });
	}

	getFlows(
		options: { $cache?: boolean; $timeout?: number; $updateCache?: boolean } = {},
	): Promise<Record<string, unknown>> {
		this.flowReadOptions.push(options);

		return this.failFlowRead
			? Promise.reject(new Error('raw private flow failure'))
			: Promise.resolve({ ...this.flows });
	}
}

class FakeLifecycleDevicesManager extends EventEmitter {
	connectCount = 0;
	deleteRequests: Array<{ $timeout?: number; id: string }> = [];
	disconnectCount = 0;
	failDisconnect = false;
	inventory: Record<string, FakeDevice> = {};
	inventoryReadHook?: (readCount: number) => void;
	readonly inventoryReadOptions: Array<{ $cache?: boolean; $timeout?: number; $updateCache?: boolean }> = [];
	updateRequests: Array<{ $timeout?: number; device: { name?: string; zone?: string }; id: string }> = [];

	connect(): Promise<void> {
		this.connectCount += 1;

		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;

		return this.failDisconnect ? Promise.reject(new Error('raw private manager cleanup detail')) : Promise.resolve();
	}

	getDevices(
		options: { $cache?: boolean; $timeout?: number; $updateCache?: boolean } = {},
	): Promise<Record<string, FakeDevice>> {
		this.inventoryReadOptions.push(options);
		this.inventoryReadHook?.(this.inventoryReadOptions.length);

		return Promise.resolve({ ...this.inventory });
	}

	updateDevice(options: { $timeout?: number; device: { name?: string; zone?: string }; id: string }): Promise<unknown> {
		this.updateRequests.push(options);
		const device = this.inventory[options.id];

		if (device === undefined) {
			return Promise.reject(new Error('raw missing-device detail'));
		}

		Object.assign(device, options.device);
		device.emit('update', { ...options.device });
		this.emit('device.update', { ...device, id: 'wrong-device-id' });
		this.emit('device.update', { ...device });

		return Promise.resolve(device);
	}

	deleteDevice(options: { $timeout?: number; id: string }): Promise<unknown> {
		this.deleteRequests.push(options);
		const existing = this.inventory[options.id];

		if (existing !== undefined) {
			delete this.inventory[options.id];
			this.emit('device.delete', { id: 'wrong-device-id' });
			this.emit('device.delete', { id: options.id });
		}

		return Promise.resolve();
	}
}

class FakeLifecycleClient {
	destroyCount = 0;
	disconnectCount = 0;
	failDestroy = false;
	failDisconnect = false;
	readonly devices = new FakeLifecycleDevicesManager();
	readonly flow = new FakeLifecycleFlowManager();
	readonly scopes = new Set<string>(REQUIRED_SCOPES);
	readonly zones: {
		getZones(options?: {
			$cache?: boolean;
			$timeout?: number;
			$updateCache?: boolean;
		}): Promise<Record<string, unknown>>;
	};

	constructor(config: HomeyShsLifecycleProbeConfig) {
		this.zones = {
			getZones: () =>
				Promise.resolve({
					[config.destinationZoneId]: {},
					[config.sourceZoneId]: {},
				}),
		};
	}

	destroy(): void {
		this.destroyCount += 1;
		this.devices.removeAllListeners();

		if (this.failDestroy) {
			throw new Error('raw private destroy detail');
		}
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;

		return this.failDisconnect ? Promise.reject(new Error('raw private socket cleanup detail')) : Promise.resolve();
	}

	hasScope(scope: string): boolean {
		return this.scopes.has(scope);
	}
}

const fastConfig = (overrides: Partial<HomeyShsLifecycleProbeConfig> = {}): HomeyShsLifecycleProbeConfig => ({
	...loadHomeyShsLifecycleProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-lifecycle-spike'),
	observeMs: 25,
	timeoutMs: 25,
	...overrides,
});

const makeOwnedDevice = (
	config: HomeyShsLifecycleProbeConfig,
	id: string,
	overrides: Partial<FakeDevice> = {},
): FakeDevice =>
	Object.assign(new EventEmitter(), {
		available: true,
		data: { id: config.deviceMarker },
		driverId: config.expectedDriverId,
		id,
		name: config.initialName,
		ownerUri: config.expectedOwnerUri,
		zone: config.sourceZoneId,
		...overrides,
	}) as FakeDevice;

const createHarness = (
	config: HomeyShsLifecycleProbeConfig,
): {
	client: FakeLifecycleClient;
	factory: HomeyLifecycleSdkFactory;
	requests: Array<{ address: string; token: string }>;
} => {
	const client = new FakeLifecycleClient(config);
	const requests: Array<{ address: string; token: string }> = [];
	const factory: HomeyLifecycleSdkFactory = {
		createLocalApi: ({ address, token }) => {
			requests.push({ address, token });

			return Promise.resolve(client);
		},
	};

	return { client, factory, requests };
};

describe('Homey SHS disposable-device lifecycle compatibility probe', () => {
	it('requires the exact lifecycle acknowledgement and canonical operation list', () => {
		for (const enable of [undefined, '', 'yes', 'I_ACKNOWLEDGE_THIS_MUTATES_A_DISPOSABLE_DEVICE ']) {
			expect(() =>
				loadHomeyShsLifecycleProbeConfig({
					...BASE_ENVIRONMENT,
					FB_HOMEY_SHS_LIFECYCLE_ENABLE: enable,
				}),
			).toThrow('required acknowledgement');
		}

		for (const operations of [
			undefined,
			'',
			'add,rename,zone-move,availability',
			'rename,add,zone-move,availability,remove',
			'add,rename,zone-move,availability,remove,remove',
			'add, rename,zone-move,availability,remove',
		]) {
			expect(() =>
				loadHomeyShsLifecycleProbeConfig({
					...BASE_ENVIRONMENT,
					FB_HOMEY_SHS_LIFECYCLE_OPERATIONS: operations,
				}),
			).toThrow('must exactly list add,rename,zone-move,availability,remove');
		}
	});

	it('refuses conflicting mutation, recovery, and credential-rotation gates even when empty', () => {
		for (const name of [
			'FB_HOMEY_SHS_WRITE_ENABLE',
			'FB_HOMEY_SHS_RECOVERY_ENABLE',
			'FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE',
		]) {
			expect(() => loadHomeyShsLifecycleProbeConfig({ ...BASE_ENVIRONMENT, [name]: '' })).toThrow(
				'gates must be unset during the lifecycle probe',
			);
		}
	});

	it('rejects incomplete or unsafe allowlist values', () => {
		for (const name of [
			'FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER',
			'FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID',
			'FB_HOMEY_SHS_LIFECYCLE_OWNER_URI',
			'FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME',
			'FB_HOMEY_SHS_LIFECYCLE_RENAMED_NAME',
			'FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID',
			'FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID',
		]) {
			expect(() => loadHomeyShsLifecycleProbeConfig({ ...BASE_ENVIRONMENT, [name]: '' })).toThrow();
		}

		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_DEVICE_MARKER: 'ordinary-device',
			}),
		).toThrow('specific synthetic fbsp-lifecycle-* marker');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_INITIAL_NAME: 'Ordinary Device',
			}),
		).toThrow('synthetic FBSP Lifecycle prefix');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID: 'homey:app:another-owner:driver:test-driver',
			}),
		).toThrow('must belong to the dedicated Homey test app');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_OWNER_URI: 'homey:app:x',
			}),
		).toThrow('must identify the dedicated Homey test app');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_DRIVER_ID: `${BASE_ENVIRONMENT.FB_HOMEY_SHS_LIFECYCLE_OWNER_URI}:driver:`,
			}),
		).toThrow('must belong to the dedicated Homey test app');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_DESTINATION_ZONE_ID: BASE_ENVIRONMENT.FB_HOMEY_SHS_LIFECYCLE_SOURCE_ZONE_ID,
			}),
		).toThrow('must differ');
	});

	it('loads the bounded lifecycle configuration through the shared endpoint contract', () => {
		const config = loadHomeyShsLifecycleProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-lifecycle-spike');

		expect(config).toMatchObject({
			apiKey: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY,
			expectedHost: '127.0.0.1',
			observeMs: 10_000,
			outputRoot: '/tmp/homey-lifecycle-spike/test/.homey-shs-captures',
			timeoutMs: 1000,
		});
		expect(config.origin.origin).toBe('http://127.0.0.1:4859');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS: '9999' }),
		).toThrow('between 10000 and 300000');
		expect(() =>
			loadHomeyShsLifecycleProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_LIFECYCLE_OBSERVE_MS: '300001' }),
		).toThrow('between 10000 and 300000');
	});

	it.each(REQUIRED_SCOPES)('refuses a key missing %s before opening the add window', async (scope) => {
		const config = fastConfig();
		const harness = createHarness(config);
		let addWindowCount = 0;

		harness.client.scopes.delete(scope);

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					addWindowCount += 1;
				},
			}),
		).rejects.toThrow('dedicated Homey lifecycle key is missing a required scope');
		expect(addWindowCount).toBe(0);
		expect(harness.client.devices.connectCount).toBe(0);
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
	});

	it('sanitizes scope-preflight failures before any lifecycle action', async () => {
		const config = fastConfig();
		const harness = createHarness(config);

		jest.spyOn(harness.client, 'hasScope').mockImplementation(() => {
			throw new Error('raw private scope detail');
		});

		await expect(probeHomeyShsLifecycle(config, harness.factory)).rejects.toThrow(
			'dedicated Homey lifecycle key is missing a required scope',
		);
		expect(harness.client.devices.connectCount).toBe(0);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
	});

	it('verifies the full lifecycle in exact order while ignoring wrong and early events', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const deviceId = 'runtime-bound-disposable-id';
		const device = makeOwnedDevice(config, deviceId);
		const hooksCalled: string[] = [];
		const report = await probeHomeyShsLifecycle(config, harness.factory, {
			onAddWindowOpen: () => {
				hooksCalled.push('add');
				harness.client.devices.emit('device.create', {
					...device,
					data: { id: 'fbsp-lifecycle-wrong-marker' },
				});
				// This matching availability event is deliberately too early to satisfy the later stage.
				device.emit('update', { available: false });
				harness.client.devices.inventory[deviceId] = device;
				harness.client.devices.emit('device.create', device);
			},
			onAvailabilityRestoreRequested: () => {
				hooksCalled.push('available');
				device.emit('update', { available: false });
				device.available = true;
				device.emit('update', { available: true });
			},
			onUnavailableRequested: () => {
				hooksCalled.push('unavailable');
				device.emit('update', { available: true });
				device.available = false;
				device.emit('update', { available: false });
			},
		});

		expect(report).toStrictEqual(completeReport());
		expect(hooksCalled).toStrictEqual(['add', 'unavailable', 'available']);
		expect(harness.requests).toStrictEqual([
			{ address: 'http://127.0.0.1:4859', token: 'test-api-key-that-must-not-leak' },
		]);
		expect(harness.client.devices.updateRequests).toStrictEqual([
			{ $timeout: 25, device: { name: config.renamedName }, id: deviceId },
			{ $timeout: 25, device: { zone: config.destinationZoneId }, id: deviceId },
		]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([{ $timeout: 25, id: deviceId }]);
		expect(harness.client.devices.inventory).toStrictEqual({});
		expect(harness.client.devices.inventoryReadOptions).not.toHaveLength(0);
		expect(harness.client.devices.inventoryReadOptions).toEqual(
			harness.client.devices.inventoryReadOptions.map(() => ({
				$cache: false,
				$timeout: 25,
				$updateCache: false,
			})),
		);
		expect(harness.client.flow.flowReadOptions).toStrictEqual([
			{ $cache: false, $timeout: 25, $updateCache: false },
			{ $cache: false, $timeout: 25, $updateCache: false },
		]);
		expect(harness.client.flow.advancedFlowReadOptions).toStrictEqual([
			{ $cache: false, $timeout: 25, $updateCache: false },
			{ $cache: false, $timeout: 25, $updateCache: false },
		]);
		expect(harness.client.devices.disconnectCount).toBe(1);
		expect(harness.client.disconnectCount).toBe(1);
		expect(harness.client.destroyCount).toBe(1);
		expect(() => assertHomeyShsLifecycleReportSafe(report, config)).not.toThrow();
		expect(JSON.stringify(report)).not.toContain(deviceId);
	});

	it('requires a newly bound device to start available and leaves it for manual cleanup otherwise', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId, { available: false });

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
	});

	it('freshly rechecks availability before asking the operator to make the device unavailable', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);
		let unavailableRequestCount = 0;

		harness.client.devices.inventoryReadHook = (readCount) => {
			if (readCount === 5) {
				owned.available = false;
			}
		};

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
				onUnavailableRequested: () => {
					unavailableRequestCount += 1;
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(unavailableRequestCount).toBe(0);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
	});

	it('does not mistake an aggregate manager update for the rename delta', async () => {
		const config = fastConfig({ observeMs: 5 });
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);

		jest.spyOn(harness.client.devices, 'updateDevice').mockImplementation((options) => {
			harness.client.devices.updateRequests.push(options);
			Object.assign(owned, options.device);
			harness.client.devices.emit('device.update', { ...owned });

			return Promise.resolve(owned);
		});

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('rename event observation timed out after 5 ms');
		expect(harness.client.devices.deleteRequests).toStrictEqual([{ $timeout: 25, id: ownedId }]);
	});

	it('refuses a marker that exists at baseline and never opens the add window or deletes it', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const baselineId = 'preexisting-device-id';
		let addWindowCount = 0;

		harness.client.devices.inventory[baselineId] = makeOwnedDevice(config, baselineId);

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					addWindowCount += 1;
				},
			}),
		).rejects.toThrow('marker already exists at baseline');
		expect(addWindowCount).toBe(0);
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[baselineId]).toBeDefined();
		expect(harness.client.devices.disconnectCount).toBe(1);
		expect(harness.client.disconnectCount).toBe(1);
		expect(harness.client.destroyCount).toBe(1);
	});

	it('refuses a lifecycle app that already owns another device', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const siblingId = 'preexisting-sibling-device-id';

		harness.client.devices.inventory[siblingId] = makeOwnedDevice(config, siblingId, {
			data: { id: 'fbsp-lifecycle-different-marker' },
			name: 'FBSP Lifecycle Existing Sibling',
		});

		await expect(probeHomeyShsLifecycle(config, harness.factory)).rejects.toThrow(
			'dedicated Homey lifecycle app is not isolated',
		);
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[siblingId]).toBeDefined();
	});

	it('requires both allowlisted zones to be own inventory entries', async () => {
		const config = fastConfig({ sourceZoneId: 'toString' });
		const harness = createHarness(config);
		jest.spyOn(harness.client.zones, 'getZones').mockResolvedValue({});

		await expect(probeHomeyShsLifecycle(config, harness.factory)).rejects.toThrow(
			'allowlisted Homey lifecycle zones were not found exactly',
		);
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
	});

	it('does not let wrong create events satisfy the add stage and never deletes an unbound device', async () => {
		const config = fastConfig({ observeMs: 5 });
		const harness = createHarness(config);
		const unrelatedId = 'ordinary-device-id';
		const unrelated = makeOwnedDevice(config, unrelatedId, {
			data: { id: 'fbsp-lifecycle-unrelated-marker' },
			driverId: 'homey:app:ordinary-owner:driver:ordinary-driver',
			name: 'Ordinary Device',
			ownerUri: 'homey:app:ordinary-owner',
		});

		harness.client.devices.inventory[unrelatedId] = unrelated;

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.emit('device.create', unrelated);
				},
			}),
		).rejects.toThrow('operator add observation timed out after 5 ms');
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[unrelatedId]).toBe(unrelated);
	});

	it('attempts every transport cleanup step and returns only a fixed cleanup error', async () => {
		const config = fastConfig({ observeMs: 5 });
		const harness = createHarness(config);

		harness.client.devices.failDisconnect = true;
		harness.client.failDisconnect = true;
		harness.client.failDestroy = true;

		await expect(probeHomeyShsLifecycle(config, harness.factory)).rejects.toThrow(
			'Homey lifecycle transport cleanup failed',
		);
		expect(harness.client.devices.disconnectCount).toBe(1);
		expect(harness.client.disconnectCount).toBe(1);
		expect(harness.client.destroyCount).toBe(1);
	});

	it('destroys a client that resolves after the bounded creation timeout', async () => {
		jest.useFakeTimers();

		try {
			const config = fastConfig({ timeoutMs: 5 });
			const lateClient = new FakeLifecycleClient(config);
			const factory: HomeyLifecycleSdkFactory = {
				createLocalApi: () =>
					new Promise((resolvePromise) => {
						setTimeout(() => resolvePromise(lateClient), 10);
					}),
			};
			const probePromise = probeHomeyShsLifecycle(config, factory);
			const rejection = expect(probePromise).rejects.toThrow('Homey lifecycle client creation timed out after 5 ms');

			await jest.advanceTimersByTimeAsync(5);
			await rejection;
			await jest.advanceTimersByTimeAsync(5);
			expect(lateClient.destroyCount).toBe(1);
			expect(lateClient.devices.connectCount).toBe(0);
		} finally {
			jest.useRealTimers();
		}
	});

	it('sanitizes listener registration and operator hook failures', async () => {
		const config = fastConfig();
		const registrationHarness = createHarness(config);
		jest.spyOn(registrationHarness.client.devices, 'on').mockImplementation(() => {
			throw new Error('raw private listener registration detail');
		});

		await expect(probeHomeyShsLifecycle(config, registrationHarness.factory)).rejects.toThrow(
			'Homey lifecycle operator add observation listener registration failed',
		);

		const hookHarness = createHarness(config);

		await expect(
			probeHomeyShsLifecycle(config, hookHarness.factory, {
				onAddWindowOpen: () => {
					throw new Error('raw private operator hook detail');
				},
			}),
		).rejects.toThrow('Homey lifecycle operator add observation trigger failed');
	});

	it('turns listener removal failure after create into a manual-cleanup warning', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);
		jest.spyOn(harness.client.devices, 'off').mockImplementation(() => {
			throw new Error('raw private listener removal detail');
		});

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
	});

	it('settles both flow checks and never auto-deletes when flow permission cannot be verified', async () => {
		const config = fastConfig({ timeoutMs: 5 });
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const unrelatedId = 'unrelated-device-id';
		const owned = makeOwnedDevice(config, ownedId);
		const unrelated = makeOwnedDevice(config, unrelatedId, {
			data: { id: 'fbsp-lifecycle-unrelated-marker' },
			driverId: 'homey:app:ordinary-owner:driver:ordinary-driver',
			name: 'Ordinary Device',
			ownerUri: 'homey:app:ordinary-owner',
		});

		harness.client.devices.inventory[unrelatedId] = unrelated;
		harness.client.flow.failFlowRead = true;
		harness.client.flow.hangAdvancedFlowRead = true;

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.flow.flowReadOptions).toStrictEqual([{ $cache: false, $timeout: 5, $updateCache: false }]);
		expect(harness.client.flow.advancedFlowReadOptions).toStrictEqual([
			{ $cache: false, $timeout: 5, $updateCache: false },
		]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
		expect(harness.client.devices.inventory[unrelatedId]).toBe(unrelated);
	});

	it.each([
		{
			attach: (client: FakeLifecycleClient, deviceId: string): void => {
				client.flow.flows['attached-standard-flow'] = {
					actions: [{ id: `homey:device:${deviceId}:action` }],
				};
			},
			label: 'standard flow',
		},
		{
			attach: (client: FakeLifecycleClient, deviceId: string): void => {
				client.flow.advancedFlows['attached-advanced-flow'] = {
					cards: {
						'action-card': { id: `homey:device:${deviceId}:action`, type: 'action' },
					},
				};
			},
			label: 'advanced flow',
		},
	])('refuses to mutate or auto-delete a device referenced by a $label', async ({ attach }) => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);

		attach(harness.client, ownedId);

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
	});

	it('ignores unrelated standard and advanced flows', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);

		harness.client.flow.flows['unrelated-standard-flow'] = {
			actions: [{ id: 'homey:device:unrelated-device-id:action' }],
		};
		harness.client.flow.advancedFlows['unrelated-advanced-flow'] = {
			cards: {
				'action-card': { id: 'homey:device:unrelated-device-id:action', type: 'action' },
			},
		};

		const report = await probeHomeyShsLifecycle(config, harness.factory, {
			onAddWindowOpen: () => {
				harness.client.devices.inventory[ownedId] = owned;
				harness.client.devices.emit('device.create', owned);
			},
			onAvailabilityRestoreRequested: () => {
				owned.available = true;
				owned.emit('update', { available: true });
			},
			onUnavailableRequested: () => {
				owned.available = false;
				owned.emit('update', { available: false });
			},
		});

		expect(report).toStrictEqual(completeReport());
		expect(harness.client.devices.deleteRequests).toStrictEqual([{ $timeout: 25, id: ownedId }]);
	});

	it('failure cleanup deletes only the exact run-owned device after flow safety is verified', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const unrelatedId = 'unrelated-device-id';
		const owned = makeOwnedDevice(config, ownedId);
		const unrelated = makeOwnedDevice(config, unrelatedId, {
			data: { id: 'fbsp-lifecycle-unrelated-marker' },
			driverId: 'homey:app:ordinary-owner:driver:ordinary-driver',
			name: 'Ordinary Device',
			ownerUri: 'homey:app:ordinary-owner',
		});

		harness.client.devices.inventory[unrelatedId] = unrelated;
		jest.spyOn(harness.client.devices, 'updateDevice').mockRejectedValue(new Error('raw private update failure'));

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
			}),
		).rejects.toThrow('Homey lifecycle device rename failed');
		expect(harness.client.devices.deleteRequests).toStrictEqual([{ $timeout: 25, id: ownedId }]);
		expect(harness.client.devices.inventory[ownedId]).toBeUndefined();
		expect(harness.client.devices.inventory[unrelatedId]).toBe(unrelated);
	});

	it.each([
		{
			label: 'a newly attached flow',
			mutate: (device: FakeDevice, client: FakeLifecycleClient): void => {
				client.flow.flows['late-flow'] = {
					actions: [{ id: `homey:device:${device.id}:action` }],
				};
			},
		},
		{
			label: 'ownership drift',
			mutate: (device: FakeDevice, _client: FakeLifecycleClient): void => {
				device.driverId = 'homey:app:unexpected-owner:driver:unexpected-driver';
			},
		},
	])('does not use stale cleanup authorization after $label', async ({ mutate }) => {
		const config = fastConfig({ observeMs: 5 });
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
				onUnavailableRequested: () => {
					mutate(owned, harness.client);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.inventory[ownedId]).toBe(owned);
	});

	it('does not report final absence when the lifecycle identity reappears under another id', async () => {
		const config = fastConfig();
		const harness = createHarness(config);
		const ownedId = 'freshly-owned-device-id';
		const recreatedId = 'recreated-owned-device-id';
		const owned = makeOwnedDevice(config, ownedId);

		jest.spyOn(harness.client.devices, 'deleteDevice').mockImplementation((options) => {
			harness.client.devices.deleteRequests.push(options);
			delete harness.client.devices.inventory[options.id];
			harness.client.devices.emit('device.delete', { id: options.id });
			harness.client.devices.inventory[recreatedId] = makeOwnedDevice(config, recreatedId);

			return Promise.resolve();
		});

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					harness.client.devices.inventory[ownedId] = owned;
					harness.client.devices.emit('device.create', owned);
				},
				onAvailabilityRestoreRequested: () => {
					owned.available = true;
					owned.emit('update', { available: true });
				},
				onUnavailableRequested: () => {
					owned.available = false;
					owned.emit('update', { available: false });
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.deleteRequests).toStrictEqual([{ $timeout: 25, id: ownedId }]);
		expect(harness.client.devices.inventory[recreatedId]).toBeDefined();
	});

	it.each([
		{
			label: 'ambiguous',
			populate: (manager: FakeLifecycleDevicesManager, config: HomeyShsLifecycleProbeConfig, device: FakeDevice) => {
				manager.inventory[device.id] = device;
				manager.inventory['second-owned-device-id'] = makeOwnedDevice(config, 'second-owned-device-id');
			},
		},
		{
			label: 'unverified',
			populate: (manager: FakeLifecycleDevicesManager, config: HomeyShsLifecycleProbeConfig, device: FakeDevice) => {
				manager.inventory[device.id] = makeOwnedDevice(config, device.id, { driverId: 'unexpected-driver' });
			},
		},
	])('never auto-deletes after $label ownership read-back', async ({ populate }) => {
		const config = fastConfig();
		const harness = createHarness(config);
		const device = makeOwnedDevice(config, 'candidate-device-id');

		await expect(
			probeHomeyShsLifecycle(config, harness.factory, {
				onAddWindowOpen: () => {
					populate(harness.client.devices, config, device);
					harness.client.devices.emit('device.create', device);
				},
			}),
		).rejects.toThrow('manual disposable-device cleanup required');
		expect(harness.client.devices.deleteRequests).toStrictEqual([]);
		expect(harness.client.devices.updateRequests).toStrictEqual([]);
	});

	it('rejects extra fields, invalid state, unsafe values, and unordered evidence', () => {
		const config = loadHomeyShsLifecycleProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-lifecycle-spike');
		const extra = completeReport() as unknown as Record<string, unknown>;
		extra.rawPayload = 'private-payload';

		expect(() => assertHomeyShsLifecycleReportSchema(extra)).toThrow('root schema is invalid');

		const invalidState = completeReport();
		(invalidState.lifecycle as unknown as Record<string, unknown>).renameVerified = 'true';

		expect(() => assertHomeyShsLifecycleReportSchema(invalidState)).toThrow('result schema is invalid');

		const incomplete = completeReport();
		(incomplete.lifecycle as unknown as Record<string, unknown>).finalAbsenceVerified = false;

		expect(() => assertHomeyShsLifecycleReportSafe(incomplete, config)).toThrow('result schema is invalid');

		const unordered = completeReport();
		[unordered.session.events[3], unordered.session.events[4]] = [
			unordered.session.events[4],
			unordered.session.events[3],
		];

		expect(() => assertHomeyShsLifecycleReportSafe(unordered, config)).toThrow();

		expect(() => assertHomeyShsLifecycleReportSafe(completeReport(), { ...config, privateTerms: ['rename'] })).toThrow(
			'configured secret or private value',
		);
	});

	it('writes a new restrictive, schema-validated report directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'homey-lifecycle-spike-'));
		const report = completeReport();

		try {
			const outputDirectory = await writeHomeyShsLifecycleReport(report, root);
			const outputStat = await stat(outputDirectory);
			const reportStat = await stat(join(outputDirectory, 'report.json'));
			const written = JSON.parse(await readFile(join(outputDirectory, 'report.json'), 'utf8')) as unknown;

			expect(outputStat.mode & 0o777).toBe(0o700);
			expect(reportStat.mode & 0o777).toBe(0o600);
			expect(written).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
