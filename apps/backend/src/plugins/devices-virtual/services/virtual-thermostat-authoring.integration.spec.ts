import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VirtualIndexMaintenanceListener } from '../listeners/virtual-index-maintenance.listener';
import { VirtualProjectionListener } from '../listeners/virtual-projection.listener';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import { VirtualThermostatRuntimeEntity } from '../entities/virtual-thermostat-runtime.entity';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../../modules/config/services/plugins-type-mapper.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { CommandLatencyTraceCollectorService } from '../../../modules/devices/services/command-latency-trace-collector.service';
import { ChannelsControlsService } from '../../../modules/devices/services/channels.controls.service';
import { DevicesControlsService } from '../../../modules/devices/services/devices.controls.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { DeviceEntitySubscriber } from '../../../modules/devices/subscribers/device-entity.subscriber';
import { ChannelEntitySubscriber } from '../../../modules/devices/subscribers/channel-entity.subscriber';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { EnergyClaimRegistryService } from '../../../modules/energy/services/energy-claim.registry.service';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import { SwaggerModelsRegistryService } from '../../../modules/swagger/services/swagger-models-registry.service';
import { ExtendedDiscriminatorService } from '../../../modules/swagger/services/extended-discriminator.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StoragePoint } from '../../../modules/storage/storage.types';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { DevicesVirtualPlugin } from '../devices-virtual.plugin';
import { VirtualDeviceInformationListener } from '../listeners/virtual-device-information.listener';
import { VirtualStatusListener } from '../listeners/virtual-status.listener';
import { VirtualDevicePlatform } from '../platforms/virtual-device.platform';
import { SourceNotVirtualConstraintValidator } from '../validators/source-not-virtual-constraint.validator';
import { VirtualPropertyIndexService } from './virtual-property-index.service';
import { VirtualEnergyClaimService } from './virtual-energy-claim.service';
import { VirtualValueSourceService } from './virtual-value-source.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';

import { plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource, hasCurrentSqliteConnectionLease } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ChannelControlEntity, ChannelEntity, ChannelPropertyEntity, DeviceControlEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualThermostatAuthoringService } from './virtual-thermostat-authoring.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';

interface CreationNativeConnection {
	all: (this: CreationNativeConnection, query: string, parameters: unknown[], callback: (this: unknown, error: Error | null, rows?: unknown[]) => void) => unknown;
}
function creationNative(value: unknown): value is CreationNativeConnection {
	return value !== null && typeof value === 'object' && typeof Reflect.get(value, 'all') === 'function';
}

jest.setTimeout(30000);

