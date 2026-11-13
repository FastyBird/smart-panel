import { normalizeAutomationNodeType } from '../graph/node-type';
import { DEVICE_A, DEVICE_B } from '../testing/node-fixtures';

import { DeviceConnectionChange } from './bus-events.types';
import {
	DEVICE_CONNECTION_CHANGED_NODE_TYPE,
	createDeviceConnectionChangedNodeType,
} from './device-connection-changed.node-type';

describe('device.connection.changed', () => {
	let listeners: Map<string, Set<(change: DeviceConnectionChange) => void>>;

	const source = {
		onDeviceConnection: (deviceId: string, listener: (change: DeviceConnectionChange) => void) => {
			const set = listeners.get(deviceId) ?? new Set();

			set.add(listener);
			listeners.set(deviceId, set);

			return () => set.delete(listener);
		},
	};

	const card = () => createDeviceConnectionChangedNodeType(source);

	const change = (deviceId: string, online: boolean, state: string): void => {
		for (const listener of [...(listeners.get(deviceId) ?? [])]) {
			listener({ deviceId, online, state });
		}
	};

	beforeEach(() => {
		listeners = new Map();
	});

	it('is a trigger that refers to its device', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({ type: DEVICE_CONNECTION_CHANGED_NODE_TYPE, kind: 'trigger' });
		expect(registered.references({ device_id: DEVICE_A })).toEqual([{ kind: 'device', id: DEVICE_A }]);
		expect(registered.references({})).toEqual([]);
	});

	it('takes a device and optionally the direction', async () => {
		expect(await card().validateConfig({ device_id: DEVICE_A })).toEqual([]);
		expect(await card().validateConfig({ device_id: DEVICE_A, to: 'offline' })).toEqual([]);
		expect(await card().validateConfig({})).toEqual([{ field: 'device_id', reason: 'A device must be chosen.' }]);
		expect(await card().validateConfig({ device_id: DEVICE_A, to: 'lost' })).toEqual([
			{ field: 'to', reason: '"to" must be online or offline.' },
		]);
		expect(await card().validateConfig({ device_id: DEVICE_A, for_seconds: 60 })).toEqual([
			{ field: 'for_seconds', reason: 'This property is not allowed.' },
		]);
	});

	it('starts when the device goes offline and when it comes back, with the state it reported', () => {
		const fire = jest.fn();

		card().subscribe({ device_id: DEVICE_A }, fire);

		change(DEVICE_A, false, 'lost');
		change(DEVICE_A, true, 'ready');
		change(DEVICE_B, false, 'lost');

		expect(fire.mock.calls).toEqual([
			[{ device_id: DEVICE_A, from: 'online', to: 'offline', state: 'lost' }],
			[{ device_id: DEVICE_A, from: 'offline', to: 'online', state: 'ready' }],
		]);
	});

	it('starts only in the direction asked for', () => {
		const offline = jest.fn();
		const online = jest.fn();

		card().subscribe({ device_id: DEVICE_A, to: 'offline' }, offline);
		card().subscribe({ device_id: DEVICE_A, to: 'online' }, online);

		change(DEVICE_A, false, 'disconnected');
		change(DEVICE_A, true, 'connected');

		expect(offline).toHaveBeenCalledTimes(1);
		expect(offline).toHaveBeenCalledWith(expect.objectContaining({ to: 'offline' }));
		expect(online).toHaveBeenCalledTimes(1);
		expect(online).toHaveBeenCalledWith(expect.objectContaining({ to: 'online' }));
	});

	it('stops watching when it is released', () => {
		const fire = jest.fn();

		card().subscribe({ device_id: DEVICE_A }, fire)();

		change(DEVICE_A, false, 'lost');

		expect(fire).not.toHaveBeenCalled();
	});
});
