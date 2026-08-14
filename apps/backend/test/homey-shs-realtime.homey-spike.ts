import { EventEmitter } from 'node:events';

import {
	type HomeySdkFactory,
	assertHomeyShsRealtimeReportSafe,
	loadHomeyShsRealtimeProbeConfig,
	probeHomeyShsRealtime,
} from './support/homey-shs-realtime-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'test-api-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_REALTIME_OBSERVE_MS: '0',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

class FakeDevice extends EventEmitter {
	readonly capabilitiesObj = {
		onoff: { id: 'onoff', setable: true, type: 'boolean', value: false },
	};
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

class FakeDevicesManager extends EventEmitter {
	connectCount = 0;
	disconnectCount = 0;
	readonly device = new FakeDevice();
	readonly writes: Array<boolean | number | string> = [];
	private readonly invalidKey: boolean;

	constructor(invalidKey: boolean) {
		super();
		this.invalidKey = invalidKey;
	}

	connect(): Promise<void> {
		this.connectCount += 1;

		return Promise.resolve();
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;

		return Promise.resolve();
	}

	getDevices(): Promise<Record<string, FakeDevice>> {
		if (this.invalidKey) {
			return Promise.reject(
				Object.assign(new Error('raw invalid-key detail must not be retained'), { statusCode: 401 }),
			);
		}

		return Promise.resolve({ 'allowlisted-device': this.device });
	}

	getCapabilityValue(): Promise<{ value: boolean }> {
		return Promise.resolve({ value: this.device.capabilitiesObj.onoff.value });
	}

	setCapabilityValue(options: {
		capabilityId: string;
		deviceId: string;
		value: boolean | number | string;
	}): Promise<void> {
		this.writes.push(options.value);
		this.device.capabilitiesObj.onoff.value = options.value as boolean;
		this.device.emit('capability', {
			capabilityId: options.capabilityId,
			transactionId: `transaction-${this.writes.length}`,
			transactionTime: this.writes.length,
			value: options.value,
		});

		return Promise.resolve();
	}
}

class FakeHomeyClient extends EventEmitter {
	destroyCount = 0;
	disconnectCount = 0;
	readonly devices: FakeDevicesManager;

	constructor(invalidKey: boolean) {
		super();
		this.devices = new FakeDevicesManager(invalidKey);
	}

	disconnect(): Promise<void> {
		this.disconnectCount += 1;
		this.emit('disconnect');

		return Promise.resolve();
	}

	destroy(): void {
		this.destroyCount += 1;
		this.removeAllListeners();
	}
}

const createFactory = (): { clients: FakeHomeyClient[]; factory: HomeySdkFactory } => {
	const clients: FakeHomeyClient[] = [];
	const factory: HomeySdkFactory = {
		createLocalApi: ({ token }) => {
			const client = new FakeHomeyClient(token.startsWith('invalid-homey-probe-'));

			clients.push(client);

			return Promise.resolve(client);
		},
	};

	return { clients, factory };
};

describe('Homey SHS realtime compatibility probe', () => {
	it('keeps writes disabled when none of the four gate variables is present', () => {
		const config = loadHomeyShsRealtimeProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-realtime-spike');

		expect(config.write).toBeNull();
		expect(config.observeMs).toBe(0);
	});

	it('rejects partial, unacknowledged, and non-scalar write gates', () => {
		expect(() =>
			loadHomeyShsRealtimeProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_ENABLE: 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE',
			}),
		).toThrow('All four FB_HOMEY_SHS_WRITE_* variables');

		expect(() =>
			loadHomeyShsRealtimeProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_CAPABILITY_ID: 'onoff',
				FB_HOMEY_SHS_WRITE_DEVICE_ID: 'allowlisted-device',
				FB_HOMEY_SHS_WRITE_ENABLE: 'yes',
				FB_HOMEY_SHS_WRITE_VALUE: 'true',
			}),
		).toThrow('required acknowledgement');

