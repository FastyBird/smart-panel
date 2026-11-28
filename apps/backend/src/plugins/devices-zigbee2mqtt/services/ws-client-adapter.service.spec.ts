import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';

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

it('requires the current socket to finish its connect snapshot before accepting switch-specific reports', async () => {
	const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
	const adapter = new Z2mWsClientAdapterService();
	try {
		await once(server, 'listening');
		const handshake = new Promise<{ peer: WebSocket; topic: string; transaction: string }>((resolve) => {
			server.once('connection', (peer: WebSocket) =>
				peer.once('message', (frame: Buffer) => {
					const { topic, payload } = JSON.parse(frame.toString('utf8')) as {
						topic: string;
						payload: { transaction: string };
					};
					resolve({ peer, topic, transaction: payload.transaction });
				}),
			);
		});
		const scopes: Z2mDeviceStateMetadata['reportScope'][] = [];
		const received = new Promise<void>((resolve) =>
			adapter.setCallbacks({
				onBridgeOnline: () =>
					(adapter as unknown as { openStartupReplayWindow(ms: number): void }).openStartupReplayWindow(0),
				onDeviceStateChanged: (_name, state, metadata) => {
					scopes.push(metadata.reportScope);
					if (state.power === 3) resolve();
				},
			}),
		);
		await adapter.connect({
			host: '127.0.0.1',
			port: (server.address() as AddressInfo).port,
			secure: false,
			baseTopic: 'zigbee2mqtt',
			connectTimeout: 3000,
			reconnectInterval: 0,
		});
		const { peer, topic, transaction } = await handshake;
		expect(topic).toBe('bridge/request/health_check');
		expect(transaction).toEqual(expect.any(String));
		const send = (topic: string, payload: unknown) => peer.send(JSON.stringify({ topic, payload }));
		send('bridge/state', { state: 'online' });
		send('bridge/info', { config: { advanced: { cache_state: false } } });
		send('plug', { state: 'OFF', power: 1 });
		send('bridge/response/health_check', { status: 'ok', data: { healthy: true }, transaction: 'other-client' });
		send('plug', { state: 'OFF', power: 2 });
		send('bridge/response/health_check', { status: 'ok', data: { healthy: true }, transaction });
		send('plug', { state: 'ON', power: 3 });
		await received;
		expect(scopes).toEqual(['device', 'device', 'property']);
	} finally {
		await adapter.disconnect();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
