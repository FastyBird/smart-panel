import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyRecoverySdkFactory,
	type HomeyShsRecoveryProbeConfig,
	type HomeyShsRecoveryReport,
	assertHomeyShsRecoveryReportSafe,
	assertHomeyShsRecoveryReportSchema,
	loadHomeyShsRecoveryProbeConfig,
	probeHomeyShsRecovery,
	writeHomeyShsRecoveryReport,
} from './support/homey-shs-recovery-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_RECOVERY_ENABLE: 'I_WILL_RESTART_THE_TEST_SHS_DURING_THIS_PROBE',
	FB_HOMEY_SHS_RECOVERY_OBSERVE_MS: '10000',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const NETWORK_ENVIRONMENT: NodeJS.ProcessEnv = {
	...BASE_ENVIRONMENT,
	FB_HOMEY_SHS_RECOVERY_ENABLE: 'I_WILL_INTERRUPT_AND_RESTORE_THE_TEST_SHS_NETWORK_DURING_THIS_PROBE',
	FB_HOMEY_SHS_RECOVERY_SCENARIO: 'network-interruption',
};

type RecoveryScenario =
	| 'connect-recovery'
	| 'inventory-failure'
	| 'late-success'
	| 'manager-offline'
	| 'no-recovery'
	| 'success';

class FakeRecoveryDevicesManager {
	connectCount = 0;
	connected = false;
	disconnectCount = 0;
	failDisconnect = false;
	inventoryReadCount = 0;

	constructor(
		private readonly client: FakeRecoveryClient,
		private readonly scenario: RecoveryScenario,
	) {}

	connect(): Promise<void> {
		this.connectCount += 1;
		this.connected = true;
		this.client.emit('connect');

		if (this.scenario !== 'no-recovery') {
			setTimeout(
				() => {
					this.connected = false;
					this.client.emit('disconnect', 'raw private disconnect reason');
					this.client.emit('reconnect_attempt', 1);
					this.client.emit('reconnecting', 1);

					if (this.scenario === 'late-success') {
						this.client.emit('reconnect');
						setTimeout(() => {
							this.connected = true;
						}, 20);
					} else {
						this.connected = this.scenario !== 'manager-offline';
						this.client.emit(this.scenario === 'connect-recovery' ? 'connect' : 'reconnect');
					}
				},
				this.scenario === 'late-success' ? 90 : 0,
			);
		}

		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;
		this.connected = false;

		return this.failDisconnect ? Promise.reject(new Error('raw manager cleanup detail')) : Promise.resolve();
	}

	getDevices(): Promise<Record<string, unknown>> {
		this.inventoryReadCount += 1;

		return this.scenario === 'inventory-failure'
			? Promise.reject(new Error('raw inventory detail with endpoint and key'))
			: Promise.resolve({ 'private-device-id': { name: 'Private Device' } });
	}

	isConnected(): boolean {
		return this.connected;
	}
}

class FakeRecoveryClient extends EventEmitter {
	destroyCount = 0;
	disconnectCount = 0;
	failDestroy = false;
	failDisconnect = false;
	readonly devices: FakeRecoveryDevicesManager;

	constructor(scenario: RecoveryScenario) {
		super();
		this.devices = new FakeRecoveryDevicesManager(this, scenario);
	}

	destroy(): void {
		this.destroyCount += 1;
		this.removeAllListeners();

		if (this.failDestroy) {
			throw new Error('raw destroy detail');
		}
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;

		return this.failDisconnect ? Promise.reject(new Error('raw socket cleanup detail')) : Promise.resolve();
	}
}

const createFactory = (
	scenario: RecoveryScenario,
	configure?: (client: FakeRecoveryClient) => void,
): {
	clients: FakeRecoveryClient[];
	factory: HomeyRecoverySdkFactory;
	requests: Array<{ address: string; token: string }>;
} => {
	const clients: FakeRecoveryClient[] = [];
	const requests: Array<{ address: string; token: string }> = [];
	const factory: HomeyRecoverySdkFactory = {
		createLocalApi: ({ address, token }) => {
			const client = new FakeRecoveryClient(scenario);

			configure?.(client);
			clients.push(client);
			requests.push({ address, token });

			return Promise.resolve(client);
		},
	};

	return { clients, factory, requests };
};

