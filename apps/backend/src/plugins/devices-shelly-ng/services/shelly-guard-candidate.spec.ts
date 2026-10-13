import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';

import { SHELLY_GUARD_SOURCE } from '../contracts/guard-script-source';

// Execute the exact standalone candidate, not a reimplementation of its state machine.
const source = readFileSync(
	resolve(__dirname, '../../../../../../docs/work/virtual-thermostat/shelly-guard-candidate.js'),
	'utf8',
);
const config = {
	deviceId: 'fixture',
	model: 'SNSW-001P16EU',
	firmware: 'fixture-only',
	componentId: 0,
	floorComponentId: 100,
	floorComponentType: 'temperature',
	floorAttribute: 'tC',
	floorConfigurationJson: JSON.stringify({ id: 100, offset: 0 }),
	epochKey: 'fixture-epoch',
	evidenceId: 'offline-fixture-only',
	scriptRestartDrainQualified: true,
	nativeWritersExcluded: true,
	minLeaseMs: 1000,
	maxLeaseMs: 30000,
	watchdogMs: 100,
	floorMaxAgeMs: 5000,
	floorLimitC: 35,
	floorHysteresisC: 2,
};
interface Reply {
	result?: Record<string, unknown>;
	error?: string;
}
interface LocalCall {
	method: string;
	params: Record<string, unknown>;
	callback: (result: unknown, code: number, message?: string, userdata?: unknown) => void;
	userdata?: unknown;
}
class DeviceFixture {
	time = 1000;
	output = false;
	storedEpoch = 10;
	floor = 20;
	floorConfiguration: Record<string, unknown> = { id: 100, offset: 0 };
	floorComponentType = 'temperature';
	floorAttribute = 'tC';
	readonly handlers = new Map<string, (request: unknown, params: unknown) => void>();
	readonly calls: LocalCall[] = [];
	readonly timers: (() => void)[] = [];
	statusHandler: (event: unknown) => void;
	start(overrides = {}): void {
		this.handlers.clear();
		this.calls.length = 0;
		this.timers.length = 0;
		runInNewContext(source, {
			SP_GUARD_CONFIG: { ...config, ...overrides },
			Shelly: {
				getDeviceInfo: () => ({ id: config.deviceId, model: config.model, fw_id: config.firmware }),
				getUptimeMs: () => this.time,
				getComponentConfig: () => this.floorConfiguration,
				getComponentStatus: (type: string) => (type === 'temperature' ? { tC: this.floor } : { output: this.output }),
				call: (method: string, params: LocalCall['params'], callback: LocalCall['callback'], userdata?: unknown) =>
					this.calls.push({ method, params, callback, userdata }),
				addStatusHandler: (handler: DeviceFixture['statusHandler']) => {
					this.statusHandler = handler;
				},
			},
			HTTPServer: {
				registerEndpoint: (_name: string, handler: (request: unknown, response: unknown) => void) => {
					this.handlers.set('http', handler);
				},
			},
			Timer: { set: (_period: number, _repeat: boolean, handler: () => void) => this.timers.push(handler) },
		});
	}
	complete(method: string, code = 0): LocalCall {
		const index = this.calls.findIndex((call) => call.method === method);
		if (index < 0) throw new Error(`No pending ${method}`);
		const [call] = this.calls.splice(index, 1);
		let result: unknown = {};
		if (method === 'KVS.Get') result = { value: this.storedEpoch };
		if (method === 'KVS.Set' && code === 0) this.storedEpoch = call.params.value as number;
		if (method === 'Switch.Set' && code === 0) {
			result = { was_on: this.output };
			this.output = call.params.on as boolean;
		}
		if (method === 'Switch.GetStatus') result = { id: 0, output: this.output };
		call.callback(result, code, undefined, call.userdata);
		return call;
	}
	boot(): void {
		this.complete('Switch.Set'); // Immediate startup emergency OFF, without barrier proof.
		this.complete('KVS.Get');
		this.complete('KVS.Set');
		this.complete('Switch.Set');
		this.complete('Switch.GetStatus');
		this.floorReport(this.floor);
	}
	request(method: string, params: Record<string, unknown> = {}): Reply {
		const reply: Reply = {};
		const response = {
			code: 0,
			body: '',
			headers: [] as unknown[],
			send: () => {
				const parsed = JSON.parse(response.body) as Reply;
				Object.assign(reply, parsed);
			},
		};
		const action = { SPGuardStatus: 'status', SPGuardFence: 'fence', SPGuardOn: 'on' }[method];
		const query = new URLSearchParams({
			action,
			nonce: 'fixture',
			...Object.fromEntries(
				Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? String(value) : 'invalid']),
			),
		});
		this.handlers.get('http')({ method: 'GET', query: query.toString() }, response);
		return reply;
	}

	on(epoch = this.storedEpoch, untilMs = this.time + 5000): Reply {
		return this.request('SPGuardOn', { epoch, untilMs });
	}
	floorReport(tC: unknown): void {
		this.statusHandler({ component: `${this.floorComponentType}:100`, delta: { [this.floorAttribute]: tC } });
	}
}
const fixture = (): DeviceFixture => {
	const device = new DeviceFixture();
	device.start();
	device.boot();
	return device;
};

