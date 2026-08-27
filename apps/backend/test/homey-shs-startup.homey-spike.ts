import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HomeyConnectionState } from '../src/plugins/devices-homey/devices-homey.constants';

import {
	type HomeyShsStartupProbeConfig,
	type HomeyShsStartupReport,
	type HomeyStartupRuntime,
	assertHomeyShsStartupReportSafe,
	assertHomeyShsStartupReportSchema,
	loadHomeyShsStartupProbeConfig,
	probeHomeyShsStartup,
	writeHomeyShsStartupReport,
} from './support/homey-shs-startup-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_STARTUP_ENABLE: 'I_WILL_VERIFY_A_FRESH_ONLINE_HOMEY_STARTUP',
	FB_HOMEY_SHS_STARTUP_OBSERVE_MS: '10000',
	FB_HOMEY_SHS_STARTUP_SCENARIO: 'online',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const OFFLINE_ENVIRONMENT: NodeJS.ProcessEnv = {
	...BASE_ENVIRONMENT,
	FB_HOMEY_SHS_STARTUP_ENABLE: 'I_WILL_START_WITH_TEST_SHS_BLOCKED_AND_RESTORE_ONLY_WHEN_PROMPTED',
	FB_HOMEY_SHS_STARTUP_SCENARIO: 'offline-recovery',
};

class FakeStartupRuntime implements HomeyStartupRuntime {
	connectionState: HomeyConnectionState;
	failStop = false;
	healthy: boolean;
	inventory: readonly unknown[] | null;
	reconnectCount = 0;
	startCount = 0;
	stopCount = 0;

	constructor(state: 'connected' | 'reconnecting') {
		this.connectionState = state === 'connected' ? HomeyConnectionState.CONNECTED : HomeyConnectionState.RECONNECTING;
		this.healthy = state === 'connected';
		this.inventory = state === 'connected' ? [] : null;
	}

	getInventorySnapshot(): readonly unknown[] | null {
		return this.inventory;
	}

	getStatus(): { connectionState: HomeyConnectionState; healthy: boolean; reconnectCount: number } {
		return {
			connectionState: this.connectionState,
			healthy: this.healthy,
			reconnectCount: this.reconnectCount,
		};
	}

	recover(): void {
		this.connectionState = HomeyConnectionState.CONNECTED;
		this.healthy = true;
		this.inventory = [];
		this.reconnectCount = 1;
	}

	start(): Promise<void> {
		this.startCount += 1;

		return Promise.resolve();
	}

	stop(): Promise<void> {
		this.stopCount += 1;

		return this.failStop ? Promise.reject(new Error('raw private cleanup failure')) : Promise.resolve();
	}
}

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } => {
	let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});

	return { promise, resolve: resolvePromise };
};

const fastConfig = (
	environment: NodeJS.ProcessEnv = BASE_ENVIRONMENT,
	overrides: Partial<HomeyShsStartupProbeConfig> = {},
): HomeyShsStartupProbeConfig => ({
	...loadHomeyShsStartupProbeConfig(environment, '/tmp/homey-startup-spike'),
	observeMs: 100,
	...overrides,
});

const completeReport = (scenario: 'offline-recovery' | 'online' = 'online'): HomeyShsStartupReport => {
	const events: Array<HomeyShsStartupReport['session']['events'][number]['event']> =
		scenario === 'online'
			? [
					'service.start.requested',
					'service.start.resolved',
					'service.connected.observed',
					'inventory.verified',
					'service.stop.resolved',
				]
			: [
					'service.start.requested',
					'service.start.resolved',
					'initial.reconnecting.verified',
					'recovery.window.open',
					'service.connected.observed',
					'inventory.verified',
					'service.stop.resolved',
				];

	return {
		metadata: { probe: 'homey-shs-startup', scenario, schemaVersion: 1, sdkVersion: '3.19.2' },
		startup: {
			cleanupCompleted: true,
			initialUnavailableVerified: scenario === 'offline-recovery',
			inventoryVerified: true,
			recoveryObserved: scenario === 'offline-recovery',
			serviceConnected: true,
		},
		session: { events: events.map((event, index) => ({ event, order: index + 1 })) },
	};
};