const fastConfig = (overrides: Partial<HomeyShsRecoveryProbeConfig> = {}): HomeyShsRecoveryProbeConfig => ({
	...loadHomeyShsRecoveryProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-recovery-spike'),
	observeMs: 100,
	timeoutMs: 50,
	...overrides,
});

describe('Homey SHS recovery compatibility probe', () => {
	it('requires the exact operator acknowledgement and refuses mutation gates', () => {
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_SCENARIO: 'network-interruption',
			}),
		).toThrow('required operator acknowledgement');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...NETWORK_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_ENABLE: BASE_ENVIRONMENT.FB_HOMEY_SHS_RECOVERY_ENABLE,
			}),
		).toThrow('required operator acknowledgement');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_SCENARIO: 'unsupported',
			}),
		).toThrow('must be network-interruption or restart');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_ENABLE: undefined,
			}),
		).toThrow('required operator acknowledgement');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_ENABLE: 'yes',
			}),
		).toThrow('required operator acknowledgement');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_ENABLE: '',
			}),
		).toThrow('mutation gates must be unset');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_LIFECYCLE_DEVICE_ID: 'private-device',
			}),
		).toThrow('mutation gates must be unset');
	});

	it('loads bounded recovery configuration without changing the shared endpoint contract', () => {
		const config = loadHomeyShsRecoveryProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-recovery-spike');

		expect(config).toMatchObject({
			apiKey: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY,
			expectedHost: '127.0.0.1',
			observeMs: 10_000,
			outputRoot: '/tmp/homey-recovery-spike/test/.homey-shs-captures',
			scenario: 'restart',
			timeoutMs: 1000,
		});
		expect(config.origin.origin).toBe('http://127.0.0.1:4859');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_RECOVERY_OBSERVE_MS: '9999' }),
		).toThrow('between 10000 and 300000');
		expect(() =>
			loadHomeyShsRecoveryProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_RECOVERY_OBSERVE_MS: '300001' }),
		).toThrow('between 10000 and 300000');
	});

	it('verifies disconnect, reconnect, resubscription, inventory, and cleanup in order', async () => {
		const config = fastConfig();
		const harness = createFactory('success');
		let windowOpenCount = 0;
		let disconnectObservedCount = 0;
		const report = await probeHomeyShsRecovery(
			config,
			harness.factory,
			undefined,
			() => {
				windowOpenCount += 1;
			},
			() => {
				disconnectObservedCount += 1;
			},
		);

		expect(report).toStrictEqual({
			metadata: { probe: 'homey-shs-recovery', scenario: 'restart', schemaVersion: 2, sdkVersion: '3.19.2' },
			recovery: {
				disconnectObserved: true,
				inventoryReadSucceeded: true,
				managerResubscribed: true,
				transportReconnected: true,
			},
			session: {
				cleanupCompleted: true,
				events: [
					{ event: 'sdk.create.resolved', order: 1 },
					{ event: 'manager.subscribe.resolved', order: 2 },
					{ event: 'recovery.window.open', order: 3 },
					{ event: 'socket.disconnect', order: 4 },
					{ event: 'socket.reconnect_attempt', order: 5 },
					{ event: 'socket.reconnecting', order: 6 },
					{ event: 'socket.reconnect', order: 7 },
					{ event: 'manager.resubscribe.observed', order: 8 },
					{ event: 'inventory.read.resolved', order: 9 },
					{ event: 'manager.unsubscribe.resolved', order: 10 },
					{ event: 'socket.disconnect.resolved', order: 11 },
					{ event: 'sdk.destroyed', order: 12 },
				],
				managerSubscribed: true,
			},
		});
		expect(harness.requests).toStrictEqual([
			{ address: 'http://127.0.0.1:4859', token: 'test-api-key-that-must-not-leak' },
		]);
		expect(harness.clients[0].devices.inventoryReadCount).toBe(1);
		expect(harness.clients[0].devices.disconnectCount).toBe(1);
		expect(harness.clients[0].disconnectCount).toBe(1);
		expect(harness.clients[0].destroyCount).toBe(1);
		expect(windowOpenCount).toBe(1);
		expect(disconnectObservedCount).toBe(1);
		expect(() => assertHomeyShsRecoveryReportSafe(report, config)).not.toThrow();
		expect(JSON.stringify(report)).not.toContain('test-api-key-that-must-not-leak');
		expect(JSON.stringify(report)).not.toContain('Private Device');
	});

	it('records operator-controlled network interruption as distinct recovery evidence', async () => {
		const config = {
			...loadHomeyShsRecoveryProbeConfig(NETWORK_ENVIRONMENT, '/tmp/homey-recovery-spike'),
			observeMs: 100,
			timeoutMs: 50,
		};
		const report = await probeHomeyShsRecovery(config, createFactory('success').factory);

		expect(report.metadata.scenario).toBe('network-interruption');
		expect(report.recovery).toStrictEqual({
			disconnectObserved: true,
			inventoryReadSucceeded: true,
			managerResubscribed: true,
			transportReconnected: true,
		});
		expect(() => assertHomeyShsRecoveryReportSafe(report, config)).not.toThrow();
	});

	it('accepts a post-disconnect connect event as transport recovery', async () => {
		const config = fastConfig();
		const report = await probeHomeyShsRecovery(config, createFactory('connect-recovery').factory);
		const eventNames = report.session.events.map(({ event }) => event);

		expect(eventNames).toContain('socket.connect');
		expect(eventNames).not.toContain('socket.reconnect');
		expect(report.recovery).toStrictEqual({
			disconnectObserved: true,
			inventoryReadSucceeded: true,
			managerResubscribed: true,
			transportReconnected: true,
		});
		expect(() => assertHomeyShsRecoveryReportSafe(report, config)).not.toThrow();
	});

	it('gives verification a fresh timeout budget after late transport recovery', async () => {
		jest.useFakeTimers();

		try {
			const config = fastConfig({ observeMs: 100, timeoutMs: 50 });
			const recovery = probeHomeyShsRecovery(config, createFactory('late-success').factory);
			const assertion = expect(recovery).resolves.toMatchObject({
				recovery: {
					inventoryReadSucceeded: true,
					managerResubscribed: true,
					transportReconnected: true,
				},
			});

			await jest.advanceTimersByTimeAsync(200);
			await assertion;
		} finally {
			jest.useRealTimers();
		}
	});

	it('fails safely when no operator restart occurs and still cleans up', async () => {
		const config = fastConfig({ observeMs: 10 });
		const harness = createFactory('no-recovery');

		await expect(probeHomeyShsRecovery(config, harness.factory)).rejects.toThrow(
			'Homey recovery operator restart observation timed out after 10 ms',
		);
		expect(harness.clients[0].devices.disconnectCount).toBe(1);
		expect(harness.clients[0].disconnectCount).toBe(1);
		expect(harness.clients[0].destroyCount).toBe(1);
	});

	it('uses a network-specific timeout when restoration is not observed', async () => {
		const config = {
			...loadHomeyShsRecoveryProbeConfig(NETWORK_ENVIRONMENT, '/tmp/homey-recovery-spike'),
			observeMs: 10,
			timeoutMs: 50,
		};
		const harness = createFactory('no-recovery');

		await expect(probeHomeyShsRecovery(config, harness.factory)).rejects.toThrow(
			'Homey recovery operator network restoration timed out after 10 ms',
		);
		expect(harness.clients[0].destroyCount).toBe(1);
	});

	it('requires manager restoration after transport reconnect and sanitizes failures', async () => {
		const offlineConfig = fastConfig({ timeoutMs: 10 });
		const offlineHarness = createFactory('manager-offline');

		await expect(probeHomeyShsRecovery(offlineConfig, offlineHarness.factory)).rejects.toThrow(
			'Homey recovery manager resubscription timed out after 10 ms',
		);
		expect(offlineHarness.clients[0].destroyCount).toBe(1);

		const inventoryHarness = createFactory('inventory-failure');

		await expect(probeHomeyShsRecovery(fastConfig(), inventoryHarness.factory)).rejects.toThrow(
			'Homey recovery post-reconnect inventory read failed',
		);
		expect(inventoryHarness.clients[0].destroyCount).toBe(1);
	});

	it('reports fixed cleanup failures after attempting every cleanup step', async () => {
		const harness = createFactory('success', (client) => {
			client.devices.failDisconnect = true;
			client.failDisconnect = true;
			client.failDestroy = true;
		});

		await expect(probeHomeyShsRecovery(fastConfig(), harness.factory)).rejects.toThrow(
			'Homey recovery cleanup failed: manager unsubscribe, socket disconnect, client destroy',
		);
		expect(harness.clients[0].devices.disconnectCount).toBe(1);
		expect(harness.clients[0].disconnectCount).toBe(1);
		expect(harness.clients[0].destroyCount).toBe(1);
	});

	it('rejects extra fields, invalid state, unsafe values, and unordered evidence', () => {
		const report: HomeyShsRecoveryReport = {
			metadata: { probe: 'homey-shs-recovery', scenario: 'restart', schemaVersion: 2, sdkVersion: '3.19.2' },
			recovery: {
				disconnectObserved: true,
				inventoryReadSucceeded: true,
				managerResubscribed: true,
				transportReconnected: true,
			},
			session: {
				cleanupCompleted: true,
				events: [
					{ event: 'manager.subscribe.resolved', order: 1 },
					{ event: 'recovery.window.open', order: 2 },
					{ event: 'socket.disconnect', order: 3 },
					{ event: 'socket.reconnect', order: 4 },
					{ event: 'manager.resubscribe.observed', order: 5 },
					{ event: 'inventory.read.resolved', order: 6 },
				],
				managerSubscribed: true,
			},
		};
		const extra = structuredClone(report) as unknown as Record<string, unknown>;
		extra.rawEndpoint = 'private-endpoint';

		expect(() => assertHomeyShsRecoveryReportSchema(extra)).toThrow('root schema is invalid');

		const invalidState = structuredClone(report);
		(invalidState.recovery as unknown as Record<string, unknown>).managerResubscribed = 'true';

		expect(() => assertHomeyShsRecoveryReportSchema(invalidState)).toThrow('state schema is invalid');

		const incomplete = structuredClone(report);
		incomplete.recovery.inventoryReadSucceeded = false;

		expect(() => assertHomeyShsRecoveryReportSafe(incomplete, fastConfig())).toThrow(
			'did not verify restart recovery and cleanup',
		);
		expect(() =>
			assertHomeyShsRecoveryReportSafe(report, { ...fastConfig(), scenario: 'network-interruption' }),
		).toThrow('scenario does not match the requested scenario');

		const unordered = structuredClone(report);
		unordered.session.events = [
			{ event: 'socket.disconnect', order: 1 },
			{ event: 'manager.subscribe.resolved', order: 2 },
			{ event: 'recovery.window.open', order: 3 },
			{ event: 'socket.reconnect', order: 4 },
			{ event: 'manager.resubscribe.observed', order: 5 },
			{ event: 'inventory.read.resolved', order: 6 },
		];

		expect(() => assertHomeyShsRecoveryReportSafe(unordered, fastConfig())).toThrow(
			'does not contain the required recovery ordering',
		);
	});

	it('writes a new restrictive, schema-validated report directory', async () => {
		const root = await mkdtemp(join(tmpdir(), 'homey-recovery-spike-'));
		const report: HomeyShsRecoveryReport = {
			metadata: { probe: 'homey-shs-recovery', scenario: 'restart', schemaVersion: 2, sdkVersion: '3.19.2' },
			recovery: {
				disconnectObserved: true,
				inventoryReadSucceeded: true,
				managerResubscribed: true,
				transportReconnected: true,
			},
			session: { cleanupCompleted: true, events: [], managerSubscribed: true },
		};

		try {
			const outputDirectory = await writeHomeyShsRecoveryReport(report, root);
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
