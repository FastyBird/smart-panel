import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type HomeyDevice, type HomeySdkClient, type HomeySdkFactory } from './support/homey-shs-realtime-probe';
import {
	type HomeyShsRestartEventFlowConfig,
	assertHomeyShsRestartEventFlowReportSafe,
	loadHomeyShsRestartEventFlowConfig,
	probeHomeyShsRestartEventFlow,
	writeHomeyShsRestartEventFlowReport,
} from './support/homey-shs-restart-event-flow-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE: 'I_WILL_RESTART_THE_TEST_SHS_WHILE_A_DISPOSABLE_CAPABILITY_IS_CHANGED',
	FB_HOMEY_SHS_RESTART_EVENT_FLOW_EVENT_OBSERVE_MS: '1000',
	FB_HOMEY_SHS_RESTART_EVENT_FLOW_RECOVERY_OBSERVE_MS: '1000',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
	FB_HOMEY_SHS_WRITE_CAPABILITY_ID: 'test-capability-that-must-not-leak',
	FB_HOMEY_SHS_WRITE_DEVICE_ID: 'test-device-that-must-not-leak',
	FB_HOMEY_SHS_WRITE_ENABLE: 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE',
	FB_HOMEY_SHS_WRITE_VALUE: 'true',
};

class FakeDevice extends EventEmitter implements HomeyDevice {
	capabilitiesObj = { 'test-capability-that-must-not-leak': { setable: true, type: 'boolean' } };
	connectCount = 0;
	disconnectCount = 0;

	connect(): Promise<void> {
		this.connectCount += 1;
		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;
		return Promise.resolve();
	}
}

class FakeManager extends EventEmitter {
	connected = false;
	readonly device = new FakeDevice();
	emitCapabilityEvents = true;
	readonly inventoryOptions: Array<{ $cache?: boolean; $timeout?: number; $updateCache?: boolean }> = [];
	readFailuresRemaining = 0;
	restoreFailuresRemaining = 0;
	value = false;
	writeAttempts: unknown[] = [];
	writes: unknown[] = [];

	connect(): Promise<void> {
		this.connected = true;
		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.connected = false;
		return Promise.resolve();
	}

	getCapabilityValue(): Promise<unknown> {
		if (this.readFailuresRemaining > 0) {
			this.readFailuresRemaining -= 1;

			return Promise.reject(new Error('raw restart read readiness detail'));
		}

		return Promise.resolve(this.value);
	}

	getDevices(
		options: { $cache?: boolean; $timeout?: number; $updateCache?: boolean } = {},
	): Promise<Record<string, HomeyDevice>> {
		this.inventoryOptions.push(options);

		return Promise.resolve({ 'test-device-that-must-not-leak': this.device });
	}

	isConnected(): boolean {
		return this.connected;
	}

	setCapabilityValue(options: { capabilityId: string; value: unknown }): Promise<void> {
		this.writeAttempts.push(options.value);

		if (options.value === false && this.restoreFailuresRemaining > 0) {
			this.restoreFailuresRemaining -= 1;

			return Promise.reject(new Error('raw restart readiness detail'));
		}

		this.value = options.value as boolean;
		this.writes.push(options.value);
		if (this.emitCapabilityEvents)
			this.device.emit('capability', { capabilityId: options.capabilityId, value: options.value });
		return Promise.resolve();
	}
}

class FakeClient extends EventEmitter implements HomeySdkClient {
	destroyCount = 0;
	disconnectCount = 0;
	readonly devices = new FakeManager();

	destroy(): void {
		this.destroyCount += 1;
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;
		return Promise.resolve();
	}

	restart(): void {
		this.devices.connected = false;
		this.emit('disconnect');
		this.emit('reconnect_attempt');
		this.devices.connected = true;
		this.emit('reconnect');
	}
}

const createFactory = (): { client: FakeClient; factory: HomeySdkFactory } => {
	const client = new FakeClient();
	return { client, factory: { createLocalApi: () => Promise.resolve(client) } };
};

const config = (overrides: Partial<HomeyShsRestartEventFlowConfig> = {}): HomeyShsRestartEventFlowConfig => ({
	...loadHomeyShsRestartEventFlowConfig(BASE_ENVIRONMENT, '/tmp/homey-restart-event-flow'),
	...overrides,
});

