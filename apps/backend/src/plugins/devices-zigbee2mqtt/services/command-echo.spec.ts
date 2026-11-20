import { currentSampleIngress } from '../../../modules/devices/services/property-sample-ingress';
import { COMMAND_ECHO_WINDOW_MS, STARTUP_REPLAY_WINDOW_MS } from '../devices-zigbee2mqtt.constants';
import { Z2mDeviceStateMetadata, Z2mSetPayload } from '../interfaces/zigbee2mqtt.interface';

import { Z2mBaseClientAdapter } from './base-client-adapter';

class FixtureAdapter extends Z2mBaseClientAdapter {
	sendResult = true;
	readonly sent: Array<{ friendlyName: string; payload: Z2mSetPayload }> = [];
	constructor() {
		super('FixtureAdapter');
	}
	connect(): Promise<void> {
		this.connected = true;
		return Promise.resolve();
	}
	disconnect(): Promise<void> {
		this.resetState();
		return Promise.resolve();
	}
	protected sendCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean> {
		this.sent.push({ friendlyName, payload });
		return Promise.resolve(this.sendResult);
	}
	requestState(): Promise<boolean> {
		return Promise.resolve(true);
	}
	setPermitJoin(): Promise<boolean> {
		return Promise.resolve(true);
	}
	feed(topic: string, payload: unknown, retained = false): void {
		this.handleMessage(`zigbee2mqtt/${topic}`, JSON.stringify(payload), false, retained);
	}
	feedDuplicate(friendlyName: string, payload: unknown): void {
		this.handleDeviceStateMessage(friendlyName, JSON.stringify(payload), false, { isDup: true });
	}
}

