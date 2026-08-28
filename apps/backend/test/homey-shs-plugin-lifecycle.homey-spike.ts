import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyPluginLifecycleSnapshot,
	type HomeyShsPluginLifecycleConfig,
	assertHomeyShsPluginLifecycleReportSafe,
	loadHomeyShsPluginLifecycleConfig,
	probeHomeyShsPluginLifecycle,
	writeHomeyShsPluginLifecycleReport,
} from './support/homey-shs-plugin-lifecycle-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PLUGIN_LIFECYCLE_ENABLE: 'I_WILL_VERIFY_HOMEY_PLUGIN_DISABLE_ENABLE_AND_BACKEND_SHUTDOWN',
	FB_HOMEY_SHS_PLUGIN_LIFECYCLE_OBSERVE_MS: '31000',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const config = (overrides: Partial<HomeyShsPluginLifecycleConfig> = {}): HomeyShsPluginLifecycleConfig => ({
	...loadHomeyShsPluginLifecycleConfig(BASE_ENVIRONMENT, '/tmp/homey-plugin-lifecycle'),
	...overrides,
});

class FakeRuntime {
	bootstrapCount = 0;
	failShutdown = false;
	leakServiceTimerAfterDisable = false;
	leakSdkSocketAfterDisable = false;
	reuseGenerationAfterEnable = false;
	shutdownCount = 0;
	snapshotValue: HomeyPluginLifecycleSnapshot = {
		activityRevision: 0,
		activeConnections: 0,
		activeSubscriptions: 0,
		connected: false,
		connectorGeneration: 0,
		sdkActivityRevision: 0,
		sdkActiveClients: 0,
		sdkActiveListeners: 0,
		sdkActiveSockets: 0,
		sdkActiveSubscriptions: 0,
		sdkActiveTimers: 0,
		serviceActiveTimers: 0,
		serviceStopped: true,
	};

	bootstrap(): Promise<void> {
		this.bootstrapCount += 1;
		this.snapshotValue = {
			activityRevision: this.snapshotValue.activityRevision + 1,
			activeConnections: 1,
			activeSubscriptions: 1,
			connected: true,
			connectorGeneration: 1,
			sdkActivityRevision: this.snapshotValue.sdkActivityRevision + 1,
			sdkActiveClients: 1,
			sdkActiveListeners: 8,
			sdkActiveSockets: 2,
			sdkActiveSubscriptions: 2,
			sdkActiveTimers: 0,
			serviceActiveTimers: 1,
			serviceStopped: false,
		};

		return Promise.resolve();
	}

	setEnabled(enabled: boolean): Promise<void> {
		this.snapshotValue = enabled
			? {
					activityRevision: this.snapshotValue.activityRevision + 1,
					activeConnections: 1,
					activeSubscriptions: 1,
					connected: true,
					connectorGeneration: this.reuseGenerationAfterEnable ? 1 : 2,
					sdkActivityRevision: this.snapshotValue.sdkActivityRevision + 1,
					sdkActiveClients: 1,
					sdkActiveListeners: 8,
					sdkActiveSockets: 2,
					sdkActiveSubscriptions: 2,
					sdkActiveTimers: 0,
					serviceActiveTimers: 1,
					serviceStopped: false,
				}
			: {
					activityRevision: this.snapshotValue.activityRevision + 1,
					activeConnections: 0,
					activeSubscriptions: 0,
					connected: false,
					connectorGeneration: 1,
					sdkActivityRevision: this.snapshotValue.sdkActivityRevision + 1,
					sdkActiveClients: 0,
					sdkActiveListeners: 0,
					sdkActiveSockets: 0,
					sdkActiveSubscriptions: 0,
					sdkActiveTimers: 0,
					serviceActiveTimers: 0,
					serviceStopped: true,
				};
		if (!enabled && this.leakSdkSocketAfterDisable) this.snapshotValue.sdkActiveSockets = 1;
		if (!enabled && this.leakServiceTimerAfterDisable) this.snapshotValue.serviceActiveTimers = 1;

		return Promise.resolve();
	}