describe('Homey SHS restart event-flow probe', () => {
	it('requires exact mutation acknowledgements and rejects unrelated probe gates', () => {
		expect(loadHomeyShsRestartEventFlowConfig(BASE_ENVIRONMENT).write.value).toBe(true);
		expect(() =>
			loadHomeyShsRestartEventFlowConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RESTART_EVENT_FLOW_ENABLE: 'yes',
			}),
		).toThrow('required acknowledgement');
		expect(() => loadHomeyShsRestartEventFlowConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_RECOVERY_ENABLE: '' })).toThrow(
			'must be unset',
		);
		expect(() =>
			loadHomeyShsRestartEventFlowConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_WRITE_VALUE: undefined }),
		).toThrow('All four FB_HOMEY_SHS_WRITE_* variables');
	});

	it('verifies one event before restart and restoration event after recovery', async () => {
		const { client, factory } = createFactory();
		const restartWindow = jest.fn(() => client.restart());
		const report = await probeHomeyShsRestartEventFlow(config(), factory, () => Promise.resolve(), restartWindow);

		expect(report.flow).toStrictEqual({
			disconnectObserved: true,
			managerResubscribed: true,
			postRestartEventObserved: true,
			preRestartEventObserved: true,
			preRestartReadBackMatched: true,
			restorationReadBackMatched: true,
			restored: true,
			transportReconnected: true,
		});
		expect(client.devices.writes).toStrictEqual([true, false]);
		expect(client.devices.inventoryOptions).toStrictEqual([
			{ $timeout: 1000 },
			{ $cache: false, $timeout: 1000, $updateCache: true },
		]);
		expect(client.devices.value).toBe(false);
		expect(client.devices.device.disconnectCount).toBe(1);
		expect(client.disconnectCount).toBe(1);
		expect(client.destroyCount).toBe(1);
		expect(() => assertHomeyShsRestartEventFlowReportSafe(report, config())).not.toThrow();
	});

	it('uses authoritative read-back before a bounded restoration retry after restart', async () => {
		const { client, factory } = createFactory();
		client.devices.restoreFailuresRemaining = 1;
		const report = await probeHomeyShsRestartEventFlow(
			config(),
			factory,
			() => Promise.resolve(),
			() => {
				client.restart();
				client.devices.readFailuresRemaining = 1;
			},
		);

		expect(report.flow.restored).toBe(true);
		expect(client.devices.writeAttempts).toStrictEqual([true, false, false]);
		expect(client.devices.writes).toStrictEqual([true, false]);
		expect(client.devices.restoreFailuresRemaining).toBe(0);
	});

	it('rejects the run when restoration succeeds without a post-restart capability event', async () => {
		const { client, factory } = createFactory();
		let now = 0;
		const dateNow = jest.spyOn(Date, 'now').mockImplementation(() => now);
		const advance = (milliseconds: number): Promise<void> => {
			now += milliseconds;

			return Promise.resolve();
		};

		try {
			await expect(
				probeHomeyShsRestartEventFlow(config(), factory, advance, () => {
					client.restart();
					client.devices.emitCapabilityEvents = false;
				}),
			).rejects.toThrow('post-restart restoration event timed out');
			expect(client.devices.writes).toStrictEqual([true, false]);
			expect(client.devices.value).toBe(false);
			expect(client.destroyCount).toBe(1);
		} finally {
			dateNow.mockRestore();
		}
	});

	it('restores the original value and cleans up when restart observation fails', async () => {
		const { client, factory } = createFactory();
		let now = 0;
		const dateNow = jest.spyOn(Date, 'now').mockImplementation(() => now);
		const advancePastDeadline = (): Promise<void> => {
			now = 1_001;

			return Promise.resolve();
		};

		try {
			await expect(probeHomeyShsRestartEventFlow(config(), factory, advancePastDeadline)).rejects.toThrow(
				'operator restart recovery timed out',
			);
			expect(client.devices.writes).toStrictEqual([true, false]);
			expect(client.devices.value).toBe(false);
			expect(client.destroyCount).toBe(1);
		} finally {
			dateNow.mockRestore();
		}
	});

	it('rejects extra schema fields, reordered evidence, and private values', async () => {
		const { client, factory } = createFactory();
		const report = await probeHomeyShsRestartEventFlow(
			config(),
			factory,
			() => Promise.resolve(),
			() => client.restart(),
		);

		expect(() => assertHomeyShsRestartEventFlowReportSafe({ ...report, extra: true }, config())).toThrow(
			'root schema is invalid',
		);
		expect(() =>
			assertHomeyShsRestartEventFlowReportSafe(
				{ ...report, session: { ...report.session, events: [...report.session.events].reverse() } },
				config(),
			),
		).toThrow();
		expect(() =>
			assertHomeyShsRestartEventFlowReportSafe(
				{ ...report, metadata: { ...report.metadata, sdkVersion: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY } },
				config(),
			),
		).toThrow();
	});

	it('preserves the sanitized live SHS restart event-flow evidence', async () => {
		const evidencePath = join(
			__dirname,
			'../src/plugins/devices-homey/__fixtures__/evidence/2026-08-27-shs-13.4.1-restart-event-flow.json',
		);
		const evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as unknown;

		assertHomeyShsRestartEventFlowReportSafe(evidence, config());
		expect(evidence).toMatchObject({
			flow: {
				disconnectObserved: true,
				managerResubscribed: true,
				postRestartEventObserved: true,
				preRestartEventObserved: true,
				restorationReadBackMatched: true,
				restored: true,
				transportReconnected: true,
			},
			session: { cleanupCompleted: true, managerSubscribed: true },
		});
		expect(evidence.session.events).toHaveLength(23);
	});

	it('writes the report beneath a private non-overwriting directory', async () => {
		const { client, factory } = createFactory();
		const report = await probeHomeyShsRestartEventFlow(
			config(),
			factory,
			() => Promise.resolve(),
			() => client.restart(),
		);
		const root = await mkdtemp(join(tmpdir(), 'homey-restart-event-flow-'));

		try {
			const directory = await writeHomeyShsRestartEventFlowReport(report, root);
			const path = join(directory, 'report.json');
			expect((await stat(directory)).mode & 0o777).toBe(0o700);
			expect((await stat(path)).mode & 0o777).toBe(0o600);
			expect(JSON.parse(await readFile(path, 'utf8'))).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
