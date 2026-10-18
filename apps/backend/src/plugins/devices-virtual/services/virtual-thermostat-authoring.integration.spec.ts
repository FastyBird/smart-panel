import { instanceToPlain, plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstValueFrom, of } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';

import { SqliteDataSource, hasCurrentSqliteConnectionLease } from '../../../common/database/sqlite-data-source';
import { TransformResponseInterceptor } from '../../../modules/api/interceptors/transform-response.interceptor';
import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginsTypeMapperService } from '../../../modules/config/services/plugins-type-mapper.service';
import {
	ClimateAutomationWriteError,
	climateAutomationCanonical,
	climateAutomationJson,
} from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsControlsService } from '../../../modules/devices/services/channels.controls.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { CommandLatencyTraceCollectorService } from '../../../modules/devices/services/command-latency-trace-collector.service';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DeviceCreationContext } from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesControlsService } from '../../../modules/devices/services/devices.controls.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyCommandWindowService } from '../../../modules/devices/services/property-command-window.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyStateCoordinatorService } from '../../../modules/devices/services/property-state-coordinator.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ChannelEntitySubscriber } from '../../../modules/devices/subscribers/channel-entity.subscriber';
import { ChannelPropertyEntitySubscriber } from '../../../modules/devices/subscribers/channel-property-entity.subscriber';
import { DeviceEntitySubscriber } from '../../../modules/devices/subscribers/device-entity.subscriber';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { DeviceExistsConstraintValidator } from '../../../modules/devices/validators/device-exists-constraint.validator';
import { EnergyClaimRegistryService } from '../../../modules/energy/services/energy-claim.registry.service';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceZoneCategory } from '../../../modules/spaces/spaces.constants';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../../../modules/storage/models/config.model';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { StoragePoint } from '../../../modules/storage/storage.types';
import { ExtendedDiscriminatorService } from '../../../modules/swagger/services/extended-discriminator.service';
import { SwaggerModelsRegistryService } from '../../../modules/swagger/services/swagger-models-registry.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ZoneSpaceEntity } from '../../spaces-home-control/entities/zone-space.entity';
import { DevicesVirtualPlugin } from '../devices-virtual.plugin';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import { VirtualThermostatRuntimeEntity } from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatRecoveryEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualDeviceInformationListener } from '../listeners/virtual-device-information.listener';
import { VirtualIndexMaintenanceListener } from '../listeners/virtual-index-maintenance.listener';
import { VirtualProjectionListener } from '../listeners/virtual-projection.listener';
import { VirtualStatusListener } from '../listeners/virtual-status.listener';
import { VirtualCreatedThermostatResponseModel } from '../models/thermostat-authoring-response.model';
import {
	VirtualThermostatClaimModel,
	VirtualThermostatConfigurationModel,
	VirtualThermostatPolicyModel,
	VirtualThermostatSettingModel,
	VirtualThermostatSourceModel,
} from '../models/thermostat-response.model';
import { VirtualDevicePlatform } from '../platforms/virtual-device.platform';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';
import { SourceNotVirtualConstraintValidator } from '../validators/source-not-virtual-constraint.validator';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualEnergyClaimService } from './virtual-energy-claim.service';
import { VirtualProducerStateService } from './virtual-producer-state.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';
import { VirtualThermostatAuthoringService } from './virtual-thermostat-authoring.service';
import { VirtualThermostatAutomationService } from './virtual-thermostat-automation.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { VirtualValueSourceService } from './virtual-value-source.service';