	shutdown(): Promise<void> {
		this.shutdownCount += 1;

		if (this.failShutdown) return Promise.reject(new Error('simulated shutdown failure'));
		this.snapshotValue = {
			...this.snapshotValue,
			activityRevision: this.snapshotValue.activityRevision + 1,
			activeConnections: 0,
			activeSubscriptions: 0,
			connected: false,
			sdkActivityRevision: this.snapshotValue.sdkActivityRevision + 1,
			sdkActiveClients: 0,
			sdkActiveListeners: 0,
			sdkActiveSockets: 0,
			sdkActiveSubscriptions: 0,
			sdkActiveTimers: 0,
			serviceActiveTimers: 0,
			serviceStopped: true,
		};

		return Promise.resolve();
	}

	snapshot(): HomeyPluginLifecycleSnapshot {
		return { ...this.snapshotValue };
	}
}

const successfulProbe = async () => {
	const runtime = new FakeRuntime();
	const waits: number[] = [];
	const report = await probeHomeyShsPluginLifecycle(
		config(),
		() => runtime,
		(milliseconds) => {
			waits.push(milliseconds);

			return Promise.resolve();
		},
	);

	return { report, runtime, waits };
};

describe('Homey SHS plugin-lifecycle probe', () => {
	it('requires the exact gate and a quiescence interval beyond the production reconciliation interval', () => {
		expect(() =>
			loadHomeyShsPluginLifecycleConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_PLUGIN_LIFECYCLE_ENABLE: 'yes' }),
		).toThrow('required acknowledgement');
		expect(() =>
			loadHomeyShsPluginLifecycleConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_PLUGIN_LIFECYCLE_OBSERVE_MS: '30000',
			}),
		).toThrow('must be an integer between');
		expect(() => loadHomeyShsPluginLifecycleConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_STARTUP_ENABLE: '' })).toThrow(
			'must be unset',
		);
	});

	it('proves managed disable, fresh re-enable, backend shutdown, and two quiescence windows', async () => {
		const { report, runtime, waits } = await successfulProbe();

		expect(() => assertHomeyShsPluginLifecycleReportSafe(report, config())).not.toThrow();
		expect(report).toMatchObject({
			observation: {
				backendShutdownDisconnected: true,
				backendShutdownQuiescent: true,
				disableDisconnected: true,
				disableQuiescent: true,
				freshConnectorAfterEnable: true,
				initialStartupConnected: true,
				reenableConnected: true,
			},
			session: { cleanupCompleted: true },
		});
		expect(report.session.events).toHaveLength(12);
		expect(waits).toStrictEqual([31_000, 31_000]);
		expect(runtime.bootstrapCount).toBe(1);
		expect(runtime.shutdownCount).toBe(1);
	});

	it('rejects delayed activity after disable and still performs managed cleanup', async () => {
		const runtime = new FakeRuntime();
		let waitCount = 0;

		await expect(
			probeHomeyShsPluginLifecycle(
				config(),
				() => runtime,
				() => {
					waitCount += 1;
					runtime.snapshotValue.activityRevision += 1;

					return Promise.resolve();
				},
			),
		).rejects.toThrow('activity survived disable');
		expect(waitCount).toBe(1);
		expect(runtime.shutdownCount).toBe(1);
		expect(runtime.snapshot().serviceStopped).toBe(true);
	});

	it('rejects cleanup that resolves while an underlying SDK socket remains active', async () => {
		const runtime = new FakeRuntime();
		runtime.leakSdkSocketAfterDisable = true;

		await expect(
			probeHomeyShsPluginLifecycle(
				config(),
				() => runtime,
				() => Promise.resolve(),
			),
		).rejects.toThrow('disable did not release its runtime');
		expect(runtime.shutdownCount).toBe(1);
	});

	it('rejects cleanup that leaves a Homey service timer scheduled', async () => {
		const runtime = new FakeRuntime();
		runtime.leakServiceTimerAfterDisable = true;

		await expect(
			probeHomeyShsPluginLifecycle(
				config(),
				() => runtime,
				() => Promise.resolve(),
			),
		).rejects.toThrow('disable did not release its runtime');
		expect(runtime.shutdownCount).toBe(1);
	});

	it('rejects a reused connector generation after re-enable and shuts down', async () => {
		const runtime = new FakeRuntime();
		runtime.reuseGenerationAfterEnable = true;

		await expect(
			probeHomeyShsPluginLifecycle(
				config(),
				() => runtime,
				() => Promise.resolve(),
			),
		).rejects.toThrow('fresh healthy runtime');
		expect(runtime.shutdownCount).toBe(1);
	});

	it.each(['SIGINT', 'SIGTERM'] as const)(
		'performs managed shutdown before completing %s termination',
		async (signal) => {
			const runtime = new FakeRuntime();
			const listeners = new Map<string, () => void>();
			const signalSource = {
				on: (name: string, listener: () => void): void => {
					listeners.set(name, listener);
				},
				off: (name: string, listener: () => void): void => {
					if (listeners.get(name) === listener) listeners.delete(name);
				},
			};

			await expect(
				probeHomeyShsPluginLifecycle(
					config(),
					() => runtime,
					() => {
						listeners.get(signal)?.();

						return Promise.resolve();
					},
					signalSource,
				),
			).rejects.toThrow(`received ${signal}; managed shutdown completed before termination`);
			expect(runtime.shutdownCount).toBe(1);
			expect(runtime.snapshot().serviceStopped).toBe(true);
			expect(listeners.size).toBe(0);
		},
	);

	it('preserves managed cleanup failure when a termination signal arrives', async () => {
		const runtime = new FakeRuntime();
		runtime.failShutdown = true;
		const listeners = new Map<string, () => void>();
		const signalSource = {
			on: (name: string, listener: () => void): void => {
				listeners.set(name, listener);
			},
			off: (name: string, listener: () => void): void => {
				if (listeners.get(name) === listener) listeners.delete(name);
			},
		};

		await expect(
			probeHomeyShsPluginLifecycle(
				config(),
				() => runtime,
				() => {
					listeners.get('SIGTERM')?.();

					return Promise.resolve();
				},
				signalSource,
			),
		).rejects.toThrow('managed cleanup failed');
		expect(runtime.shutdownCount).toBe(1);
		expect(listeners.size).toBe(0);
	});

	it('rejects malformed, reordered, and private report content', async () => {
		const { report } = await successfulProbe();

		expect(() => assertHomeyShsPluginLifecycleReportSafe({ ...report, extra: true }, config())).toThrow(
			'root schema is invalid',
		);
		expect(() =>
			assertHomeyShsPluginLifecycleReportSafe(
				{ ...report, session: { ...report.session, events: [...report.session.events].reverse() } },
				config(),
			),
		).toThrow();
		expect(() =>
			assertHomeyShsPluginLifecycleReportSafe(
				{ ...report, metadata: { ...report.metadata, sdkVersion: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY } },
				config(),
			),
		).toThrow();
	});

	it('writes the report beneath a private non-overwriting directory', async () => {
		const { report } = await successfulProbe();
		const parent = await mkdtemp(join(tmpdir(), 'homey-plugin-lifecycle-'));
		const root = join(parent, 'new-capture-root');

		try {
			const directory = await writeHomeyShsPluginLifecycleReport(report, root);
			const path = join(directory, 'report.json');
			expect((await stat(root)).mode & 0o777).toBe(0o700);
			expect((await stat(directory)).mode & 0o777).toBe(0o700);
			expect((await stat(path)).mode & 0o777).toBe(0o600);
			expect(JSON.parse(await readFile(path, 'utf8'))).toStrictEqual(report);
		} finally {
			await rm(parent, { force: true, recursive: true });
		}
	});
});