const flush = async (): Promise<void> => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('Zigbee2MQTT command acknowledgements', () => {
	let adapter: FixtureAdapter;
	let callback: jest.Mock<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>;
	const lastMetadata = (): Z2mDeviceStateMetadata => callback.mock.calls.at(-1)[2];
	const acknowledged = (friendlyName = 'plug'): jest.Mock => {
		const done = jest.fn();
		void adapter.whenCommandsAcknowledged(friendlyName).then(done);
		return done;
	};

	beforeEach(async () => {
		jest.useFakeTimers({ now: Date.parse('2026-11-20T10:00:00Z') });
		adapter = new FixtureAdapter();
		callback = jest.fn<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>();
		adapter.setCallbacks({ onDeviceStateChanged: callback });
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		adapter.feed('plug', { state: 'ON', power: 1200 });
	});
	afterEach(async () => {
		await adapter.disconnect();
		jest.useRealTimers();
	});

	it('marks the acknowledgement of a state change, and reports after it are ordinary', async () => {
		expect(lastMetadata().commandEcho).toBeUndefined();
		await expect(adapter.publishCommand('plug', { state: 'OFF' })).resolves.toBe(true);
		const done = acknowledged();

		// A report merged with the cached ON while the command is pending: not proof of anything.
		adapter.feed('plug', { state: 'ON', power: 1100 });
		expect(lastMetadata()).toMatchObject({ commandEcho: true, measurementFieldsAreLive: true });
		await flush();
		expect(done).not.toHaveBeenCalled();

		adapter.feed('plug', { state: 'off', power: 1100 });
		expect(lastMetadata().commandEcho).toBe(true);
		await flush();
		expect(done).toHaveBeenCalled();

		adapter.feed('plug', { state: 'OFF', power: 0 });
		expect(lastMetadata().commandEcho).toBeUndefined();
	});

	it('keeps a command that does not change the state pending for the whole window', async () => {
		await adapter.publishCommand('plug', { state: 'ON' });
		const done = acknowledged();

		// Indistinguishable from a merged report that already carried ON.
		adapter.feed('plug', { state: 'ON', power: 1200 });
		expect(lastMetadata().commandEcho).toBe(true);
		jest.advanceTimersByTime(COMMAND_ECHO_WINDOW_MS - 1);
		adapter.feed('plug', { state: 'ON', power: 1200 });
		expect(lastMetadata().commandEcho).toBe(true);
		await flush();
		expect(done).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		await flush();
		expect(done).toHaveBeenCalled();
		adapter.feed('plug', { state: 'ON', power: 1200 });
		expect(lastMetadata().commandEcho).toBeUndefined();
	});

	it('numbers each message on receipt, so mapping delays cannot move it past a later boundary', () => {
		adapter.feed('plug', { state: 'ON', power: 1 });
		const first = lastMetadata().ingressSequence;
		const boundary = currentSampleIngress();
		adapter.feed('plug', { state: 'ON', power: 2 });
		expect(first).toBeLessThanOrEqual(boundary);
		expect(lastMetadata().ingressSequence).toBeGreaterThan(boundary);
		expect(adapter.hasPendingCommands('plug')).toBe(false);
	});

	it('replays fields cached from an acknowledgement as an acknowledgement, apart from reported fields', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		adapter.feed('plug', { state: 'OFF', last_seen: new Date(Date.now() - 1_000).toISOString() });
		expect(lastMetadata().commandEcho).toBe(true);
		jest.advanceTimersByTime(10);
		adapter.feed('plug', { power: 0, last_seen: new Date().toISOString() });

		const replays = adapter.getCachedStateReplays('plug');
		const echoed = replays.find(({ state }) => 'state' in state);
		const reported = replays.find(({ state }) => 'power' in state);
		expect(echoed?.metadata).toMatchObject({ commandEcho: true, isCached: true });
		expect(reported?.metadata.commandEcho).toBeUndefined();
		expect(echoed).not.toBe(reported);
	});

	it('closes the window when the command was not sent', async () => {
		adapter.sendResult = false;
		await expect(adapter.publishCommand('plug', { state: 'OFF' })).resolves.toBe(false);
		adapter.feed('plug', { state: 'ON', power: 1200 });
		expect(lastMetadata().commandEcho).toBeUndefined();
	});

	it('waits for every pending command of the device, and only of that device', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		await adapter.publishCommand('plug', { power_on_behavior: 'off' });
		const plug = acknowledged();
		const other = acknowledged('lamp');
		await flush();
		expect(other).toHaveBeenCalled();

		adapter.feed('plug', { state: 'OFF', power_on_behavior: 'previous' });
		await flush();
		expect(plug).not.toHaveBeenCalled();
		adapter.feed('plug', { state: 'OFF', power_on_behavior: 'off' });
		await flush();
		expect(plug).toHaveBeenCalled();
	});

	it('keeps a separate window for each of two equal commands', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		await adapter.publishCommand('plug', { state: 'OFF' });
		const done = acknowledged();
		adapter.feed('plug', { state: 'OFF', power: 0 });
		await flush();
		expect(done).not.toHaveBeenCalled();
		// The second acknowledgement is still marked.
		adapter.feed('plug', { state: 'OFF', power: 0 });
		expect(lastMetadata().commandEcho).toBe(true);
		await flush();
		expect(done).toHaveBeenCalled();
		adapter.feed('plug', { state: 'OFF', power: 0 });
		expect(lastMetadata().commandEcho).toBeUndefined();
	});

	it('also waits for a command sent while waiting', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		const done = acknowledged();
		await adapter.publishCommand('plug', { power_on_behavior: 'off' });
		adapter.feed('plug', { state: 'OFF' });
		await flush();
		expect(done).not.toHaveBeenCalled();
		adapter.feed('plug', { state: 'OFF', power_on_behavior: 'off' });
		await flush();
		expect(done).toHaveBeenCalled();
	});

	it('marks a redelivered duplicate without letting it acknowledge the command', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		const done = acknowledged();
		adapter.feedDuplicate('plug', { state: 'OFF' });
		expect(lastMetadata().commandEcho).toBe(true);
		await flush();
		expect(done).not.toHaveBeenCalled();
		adapter.feed('plug', { state: 'OFF' });
		await flush();
		expect(done).toHaveBeenCalled();
	});

	it('compares nested commanded values', async () => {
		adapter.feed('plug', { state: 'ON', color: { x: 0.1, y: 0.2 } });
		await adapter.publishCommand('plug', { color: { x: 0.3, y: 0.4 } } as unknown as Z2mSetPayload);
		const done = acknowledged();
		adapter.feed('plug', { state: 'ON', color: { x: 0.3, y: 0.2 } });
		await flush();
		expect(done).not.toHaveBeenCalled();
		adapter.feed('plug', { state: 'ON', color: { x: 0.3, y: 0.4, hue: 10 } });
		await flush();
		expect(done).toHaveBeenCalled();
	});

	it('never marks retained or cached replays, and a disconnect ends pending commands', async () => {
		await adapter.publishCommand('plug', { state: 'OFF' });
		adapter.feed('plug', { state: 'OFF' }, true);
		expect(lastMetadata().commandEcho).toBeUndefined();

		const done = acknowledged();
		await adapter.disconnect();
		await flush();
		expect(done).toHaveBeenCalled();
	});
});
