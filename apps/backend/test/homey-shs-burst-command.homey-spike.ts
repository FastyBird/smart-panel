import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyShsBurstCommandConfig,
	assertHomeyShsBurstCommandReportSafe,
	loadHomeyShsBurstCommandConfig,
	probeHomeyShsBurstCommand,
	writeHomeyShsBurstCommandReport,
} from './support/homey-shs-burst-command-probe';
import {
	type HomeyMappingControlBinding,
	type HomeyMappingControlRuntime,
} from './support/homey-shs-mapping-control-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_BURST_COMMAND_CAPABILITY_ID: 'test-capability-that-must-not-leak',
	FB_HOMEY_SHS_BURST_COMMAND_DEVICE_ID: 'test-device-that-must-not-leak',
	FB_HOMEY_SHS_BURST_COMMAND_ENABLE: 'I_WILL_RUN_AND_RESTORE_CONCURRENT_COMMANDS_ONLY_ON_THE_ALLOWLISTED_HOMEY_TARGET',
	FB_HOMEY_SHS_BURST_COMMAND_FAMILY: 'cover',
	FB_HOMEY_SHS_BURST_COMMAND_MAPPING_NAME: 'window-covering-position',
	FB_HOMEY_SHS_BURST_COMMAND_PANEL_VALUE: '50',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const config = (overrides: Partial<HomeyShsBurstCommandConfig> = {}): HomeyShsBurstCommandConfig => ({
	...loadHomeyShsBurstCommandConfig(BASE_ENVIRONMENT, '/tmp/homey-burst-command'),
	...overrides,
});

class FakeBinding implements HomeyMappingControlBinding {
	readonly availableFamilies = ['cover', 'lighting', 'switch'] as const;
	readonly baselinePanelValue = 0;
	readonly targetPanelValue = 50;
	readonly commands: Array<string | number | boolean> = [];
	afterCommand: ((value: string | number | boolean) => void) | undefined;
	current: string | number | boolean = 0;
	failCommandAt = new Set<number>();
	failReadBackAt = new Set<number>();
	observed = true;
	readBackCount = 0;
	private observedOffset = 0;

	command(value: string | number | boolean): Promise<boolean> {
		this.commands.push(value);
		this.current = value;
		this.afterCommand?.(value);

		return Promise.resolve(!this.failCommandAt.has(this.commands.length));
	}

	observedPanelSequenceMatches(values: readonly (string | number | boolean)[]): boolean {
		return this.observed && values.every((value, index) => this.commands[this.observedOffset + index] === value);
	}

	readBackMatches(value: string | number | boolean): Promise<boolean> {
		this.readBackCount += 1;

		return Promise.resolve(this.current === value && !this.failReadBackAt.has(this.readBackCount));
	}

	resetObservedPanelSequence(): void {
		this.observedOffset = this.commands.length;
	}

	waitForCommandIdle(): Promise<void> {
		return Promise.resolve();
	}
}

class FakeRuntime implements HomeyMappingControlRuntime {
	readonly binding = new FakeBinding();
	readonly bindOptions: Array<{ allowUnchangedTarget?: boolean } | undefined> = [];
	bindCount = 0;
	startCount = 0;
	stopCount = 0;

	bind(
		_config?: HomeyShsBurstCommandConfig,
		options?: { allowUnchangedTarget?: boolean },
	): Promise<HomeyMappingControlBinding> {
		this.bindCount += 1;
		this.bindOptions.push(options);

		return Promise.resolve(this.binding);
	}

	start(): Promise<void> {
		this.startCount += 1;

		return Promise.resolve();
	}

	stop(): Promise<void> {
		this.stopCount += 1;

		return Promise.resolve();
	}
}

const successfulProbe = async () => {
	const runtime = new FakeRuntime();
	const report = await probeHomeyShsBurstCommand(config(), () => runtime);

	return { report, runtime };
};