describe('packaged reviewed artifact', () => {
	it('matches the exact offline candidate', () => {
		expect(SHELLY_GUARD_SOURCE).toBe(source);
	});
});

describe('offline Shelly guard protocol candidate', () => {
	it('requires exact installed identity, restart drainage, and writer exclusion before exposing commands', () => {
		for (const overrides of [
			{ firmware: 'other' },
			{ scriptRestartDrainQualified: false },
			{ nativeWritersExcluded: false },
		]) {
			const device = new DeviceFixture();
			device.start(overrides);
			expect(device.handlers.size).toBe(0);
			expect(device.calls).toEqual([]);
		}
	});
	it('requires earlier ON completion, persisted epoch, and matched OFF readback before a barrier acknowledgement', () => {
		const device = fixture();
		const oldEpoch = device.storedEpoch;
		const on = device.on();
		const fence = device.request('SPGuardFence');
		device.complete('KVS.Set');
		expect(fence.result).toBeUndefined();
		device.complete('Switch.Set');
		expect(on.error).toBe('on_superseded');
		expect(device.output).toBe(true);
		expect(fence.result).toBeUndefined();
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		expect(fence.result).toMatchObject({ epoch: oldEpoch + 1, output: false, localOnDrained: true });
		expect(device.on(oldEpoch).error).toBe('on_not_admitted');
		expect(device.calls).toEqual([]);
	});
	it('cannot acknowledge a fence from an older OFF/readback while epoch persistence is pending', () => {
		const device = fixture();
		device.floorReport(null);
		device.complete('Switch.Set'); // Hold this old GetStatus.
		const fence = device.request('SPGuardFence');
		device.complete('Switch.GetStatus');
		expect(fence.result).toBeUndefined();
		expect(device.calls.map((call) => call.method)).toEqual(['KVS.Set']);
		device.complete('KVS.Set');
		expect(fence.result).toBeUndefined();
		device.complete('Switch.Set');
		expect(fence.result).toBeUndefined();
		device.complete('Switch.GetStatus');
		expect(fence.result?.localOnDrained).toBe(true);
	});
	it('waits for an older readback after persistence and then requires a fresh OFF/readback cycle', () => {
		const device = fixture();
		device.floorReport(null);
		device.complete('Switch.Set');
		const fence = device.request('SPGuardFence');
		device.complete('KVS.Set');
		expect(device.calls.map((call) => call.method)).toEqual(['Switch.GetStatus']);
		device.complete('Switch.GetStatus');
		expect(fence.result).toBeUndefined();
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		expect(fence.result?.localOnDrained).toBe(true);
	});

	it('holds the barrier when ON completes before epoch persistence', () => {
		const device = fixture();
		device.on();
		const fence = device.request('SPGuardFence');
		device.complete('Switch.Set');
		expect(device.calls.map((call) => call.method)).toEqual(['KVS.Set', 'Switch.Set']);
		expect(fence.result).toBeUndefined();
		device.complete('Switch.Set'); // Best-effort emergency OFF cannot acknowledge the barrier.
		device.complete('KVS.Set');
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		expect(fence.result?.localOnDrained).toBe(true);
	});
	it('rejects stale epochs after script restart and refuses missing persistent epoch', () => {
		const device = fixture();
		const oldEpoch = device.storedEpoch;
		device.start();
		device.boot();
		expect(device.on(oldEpoch).error).toBe('on_not_admitted');
		device.start();
		device.complete('KVS.Get', -1);
		expect(device.request('SPGuardStatus').result).toMatchObject({ ready: false, fault: 'epoch_storage_unqualified' });
		expect(device.on().error).toBe('on_not_admitted');
	});
	it('rejects absolute expiry and out-of-bounds leases before issuing native ON', () => {
		const device = fixture();
		for (const deadline of [device.time, device.time + 500, device.time + 30001, Infinity])
			expect(device.on(device.storedEpoch, deadline).error).toBe(
				deadline === Infinity ? 'invalid_query' : 'on_expired_or_unqualified',
			);
		expect(device.calls).toEqual([]);
		device.on();
		expect(device.calls[0].params).toEqual({ id: 0, on: true, toggle_after: 5 });
	});
	it('forces floor >= limit OFF and rearms only strictly below limit minus hysteresis', () => {
		const device = fixture();
		device.on();
		device.complete('Switch.Set');
		device.floorReport(35);
		expect(device.calls[0].params).toEqual({ id: 0, on: false });
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		device.floorReport(33);
		expect(device.on().error).toBe('on_not_admitted');
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		device.floorReport(32.9);
		expect(device.on().error).toBeUndefined();
	});
	it('uses a qualified native Celsius helper and revokes admission after helper configuration changes', () => {
		const device = new DeviceFixture();
		device.floorComponentType = 'voltmeter';
		device.floorAttribute = 'xvoltage';
		device.floorConfiguration = { id: 100, xvoltage: { expr: 'fixture-only', unit: '°C' } };
		device.start({
			floorComponentType: 'voltmeter',
			floorAttribute: 'xvoltage',
			floorConfigurationJson: JSON.stringify(device.floorConfiguration),
		});
		device.boot();
		expect(device.on().error).toBeUndefined();
		device.complete('Switch.Set');
		device.floorConfiguration = { id: 100, offset: 1 };
		expect(device.on().error).toBe('on_not_admitted');
		device.timers[0]();
		expect(device.calls[0].params).toEqual({ id: 0, on: false });
	});

	it('converts raw NTC voltage using supplied calibration and rejects invalid electrical readings', () => {
		const device = new DeviceFixture();
		device.floorComponentType = 'voltmeter';
		device.floorAttribute = 'voltage';
		device.floor = 6.68;
		device.floorConfiguration = { id: 100, xvoltage: { expr: null, unit: null } };
		device.start({
			floorComponentType: 'voltmeter',
			floorAttribute: 'voltage',
			floorConfigurationJson: JSON.stringify(device.floorConfiguration),
			floorConversion: {
				kind: 'steinhart_hart',
				referenceVoltage: 10,
				seriesResistance: 10000,
				a: 0.0010351024725298568,
				b: 0.0002338353574079741,
				c: 7.917851073336009e-8,
				thermistorLeg: 'low',
				inputRange: { minimum: 0.1, maximum: 9.9 },
				outputRange: { minimum: -40, maximum: 100 },
			},
		});
		device.boot();
		expect(device.request('SPGuardStatus').result).toMatchObject({ floorSafe: true });
		expect(device.request('SPGuardStatus').result.floorCelsius).toBeCloseTo(18.45, 2);
		expect(device.on().error).toBeUndefined();
		device.complete('Switch.Set');
		device.floorReport(1);
		expect(device.calls[0].params).toEqual({ id: 0, on: false });
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		for (const voltage of [null, '6.68', NaN, Infinity, 0, -1, 10, 11]) {
			device.floorReport(voltage);
			expect(device.on().error).toBe('on_not_admitted');
			device.complete('Switch.Set');
			device.complete('Switch.GetStatus');
		}
	});

	it.each([null, '35', NaN])('invalid floor %s inhibits heat immediately', (value) => {
		const device = fixture();
		device.floorReport(value);
		expect(device.calls[0].params).toEqual({ id: 0, on: false });
		expect(device.on().error).toBe('on_not_admitted');
	});
	it('watchdog issues emergency OFF even while native ON is stalled, without acknowledging a barrier', () => {
		const device = fixture();
		device.on();
		device.time += 5000;
		device.timers[0]();
		expect(device.calls.filter((call) => call.method === 'Switch.Set').map((call) => call.params.on)).toEqual([
			true,
			false,
		]);
		const fence = device.request('SPGuardFence');
		device.complete('KVS.Set');
		expect(fence.result).toBeUndefined();
	});
	it('unknown ON never mints drainage proof or rearms, even after OFF readback', () => {
		const device = fixture();
		device.on();
		const fence = device.request('SPGuardFence');
		device.complete('KVS.Set');
		device.complete('Switch.Set', -1);
		device.complete('Switch.Set');
		device.complete('Switch.GetStatus');
		expect(fence.result).toBeUndefined();
		expect(fence.error).toBe('on_execution_unknown');
		expect(device.on().error).toBe('on_not_admitted');
	});
});
