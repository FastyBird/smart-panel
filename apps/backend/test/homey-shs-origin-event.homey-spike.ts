import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyOriginEventScenario,
	type HomeyShsOriginEventConfig,
	assertHomeyShsOriginEventReportSafe,
	loadHomeyShsOriginEventConfig,
	probeHomeyShsOriginEvent,
	writeHomeyShsOriginEventReport,
} from './support/homey-shs-origin-event-probe';
import {
	type HomeyDevice,
	type HomeyScalar,
	type HomeySdkClient,
	type HomeySdkFactory,
} from './support/homey-shs-realtime-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_ORIGIN_EVENT_CAPABILITY_ID: 'test-capability-that-must-not-leak',
	FB_HOMEY_SHS_ORIGIN_EVENT_DEVICE_ID: 'test-device-that-must-not-leak',
	FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE:
		'I_WILL_CHANGE_AND_RESTORE_ONLY_THE_ALLOWLISTED_HOMEY_CAPABILITY_OUTSIDE_SMART_PANEL',
	FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS: '1000',
	FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO: 'physical',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

class FakeDevice extends EventEmitter implements HomeyDevice {
	capabilitiesObj = { 'test-capability-that-must-not-leak': { setable: false, type: 'boolean' } };
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
	readonly inventoryOptions: Array<{ $cache?: boolean; $timeout?: number; $updateCache?: boolean }> = [];
	value: HomeyScalar = false;
	writes: unknown[] = [];

	connect(): Promise<void> {
		this.connected = true;

		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.connected = false;

		return Promise.resolve();
	}

	emitExternal(value: unknown, capabilityId = 'test-capability-that-must-not-leak'): void {
		if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') this.value = value;
		this.device.emit('capability', { capabilityId, value });
	}

	getCapabilityValue(): Promise<unknown> {
		return Promise.resolve(this.value);
	}

	getDevices(
		options: { $cache?: boolean; $timeout?: number; $updateCache?: boolean } = {},
	): Promise<Record<string, HomeyDevice>> {
		this.inventoryOptions.push(options);

		return Promise.resolve({ 'test-device-that-must-not-leak': this.device });
	}

	setCapabilityValue(options: { value: unknown }): Promise<void> {
		this.writes.push(options.value);

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
}

const createFactory = (): { client: FakeClient; factory: HomeySdkFactory } => {
	const client = new FakeClient();

	return { client, factory: { createLocalApi: () => Promise.resolve(client) } };
};

const config = (overrides: Partial<HomeyShsOriginEventConfig> = {}): HomeyShsOriginEventConfig => ({
	...loadHomeyShsOriginEventConfig(BASE_ENVIRONMENT, '/tmp/homey-origin-event'),
	...overrides,
});

const successfulProbe = async (scenario: HomeyOriginEventScenario = 'physical') => {
	const { client, factory } = createFactory();
	const report = await probeHomeyShsOriginEvent(
		config({ scenario }),
		factory,
		() => Promise.resolve(),
		() => {
			client.devices.emitExternal(false, 'other-capability');
			client.devices.emitExternal(false);
			client.devices.emitExternal(true);
		},
		() => client.devices.emitExternal(false),
	);

	return { client, report };
};

describe('Homey SHS origin-event probe', () => {
	it.each(['physical', 'homey', 'flow'] as const)('accepts the exact %s origin scenario', (scenario) => {
		expect(
			loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO: scenario }).scenario,
		).toBe(scenario);
	});

