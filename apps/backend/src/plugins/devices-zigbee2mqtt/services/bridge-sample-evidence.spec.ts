import { EventEmitter2 } from '@nestjs/event-emitter';

import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { UpdateChannelPropertyDto } from '../../../modules/devices/dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { STARTUP_REPLAY_WINDOW_MAX_MS, STARTUP_REPLAY_WINDOW_MS } from '../devices-zigbee2mqtt.constants';
import { Z2mDeviceStateMetadata } from '../interfaces/zigbee2mqtt.interface';

import { Z2mBaseClientAdapter } from './base-client-adapter';

/** Real shared packet boundary without broker, gateway, or sockets. */
class FixtureAdapter extends Z2mBaseClientAdapter {
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
	publishCommand(): Promise<boolean> {
		return Promise.resolve(true);
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
}

describe('Zigbee live device report contract', () => {
	let adapter: FixtureAdapter;
	let callback: jest.Mock<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>;
	const base = Date.parse('2026-10-13T10:00:00Z');
	const cacheMode = (cache_state: unknown): unknown => ({ config: { advanced: { cache_state } } });
	const lastMetadata = (): Z2mDeviceStateMetadata => callback.mock.calls.at(-1)[2];
	const passReplayWindow = (): void => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
	};
	beforeEach(async () => {
		jest.useFakeTimers({ now: base });
		adapter = new FixtureAdapter();
		callback = jest.fn<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>();
		adapter.setCallbacks({ onDeviceStateChanged: callback });
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
	});
	afterEach(async () => {
		await adapter.disconnect();
		jest.useRealTimers();
	});

	it('treats device states inside the startup replay window as replays, not live reports', () => {
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_startup_replay_window',
		});
		expect(lastMetadata().sourceIsCurrent).toBeUndefined();
	});

	it.each([
		{ mode: true, reason: 'zigbee_live_device_report_merged_state' },
		{ mode: null, reason: 'zigbee_live_device_report_merged_state' },
		{ mode: false, reason: 'zigbee_live_device_report' },
	])(
		'accepts any device report as live with cache_state $mode, including equal-value heartbeats',
		({ mode, reason }) => {
			if (mode !== null) adapter.feed('bridge/info', cacheMode(mode));
			passReplayWindow();
			adapter.feed('ambient', { temperature: 25, battery: 80 });
			const first = lastMetadata();
			expect(first).toMatchObject({ measurementFieldsAreLive: true, qualificationReason: reason });
			expect(first.sourceIsCurrent()).toBe(true);
			// Battery-only report: with cache_state the unchanged temperature rides along and is confirmed.
			adapter.feed('ambient', { temperature: 25, battery: 79 });
			expect(lastMetadata().measurementFieldsAreLive).toBe(true);
			expect(adapter.getMeasurementReadiness().reasons).toEqual([]);
		},
	);

	it('does not revoke live authority when the bridge reports a cache_state change', () => {
		adapter.feed('bridge/info', cacheMode(false));
		passReplayWindow();
		adapter.feed('ambient', { temperature: 25 });
		const first = lastMetadata();
		adapter.feed('bridge/info', cacheMode(true));
		expect(first.isCurrent()).toBe(true);
		expect(first.sourceIsCurrent()).toBe(true);
	});

	it('accepts replays timed by last_seen with their real age: retained and startup window', () => {
		const lastSeen = new Date(base - 20 * 60_000).toISOString();
		adapter.feed('ambient', { temperature: 25, last_seen: lastSeen }, true);
		expect(lastMetadata()).toMatchObject({
			isRetained: true,
			measurementFieldsAreLive: true,
			sampledAt: new Date(lastSeen),
			qualificationReason: 'zigbee_replay_timed_by_last_seen',
		});
		adapter.feed('ambient', { temperature: 25, last_seen: lastSeen });
		expect(lastMetadata()).toMatchObject({ measurementFieldsAreLive: true, sampledAt: new Date(lastSeen) });
		expect(lastMetadata()).toMatchObject({ isReplay: true, qualificationReason: 'zigbee_replay_timed_by_last_seen' });
	});

	it.each([0, '1970-01-01T00:00:00.000Z'])('treats a last_seen of epoch 0 (%p) as no source time', (lastSeen) => {
		adapter.feed('ambient', { temperature: 25, last_seen: lastSeen });
		expect(lastMetadata()).toMatchObject({ measurementFieldsAreLive: false, isReplay: true });
		expect(lastMetadata().sampledAt).toBeUndefined();
	});

	it('replays cached state of an unidentified sender for display only, even with last_seen', () => {
		adapter.feed('ambient', { temperature: 25, last_seen: new Date(base - 60_000).toISOString() });
		const replays = adapter.getCachedStateReplays('ambient');
		expect(replays).toHaveLength(1);
		expect(replays[0].metadata).toMatchObject({
			isCached: true,
			isReplay: true,
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_cached_replay_without_last_seen',
		});
		expect(replays[0].metadata.sampledAt).toBeUndefined();
	});

	it('keeps replays without a trustworthy last_seen non-fresh, including our own cached replay', () => {
		adapter.feed('ambient', { temperature: 25, last_seen: new Date(base + 10 * 60_000).toISOString() });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_startup_replay_window',
		});
		expect(lastMetadata().sampledAt).toBeUndefined();
		adapter.feed('other', { temperature: 21 });
		passReplayWindow();
		expect(adapter.getCachedStateReplays('other')[0].metadata).toMatchObject({
			isCached: true,
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_cached_replay_without_last_seen',
		});
		expect(adapter.getCachedStateReplays('unknown')).toEqual([]);
	});

	it('treats a message the device sent after the window opened as a fresh report, not a replay', () => {
		jest.advanceTimersByTime(1_000);
		adapter.feed('remote', { action: 'single', last_seen: new Date(base + 500).toISOString() });
		expect(lastMetadata()).toMatchObject({
			isReplay: false,
			measurementFieldsAreLive: true,
			qualificationReason: 'zigbee_device_report_timed_by_last_seen',
		});
		adapter.feed('remote', { action: 'single', last_seen: new Date(base - 500).toISOString() });
		expect(lastMetadata()).toMatchObject({ isReplay: true, qualificationReason: 'zigbee_replay_timed_by_last_seen' });
	});

	it('keeps the replay window open while Zigbee2MQTT is still publishing after online, up to a limit', () => {
		// Zigbee2MQTT starts its extensions after `online` and only then publishes its cached states.
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS - 1_000);
		adapter.feed('bridge/info', cacheMode(true));
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS - 1_000);
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata()).toMatchObject({ isReplay: true, measurementFieldsAreLive: false });
		// Continuous traffic cannot hold it open past the limit.
		for (let elapsed = 0; elapsed < STARTUP_REPLAY_WINDOW_MAX_MS; elapsed += STARTUP_REPLAY_WINDOW_MS - 1_000) {
			jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS - 1_000);
			adapter.feed('ambient', { temperature: 25 });
		}
		expect(lastMetadata()).toMatchObject({ isReplay: false, measurementFieldsAreLive: true });
	});

	it('does not treat a last_seen capped at receipt as proof that a report followed the window opening', () => {
		// The gateway clock runs ahead: the source time is capped at receipt and places nothing.
		jest.advanceTimersByTime(500);
		adapter.feed('remote', { action: 'single', last_seen: new Date(base + 2_000).toISOString() });
		expect(lastMetadata()).toMatchObject({ isReplay: true, sampledAt: new Date(base + 500) });
	});

	it('replays cached fields with their own receipt times when they share a source time', () => {
		adapter.feed('ambient', { humidity: 40 });
		jest.advanceTimersByTime(1_000);
		adapter.feed('ambient', { temperature: 25 });
		expect(
			adapter.getCachedStateReplays('ambient').map((replay) => [replay.state, replay.metadata.observedAt.getTime()]),
		).toEqual([
			[{ humidity: 40 }, base],
			[{ temperature: 25 }, base + 1_000],
		]);
	});

	it('replays cached fields with their original receipt time, not the replay time', () => {
		adapter.feed('ambient', { temperature: 25 });
		jest.advanceTimersByTime(60_000);
		expect(adapter.getCachedStateReplays('ambient')[0].metadata.observedAt).toEqual(new Date(base));
	});

	it('time-stamps a live report by last_seen, and never makes a source-timed message live while offline', () => {
		passReplayWindow();
		const lastSeen = new Date(Date.now() - 1_000).toISOString();
		adapter.feed('ambient', { temperature: 25, last_seen: lastSeen });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: true,
			sampledAt: new Date(lastSeen),
			qualificationReason: 'zigbee_device_report_timed_by_last_seen',
		});
		adapter.feed('bridge/state', { state: 'offline' });
		adapter.feed('ambient', { temperature: 25, last_seen: lastSeen });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_source_disconnected',
		});
	});

	it('never treats retained state without last_seen as live, and reopens the replay window on reconnect and bridge restart', async () => {
		passReplayWindow();
		adapter.feed('ambient', { temperature: 25 }, true);
		expect(lastMetadata()).toMatchObject({ isRetained: true, measurementFieldsAreLive: false });
		expect(lastMetadata().sourceIsCurrent).toBeUndefined();
		adapter.feed('ambient', { temperature: 25 });
		const first = lastMetadata();
		expect(first.measurementFieldsAreLive).toBe(true);
		await adapter.disconnect();
		expect(first.sourceIsCurrent()).toBe(false);
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata().measurementFieldsAreLive).toBe(false);
		passReplayWindow();
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata().measurementFieldsAreLive).toBe(true);
		adapter.feed('bridge/state', { state: 'offline' });
		adapter.feed('bridge/state', { state: 'online' });
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata().measurementFieldsAreLive).toBe(false);
	});
});

