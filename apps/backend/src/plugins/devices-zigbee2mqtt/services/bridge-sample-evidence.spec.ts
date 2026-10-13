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

describe('Zigbee current bridge cache contract', () => {
	let adapter: FixtureAdapter;
	let callback: jest.Mock<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>;
	const cacheMode = (cache_state: unknown): unknown => ({ config: { advanced: { cache_state } } });
	const lastMetadata = (): Z2mDeviceStateMetadata => callback.mock.calls.at(-1)[2];
	beforeEach(async () => {
		adapter = new FixtureAdapter();
		callback = jest.fn<void, [string, Record<string, unknown>, Z2mDeviceStateMetadata]>();
		adapter.setCallbacks({ onDeviceStateChanged: callback });
		await adapter.connect();
		adapter.feed('bridge/state', { state: 'online' });
	});
	afterEach(async () => {
		await adapter.disconnect();
	});

	it('refuses unknown/merged configuration even when a non-retained battery heartbeat includes old temperature', () => {
		adapter.feed('ambient', { temperature: 25, battery: 80, last_seen: new Date().toISOString() });
		expect(lastMetadata().measurementFieldsAreLive).toBe(false);
		expect(adapter.getMeasurementReadiness().reasons).toEqual([
			'zigbee_current_cache_state_unknown_require_live_bridge_info_or_gateway_frontend_snapshot',
		]);
		adapter.feed('bridge/info', cacheMode(true));
		adapter.feed('ambient', { temperature: 25, battery: 79, last_seen: new Date().toISOString() });
		expect(lastMetadata()).toMatchObject({
			measurementFieldsAreLive: false,
			qualificationReason: 'zigbee_cache_state_merges_old_fields',
		});
		expect(adapter.getCachedState('ambient')).toMatchObject({ temperature: 25, battery: 79 });
	});

	it('accepts genuine equal-value fields only with current literal cache_state=false; absent fields stay absent', () => {
		adapter.feed('bridge/info', cacheMode(false));
		adapter.feed('ambient', { temperature: 25 });
		const first = lastMetadata();
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata().measurementFieldsAreLive).toBe(true);
		expect(first.sourceIsCurrent()).toBe(true);
		adapter.feed('bridge/info', cacheMode(false));
		expect(first.sourceIsCurrent()).toBe(true);
		adapter.feed('ambient', { battery: 79 });
		expect(callback.mock.calls.at(-1)[1]).toEqual({ battery: 79 });
		expect(first.sourceIsCurrent()).toBe(true);
		expect(adapter.getMeasurementReadiness().reasons).toEqual([]);
	});

	it.each([true, null, 'false'])('revokes previously accepted authority immediately on cache/proof loss %j', (mode) => {
		adapter.feed('bridge/info', cacheMode(false));
		adapter.feed('ambient', { temperature: 25, state: 'ON' });
		const first = lastMetadata();
		adapter.feed('bridge/info', cacheMode(mode));
		expect(first.isCurrent()).toBe(true); // display packet belongs to the same connection
		expect(first.sourceIsCurrent()).toBe(false); // old control evidence no longer has authority
	});

	it('never uses retained bridge info as current MQTT config or retained state as live measurement', async () => {
		adapter.feed('bridge/info', cacheMode(false), true);
		adapter.feed('ambient', { temperature: 25 });
		expect(lastMetadata().measurementFieldsAreLive).toBe(false);
		adapter.feed('bridge/info', cacheMode(false));
		adapter.feed('ambient', { temperature: 25 }, true);
		expect(lastMetadata().isRetained).toBe(true);
		expect(lastMetadata().sourceIsCurrent).toBeUndefined();
		adapter.feed('ambient', { temperature: 25 });
		const first = lastMetadata();
		await adapter.disconnect();
		expect(first.sourceIsCurrent()).toBe(false);
		await adapter.connect();
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
describe('Zigbee cache contract at sample and ordinary acknowledgement admission', () => {
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
					sampledAt: metadata.measurementFieldsAreLive ? metadata.observedAt : new Date(0),
					receivedAt: new Date(),
					observedAt: metadata.observedAt,
					provenance: metadata.isRetained ? 'retained' : metadata.measurementFieldsAreLive ? 'live' : 'cached',
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

	it('keeps cached scalar display but never manufactures temperature age from merged battery traffic', async () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: true } } });
		await sample(25);
		expect((await values.readLatest(property))?.value).toBe(25);
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
		jest.setSystemTime(base + 2_000);
		adapter.feed('ambient', { temperature: 25, battery: 79, last_seen: new Date().toISOString() });
		await pending;
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('renews genuine equal temperature, ignores absent fields, and revokes old qualification on config change inline', async () => {
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base);
		jest.setSystemTime(base + 1_000);
		await sample(25);
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + 1_000);
		jest.setSystemTime(base + 2_000);
		adapter.feed('ambient', { battery: 79 });
		expect(values.readQualifiedSample(property, 10_000)?.sampledAt.getTime()).toBe(base + 1_000);
		adapter.feed('bridge/info', { config: { advanced: { cache_state: true } } });
		expect(values.readQualifiedSample(property, 10_000)).toBeNull();
	});

	it('does not acknowledge an ordinary matching command from cache; genuine current readback confirms it', async () => {
		await sample(20);
		windows.open({
			canonicalTarget: { deviceId: 'device', channelId: 'channel', propertyId: property.id },
			requestedTargets: [],
			commandedValue: 23,
			previousValue: 20,
			ttlMs: 3_000,
		});
		jest.setSystemTime(base + 1_000);
		await sample(23);
		expect(windows.get(property.id)?.state).toBe('pending');
		adapter.feed('bridge/info', { config: { advanced: { cache_state: false } } });
		await sample(23);
		expect(windows.get(property.id)?.state).toBe('confirmed_grace');
	});
});