	it('requires the exact gate and target while rejecting mutation or recovery gates', () => {
		expect(() =>
			loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_ENABLE: 'yes' }),
		).toThrow('required acknowledgement');
		expect(() =>
			loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_DEVICE_ID: ' ' }),
		).toThrow('device and capability allowlist');
		expect(() =>
			loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_SCENARIO: 'automation' }),
		).toThrow('must be exactly physical, homey, or flow');
		expect(() => loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_WRITE_ENABLE: '' })).toThrow(
			'must be unset',
		);
		expect(() =>
			loadHomeyShsOriginEventConfig({ ...BASE_ENVIRONMENT, FB_HOMEY_SHS_ORIGIN_EVENT_OBSERVE_MS: '999' }),
		).toThrow('between 1000 and 300000');
	});

	it.each(['physical', 'homey', 'flow'] as const)(
		'verifies a %s-origin change and restoration without issuing a Smart Panel write',
		async (scenario) => {
			const { client, report } = await successfulProbe(scenario);

			expect(report.observation).toStrictEqual({
				baselineRead: true,
				changeEventObserved: true,
				changeReadBackMatched: true,
				restorationEventObserved: true,
				restorationReadBackMatched: true,
				restored: true,
				scenario,
			});
			expect(report.session.events.map(({ event }) => event)).toStrictEqual([
				'sdk.create.resolved',
				'manager.subscribe.resolved',
				'inventory.read.resolved',
				'device.subscribe.resolved',
				'baseline.read.verified',
				'change.window.open',
				'change.event.observed',
				'change.readback.verified',
				'restore.window.open',
				'restore.event.observed',
				'restore.readback.verified',
				'device.unsubscribe.resolved',
				'manager.unsubscribe.resolved',
				'socket.disconnect.resolved',
				'sdk.destroyed',
			]);
			expect(client.devices.inventoryOptions).toStrictEqual([{ $cache: false, $timeout: 1000, $updateCache: true }]);
			expect(client.devices.writes).toStrictEqual([]);
			expect(client.devices.device.disconnectCount).toBe(1);
			expect(client.disconnectCount).toBe(1);
			expect(client.destroyCount).toBe(1);
			expect(() => assertHomeyShsOriginEventReportSafe(report, config({ scenario }))).not.toThrow();
		},
	);

	it('rejects missing restoration evidence while cleaning up without writing', async () => {
		const { client, factory } = createFactory();
		let now = 0;
		const dateNow = jest.spyOn(Date, 'now').mockImplementation(() => now);
		const advance = (milliseconds: number): Promise<void> => {
			now += milliseconds;

			return Promise.resolve();
		};

		try {
			await expect(
				probeHomeyShsOriginEvent(config(), factory, advance, () => client.devices.emitExternal(true)),
			).rejects.toThrow('operator restoration event observation timed out');
			expect(client.devices.writes).toStrictEqual([]);
			expect(client.devices.value).toBe(true);
			expect(client.destroyCount).toBe(1);
		} finally {
			dateNow.mockRestore();
		}
	});

	it('rejects extra fields, invalid ordering, and private values', async () => {
		const { report } = await successfulProbe();

		expect(() => assertHomeyShsOriginEventReportSafe({ ...report, extra: true }, config())).toThrow(
			'root schema is invalid',
		);
		expect(() =>
			assertHomeyShsOriginEventReportSafe(
				{
					...report,
					session: {
						...report.session,
						events: [...report.session.events].reverse().map((event, index) => ({ ...event, order: index + 1 })),
					},
				},
				config(),
			),
		).toThrow('ordering is invalid');
		expect(() =>
			assertHomeyShsOriginEventReportSafe(
				{ ...report, metadata: { ...report.metadata, sdkVersion: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY } },
				config(),
			),
		).toThrow();
	});

	it('writes the report beneath a private non-overwriting directory', async () => {
		const { report } = await successfulProbe();
		const root = await mkdtemp(join(tmpdir(), 'homey-origin-event-'));

		try {
			const directory = await writeHomeyShsOriginEventReport(report, root);
			const path = join(directory, 'report.json');
			expect((await stat(directory)).mode & 0o777).toBe(0o700);
			expect((await stat(path)).mode & 0o777).toBe(0o600);
			expect(JSON.parse(await readFile(path, 'utf8'))).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
