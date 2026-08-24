import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyMappingTransformerService } from '../mappings/mapping-transformer.service';
import { ResolvedHomeyPropertyMapping } from '../mappings/mapping.types';
import { HomeyCapabilityType, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEvent, HomeyEventType } from '../models/homey-event.model';

import { HomeySynchronizerService } from './homey-synchronizer.service';

const BACKEND_RECEIVED_AT = '2026-08-24T10:00:00.000Z';
const BACKEND_RECEIVED_AT_MS = new Date(BACKEND_RECEIVED_AT).getTime();

function backendValueTimestamp(offset = 0): { valueTimestamp: Date } {
	return { valueTimestamp: new Date(BACKEND_RECEIVED_AT_MS + offset) };
}

const powerMapping: ResolvedHomeyPropertyMapping = {
	kind: 'properties',
	source: 'builtin',
	name: 'light-power',
	priority: 100,
	exclusive: false,
	conflict: 'error',
	match: {
		classes: ['light'],
		capabilityBaseIds: ['onoff'],
		allCapabilities: [],
		noneCapabilities: [],
		driverIds: [],
		manufacturers: [],
		models: [],
	},
	property: {
		channel: 'light',
		category: PropertyCategory.ON,
		dataType: DataTypeType.BOOL,
		direction: 'bidirectional',
	},
};

const stateMapping: ResolvedHomeyPropertyMapping = {
	...powerMapping,
	name: 'light-state-label',
	property: {
		...powerMapping.property,
		category: PropertyCategory.STATE,
		dataType: DataTypeType.STRING,
		direction: 'read_only',
		transform: { type: 'map', read: { true: 'on', false: 'off' } },
	},
};

const brightnessMapping: ResolvedHomeyPropertyMapping = {
	...powerMapping,
	name: 'light-brightness',
	match: { ...powerMapping.match, capabilityBaseIds: ['dim'] },
	property: {
		...powerMapping.property,
		category: PropertyCategory.BRIGHTNESS,
		dataType: DataTypeType.UCHAR,
		transform: { type: 'scale', input_range: [0, 1], output_range: [0, 100], clamp: true },
	},
};

function property(id: string, homeyCapabilityId: string, homeyMappingName: string): HomeyChannelPropertyEntity {
	return Object.assign(new HomeyChannelPropertyEntity(), {
		id,
		identifier: `${homeyCapabilityId}::${homeyMappingName}`,
		homeyCapabilityId,
		homeyMappingName,
		category: PropertyCategory.ON,
		name: homeyMappingName,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.BOOL,
		format: null,
		invalid: null,
		step: null,
	});
}

function adoptedDevice(properties: HomeyChannelPropertyEntity[]): HomeyDeviceEntity {
	const channel = Object.assign(new HomeyChannelEntity(), {
		id: 'panel-channel',
		identifier: 'light',
		name: 'Light',
		category: ChannelCategory.LIGHT,
		properties,
	});

	return Object.assign(new HomeyDeviceEntity(), {
		id: 'panel-device',
		identifier: 'homey-light',
		name: 'Light',
		channels: [channel],
	});
}

function homeyDevice(overrides: Partial<HomeyDevice> = {}): HomeyDevice {
	return {
		id: 'homey-light',
		name: 'Light',
		class: 'light',
		zoneId: 'zone-living',
		zoneName: 'Living room',
		zonePath: ['Living room'],
		available: true,
		availabilityMessage: null,
		driverId: 'homey:app:driver:light',
		manufacturer: 'Example',
		model: 'Light',
		energy: null,
		capabilities: [
			createHomeyCapability({
				id: 'onoff',
				title: 'Power',
				value: true,
				type: HomeyCapabilityType.BOOLEAN,
				unit: null,
				minimum: null,
				maximum: null,
				step: null,
				enumValues: [],
				readable: true,
				writable: true,
				available: true,
				lastUpdatedAt: '2026-08-21T10:00:00.000Z',
			}),
			createHomeyCapability({
				id: 'dim',
				title: 'Brightness',
				value: 0.25,
				type: HomeyCapabilityType.NUMBER,
				unit: null,
				minimum: 0,
				maximum: 1,
				step: 0.01,
				enumValues: [],
				readable: true,
				writable: true,
				available: true,
				lastUpdatedAt: '2026-08-21T10:00:00.000Z',
			}),
		],
		...overrides,
	};
}