describe('Homey SHS startup compatibility probe', () => {
	it('requires a scenario-specific acknowledgement and rejects every conflicting gate', () => {
		expect(loadHomeyShsStartupProbeConfig(BASE_ENVIRONMENT).scenario).toBe('online');
		expect(loadHomeyShsStartupProbeConfig(OFFLINE_ENVIRONMENT).scenario).toBe('offline-recovery');
		expect(() => loadHomeyShsStartupProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_STARTUP_ENABLE: 'yes' })).toThrow(
			'required scenario acknowledgement',
		);
		expect(() =>
			loadHomeyShsStartupProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_STARTUP_SCENARIO: 'restart' }),
		).toThrow('must be exactly online or offline-recovery');

		for (const name of [
			'FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE',
			'FB_HOMEY_SHS_LIFECYCLE_ENABLE',
			'FB_HOMEY_SHS_RECOVERY_ENABLE',
			'FB_HOMEY_SHS_WRITE_ENABLE',
		]) {
			expect(() => loadHomeyShsStartupProbeConfig({ ...BASE_ENVIRONMENT, [name]: '' })).toThrow(
				'must be unset during the startup probe',
			);
		}
	});

	it('loads bounded startup configuration without changing the shared endpoint contract', () => {
		const config = loadHomeyShsStartupProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-startup-spike');

		expect(config).toMatchObject({
			apiKey: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY,
			expectedHost: '127.0.0.1',
			observeMs: 10_000,
			outputRoot: '/tmp/homey-startup-spike/test/.homey-shs-captures',
			scenario: 'online',
			timeoutMs: 1000,
		});
		expect(config.origin.origin).toBe('http://127.0.0.1:4859');
		expect(() =>
			loadHomeyShsStartupProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_STARTUP_OBSERVE_MS: '9999' }),
		).toThrow('must be an integer between 10000 and 300000');
		expect(() =>
			loadHomeyShsStartupProbeConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_STARTUP_OBSERVE_MS: '300001' }),
		).toThrow('must be an integer between 10000 and 300000');
		expect(() =>
			loadHomeyShsStartupProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_STARTUP_OBSERVE_MS: '10000',
				FB_HOMEY_SHS_TIMEOUT_MS: '10000',
			}),
		).toThrow('must be greater than FB_HOMEY_SHS_TIMEOUT_MS');
	});

	it('verifies fresh online startup and always stops the service', async () => {
		const runtime = new FakeStartupRuntime('connected');
		const config = fastConfig();
		const report = await probeHomeyShsStartup(config, () => runtime);

		expect(report).toStrictEqual(completeReport('online'));
		expect(runtime.startCount).toBe(1);
		expect(runtime.stopCount).toBe(1);
		expect(() => assertHomeyShsStartupReportSafe(report, config)).not.toThrow();
	});

	it('verifies unavailable startup followed by production-service recovery', async () => {
		const runtime = new FakeStartupRuntime('reconnecting');
		const config = fastConfig(OFFLINE_ENVIRONMENT);
		const recoveryWindow = jest.fn();
		const wait = jest.fn().mockImplementation(() => {
			runtime.recover();

			return Promise.resolve();
		});
		const report = await probeHomeyShsStartup(config, () => runtime, wait, recoveryWindow);

		expect(report).toStrictEqual(completeReport('offline-recovery'));
		expect(recoveryWindow).toHaveBeenCalledTimes(1);
		expect(wait).toHaveBeenCalledWith(100);
		expect(runtime.stopCount).toBe(1);
		expect(() => assertHomeyShsStartupReportSafe(report, config)).not.toThrow();
	});

	it('fails closed on a mismatched initial state or missing authoritative inventory and still cleans up', async () => {
		const unexpectedlyConnected = new FakeStartupRuntime('connected');
		await expect(probeHomeyShsStartup(fastConfig(OFFLINE_ENVIRONMENT), () => unexpectedlyConnected)).rejects.toThrow(
			'offline-recovery verification failed',
		);
		expect(unexpectedlyConnected.stopCount).toBe(1);

		const missingInventory = new FakeStartupRuntime('connected');
		missingInventory.inventory = null;
		await expect(probeHomeyShsStartup(fastConfig(), () => missingInventory)).rejects.toThrow(
			'online verification failed',
		);
		expect(missingInventory.stopCount).toBe(1);
	});

	it('fails with a fixed error when cleanup fails', async () => {
		const runtime = new FakeStartupRuntime('connected');
		runtime.failStop = true;

		await expect(probeHomeyShsStartup(fastConfig(), () => runtime)).rejects.toThrow(
			'Homey startup service cleanup failed',
		);
	});

	it('waits for a timed-out startup to settle before stopping and returning failure', async () => {
		jest.useFakeTimers();
		const start = deferred<void>();
		const runtime = new FakeStartupRuntime('connected');
		runtime.start = jest.fn().mockReturnValue(start.promise);
		const result = probeHomeyShsStartup(fastConfig(BASE_ENVIRONMENT, { observeMs: 10 }), () => runtime);
		const expectation = expect(result).rejects.toThrow('Homey startup service start timed out after 10 ms');

		try {
			await jest.advanceTimersByTimeAsync(10);
			expect(runtime.stopCount).toBe(0);

			start.resolve();
			await expectation;
			expect(runtime.stopCount).toBe(1);
		} finally {
			jest.useRealTimers();
		}
	});

	it('waits for timed-out cleanup to settle before returning its fixed failure', async () => {
		jest.useFakeTimers();
		const stop = deferred<void>();
		const runtime = new FakeStartupRuntime('connected');
		const stopOperation = jest.fn().mockReturnValue(stop.promise);
		runtime.stop = stopOperation;
		const result = probeHomeyShsStartup(fastConfig(BASE_ENVIRONMENT, { observeMs: 10 }), () => runtime);
		const expectation = expect(result).rejects.toThrow('Homey startup service cleanup failed');

		try {
			await jest.advanceTimersByTimeAsync(10);
			expect(stopOperation).toHaveBeenCalledTimes(1);

			stop.resolve();
			await expectation;
		} finally {
			jest.useRealTimers();
		}
	});

	it('does not expose a runtime factory failure', async () => {
		const createRuntime = (): HomeyStartupRuntime => {
			throw new Error('raw private factory failure with an endpoint and key');
		};

		await expect(probeHomeyShsStartup(fastConfig(), createRuntime)).rejects.toThrow(
			'Homey startup online verification failed',
		);
	});

	it('enforces the exact report schema, event allowlist, sequence, and scenario claims', () => {
		const onlineConfig = fastConfig();
		const valid = completeReport();

		expect(() => assertHomeyShsStartupReportSchema(valid)).not.toThrow();
		expect(() => assertHomeyShsStartupReportSafe(valid, onlineConfig)).not.toThrow();
		expect(() => assertHomeyShsStartupReportSchema({ ...valid, extra: true })).toThrow('root schema is invalid');
		expect(() =>
			assertHomeyShsStartupReportSchema({
				...valid,
				session: { events: [{ event: 'private.event', order: 1 }] },
			}),
		).toThrow('event schema is invalid');
		expect(() =>
			assertHomeyShsStartupReportSafe(
				{ ...valid, session: { events: valid.session.events.slice(0, -1) } },
				onlineConfig,
			),
		).toThrow('unexpected event ordering');
		expect(() =>
			assertHomeyShsStartupReportSafe(
				{ ...valid, startup: { ...valid.startup, recoveryObserved: true } },
				onlineConfig,
			),
		).toThrow('recovery-only claims');
	});

	it('rejects secrets, private terms, addresses, email addresses, and URLs', () => {
		const config = fastConfig();

		for (const sdkVersion of [
			config.apiKey,
			config.expectedHost,
			config.privateTerms[0],
			'10.0.0.8',
			'operator@example.test',
			'https://private.example.test',
		]) {
			expect(() =>
				assertHomeyShsStartupReportSafe(
					{ ...completeReport(), metadata: { ...completeReport().metadata, sdkVersion } },
					config,
				),
			).toThrow();
		}
	});

	it('writes only a private exact-schema report beneath the configured capture root', async () => {
		const temporaryRoot = await mkdtemp(join(tmpdir(), 'homey-startup-spike-'));
		const report = completeReport('offline-recovery');

		try {
			const outputDirectory = await writeHomeyShsStartupReport(report, temporaryRoot);
			const reportPath = join(outputDirectory, 'report.json');
			const parsed = JSON.parse(await readFile(reportPath, 'utf8')) as unknown;

			expect(outputDirectory.startsWith(join(temporaryRoot, 'startup-'))).toBe(true);
			expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700);
			expect((await stat(reportPath)).mode & 0o777).toBe(0o600);
			expect(parsed).toStrictEqual(report);
			expect(() => assertHomeyShsStartupReportSchema(parsed)).not.toThrow();
		} finally {
			await rm(temporaryRoot, { force: true, recursive: true });
		}
	});
});