		expect(() =>
			loadHomeyShsRealtimeProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_CAPABILITY_ID: 'onoff',
				FB_HOMEY_SHS_WRITE_DEVICE_ID: 'allowlisted-device',
				FB_HOMEY_SHS_WRITE_ENABLE: 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE',
				FB_HOMEY_SHS_WRITE_VALUE: '{"unsafe":true}',
			}),
		).toThrow('JSON boolean, finite number, or string');
	});

	it('subscribes and cleans up without mutating when the write gate is absent', async () => {
		const config = loadHomeyShsRealtimeProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-realtime-spike');
		const { clients, factory } = createFactory();
		const report = await probeHomeyShsRealtime(config, factory, () => Promise.resolve());

		expect(report.session).toMatchObject({ cleanupCompleted: true, managerSubscribed: true });
		expect(report.session.events.map(({ event }) => event)).toEqual([
			'sdk.create.resolved',
			'manager.subscribe.resolved',
			'manager.unsubscribe.resolved',
			'socket.disconnect',
			'socket.disconnect.resolved',
			'sdk.destroyed',
		]);
		expect(report.invalidKey).toEqual({ category: 'authentication', rejected: true, statusCode: 401 });
		expect(report.write.attempted).toBe(false);
		expect(clients).toHaveLength(2);
		expect(clients[0].devices.writes).toEqual([]);
		expect(clients[0].devices.disconnectCount).toBe(1);
		expect(clients[0].disconnectCount).toBe(1);
		expect(clients[0].destroyCount).toBe(1);
		expect(clients[1].disconnectCount).toBe(1);
		expect(clients[1].destroyCount).toBe(1);
		expect(() => assertHomeyShsRealtimeReportSafe(report, config)).not.toThrow();
		expect(JSON.stringify(report)).not.toContain(BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY);
		expect(JSON.stringify(report)).not.toContain('raw invalid-key detail');
	});

	it('writes only the exact allowlisted capability and restores its original value', async () => {
		const config = loadHomeyShsRealtimeProbeConfig(
			{
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_CAPABILITY_ID: 'onoff',
				FB_HOMEY_SHS_WRITE_DEVICE_ID: 'allowlisted-device',
				FB_HOMEY_SHS_WRITE_ENABLE: 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE',
				FB_HOMEY_SHS_WRITE_VALUE: 'true',
			},
			'/tmp/homey-realtime-spike',
		);
		const { clients, factory } = createFactory();
		const report = await probeHomeyShsRealtime(config, factory, () => Promise.resolve());

		expect(clients[0].devices.writes).toEqual([true, false]);
		expect(clients[0].devices.device.capabilitiesObj.onoff.value).toBe(false);
		expect(clients[0].devices.device.connectCount).toBe(1);
		expect(clients[0].devices.device.disconnectCount).toBe(1);
		expect(report.write).toEqual({
			attempted: true,
			eventObserved: true,
			readBackMatched: true,
			restoreReadBackMatched: true,
			restored: true,
		});
		expect(report.session.events.filter(({ event }) => event === 'capability.update')).toHaveLength(1);
		expect(() => assertHomeyShsRealtimeReportSafe(report, config)).not.toThrow();
	});

	it('rejects an unsafe target before issuing a write and still cleans up', async () => {
		const config = loadHomeyShsRealtimeProbeConfig(
			{
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_CAPABILITY_ID: 'missing',
				FB_HOMEY_SHS_WRITE_DEVICE_ID: 'allowlisted-device',
				FB_HOMEY_SHS_WRITE_ENABLE: 'I_ACKNOWLEDGE_THIS_CHANGES_A_TEST_DEVICE',
				FB_HOMEY_SHS_WRITE_VALUE: 'true',
			},
			'/tmp/homey-realtime-spike',
		);
		const { clients, factory } = createFactory();

		await expect(probeHomeyShsRealtime(config, factory, () => Promise.resolve())).rejects.toThrow(
			'allowlisted Homey write target was not found exactly',
		);
		expect(clients[0].devices.writes).toEqual([]);
		expect(clients[0].devices.disconnectCount).toBe(1);
		expect(clients[0].disconnectCount).toBe(1);
		expect(clients[0].destroyCount).toBe(1);
	});

	it('rejects dynamic or unordered event labels before writing a report', async () => {
		const config = loadHomeyShsRealtimeProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-realtime-spike');
		const { factory } = createFactory();
		const report = await probeHomeyShsRealtime(config, factory, () => Promise.resolve());

		report.session.events[0] = { event: 'private-device-id', order: 2 };

		expect(() => assertHomeyShsRealtimeReportSafe(report, config)).toThrow('unsafe or unordered event label');
	});
});