describe('Homey SHS burst-command probe', () => {
	it('requires the exact gate, mapping target, and panel value while rejecting unrelated gates', () => {
		expect(() =>
			loadHomeyShsBurstCommandConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_BURST_COMMAND_ENABLE: 'yes' }),
		).toThrow('required acknowledgement');
		expect(() =>
			loadHomeyShsBurstCommandConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_BURST_COMMAND_FAMILY: 'sensor' }),
		).toThrow('must be exactly cover, lighting, lock, or switch');
		expect(() =>
			loadHomeyShsBurstCommandConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_BURST_COMMAND_MAPPING_NAME: 'light-power',
			}),
		).toThrow('not allowed for the selected family');
		expect(() =>
			loadHomeyShsBurstCommandConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_BURST_COMMAND_DEVICE_ID: ' ' }),
		).toThrow('target and panel value are required');
		expect(() =>
			loadHomeyShsBurstCommandConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_MAPPING_CONTROL_ENABLE: '' }),
		).toThrow('must be unset');
	});

	it('submits three commands concurrently, verifies ordered events and final state, then restores', async () => {
		const { report, runtime } = await successfulProbe();

		expect(() => assertHomeyShsBurstCommandReportSafe(report, config())).not.toThrow();
		expect(report).toMatchObject({
			observation: {
				baselineRead: true,
				concurrentCommandsAccepted: true,
				finalReadBackMatched: true,
				orderedCapabilityEventsObserved: true,
				restorationAccepted: true,
				restorationReadBackMatched: true,
				restored: true,
			},
			session: { cleanupCompleted: true, serviceStarted: true },
		});
		expect(report.session.events).toHaveLength(13);
		expect(runtime.binding.commands).toStrictEqual([50, 0, 50, 0]);
		expect(runtime.binding.current).toBe(0);
		expect(runtime.startCount).toBe(1);
		expect(runtime.bindCount).toBe(1);
		expect(runtime.stopCount).toBe(1);
	});

	it('fails when the ordered capability-event burst is absent and restores before stopping', async () => {
		const runtime = new FakeRuntime();
		runtime.binding.observed = false;

		await expect(probeHomeyShsBurstCommand(config(), () => runtime)).rejects.toThrow(
			'ordered capability events were not observed',
		);
		expect(runtime.binding.commands).toStrictEqual([50, 0, 50, 0]);
		expect(runtime.binding.current).toBe(0);
		expect(runtime.stopCount).toBe(1);
	});

	it('waits for queued commands and restores after a concurrent command rejection', async () => {
		const runtime = new FakeRuntime();
		runtime.binding.failCommandAt.add(2);

		await expect(probeHomeyShsBurstCommand(config(), () => runtime)).rejects.toThrow('rejected or unconfirmed');
		expect(runtime.binding.commands).toStrictEqual([50, 0, 50, 0]);
		expect(runtime.binding.current).toBe(0);
		expect(runtime.stopCount).toBe(1);
	});

	it('bounds a retained write tail, stops its runtime, and restores through a fresh runtime', async () => {
		const primary = new FakeRuntime();
		const recovery = new FakeRuntime();
		const neverSettles = new Promise<void>(() => undefined);
		const runtimes = [primary, recovery];

		primary.binding.failCommandAt.add(1);
		primary.binding.waitForCommandIdle = () => neverSettles;

		await expect(
			probeHomeyShsBurstCommand(config({ timeoutMs: 1 }), () => runtimes.shift() ?? recovery),
		).rejects.toThrow('rejected or unconfirmed');
		expect(primary.stopCount).toBe(1);
		expect(recovery.startCount).toBe(1);
		expect(recovery.bindOptions).toStrictEqual([{ allowUnchangedTarget: true }]);
		expect(recovery.binding.commands).toStrictEqual([0]);
		expect(recovery.binding.current).toBe(0);
		expect(recovery.stopCount).toBe(1);
	});

	it('bounds a failed cancellation stop instead of hanging cleanup indefinitely', async () => {
		const runtime = new FakeRuntime();
		const neverSettles = new Promise<void>(() => undefined);

		runtime.binding.failCommandAt.add(1);
		runtime.binding.waitForCommandIdle = () => neverSettles;
		runtime.stop = () => {
			runtime.stopCount += 1;

			return neverSettles;
		};

		await expect(probeHomeyShsBurstCommand(config({ timeoutMs: 1 }), () => runtime)).rejects.toThrow(
			'cleanup failed: capability restoration, service stop',
		);
		expect(runtime.stopCount).toBe(2);
	});

	it.each(['SIGINT', 'SIGTERM'] as const)('restores and stops before completing %s termination', async (signal) => {
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
		runtime.binding.afterCommand = (): void => {
			listeners.get(signal)?.();
		};

		await expect(probeHomeyShsBurstCommand(config(), () => runtime, signalSource)).rejects.toThrow(
			`received ${signal}; restoration completed before termination`,
		);
		expect(runtime.binding.current).toBe(0);
		expect(runtime.stopCount).toBe(1);
		expect(listeners.size).toBe(0);
	});

	it('fails closed when restoration cannot be confirmed and always stops the service', async () => {
		const runtime = new FakeRuntime();
		runtime.binding.failCommandAt.add(4);
		runtime.binding.failCommandAt.add(5);
		runtime.binding.failReadBackAt.add(2);

		await expect(probeHomeyShsBurstCommand(config(), () => runtime)).rejects.toThrow(
			'cleanup failed: capability restoration',
		);
		expect(runtime.binding.commands).toStrictEqual([50, 0, 50, 0, 0]);
		expect(runtime.stopCount).toBe(1);
	});

	it('rejects extra fields, reordered evidence, and private values', async () => {
		const { report } = await successfulProbe();

		expect(() => assertHomeyShsBurstCommandReportSafe({ ...report, extra: true }, config())).toThrow(
			'root schema is invalid',
		);
		expect(() =>
			assertHomeyShsBurstCommandReportSafe(
				{ ...report, session: { ...report.session, events: [...report.session.events].reverse() } },
				config(),
			),
		).toThrow();
		expect(() =>
			assertHomeyShsBurstCommandReportSafe(
				{ ...report, metadata: { ...report.metadata, sdkVersion: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY } },
				config(),
			),
		).toThrow();
	});

	it('preserves the sanitized live SHS burst-command evidence', async () => {
		const evidencePath = join(
			__dirname,
			'../src/plugins/devices-homey/__fixtures__/evidence/2026-08-28-shs-13.4.1-burst-command.json',
		);
		const evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as unknown;

		assertHomeyShsBurstCommandReportSafe(evidence, config());
		expect(evidence).toMatchObject({
			observation: {
				baselineRead: true,
				concurrentCommandsAccepted: true,
				finalReadBackMatched: true,
				orderedCapabilityEventsObserved: true,
				restorationAccepted: true,
				restorationReadBackMatched: true,
				restored: true,
			},
			session: { cleanupCompleted: true, serviceStarted: true },
		});
		expect(evidence.session.events).toHaveLength(13);
	});

	it('writes the report beneath a private non-overwriting directory', async () => {
		const { report } = await successfulProbe();
		const parent = await mkdtemp(join(tmpdir(), 'homey-burst-command-'));
		const root = join(parent, 'new-capture-root');

		try {
			const directory = await writeHomeyShsBurstCommandReport(report, root);
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