class MeasurementProperty extends ChannelPropertyEntity {
	get type(): string {
		return 'zigbee-evidence-test';
	}
}

/** Production admission/window/value services consume actual adapter packet evidence. */
describe('Zigbee device report freshness at sample and ordinary acknowledgement admission', () => {
	let adapter: FixtureAdapter;
	let property: MeasurementProperty;
	let values: PropertyValueService;
	let reports: ChannelsPropertiesService;
	let windows: PropertyCommandWindowService;
	let pending: Promise<unknown>;
	let storage: Record<
		'isConnected' | 'writePoints' | 'enqueueWritePoint' | 'flushQueuedWrites' | 'query' | 'queryStrict',
		jest.Mock
	>;
	const base = Date.parse('2026-10-13T10:00:00Z');
	beforeEach(async () => {
		jest.useFakeTimers({ now: base });
		property = Object.assign(new MeasurementProperty(), {
			id: 'zigbee-sample',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			format: [-100, 150],
			step: null,
			invalid: null,
			value: new PropertyValueState(),
			channel: 'channel',
		});
		const sources = new PropertyValueSourceRegistryService();
		storage = {
			isConnected: jest.fn(() => true),
			writePoints: jest.fn().mockResolvedValue(undefined),
			enqueueWritePoint: jest.fn().mockResolvedValue(undefined),
			flushQueuedWrites: jest.fn().mockResolvedValue(undefined),
			query: jest.fn().mockResolvedValue([]),
			queryStrict: jest.fn().mockResolvedValue([]),
		};
		const events = new EventEmitter2();
		values = new PropertyValueService(
			storage as unknown as StorageService,
			sources,
			new PropertyValueLockService({} as never),
			undefined,
			events,
		);
		windows = new PropertyCommandWindowService();
		reports = new ChannelsPropertiesService(
			{} as never,
			{
				getMapping: () => ({ type: property.type, class: MeasurementProperty, updateDto: UpdateChannelPropertyDto }),
			} as unknown as ChannelsPropertiesTypeMapperService,
			values,
			sources,
			new DeviceStructureLockService(),
			new PropertyStateCoordinatorService(),
			windows,
			{} as never,
			events,
			undefined,
			{ findOne: () => Promise.resolve(property) } as unknown as PropertyMetadataService,
		);
		adapter = new FixtureAdapter();
		adapter.setCallbacks({
			onDeviceStateChanged: (_name, state, metadata) => {
				if (!Object.hasOwn(state, 'temperature')) return;
				pending = reports.reportSample(property.id, { value: state.temperature } as UpdateChannelPropertyDto, {
					sampledAt: metadata.sampledAt ?? metadata.observedAt,
					receivedAt: new Date(),
					observedAt: metadata.observedAt,
					provenance: metadata.measurementFieldsAreLive ? 'live' : metadata.isRetained ? 'retained' : 'cached',
					...(metadata.isReplay ? { replay: true } : {}),
					...(metadata.isReplay && !metadata.sampledAt ? { ageUnknown: true } : {}),
					isCurrent: metadata.isCurrent,
					sourceIsCurrent: metadata.sourceIsCurrent,
				});
				return pending.then(() => undefined);
			},
		});
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
	});
	afterEach(async () => {
		await adapter.disconnect();
		reports.onModuleDestroy();
		jest.useRealTimers();
	});
	const sample = async (temperature: number): Promise<void> => {
		adapter.feed('ambient', { temperature });
		await pending;
	};

	it('keeps a fresh age for an equal temperature confirmed by merged cache_state heartbeats', async () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: true } } });
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + STARTUP_REPLAY_WINDOW_MS);
		// Hours later the sensor still reports the same value: the age keeps up with the reports.
		const later = base + STARTUP_REPLAY_WINDOW_MS + 3 * 3_600_000;
		jest.setSystemTime(later);
		adapter.feed('ambient', { temperature: 25, battery: 79 });
		await pending;
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(later);
		expect((await values.readLatest(property))?.lastUpdated).toBe(new Date(later).toISOString());
	});

	it('makes a sleeping sensor usable right after startup when its replay carries last_seen', async () => {
		const lastSeen = base - 20 * 60_000;
		adapter.feed('ambient', { temperature: 21.5, last_seen: new Date(lastSeen).toISOString() }, true);
		await pending;
		expect(values.readQualifiedSample(property, 60 * 60_000)?.sampledAt.getTime()).toBe(lastSeen);
		expect(values.readQualifiedSample(property, 10 * 60_000)).toBeNull();
		expect((await values.readLatest(property))?.lastUpdated).toBe(new Date(lastSeen).toISOString());
	});

	it('never lets an older timed replay replace a newer stored observation after a restart', async () => {
		const storedAt = base - 5 * 60_000;
		storage.queryStrict.mockResolvedValueOnce([
			{ time: new Date(storedAt).toISOString(), numberValue: 22, propertyId: property.id },
		]);
		adapter.feed('ambient', { temperature: 21.5, last_seen: new Date(base - 20 * 60_000).toISOString() }, true);
		await pending;
		expect(await values.readLatest(property)).toMatchObject({
			value: 22,
			lastUpdated: new Date(storedAt).toISOString(),
		});
		expect(values.readQualifiedSample(property, 60 * 60_000)).toBeNull();
		// A replay newer than the stored observation is accepted with its own age.
		adapter.feed('ambient', { temperature: 21.5, last_seen: new Date(base - 60_000).toISOString() }, true);
		await pending;
		expect(values.readQualifiedSample(property, 60 * 60_000)?.sampledAt.getTime()).toBe(base - 60_000);
	});

	it('displays an untimed replay without recording its arrival as a measurement time, never epoch 0', async () => {
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect(await values.readLatest(property)).toMatchObject({ value: 25, lastUpdated: null });
		jest.setSystemTime(base + 1_000);
		await sample(26);
		expect(await values.readLatest(property)).toMatchObject({ value: 26, lastUpdated: null });
		expect(storage.writePoints).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
	});

	it('keeps the stored age for a changed untimed replay and still admits a later timed replay', async () => {
		const storedAt = base - 30 * 60_000;
		storage.queryStrict.mockResolvedValueOnce([
			{ time: new Date(storedAt).toISOString(), numberValue: 22, propertyId: property.id },
		]);
		await sample(21);
		expect(await values.readLatest(property)).toMatchObject({
			value: 21,
			lastUpdated: new Date(storedAt).toISOString(),
		});
		expect(storage.writePoints).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
		// A replay timed by last_seen, older than the untimed replay's arrival but newer than the stored
		// observation, is not rejected by a receipt time that was never a measurement time.
		const lastSeen = base - 10 * 60_000;
		adapter.feed('ambient', { temperature: 21, last_seen: new Date(lastSeen).toISOString() }, true);
		await pending;
		expect(values.readQualifiedSample(property, 60 * 60_000)?.sampledAt.getTime()).toBe(lastSeen);
	});

	it('skips a cold-cache replay when the stored value cannot be looked up, instead of re-timing it', async () => {
		storage.queryStrict.mockRejectedValueOnce(new Error('storage unavailable'));
		await sample(25);
		expect(storage.writePoints).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
		expect(await values.readLatest(property)).toBeNull();
		// A later replay retries the lookup.
		await sample(25);
		expect((await values.readLatest(property))?.value).toBe(25);
	});

	it('records the first real report of a value that was only displayed from an untimed replay', async () => {
		const storedAt = base - 30 * 60_000;
		storage.queryStrict.mockResolvedValueOnce([
			{ time: new Date(storedAt).toISOString(), numberValue: 20, propertyId: property.id },
		]);
		await sample(23);
		expect(await values.readLatest(property)).toMatchObject({
			value: 23,
			lastUpdated: new Date(storedAt).toISOString(),
		});
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(23);
		expect(storage.writePoints.mock.calls.length + storage.enqueueWritePoint.mock.calls.length).toBe(1);
		expect(await values.readLatest(property)).toMatchObject({
			value: 23,
			lastUpdated: new Date(base + STARTUP_REPLAY_WINDOW_MS).toISOString(),
		});
	});

	it('skips a timed replay when the stored value cannot be looked up: it has no baseline to be ordered against', async () => {
		storage.queryStrict.mockRejectedValueOnce(new Error('storage unavailable'));
		adapter.feed('ambient', { temperature: 21.5, last_seen: new Date(base - 20 * 60_000).toISOString() }, true);
		await pending;
		expect(storage.writePoints).not.toHaveBeenCalled();
		expect(storage.enqueueWritePoint).not.toHaveBeenCalled();
		expect(values.readQualifiedSample(property, 60 * 60_000)).toBeNull();
	});

	it('ignores fields absent from a cache_state=false report', async () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(25);
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS + 1_000);
		adapter.feed('ambient', { battery: 79 });
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + STARTUP_REPLAY_WINDOW_MS);
	});

	it('keeps a newer observation when an older replay arrives again after the cache was warmed by a read', async () => {
		const storedAt = base - 5 * 60_000;
		storage.queryStrict.mockResolvedValueOnce([
			{ time: new Date(storedAt).toISOString(), numberValue: 22, propertyId: property.id },
		]);
		const replay = { temperature: 21.5, last_seen: new Date(base - 20 * 60_000).toISOString() };
		adapter.feed('ambient', replay, true);
		await pending;
		expect((await values.readLatest(property))?.value).toBe(22);
		adapter.feed('ambient', replay, true);
		await pending;
		expect(await values.readLatest(property)).toMatchObject({
			value: 22,
			lastUpdated: new Date(storedAt).toISOString(),
		});
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(23);
		expect(await values.readLatest(property)).toMatchObject({
			value: 23,
			lastUpdated: new Date(base + STARTUP_REPLAY_WINDOW_MS).toISOString(),
		});
	});

	it('bounds the stored-state lookup: a stalled backend times out and a live report is still admitted', async () => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		storage.queryStrict.mockReturnValueOnce(new Promise(() => undefined));
		adapter.feed('ambient', { temperature: 25 });
		await jest.advanceTimersByTimeAsync(5_000);
		await pending;
		expect((await values.readLatest(property))?.value).toBe(25);
	});

	it('never lets a replay timed by last_seen confirm a pending command', async () => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(20);
		windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: 23,
			previousValue: 20,
			ttlMs: 3_000,
		});
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS + 1_000);
		adapter.feed('ambient', { temperature: 23, last_seen: new Date().toISOString() }, true);
		await pending;
		expect(windows.get(property.id)?.state).toBe('pending');
		await sample(23);
		expect(windows.get(property.id)?.state).toBe('confirmed_grace');
	});

	it('does not acknowledge an ordinary matching command from a retained replay; a device report confirms it', async () => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(20);
		windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: 23,
			previousValue: 20,
			ttlMs: 3_000,
		});
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS + 1_000);
		adapter.feed('ambient', { temperature: 23 }, true);
		await pending;
		expect(windows.get(property.id)?.state).toBe('pending');
		await sample(23);
		expect(windows.get(property.id)?.state).toBe('confirmed_grace');
	});

	it('holds a replay whose value fails only the command step while its command is pending', async () => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(20);
		property.step = 0.5;
		windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: 23,
			previousValue: 20,
			ttlMs: 3_000,
		});
		adapter.feed('ambient', { temperature: 21.3, last_seen: new Date().toISOString() }, true);
		await pending;
		expect((await values.readLatest(property))?.value).toBe(20);
		expect(windows.get(property.id)?.state).toBe('pending');
	});

	it('never lets a replay cancel a pending command recovery', async () => {
		jest.advanceTimersByTime(STARTUP_REPLAY_WINDOW_MS);
		await sample(20);
		const handle = windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: 23,
			previousValue: 20,
			ttlMs: 3_000,
		});
		windows.hold(handle, { value: 22, receivedAt: Date.now() });
		jest.advanceTimersByTime(3_001);
		windows.expire(property.id);
		expect(windows.hasRecovery(property.id)).toBe(true);
		adapter.feed('ambient', { temperature: 21, last_seen: new Date().toISOString() }, true);
		await pending;
		expect(windows.hasRecovery(property.id)).toBe(true);
		expect((await values.readLatest(property))?.value).toBe(20);
	});
});
