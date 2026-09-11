import { Characteristic, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { HomeKitEventListener } from '../../../plugins/devices-homekit/listeners/homekit-event.listener';
import {
	CharacteristicBinding,
	HomeKitMapperContext,
} from '../../../plugins/devices-homekit/mappers/homekit-mapper.interface';
import { LightbulbMapper } from '../../../plugins/devices-homekit/mappers/lightbulb.mapper';
import { HomeKitMapperRegistryService } from '../../../plugins/devices-homekit/services/homekit-mapper-registry.service';
import { VirtualProjectionListener } from '../../../plugins/devices-virtual/listeners/virtual-projection.listener';
import { VirtualPropertyIndexService } from '../../../plugins/devices-virtual/services/virtual-property-index.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { CommandLatencyTraceCollectorService } from './command-latency-trace-collector.service';
import { DeviceStructureLockService } from './device-structure-lock.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';
import { PropertyStateCoordinatorService } from './property-state-coordinator.service';
import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';
import { PropertyValueService } from './property-value.service';

class SourceProperty extends ChannelPropertyEntity {
	get type(): string {
		return 'convergence-source';
	}
}

class AliasProperty extends ChannelPropertyEntity {
	get type(): string {
		return 'convergence-alias';
	}
}

/**
 * Source-near integration coverage for #1032's automated portion.
 *
 * It owns the deterministic command -> provider report -> projection -> HomeKit path. Route,
 * authorization, PATCH, MCP, room, and scene coverage remains in their respective owning suites;
 * Raspberry Pi latency and client evidence remain the open hardware/release portion of #1032.
 */
describe('property command convergence integration', () => {
	let events: EventEmitter2;
	let source: SourceProperty;
	let aliasA: AliasProperty;
	let aliasB: AliasProperty;
	let channel: ChannelEntity;
	let device: DeviceEntity;
	let properties: Map<string, ChannelPropertyEntity>;
	let history: Array<string | number | boolean | null>;
	let writeWithState: jest.Mock;
	let windows: PropertyCommandWindowService;
	let channelsProperties: ChannelsPropertiesService;
	let commandDispatch: PropertyCommandDispatchService;
	let traceCollector: CommandLatencyTraceCollectorService;
	let platform: jest.Mocked<Pick<IDevicePlatform, 'processBatch'>>;

	const makeProperty = <T extends ChannelPropertyEntity>(PropertyClass: new () => T, id: string): T => {
		const property = new PropertyClass();
		property.id = id;
		property.category = PropertyCategory.ON;
		property.permissions = [PermissionType.READ_WRITE];
		property.dataType = DataTypeType.BOOL;
		property.identifier = null;
		property.name = id;
		property.unit = null;
		property.format = null;
		property.invalid = null;
		property.step = null;
		property.value = { value: false, lastUpdated: null, trend: null };
		property.channel = channel;

		return property;
	};

	const update = (property: ChannelPropertyEntity, value: boolean): IDevicePropertyData => ({
		device,
		channel,
		property,
		value,
	});

	beforeEach(() => {
		events = new EventEmitter2();
		device = new DeviceEntity();
		device.id = 'convergence-device';
		device.name = 'Convergence light';
		device.category = DeviceCategory.LIGHTING;
		channel = new ChannelEntity();
		channel.id = 'convergence-channel';
		channel.category = ChannelCategory.LIGHT;
		channel.device = device;
		source = makeProperty(SourceProperty, 'convergence-source');
		aliasA = makeProperty(AliasProperty, 'convergence-alias-a');
		aliasB = makeProperty(AliasProperty, 'convergence-alias-b');
		// The HomeKit mapper binds the virtual alias, while provider reports use its
		// canonical source. The second alias exercises fan-out projection.
		channel.properties = [aliasA];
		device.channels = [channel];
		properties = new Map([
			[source.id, source],
			[aliasA.id, aliasA],
			[aliasB.id, aliasB],
		]);
		history = [];
		windows = new PropertyCommandWindowService();
		traceCollector = new CommandLatencyTraceCollectorService({
			runId: 'integration-run',
			sourcePropertyId: source.id,
			projectionPropertyId: aliasA.id,
		});

		const valueSources = new PropertyValueSourceRegistryService();
		valueSources.register({
			getType: () => 'convergence-alias',
			resolve: () => source.id,
		});
		interface PropertyQuery {
			innerJoinAndSelect: () => PropertyQuery;
			where: (_query: string, values: { id: string }) => PropertyQuery;
			callListeners: () => PropertyQuery;
			getOne: () => Promise<ChannelPropertyEntity | null>;
		}
		const queryBuilder = (): PropertyQuery => {
			let id = '';
			const query: PropertyQuery = {
				innerJoinAndSelect: () => query,
				where: (_query, values) => {
					id = values.id;
					return query;
				},
				callListeners: () => query,
				getOne: () => Promise.resolve(properties.get(id) ?? null),
			};

			return query;
		};
		const repository = { createQueryBuilder: jest.fn(queryBuilder) };
		const mapper = {
			getMapping: jest.fn(() => ({
				type: 'convergence-source',
				class: SourceProperty,
				createDto: class {},
				updateDto: UpdateChannelPropertyDto,
			})),
		};
		writeWithState = jest.fn((property: ChannelPropertyEntity, value: boolean) => {
			const previous = property.value?.value ?? null;
			const changed = previous !== value;
			const state = { value, lastUpdated: new Date().toISOString(), trend: null };
			property.value = state;
			if (changed) {
				history.push(value);
			}
			return { changed, state };
		});
		const propertyValueService = {
			writeWithState,
		};
		const structureLocks = new DeviceStructureLockService();
		const propertyState = new PropertyStateCoordinatorService();

		channelsProperties = new ChannelsPropertiesService(
			repository as never,
			mapper as unknown as ChannelsPropertiesTypeMapperService,
			propertyValueService as unknown as PropertyValueService,
			valueSources,
			structureLocks,
			propertyState,
			windows,
			{ manager: {}, getRepository: jest.fn() } as never,
			events,
			traceCollector,
		);
		jest.spyOn(channelsProperties, 'findOne').mockImplementation((id) => Promise.resolve(properties.get(id) ?? null));

		platform = { processBatch: jest.fn().mockResolvedValue(true) };
		commandDispatch = new PropertyCommandDispatchService(
			channelsProperties,
			{
				findOne: jest.fn((id: string) => Promise.resolve(id === channel.id ? channel : null)),
			} as unknown as ChannelsService,
			{
				findOne: jest.fn((id: string) => Promise.resolve(id === device.id ? device : null)),
			} as unknown as DevicesService,
			{
				get: jest.fn(() => platform),
				usesAuthoritativePropertyReadback: jest.fn(() => false),
			} as unknown as PlatformRegistryService,
			valueSources,
			structureLocks,
			propertyState,
			windows,
			traceCollector,
		);

		const projection = new VirtualProjectionListener(
			{
				findBySourceProperty: jest.fn((id: string) => (id === source.id ? [aliasA, aliasB] : [])),
			} as unknown as VirtualPropertyIndexService,
			events,
		);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			projection.handlePropertyValueSet(property),
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('holds a delayed source report until confirmation and projects only the confirmed value to a bound HomeKit alias', async () => {
		let releaseHomeKitDispatch: () => void = () => undefined;
		let resolveCommandDispatch: () => void = () => undefined;
		const commandDispatched = new Promise<void>((resolve) => {
			resolveCommandDispatch = resolve;
		});
		const bindings: CharacteristicBinding[] = [];
		const homeKitDispatcher = {
			dispatch: jest.fn(async (propertyId: string, value: unknown) => {
				expect(propertyId).toBe(aliasA.id);
				await commandDispatch.dispatchBatch([update(aliasA, Boolean(value))]);
				resolveCommandDispatch();
				await new Promise<void>((resolve) => {
					releaseHomeKitDispatch = resolve;
				});
			}),
		};
		const context: HomeKitMapperContext = {
			commandDispatcher: homeKitDispatcher as never,
			registerBinding: (binding) => bindings.push(binding),
			registerPropertyListener: jest.fn(),
		};
		const accessory = new LightbulbMapper().buildAccessory(device, context);
		const characteristic = accessory?.getService(Service.Lightbulb)?.getCharacteristic(Characteristic.On);
		if (characteristic === undefined) {
			throw new Error('Lightbulb On characteristic was not built');
		}
		const updateValue = jest.spyOn(characteristic, 'updateValue');
		const homeKitListener = new HomeKitEventListener({
			getBindingsForProperty: jest.fn((id: string) => (id === aliasA.id ? bindings : [])),
			getListenersForProperty: jest.fn(() => []),
		} as unknown as HomeKitMapperRegistryService);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			homeKitListener.handlePropertyValueChanged(property),
		);
		const published: Array<{ id: string; value: unknown }> = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			published.push({ id: property.id, value: property.value?.value }),
		);

		const set = characteristic.handleSetRequest(true);
		await commandDispatched;
		expect(await characteristic.handleGetRequest()).toBe(true);
		expect(platform.processBatch).toHaveBeenCalledWith([expect.objectContaining({ property: aliasA, value: true })]);

		await channelsProperties.update(source.id, { type: source.type, value: false });
		expect(history).toEqual([]);
		expect(published).toEqual([]);
		expect(writeWithState).not.toHaveBeenCalled();
		expect(updateValue).not.toHaveBeenCalledWith(false);

		await channelsProperties.update(source.id, { type: source.type, value: true });
		expect(history).toEqual([true]);
		expect(published).toEqual([
			{ id: aliasA.id, value: true },
			{ id: aliasB.id, value: true },
			{ id: source.id, value: true },
		]);
		expect(aliasA.value?.value).toBe(true);
		expect(aliasB.value?.value).toBe(true);
		expect(updateValue).not.toHaveBeenCalledWith(false);

		releaseHomeKitDispatch();
		await set;
		expect(await characteristic.handleGetRequest()).toBe(true);
	});

	it('publishes one unchanged same-value confirmation to the source and each virtual alias', async () => {
		const published: Array<{ id: string; value: unknown }> = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			published.push({ id: property.id, value: property.value?.value }),
		);

		await commandDispatch.dispatchBatch([update(aliasA, false)]);
		await channelsProperties.update(source.id, { type: source.type, value: false });
		await channelsProperties.update(source.id, { type: source.type, value: false });

		expect(history).toEqual([]);
		expect(published).toEqual([
			{ id: aliasA.id, value: false },
			{ id: aliasB.id, value: false },
			{ id: source.id, value: false },
		]);
		expect(writeWithState).toHaveBeenCalledTimes(2);
		expect(windows.get(source.id)?.state).toBe('confirmed_grace');
	});

	it('reconciles one held direct-source report after expiry without replaying it through projections before recovery', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
		const published: string[] = [];
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) => published.push(property.id));

		await commandDispatch.dispatchBatch([update(source, true)], { ttlMs: 100 });
		await channelsProperties.update(source.id, { type: source.type, value: false });
		expect(history).toEqual([]);
		expect(published).toEqual([]);

		jest.advanceTimersByTime(100);
		await (
			channelsProperties as unknown as { recoverExpiredCommandWindows: () => Promise<void> }
		).recoverExpiredCommandWindows();

		expect(history).toEqual([]);
		expect(published).toEqual([]);
		expect(windows.get(source.id)).toBeNull();
		expect(writeWithState).toHaveBeenCalledTimes(1);
	});

	it('keeps one outer server invocation across the type-less value-only fallback', async () => {
		const mapper = (channelsProperties as unknown as { propertiesMapperService: { getMapping: jest.Mock } })
			.propertiesMapperService;
		mapper.getMapping.mockReturnValue({
			type: source.type,
			class: SourceProperty,
			createDto: class {},
			updateDto: UpdateChannelPropertyDto,
			beforeUpdate: jest.fn(),
		});
		const dataSource = (channelsProperties as unknown as { dataSource: { getRepository: jest.Mock } }).dataSource;
		dataSource.getRepository.mockReturnValue({ save: jest.fn().mockResolvedValue(source) });
		traceCollector.observeCommand({
			requestId: 'fallback-request',
			intentId: 'fallback-intent',
			properties: [{ property: aliasA.id, value: true }],
		});
		await commandDispatch.dispatchBatch([update(aliasA, true)], { intentId: 'fallback-intent' });

		await channelsProperties.update(source.id, { value: true } as UpdateChannelPropertyDto);

		const complete = traceCollector.getCaptures().filter((capture) => capture.status === 'complete');
		expect(complete).toHaveLength(1);
		expect(complete[0]?.records.filter((record) => record.stage === 'update-entry')).toHaveLength(1);
		expect(complete[0]?.records.filter((record) => record.stage === 'source-publication')).toHaveLength(1);
	});
});
