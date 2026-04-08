/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { ConnectionState } from '../../../modules/devices/devices.constants';

import { ShellyWsServerService } from './shelly-ws-server.service';

function createService(
	overrides: {
		delegateEmit?: jest.Mock;
		delegateGet?: jest.Mock;
		findOneBy?: jest.Mock;
		setConnectionState?: jest.Mock;
	} = {},
) {
	const delegateEmit = overrides.delegateEmit ?? jest.fn().mockReturnValue(true);
	const delegateGet = overrides.delegateGet ?? jest.fn().mockReturnValue({ emit: delegateEmit });
	const findOneBy = overrides.findOneBy ?? jest.fn().mockResolvedValue({ id: 'db-device-1' });
	const setConnectionState = overrides.setConnectionState ?? jest.fn().mockResolvedValue(undefined);

	const svc = new ShellyWsServerService(
		{ getApp: jest.fn() } as any,
		{ get: delegateGet } as any,
		{ findOneBy } as any,
		{ setConnectionState } as any,
	);

	return { svc, delegateEmit, delegateGet, findOneBy, setConnectionState };
}

function makeWs(): { send: jest.Mock } {
	return { send: jest.fn() };
}

function callHandleMessage(svc: ShellyWsServerService, ws: any, frame: object): void {
	(svc as any).handleMessage(ws, Buffer.from(JSON.stringify(frame)), '127.0.0.1');
}

describe('ShellyWsServerService', () => {
	describe('handleMessage', () => {
		it('should ignore invalid JSON', () => {
			const { svc, delegateGet } = createService();

			(svc as any).handleMessage(makeWs(), Buffer.from('not json'), '127.0.0.1');

			expect(delegateGet).not.toHaveBeenCalled();
		});

		it('should ignore frames without src', () => {
			const { svc, delegateGet } = createService();

			callHandleMessage(svc, makeWs(), { method: 'NotifyStatus', params: {} });

			expect(delegateGet).not.toHaveBeenCalled();
		});

		it('should acknowledge frames with numeric id including 0', () => {
			const { svc } = createService();
			const ws = makeWs();

			callHandleMessage(svc, ws, { id: 0, src: 'shellyht-1', method: 'NotifyStatus', params: {} });

			expect(ws.send).toHaveBeenCalledTimes(1);

			const ack = JSON.parse(ws.send.mock.calls[0][0]);

			expect(ack).toEqual({ id: 0, src: 'fb-smart-panel', dst: 'shellyht-1', result: null });
		});

		it('should not acknowledge frames without id', () => {
			const { svc } = createService();
			const ws = makeWs();

			callHandleMessage(svc, ws, { src: 'shellyht-1', method: 'NotifyStatus', params: {} });

			expect(ws.send).not.toHaveBeenCalled();
		});

		it('should route NotifyStatus to delegate with flattened keys', () => {
			const { svc, delegateEmit } = createService();

			callHandleMessage(svc, makeWs(), {
				src: 'shellyht-1',
				method: 'NotifyStatus',
				params: {
					'devicepower:0': {
						battery: { percent: 95, V: 3.2 },
					},
				},
			});

			// Should emit: battery (object), battery.percent (leaf), battery.V (leaf)
			const calls = delegateEmit.mock.calls.filter((c: unknown[]) => c[0] === 'value' && c[1] === 'devicepower:0');

			const keys = calls.map((c: unknown[]) => c[2]);

			expect(keys).toContain('battery');
			expect(keys).toContain('battery.percent');
			expect(keys).toContain('battery.V');
		});

		it('should skip ts field in status params', () => {
			const { svc, delegateEmit } = createService();

			callHandleMessage(svc, makeWs(), {
				src: 'shellyht-1',
				method: 'NotifyStatus',
				params: {
					ts: 1234567890,
					'temperature:0': { tC: 22.5 },
				},
			});

			const calls = delegateEmit.mock.calls.filter((c: unknown[]) => c[0] === 'value');

			// Only temperature:0 values, no ts
			expect(calls.every((c: unknown[]) => c[1] === 'temperature:0')).toBe(true);
		});

		it('should not process messages when stopped', () => {
			const { svc, delegateGet } = createService();

			svc.stop();

			callHandleMessage(svc, makeWs(), {
				src: 'shellyht-1',
				method: 'NotifyStatus',
				params: { 'temperature:0': { tC: 22 } },
			});

			expect(delegateGet).not.toHaveBeenCalled();
		});

		it('should skip status if no delegate exists', () => {
			const { svc, delegateEmit } = createService({
				delegateGet: jest.fn().mockReturnValue(undefined),
			});

			callHandleMessage(svc, makeWs(), {
				src: 'unknown-device',
				method: 'NotifyStatus',
				params: { 'temperature:0': { tC: 22 } },
			});

			expect(delegateEmit).not.toHaveBeenCalled();
		});
	});

	describe('state serialization', () => {
		it('should set CONNECTED then SLEEPING in order', async () => {
			const stateLog: string[] = [];
			const setConnectionState = jest.fn().mockImplementation((_id: string, { state }: { state: string }) => {
				stateLog.push(state);

				return Promise.resolve();
			});

			const { svc } = createService({ setConnectionState });

			// Simulate wake cycle: message arrives, then WS closes
			callHandleMessage(svc, makeWs(), {
				src: 'shellyht-1',
				method: 'NotifyStatus',
				params: { 'temperature:0': { tC: 22 } },
			});

			// Trigger sleeping via the private method
			(svc as any).markDeviceSleeping('shellyht-1');

			// Wait for the queue to drain
			const queue = (svc as any).stateQueue as Map<string, Promise<void>>;
			const pending = queue.get('shellyht-1');

			await (pending ?? Promise.resolve());

			expect(stateLog).toEqual([ConnectionState.CONNECTED, ConnectionState.SLEEPING]);
		});
	});

	describe('stop', () => {
		it('should clear wsToDeviceId and stateQueue', () => {
			const { svc } = createService();

			// Populate internal maps via handleMessage
			callHandleMessage(svc, makeWs(), {
				src: 'shellyht-1',
				method: 'NotifyStatus',
				params: { 'temperature:0': { tC: 22 } },
			});

			expect((svc as any).wsToDeviceId.size).toBe(1);

			svc.stop();

			expect((svc as any).wsToDeviceId.size).toBe(0);
			expect((svc as any).stateQueue.size).toBe(0);
			expect((svc as any).stopped).toBe(true);
		});
	});
});