interface CreationNativeConnection {
	all: (
		this: CreationNativeConnection,
		query: string,
		parameters: unknown[],
		callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
	) => unknown;
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
		{
			label: 'returns the persisted thermostat when post-commit event publication fails',
			failure: 'event publication',
		},
		{ label: 'returns fixed persisted A despite unavailable latest device hydration', failure: 'device hydration' },
	])('$label', async ({ failure }) => {
		const input = request(relayId);
		if (!owner) throw new Error('Original owning fixture unavailable');
		const failedWrite = jest.fn<Promise<void>, []>().mockRejectedValueOnce(new Error('value write failed'));
		if (failure === 'value write') owner.boundary.write = () => failedWrite();
		const failedRefresh =
			failure === 'claims refresh'
				? jest.spyOn(claims, 'refresh').mockRejectedValueOnce(new Error('refresh failed'))
				: undefined;
		let eventFailureReached = false;
		if (failure === 'event publication')
			jest.spyOn(events, 'emit').mockImplementation((event: string | symbol, ...args: unknown[]) => {
				if (event === THERMOSTAT_CONFIG_CHANGED) {
					eventFailureReached = true;
					throw new Error('publication failed');
				}
				return Boolean(EventEmitter2.prototype.emit.call(events, event, ...args));
			});
		const hydration =
			failure === 'device hydration'
				? jest.spyOn(devices, 'findOne').mockRejectedValueOnce(new Error('hydration failed'))
				: undefined;
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
		const settingId = input.configuration.settings.find((setting) => setting.setting === 'heating_enabled').propertyId;
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
	});

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
		const original: Readonly<{
			call: (
				receiver: VirtualThermostatConfigService,
				...args: Parameters<VirtualThermostatConfigService['persistCreated']>
			) => ReturnType<VirtualThermostatConfigService['persistCreated']>;
		}> = persistCreated;
		const oldError = new Error('injected post-persist failure');
		let persisted = false;
		jest.spyOn(configs, 'persistCreated').mockImplementationOnce(async (context, prepared) => {
			await original.call(configs, context, prepared);
			persisted = true;
			throw oldError;
		});
		owner.automation.onModuleDestroy();
		const faultProvider = new VirtualThermostatAutomationService(
			owner.writer,
			owner.core,
			owner.graph,
			new NestConfigService(),
			authoring,
		);
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
		const storageConfig = Object.assign(new StorageConfigModel(), {
			primaryStorage: 'creation-test-primary',
			fallbackStorage: 'creation-test-fallback',
		});
		const submittedPoints: StoragePoint[][] = [];
		const boundary: { available?: () => void; write?: () => Promise<void>; query?: (query: string) => Promise<void> } =
			{};
		const transport: StoragePlugin = {
			name: 'creation-test-primary',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => {
				boundary.available?.();
				return true;
			},
			writePoints: (points) => {
				submittedPoints.push(points);
				return boundary.write?.() ?? Promise.resolve();
			},
			query: <T>(query: string) => {
				const held = boundary.query?.(query);
				return held === undefined ? Promise.resolve<T[]>([]) : held.then((): T[] => []);
			},
			queryRaw: <T>() => Promise.reject<T>(new Error('Raw storage queries are outside this inert fixture')),
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		// The real StorageService consumes this configuration-only provider; it confers no creation authority.
		const storageModule = await Test.createTestingModule({
			providers: [StorageService, { provide: ConfigService, useValue: { getModuleConfig: () => storageConfig } }],
		}).compile();
		const storage = storageModule.get(StorageService);
		storage.registerPlugin(transport.name, transport);
		const valueLock = new PropertyValueLockService(database);
		const values = new PropertyValueService(storage, sourceRegistry, valueLock, producers, events);
		const state = new DeviceConnectionStateService(storage);
		const metadata = new PropertyMetadataService(database);
		const trace = new CommandLatencyTraceCollectorService();
		const properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertyMapper,
			values,
			sourceRegistry,
			lock,
			new PropertyStateCoordinatorService(),
			new PropertyCommandWindowService(),
			database,
			events,
			trace,
			metadata,
		);
		const channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			channelMapper,
			properties,
			new ChannelsControlsService(database.getRepository(ChannelControlEntity), database, events),
			lock,
			database,
			events,
		);
		const zones = new DeviceZonesService(
			database.getRepository(DeviceZoneEntity),
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			events,
		);
		const devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			deviceMapper,
			channels,
			properties,
			new DevicesControlsService(database.getRepository(DeviceControlEntity), database, events),
			zones,
			lock,
			database,
			events,
		);
		const validation = new DeviceValidationService(devices);
		const index = new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), graph);
		const virtual = new VirtualDevicesService(properties, channels, devices, index, validation, graph, database);
		const connectivity = new DeviceConnectivityService(devices, channels, properties, state, events);
		const status = new VirtualStatusListener(index, connectivity, state);
		const info = new VirtualDeviceInformationListener(channels, properties, status, events);
		const indexMaintenance = new VirtualIndexMaintenanceListener(
			index,
			status,
			devices,
			virtual,
			properties,
			lock,
			events,
			database,
			database.getRepository(DeviceEntity),
			graph,
		);
		const projection = new VirtualProjectionListener(index, events);
		// Preserve the original decorated handler while the real Nest loader discovers it.
		const projectionHandler: unknown = Object.getOwnPropertyDescriptor(
			VirtualProjectionListener.prototype,
			'handlePropertyValueStateChanged',
		)?.value;
		if (includeIndexAndProjection) {
			expect(typeof projectionHandler).toBe('function');
			expect(Object.getOwnPropertyDescriptor(projection, 'handlePropertyValueStateChanged')).toBeUndefined();
			expect(projection.handlePropertyValueStateChanged).toBe(projectionHandler);
		}
		const indexJobs: Promise<unknown>[] = [];
		if (includeIndexAndProjection) {
			// Observation only: retain the actual worker Promise discarded by the production
			// fire-and-forget dispatcher. No phase/map/readiness field or worker result is forged.
			const descriptor = Object.getOwnPropertyDescriptor(VirtualIndexMaintenanceListener.prototype, 'runRebuildLoop');
			const original: unknown = descriptor?.value;
			if (!descriptor || descriptor.get || descriptor.set || typeof original !== 'function')
				throw new Error('Actual index worker descriptor required');
			Object.defineProperty(indexMaintenance, 'runRebuildLoop', {
				...descriptor,
				value: function (this: VirtualIndexMaintenanceListener) {
					const returned: unknown = Reflect.apply(original, this, []);
					if (!(returned instanceof Promise)) throw new Error('Actual asynchronous index worker required');
					const work: Promise<unknown> = returned;
					indexJobs.push(work);
					void work.catch(() => undefined);
					return work;
				},
			});
		}
		const commandAdmission = new PropertyCommandAdmissionRegistryService();
		const claims = new VirtualThermostatClaimsService(database, lock, graph, commandAdmission, events);
		const configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values);
		const authoring = new VirtualThermostatAuthoringService(
			database,
			lock,
			graph,
			devices,
			validation,
			configs,
			writer,
			deviceMapper,
			channelMapper,
			propertyMapper,
			producers,
			storage,
			events,
		);
		const automation = new VirtualThermostatAutomationService(writer, core, graph, new NestConfigService(), authoring);
		const extraProviders: VirtualThermostatAutomationService[] = [];
		const producerState = new VirtualProducerStateService(database, producers, graph, events);
		const platformRegistry = new PlatformRegistryService();
		const module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
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
				{
					provide: VirtualDevicePlatform,
					useValue: new VirtualDevicePlatform(
						new DeviceCommandGraphService(metadata, values, state),
						platformRegistry,
						graph,
						configs,
					),
				},
				{ provide: PlatformRegistryService, useValue: platformRegistry },
				{ provide: VirtualDeviceInformationListener, useValue: info },
				{ provide: VirtualStatusListener, useValue: status },
				...(includeIndexAndProjection
					? [
							{ provide: VirtualIndexMaintenanceListener, useValue: indexMaintenance },
							{ provide: VirtualProjectionListener, useValue: projection },
						]
					: []),
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
			],
		})
			.overrideProvider(EventEmitter2)
			.useValue(events)
			.compile();
		useContainer(module, { fallbackOnErrors: true });
		new DeviceEntitySubscriber(state, database);
		new ChannelEntitySubscriber(database);
		new ChannelPropertyEntitySubscriber(values, state, database);
		const ownership = new VirtualThermostatOwnershipSubscriber(database, claims);
		await ownership.onApplicationBootstrap();
		try {
			await module.init();
		} catch (cause) {
			automation.onModuleDestroy();
			info.onModuleDestroy();
			producerState.onModuleDestroy();
			claims.onModuleDestroy();
			producers.onModuleDestroy();
			try {
				await module.close();
			} finally {
				await storageModule.close();
			}
			throw cause;
		}
		const projectionListenerCount = events.listenerCount(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED);
		if (includeIndexAndProjection) {
			expect(projection.handlePropertyValueStateChanged).toBe(projectionHandler);
			expect(projectionListenerCount).toBeGreaterThan(0);
		}
		// Nest dispatches through the instance method; observe only after genuine registration.
		const projectionEvents = includeIndexAndProjection
			? jest.spyOn(projection, 'handlePropertyValueStateChanged')
			: undefined;
		if (includeIndexAndProjection)
			expect(events.listenerCount(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED)).toBe(projectionListenerCount);
		return {
			module,
			writer,
			core,
			graph,
			producers,
			values,
			storage,
			transport,
			submittedPoints,
			boundary,
			info,
			status,
			state,
			devices,
			channels,
			properties,
			index,
			indexMaintenance,
			projection,
			projectionEvents,
			indexJobs,
			claims,
			commandAdmission,
			configs,
			authoring,
			automation,
			extraProviders,
			deviceMapper,
			channelMapper,
			propertyMapper,
			lock,
			close: async () => {
				// Close original authority synchronously before any await or restoration of test spies.
				for (const provider of extraProviders) provider.onModuleDestroy();
				automation.onModuleDestroy();
				info.onModuleDestroy();
				producerState.onModuleDestroy();
				claims.onModuleDestroy();
				await Promise.all(indexJobs);
				await module.close();
				await storageModule.close();
			},
		};
	}

	async function reachesCreationBarrier<T>(pending: Promise<T>, barrier: Promise<void>): Promise<void> {
		await Promise.race([
			barrier,
			pending.then(
				() => {
					throw new Error('Creation settled before its actual fixture barrier');
				},
				(cause: unknown) => {
					throw cause;
				},
			),
		]);
	}

	describe('original-owned actual plugin creation and native leaf publication', () => {
		let fixture: Awaited<ReturnType<typeof originalOwnedFixture>>;
		beforeEach(() => {
			if (!owner) throw new Error('Original owning fixture unavailable');
			fixture = owner;
		});

		it('uses both real validators, one retained prepare, actual catalog hooks and fixed A response after native release', async () => {
			const input = request(relayId);
			const exists = jest.spyOn(fixture.module.get(DeviceExistsConstraintValidator), 'validate');
			const containment = jest.spyOn(fixture.module.get(DeviceIsVirtualConstraintValidator), 'validate');
			const parentReads: boolean[] = [];
			database.subscribers.push({
				beforeQuery: (event) => {
					if (event.query.includes('"device"."type" AS "type"') && event.parameters?.includes(input.device.id))
						parentReads.push(
							event.queryRunner.manager.queryRunner === event.queryRunner &&
								event.queryRunner.isTransactionActive &&
								hasCurrentSqliteConnectionLease(database),
						);
				},
			});
			const prepare = jest.spyOn(fixture.configs, 'prepare');
			// Construct a fresh legitimate provider after the instrumented method is installed, rather than rescuing an old capture.
			fixture.automation.onModuleDestroy();
			const provider = new VirtualThermostatAutomationService(
				fixture.writer,
				fixture.core,
				fixture.graph,
				new NestConfigService(),
				fixture.authoring,
			);
			provider.onModuleInit();
			const before = await fixture.graph.revision();
			const forbiddenGlobalDeviceLookup = jest.spyOn(fixture.devices, 'findOne');

			const rowsAtPublish: number[] = [];
			const configurationEvents: string[] = [];
			events.on(THERMOSTAT_CONFIG_CHANGED, (id: string) => {
				configurationEvents.push(id);
			});
			events.on(EventType.DEVICE_CREATED, () => {
				rowsAtPublish.push(fixture.lock.hasCurrentStructuralLease() ? 1 : 0);
			});
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
					expect(
						fixture.submittedPoints
							.flat()
							.filter(
								(point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId,
							),
					).toHaveLength(1);
				expect(configurationEvents).toEqual([input.device.id]);
				expect(await fixture.state.readLatest(result.device)).toMatchObject({ online: false, status: 'unknown' });
				expect(await fixture.graph.revision()).toBe(before + 1);
				const slots = await database.query<unknown[]>(
					'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
					[input.device.id],
				);
				expect(slots).toHaveLength(1);
				expect(slots[0]).toMatchObject({ manualHold: 0, state: 'EMPTY' });
				const config = await database.manager.findOneOrFail(VirtualThermostatConfigEntity, {
					where: { controllerId: input.device.id },
				});
				expect(config.revision).toBe(1);
				expect(result.configuration).not.toHaveProperty('manualGeneration');
				expect(JSON.stringify(result)).not.toMatch(
					/manualGeneration|slotIncarnation|ownerToken|publicationLease|creationTurn/,
				);
			} finally {
				provider.onModuleDestroy();
			}
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
			const provider = new VirtualThermostatAutomationService(
				fixture.writer,
				fixture.core,
				fixture.graph,
				new NestConfigService(),
				fixture.authoring,
			);
			provider.onModuleInit();
			fixture.extraProviders.push(provider);
			let nativeAcknowledgments = 0;
			const commitsAtPublication: number[] = [];
			database.subscribers.push({
				afterQuery: (event) => {
					if (event.query === 'COMMIT' && event.success) nativeAcknowledgments++;
				},
			});
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
					const actualProperty = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, {
						id: property.id,
					});
					expect(actualProperty.type).toBe('virtual');
					expect(Object.hasOwn(actualProperty, 'type')).toBe(false);
				}
			}
			expect(fixture.submittedPoints.length).toBeGreaterThan(0);
			for (const setting of input.configuration.settings)
				expect(
					fixture.submittedPoints
						.flat()
						.filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId),
				).toHaveLength(1);
		});

		it.each([
			{ mutation: 'channel lineage', afterSubmission: false },
			{ mutation: 'channel type', afterSubmission: false },
			{ mutation: 'device name', afterSubmission: false },
			{ mutation: 'setting role', afterSubmission: false },
			{ mutation: 'setting deletion', afterSubmission: false },
			{ mutation: 'setting retarget', afterSubmission: false },
			{ mutation: 'extra setting binding', afterSubmission: false },
			{ mutation: 'full config same revision', afterSubmission: false },
			{ mutation: 'full config same revision', afterSubmission: true },
		])(
			'refuses a peer-committed $mutation before a native leaf (prior submission: $afterSubmission)',
			async ({ mutation, afterSubmission }) => {
				// Own file, actual independent native connections. Old cases retain their original memory DB.
				const directory = await mkdtemp(join(tmpdir(), 'thermostat-creation-peer-'));
				const filename = join(directory, 'creation.sqlite');
				let peer: SqliteDataSource | undefined;
				let pending: Promise<Awaited<ReturnType<VirtualThermostatAuthoringService['create']>>> | undefined;
				let release: () => void = () => {};
				try {
					await fixture.close();
					owner = undefined;
					await database.query('VACUUM INTO ?', [filename]);
					await database.destroy();
					database = await new SqliteDataSource({
						type: 'sqlite',
						database: filename,
						entities: [__dirname + '/../../../**/*.entity.ts'],
						synchronize: false,
						migrationsRun: false,
					}).initialize();
					owner = await originalOwnedFixture();
					fixture = owner;
					peer = await new SqliteDataSource({
						type: 'sqlite',
						database: filename,
						entities: [__dirname + '/../../../**/*.entity.ts'],
						synchronize: false,
						migrationsRun: false,
					}).initialize();
					expect(peer).not.toBe(database);
					expect(peer.driver).not.toBe(database.driver);
					const input = request(relayId);
					const information = input.device.channels?.find(
						(channel) => channel.category === ChannelCategory.DEVICE_INFORMATION,
					);
					const setting = input.configuration.settings.find((row) => row.setting === 'heating_setpoint');
					const unbound = information?.properties?.find(
						(property) => property.category === PropertyCategory.MANUFACTURER,
					);
					if (!information || !setting || !unbound) throw new Error('Real original leaf fixture required');
					const propertyIds =
						input.device.channels?.flatMap((channel) => channel.properties?.map((property) => property.id) ?? []) ?? [];
					let enter: () => void = () => {};
					const entered = new Promise<void>((resolve) => {
						enter = resolve;
					});
					const held = new Promise<void>((resolve) => {
						release = resolve;
					});
					let selected = false;
					const changes: unknown[] = [];
					let valueEvents = 0,
						configEvents = 0;
					events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => {
						valueEvents++;
					});
					events.on(THERMOSTAT_CONFIG_CHANGED, () => {
						configEvents++;
					});
					database.subscribers.push({
						beforeQuery: async (event) => {
							if (
								!selected &&
								event.query.startsWith('UPDATE "devices_module_channels_properties" SET "id" = "id"') &&
								(!afterSubmission || fixture.submittedPoints.length > 0)
							) {
								selected = true;
								enter();
								await held;
							}
						},
						afterQuery: (event) => {
							if (selected && event.query === 'SELECT changes() AS changes') {
								const raw: unknown = event.rawResults;
								changes.push(raw);
							}
						},
					});
					pending = fixture.authoring.create(input);
					void pending.catch(() => undefined);
					await reachesCreationBarrier(pending, entered);
					const submitted = fixture.submittedPoints.slice();
					const priorValueEvents = valueEvents;
					if (afterSubmission) expect(submitted.length).toBeGreaterThan(0);
					else expect(submitted).toEqual([]);
					const properties = await peer.query<unknown[]>(
						'SELECT * FROM devices_module_channels_properties WHERE id IN (' +
							propertyIds.map(() => '?').join(',') +
							') ORDER BY id',
						propertyIds,
					);
					const slots = await peer.query<unknown[]>(
						'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
						[input.device.id],
					);
					// Every mutation commits on B while A is suspended BEFORE its actual affected-one SQL.
					await peer.transaction(async (manager) => {
						if (mutation === 'channel lineage')
							await manager.query('UPDATE devices_module_channels SET deviceId = ? WHERE id = ?', [
								relayDeviceId,
								information.id,
							]);
						else if (mutation === 'channel type')
							await manager.query('UPDATE devices_module_channels SET type = ? WHERE id = ?', [
								'peer-channel',
								information.id,
							]);
						else if (mutation === 'device name') {
							expect(input.device.name).not.toBe('Peer committed controller name');
							await manager.query('UPDATE devices_module_devices SET name = ? WHERE id = ?', [
								'Peer committed controller name',
								input.device.id,
							]);
						} else if (mutation === 'setting role')
							await manager.query('UPDATE devices_virtual_thermostat_settings SET setting = ? WHERE propertyId = ?', [
								'peer-setting',
								setting.propertyId,
							]);
						else if (mutation === 'setting deletion')
							await manager.query('DELETE FROM devices_virtual_thermostat_settings WHERE propertyId = ?', [
								setting.propertyId,
							]);
						else if (mutation === 'setting retarget')
							await manager.query(
								'UPDATE devices_virtual_thermostat_settings SET propertyId = ? WHERE propertyId = ?',
								[unbound.id, setting.propertyId],
							);
						else if (mutation === 'extra setting binding')
							await manager.query(
								'INSERT INTO devices_virtual_thermostat_settings(propertyId, controllerId, setting, contractFingerprint) VALUES (?, ?, ?, ?)',
								[unbound.id, input.device.id, 'peer-extra', 'peer-fingerprint'],
							);
						else
							await manager.query(
								'UPDATE devices_virtual_thermostat_configs SET locked = 1 - locked WHERE controllerId = ?',
								[input.device.id],
							);
					});
					if (mutation === 'device name')
						expect(
							(
								await peer.query<{ name: string }[]>('SELECT name FROM devices_module_devices WHERE id = ?', [
									input.device.id,
								])
							)[0].name,
						).toBe('Peer committed controller name');
					expect(
						(
							await peer.query<{ revision: number }[]>(
								'SELECT revision FROM devices_virtual_thermostat_configs WHERE controllerId = ?',
								[input.device.id],
							)
						)[0].revision,
					).toBe(1);
					expect(
						await peer.query<unknown[]>(
							'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ?',
							[input.device.id],
						),
					).toEqual(slots);
					expect(
						await peer.query<unknown[]>(
							'SELECT * FROM devices_module_channels_properties WHERE id IN (' +
								propertyIds.map(() => '?').join(',') +
								') ORDER BY id',
							propertyIds,
						),
					).toEqual(properties);
					release();
					const result = await pending;
					expect(result.device.id).toBe(input.device.id); // ACKed A result, not hydration of peer B.
					if (mutation === 'device name') expect(result.device.name).toBe(input.device.name);
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
					const closing = owner?.close();
					owner = undefined;
					if (closing !== undefined) void closing.catch(() => undefined);
					release();
					try {
						if (pending !== undefined) await pending.catch(() => undefined);
					} finally {
						try {
							if (closing !== undefined) await closing;
						} finally {
							try {
								if (peer?.isInitialized) await peer.destroy();
							} finally {
								try {
									if (database.isInitialized) await database.destroy();
								} finally {
									await rm(directory, { recursive: true, force: true });
								}
							}
						}
					}
				}
			},
		);

		it('refuses claimed controller type replacement at the actual independent native ownership trigger without changing durable A or publishing again', async () => {
			// Native type exclusion is separate from the legal committed-name affected-one leaf case above.
			const directory = await mkdtemp(join(tmpdir(), 'thermostat-creation-type-trigger-'));
			const filename = join(directory, 'creation.sqlite');
			let peer: SqliteDataSource | undefined;
			try {
				await fixture.close();
				owner = undefined;
				await database.query('VACUUM INTO ?', [filename]);
				await database.destroy();
				database = await new SqliteDataSource({
					type: 'sqlite',
					database: filename,
					entities: [__dirname + '/../../../**/*.entity.ts'],
					synchronize: false,
					migrationsRun: false,
				}).initialize();
				owner = await originalOwnedFixture();
				fixture = owner;
				peer = await new SqliteDataSource({
					type: 'sqlite',
					database: filename,
					entities: [__dirname + '/../../../**/*.entity.ts'],
					synchronize: false,
					migrationsRun: false,
				}).initialize();
				expect(peer).not.toBe(database);
				expect(peer.driver).not.toBe(database.driver);
				let nativeAcknowledgments = 0,
					valueEvents = 0,
					configEvents = 0;
				database.subscribers.push({
					afterQuery: (event) => {
						if (event.query === 'COMMIT' && event.success) nativeAcknowledgments++;
					},
				});
				events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, () => {
					valueEvents++;
				});
				events.on(THERMOSTAT_CONFIG_CHANGED, () => {
					configEvents++;
				});
				const input = request(relayId);
				const created = await fixture.authoring.create(input);
				expect(created.device.id).toBe(input.device.id);
				expect(created.device.type).toBe('virtual');
				expect(created.configuration.revision).toBe(1);
				expect(nativeAcknowledgments).toBeGreaterThan(0);
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
				const readFacts = async () => {
					if (!peer) throw new Error('Actual independent peer required');
					return {
						controller: await peer.query<Record<string, unknown>[]>(
							'SELECT * FROM devices_module_devices WHERE id = ? ORDER BY id',
							[input.device.id],
						),
						configuration: await peer.query<Record<string, unknown>[]>(
							'SELECT * FROM devices_virtual_thermostat_configs WHERE controllerId = ? ORDER BY controllerId',
							[input.device.id],
						),
						claims: await peer.query<Record<string, unknown>[]>(
							'SELECT * FROM devices_virtual_thermostat_actuator_claims WHERE controllerId = ? ORDER BY id',
							[input.device.id],
						),
						slots: await peer.query<Record<string, unknown>[]>(
							'SELECT * FROM devices_module_climate_automation_slots WHERE controllerId = ? ORDER BY controllerId',
							[input.device.id],
						),
						properties: await peer.query<Record<string, unknown>[]>(
							'SELECT * FROM devices_module_channels_properties WHERE channelId IN (SELECT id FROM devices_module_channels WHERE deviceId = ?) ORDER BY id',
							[input.device.id],
						),
					};
				};
				const before = await readFacts();
				expect(before.controller).toHaveLength(1);
				expect(before.configuration).toHaveLength(1);
				expect(before.slots).toHaveLength(1);
				expect(before.properties.length).toBeGreaterThan(0);
				expect(before.claims.length).toBeGreaterThan(0);
				expect(before.claims.every((row) => row.controllerId === input.device.id)).toBe(true);
				expect(before.claims.some((row) => row.state !== 'released')).toBe(true);
				const submitted = fixture.submittedPoints.slice();
				const published = publications.slice();
				const priorValueEvents = valueEvents,
					priorConfigEvents = configEvents;
				let failure: unknown;
				try {
					await peer.transaction(async (manager) => {
						await manager.query('UPDATE devices_module_devices SET type = ? WHERE id = ?', [
							'peer-device',
							input.device.id,
						]);
					});
				} catch (cause) {
					failure = cause;
				}
				expect(failure).toBeInstanceOf(QueryFailedError);
				expect(failure).toHaveProperty(
					'message',
					'SQLITE_CONSTRAINT: Thermostat hardware identity is reserved; qualified release and repair required',
				);
				expect(await readFacts()).toEqual(before);
				expect(fixture.submittedPoints).toEqual(submitted);
				expect(publications).toEqual(published);
				expect(valueEvents).toBe(priorValueEvents);
				expect(configEvents).toBe(priorConfigEvents);
			} finally {
				// Close original authority synchronously before awaiting teardown of either real connection.
				const closing = owner?.close();
				owner = undefined;
				if (closing !== undefined) void closing.catch(() => undefined);
				try {
					if (closing !== undefined) await closing;
				} finally {
					try {
						if (peer?.isInitialized) await peer.destroy();
					} finally {
						try {
							if (database.isInitialized) await database.destroy();
						} finally {
							await rm(directory, { recursive: true, force: true });
						}
					}
				}
			}
		});

		it('publishes the complete required chain with the real additional Nest index-maintenance and projection listeners selected', async () => {
			await fixture.close();
			owner = undefined;
			owner = await originalOwnedFixture(true);
			fixture = owner;
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
				expect(
					fixture.submittedPoints
						.flat()
						.filter((point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId),
				).toHaveLength(1);
			expect(fixture.index.findProducerMode(input.device.id)).toBe(VirtualDeviceMode.CLIMATE_CONTROLLER);
		});

		it('completes normal publication when genuine cold status hydration settles during the first submitted write', async () => {
			await fixture.close();
			owner = undefined;
			owner = await originalOwnedFixture(true);
			fixture = owner;
			const input = request(relayId);
			const configEvents: string[] = [];
			events.on(THERMOSTAT_CONFIG_CHANGED, (id: string) => configEvents.push(id));
			const gate = () => {
				let release: () => void = () => {};
				const pending = new Promise<void>((resolve) => {
					release = resolve;
				});
				return { pending, release };
			};
			const writeEntered = gate();
			const writeHeld = gate();
			const coldEntered = gate();
			const coldHeld = gate();
			const rebuildHeld = gate();
			const snapshotFinished = gate();
			const order: string[] = [];
			let snapshotFailure: { cause: unknown } | undefined;
			let firstWrite = true;
			let firstColdQuery = true;
			fixture.boundary.write = () => {
				if (!firstWrite) return Promise.resolve();
				firstWrite = false;
				order.push('first-write-submitted');
				writeEntered.release();
				return writeHeld.pending;
			};
			fixture.boundary.query = (query) => {
				if (
					!firstColdQuery ||
					!query.includes('FROM device_status') ||
					!query.includes(`WHERE deviceId = '${input.device.id}'`)
				)
					return Promise.resolve();
				firstColdQuery = false;
				order.push('A-cold-status-query');
				coldEntered.release();
				return coldHeld.pending;
			};
			const { rebuild } = fixture.index;
			const original: Readonly<{
				call: (receiver: VirtualPropertyIndexService) => ReturnType<VirtualPropertyIndexService['rebuild']>;
			}> = rebuild;
			const rebuilding = jest.spyOn(fixture.index, 'rebuild').mockImplementationOnce(async () => {
				await rebuildHeld.pending;
				try {
					const result = await original.call(fixture.index);
					order.push('real-index-snapshot-settled');
					return result;
				} catch (cause) {
					snapshotFailure = { cause };
					throw cause;
				} finally {
					snapshotFinished.release();
				}
			});
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			try {
				await reachesCreationBarrier(pending, writeEntered.pending);
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
				rebuildHeld.release();
				await reachesCreationBarrier(
					pending,
					Promise.race([
						coldEntered.pending,
						snapshotFinished.pending.then(() => {
							if (snapshotFailure) throw snapshotFailure.cause;
							throw new Error('Real index snapshot completed without the required cold A status query');
						}),
					]),
				);
				order.push('release-cold-empty');
				coldHeld.release();
				// Completion of the real ORM snapshot includes its awaited afterLoad callbacks.
				// Do not await the rest of the worker while publication is held.
				await reachesCreationBarrier(pending, snapshotFinished.pending);
				if (snapshotFailure) throw snapshotFailure.cause;
				order.push('release-publication-write');
				writeHeld.release();
				const result = await pending;
				await Promise.all(fixture.indexJobs);
				expect(order).toEqual([
					'first-write-submitted',
					'A-cold-status-query',
					'release-cold-empty',
					'real-index-snapshot-settled',
					'release-publication-write',
				]);
				expect(result.device.id).toBe(input.device.id);
				expect(result.device.name).toBe('Draft thermostat');
				expect(configEvents).toEqual([input.device.id]);
				expect(fixture.projectionEvents).toHaveBeenCalled();
				for (const setting of input.configuration.settings)
					expect(
						fixture.submittedPoints
							.flat()
							.filter(
								(point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId,
							),
					).toHaveLength(1);
				expect(fixture.index.findProducerMode(input.device.id)).toBe(VirtualDeviceMode.CLIMATE_CONTROLLER);
			} finally {
				// close() synchronously revokes the original owners before its first await.
				const closing = owner?.close();
				owner = undefined;
				if (closing !== undefined) void closing.catch(() => undefined);
				rebuildHeld.release();
				coldHeld.release();
				writeHeld.release();
				try {
					await pending.catch(() => undefined);
					if (closing !== undefined) await closing;
				} finally {
					rebuilding.mockRestore();
				}
			}
		});

		it('does not count a held real detached index rebuild as A completion or let its later B snapshot reopen A publication', async () => {
			await fixture.close();
			owner = undefined;
			owner = await originalOwnedFixture(true);
			fixture = owner;
			const { rebuild } = fixture.index;
			const original: Readonly<{
				call: (receiver: VirtualPropertyIndexService) => ReturnType<VirtualPropertyIndexService['rebuild']>;
			}> = rebuild;
			let enter: () => void = () => {};
			let release: () => void = () => {};
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			const order: string[] = [];
			let snapshotFinished = false;
			// Actual ORM rebuild retained; only its first await is held. Subsequent coalesced
			// passes execute the same original function without a fake index/ready answer.
			const rebuilding = jest.spyOn(fixture.index, 'rebuild').mockImplementationOnce(async () => {
				order.push('index-enter');
				enter();
				await held;
				const result = await original.call(fixture.index);
				snapshotFinished = true;
				order.push('index-original-snapshot');
				return result;
			});
			const input = request(relayId);
			let payload: DeviceEntity | undefined;
			events.on(EventType.DEVICE_CREATED, (device: DeviceEntity) => {
				if (device.id === input.device.id) payload = device;
			});
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			try {
				await reachesCreationBarrier(pending, entered);
				const result = await pending;
				order.push('A-complete');
				expect(snapshotFinished).toBe(false);
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
				for (const setting of input.configuration.settings)
					expect(
						fixture.submittedPoints
							.flat()
							.filter(
								(point) => point.measurement === 'property_value' && point.tags?.propertyId === setting.propertyId,
							),
					).toHaveLength(1);
				if (!payload) throw new Error('Immutable original A event required');
				const submittedA = fixture.submittedPoints.slice();
				// An independently persisted successor catalog fact. This is not A's result or
				// a required original-owned child; the rebuild may only read its current DB truth.
				await database.query('UPDATE devices_module_devices SET name = ? WHERE id = ?', [
					'B after A settlement',
					input.device.id,
				]);
				release();
				await Promise.all(fixture.indexJobs); // The actual worker body, not emit's return.
				expect(snapshotFinished).toBe(true);
				expect(order.indexOf('A-complete')).toBeLessThan(order.indexOf('index-original-snapshot'));
				expect(result.device.name).toBe('Draft thermostat');
				expect((await database.manager.findOneByOrFail(DeviceEntity, { id: input.device.id })).name).toBe(
					'B after A settlement',
				);
				expect(fixture.index.findProducerMode(input.device.id)).toBe(VirtualDeviceMode.CLIMATE_CONTROLLER);
				expect(fixture.submittedPoints).toEqual(submittedA);
				await expect(fixture.info.handleDeviceCreated(payload)).rejects.toThrow('Original creation publication closed');
				expect(fixture.submittedPoints).toEqual(submittedA);
				expect(fixture.projectionEvents).toHaveBeenCalled();
			} finally {
				const closing = owner?.close();
				owner = undefined;
				if (closing !== undefined) void closing.catch(() => undefined);
				release();
				try {
					await pending.catch(() => undefined);
					if (closing !== undefined) await closing;
				} finally {
					rebuilding.mockRestore();
				}
			}
		});

		it('retains only closed A redelivery behavior after settlement and leaves ordinary same-value cache refresh usable', async () => {
			const input = request(relayId);
			let originalPayload: DeviceEntity | undefined;
			events.on(EventType.DEVICE_CREATED, (row: DeviceEntity) => {
				originalPayload = row;
			});
			await fixture.authoring.create(input);
			if (!originalPayload) throw new Error('Missing real original event payload');
			const submittedBefore = fixture.submittedPoints.length;
			// Negative redelivery only: this is NOT a second invocation used to manufacture completion.
			await expect(fixture.info.handleDeviceCreated(originalPayload)).rejects.toThrow(
				'Original creation publication closed',
			);
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
			await expect(
				new VirtualDevicesService(
					fixture.properties,
					fixture.channels,
					fixture.devices,
					new VirtualPropertyIndexService(database.getRepository(VirtualChannelPropertyEntity), fixture.graph),
					new DeviceValidationService(fixture.devices),
					fixture.graph,
					database,
				).assertDeviceIsVirtual(relayDeviceId),
			).rejects.toThrow();
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
			const slotsBefore = await database.query(
				'SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId',
			);
			await expect(fixture.authoring.create(input)).rejects.toThrow();
			expect(await database.query('SELECT * FROM devices_module_devices ORDER BY id')).toEqual(devicesBefore);
			expect(
				await database.query('SELECT * FROM devices_module_climate_automation_slots ORDER BY controllerId'),
			).toEqual(slotsBefore);
		});

		it('preserves complete retained recovery membership and historical actor text without adopting it into the new slot', async () => {
			const input = request(relayId);
			const historical = Object.assign(new VirtualThermostatRecoveryEntity(), {
				id: uuid(),
				controllerId: input.device.id,
				claimId: uuid(),
				physicalIdentity: 'historical:physical',
				previousPropertyIdentity: 'historical-property-text',
				restoredPropertyId: uuid(),
				actorId: 'operator-text',
				reason: 'retained intent, not machine release proof',
				disconnectionAcknowledged: true,
				configurationRevision: Number.MAX_SAFE_INTEGER,
				claimRevision: Number.MAX_SAFE_INTEGER,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
			});
			await database.manager.insert(VirtualThermostatRecoveryEntity, historical);
			const before = await database.query('SELECT * FROM devices_virtual_thermostat_recoveries ORDER BY id');
			const result = await fixture.authoring.create(input);
			expect(result.device.id).toBe(input.device.id);
			expect(await database.query('SELECT * FROM devices_virtual_thermostat_recoveries ORDER BY id')).toEqual(before);
			expect(
				await database.query(
					'SELECT state, manualHold, ownerId, baselineId FROM devices_module_climate_automation_slots WHERE controllerId = ?',
					[input.device.id],
				),
			).toEqual([{ state: 'EMPTY', manualHold: 0, ownerId: null, baselineId: null }]);
			expect(JSON.stringify(result)).not.toContain(historical.actorId);
			expect(JSON.stringify(result)).not.toContain(historical.reason);
		});

		it('rolls back otherwise-correct real catalog creation when an unplanned runtime row appears in its actual manager', async () => {
			const input = request(relayId);
			let inserted = false;
			database.subscribers.push({
				afterQuery: async (event) => {
					if (!inserted && /^INSERT INTO "devices_virtual_thermostat_configs"/i.test(event.query)) {
						inserted = true;
						await event.queryRunner.manager.insert(VirtualThermostatRuntimeEntity, {
							controllerId: input.device.id,
							decisionRevision: 0,
							configurationRevision: 1,
							floorLatched: false,
							heuristicHold: null,
							previousDemand: 'off',
							reasons: [],
							evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
						});
					}
				},
			});
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
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			const ready = new Promise<void>((resolve) => {
				entered = resolve;
			});
			const owner = fixture.lock.runExclusive(async () => {
				entered();
				await held;
			});
			await ready;
			const pending = fixture.authoring.create(input);
			void pending.catch(() => undefined);
			input.device.name = 'caller B after admission';
			input.device.id = uuid();
			release();
			await owner;
			const result = await pending;
			expect(result.device.id).toBe(originalId);
			expect(result.device.name).toBe('Draft thermostat');
			expect(await database.manager.findOne(DeviceEntity, { where: { id: input.device.id } })).toBeNull();
		});

		it('closes original publication at raw unclassified mutation before any later A information backend effect', async () => {
			const input = request(relayId);
			let mutate: Promise<unknown> | undefined;
			events.prependListener(EventType.DEVICE_CREATED, () => {
				mutate = database.query(
					'/* independent raw mutation */ UPDATE devices_module_devices SET name = ? WHERE id = ?',
					['successor', input.device.id],
				);
			});
			const result = await fixture.authoring.create(input);
			if (mutate !== undefined) await mutate;
			expect(result.device.name).toBe('Draft thermostat');
			expect(fixture.submittedPoints).toEqual([]);
			expect((await database.manager.findOneOrFail(DeviceEntity, { where: { id: input.device.id } })).name).toBe(
				'successor',
			);
		});

		it('retains a caught first-getter recursive root failure before structural entry and authority reads', async () => {
			const input = request(relayId);
			const transactions: string[] = [];
			database.subscribers.push({
				beforeQuery: (event) => {
					if (/^BEGIN|WHERE 0/i.test(event.query)) transactions.push(event.query);
				},
			});
			let child: Promise<unknown> | undefined;
			let traversed = 0;
			const rootRequest = {
				kind: 'create-virtual-thermostat:v1',
				get device() {
					traversed++;
					child = fixture.writer.createVirtualThermostatV1({
						kind: 'create-virtual-thermostat:v1',
						device: input.device,
						configuration: input.configuration,
					});
					void child.catch(() => undefined);
					return input.device;
				},
				configuration: input.configuration,
			} satisfies import('../../../modules/devices/contracts/climate-automation.contract').ClimateAutomationCreationRequest;
			await expect(fixture.writer.createVirtualThermostatV1(rootRequest)).rejects.toBeInstanceOf(Error);
			if (child !== undefined) await expect(child).rejects.toBeInstanceOf(Error);
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
			database.subscribers.push({
				beforeQuery: (event) => {
					if (event.query === 'COMMIT') fixture.automation.onModuleDestroy();
				},
			});
			try {
				await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'refused' });
				expect(all.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(0);
				expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
				expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
				expect(await database.query('SELECT * FROM devices_module_climate_automation_slots')).toEqual([]);
				expect(await fixture.graph.revision()).toBe(beforeGraph);
				expect(fixture.submittedPoints).toEqual([]);
			} finally {
				all.mockRestore();
				await runner.release();
			}
		});

		it('does not publish after submitted native UNKNOWN even when the actual driver committed the new rows', async () => {
			const input = request(relayId);
			const runner = database.createQueryRunner();
			const native: unknown = await runner.connect();
			if (!creationNative(native)) throw new Error('Missing actual own SQLite connection');
			const original: Readonly<{
				call: (receiver: CreationNativeConnection, ...args: Parameters<CreationNativeConnection['all']>) => unknown;
			}> = native.all;
			let lost = false;
			const all = jest.spyOn(native, 'all').mockImplementation(function (
				this: CreationNativeConnection,
				query,
				parameters,
				callback,
			) {
				return original.call(this, query, parameters, function (this: unknown, error, rows) {
					if (query === 'COMMIT' && !error && !lost) {
						lost = true;
						callback.call(this, new Error('TEST lost original ACK'), rows);
					} else callback.call(this, error, rows);
				});
			});
			try {
				await expect(fixture.authoring.create(input)).rejects.toMatchObject({ commitOutcome: 'unknown' });
				expect(lost).toBe(true);
				expect(fixture.submittedPoints).toEqual([]);
				expect(publications).toEqual([]);
			} finally {
				all.mockRestore();
				await runner.release();
			}
		});

		it('keeps original acknowledged subscriber P primary while draining eligible fixed A jobs only after release', async () => {
			const input = request(relayId);
			const primary = new Error('TEST original committed P');
			let first = true;
			database.subscribers.push({
				afterTransactionCommit: () => {
					if (first) {
						first = false;
						return Promise.reject(primary);
					}
					return Promise.resolve();
				},
			});
			const releaseAtEvent: boolean[] = [];
			events.on(EventType.DEVICE_CREATED, () => releaseAtEvent.push(fixture.lock.hasCurrentStructuralLease()));
			await expect(fixture.authoring.create(input)).rejects.toMatchObject({
				commitOutcome: 'committed',
				cause: primary,
			});
			expect(releaseAtEvent).toEqual([false]);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		});

		it('does not submit the original primary or emit a value event after actual fallback completion under replaced role ownership', async () => {
			const input = request(relayId);
			let enter: () => void = () => {};
			let release: () => void = () => {};
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			let submitted = 0,
				completed = 0;
			const fallback: StoragePlugin = {
				...fixture.transport,
				name: 'creation-test-fallback',
				writePoints: async () => {
					submitted++;
					enter();
					await held;
					completed++;
				},
			};
			fixture.storage.registerPlugin(fallback.name, fallback);
			const valueEvents: string[] = [];
			events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (row: ChannelPropertyEntity) => {
				valueEvents.push(row.id);
			});
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
			const entered = new Promise<void>((resolve) => {
				enter = resolve;
			});
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			let selected = false;
			database.subscribers.push({
				beforeQuery: async (event) => {
					if (!selected && /^SELECT/i.test(event.query) && event.parameters?.includes(ambientId)) {
						selected = true;
						enter();
						await held;
					}
				},
			});
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
				if (first) {
					first = false;
					fixture.storage.registerPlugin(fixture.transport.name, fixture.transport);
				}
			};
			// A fresh provider captures this genuine method and role; the overwrite during its actual call closes it permanently.
			fixture.automation.onModuleDestroy();
			const provider = new VirtualThermostatAutomationService(
				fixture.writer,
				fixture.core,
				fixture.graph,
				new NestConfigService(),
				fixture.authoring,
			);
			provider.onModuleInit();
			try {
				const result = await fixture.authoring.create(input);
				expect(result.device.id).toBe(input.device.id);
				expect(fixture.submittedPoints).toEqual([]);
			} finally {
				provider.onModuleDestroy();
			}
		});

		describe('closed creation DTO wire v1 snapshots', () => {
			it('owns actual decorated DTO optional exposures and round-trips the real source, setting and configuration aliases', () => {
				const input = request(relayId);
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				const restored = plainToInstance(CreateVirtualThermostatProducerDto, wire);
				expect(restored.configuration.schemaVersion).toBe(1);
				expect(restored.configuration.expectedRevision).toBe(0);
				expect(restored.configuration.requestedMode).toBe('off');
				expect(restored.configuration.sources[0].sourcePropertyId).toBe(ambientId);
				expect(restored.configuration.sources[0].maximumAgeSeconds).toBe(300);
				expect(restored.configuration.actuators[0].sourcePropertyId).toBe(relayId);
				expect(restored.configuration.actuators[0].leaseSeconds).toBe(30);
				expect(restored.configuration.settings.map((row) => row.propertyId)).toEqual(
					input.configuration.settings.map((row) => row.propertyId),
				);
				expect(fixture.authoring.snapshotCreationInput(restored.device, restored.configuration)).toEqual(wire);
				expect(fixture.authoring.snapshotCreationInput(wire.device, wire.configuration)).toEqual(wire);
				expect(Object.isFrozen(input.device)).toBe(false);
				expect(Object.isFrozen(wire.device)).toBe(true);
				expect(Object.isFrozen(wire.configuration)).toBe(true);
			});

			it('retains the full comfort definition schema and nested array order across actual DTO and wire forms', () => {
				const input = request(relayId);
				input.configuration.comfort = {
					heating_range: { minimum: 5, maximum: 25 },
					cooling_range: null,
					automation_enabled: false,
					presets: [
						{ preset: 'eco', setpoints: { heating_setpoint: 17, cooling_setpoint: null } },
						{ preset: 'comfort', setpoints: { heating_setpoint: 21, cooling_setpoint: null } },
					],
				};
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				const restored = plainToInstance(CreateVirtualThermostatProducerDto, wire);
				expect(restored.configuration.comfort).toEqual(input.configuration.comfort);
				expect(restored.configuration.comfort?.presets.map((row) => row.preset)).toEqual(['eco', 'comfort']);
			});

			it('maps complete cooling and member protection aliases without invoking business validation or qualification', () => {
				const input = request(relayId);
				input.configuration.actuators[0].protection = {
					schemaVersion: 1,
					kind: 'local_floor',
					sourcePropertyId: ambientId,
					maximumAgeSeconds: 30,
				};
				input.configuration.actuators[0].coolingProtection = {
					schemaVersion: 1,
					dewPointPropertyId: ambientId,
					surfacePropertyId: relayId,
					purpose: 'cooled_surface',
					maximumAgeSeconds: 15,
				};
				input.configuration.policy.cooling = {
					schemaVersion: 1,
					marginC: 2,
					recoveryHysteresisC: 1,
					absoluteMinimumC: null,
				};
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				const restored = plainToInstance(CreateVirtualThermostatProducerDto, wire);
				expect(restored.configuration.actuators[0].protection).toEqual(input.configuration.actuators[0].protection);
				expect(restored.configuration.actuators[0].coolingProtection).toEqual(
					input.configuration.actuators[0].coolingProtection,
				);
				expect(restored.configuration.policy.cooling).toEqual(input.configuration.policy.cooling);
			});

			it('preserves null, false, zero, empty arrays and the distinction from supported optional undefined', () => {
				const input = request(relayId);
				input.device.description = null;
				input.device.enabled = false;
				input.device.controls = [];
				input.device.zone_ids = [];
				input.device.identifier = undefined;
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				expect(wire.device).toMatchObject({ description: null, enabled: false, controls: [], zone_ids: [] });
				expect(wire.device).not.toHaveProperty('identifier');
				expect(wire.configuration).toMatchObject({
					expected_revision: 0,
					contact_opening_ms: 0,
					contact_closing_ms: 0,
				});
				Reflect.deleteProperty(input.device, 'identifier');
				expect(fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toEqual(wire);
			});

			it('reads nested caller getters once and owns their values without freezing caller objects', () => {
				const input = request(relayId);
				let reads = 0;
				Object.defineProperty(input.device, 'description', {
					enumerable: true,
					configurable: true,
					get: () => {
						reads++;
						return 'owned first description';
					},
				});
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				Object.defineProperty(input.device, 'description', { value: 'later', configurable: true });
				expect(reads).toBe(1);
				expect(wire.device).toHaveProperty('description', 'owned first description');
				expect(Object.isFrozen(input.device)).toBe(false);
			});

			it.each([
				['unknown undefined', (device: object) => Reflect.set(device, 'unknown', undefined)],
				['unknown defined', (device: object) => Reflect.set(device, 'unknown', 1)],
				['required undefined', (device: object) => Reflect.set(device, 'name', undefined)],
				['required absent', (device: object) => Reflect.deleteProperty(device, 'name')],
				['undefined array entry', (device: object) => Reflect.set(device, 'zone_ids', [undefined])],
				['sparse array', (device: object) => Reflect.set(device, 'zone_ids', new Array<unknown>(1))],
				[
					'extended array',
					(device: object) => {
						const entries: string[] = [];
						Reflect.set(entries, 'extra', 1);
						return Reflect.set(device, 'zone_ids', entries);
					},
				],
				['function', (device: object) => Reflect.set(device, 'description', () => 'not data')],
				['symbol', (device: object) => Reflect.set(device, 'description', Symbol('not data'))],
				['bigint', (device: object) => Reflect.set(device, 'description', BigInt(1))],
				['nonfinite', (device: object) => Reflect.set(device, 'description', Infinity)],
				['custom value', (device: object) => Reflect.set(device, 'description', new Date(0))],
				['cycle', (device: object) => Reflect.set(device, 'description', device)],
			] satisfies readonly (readonly [string, (device: object) => unknown])[])(
				'refuses %s without silently dropping caller data',
				(_name, mutate) => {
					const input = request(relayId);
					mutate(input.device);
					expect(() => fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toThrow();
				},
			);

			it('rejects ambiguous aliases even when one value is optional undefined', () => {
				const input = request(relayId);
				Reflect.set(input.configuration, 'schema_version', 1);
				expect(() => fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toThrow('Ambiguous');
				Reflect.deleteProperty(input.configuration, 'schema_version');
				input.configuration.displayFloorClaimId = undefined;
				Reflect.set(input.configuration, 'display_floor_claim', null);
				expect(() => fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toThrow('Ambiguous');
			});

			it('preserves semantic keys in opaque strict JSON for the real downstream validator rather than recursively renaming them', () => {
				const input = request(relayId);
				const property = input.device.channels?.[0].properties?.[0];
				if (!property) throw new Error('Original property missing');
				// Representation only: this is NOT a claim that object-valued format passes the existing DTO validator.
				Reflect.set(property, 'format', [{ revision: 2, sourcePropertyId: 'opaque', schema_version: 7 }]);
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				expect(JSON.stringify(wire.device)).toContain('"sourcePropertyId":"opaque"');
				expect(JSON.stringify(wire.device)).toContain('"revision":2');
				Reflect.set(property, 'format', [{ revision: undefined }]);
				expect(() => fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toThrow();
			});

			it('preserves a nested original getter error and does not traverse a fallback after failure', () => {
				const input = request(relayId);
				const failure = new Error('TEST original wire getter');
				let later = 0;
				Object.defineProperty(input.device, 'name', {
					configurable: true,
					get: () => {
						throw failure;
					},
				});
				Object.defineProperty(input.configuration, 'policy', {
					configurable: true,
					get: () => {
						later++;
						return {};
					},
				});
				expect(() => fixture.authoring.snapshotCreationInput(input.device, input.configuration)).toThrow(failure);
				expect(later).toBe(0);
			});

			it('retains nested snapshot getter reentry poison even if its child rejection is observed', async () => {
				const input = request(relayId);
				let child: Promise<unknown> | undefined;
				let reads = 0;
				const transactions = jest.spyOn(database, 'transaction');
				Object.defineProperty(input.device, 'description', {
					enumerable: true,
					configurable: true,
					get: () => {
						reads++;
						child = fixture.writer.createVirtualThermostatV1({
							kind: 'create-virtual-thermostat:v1',
							device: input.device,
							configuration: input.configuration,
						});
						void child.catch(() => undefined);
						return null;
					},
				});
				await expect(
					fixture.writer.createVirtualThermostatV1({
						kind: 'create-virtual-thermostat:v1',
						device: input.device,
						configuration: input.configuration,
					}),
				).rejects.toBeInstanceOf(Error);
				if (child !== undefined) await expect(child).rejects.toBeInstanceOf(Error);
				expect(reads).toBe(1);
				expect(transactions).not.toHaveBeenCalled();
				expect(fixture.submittedPoints).toEqual([]);
			});

			it('invokes the originally registered snapshot function with its original authoring receiver', async () => {
				fixture.automation.onModuleDestroy();
				const snapshot = jest.spyOn(fixture.authoring, 'snapshotCreationInput');
				const provider = new VirtualThermostatAutomationService(
					fixture.writer,
					fixture.core,
					fixture.graph,
					new NestConfigService(),
					fixture.authoring,
				);
				provider.onModuleInit();
				try {
					const input = request(relayId);
					Reflect.set(input.device, 'unknown', undefined);
					await expect(
						fixture.writer.createVirtualThermostatV1({
							kind: 'create-virtual-thermostat:v1',
							device: input.device,
							configuration: input.configuration,
						}),
					).rejects.toBeInstanceOf(Error);
					expect(snapshot).toHaveBeenCalledTimes(1);
					expect(snapshot.mock.contexts[0]).toBe(fixture.authoring);
					expect(snapshot.mock.calls[0]).toEqual([input.device, input.configuration]);
				} finally {
					provider.onModuleDestroy();
					snapshot.mockRestore();
				}
			});

			it('refuses replaced original snapshot methods before top-level caller getters instead of invoking a fresh receiver', async () => {
				const substituted = jest.spyOn(fixture.authoring, 'snapshotCreationInput');
				let reads = 0;
				try {
					await expect(
						fixture.writer.createVirtualThermostatV1({
							kind: 'create-virtual-thermostat:v1',
							get device() {
								reads++;
								return {};
							},
							get configuration() {
								reads++;
								return {};
							},
						}),
					).rejects.toBeInstanceOf(Error);
					expect(reads).toBe(0);
					expect(substituted).not.toHaveBeenCalled();
				} finally {
					substituted.mockRestore();
				}
			});

			it('reads each root DTO getter once before a nested representation refusal without entering a transaction', async () => {
				const input = request(relayId);
				Reflect.set(input.device, 'unknown', undefined);
				let deviceReads = 0;
				let configurationReads = 0;
				const transaction = jest.spyOn(database, 'transaction');
				await expect(
					fixture.writer.createVirtualThermostatV1({
						kind: 'create-virtual-thermostat:v1',
						get device() {
							deviceReads++;
							return input.device;
						},
						get configuration() {
							configurationReads++;
							return input.configuration;
						},
					}),
				).rejects.toBeInstanceOf(Error);
				expect(deviceReads).toBe(1);
				expect(configurationReads).toBe(1);
				expect(transaction).not.toHaveBeenCalled();
			});

			it('ignores mutable constructor and toJSON prototype hints and never invokes caller serialization', () => {
				const input = request(relayId);
				const invoked = jest.fn(() => {
					throw new Error('Caller serialization is forbidden');
				});
				Reflect.setPrototypeOf(input.device, {
					get constructor() {
						invoked();
						return null;
					},
					toJSON: invoked,
				});
				const wire = fixture.authoring.snapshotCreationInput(input.device, input.configuration);
				expect(wire.device).toHaveProperty('id', input.device.id);
				expect(invoked).not.toHaveBeenCalled();
			});

			it('preserves required nullable catalog and configuration facts in the real fixed response without optional undefined', async () => {
				const input = request(relayId);
				const result = await fixture.writer.createVirtualThermostatV1({
					kind: 'create-virtual-thermostat:v1',
					device: input.device,
					configuration: input.configuration,
				});
				expect(result).toMatchObject({
					outcome: 'applied',
					result: {
						device: {
							id: input.device.id,
							updated_at: null,
							room_id: null,
							channels: expect.arrayContaining(
								(input.device.channels ?? []).map((channel): unknown =>
									expect.objectContaining({
										id: channel.id,
										parent: null,
										properties: expect.arrayContaining(
											(channel.properties ?? []).map((property): unknown =>
												expect.objectContaining({ id: property.id, value: null, updated_at: null }),
											),
										),
									}),
								),
							),
						},
						configuration: {
							policy: { coolingSetpoint: null, floor: null },
							heuristic: null,
							sources: expect.arrayContaining([expect.objectContaining({ open_value: null, closed_value: null })]),
							actuators: expect.arrayContaining([
								expect.objectContaining({ qualification_generation: null, release_evidence: null }),
							]),
						},
					},
				});
				// unit is optional, non-column metadata: a retained catalog with no unit must not invent one.
				if (result.outcome !== 'applied') throw new Error('Expected original fixed creation response');
				const frame = result.result;
				if (!frame || typeof frame !== 'object') throw new Error('Missing original fixed response frame');
				const device: unknown = Reflect.get(frame, 'device');
				if (!device || typeof device !== 'object') throw new Error('Missing original fixed device');
				const channels: unknown = Reflect.get(device, 'channels');
				const arrays: Readonly<{ isArray: (value: unknown) => value is readonly unknown[] }> = Array;
				if (!arrays.isArray(channels)) throw new Error('Missing original fixed channels');
				let checkedProperties = 0;
				for (const channel of channels) {
					if (!channel || typeof channel !== 'object') throw new Error('Missing original fixed channel');
					const properties: unknown = Reflect.get(channel, 'properties');
					if (!arrays.isArray(properties)) throw new Error('Missing original fixed properties');
					for (const property of properties) {
						if (!property || typeof property !== 'object') throw new Error('Missing original fixed property');
						expect(Object.hasOwn(property, 'unit')).toBe(false);
						checkedProperties++;
					}
				}
				expect(checkedProperties).toBe(
					(input.device.channels ?? []).reduce((total, channel) => total + (channel.properties?.length ?? 0), 0),
				);
			});

			it.each([undefined, { revision: undefined }, [undefined], NaN, Infinity])(
				'keeps noncreation private JSON strict for invalid value %#',
				(value) => {
					expect(() => climateAutomationCanonical(value)).toThrow();
					expect(() => climateAutomationJson(value)).toThrow();
				},
			);

			it('refuses CLI, foreign SQLite lease and active structural callers before inspecting DTO input', async () => {
				let reads = 0;
				const input = {
					kind: 'create-virtual-thermostat:v1',
					get device() {
						reads++;
						throw new Error('Unexpected getter');
					},
					get configuration() {
						reads++;
						throw new Error('Unexpected getter');
					},
				} satisfies import('../../../modules/devices/contracts/climate-automation.contract').ClimateAutomationCreationRequest;
				const lock = new DeviceStructureLockService();
				const cli = new ClimateAutomationWriterService(
					database,
					lock,
					fixture.core,
					new NestConfigService({ FB_CLI: 'on' }),
				);
				await expect(cli.createVirtualThermostatV1(input)).rejects.toBeInstanceOf(Error);
				await database.transaction(async () => {
					await expect(fixture.writer.createVirtualThermostatV1(input)).rejects.toBeInstanceOf(Error);
				});
				const structural = new ClimateAutomationWriterService(database, lock, fixture.core);
				await lock.runExclusive(async () => {
					await expect(structural.createVirtualThermostatV1(input)).rejects.toBeInstanceOf(Error);
				});
				expect(reads).toBe(0);
			});
		});

		describe('original native STI lineage and public virtual identity', () => {
			it('retains authentic native labels independently of all three real public getters through actual creation', async () => {
				const originals = new Map<object, unknown>();
				for (const type of [VirtualDeviceEntity, VirtualChannelEntity, VirtualChannelPropertyEntity]) {
					const native = database.getMetadata(type).discriminatorValue;
					expect(typeof native).toBe('string');
					expect(native).not.toBe('virtual');
					originals.set(type, native);
				}
				const input = request(relayId);
				const result = await fixture.authoring.create(input);
				expect(result.device.id).toBe(input.device.id);
				const assertOriginal = async (
					entity: DeviceEntity | ChannelEntity | ChannelPropertyEntity,
					type: typeof VirtualDeviceEntity | typeof VirtualChannelEntity | typeof VirtualChannelPropertyEntity,
				): Promise<void> => {
					const metadata = database.getMetadata(type);
					const discriminator = metadata.discriminatorColumn;
					if (!discriminator) throw new Error('Original native discriminator missing');
					expect(metadata.target).toBe(type);
					expect(Reflect.getPrototypeOf(entity)).toBe(type.prototype);
					expect(entity).toBeInstanceOf(type);
					expect(entity.type).toBe('virtual');
					expect(Object.hasOwn(entity, 'type')).toBe(false);
					const descriptor = Object.getOwnPropertyDescriptor(type.prototype, 'type');
					expect(descriptor?.get).toEqual(expect.any(Function));
					expect(descriptor?.set).toBeUndefined();
					const table = database.driver.escape(metadata.tableName);
					const column = database.driver.escape(discriminator.databaseName);
					const rows = await database.manager.query<{ nativeType: unknown }[]>(
						`SELECT ${column} AS nativeType FROM ${table} WHERE id = ?`,
						[entity.id],
					);
					expect(rows).toHaveLength(1);
					expect(rows[0].nativeType).toBe(originals.get(type));
					expect(metadata.discriminatorValue).toBe(originals.get(type));
					expect(rows[0].nativeType).not.toBe(entity.type);
				};
				await assertOriginal(
					await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: input.device.id }),
					VirtualDeviceEntity,
				);
				for (const channel of input.device.channels ?? []) {
					await assertOriginal(
						await database.manager.findOneByOrFail(VirtualChannelEntity, { id: channel.id }),
						VirtualChannelEntity,
					);
					for (const property of channel.properties ?? [])
						await assertOriginal(
							await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: property.id }),
							VirtualChannelPropertyEntity,
						);
				}
			});

			it.each([VirtualDeviceEntity, VirtualChannelEntity, VirtualChannelPropertyEntity])(
				'refuses original public getter replacement for %p before request inspection without invoking the substitute',
				async (type) => {
					const input = request(relayId);
					const replacement = jest.spyOn(type.prototype, 'type', 'get').mockReturnValue('foreign-public-type');
					let inspected = 0;
					const transactions = jest.spyOn(database, 'transaction');
					try {
						await expect(
							fixture.writer.createVirtualThermostatV1({
								kind: 'create-virtual-thermostat:v1',
								get device() {
									inspected++;
									return input.device;
								},
								get configuration() {
									inspected++;
									return input.configuration;
								},
							}),
						).rejects.toBeInstanceOf(Error);
						expect(inspected).toBe(0);
						expect(replacement).not.toHaveBeenCalled();
						expect(transactions).not.toHaveBeenCalled();
						expect(fixture.submittedPoints).toEqual([]);
					} finally {
						replacement.mockRestore();
					}
				},
			);

			it('refuses a newly registered public virtual mapping with the wrong actual child class before input or catalog work', async () => {
				const original = fixture.deviceMapper.captureMapping('virtual');
				if (!original) throw new Error('Original registered device mapper missing');
				fixture.automation.onModuleDestroy();
				fixture.deviceMapper.registerMapping({ ...original.mapping, class: DeviceEntity });
				expect(original.isCurrent()).toBe(false);
				const provider = new VirtualThermostatAutomationService(
					fixture.writer,
					fixture.core,
					fixture.graph,
					new NestConfigService(),
					fixture.authoring,
				);
				provider.onModuleInit();
				fixture.extraProviders.push(provider);
				const transactions = jest.spyOn(database, 'transaction');
				let inspected = 0;
				await expect(
					fixture.writer.createVirtualThermostatV1({
						kind: 'create-virtual-thermostat:v1',
						get device() {
							inspected++;
							return {};
						},
						get configuration() {
							inspected++;
							return {};
						},
					}),
				).rejects.toBeInstanceOf(Error);
				expect(inspected).toBe(0);
				expect(transactions).not.toHaveBeenCalled();
				expect(fixture.submittedPoints).toEqual([]);
			});
		});
		describe('original native catalog ownership facts', () => {
			it('captures exactly three frozen native roles from the original same-source metadata without catalog SQL', () => {
				const query = jest.spyOn(database, 'query');
				const environment = fixture.authoring.captureCreationEnvironment();
				try {
					expect(environment.source).toBe(database);
					expect(Object.keys(environment.nativeCatalog).sort()).toEqual(['channel', 'device', 'property']);
					expect(Object.isFrozen(environment.nativeCatalog)).toBe(true);
					const roles: readonly {
						role: 'device' | 'channel' | 'property';
						type: typeof VirtualDeviceEntity | typeof VirtualChannelEntity | typeof VirtualChannelPropertyEntity;
					}[] = [
						{ role: 'device', type: VirtualDeviceEntity },
						{ role: 'channel', type: VirtualChannelEntity },
						{ role: 'property', type: VirtualChannelPropertyEntity },
					];
					for (const { role, type } of roles) {
						const metadata = database.getMetadata(type);
						const column = metadata.discriminatorColumn;
						if (!column) throw new Error('Original native discriminator required');
						expect(environment.nativeCatalog[role]).toEqual({
							tableName: metadata.tableName,
							discriminatorColumn: column.databaseName,
							discriminatorValue: database.driver.preparePersistentValue(metadata.discriminatorValue, column),
						});
						expect(Object.isFrozen(environment.nativeCatalog[role])).toBe(true);
						expect(environment.nativeCatalog[role].discriminatorValue).not.toBe('virtual');
					}
					expect(query).not.toHaveBeenCalled();
				} finally {
					environment.close();
					query.mockRestore();
				}
			});

			const wrongNativeRows: readonly {
				role: 'device' | 'channel' | 'property';
				type: typeof VirtualDeviceEntity | typeof VirtualChannelEntity | typeof VirtualChannelPropertyEntity;
				wrong: string;
			}[] = [
				{ role: 'device', type: VirtualDeviceEntity, wrong: 'virtual' },
				{ role: 'channel', type: VirtualChannelEntity, wrong: 'virtual' },
				{ role: 'property', type: VirtualChannelPropertyEntity, wrong: 'virtual' },
				{ role: 'device', type: VirtualDeviceEntity, wrong: 'foreign-native-label' },
				{ role: 'channel', type: VirtualChannelEntity, wrong: 'foreign-native-label' },
				{ role: 'property', type: VirtualChannelPropertyEntity, wrong: 'foreign-native-label' },
			];
			it.each(wrongNativeRows)(
				'refuses planned $role native label $wrong before apply or native ACK',
				async ({ type, wrong }) => {
					fixture.automation.onModuleDestroy();
					const originalMethods: Readonly<{ prepareCreation: VirtualThermostatAuthoringService['prepareCreation'] }> =
						fixture.authoring;
					const { prepareCreation } = originalMethods;
					const originalCall: Readonly<{
						call: (
							receiver: VirtualThermostatAuthoringService,
							...args: Parameters<VirtualThermostatAuthoringService['prepareCreation']>
						) => ReturnType<VirtualThermostatAuthoringService['prepareCreation']>;
					}> = prepareCreation;
					const table = database.getMetadata(type).tableName;
					let changedRows = 0;
					const prepare = jest.spyOn(fixture.authoring, 'prepareCreation').mockImplementation(async (...args) => {
						const plan = await originalCall.call(fixture.authoring, ...args);
						const inserts = plan.inserts.map((item) => {
							if (item.table !== table) return item;
							changedRows++;
							return Object.freeze({ table: item.table, row: Object.freeze({ ...item.row, type: wrong }) });
						});
						return Object.freeze({ ...plan, inserts: Object.freeze(inserts) });
					});
					const apply = jest.spyOn(fixture.authoring, 'applyCreation');
					const provider = new VirtualThermostatAutomationService(
						fixture.writer,
						fixture.core,
						fixture.graph,
						new NestConfigService(),
						fixture.authoring,
					);
					provider.onModuleInit();
					fixture.extraProviders.push(provider);
					let nativeAcknowledgments = 0;
					database.subscribers.push({
						afterQuery: (event) => {
							if (event.query === 'COMMIT' && event.success) nativeAcknowledgments++;
						},
					});
					const input = request(relayId);
					await expect(
						fixture.writer.createVirtualThermostatV1({
							kind: 'create-virtual-thermostat:v1',
							device: input.device,
							configuration: input.configuration,
						}),
					).resolves.toEqual({ outcome: 'conflict', reason: 'invalid' });
					expect(prepare).toHaveBeenCalledTimes(1);
					expect(changedRows).toBeGreaterThan(0);
					expect(apply).not.toHaveBeenCalled();
					expect(nativeAcknowledgments).toBe(0);
					expect(fixture.submittedPoints).toEqual([]);
					expect(publications).toEqual([]);
					expect(await database.manager.findOneBy(DeviceEntity, { id: input.device.id })).toBeNull();
				},
			);

			it('does not adopt a metadata method replacement after the original native facts were captured before input', async () => {
				const input = request(relayId);
				const transactions = jest.spyOn(database, 'transaction');
				let replacementTargets = (): readonly unknown[] => [];
				let restore = (): void => undefined;
				try {
					await expect(
						fixture.writer.createVirtualThermostatV1({
							kind: 'create-virtual-thermostat:v1',
							get device() {
								const replacement = jest.spyOn(database, 'getMetadata');
								replacementTargets = () => replacement.mock.calls.map(([target]) => target);
								restore = () => {
									replacement.mockRestore();
								};
								return input.device;
							},
							configuration: input.configuration,
						}),
					).rejects.toBeInstanceOf(Error);
					// Original creation metadata is never borrowed; ordinary claims cleanup remains observable.
					const targets = replacementTargets();
					expect(targets).not.toContain(VirtualDeviceEntity);
					expect(targets).not.toContain(VirtualChannelEntity);
					expect(targets).not.toContain(VirtualChannelPropertyEntity);
					expect(targets.length).toBeGreaterThan(0);
					expect(targets.every((target) => target === VirtualThermostatActuatorClaimEntity)).toBe(true);
					expect(transactions).not.toHaveBeenCalled();
					expect(fixture.submittedPoints).toEqual([]);
				} finally {
					restore();
				}
			});

			it('cannot rescue original native facts with same-object mapper re-registration during input capture', async () => {
				const original = fixture.deviceMapper.captureMapping('virtual');
				if (!original) throw new Error('Original device mapping required');
				const input = request(relayId);
				const transactions = jest.spyOn(database, 'transaction');
				await expect(
					fixture.writer.createVirtualThermostatV1({
						kind: 'create-virtual-thermostat:v1',
						get device() {
							fixture.deviceMapper.registerMapping(original.mapping);
							return input.device;
						},
						configuration: input.configuration,
					}),
				).rejects.toBeInstanceOf(Error);
				expect(original.isCurrent()).toBe(false);
				expect(transactions).not.toHaveBeenCalled();
				expect(fixture.submittedPoints).toEqual([]);
			});
		});

		describe('original native parent to public validation identity', () => {
			it('proves the original native parent before exposing public virtual identity through both real validators and preserves raw storage after settlement', async () => {
				const input = request(relayId);
				const metadata = database.getMetadata(VirtualDeviceEntity);
				const column = metadata.discriminatorColumn;
				if (!column) throw new Error('Original device native discriminator required');
				const nativeLabel: unknown = database.driver.preparePersistentValue(metadata.discriminatorValue, column);
				expect(nativeLabel).not.toBe('virtual');
				const exists = jest.spyOn(fixture.module.get(DeviceExistsConstraintValidator), 'validate');
				const containment = jest.spyOn(fixture.module.get(DeviceIsVirtualConstraintValidator), 'validate');
				const originals: Readonly<{
					readOriginalDeviceIdentity: typeof DeviceCreationContext.readOriginalDeviceIdentity;
				}> = DeviceCreationContext;
				const { readOriginalDeviceIdentity } = originals;
				const originalCall: Readonly<{
					call: (
						receiver: typeof DeviceCreationContext,
						deviceId: string,
					) => ReturnType<typeof DeviceCreationContext.readOriginalDeviceIdentity>;
				}> = readOriginalDeviceIdentity;
				const observed: Readonly<{ id: string; type: string }>[] = [];
				const observerFailures: unknown[] = [];
				const originalQueryLeases: boolean[] = [];
				database.subscribers.push({
					beforeQuery: (event) => {
						if (event.query.includes('"device"."type" AS "type"') && event.parameters?.includes(input.device.id))
							originalQueryLeases.push(
								event.queryRunner.isTransactionActive && hasCurrentSqliteConnectionLease(database),
							);
					},
				});
				const read = jest.spyOn(DeviceCreationContext, 'readOriginalDeviceIdentity').mockImplementation((id) => {
					const promise = originalCall.call(DeviceCreationContext, id);
					if (promise !== undefined) {
						void promise
							.then(
								(identity) => {
									if (identity) observed.push(identity);
								},
								(error: unknown) => {
									observerFailures.push(error);
								},
							)
							.catch((error: unknown) => {
								observerFailures.push(error);
							});
					}
					return promise;
				});
				try {
					const result = await fixture.authoring.create(input);
					expect(result.device.id).toBe(input.device.id);
					expect(result.device.type).toBe('virtual');
					expect(Object.hasOwn(result.device, 'type')).toBe(false);
					expect(exists.mock.calls.filter(([id]) => id === input.device.id).length).toBeGreaterThanOrEqual(2);
					expect(containment.mock.calls.filter(([id]) => id === input.device.id).length).toBeGreaterThanOrEqual(2);
					expect(originalQueryLeases.length).toBeGreaterThanOrEqual(2);
					expect(originalQueryLeases.every(Boolean)).toBe(true);
					expect(observed.length).toBeGreaterThanOrEqual(2);
					expect(observed.every((identity) => identity.id === input.device.id && identity.type === 'virtual')).toBe(
						true,
					);
					expect(observerFailures).toEqual([]);
					const table = database.driver.escape(metadata.tableName);
					const discriminator = database.driver.escape(column.databaseName);
					const raw = await database.manager.query<{ id: string; nativeType: unknown }[]>(
						`SELECT id, ${discriminator} AS nativeType FROM ${table} WHERE id = ?`,
						[input.device.id],
					);
					expect(raw).toEqual([{ id: input.device.id, nativeType: nativeLabel }]);
					expect(DeviceCreationContext.readOriginalDeviceIdentity(input.device.id)).toBeUndefined();
				} finally {
					read.mockRestore();
				}
			});

			it('rejects wrong-root reentry at the actual parent query before a second query and retains caught operation poison', async () => {
				const input = request(relayId);
				const wrongRootId = uuid();
				let reachedParentQuery = false;
				let caught: unknown;
				let wrongRootQueries = 0;
				database.subscribers.push({
					beforeQuery: (event) => {
						if (event.parameters?.includes(wrongRootId)) wrongRootQueries++;
						if (
							!reachedParentQuery &&
							event.query.includes('"device"."type" AS "type"') &&
							event.parameters?.includes(input.device.id)
						) {
							reachedParentQuery = true;
							try {
								void DeviceCreationContext.readOriginalDeviceIdentity(wrongRootId);
							} catch (error) {
								caught = error;
							}
						}
					},
				});
				await expect(fixture.authoring.create(input)).rejects.toBeInstanceOf(Error);
				expect(reachedParentQuery).toBe(true);
				expect(caught).toBeInstanceOf(Error);
				expect(wrongRootQueries).toBe(0);
				expect(await database.manager.findOneBy(DeviceEntity, { id: input.device.id })).toBeNull();
				expect(fixture.submittedPoints).toEqual([]);
				expect(publications).toEqual([]);
			});
		});
		describe('original creation graph phase ordering', () => {
			it('validates the real NORMALIZE plan before its APPLY ticket and APPLY catalog with identical original arguments', async () => {
				fixture.automation.onModuleDestroy();
				const graphMethods: Readonly<{
					validateReservedReplacement: VirtualDependencyGraphService['validateReservedReplacement'];
					beginReservedValidation: VirtualDependencyGraphService['beginReservedValidation'];
				}> = fixture.graph;
				const { validateReservedReplacement, beginReservedValidation } = graphMethods;
				const planCall: Readonly<{
					call: (
						receiver: VirtualDependencyGraphService,
						...args: Parameters<VirtualDependencyGraphService['validateReservedReplacement']>
					) => ReturnType<VirtualDependencyGraphService['validateReservedReplacement']>;
				}> = validateReservedReplacement;
				const beginCall: Readonly<{
					call: (
						receiver: VirtualDependencyGraphService,
						...args: Parameters<VirtualDependencyGraphService['beginReservedValidation']>
					) => ReturnType<VirtualDependencyGraphService['beginReservedValidation']>;
				}> = beginReservedValidation;
				const authoringMethods: Readonly<{ applyCreation: VirtualThermostatAuthoringService['applyCreation'] }> =
					fixture.authoring;
				const { applyCreation } = authoringMethods;
				const applyCall: Readonly<{
					call: (
						receiver: VirtualThermostatAuthoringService,
						...args: Parameters<VirtualThermostatAuthoringService['applyCreation']>
					) => ReturnType<VirtualThermostatAuthoringService['applyCreation']>;
				}> = applyCreation;
				const trace: string[] = [];
				const observerFailures: unknown[] = [];
				const plan = jest.spyOn(fixture.graph, 'validateReservedReplacement').mockImplementation((...args) => {
					fixture.writer.assertParticipantTurn(args[0], args[1], ['NORMALIZE'], args[2]);
					trace.push('NORMALIZE:plan');
					const promise = planCall.call(fixture.graph, ...args);
					void promise
						.then(
							() => {
								fixture.writer.assertParticipantTurn(args[0], args[1], ['NORMALIZE'], args[2]);
								trace.push('NORMALIZE:validated');
							},
							(error: unknown) => {
								observerFailures.push(error);
							},
						)
						.catch((error: unknown) => {
							observerFailures.push(error);
						});
					return promise;
				});
				const begin = jest.spyOn(fixture.graph, 'beginReservedValidation').mockImplementation((...args) => {
					fixture.writer.assertParticipantTurn(args[0], args[1], ['APPLY'], args[2]);
					trace.push('APPLY:ticket');
					return beginCall.call(fixture.graph, ...args);
				});
				const apply = jest.spyOn(fixture.authoring, 'applyCreation').mockImplementation((...args) => {
					fixture.writer.assertParticipantTurn(args[0], args[1], ['APPLY']);
					trace.push('APPLY:catalog');
					return applyCall.call(fixture.authoring, ...args);
				});
				// Install observers BEFORE this new genuine provider's original capability capture.
				const provider = new VirtualThermostatAutomationService(
					fixture.writer,
					fixture.core,
					fixture.graph,
					new NestConfigService(),
					fixture.authoring,
				);
				provider.onModuleInit();
				fixture.extraProviders.push(provider);
				const input = request(relayId);
				const result = await fixture.authoring.create(input);
				expect(trace).toEqual(['NORMALIZE:plan', 'NORMALIZE:validated', 'APPLY:ticket', 'APPLY:catalog']);
				expect(observerFailures).toEqual([]);
				expect(plan).toHaveBeenCalledTimes(1);
				expect(begin).toHaveBeenCalledTimes(1);
				expect(apply).toHaveBeenCalledTimes(1);
				for (const index of [0, 1, 2]) expect(begin.mock.calls[0][index]).toBe(plan.mock.calls[0][index]);
				expect(apply.mock.calls[0][0]).toBe(plan.mock.calls[0][0]);
				expect(apply.mock.calls[0][1]).toBe(plan.mock.calls[0][1]);
				expect(result.device.id).toBe(input.device.id);
				expect(result.configuration.revision).toBe(1);
				expect(await database.manager.findOneBy(DeviceEntity, { id: input.device.id })).not.toBeNull();
				expect(fixture.submittedPoints.length).toBeGreaterThan(0);
			});

			it('refuses a held original graph plan after owner revocation without ticket mutation or fresh-owner rescue', async () => {
				fixture.automation.onModuleDestroy();
				const originalMethods: Readonly<{
					validateReservedReplacement: VirtualDependencyGraphService['validateReservedReplacement'];
				}> = fixture.graph;
				const { validateReservedReplacement } = originalMethods;
				const originalCall: Readonly<{
					call: (
						receiver: VirtualDependencyGraphService,
						...args: Parameters<VirtualDependencyGraphService['validateReservedReplacement']>
					) => ReturnType<VirtualDependencyGraphService['validateReservedReplacement']>;
				}> = validateReservedReplacement;
				let reached: () => void = () => {};
				let release: () => void = () => {};
				const held = new Promise<void>((resolve) => {
					reached = resolve;
				});
				const resume = new Promise<void>((resolve) => {
					release = resolve;
				});
				const plan = jest.spyOn(fixture.graph, 'validateReservedReplacement').mockImplementation(async (...args) => {
					fixture.writer.assertParticipantTurn(args[0], args[1], ['NORMALIZE'], args[2]);
					await originalCall.call(fixture.graph, ...args);
					reached();
					await resume;
				});
				const begin = jest.spyOn(fixture.graph, 'beginReservedValidation');
				const apply = jest.spyOn(fixture.authoring, 'applyCreation');
				const original = new VirtualThermostatAutomationService(
					fixture.writer,
					fixture.core,
					fixture.graph,
					new NestConfigService(),
					fixture.authoring,
				);
				original.onModuleInit();
				fixture.extraProviders.push(original);
				const ownerA = fixture.core.captureProvider('virtual-thermostat:v1');
				if (!ownerA) throw new Error('Original actual provider required');
				const input = request(relayId);
				const revision = await fixture.graph.revision();
				const pending = fixture.writer.createVirtualThermostatV1({
					kind: 'create-virtual-thermostat:v1',
					device: input.device,
					configuration: input.configuration,
				});
				void pending.catch(() => undefined);
				try {
					await reachesCreationBarrier(pending, held);
					expect(plan).toHaveBeenCalledTimes(1);
					expect(begin).not.toHaveBeenCalled();
					original.onModuleDestroy();
					expect(ownerA.isCurrent()).toBe(false);
					const successor = new VirtualThermostatAutomationService(
						fixture.writer,
						fixture.core,
						fixture.graph,
						new NestConfigService(),
						fixture.authoring,
					);
					successor.onModuleInit();
					fixture.extraProviders.push(successor);
					const ownerB = fixture.core.captureProvider('virtual-thermostat:v1');
					if (!ownerB) throw new Error('Fresh actual successor required');
					expect(ownerB.isCurrent()).toBe(true);
					release();
					await expect(pending).resolves.toEqual({ outcome: 'conflict', reason: 'unavailable' });
					expect(begin).not.toHaveBeenCalled();
					expect(apply).not.toHaveBeenCalled();
					expect(await fixture.graph.revision()).toBe(revision);
					expect(await database.manager.findOneBy(DeviceEntity, { id: input.device.id })).toBeNull();
					expect(fixture.submittedPoints).toEqual([]);
					expect(publications).toEqual([]);
					original.onModuleDestroy();
					expect(ownerA.isCurrent()).toBe(false);
					expect(ownerB.isCurrent()).toBe(true);
				} finally {
					release();
					await pending.then(
						() => undefined,
						() => undefined,
					);
				}
			});
		});
		describe('fixed original creation response materialization', () => {
			it('returns authentic catalog classes with retained ordered zones and exact nullable API facts through the actual interceptor', async () => {
				const first = uuid(),
					second = uuid();
				await database.manager.insert(ZoneSpaceEntity, [
					{ id: first, name: 'First retained zone', category: SpaceZoneCategory.UTILITY },
					{ id: second, name: 'Second retained zone', category: SpaceZoneCategory.UTILITY },
				]);
				const input = request(relayId);
				input.device.zone_ids = [second, first];
				input.device.enabled = false;
				const originalMethods: Readonly<{
					createVirtualThermostatV1: ClimateAutomationWriterService['createVirtualThermostatV1'];
				}> = fixture.writer;
				const { createVirtualThermostatV1 } = originalMethods;
				const originalCall: Readonly<{
					call: (
						receiver: ClimateAutomationWriterService,
						...args: Parameters<ClimateAutomationWriterService['createVirtualThermostatV1']>
					) => ReturnType<ClimateAutomationWriterService['createVirtualThermostatV1']>;
				}> = createVirtualThermostatV1;
				let fixedFrame: unknown;
				const root = jest.spyOn(fixture.writer, 'createVirtualThermostatV1').mockImplementation((...args) => {
					const promise = originalCall.call(fixture.writer, ...args);
					void promise
						.then(
							(outcome) => {
								if (outcome.outcome === 'applied') fixedFrame = outcome.result;
							},
							() => undefined,
						)
						.catch(() => undefined);
					return promise;
				});
				const result = await fixture.authoring.create(input);
				expect(root).toHaveBeenCalledTimes(1);
				expect(result.device).toBeInstanceOf(VirtualDeviceEntity);
				expect(result.configuration).toBeInstanceOf(VirtualThermostatConfigurationModel);
				expect(result.configuration.policy).toBeInstanceOf(VirtualThermostatPolicyModel);
				expect(result.configuration.sources.every((source) => source instanceof VirtualThermostatSourceModel)).toBe(
					true,
				);
				expect(result.configuration.actuators.every((claim) => claim instanceof VirtualThermostatClaimModel)).toBe(
					true,
				);
				expect(result.configuration.settings.every((setting) => setting instanceof VirtualThermostatSettingModel)).toBe(
					true,
				);
				expect(Object.hasOwn(result.device, 'type')).toBe(false);
				expect(Object.hasOwn(result.device, 'zoneIds')).toBe(false);
				expect(result.device.zoneIds).toEqual([second, first]);
				expect(
					result.device.deviceZones.every(
						(zone) =>
							zone instanceof DeviceZoneEntity && zone.deviceId === input.device.id && zone.createdAt instanceof Date,
					),
				).toBe(true);
				expect(result.device.updatedAt).toBeNull();
				expect(result.device.roomId).toBeNull();
				expect(result.device.hiddenBy).toBeNull();
				expect(result.device.enabled).toBe(false);
				expect(result.device.hidden).toBe(false);
				expect(result.device.controls).toEqual([]);
				expect(result.device.channels.map((channel) => channel.id)).toEqual(
					input.device.channels?.map((channel) => channel.id),
				);
				for (const channel of result.device.channels) {
					expect(channel).toBeInstanceOf(VirtualChannelEntity);
					expect(Object.hasOwn(channel, 'type')).toBe(false);
					expect(channel.parentId).toBeNull();
					for (const property of channel.properties) {
						expect(property).toBeInstanceOf(VirtualChannelPropertyEntity);
						expect(Object.hasOwn(property, 'type')).toBe(false);
						expect(property.updatedAt).toBeNull();
						expect(property.value).toBeNull();
						expect(Object.hasOwn(property, 'unit')).toBe(false);
					}
				}
				const response = new VirtualCreatedThermostatResponseModel();
				response.data = result;
				const context = new ExecutionContextHost([{}, { sent: false }], null, () => undefined);
				context.setType('http');
				const actual: unknown = await firstValueFrom<unknown>(
					new TransformResponseInterceptor(new Reflector()).intercept(context, { handle: () => of(response) }),
				);
				if (!actual || typeof actual !== 'object' || !fixedFrame || typeof fixedFrame !== 'object')
					throw new Error('Actual fixed API response required');
				const data: unknown = Reflect.get(actual, 'data');
				if (!data || typeof data !== 'object') throw new Error('Actual response envelope required');
				expect(Reflect.get(data, 'configuration')).toEqual(Reflect.get(fixedFrame, 'configuration'));
				expect(Reflect.get(data, 'device')).toMatchObject({
					id: input.device.id,
					type: 'virtual',
					zone_ids: [second, first],
					room_id: null,
					hidden_by: null,
					updated_at: null,
					enabled: false,
					hidden: false,
					controls: [],
					status: { online: false, status: 'unknown', last_changed: null },
				});
				const publicDevice: unknown = Reflect.get(data, 'device');
				if (!publicDevice || typeof publicDevice !== 'object') throw new Error('Public device required');
				expect(Object.hasOwn(publicDevice, 'deviceZones')).toBe(false);
				expect(Object.hasOwn(publicDevice, 'roomId')).toBe(false);
				expect(result.configuration.policy.minimumOffMs).toBe(0);
				expect(result.configuration.policy.changeoverMs).toBe(0);
				expect(result.configuration.policy.coolingSetpoint).toBeNull();
				expect(result.configuration.heuristic).toBeNull();
				expect(result.configuration.released_actuators).toEqual([]);
				expect(
					instanceToPlain(result.device, {
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
						ignoreDecorators: false,
						groups: ['api'],
						enableCircularCheck: true,
					}),
				).toEqual(publicDevice);
			});

			it('materializes retained A after a real post-settlement B catalog update without latest lookup or reprepare', async () => {
				const input = request(relayId);
				const originalName = input.device.name;
				const originalMethods: Readonly<{
					createVirtualThermostatV1: ClimateAutomationWriterService['createVirtualThermostatV1'];
				}> = fixture.writer;
				const { createVirtualThermostatV1 } = originalMethods;
				const originalCall: Readonly<{
					call: (
						receiver: ClimateAutomationWriterService,
						...args: Parameters<ClimateAutomationWriterService['createVirtualThermostatV1']>
					) => ReturnType<ClimateAutomationWriterService['createVirtualThermostatV1']>;
				}> = createVirtualThermostatV1;
				const prepare = jest.spyOn(fixture.configs, 'prepare');
				let lookups = (): number => 0;
				let restore = (): void => undefined;
				const root = jest.spyOn(fixture.writer, 'createVirtualThermostatV1').mockImplementation(async (...args) => {
					const outcome = await originalCall.call(fixture.writer, ...args);
					if (outcome.outcome !== 'applied') throw new Error('Actual original creation must commit first');
					// Independent ordinary test mutation only AFTER A's root has settled/released; never an A business callback.
					const changed = await database.manager.update(
						VirtualDeviceEntity,
						{ id: input.device.id },
						{ name: 'Persisted successor B' },
					);
					expect(changed.affected).toBe(1);
					const latest = jest
						.spyOn(fixture.devices, 'findOne')
						.mockRejectedValue(new Error('Latest lookup forbidden for fixed A'));
					lookups = () => latest.mock.calls.length;
					restore = () => {
						latest.mockRestore();
					};
					return outcome;
				});
				// Capture the prepare observer only through a fresh legitimate production provider.
				fixture.automation.onModuleDestroy();
				const provider = new VirtualThermostatAutomationService(
					fixture.writer,
					fixture.core,
					fixture.graph,
					new NestConfigService(),
					fixture.authoring,
				);
				provider.onModuleInit();
				fixture.extraProviders.push(provider);
				try {
					const result = await fixture.authoring.create(input);
					expect(result.device.name).toBe(originalName);
					expect((await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: input.device.id })).name).toBe(
						'Persisted successor B',
					);
					expect(root).toHaveBeenCalledTimes(1);
					expect(prepare).toHaveBeenCalledTimes(1);
					expect(lookups()).toBe(0);
				} finally {
					restore();
				}
			});

			it('classifies malformed returned fixed A as COMMITTED after real native ACK without replay or losing durable creation', async () => {
				const input = request(relayId);
				const originalMethods: Readonly<{
					createVirtualThermostatV1: ClimateAutomationWriterService['createVirtualThermostatV1'];
				}> = fixture.writer;
				const { createVirtualThermostatV1 } = originalMethods;
				const originalCall: Readonly<{
					call: (
						receiver: ClimateAutomationWriterService,
						...args: Parameters<ClimateAutomationWriterService['createVirtualThermostatV1']>
					) => ReturnType<ClimateAutomationWriterService['createVirtualThermostatV1']>;
				}> = createVirtualThermostatV1;
				let nativeAcknowledgments = 0;
				database.subscribers.push({
					afterQuery: (event) => {
						if (event.query === 'COMMIT' && event.success) nativeAcknowledgments++;
					},
				});
				const root = jest.spyOn(fixture.writer, 'createVirtualThermostatV1').mockImplementation(async (...args) => {
					const outcome = await originalCall.call(fixture.writer, ...args);
					if (outcome.outcome !== 'applied') throw new Error('Real native creation required before malformed frame');
					const frame: unknown = outcome.result;
					if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error('Real fixed frame required');
					const device: unknown = Reflect.get(frame, 'device');
					if (!device || typeof device !== 'object' || Array.isArray(device))
						throw new Error('Real fixed device required');
					return Object.freeze({
						...outcome,
						result: climateAutomationJson({ ...frame, device: { ...device, zone_ids: null } }),
					});
				});
				let received: unknown;
				try {
					await fixture.authoring.create(input);
				} catch (error) {
					received = error;
				}
				expect(received).toBeInstanceOf(ClimateAutomationWriteError);
				if (!(received instanceof ClimateAutomationWriteError))
					throw new Error('Committed materialization error required');
				expect(received.commitOutcome).toBe('committed');
				expect(received.cause).toBeInstanceOf(Error);
				expect(received.cause).toHaveProperty('message', 'Missing fixed response array.');
				expect(nativeAcknowledgments).toBeGreaterThan(0);
				expect(root).toHaveBeenCalledTimes(1);
				expect(await database.manager.findOneBy(DeviceEntity, { id: input.device.id })).not.toBeNull();
			});
		});
	});
});
