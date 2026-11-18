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
import { STARTUP_REPLAY_WINDOW_MS } from '../devices-zigbee2mqtt.constants';
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
		jest.setSystemTime(Date.now() + STARTUP_REPLAY_WINDOW_MS);
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

	it('accepts replays timed by last_seen with their real age: retained, startup window and cached replay', () => {
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
		const replay = adapter.getCachedStateReplay('ambient');
		expect(replay?.state).toEqual({ temperature: 25, last_seen: lastSeen });
		expect(replay?.metadata).toMatchObject({
			isCached: true,
			measurementFieldsAreLive: true,
			sampledAt: new Date(lastSeen),
		});
		expect(replay?.metadata.sourceIsCurrent()).toBe(true);
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
		expect(adapter.getCachedStateReplay('other')?.metadata).toMatchObject({
			isCached: true,
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_cached_replay_without_last_seen',
		});
		expect(adapter.getCachedStateReplay('unknown')).toBeNull();
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
		const storage = {
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
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS);
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

	it('times a replay by arrival, never epoch 0, and does not renew an unchanged replayed value', async () => {
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		expect((await values.readLatest(property))?.lastUpdated).toBe(new Date(base).toISOString());
		jest.setSystemTime(base + 1_000);
		await sample(25);
		expect((await values.readLatest(property))?.lastUpdated).toBe(new Date(base).toISOString());
		await sample(26);
		expect(await values.readLatest(property)).toMatchObject({
			value: 26,
			lastUpdated: new Date(base + 1_000).toISOString(),
		});
	});

	it('ignores fields absent from a cache_state=false report', async () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS);
		await sample(25);
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS + 1_000);
		adapter.feed('ambient', { battery: 79 });
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + STARTUP_REPLAY_WINDOW_MS);
	});

	it('does not acknowledge an ordinary matching command from a retained replay; a device report confirms it', async () => {
		jest.setSystemTime(base + STARTUP_REPLAY_WINDOW_MS);
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
});
