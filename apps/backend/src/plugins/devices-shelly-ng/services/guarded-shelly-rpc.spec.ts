import { EventEmitter } from 'events';
import { ShellyPlus1Pm, ShellyPlusDimmer } from 'shellies-ds9';
import WebSocket from 'ws';

import { ShellyDeviceDelegate } from '../delegates/shelly-device.delegate';

import { GuardedShellyRpcHandler } from './guarded-shelly-rpc';

class FixtureTransport extends GuardedShellyRpcHandler {
	gate: Promise<void> = Promise.resolve();
	protected override createSocket(): WebSocket {
		return Object.assign(new EventEmitter(), { readyState: WebSocket.OPEN, send: jest.fn() }) as unknown as WebSocket;
	}
	protected override connect(): Promise<void> {
		return this.gate;
	}
	protected override disconnect(): Promise<void> {
		return Promise.resolve();
	}
	get frames(): { id: number; method: string; params: Record<string, unknown> }[] {
		// Jest records the fake socket method without invoking it unbound.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const sender = this.socket.send as jest.Mock;
		return sender.mock.calls.map(([data]: [string]) => JSON.parse(data) as (typeof this.frames)[number]);
	}
	answer(
		error?: { code: number; message: string },
		result: Record<string, unknown> = { was_on: false },
		id = this.frames.at(-1).id,
	): void {
		this.client.receive({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) });
	}
	ackSend(): void {
		(this.socket.send as jest.Mock).mockImplementation((_data: string, callback: (error?: Error) => void) =>
			callback(),
		);
	}
}
const flush = async (): Promise<void> => {
	for (let index = 0; index < 32; index++) await Promise.resolve();
};
const fixture = (): FixtureTransport => {
	const rpc = new FixtureTransport('fixture.invalid', {
		clientId: 'fixture',
		requestTimeout: 2,
		pingInterval: 0,
		reconnectInterval: 0,
		password: 'fixture-only',
	});
	rpc.ackSend();
	return rpc;
};

