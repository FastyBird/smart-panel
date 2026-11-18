import { STARTUP_REPLAY_WINDOW_MS } from '../devices-zigbee2mqtt.constants';
import { Z2mDeviceStateMetadata } from '../interfaces/zigbee2mqtt.interface';

import { Z2mWsClientAdapterService } from './ws-client-adapter.service';

/** Real packet routing and adapter; no socket is constructed or connected in these tests. */
describe('Zigbee frontend websocket sample evidence', () => {
	let adapter: Z2mWsClientAdapterService;
	let callback: jest.Mock<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>;
	let now: Date;
	const send = (topic: string, payload: unknown): void =>
		(adapter as unknown as { handleWsMessage(data: string): void }).handleWsMessage(JSON.stringify({ topic, payload }));
	const feed = (payload: unknown): void => send('ambient', payload);
	const lastMetadata = (): Z2mDeviceStateMetadata => callback.mock.calls.at(-1)[2];
	const passReplayWindow = (): void => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		now = new Date();
	};
	beforeEach(() => {
		jest.useFakeTimers();
		now = new Date('2026-10-13T12:00:00Z');
		jest.setSystemTime(now);
		adapter = new Z2mWsClientAdapterService();
		callback = jest.fn<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>();
		adapter.setCallbacks({ onDeviceStateChanged: callback });
		(adapter as unknown as { connected: boolean }).connected = true;
		send('bridge/state', { state: 'online' });
	});
	afterEach(async () => {
		await adapter.disconnect();
		jest.useRealTimers();
	});

	it('shows the connect snapshot without last_seen but does not count it as fresh', () => {
		feed({ temperature: 25 });
		expect(lastMetadata()).toMatchObject({
			isReplay: true,
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_startup_replay_window',
		});
		expect(adapter.getCachedState('ambient')).toEqual({ temperature: 25 });
	});

	it('accepts a snapshot entry timed by last_seen with its real age', () => {
		feed({ temperature: 25, last_seen: '2026-10-13T11:40:00Z' });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: true,
			sampledAt: new Date('2026-10-13T11:40:00Z'),
			qualificationReason: 'zigbee_replay_timed_by_last_seen',
		});
		expect(lastMetadata().sourceIsCurrent()).toBe(true);
	});

	it('accepts a device report without last_seen after the replay window, timed by arrival', async () => {
		passReplayWindow();
		feed(JSON.stringify({ temperature: 25 }));
		const metadata = lastMetadata();
		expect(metadata).toMatchObject({ measurementFieldsAreLive: true, observedAt: now });
		expect(metadata.sampledAt).toBeUndefined();
		expect(metadata.isCurrent()).toBe(true);
		await adapter.disconnect();
		expect(metadata.isCurrent()).toBe(false);
		expect(metadata.sourceIsCurrent()).toBe(false);
	});

	it('reports readiness from the connection and bridge state only', () => {
		expect(adapter.getMeasurementReadiness()).toEqual({
			requiredProof: 'live_device_report_after_startup_replay_window',
			reasons: [],
		});
		send('bridge/state', { state: 'offline' });
		expect(adapter.getMeasurementReadiness().reasons).toEqual(['zigbee_source_disconnected']);
	});
});