function capabilityEvent(
	capabilityId: string,
	value: boolean | number | string | null,
	lastUpdatedAt: string | null,
	sequence: string | number | null = null,
): Extract<HomeyEvent, { type: HomeyEventType.CAPABILITY_VALUE_CHANGED }> {
	return {
		type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
		deviceId: 'homey-light',
		capabilityId,
		value,
		lastUpdatedAt,
		occurredAt: lastUpdatedAt,
		sequence,
	};
}

function inventory(device: HomeyDevice = homeyDevice()): ReadonlyMap<string, HomeyDevice> {
	return new Map([[device.id, device]]);
}

describe('HomeySynchronizerService', () => {
	let devicesService: jest.Mocked<Pick<DevicesService, 'findAll'>>;
	let propertiesService: jest.Mocked<Pick<ChannelsPropertiesService, 'update'>>;
	let connectivityService: jest.Mocked<Pick<DeviceConnectivityService, 'trySetConnectionState'>>;
	let mappingLoader: jest.Mocked<
		Pick<
			HomeyMappingLoaderService,
			'getPropertyMappings' | 'resolveChannelMappings' | 'resolveDeviceMappings' | 'resolvePropertyMappings'
		>
	>;
	let service: HomeySynchronizerService;
	let powerProperty: HomeyChannelPropertyEntity;
	let stateProperty: HomeyChannelPropertyEntity;
	let brightnessProperty: HomeyChannelPropertyEntity;

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(BACKEND_RECEIVED_AT_MS);
		powerProperty = property('property-power', 'onoff', powerMapping.name);
		stateProperty = property('property-state', 'onoff', stateMapping.name);
		brightnessProperty = property('property-brightness', 'dim', brightnessMapping.name);
		devicesService = {
			findAll: jest.fn().mockResolvedValue([adoptedDevice([powerProperty, stateProperty, brightnessProperty])]),
		};
		propertiesService = { update: jest.fn().mockResolvedValue(new HomeyChannelPropertyEntity()) };
		connectivityService = { trySetConnectionState: jest.fn().mockResolvedValue(true) };
		mappingLoader = {
			getPropertyMappings: jest.fn().mockReturnValue([powerMapping, stateMapping, brightnessMapping]),
			resolveDeviceMappings: jest.fn().mockReturnValue({ mappings: [{}], conflicts: [] }),
			resolveChannelMappings: jest.fn().mockReturnValue({
				mappings: [{ channel: { identifier: 'light' } }],
				conflicts: [],
			}),
			resolvePropertyMappings: jest.fn().mockReturnValue({
				mappings: [{ mapping: { property: { channel: 'light' } } }],
				conflicts: [],
			}),
		};
		service = new HomeySynchronizerService(
			devicesService as unknown as DevicesService,
			propertiesService as unknown as ChannelsPropertiesService,
			connectivityService as unknown as DeviceConnectivityService,
			mappingLoader as unknown as HomeyMappingLoaderService,
			new HomeyMappingTransformerService(),
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('indexes adopted full capability identities and applies the authoritative startup snapshot', async () => {
		await expect(service.synchronizeSnapshot([homeyDevice()])).resolves.toEqual({
			updated: 4,
			ignored: 0,
			failed: 0,
			acceptedEvents: [],
			acceptedCapabilityValues: [
				{ deviceId: 'homey-light', capabilityId: 'onoff', value: true },
				{ deviceId: 'homey-light', capabilityId: 'dim', value: 0.25 },
			],
		});

		expect(devicesService.findAll).toHaveBeenCalledWith(DEVICES_HOMEY_TYPE);
		expect(connectivityService.trySetConnectionState).toHaveBeenCalledWith('panel-device', {
			state: ConnectionState.CONNECTED,
		});
		const valueTimestamp = backendValueTimestamp();
		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: true }, valueTimestamp],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'on' }, valueTimestamp],
			['property-brightness', { type: DEVICES_HOMEY_TYPE, value: 25 }, valueTimestamp],
		]);
	});

	it('marks missing and unavailable adopted devices without deleting them', async () => {
		await service.synchronizeSnapshot([]);
		await service.synchronizeSnapshot([homeyDevice({ available: false, availabilityMessage: 'Unavailable' })]);

		expect(connectivityService.trySetConnectionState.mock.calls).toEqual([
			['panel-device', { state: ConnectionState.LOST }],
			['panel-device', { state: ConnectionState.DISCONNECTED }],
		]);
		expect(propertiesService.update).toHaveBeenCalledTimes(3);
	});

	it('summarizes adopted, missing, unsupported, and unavailable inventory without exposing identities', async () => {
		const missing = adoptedDevice([]);
		missing.id = 'panel-missing';
		missing.identifier = 'homey-missing';
		devicesService.findAll.mockResolvedValueOnce([adoptedDevice([]), missing]);
		const unsupported = homeyDevice({ id: 'homey-speaker', class: 'speaker' });
		mappingLoader.resolveDeviceMappings.mockImplementation((device) => ({
			mappings: device.class === 'speaker' ? [] : ([{}] as never[]),
			conflicts: [],
		}));

		await expect(
			service.getOperationalDiagnostics([
				homeyDevice({ available: false, availabilityMessage: 'Unavailable' }),
				unsupported,
			]),
		).resolves.toEqual({
			adopted: 2,
			adoptedDevices: [
				{ homeyDeviceId: 'homey-light', panelDeviceId: 'panel-device' },
				{ homeyDeviceId: 'homey-missing', panelDeviceId: 'panel-missing' },
			],
			missing: 1,
			unsupported: 1,
			unavailable: 1,
		});
	});

	it('does not publish a value for an unavailable capability', async () => {
		const unavailable = homeyDevice({
			capabilities: homeyDevice().capabilities.map((capability) =>
				capability.id === 'onoff' ? { ...capability, available: false } : capability,
			),
		});

		await service.synchronizeSnapshot([unavailable]);

		expect(propertiesService.update).toHaveBeenCalledTimes(1);
		expect(propertiesService.update).toHaveBeenCalledWith(
			'property-brightness',
			{
				type: DEVICES_HOMEY_TYPE,
				value: 25,
			},
			backendValueTimestamp(),
		);
	});

	it('preserves null as a valid normalized capability value', async () => {
		await service.refreshIndex();

		await service.synchronizeEvents([capabilityEvent('onoff', null, null)], inventory());

		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: null }, backendValueTimestamp()],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: null }, backendValueTimestamp()],
		]);
	});

	it('orders by Homey event metadata while persisting backend receive timestamps', async () => {
		await service.refreshIndex();
		const futureProviderTimestamp = '2027-08-24T10:00:00.000Z';
		const pastProviderTimestamp = '2025-08-24T10:00:00.000Z';

		await service.synchronizeEvents([capabilityEvent('onoff', false, futureProviderTimestamp, 1)], inventory());
		await service.synchronizeEvents([capabilityEvent('onoff', true, pastProviderTimestamp, 2)], inventory());
		await service.synchronizeEvents([capabilityEvent('onoff', false, '2028-08-24T10:00:00.000Z', 1)], inventory());

		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: false }, backendValueTimestamp()],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'off' }, backendValueTimestamp()],
			['property-power', { type: DEVICES_HOMEY_TYPE, value: true }, backendValueTimestamp(1)],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'on' }, backendValueTimestamp(1)],
		]);
	});

	it('reports whether a capability has a readable property binding', async () => {
		await service.refreshIndex();

		await expect(service.hasReadableCapabilityBinding('homey-light', 'onoff')).resolves.toBe(true);
		await expect(service.hasReadableCapabilityBinding('homey-light', 'vendor_write_only')).resolves.toBe(false);
		await expect(service.hasReadableCapabilityBinding('unadopted', 'onoff')).resolves.toBe(false);

		const replacement = property('replacement-brightness', 'dim', brightnessMapping.name);
		devicesService.findAll.mockResolvedValueOnce([adoptedDevice([replacement])]);
		service.invalidateIndex();

		await expect(service.hasReadableCapabilityBinding('homey-light', 'onoff')).resolves.toBe(false);
		await expect(service.hasReadableCapabilityBinding('homey-light', 'dim')).resolves.toBe(true);
	});

	it('filters unknown devices, unmapped capabilities, and invalid runtime values', async () => {
		await service.refreshIndex();

		const invalid = { ...capabilityEvent('onoff', true, null), value: { leaked: true } } as unknown as HomeyEvent;
		const result = await service.synchronizeEvents(
			[
				{ ...capabilityEvent('onoff', true, null), deviceId: 'unadopted' },
				capabilityEvent('vendor_unknown', 1, null),
				invalid,
			],
			inventory(),
		);

		expect(result).toEqual({ updated: 0, ignored: 3, failed: 0, acceptedEvents: [] });
		expect(propertiesService.update).not.toHaveBeenCalled();
		expect(connectivityService.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('coalesces bursts by full property identity while preserving final selected order and value', async () => {
		await service.refreshIndex();

		await service.synchronizeEvents(
			[
				capabilityEvent('onoff', true, '2026-08-21T10:01:00.000Z'),
				capabilityEvent('dim', 0.5, '2026-08-21T10:01:01.000Z'),
				capabilityEvent('onoff', false, '2026-08-21T10:01:02.000Z'),
			],
			inventory(),
		);

		expect(propertiesService.update.mock.calls).toEqual([
			['property-brightness', { type: DEVICES_HOMEY_TYPE, value: 50 }, backendValueTimestamp()],
			['property-power', { type: DEVICES_HOMEY_TYPE, value: false }, backendValueTimestamp()],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'off' }, backendValueTimestamp()],
		]);
	});

	it('ignores duplicate and out-of-order timestamped capability events', async () => {
		await service.refreshIndex();
		const newest = capabilityEvent('onoff', true, '2026-08-21T10:02:00.000Z');

		await service.synchronizeEvents([newest], inventory());
		await service.synchronizeEvents([newest], inventory());
		await service.synchronizeEvents([capabilityEvent('onoff', false, '2026-08-21T10:01:00.000Z')], inventory());

		expect(propertiesService.update).toHaveBeenCalledTimes(2);
		expect(propertiesService.update).toHaveBeenCalledWith(
			'property-power',
			{
				type: DEVICES_HOMEY_TYPE,
				value: true,
			},
			backendValueTimestamp(),
		);
	});

	it('prefers numeric event sequence over arrival order within a burst', async () => {
		await service.refreshIndex();

		await service.synchronizeEvents(
			[capabilityEvent('onoff', false, null, 2), capabilityEvent('onoff', true, null, 1)],
			inventory(),
		);

		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: false }, backendValueTimestamp()],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'off' }, backendValueTimestamp()],
		]);
	});

	it('rejects an older numeric sequence received in a later batch', async () => {
		await service.refreshIndex();
		const newest = capabilityEvent('onoff', true, null, 2);
		const stale = capabilityEvent('onoff', false, null, 1);

		const accepted = await service.synchronizeEvents([newest], inventory());
		const rejected = await service.synchronizeEvents([stale], inventory());

		expect(propertiesService.update).toHaveBeenCalledTimes(2);
		expect(propertiesService.update).toHaveBeenCalledWith(
			'property-power',
			{
				type: DEVICES_HOMEY_TYPE,
				value: true,
			},
			backendValueTimestamp(),
		);
		expect(accepted.acceptedEvents).toEqual([newest]);
		expect(rejected.acceptedEvents).toEqual([]);
	});

	it('persists newer sequences at a monotonic effective timestamp', async () => {
		await service.refreshIndex();
		const firstTimestamp = '2026-08-21T10:02:00.000Z';
		const secondTimestamp = '2026-08-21T10:01:00.000Z';

		await service.synchronizeEvents([capabilityEvent('onoff', true, firstTimestamp, 1)], inventory());
		await service.synchronizeEvents([capabilityEvent('onoff', false, secondTimestamp, 2)], inventory());

		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: true }, backendValueTimestamp()],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'on' }, backendValueTimestamp()],
			['property-power', { type: DEVICES_HOMEY_TYPE, value: false }, backendValueTimestamp(1)],
			['property-state', { type: DEVICES_HOMEY_TYPE, value: 'off' }, backendValueTimestamp(1)],
		]);
	});

	it('rebuilds persistence watermarks from loaded values after reset', async () => {
		await service.refreshIndex();
		await service.synchronizeEvents([capabilityEvent('onoff', true, '2026-08-21T10:02:00.000Z', 1)], inventory());

		const durableTimestamp = new Date(BACKEND_RECEIVED_AT_MS + 60_000).toISOString();
		powerProperty.value = new PropertyValueState(true, durableTimestamp);
		stateProperty.value = new PropertyValueState('on', durableTimestamp);
		service.reset();
		propertiesService.update.mockClear();
		await service.refreshIndex();

		await service.synchronizeEvents([capabilityEvent('onoff', false, '2026-08-21T10:01:00.000Z', 2)], inventory());

		expect(propertiesService.update.mock.calls).toEqual([
			[
				'property-power',
				{ type: DEVICES_HOMEY_TYPE, value: false },
				{ valueTimestamp: new Date(BACKEND_RECEIVED_AT_MS + 60_001) },
			],
			[
				'property-state',
				{ type: DEVICES_HOMEY_TYPE, value: 'off' },
				{ valueTimestamp: new Date(BACKEND_RECEIVED_AT_MS + 60_001) },
			],
		]);
	});

	it('includes local property writes in the persistence watermark', async () => {
		await service.refreshIndex();
		const commandTimestamp = new Date(BACKEND_RECEIVED_AT_MS + 120_000).toISOString();
		powerProperty.value = new PropertyValueState(true, commandTimestamp);
		service.recordPersistedPropertyValue(powerProperty);

		await service.synchronizeEvents([capabilityEvent('onoff', false, '2026-08-21T10:01:00.000Z', 1)], inventory());

		expect(propertiesService.update).toHaveBeenCalledWith(
			'property-power',
			{ type: DEVICES_HOMEY_TYPE, value: false },
			{ valueTimestamp: new Date(BACKEND_RECEIVED_AT_MS + 120_001) },
		);
	});

	it('rejects a conflicting capability value at an already-applied order', async () => {
		await service.refreshIndex();
		const applied = capabilityEvent('onoff', true, null, 2);
		const conflicting = capabilityEvent('onoff', false, null, 2);

		await service.synchronizeEvents([applied], inventory());
		propertiesService.update.mockClear();
		const rejected = await service.synchronizeEvents([conflicting], inventory());

		expect(propertiesService.update).not.toHaveBeenCalled();
		expect(rejected.acceptedEvents).toEqual([]);
	});

	it('blocks older capability events after a newer write failure and allows an equal-order retry', async () => {
		await service.refreshIndex();
		propertiesService.update.mockRejectedValueOnce(new Error('storage unavailable'));
		const newest = capabilityEvent('onoff', true, null, 2);

		const partiallyApplied = await service.synchronizeEvents([newest], inventory());
		expect(partiallyApplied.acceptedEvents).toEqual([]);
		propertiesService.update.mockClear();
		await service.synchronizeEvents([capabilityEvent('onoff', false, null, 1)], inventory());

		expect(propertiesService.update).not.toHaveBeenCalled();

		const retried = await service.synchronizeEvents([newest], inventory());

		expect(propertiesService.update.mock.calls).toEqual([
			['property-power', { type: DEVICES_HOMEY_TYPE, value: true }, backendValueTimestamp()],
		]);
		expect(retried.acceptedEvents).toEqual([newest]);
	});

	it('rejects capability events missing from authoritative inventory or unavailable upstream', async () => {
		await service.synchronizeSnapshot([]);
		propertiesService.update.mockClear();

		await service.synchronizeEvents([capabilityEvent('onoff', false, null, 2)], new Map());
		await service.synchronizeEvents(
			[capabilityEvent('onoff', false, null, 3)],
			inventory(
				homeyDevice({
					capabilities: homeyDevice().capabilities.map((capability) =>
						capability.id === 'onoff' ? { ...capability, available: false } : capability,
					),
				}),
			),
		);

		expect(propertiesService.update).not.toHaveBeenCalled();
	});

	it('preserves a numeric sequence watermark across an unsequenced snapshot', async () => {
		await service.refreshIndex();

		await service.synchronizeEvents([capabilityEvent('onoff', true, null, 2)], inventory());
		await service.synchronizeSnapshot([
			homeyDevice({
				capabilities: homeyDevice().capabilities.map((capability) => ({
					...capability,
					lastUpdatedAt: null,
				})),
			}),
		]);
		propertiesService.update.mockClear();

		await service.synchronizeEvents([capabilityEvent('onoff', false, null, 1)], inventory());

		expect(propertiesService.update).not.toHaveBeenCalled();
	});

	it('coalesces availability and removal to the final lost state without a delete path', async () => {
		await service.refreshIndex();

		await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
					deviceId: 'homey-light',
					available: false,
					availabilityMessage: 'Unavailable',
					occurredAt: null,
					sequence: null,
				},
				{
					type: HomeyEventType.DEVICE_REMOVED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: null,
				},
			],
			new Map(),
		);

		expect(connectivityService.trySetConnectionState.mock.calls).toEqual([
			['panel-device', { state: ConnectionState.LOST }],
		]);
		expect(devicesService).not.toHaveProperty('remove');
	});

	it('rejects stale availability sequences within one batch and across later batches', async () => {
		await service.refreshIndex();
		const available: Extract<HomeyEvent, { type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED }> = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'homey-light',
			available: true,
			availabilityMessage: null,
			occurredAt: null,
			sequence: 2,
		};
		const stale = { ...available, available: false, availabilityMessage: 'Offline', sequence: 1 };

		const currentDevices = new Map([['homey-light', homeyDevice()]]);
		await service.synchronizeEvents([available, stale], currentDevices);
		await service.synchronizeEvents([stale], currentDevices);

		expect(connectivityService.trySetConnectionState).toHaveBeenCalledTimes(1);
		expect(connectivityService.trySetConnectionState).toHaveBeenCalledWith('panel-device', {
			state: ConnectionState.CONNECTED,
		});
	});

	it('retries an equal-sequence device event until connectivity is actually applied', async () => {
		await service.refreshIndex();
		connectivityService.trySetConnectionState.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const event: HomeyEvent = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'homey-light',
			available: false,
			availabilityMessage: 'Offline',
			occurredAt: null,
			sequence: 2,
		};

		const currentDevices = new Map([['homey-light', homeyDevice()]]);
		await service.synchronizeEvents([event], currentDevices);
		await service.synchronizeEvents([event], currentDevices);
		await service.synchronizeEvents([event], currentDevices);

		expect(connectivityService.trySetConnectionState).toHaveBeenCalledTimes(2);
	});

	it('shares device ordering across availability, add, update, and removal events', async () => {
		await service.refreshIndex();
		const available: HomeyEvent = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'homey-light',
			available: true,
			availabilityMessage: null,
			occurredAt: null,
			sequence: 2,
		};

		await service.synchronizeEvents(
			[
				available,
				{
					type: HomeyEventType.DEVICE_ADDED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: 1,
				},
				{
					type: HomeyEventType.DEVICE_UPDATED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: 1,
				},
				{
					type: HomeyEventType.DEVICE_REMOVED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: 1,
				},
			],
			new Map([['homey-light', homeyDevice()]]),
		);

		expect(connectivityService.trySetConnectionState).toHaveBeenCalledTimes(1);
		expect(connectivityService.trySetConnectionState).toHaveBeenCalledWith('panel-device', {
			state: ConnectionState.CONNECTED,
		});
		expect(propertiesService.update).not.toHaveBeenCalled();
	});

	it('preserves a numeric device watermark across an unsequenced device event', async () => {
		await service.refreshIndex();
		const currentDevices = new Map([['homey-light', homeyDevice()]]);

		await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
					deviceId: 'homey-light',
					available: true,
					availabilityMessage: null,
					occurredAt: null,
					sequence: 2,
				},
			],
			currentDevices,
		);
		await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_UPDATED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: null,
				},
			],
			currentDevices,
		);
		connectivityService.trySetConnectionState.mockClear();

		await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
					deviceId: 'homey-light',
					available: false,
					availabilityMessage: 'Delayed',
					occurredAt: null,
					sequence: 1,
				},
			],
			currentDevices,
		);

		expect(connectivityService.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('filters a stale removal before callers mutate their inventory cache', async () => {
		await service.refreshIndex();
		const update: HomeyEvent = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: 'homey-light',
			occurredAt: null,
			sequence: 2,
		};
		const removal: HomeyEvent = {
			type: HomeyEventType.DEVICE_REMOVED,
			deviceId: 'homey-light',
			occurredAt: null,
			sequence: 1,
		};

		expect(service.filterEvents([update, removal])).toEqual([update]);
		await service.synchronizeEvents([update], new Map([['homey-light', homeyDevice()]]));
		expect(service.filterEvents([removal])).toEqual([]);
	});

	it('retains a refresh event before a newer availability event for the same device', () => {
		const update: HomeyEvent = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: 'homey-light',
			occurredAt: null,
			sequence: 1,
		};
		const availability: HomeyEvent = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'homey-light',
			available: false,
			availabilityMessage: 'Offline',
			occurredAt: null,
			sequence: 2,
		};

		expect(service.filterEvents([update, availability])).toEqual([update, availability]);
	});

	it('does not resurrect an adopted device from availability when authoritative inventory omits it', async () => {
		await service.synchronizeSnapshot([]);
		connectivityService.trySetConnectionState.mockClear();

		await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
					deviceId: 'homey-light',
					available: true,
					availabilityMessage: null,
					occurredAt: null,
					sequence: 2,
				},
			],
			new Map(),
		);

		expect(connectivityService.trySetConnectionState).not.toHaveBeenCalled();
	});

	it('commits zone-triggered snapshot event ordering from fresh values', async () => {
		const current = homeyDevice({
			capabilities: homeyDevice().capabilities.map((capability) => ({ ...capability, lastUpdatedAt: null })),
		});
		const event = capabilityEvent('onoff', false, null, 2);

		const result = await service.synchronizeSnapshot([current], [event]);
		propertiesService.update.mockClear();
		await service.synchronizeEvents([{ ...event, value: false, sequence: 1 }], inventory(current));

		expect(propertiesService.update).not.toHaveBeenCalled();
		expect(result.acceptedEvents).toEqual([{ ...event, value: true }]);
	});

	it('commits buffered startup ordering after applying fresh targeted readback', async () => {
		const current = homeyDevice({
			capabilities: homeyDevice().capabilities.map((capability) => ({ ...capability, lastUpdatedAt: null })),
		});
		const capability: HomeyEvent = {
			type: HomeyEventType.CAPABILITY_VALUE_CHANGED,
			deviceId: 'homey-light',
			capabilityId: 'onoff',
			value: false,
			lastUpdatedAt: null,
			occurredAt: null,
			sequence: 2,
		};
		const availability: HomeyEvent = {
			type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
			deviceId: 'homey-light',
			available: false,
			availabilityMessage: 'Stale event payload',
			occurredAt: null,
			sequence: 2,
		};

		const result = await service.synchronizeDevices([current], [], [capability, availability]);
		propertiesService.update.mockClear();
		connectivityService.trySetConnectionState.mockClear();

		await service.synchronizeEvents(
			[
				{ ...capability, value: false, sequence: 1 },
				{
					type: HomeyEventType.DEVICE_REMOVED,
					deviceId: 'homey-light',
					occurredAt: null,
					sequence: 1,
				},
			],
			inventory(current),
		);

		expect(propertiesService.update).not.toHaveBeenCalled();
		expect(connectivityService.trySetConnectionState).not.toHaveBeenCalled();
		expect(result.acceptedEvents).toEqual([{ ...capability, value: true }]);
	});

	it('carries a lifecycle refresh sequence into the fresh capability values', async () => {
		const current = homeyDevice({
			capabilities: homeyDevice().capabilities.map((capability) => ({ ...capability, lastUpdatedAt: null })),
		});
		const update: HomeyEvent = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: 'homey-light',
			occurredAt: null,
			sequence: 2,
		};

		await service.synchronizeDevices([current], [], [update]);
		propertiesService.update.mockClear();
		await service.synchronizeEvents([capabilityEvent('onoff', false, null, 1)], inventory(current));

		expect(propertiesService.update).not.toHaveBeenCalled();
	});

	it('uses the refreshed device after a device update event and isolates per-property failures', async () => {
		await service.refreshIndex();
		propertiesService.update.mockRejectedValueOnce(new Error('storage unavailable'));
		const current = homeyDevice();
		const result = await service.synchronizeEvents(
			[
				{
					type: HomeyEventType.DEVICE_UPDATED,
					deviceId: current.id,
					occurredAt: null,
					sequence: null,
				},
			],
			new Map([[current.id, current]]),
		);

		expect(result).toEqual({ updated: 3, ignored: 0, failed: 1, acceptedEvents: [] });
		expect(propertiesService.update).toHaveBeenCalledTimes(3);
	});

	it('rebuilds an invalidated index before processing later events', async () => {
		await service.refreshIndex();
		const replacement = property('replacement-power', 'onoff', powerMapping.name);
		devicesService.findAll.mockResolvedValueOnce([adoptedDevice([replacement])]);
		service.invalidateFromEntity();

		await service.synchronizeEvents([capabilityEvent('onoff', false, null)], inventory());

		expect(devicesService.findAll).toHaveBeenCalledTimes(2);
		expect(propertiesService.update).toHaveBeenLastCalledWith(
			'replacement-power',
			{
				type: DEVICES_HOMEY_TYPE,
				value: false,
			},
			backendValueTimestamp(),
		);
	});

	it('repeats an in-flight refresh when the device structure changes during its database read', async () => {
		let resolveInitial: (devices: HomeyDeviceEntity[]) => void = () => undefined;
		const replacement = property('replacement-power', 'onoff', powerMapping.name);
		devicesService.findAll
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveInitial = resolve;
					}),
			)
			.mockResolvedValueOnce([adoptedDevice([replacement])]);

		const refresh = service.refreshIndex();
		await Promise.resolve();
		service.invalidateFromEntity();
		resolveInitial([adoptedDevice([powerProperty])]);
		await refresh;
		await service.synchronizeEvents([capabilityEvent('onoff', false, null)], inventory());

		expect(devicesService.findAll).toHaveBeenCalledTimes(2);
		expect(propertiesService.update).toHaveBeenCalledWith(
			'replacement-power',
			{
				type: DEVICES_HOMEY_TYPE,
				value: false,
			},
			backendValueTimestamp(),
		);
	});
});