describe('guarded Shelly transport at real SDK send and authentication retry', () => {
	it.each([false, true])(
		'does not send a settled SDK request after connect resumes (authority=%s)',
		async (guarded) => {
			jest.useFakeTimers();
			const rpc = fixture();
			try {
				const physical = new ShellyPlus1Pm({ id: 'physical', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
				let release: () => void;
				rpc.gate = new Promise<void>((resolve) => {
					release = resolve;
				});
				const invoke = () => physical.switch0.set(true, 5);
				const result = Promise.resolve(guarded ? rpc.withSendGuard(() => true, invoke) : invoke()).catch(() => false);
				await jest.advanceTimersByTimeAsync(2001);
				expect(await result).toBe(false);
				release();
				await flush();
				expect(rpc.frames).toEqual([]);
			} finally {
				await rpc.destroy();
				jest.useRealTimers();
			}
		},
	);

	it('never sends queued Switch.set ON after its authority expires during connect', async () => {
		const rpc = fixture();
		const physical = new ShellyPlus1Pm({ id: 'physical', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		let release: () => void;
		rpc.gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let current = true;
		const result = Promise.resolve(
			rpc.withSendGuard(
				() => current,
				() => physical.switch0.set(true, 5),
			),
		).catch(() => false);
		current = false;
		release();
		expect(await result).toBe(false);
		expect(rpc.frames).toEqual([]);
		await rpc.destroy();
	});

	it('never retries authenticated ON after OFF/claim supersession; ordinary OFF remains absolute', async () => {
		const rpc = fixture();
		const physical = new ShellyPlus1Pm({ id: 'physical', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		let current = true;
		const result = Promise.resolve(
			rpc.withSendGuard(
				() => current,
				() => physical.switch0.set(true, 5),
			),
		).catch(() => false);
		await flush();
		expect(rpc.frames).toHaveLength(1);
		current = false;
		rpc.answer({
			code: 401,
			message: JSON.stringify({ auth_type: 'digest', algorithm: 'SHA-256', realm: 'fixture', nonce: 1 }),
		});
		expect(await result).toBe(false);
		expect(rpc.frames).toHaveLength(1);
		const off = Promise.resolve(physical.switch0.set(false));
		await flush();
		expect(rpc.frames.at(-1).params).toEqual({ id: 0, on: false });
		rpc.answer();
		await off;
		await rpc.destroy();
	});
	it('protective OFF supersedes an already queued qualified ON; missing claim guards never energize', async () => {
		const rpc = fixture();
		const physical = new ShellyPlus1Pm({ id: 'physical', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const delegate = new ShellyDeviceDelegate(physical);
		const command = {
			on: true as const,
			leaseSeconds: 5,
			qualification: {
				deviceId: 'physical',
				model: ShellyPlus1Pm.model,
				firmware: 'fixture',
				componentId: 0,
				evidenceId: 'fixture-only',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 30 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		};
		expect((await delegate.protectiveSwitch(0, command, 1000)).outcome).toBe('refused');
		expect(rpc.frames).toHaveLength(0);
		const on = delegate.protectiveSwitch(0, command, 1000, () => true);
		await flush();
		let release: () => void;
		rpc.gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		rpc.answer(undefined, { id: 'physical', model: ShellyPlus1Pm.model, fw_id: 'fixture' });
		await flush();
		const off = delegate.protectiveSwitch(0, { on: false }, 1000, () => true);
		release();
		await flush();
		expect(rpc.frames.filter((frame) => frame.method === 'Switch.Set').map((frame) => frame.params)).toEqual([
			{ id: 0, on: false },
		]);
		rpc.answer();
		expect((await on).outcome).toBe('unknown');
		expect((await off).outcome).toBe('accepted');
		delegate.destroy();
		await rpc.destroy();
	});

	it('ordinary Light.set carries exact explicit ON/brightness with no protective timer and fences claim supersession', async () => {
		const rpc = fixture();
		const physical = new ShellyPlusDimmer({ id: 'dimmer', mac: '000000000002', model: ShellyPlusDimmer.model }, rpc);
		const delegate = new ShellyDeviceDelegate(physical);
		const prepared = delegate.prepareLightingCommand('light:0', true, 42);
		expect(prepared).not.toBeNull();
		let release: () => void;
		rpc.gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let admitted = true;
		const rejected = prepared.dispatch(() => admitted);
		admitted = false;
		release();
		expect(await rejected).toBe(false);
		expect(rpc.frames).toHaveLength(0);
		const accepted = prepared.dispatch(() => true);
		await flush();
		expect(rpc.frames.at(-1)).toMatchObject({ method: 'Light.Set', params: { id: 0, on: true, brightness: 42 } });
		expect(rpc.frames.at(-1).params).not.toHaveProperty('toggle_after');
		rpc.answer();
		expect(await accepted).toBe(true);
		delegate.destroy();
		await rpc.destroy();
	});
	it('protective OFF prevents a pending authenticated ON retry after OFF acceptance', async () => {
		const rpc = fixture();
		const physical = new ShellyPlus1Pm({ id: 'physical', mac: '000000000001', model: ShellyPlus1Pm.model }, rpc);
		const delegate = new ShellyDeviceDelegate(physical);
		const on = delegate.protectiveSwitch(
			0,
			{
				on: true,
				leaseSeconds: 5,
				qualification: {
					deviceId: 'physical',
					model: ShellyPlus1Pm.model,
					firmware: 'fixture',
					componentId: 0,
					evidenceId: 'fixture-only',
					revision: 1,
					testedLeaseSeconds: { min: 1, max: 30 },
					releaseOrderingQualified: true,
					independentProtectionQualified: true,
				},
			},
			1000,
			() => true,
		);
		await flush();
		rpc.answer(undefined, { id: 'physical', model: ShellyPlus1Pm.model, fw_id: 'fixture' });
		await flush();
		const pendingOnId = rpc.frames.at(-1).id;
		const off = delegate.protectiveSwitch(0, { on: false }, 1000, () => true);
		await flush();
		rpc.answer();
		expect((await off).outcome).toBe('accepted');
		rpc.answer(
			{ code: 401, message: JSON.stringify({ auth_type: 'digest', algorithm: 'SHA-256', realm: 'fixture', nonce: 2 }) },
			{},
			pendingOnId,
		);
		expect((await on).outcome).toBe('unknown');
		expect(rpc.frames.filter((frame) => frame.method === 'Switch.Set').map((frame) => frame.params.on)).toEqual([
			true,
			false,
		]);
		delegate.destroy();
		await rpc.destroy();
	});
});
