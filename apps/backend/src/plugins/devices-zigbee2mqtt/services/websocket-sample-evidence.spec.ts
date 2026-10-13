import { Z2mDeviceStateMetadata } from '../interfaces/zigbee2mqtt.interface';

import { websocketSampleEvidence } from './websocket-sample-evidence';
import { Z2mWsClientAdapterService } from './ws-client-adapter.service';

/** Real packet routing and adapter; no socket is constructed or connected in these tests. */
describe('Zigbee frontend websocket measurement proof', () => {
	let adapter: Z2mWsClientAdapterService;
	let callback: jest.Mock<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>;
	let now: Date;
	const feed = (payload: unknown): void =>
		(adapter as unknown as { handleWsMessage(data: string): void }).handleWsMessage(
			JSON.stringify({ topic: 'ambient', payload }),
		);
	beforeEach(() => {
		jest.useFakeTimers();
		now = new Date('2026-10-13T12:00:00Z');
		jest.setSystemTime(now);
		adapter = new Z2mWsClientAdapterService();
		callback = jest.fn<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>();
		adapter.setCallbacks({ onDeviceStateChanged: callback });
		(adapter as unknown as { connected: boolean }).connected = true;
		(adapter as unknown as { connectedAt: Date | null }).connectedAt = new Date(now.getTime() - 1000);
		(adapter as unknown as { handleWsMessage(data: string): void }).handleWsMessage(
			JSON.stringify({ topic: 'bridge/state', payload: { state: 'online' } }),
		);
		(adapter as unknown as { handleWsMessage(data: string): void }).handleWsMessage(
			JSON.stringify({ topic: 'bridge/info', payload: { config: { advanced: { cache_state: false } } } }),
		);
	});
	afterEach(async () => {
		await adapter.disconnect();
		jest.useRealTimers();
	});

	it.each([
		{ temperature: 25 },
		{ temperature: 25, last_seen: 'invalid' },
		{ temperature: 25, last_seen: '2026-10-13T11:59:58Z' },
		{ temperature: 25, last_seen: '2026-10-13T12:00:01Z' },
	])('routes initial/unknown/replayed/future measurements as cached %j', (payload) => {
		feed(payload);
		const metadata = callback.mock.calls[0][2];
		expect(metadata.isCached).toBe(true);
		expect(metadata.qualificationReason).toMatch(/^websocket_measurement_/);
		expect(adapter.getCachedState('ambient')).toEqual(payload);
	});

	it('accepts explicit bounded post-connection source time, and invalidates its generation on disconnect', async () => {
		feed({ temperature: 25, last_seen: '2026-10-13T12:00:00+00:00' });
		const metadata = callback.mock.calls[0][2];
		expect(metadata).toMatchObject({
			isCached: false,
			measurementFieldsAreLive: true,
			sampledAt: now,
			observedAt: now,
			qualificationReason: 'websocket_post_connection_measurement_timestamp',
		});
		expect(metadata.isCurrent()).toBe(true);
		await adapter.disconnect();
		expect(metadata.isCurrent()).toBe(false);
	});

	it('handles string JSON state and ordinary bridge payloads while exposing the conservative readiness requirement', () => {
		feed(JSON.stringify({ temperature: 25 }));
		expect(callback.mock.calls[0][2].isCached).toBe(true);
		(adapter as unknown as { handleWsMessage(data: string): void }).handleWsMessage(
			JSON.stringify({ topic: 'bridge/state', payload: { state: 'online' } }),
		);
		expect(adapter.isBridgeOnline()).toBe(true);
		expect(adapter.getMeasurementReadiness()).toMatchObject({
			requiredProof: 'current_bridge_info_cache_state_false_and_post_connection_source_timestamp',
		});
	});

	it('declines timestamps without a current connection identity', () => {
		expect(websocketSampleEvidence({ last_seen: now.toISOString() }, null, now)).toMatchObject({ isCached: true });
	});
});
