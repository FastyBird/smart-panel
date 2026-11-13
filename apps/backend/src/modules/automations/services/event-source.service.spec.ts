import { ConnectionState } from '../../devices/devices.constants';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { AlarmState, ArmedState } from '../../security/security.constants';
import { HouseMode } from '../../system/system.constants';
import { DEVICE_A, DEVICE_B, SCENE_ID } from '../testing/node-fixtures';

import { AutomationEventSourceService, connectionOnline } from './event-source.service';

const flush = async (): Promise<void> => {
	for (let turn = 0; turn < 5; turn++) {
		await Promise.resolve();
	}
};

describe('AutomationEventSourceService', () => {
	let readLatest: jest.Mock;
	let service: AutomationEventSourceService;

	const connectionChanged = (deviceId: string, state: ConnectionState | undefined): void =>
		service.handleDeviceConnectionChanged({ device: { id: deviceId }, state, reason: null });

	beforeEach(() => {
		readLatest = jest.fn(() => Promise.resolve({ online: true, status: ConnectionState.READY, lastChanged: null }));
		service = new AutomationEventSourceService({ readLatest } as unknown as DeviceConnectionStateService);
	});

	describe('button occurrences', () => {
		const occurrence = {
			id: 'occurrence-1',
			deviceId: DEVICE_A,
			channelId: 'channel-1',
			propertyId: 'property-1',
			event: 'long_press',
			timestamp: '2026-11-13T10:00:00.000Z',
		};

		it('hands every occurrence to every subscriber, through one listener of the bus', () => {
			const first = jest.fn();
			const second = jest.fn();

			service.onButtonOccurrence(first);
			service.onButtonOccurrence(second);

			service.handleChannelInputOccurrence(occurrence);

			const expected = {
				id: 'occurrence-1',
				deviceId: DEVICE_A,
				channelId: 'channel-1',
				propertyId: 'property-1',
				event: 'long_press',
			};

			expect(first).toHaveBeenCalledWith(expected);
			expect(second).toHaveBeenCalledWith(expected);
		});

		it('keeps calling the others when one subscriber throws, and throws nothing into the bus', () => {
			const broken = jest.fn(() => {
				throw new Error('broken');
			});
			const working = jest.fn();

			service.onButtonOccurrence(broken);
			service.onButtonOccurrence(working);

			expect(() => service.handleChannelInputOccurrence(occurrence)).not.toThrow();
			expect(working).toHaveBeenCalled();
		});

		it('ignores a payload it can not read, and stops calling a released subscriber', () => {
			const listener = jest.fn();
			const release = service.onButtonOccurrence(listener);

			service.handleChannelInputOccurrence(null);
			service.handleChannelInputOccurrence({ ...occurrence, event: undefined });

			expect(listener).not.toHaveBeenCalled();

			release();
			service.handleChannelInputOccurrence(occurrence);

			expect(listener).not.toHaveBeenCalled();
			expect(service.subscriptionCount()).toBe(0);
		});

		it('keeps the same function subscribed twice as two subscriptions', () => {
			const listener = jest.fn();

			const release = service.onButtonOccurrence(listener);

			service.onButtonOccurrence(listener);
			release();
			service.handleChannelInputOccurrence(occurrence);

			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe('device connections', () => {
		it.each([
			[ConnectionState.CONNECTED, true],
			[ConnectionState.READY, true],
			[ConnectionState.SLEEPING, true],
			[ConnectionState.LOST, false],
			[ConnectionState.DISCONNECTED, false],
			[ConnectionState.ALERT, false],
			[ConnectionState.UNKNOWN, null],
			[undefined, null],
		])('takes %s as online=%s', (state, online) => {
			expect(connectionOnline(state)).toBe(online);
		});

		it('reports a change from online to offline and back, with the baseline read when the watch starts', async () => {
			const listener = jest.fn();

			service.onDeviceConnection(DEVICE_A, listener);
			await flush();

			expect(readLatest).toHaveBeenCalledWith({ id: DEVICE_A });

			connectionChanged(DEVICE_A, ConnectionState.LOST);
			connectionChanged(DEVICE_A, ConnectionState.READY);

			expect(listener.mock.calls).toEqual([
				[{ deviceId: DEVICE_A, online: false, state: ConnectionState.LOST }],
				[{ deviceId: DEVICE_A, online: true, state: ConnectionState.READY }],
			]);
		});

		it('does not report a change between two online states, two offline states or to unknown', async () => {
			const listener = jest.fn();

			service.onDeviceConnection(DEVICE_A, listener);
			await flush();

			connectionChanged(DEVICE_A, ConnectionState.RUNNING);
			connectionChanged(DEVICE_A, ConnectionState.UNKNOWN);
			connectionChanged(DEVICE_A, ConnectionState.LOST);
			connectionChanged(DEVICE_A, ConnectionState.DISCONNECTED);

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith({ deviceId: DEVICE_A, online: false, state: ConnectionState.LOST });
		});

		it('takes the first change as the baseline while the state before it is not known', async () => {
			readLatest.mockResolvedValue({ online: false, status: ConnectionState.UNKNOWN, lastChanged: null });

			const listener = jest.fn();

			service.onDeviceConnection(DEVICE_A, listener);
			await flush();

			connectionChanged(DEVICE_A, ConnectionState.READY);

			expect(listener).not.toHaveBeenCalled();

			connectionChanged(DEVICE_A, ConnectionState.LOST);

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('lets a change seen during the baseline read win over the read', async () => {
			let answer: (value: unknown) => void = () => undefined;

			readLatest.mockReturnValue(new Promise((resolve) => (answer = resolve)));

			const listener = jest.fn();

			service.onDeviceConnection(DEVICE_A, listener);

			connectionChanged(DEVICE_A, ConnectionState.LOST);
			answer({ online: true, status: ConnectionState.READY, lastChanged: null });
			await flush();

			connectionChanged(DEVICE_A, ConnectionState.DISCONNECTED);

			expect(listener).not.toHaveBeenCalled();
		});

		it('survives a baseline read that fails', async () => {
			readLatest.mockRejectedValue(new Error('storage is down'));

			const listener = jest.fn();

			service.onDeviceConnection(DEVICE_A, listener);
			await flush();

			connectionChanged(DEVICE_A, ConnectionState.LOST);
			connectionChanged(DEVICE_A, ConnectionState.READY);

			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('routes a change only to the watches of its device, and forgets a device nobody watches', async () => {
			const listener = jest.fn();
			const release = service.onDeviceConnection(DEVICE_A, listener);

			await flush();

			connectionChanged(DEVICE_B, ConnectionState.LOST);

			expect(listener).not.toHaveBeenCalled();

			release();
			release();

			expect(service.subscriptionCount()).toBe(0);

			connectionChanged(DEVICE_A, ConnectionState.LOST);

			expect(listener).not.toHaveBeenCalled();
		});
	});

	it('hands on a finished scene run with how it ended and who ran it', () => {
		const listener = jest.fn();

		service.onSceneRun(listener);

		service.handleSceneTriggered({
			id: SCENE_ID,
			result: { sceneId: SCENE_ID, status: 'partially_completed', triggeredBy: 'automation' },
		});
		service.handleSceneTriggered({ id: SCENE_ID });

		expect(listener.mock.calls).toEqual([
			[{ sceneId: SCENE_ID, status: 'partially_completed', triggeredBy: 'automation' }],
		]);
	});

	it('hands on a house mode change', () => {
		const listener = jest.fn();

		service.onHouseModeChanged(listener);

		service.handleHouseModeChanged({ previousMode: HouseMode.HOME, newMode: HouseMode.AWAY });
		service.handleHouseModeChanged({ previousMode: null, newMode: HouseMode.NIGHT });
		service.handleHouseModeChanged({ previousMode: HouseMode.NIGHT });

		expect(listener.mock.calls).toEqual([
			[{ from: HouseMode.HOME, to: HouseMode.AWAY }],
			[{ from: null, to: HouseMode.NIGHT }],
		]);
	});

	it('hands on a security state transition', () => {
		const listener = jest.fn();

		service.onSecurityStateChanged(listener);

		service.handleSecurityStateChanged({ kind: 'armed', from: ArmedState.DISARMED, to: ArmedState.ARMED_AWAY });
		service.handleSecurityStateChanged({ kind: 'alarm', from: AlarmState.IDLE, to: AlarmState.TRIGGERED });
		service.handleSecurityStateChanged(null);

		expect(listener.mock.calls).toEqual([
			[{ kind: 'armed', from: ArmedState.DISARMED, to: ArmedState.ARMED_AWAY }],
			[{ kind: 'alarm', from: AlarmState.IDLE, to: AlarmState.TRIGGERED }],
		]);
	});
});