describe('atomic virtual thermostat authoring', () => {
	let database: SqliteDataSource;
	let authoring: VirtualThermostatAuthoringService;
	let registry: PropertyCommandAdmissionRegistryService;
	let claims: VirtualThermostatClaimsService;
	let configs: VirtualThermostatConfigService;
	let devices: DevicesService;
	let events: EventEmitter2;
	let ambientId: string;
	let relayId: string;
	let relayDeviceId: string;
	const publications: EventType[] = [];
	let values: PropertyValueService;
	let owner: Awaited<ReturnType<typeof originalOwnedFixture>> | undefined;
	beforeEach(async () => {
		owner = undefined;
		publications.length = 0;
		jest.clearAllMocks();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		events = new EventEmitter2();
		for (const event of [
			EventType.DEVICE_CREATED,
			EventType.CHANNEL_CREATED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
		])
			events.on(event, () => publications.push(event));
		// Instrument the ORIGINAL emitter before its actual singleton registrations/capabilities capture it.
		// It calls through normally; the old event-failure row later changes only this same spy's implementation.
		jest.spyOn(events, 'emit');
		const sensorDevice = uuid(),
			sensorChannel = uuid();
		ambientId = uuid();
		await database
			.getRepository(DeviceEntity)
			.insert({ id: sensorDevice, name: 'Sensor', category: DeviceCategory.SENSOR, enabled: true });
		await database.getRepository(ChannelEntity).insert({
			id: sensorChannel,
			device: sensorDevice,
			name: 'Temperature',
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.getRepository(ChannelPropertyEntity).insert({
			id: ambientId,
			channel: sensorChannel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		relayId = await actuator();
		// synchronize creates tables but does not run the existing graph migration's singleton seed.
		// This TEST baseline models that existing migration row; production readers NEVER ensure it.
		await database.manager.insert(VirtualGraphRevisionEntity, { id: 1, revision: 0 });
		owner = await originalOwnedFixture();
		({ authoring, claims, configs, devices, values } = owner);
		registry = owner.commandAdmission;
		// Negative observer only: owned creation never calls the ordinary value-write path.
		jest.spyOn(values, 'write');
		publications.length = 0;
	});
	afterEach(async () => {
		if (owner) await owner.close();
		if (database?.isInitialized) await database.destroy();
		jest.useRealTimers();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});
	async function actuator(existingDevice?: string) {
		const device = existingDevice ?? uuid(),
			channel = uuid(),
			property = uuid();
		if (!existingDevice) {
			relayDeviceId = device;
			await database.getRepository(ShellyNgDeviceEntity).insert({
				id: device,
				name: 'Relay',
				identifier: 'shellyplus1pm-' + uuid(),
				category: DeviceCategory.SWITCHER,
				enabled: true,
				canonicalMac: 'A8032ABE5084',
			});
		}
		await database.getRepository(ShellyNgChannelEntity).insert({
			id: channel,
			device,
			name: 'Switch',
			identifier: existingDevice ? 'switch:00' : 'switch:0',
			category: ChannelCategory.SWITCHER,
		} as never);
		await database.getRepository(ShellyNgChannelPropertyEntity).insert({
			id: property,
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		return property;
	}
	const request = (relay: string): CreateVirtualThermostatProducerDto => {
		const settings: { setting: string; property: string }[] = [];
		const property = (channel: ChannelCategory, category: PropertyCategory, setting?: string) => {
			const metadata = getPropertyMetadata(channel, category);
			const id = uuid();
			if (setting) settings.push({ setting, property: id });
			return {
				id,
				type: 'virtual',
				identifier: category,
				category,
				data_type: metadata.data_type,
				permissions: [PermissionType.READ_ONLY],
				value_origin: VirtualValueOrigin.LOCAL,
				format: metadata.format,
			};
		};
		const channel = (category: ChannelCategory, properties: ReturnType<typeof property>[]) => ({
			id: uuid(),
			type: 'virtual',
			identifier: category,
			name: category,
			category,
			properties,
		});
		return plainToInstance(CreateVirtualThermostatProducerDto, {
			device: {
				id: uuid(),
				type: 'virtual',
				name: 'Draft thermostat',
				category: DeviceCategory.THERMOSTAT,
				mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
				channels: [
					channel(ChannelCategory.TEMPERATURE, [property(ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE)]),
					channel(ChannelCategory.THERMOSTAT, [
						property(ChannelCategory.THERMOSTAT, PropertyCategory.LOCKED, 'locked'),
					]),
					channel(
						ChannelCategory.DEVICE_INFORMATION,
						[
							PropertyCategory.MANUFACTURER,
							PropertyCategory.MODEL,
							PropertyCategory.SERIAL_NUMBER,
							PropertyCategory.STATUS,
						].map((category) => property(ChannelCategory.DEVICE_INFORMATION, category)),
					),
					channel(ChannelCategory.HEATER, [
						property(ChannelCategory.HEATER, PropertyCategory.ON, 'heating_enabled'),
						property(ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, 'heating_setpoint'),
						property(ChannelCategory.HEATER, PropertyCategory.STATUS),
					]),
				],
			},
			configuration: {
				schema_version: 1,
				expected_revision: 0,
				requested_mode: 'off',
				policy: {
					heatingSetpoint: 20,
					coolingSetpoint: null,
					coldTolerance: 0.5,
					hotTolerance: 0.5,
					neutralMargin: 1,
					minimumOffMs: 0,
					changeoverMs: 0,
					floor: null,
				},
				contact_opening_ms: 0,
				contact_closing_ms: 0,
				sources: [{ role: 'ambient', source_property: ambientId, maximum_age_seconds: 300 }],
				actuators: [{ role: 'heating', source_property: relay, lease_seconds: 30 }],
				settings,
			},
		});
	};

	it('previews metadata without changing catalog, claim epoch, ON admission or publications', async () => {
		const input = request(relayId);
		const epoch = registry.capture();
		const target = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const admission = {
			property: target,
			channel: target.channel as ChannelEntity,
			device: (target.channel as ChannelEntity).device as DeviceEntity,
			value: true,
		};
		await registry.assertAllowed(admission);
		const preview = await authoring.preview(input);
		expect(preview.readiness).toBe('draft');
		expect(epoch.isCurrent()).toBe(true);
		await registry.assertAllowed(admission);
		expect(
			await database.manager.count(VirtualDeviceEntity, { where: { mode: VirtualDeviceMode.CLIMATE_CONTROLLER } }),
		).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('resolves a saved property directly to its channel and device', async () => {
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: ambientId },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		expect(await authoring.propertyBinding(ambientId)).toEqual({
			property: ambientId,
			channel: channel.id,
			device: (channel.device as DeviceEntity).id,
		});
		expect(await authoring.propertyBinding(uuid())).toBeNull();
	});

	it('commits the owner and canonical reservation together and rejects a second UUID alias', async () => {
		const first = request(relayId);
		const created = await authoring.create(first);
		expect(created.device.id).toBe(first.device.id);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		const alias = await actuator(relayDeviceId);
		const second = request(alias);
		publications.length = 0;
		await expect(authoring.create(second)).rejects.toThrow('Canonical physical actuator is already reserved');
		expect(
			await database.manager.count(VirtualDeviceEntity, { where: { mode: VirtualDeviceMode.CLIMATE_CONTROLLER } }),
		).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		expect(publications).toEqual([]);
	});

	it.each([
		{ label: 'returns the persisted thermostat when post-commit value write fails', failure: 'value write' },
		{ label: 'returns the persisted thermostat when post-commit claims refresh fails', failure: 'claims refresh' },
		{ label: 'returns the persisted thermostat when post-commit event publication fails', failure: 'event publication' },
		{ label: 'returns fixed persisted A despite unavailable latest device hydration', failure: 'device hydration' },
	])(
		'$label',
		async ({ failure }) => {
			const input = request(relayId);
			if (!owner) throw new Error('Original owning fixture unavailable');
			const failedWrite = jest.fn<Promise<void>, []>().mockRejectedValueOnce(new Error('value write failed'));
			if (failure === 'value write') owner.boundary.write = () => failedWrite();
			const failedRefresh = failure === 'claims refresh'
				? jest.spyOn(claims, 'refresh').mockRejectedValueOnce(new Error('refresh failed')) : undefined;
			let eventFailureReached = false;
			if (failure === 'event publication')
				jest.spyOn(events, 'emit').mockImplementation((event: string | symbol, ...args: unknown[]) => {
					if (event === THERMOSTAT_CONFIG_CHANGED) { eventFailureReached = true; throw new Error('publication failed'); }
					return Boolean(EventEmitter2.prototype.emit.call(events, event, ...args));
				});
			const hydration = failure === 'device hydration'
				? jest.spyOn(devices, 'findOne').mockRejectedValueOnce(new Error('hydration failed')) : undefined;
			const created = await authoring.create(input);
			if (failure === 'value write') expect(failedWrite).toHaveBeenCalledTimes(1);
			if (hydration) expect(hydration).not.toHaveBeenCalled();
			if (failedRefresh) expect(failedRefresh).toHaveBeenCalled();
			if (failure === 'event publication') expect(eventFailureReached).toBe(true);
			expect(created.device.id).toBe(input.device.id);
			expect(created.device.channels).toHaveLength(input.device.channels.length);
			expect(created.configuration.controller).toBe(input.device.id);
			expect(created.configuration.revision).toBe(1);
			expect(created.configuration.actuators).toEqual([
				expect.objectContaining({ source_property: relayId, state: 'reserved', revision: 1 }),
			]);
			expect(created.configuration.readiness).toBe('draft');
			const settingId = input.configuration.settings.find(
				(setting) => setting.setting === 'heating_enabled',
			).propertyId;
			const committedSetting = created.device.channels
				.flatMap((channel) => channel.properties)
				.find((property) => property.id === settingId);
			expect(committedSetting?.permissions).toEqual([PermissionType.READ_WRITE]);
			expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: settingId })).permissions).toEqual([
				PermissionType.READ_WRITE,
			]);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		},
	);

	it('returns the durable creation when commit subscriber reconciliation fails closed', async () => {
		const subscriber = new VirtualThermostatOwnershipSubscriber(database, claims);
		await subscriber.onApplicationBootstrap();
		const commitRefresh = jest.spyOn(subscriber, 'afterTransactionCommit');
		await claims.refresh();
		const input = request(relayId);
		const target = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: relayId },
			relations: ['channel', 'channel.device'],
		});
		const admission = {
			property: target,
			channel: target.channel as ChannelEntity,
			device: (target.channel as ChannelEntity).device as DeviceEntity,
			value: true,
		};
		await claims.assertAllowed(admission);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		const originalFind = database.manager.find.bind(database.manager);
		let failRefresh = true;
		const refresh = jest.spyOn(database.manager, 'find').mockImplementation(async (...args) => {
			if (failRefresh && args[0] === VirtualThermostatActuatorClaimEntity)
				throw new Error('commit reconciliation failed');
			return (await originalFind(...args)) as Record<string, unknown>[];
		});
		const created = await authoring.create(input);
		expect(commitRefresh).toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
		expect(created.device.id).toBe(input.device.id);
		expect(created.configuration.controller).toBe(input.device.id);
		expect(created.configuration.actuators).toEqual([
			expect.objectContaining({ source_property: relayId, state: 'reserved' }),
		]);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		expect(() => claims.assertAllowed(admission)).toThrow('reconciling');
		expect(jest.getTimerCount()).toBe(1);
		failRefresh = false;
		const retryRefresh = jest.spyOn(claims, 'refresh');
		await jest.advanceTimersByTimeAsync(1000);
		expect(retryRefresh).toHaveBeenCalledTimes(1);
		await (retryRefresh.mock.results[0].value as Promise<void>);
		expect(jest.getTimerCount()).toBe(0);
		expect(() => claims.assertAllowed(admission)).toThrow('reserved');
	});

	it('preserves a nontransactional catalog write when reconciliation fails', async () => {
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		jest.spyOn(claims, 'refresh').mockRejectedValue(new Error('reconciliation failed'));
		await database.manager.update(ChannelPropertyEntity, { id: ambientId }, { name: 'Renamed ambient' });
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ambientId })).name).toBe(
			'Renamed ambient',
		);
	});

	it('preserves the original transaction error when rollback reconciliation fails', async () => {
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
		jest.spyOn(claims, 'refresh').mockRejectedValue(new Error('reconciliation failed'));
		await expect(
			database.transaction(async (manager) => {
				await manager.update(ChannelPropertyEntity, { id: ambientId }, { name: 'Rolled back' });
				throw new Error('original transaction failure');
			}),
		).rejects.toThrow('original transaction failure');
		expect((await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: ambientId })).name).not.toBe(
			'Rolled back',
		);
	});

	it('rolls back the full graph and claim if persistence fails after real creation hooks', async () => {
		const input = request(relayId);
		if (!owner) throw new Error('Original owning fixture unavailable');
		const { persistCreated } = configs;
		const original: Readonly<{ call: (receiver: VirtualThermostatConfigService, ...args: Parameters<VirtualThermostatConfigService['persistCreated']>) => ReturnType<VirtualThermostatConfigService['persistCreated']> }> = persistCreated;
		const oldError = new Error('injected post-persist failure');
		let persisted = false;
		jest.spyOn(configs, 'persistCreated').mockImplementationOnce(async (context, prepared) => {
			await original.call(configs, context, prepared);
			persisted = true;
			throw oldError;
		});
		owner.automation.onModuleDestroy();
		const faultProvider = new VirtualThermostatAutomationService(owner.writer, owner.core, owner.graph, new NestConfigService(), authoring);
		faultProvider.onModuleInit();
		owner.extraProviders.push(faultProvider);
		await expect(authoring.create(input)).rejects.toThrow('injected post-persist failure');
		expect(persisted).toBe(true);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
		for (const channel of input.device.channels ?? []) {
			expect(await database.manager.countBy(ChannelEntity, { id: channel.id })).toBe(0);
			for (const property of channel.properties ?? [])
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(0);
		}
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});
	/** Selected required singleton chain; index/projection are real additional listeners only when explicitly included.
	 * This fixture is not a full application/bootstrap proof. Storage transport and metadata sink are inert. */
	async function originalOwnedFixture(includeIndexAndProjection = false) {
		const lock = new DeviceStructureLockService();
		const core = new ClimateAutomationRegistryService();
		const writer = new ClimateAutomationWriterService(database, lock, core);
		const graph = new VirtualDependencyGraphService(database, new NestConfigService(), writer);
		const producers = new PropertyProducerRegistryService(events);
		const sourceRegistry = new PropertyValueSourceRegistryService();
		const deviceMapper = new DevicesTypeMapperService();
		const channelMapper = new ChannelsTypeMapperService();
		const propertyMapper = new ChannelsPropertiesTypeMapperService();
		const storageConfig = Object.assign(new StorageConfigModel(), { primaryStorage: 'creation-test-primary', fallbackStorage: 'creation-test-fallback' });
		const submittedPoints: StoragePoint[][] = [];
		const boundary: { available?: () => void; write?: () => Promise<void> } = {};
		const transport: StoragePlugin = {
			name: 'creation-test-primary', initialize: () => Promise.resolve(), destroy: () => Promise.resolve(),
			isAvailable: () => { boundary.available?.(); return true; }, writePoints: (points) => { submittedPoints.push(points); return boundary.write?.() ?? Promise.resolve(); }, query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('Raw storage queries are outside this inert fixture')),
			registerSchema: () => undefined, dropMeasurement: () => Promise.resolve(), getMeasurements: () => Promise.resolve([]),
		};
		// The real StorageService consumes this configuration-only provider; it confers no creation authority.
		const storageModule = await Test.createTestingModule({ providers: [StorageService,
			{ provide: ConfigService, useValue: { getModuleConfig: () => storageConfig } },
		] }).compile();
		const storage = storageModule.get(StorageService);
		storage.registerPlugin(transport.name, transport);
		const valueLock = new PropertyValueLockService(database);
		const values = new PropertyValueService(storage, sourceRegistry, valueLock, producers, events);
		const state = new DeviceConnectionStateService(storage);
		const metadata = new PropertyMetadataService(database);
		const trace = new CommandLatencyTraceCollectorService();
		const properties = new ChannelsPropertiesService(database.getRepository(ChannelPropertyEntity), propertyMapper,
			values, sourceRegistry, lock, new PropertyStateCoordinatorService(), new PropertyCommandWindowService(), database, events, trace, metadata);
		const channels = new ChannelsService(database.getRepository(ChannelEntity), channelMapper, properties,
			new ChannelsControlsService(database.getRepository(ChannelControlEntity), database, events), lock, database, events);
		const zones = new DeviceZonesService(database.getRepository(DeviceZoneEntity), database.getRepository(DeviceEntity), database.getRepository(SpaceEntity), events);
		const devices = new DevicesService(database.getRepository(DeviceEntity), database.getRepository(SpaceEntity), deviceMapper,
			channels, properties, new DevicesControlsService(database.getRepository(DeviceControlEntity), database, events), zones, lock, database, events);
		const validation = new DeviceValidationService(devices);
		const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), graph);
		const virtual = new VirtualDevicesService(properties, channels, devices, index, validation, graph, database);
		const connectivity = new DeviceConnectivityService(devices, channels, properties, state, events);
		const status = new VirtualStatusListener(index, connectivity, state);
		const info = new VirtualDeviceInformationListener(channels, properties, status, events);
		const indexMaintenance = new VirtualIndexMaintenanceListener(index, status, devices, virtual, properties, lock, events, database, database.getRepository(DeviceEntity), graph);
		const projection = new VirtualProjectionListener(index, events);
		// Call-through observer installed BEFORE the real Nest loader binds this original handler.
		const projectionEvents = includeIndexAndProjection ? jest.spyOn(projection, 'handlePropertyValueStateChanged') : undefined;
		const indexJobs: Promise<unknown>[] = [];
		if (includeIndexAndProjection) {
			// Observation only: retain the actual worker Promise discarded by the production
			// fire-and-forget dispatcher. No phase/map/readiness field or worker result is forged.
			const descriptor = Object.getOwnPropertyDescriptor(VirtualIndexMaintenanceListener.prototype, 'runRebuildLoop');
			const original: unknown = descriptor?.value;
			if (!descriptor || descriptor.get || descriptor.set || typeof original !== 'function') throw new Error('Actual index worker descriptor required');
			Object.defineProperty(indexMaintenance, 'runRebuildLoop', { ...descriptor, value: function (this: VirtualIndexMaintenanceListener) {
				const returned: unknown = Reflect.apply(original, this, []);
				if (!(returned instanceof Promise)) throw new Error('Actual asynchronous index worker required');
				const work: Promise<unknown> = returned;
				indexJobs.push(work); void work.catch(() => undefined);
				return work;
			} });
		}
		const commandAdmission = new PropertyCommandAdmissionRegistryService();
		const claims = new VirtualThermostatClaimsService(database, lock, graph, commandAdmission, events);
		const configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values);
		const authoring = new VirtualThermostatAuthoringService(database, lock, graph, devices, validation, configs,
			writer, deviceMapper, channelMapper, propertyMapper, producers, storage, events);
		const automation = new VirtualThermostatAutomationService(writer, core, graph, new NestConfigService(), authoring);
		const extraProviders: VirtualThermostatAutomationService[] = [];
		const producerState = new VirtualProducerStateService(database, producers, graph, events);
		const platformRegistry = new PlatformRegistryService();
		const module = await Test.createTestingModule({ imports: [EventEmitterModule.forRoot()], providers: [
			DevicesVirtualPlugin,
			{ provide: PluginsTypeMapperService, useValue: new PluginsTypeMapperService() },
			{ provide: DevicesTypeMapperService, useValue: deviceMapper },
			{ provide: ChannelsTypeMapperService, useValue: channelMapper },
			{ provide: ChannelsPropertiesTypeMapperService, useValue: propertyMapper },
			{ provide: SwaggerModelsRegistryService, useValue: new SwaggerModelsRegistryService() },
			{ provide: ExtendedDiscriminatorService, useValue: new ExtendedDiscriminatorService() },
			{ provide: ExtensionsService, useValue: { registerPluginMetadata: () => undefined } },
			{ provide: VirtualValueSourceService, useValue: new VirtualValueSourceService(graph) },
			{ provide: PropertyValueSourceRegistryService, useValue: sourceRegistry },
			{ provide: VirtualEnergyClaimService, useValue: new VirtualEnergyClaimService(index) },
			{ provide: EnergyClaimRegistryService, useValue: new EnergyClaimRegistryService() },
			{ provide: VirtualDevicePlatform, useValue: new VirtualDevicePlatform(new DeviceCommandGraphService(metadata, values, state), platformRegistry, graph, configs) },
			{ provide: PlatformRegistryService, useValue: platformRegistry },
			{ provide: VirtualDeviceInformationListener, useValue: info },
			{ provide: VirtualStatusListener, useValue: status },
			...(includeIndexAndProjection ? [{ provide: VirtualIndexMaintenanceListener, useValue: indexMaintenance }, { provide: VirtualProjectionListener, useValue: projection }] : []),
			{ provide: VirtualDevicesService, useValue: virtual },
			{ provide: VirtualDependencyGraphService, useValue: graph },
			{ provide: VirtualProducerStateService, useValue: producerState },
			{ provide: PropertyProducerRegistryService, useValue: producers },
			{ provide: VirtualThermostatConfigService, useValue: configs },
			{ provide: VirtualThermostatClaimsService, useValue: claims },
			{ provide: VirtualThermostatAutomationService, useValue: automation },
			{ provide: ChannelsPropertiesService, useValue: properties },
			{ provide: CategoryAllowedConstraintValidator, useValue: new CategoryAllowedConstraintValidator(virtual) },
			{ provide: DeviceIsVirtualConstraintValidator, useValue: new DeviceIsVirtualConstraintValidator(virtual) },
			{ provide: DeviceExistsConstraintValidator, useValue: new DeviceExistsConstraintValidator(devices) },
			{ provide: SourceNotVirtualConstraintValidator, useValue: new SourceNotVirtualConstraintValidator(virtual) },
		] }).overrideProvider(EventEmitter2).useValue(events).compile();
		useContainer(module, { fallbackOnErrors: true });
		new DeviceEntitySubscriber(state, database);
		new ChannelEntitySubscriber(database);
		new ChannelPropertyEntitySubscriber(values, state, database);
		const ownership = new VirtualThermostatOwnershipSubscriber(database, claims);
		await ownership.onApplicationBootstrap();
		try { await module.init(); } catch (cause) {
			automation.onModuleDestroy(); info.onModuleDestroy(); producerState.onModuleDestroy(); claims.onModuleDestroy(); producers.onModuleDestroy();
			try { await module.close(); } finally { await storageModule.close(); }
			throw cause;
		}
		return { module, writer, core, graph, producers, values, storage, transport, submittedPoints, boundary, info, status, state, devices, channels, properties, index, indexMaintenance, projection, projectionEvents, indexJobs,
			claims, commandAdmission, configs, authoring, automation, extraProviders, deviceMapper, channelMapper, propertyMapper, lock,
			close: async () => {
				// Close original authority synchronously before any await or restoration of test spies.
				for (const provider of extraProviders) provider.onModuleDestroy();
				automation.onModuleDestroy(); info.onModuleDestroy(); producerState.onModuleDestroy(); claims.onModuleDestroy();
				await Promise.all(indexJobs);
				await module.close(); await storageModule.close();
			},
		};
	}

	async function reachesCreationBarrier<T>(pending: Promise<T>, barrier: Promise<void>): Promise<void> {
		await Promise.race([barrier, pending.then(() => { throw new Error('Creation settled before its actual fixture barrier'); }, (cause: unknown) => { throw cause; })]);
	}

	describe('original-owned actual plugin creation and native leaf publication', () => {
		let fixture: Awaited<ReturnType<typeof originalOwnedFixture>>;
		beforeEach(() => { if (!owner) throw new Error('Original owning fixture unavailable'); fixture = owner; });

		it('uses both real validators, one retained prepare, actual catalog hooks and fixed A response after native release', async () => {
			const input = request(relayId);
			const exists = jest.spyOn(fixture.module.get(DeviceExistsConstraintValidator), 'validate');
			const containment = jest.spyOn(fixture.module.get(DeviceIsVirtualConstraintValidator), 'validate');
			const parentReads: boolean[] = [];
			database.subscribers.push({ beforeQuery: (event) => {
				if (event.query.includes('"device"."type" AS "type"') && event.parameters?.includes(input.device.id))
					parentReads.push(event.queryRunner.manager.queryRunner === event.queryRunner && event.queryRunner.isTransactionActive && hasCurrentSqliteConnectionLease(database));
			} });
			const prepare = jest.spyOn(fixture.configs, 'prepare');
			// Construct a fresh legitimate provider after the instrumented method is installed, rather than rescuing an old capture.
			fixture.automation.onModuleDestroy();
			const provider = new VirtualThermostatAutomationService(fixture.writer, fixture.core, fixture.graph, new NestConfigService(), fixture.authoring);
			provider.onModuleInit();
			const before = await fixture.graph.revision();
			const forbiddenGlobalDeviceLookup = jest.spyOn(fixture.devices, 'findOne');

			const rowsAtPublish: number[] = [];
			const configurationEvents: string[] = [];
			events.on(THERMOSTAT_CONFIG_CHANGED, (id: string) => { configurationEvents.push(id); });
			events.on(EventType.DEVICE_CREATED, () => { rowsAtPublish.push(fixture.lock.hasCurrentStructuralLease() ? 1 : 0); });
			try {
				const result = await fixture.authoring.create(input);
				expect(result.device.id).toBe(input.device.id);
				expect(result.configuration.revision).toBe(1);
				expect(prepare).toHaveBeenCalledTimes(1);
				expect(exists.mock.calls.filter(([id]) => id === input.device.id).length).toBeGreaterThanOrEqual(2);
				expect(containment.mock.calls.filter(([id]) => id === input.device.id).length).toBeGreaterThanOrEqual(2);
				expect(parentReads.length).toBeGreaterThanOrEqual(2);
				expect(parentReads.every(Boolean)).toBe(true);
				expect(forbiddenGlobalDeviceLookup).not.toHaveBeenCalled();
				expect(rowsAtPublish).toEqual([0]);
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
				for (const setting of input.configuration.settings)
					expect(fixture.submittedPoints.flat().filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId)).toHaveLength(1);
				expect(configurationEvents).toEqual([input.device.id]);
				expect(await fixture.state.readLatest(result.device)).toMatchObject({ online: false, status: 'unknown' });
				expect(await fixture.graph.revision()).toBe(before + 1);
				const slots = await database.query('SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?', [input.device.id]);
				expect(slots).toHaveLength(1);
				expect(slots[0]).toMatchObject({ manualHold: 0, state: 'EMPTY' });
				const config = await database.manager.findOneOrFail(VirtualThermostatConfigEntity, { where: { controllerId: input.device.id } });
				expect(config.revision).toBe(1);
				expect(result.configuration).not.toHaveProperty('manualGeneration');
				expect(JSON.stringify(result)).not.toMatch(/manualGeneration|slotIncarnation|ownerToken|publicationLease|creationTurn/);
			} finally { provider.onModuleDestroy(); }
		});


		it('hydrates all three real getter-only STI classes from the retained plan and acknowledges their native creation before publication', async () => {
			for (const type of [VirtualDeviceEntity, VirtualChannelEntity, VirtualChannelPropertyEntity]) {
				const metadata = database.getMetadata(type);
				const discriminator = metadata.discriminatorColumn;
				if (!discriminator) throw new Error('Actual child discriminator required');
				expect(metadata.columns).toContain(discriminator);
				const descriptor = Object.getOwnPropertyDescriptor(type.prototype, discriminator.propertyName);
				expect(descriptor?.get).toEqual(expect.any(Function));
				expect(descriptor?.set).toBeUndefined();
			}
			const prepare = jest.spyOn(fixture.configs, 'prepare');
			fixture.automation.onModuleDestroy();
			const provider = new VirtualThermostatAutomationService(fixture.writer, fixture.core, fixture.graph, new NestConfigService(), fixture.authoring);
			provider.onModuleInit(); fixture.extraProviders.push(provider);
			let nativeAcknowledgments = 0;
			const commitsAtPublication: number[] = [];
			database.subscribers.push({ afterQuery: (event) => { if (event.query === 'COMMIT' && event.success) nativeAcknowledgments++; } });
			events.on(EventType.DEVICE_CREATED, () => commitsAtPublication.push(nativeAcknowledgments));
			const input = request(relayId);
			const result = await fixture.authoring.create(input);
			expect(prepare).toHaveBeenCalledTimes(1);
			expect(commitsAtPublication).toHaveLength(1);
			expect(commitsAtPublication[0]).toBeGreaterThan(0);
			expect(result.device).toBeInstanceOf(VirtualDeviceEntity);
			expect(result.device.type).toBe('virtual');
			const device = await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: input.device.id });
			expect(device.type).toBe('virtual');
			expect(Object.hasOwn(device, 'type')).toBe(false);
			for (const channel of input.device.channels ?? []) {
				const actualChannel = await database.manager.findOneByOrFail(VirtualChannelEntity, { id: channel.id });
				expect(actualChannel.type).toBe('virtual');
				expect(Object.hasOwn(actualChannel, 'type')).toBe(false);
				for (const property of channel.properties ?? []) {
					const actualProperty = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: property.id });
					expect(actualProperty.type).toBe('virtual');
					expect(Object.hasOwn(actualProperty, 'type')).toBe(false);
				}
			}
			expect(fixture.submittedPoints.length).toBeGreaterThan(0);
			for (const setting of input.configuration.settings)
				expect(fixture.submittedPoints.flat().filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId)).toHaveLength(1);
		});

		it.each([
			{ mutation: 'channel lineage', afterSubmission: false },
			{ mutation: 'channel type', afterSubmission: false },
			{ mutation: 'device type', afterSubmission: false },
			{ mutation: 'setting role', afterSubmission: false },
			{ mutation: 'setting deletion', afterSubmission: false },
			{ mutation: 'setting retarget', afterSubmission: false },
			{ mutation: 'extra setting binding', afterSubmission: false },
			{ mutation: 'full config same revision', afterSubmission: false },
			{ mutation: 'full config same revision', afterSubmission: true },
		])('refuses a peer-committed $mutation before a native leaf (prior submission: $afterSubmission)', async ({ mutation, afterSubmission }) => {
			// Own file, actual independent native connections. Old cases retain their original memory DB.
			const directory = await mkdtemp(join(tmpdir(), 'thermostat-creation-peer-'));
			const filename = join(directory, 'creation.sqlite');
			let peer: SqliteDataSource | undefined;
			let pending: Promise<Awaited<ReturnType<VirtualThermostatAuthoringService['create']>>> | undefined;
			let release: () => void = () => {};
			try {
				await fixture.close(); owner = undefined;
				await database.query('VACUUM INTO ?', [filename]);
				await database.destroy();
				database = await new SqliteDataSource({ type: 'sqlite', database: filename, entities: [__dirname + '/../../../**/*.entity.ts'], synchronize: false, migrationsRun: false }).initialize();
				owner = await originalOwnedFixture(); fixture = owner;
				peer = await new SqliteDataSource({ type: 'sqlite', database: filename, entities: [__dirname + '/../../../**/*.entity.ts'], synchronize: false, migrationsRun: false }).initialize();
				expect(peer).not.toBe(database);
				expect(peer.driver).not.toBe(database.driver);
				const input = request(relayId);
				const information = input.device.channels?.find((channel) => channel.category === ChannelCategory.DEVICE_INFORMATION);
				const setting = input.configuration.settings.find((row) => row.setting === 'heating_setpoint');
				const unbound = information?.properties?.find((property) => property.category === PropertyCategory.MANUFACTURER);
				if (!information || !setting || !unbound) throw new Error('Real original leaf fixture required');
				const propertyIds = input.device.channels?.flatMap((channel) => channel.properties?.map((property) => property.id) ?? []) ?? [];
				let enter: () => void = () => {};
				const entered = new Promise<void>((resolve) => { enter = resolve; });
				const held = new Promise<void>((resolve) => { release = resolve; });
				let selected = false;
				const changes: unknown[] = [];
				let valueEvents = 0, configEvents = 0;
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => { valueEvents++; });
				events.on(THERMOSTAT_CONFIG_CHANGED, () => { configEvents++; });
				database.subscribers.push({
					beforeQuery: async (event) => {
						if (!selected && event.query.startsWith('UPDATE "devices_module_channels_properties" SET "id" = "id"') && (!afterSubmission || fixture.submittedPoints.length > 0)) {
							selected = true; enter(); await held;
						}
					},
					afterQuery: (event) => { if (selected && event.query === 'SELECT changes() AS changes') { const raw: unknown = event.rawResults; changes.push(raw); } },
				});
				pending = fixture.authoring.create(input);
				void pending.catch(() => undefined);
				await reachesCreationBarrier(pending, entered);
				const submitted = fixture.submittedPoints.slice();
				const priorValueEvents = valueEvents;
				if (afterSubmission) expect(submitted.length).toBeGreaterThan(0);
				else expect(submitted).toEqual([]);
				const properties = await peer.query<unknown[]>('SELECT * FROM devices_module_channels_properties WHERE id IN (' + propertyIds.map(() => '?').join(',') + ') ORDER BY id', propertyIds);
				const slots = await peer.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?', [input.device.id]);
				// Every mutation commits on B while A is suspended BEFORE its actual affected-one SQL.
				await peer.transaction(async (manager) => {
					if (mutation === 'channel lineage') await manager.query('UPDATE devices_module_channels SET deviceId = ? WHERE id = ?', [relayDeviceId, information.id]);
					else if (mutation === 'channel type') await manager.query('UPDATE devices_module_channels SET type = ? WHERE id = ?', ['peer-channel', information.id]);
					else if (mutation === 'device type') await manager.query('UPDATE devices_module_devices SET type = ? WHERE id = ?', ['peer-device', input.device.id]);
					else if (mutation === 'setting role') await manager.query('UPDATE devices_virtual_thermostat_settings SET setting = ? WHERE propertyId = ?', ['peer-setting', setting.propertyId]);
					else if (mutation === 'setting deletion') await manager.query('DELETE FROM devices_virtual_thermostat_settings WHERE propertyId = ?', [setting.propertyId]);
					else if (mutation === 'setting retarget') await manager.query('UPDATE devices_virtual_thermostat_settings SET propertyId = ? WHERE propertyId = ?', [unbound.id, setting.propertyId]);
					else if (mutation === 'extra setting binding') await manager.query('INSERT INTO devices_virtual_thermostat_settings(propertyId, controllerId, setting, contractFingerprint) VALUES (?, ?, ?, ?)', [unbound.id, input.device.id, 'peer-extra', 'peer-fingerprint']);
					else await manager.query('UPDATE devices_virtual_thermostat_configs SET locked = 1 - locked WHERE controllerId = ?', [input.device.id]);
				});
				expect((await peer.query<{ revision: number }[]>('SELECT revision FROM devices_virtual_thermostat_configs WHERE controllerId = ?', [input.device.id]))[0].revision).toBe(1);
				expect(await peer.query<unknown[]>('SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?', [input.device.id])).toEqual(slots);
				expect(await peer.query<unknown[]>('SELECT * FROM devices_module_channels_properties WHERE id IN (' + propertyIds.map(() => '?').join(',') + ') ORDER BY id', propertyIds)).toEqual(properties);
				release();
				const result = await pending;
				expect(result.device.id).toBe(input.device.id); // ACKed A result, not hydration of peer B.
				expect(changes[0]).toEqual([{ changes: 0 }]);
				expect(fixture.submittedPoints).toEqual(submitted); // Prior submitted effects are retained, never cancelled.
				expect(valueEvents).toBe(priorValueEvents);
				expect(configEvents).toBe(0);
				for (const row of input.configuration.settings) {
					const property = await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: row.propertyId });
					expect(await fixture.values.readLatest(property)).toBeNull(); // No later setting cache/trend/freshness becomes visible.
				}
			} finally {
				// Revoke before releasing a failed test's hold or awaiting any teardown work.
				const closing = owner?.close(); owner = undefined;
				if (closing) void closing.catch(() => undefined);
				release();
				try { if (pending) await pending.catch(() => undefined); }
				finally {
					try { if (closing) await closing; }
					finally {
						try { if (peer?.isInitialized) await peer.destroy(); }
						finally {
							try { if (database.isInitialized) await database.destroy(); }
							finally { await rm(directory, { recursive: true, force: true }); }
						}
					}
				}
			}
		});


		it('publishes the complete required chain with the real additional Nest index-maintenance and projection listeners selected', async () => {
			await fixture.close(); owner = undefined;
			owner = await originalOwnedFixture(true); fixture = owner;
			const input = request(relayId);
			const configEvents: string[] = [];
			events.on(THERMOSTAT_CONFIG_CHANGED, (id: string) => configEvents.push(id));
			const result = await fixture.authoring.create(input);
			await Promise.all(fixture.indexJobs);
			expect(fixture.module.get(VirtualIndexMaintenanceListener)).toBe(fixture.indexMaintenance);
			expect(fixture.module.get(VirtualProjectionListener)).toBe(fixture.projection);
			expect(result.device.id).toBe(input.device.id);
			expect(configEvents).toEqual([input.device.id]);
			expect(fixture.projectionEvents).toHaveBeenCalled();
			for (const setting of input.configuration.settings)
				expect(fixture.submittedPoints.flat().filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId)).toHaveLength(1);
			expect(fixture.index.findProducerMode(input.device.id)).toBe(VirtualDeviceMode.CLIMATE_CONTROLLER);
		});

		it('does not count a held real detached index rebuild as A completion or let its later B snapshot reopen A publication', async () => {
			await fixture.close(); owner = undefined;
			owner = await originalOwnedFixture(true); fixture = owner;
			const { rebuild } = fixture.index;
			const original: Readonly<{ call: (receiver: VirtualPropertyIndexService) => ReturnType<VirtualPropertyIndexService['rebuild']> }> = rebuild;
			let enter: () => void = () => {};
			let release: () => void = () => {};
			const entered = new Promise<void>((resolve) => { enter = resolve; });
			const held = new Promise<void>((resolve) => { release = resolve; });
			const order: string[] = [];
			let snapshotFinished = false;
			// Actual ORM rebuild retained; only its first await is held. Subsequent coalesced
			// passes execute the same original function without a fake index/ready answer.
			const rebuilding = jest.spyOn(fixture.index, 'rebuild').mockImplementationOnce(async () => {
				order.push('index-enter'); enter(); await held;
				const result = await original.call(fixture.index);
				snapshotFinished = true; order.push('index-original-snapshot'); return result;
			});
			const input = request(relayId);
			let payload: DeviceEntity | undefined;
			events.on(EventType.DEVICE_CREATED, (device: DeviceEntity) => { if (device.id === input.device.id) payload = device; });
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			try {
				await reachesCreationBarrier(pending, entered);
				const result = await pending;
				order.push('A-complete');
				expect(snapshotFinished).toBe(false);
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
				for (const setting of input.configuration.settings)
					expect(fixture.submittedPoints.flat().filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId)).toHaveLength(1);
				if (!payload) throw new Error('Immutable original A event required');
				const submittedA = fixture.submittedPoints.slice();
				// An independently persisted successor catalog fact. This is not A's result or
				// a required original-owned child; the rebuild may only read its current DB truth.
				await database.query('UPDATE devices_module_devices SET name = ? WHERE id = ?', ['B after A settlement', input.device.id]);
				release();
				await Promise.all(fixture.indexJobs); // The actual worker body, not emit's return.
				expect(snapshotFinished).toBe(true);
				expect(order.indexOf('A-complete')).toBeLessThan(order.indexOf('index-original-snapshot'));
				expect(result.device.name).toBe('Draft thermostat');
				expect((await database.manager.findOneByOrFail(DeviceEntity, { id: input.device.id })).name).toBe('B after A settlement');
				expect(fixture.index.findProducerMode(input.device.id)).toBe(VirtualDeviceMode.CLIMATE_CONTROLLER);
				expect(fixture.submittedPoints).toEqual(submittedA);
				await expect(fixture.info.handleDeviceCreated(payload)).rejects.toThrow('Original creation publication closed');
				expect(fixture.submittedPoints).toEqual(submittedA);
				expect(fixture.projectionEvents).toHaveBeenCalled();
			} finally {
				const closing = owner?.close(); owner = undefined;
				if (closing) void closing.catch(() => undefined);
				release();
				try { await pending.catch(() => undefined); if (closing) await closing; }
				finally { rebuilding.mockRestore(); }
			}
		});


		it('retains only closed A redelivery behavior after settlement and leaves ordinary same-value cache refresh usable', async () => {
			const input = request(relayId);
			let originalPayload: DeviceEntity | undefined;
			events.on(EventType.DEVICE_CREATED, (row: DeviceEntity) => { originalPayload = row; });
			await fixture.authoring.create(input);
			if (!originalPayload) throw new Error('Missing real original event payload');
			const submittedBefore = fixture.submittedPoints.length;
			// Negative redelivery only: this is NOT a second invocation used to manufacture completion.
			await expect(fixture.info.handleDeviceCreated(originalPayload)).rejects.toThrow('Original creation publication closed');
			expect(fixture.submittedPoints).toHaveLength(submittedBefore);
			const setting = input.configuration.settings.find((row) => row.setting === 'heating_setpoint');
			if (!setting) throw new Error('Missing real setpoint fixture');
			const property = await database.manager.findOneByOrFail(ChannelPropertyEntity, { id: setting.propertyId });
			await expect(fixture.values.write(property, 20)).resolves.toBe(false);
			expect(fixture.submittedPoints).toHaveLength(submittedBefore);
		});

		it('keeps preview and ordinary virtual-parent rejection free of slot adoption', async () => {
			const input = request(relayId);
			const before = await database.query('SELECT * FROM devices_module_climate_automation_slots');
			await fixture.authoring.preview(input);
			await expect(new VirtualDevicesService(fixture.properties, fixture.channels, fixture.devices,
				new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), fixture.graph), new DeviceValidationService(fixture.devices), fixture.graph, database)
				.assertDeviceIsVirtual(relayDeviceId)).rejects.toThrow();
			expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual(before);
		});


		it('refuses a genuinely missing persisted graph singleton rather than borrowing cached revision zero or ensuring it', async () => {
			const input = request(relayId);
			await database.manager.delete(VirtualGraphRevisionEntity, { id: 1 });
			await expect(fixture.authoring.create(input)).rejects.toThrow();
			expect(await database.manager.count(VirtualGraphRevisionEntity)).toBe(0);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
			expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual([]);
			expect(fixture.submittedPoints).toEqual([]);
		});

		it('refuses a duplicate catalog identity without adopting or rewriting existing controller or slot facts', async () => {
			const input = request(relayId);
			await fixture.authoring.create(input);
			const devicesBefore = await database.query('SELECT * FROM devices_module_devices ORDER BY id');
			const slotsBefore = await database.query('SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId');
			await expect(fixture.authoring.create(input)).rejects.toThrow();
			expect(await database.query('SELECT * FROM devices_module_devices ORDER BY id')).toEqual(devicesBefore);
			expect(await database.query('SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId')).toEqual(slotsBefore);
		});


		it('preserves complete retained recovery membership and historical actor text without adopting it into the new slot', async () => {
			const input = request(relayId);
			const historical = Object.assign(new VirtualThermostatRecoveryEntity(), {
				id: uuid(), controllerId: input.device.id, claimId: uuid(), physicalIdentity: 'historical:physical',
				previousPropertyIdentity: 'historical-property-text', restoredPropertyId: uuid(), actorId: 'operator-text',
				reason: 'retained intent, not machine release proof', disconnectionAcknowledged: true,
				configurationRevision: Number.MAX_SAFE_INTEGER, claimRevision: Number.MAX_SAFE_INTEGER,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
			});
			await database.manager.insert(VirtualThermostatRecoveryEntity, historical);
			const before = await database.query('SELECT * FROM devices_virtual_thermostat_recoveries ORDER BY id');
			const result = await fixture.authoring.create(input);
			expect(result.device.id).toBe(input.device.id);
			expect(await database.query('SELECT * FROM devices_virtual_thermostat_recoveries ORDER BY id')).toEqual(before);
			expect(await database.query('SELECT state, manualHold, ownerId, baselineId FROM devices_module_climate_automation_slots WHERE controllerId = ?', [input.device.id])).toEqual([
				{ state: 'EMPTY', manualHold: 0, ownerId: null, baselineId: null },
			]);
			expect(JSON.stringify(result)).not.toContain(historical.actorId);
			expect(JSON.stringify(result)).not.toContain(historical.reason);
		});

		it('rolls back otherwise-correct real catalog creation when an unplanned runtime row appears in its actual manager', async () => {
			const input = request(relayId);
			let inserted = false;
			database.subscribers.push({ afterQuery: async (event) => {
				if (!inserted && /^INSERT INTO "devices_virtual_thermostat_configs"/i.test(event.query)) {
					inserted = true;
					await event.queryRunner.manager.insert(VirtualThermostatRuntimeEntity, {
						controllerId: input.device.id, decisionRevision: 0, configurationRevision: 1,
						floorLatched: false, heuristicHold: null, previousDemand: 'off', reasons: [],
						evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
					});
				}
			} });
			await expect(fixture.authoring.create(input)).rejects.toThrow();
			expect(inserted).toBe(true);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
			expect(await database.manager.count(VirtualThermostatRuntimeEntity)).toBe(0);
			expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual([]);
			expect(fixture.submittedPoints).toEqual([]);
		});

		it('retains queued input A while caller mutates its request and original graph is held', async () => {
			const input = request(relayId);
			const originalId = input.device.id;
			let release: () => void = () => {};
			let entered: () => void = () => {};
			const held = new Promise<void>((resolve) => { release = resolve; });
			const ready = new Promise<void>((resolve) => { entered = resolve; });
			const owner = fixture.lock.runExclusive(async () => { entered(); await held; });
			await ready;
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			input.device.name = 'caller B after admission';
			input.device.id = uuid();
			release(); await owner;
			const result = await pending;
			expect(result.device.id).toBe(originalId);
			expect(result.device.name).toBe('Draft thermostat');
			expect(await database.manager.findOne(DeviceEntity, { where: { id: input.device.id } })).toBeNull();
		});

		it('closes original publication at raw unclassified mutation before any later A information backend effect', async () => {
			const input = request(relayId);
			let mutate: Promise<unknown> | undefined;
			events.prependListener(EventType.DEVICE_CREATED, () => {
				mutate = database.query('/* independent raw mutation */ UPDATE devices_module_devices SET name = ? WHERE id = ?', ['successor', input.device.id]);
			});
			const result = await fixture.authoring.create(input);
			if (mutate) await mutate;
			expect(result.device.name).toBe('Draft thermostat');
			expect(fixture.submittedPoints).toEqual([]);
			expect((await database.manager.findOneOrFail(DeviceEntity, { where: { id: input.device.id } })).name).toBe('successor');
		});


		it('retains a caught first-getter recursive root failure before structural entry and authority reads', async () => {
			const input = request(relayId);
			const transactions: string[] = [];
			database.subscribers.push({ beforeQuery: (event) => { if (/^BEGIN|WHERE 0/i.test(event.query)) transactions.push(event.query); } });
			let child: Promise<unknown> | undefined;
			let traversed = 0;
			const rootRequest = { kind: 'create-virtual-thermostat:v1', get device() {
				traversed++;
				child = fixture.writer.createVirtualThermostatV1({ kind: 'create-virtual-thermostat:v1', device: input.device, configuration: input.configuration });
				void child.catch(() => undefined);
				return input.device;
			}, configuration: input.configuration } satisfies import('../../../modules/devices/contracts/climate-automation.contract').ClimateAutomationCreationRequest;
			await expect(fixture.writer.createVirtualThermostatV1(rootRequest)).rejects.toBeInstanceOf(Error);
			if (child) await expect(child).rejects.toBeInstanceOf(Error);
			expect(traversed).toBe(1);
			expect(transactions).toEqual([]);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
		});

		it('refuses at the actual native COMMIT seam after original provider disposal and rolls back every new catalog and private row', async () => {
			const input = request(relayId);
			const beforeGraph = await fixture.graph.revision();
			const runner = database.createQueryRunner();
			const native: unknown = await runner.connect();
			if (!creationNative(native)) throw new Error('Missing actual own SQLite connection');
			const all = jest.spyOn(native, 'all');
			database.subscribers.push({ beforeQuery: (event) => {
				if (event.query === 'COMMIT') fixture.automation.onModuleDestroy();
			} });
			try {
				await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'refused' });
				expect(all.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
				expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
				expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
				expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual([]);
				expect(await fixture.graph.revision()).toBe(beforeGraph);
				expect(fixture.submittedPoints).toEqual([]);
			} finally { all.mockRestore(); await runner.release(); }
		});

		it('does not publish after submitted native UNKNOWN even when the actual driver committed the new rows', async () => {
			const input = request(relayId);
			const runner = database.createQueryRunner();
			const native: unknown = await runner.connect();
			if (!creationNative(native)) throw new Error('Missing actual own SQLite connection');
			const original: Readonly<{ call: (receiver: CreationNativeConnection, ...args: Parameters<CreationNativeConnection['all']>) => unknown }> = native.all;
			let lost = false;
			const all = jest.spyOn(native, 'all').mockImplementation(function (this: CreationNativeConnection, query, parameters, callback) {
				return original.call(this, query, parameters, function (this: unknown, error, rows) {
					if (query === 'COMMIT' && !error && !lost) { lost = true; callback.call(this, new Error('TEST lost original ACK'), rows); }
					else callback.call(this, error, rows);
				});
			});
			try {
				await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'unknown' });
				expect(lost).toBe(true);
				expect(fixture.submittedPoints).toEqual([]);
				expect(publications).toEqual([]);
			} finally { all.mockRestore(); await runner.release(); }
		});

		it('keeps original acknowledged subscriber P primary while draining eligible fixed A jobs only after release', async () => {
			const input = request(relayId);
			const primary = new Error('TEST original committed P');
			let first = true;
			database.subscribers.push({ afterTransactionCommit: () => {
				if (first) { first = false; return Promise.reject(primary); }
				return Promise.resolve();
			} });
			const releaseAtEvent: boolean[] = [];
			events.on(EventType.DEVICE_CREATED, () => releaseAtEvent.push(fixture.lock.hasCurrentStructuralLease()));
			await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'committed', cause: primary });
			expect(releaseAtEvent).toEqual([false]);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		});

		it('does not submit the original primary or emit a value event after actual fallback completion under replaced role ownership', async () => {
			const input = request(relayId);
			let enter: () => void = () => {};
			let release: () => void = () => {};
			const entered = new Promise<void>((resolve) => { enter = resolve; });
			const held = new Promise<void>((resolve) => { release = resolve; });
			let submitted = 0, completed = 0;
			const fallback: StoragePlugin = { ...fixture.transport, name: 'creation-test-fallback', writePoints: async () => {
				submitted++; enter(); await held; completed++;
			} };
			fixture.storage.registerPlugin(fallback.name, fallback);
			const valueEvents: string[] = [];
			events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (row: ChannelPropertyEntity) => { valueEvents.push(row.id); });
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			await reachesCreationBarrier(pending, entered);
			fixture.storage.registerPlugin(fixture.transport.name, fixture.transport);
			release();
			const result = await pending;
			expect(result.device.id).toBe(input.device.id);
			expect(submitted).toBe(1);
			expect(completed).toBe(1); // Already-submitted IO really finished; no cancellation/rollback claim.
			expect(fixture.submittedPoints).toEqual([]);
			expect(valueEvents).toEqual([]);
			expect(fixture.producers.readCreationObservationCounts()).toEqual({ active: 0, observedIds: 0 });
			expect(fixture.storage.areCreationDestinationsCurrent(fixture.storage.captureCreationDestinations())).toBe(true);
		});

		it('does not rescue held real source validation with same-object mapping re-registration', async () => {
			const input = request(relayId);
			let enter: () => void = () => {};
			let release: () => void = () => {};
			const entered = new Promise<void>((resolve) => { enter = resolve; });
			const held = new Promise<void>((resolve) => { release = resolve; });
			let selected = false;
			database.subscribers.push({ beforeQuery: async (event) => {
				if (!selected && /^SELECT/i.test(event.query) && event.parameters?.includes(ambientId)) {
					selected = true; enter(); await held;
				}
			} });
			const original = fixture.deviceMapper.captureMapping('virtual');
			if (!original) throw new Error('Original native mapper missing');
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			await reachesCreationBarrier(pending, entered);
			fixture.deviceMapper.registerMapping(original.mapping);
			release();
			await expect(pending).rejects.toThrow();
			expect(original.isCurrent()).toBe(false);
			expect(fixture.deviceMapper.captureMapping('virtual')?.isCurrent()).toBe(true);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
			expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual([]);
			expect(fixture.submittedPoints).toEqual([]);
		});

		it('keeps actual graph validation COMMITTED rejection as failure and never starts required creation publication', async () => {
			const input = request(relayId);
			fixture.graph.observeGuardedValidation(() => Promise.reject(new Error('TEST readonly graph failure')));
			await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'committed' });
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(fixture.submittedPoints).toEqual([]);
			expect(publications).toEqual([]);
		});

		it('does not submit A to a replacement storage registration after the real backend availability boundary', async () => {
			const input = request(relayId);
			let first = true;
			fixture.boundary.available = () => {
				if (first) { first = false; fixture.storage.registerPlugin(fixture.transport.name, fixture.transport); }
			};
			// A fresh provider captures this genuine method and role; the overwrite during its actual call closes it permanently.
			fixture.automation.onModuleDestroy();
			const provider = new VirtualThermostatAutomationService(fixture.writer, fixture.core, fixture.graph, new NestConfigService(), fixture.authoring);
			provider.onModuleInit();
			try {
				const result = await fixture.authoring.create(input);
				expect(result.device.id).toBe(input.device.id);
				expect(fixture.submittedPoints).toEqual([]);
			} finally { provider.onModuleDestroy(); }
		});
	});

});
