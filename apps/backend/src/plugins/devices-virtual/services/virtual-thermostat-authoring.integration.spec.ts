/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { useContainer } from 'class-validator';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EntitySubscriberInterface } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { createProtectionProbe } from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import {
	CreationSettlement,
	DeviceCreationContext,
	DeviceCreationSettlementError,
} from '../../../modules/devices/services/device-creation-context';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DeviceZonesService } from '../../../modules/devices/services/device-zones.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueLockService } from '../../../modules/devices/services/property-value-lock.service';
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
import { CreateVirtualChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from '../dto/create-channel.dto';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import { UpdateVirtualChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from '../dto/update-channel.dto';
import { UpdateVirtualDeviceDto } from '../dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';
import { CategoryAllowedConstraintValidator } from '../validators/category-allowed-constraint.validator';
import { DeviceIsVirtualConstraintValidator } from '../validators/device-is-virtual-constraint.validator';

import { initializeThermostatCreationCatalog } from './thermostat-creation-catalog';
import { RetainedOriginalCreatedResponse, thermostatCreationResponse } from './thermostat-creation-response';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualDewPointConfigService } from './virtual-dew-point-config.service';
import { DEW_POINT_FORMULA } from './virtual-dew-point.utils';
import { VirtualThermostatAuthoringService } from './virtual-thermostat-authoring.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED, VirtualThermostatConfigService } from './virtual-thermostat-config.service';

jest.setTimeout(30000);

function responseWire(data: VirtualCreatedThermostatModel): unknown {
	return JSON.parse(
		JSON.stringify(
			instanceToPlain(data, {
				excludeExtraneousValues: true,
				exposeUnsetFields: false,
				ignoreDecorators: false,
				groups: ['api'],
				enableCircularCheck: true,
			}),
		),
	) as unknown;
}
function expectImmutableResponse(value: unknown): void {
	if (value === null || typeof value !== 'object') {
		expect(typeof value).not.toBe('function');
		return;
	}
	expect(value).not.toBeInstanceOf(Date);
	expect(Object.isFrozen(value)).toBe(true);
	expect([Object.prototype, Array.prototype, null]).toContain(Object.getPrototypeOf(value));
	for (const entry of Object.values(value)) expectImmutableResponse(entry);
}
describe('atomic virtual thermostat authoring', () => {
	let database: SqliteDataSource;
	let authoring: VirtualThermostatAuthoringService;
	let registry: PropertyCommandAdmissionRegistryService;
	let claims: VirtualThermostatClaimsService;
	let configs: VirtualThermostatConfigService;
	let devices: DevicesService;
	let events: EventEmitter2;
	let propertyMapper: ChannelsPropertiesTypeMapperService;
	let lock: DeviceStructureLockService;
	let graph: VirtualDependencyGraphService;
	let ambientId: string;
	let relayId: string;
	let relayDeviceId: string;
	const publications: EventType[] = [];
	let values: PropertyValueService;
	beforeEach(async () => {
		publications.length = 0;
		jest.clearAllMocks();
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		await database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
		events = new EventEmitter2();
		values = new PropertyValueService(
			{} as never,
			new PropertyValueSourceRegistryService(),
			new PropertyValueLockService(database),
			new PropertyProducerRegistryService(),
			events,
		);
		jest.spyOn(values, 'write').mockResolvedValue(true);
		jest.spyOn(values, 'readLatest').mockResolvedValue(null);
		for (const event of [
			EventType.DEVICE_CREATED,
			EventType.CHANNEL_CREATED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
		])
			events.on(event, () => publications.push(event));
		lock = new DeviceStructureLockService();
		graph = new VirtualDependencyGraphService(database);
		registry = new PropertyCommandAdmissionRegistryService();
		claims = new VirtualThermostatClaimsService(database, lock, graph, registry, events);
		configs = new VirtualThermostatConfigService(database, lock, graph, claims, events, values);
		const deviceMapper = new DevicesTypeMapperService();
		const channelMapper = new ChannelsTypeMapperService();
		propertyMapper = new ChannelsPropertiesTypeMapperService();
		propertyMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelPropertyEntity,
			createDto: CreateVirtualChannelPropertyDto,
			updateDto: UpdateVirtualChannelPropertyDto,
			beforeCreate: async (property, channelId, manager) => {
				await virtual.assertChannelOwnerIsVirtual(channelId, manager);
				await virtual.assertDerivedOutputSupported(property, channelId, manager);
				virtual.assertValueOriginPairSupported(property);
				virtual.assertOwnedPropertyNotWritable(property);
			},
		});
		channelMapper.registerMapping({
			type: 'virtual',
			class: VirtualChannelEntity,
			createDto: CreateVirtualChannelDto,
			updateDto: UpdateVirtualChannelDto,
		});
		deviceMapper.registerMapping({
			type: 'virtual',
			class: VirtualDeviceEntity,
			createDto: CreateVirtualDeviceDto,
			updateDto: UpdateVirtualDeviceDto,
		});
		const properties = new ChannelsPropertiesService(
			database.getRepository(ChannelPropertyEntity),
			propertyMapper,
			{} as never,
			new PropertyValueSourceRegistryService(),
			lock,
			{} as never,
			{} as never,
			database,
			events,
		);
		const channels = new ChannelsService(
			database.getRepository(ChannelEntity),
			channelMapper,
			properties,
			{} as never,
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
		devices = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			deviceMapper,
			channels,
			properties,
			{} as never,
			zones,
			lock,
			database,
			events,
		);
		const virtual = new VirtualDevicesService(properties, channels, devices, {} as never, {} as never, graph, database);
		useContainer(
			{
				get: <T>(type: new () => T): T => {
					if (type === (CategoryAllowedConstraintValidator as never))
						return new CategoryAllowedConstraintValidator(virtual) as T;
					if (type === (DeviceIsVirtualConstraintValidator as never))
						return new DeviceIsVirtualConstraintValidator(virtual) as T;
					if (type === (DeviceExistsConstraintValidator as never))
						return new DeviceExistsConstraintValidator(devices) as T;
					return new type();
				},
			},
			{ fallbackOnErrors: true },
		);
		authoring = new VirtualThermostatAuthoringService(
			database,
			lock,
			graph,
			devices,
			new DeviceValidationService(devices),
			configs,
		);
		await claims.onApplicationBootstrap();
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
		publications.length = 0;
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		claims?.onModuleDestroy();
		if (database?.isInitialized) await database.destroy();
		jest.useRealTimers();
		useContainer({ get: <T>(type: new () => T) => new type() }, { fallbackOnErrors: true });
	});
	async function actuator(existingDevice?: string, mac = 'A8032ABE5084') {
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
				canonicalMac: mac,
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
	const request = (relay: string, coolingRelay?: string): CreateVirtualThermostatProducerDto => {
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
					...(coolingRelay
						? [
								channel(ChannelCategory.COOLER, [
									property(ChannelCategory.COOLER, PropertyCategory.ON, 'cooling_enabled'),
									property(ChannelCategory.COOLER, PropertyCategory.TEMPERATURE, 'cooling_setpoint'),
									property(ChannelCategory.COOLER, PropertyCategory.STATUS),
								]),
							]
						: []),
				],
			},
			configuration: {
				schema_version: 1,
				expected_revision: 0,
				requested_mode: 'off',
				policy: {
					heatingSetpoint: 20,
					coolingSetpoint: coolingRelay ? 25 : null,
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
				actuators: [
					{ role: 'heating', source_property: relay, lease_seconds: 30 },
					...(coolingRelay ? [{ role: 'cooling', source_property: coolingRelay, lease_seconds: 30 }] : []),
				],
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
		const callerBefore = JSON.stringify(first);
		const created = await authoring.create(first);
		expect(JSON.stringify(first)).toBe(callerBefore);
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

	it.each(['value write', 'claims refresh', 'event publication', 'device hydration'])(
		'returns the persisted thermostat when post-commit %s fails',
		async (failure) => {
			const input = request(relayId);
			if (failure === 'value write') jest.spyOn(values, 'write').mockRejectedValueOnce(new Error('value write failed'));
			if (failure === 'claims refresh')
				jest.spyOn(claims, 'refresh').mockRejectedValueOnce(new Error('refresh failed'));
			if (failure === 'event publication')
				jest.spyOn(events, 'emit').mockImplementation((event: string | symbol, ...args: unknown[]) => {
					if (event === THERMOSTAT_CONFIG_CHANGED) throw new Error('publication failed');
					return Boolean(EventEmitter2.prototype.emit.call(events, event, ...args));
				});
			if (failure === 'device hydration')
				jest.spyOn(devices, 'findOne').mockRejectedValueOnce(new Error('hydration failed'));
			const created = await authoring.create(input);
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

	it.each(['catalog', 'configuration', 'hydration'] as const)(
		'selects the entire original response after a real %s rejection and still finishes later phases',
		async (phase) => {
			const input = request(relayId),
				cause = phase === 'configuration' ? undefined : phase === 'hydration' ? false : new Error('catalog');
			let originalDevice: VirtualDeviceEntity, originalWire: unknown;
			let originalConfiguration: VirtualThermostatConfigurationModel;
			const stages: string[] = [];
			let finalHydration = false;
			database.subscribers.push({
				afterLoad(entity) {
					if (entity instanceof VirtualDeviceEntity && entity.id === input.device.id) originalDevice = entity;
				},
			});
			const snapshot = configs.snapshot.bind(configs) as VirtualThermostatConfigService['snapshot'];
			jest.spyOn(configs, 'snapshot').mockImplementation(async (...args) => {
				originalConfiguration = await snapshot(...args);
				originalWire = responseWire(
					Object.assign(new VirtualCreatedThermostatModel(), {
						device: originalDevice,
						configuration: originalConfiguration,
					}),
				);
				stages.push('snapshot');
				return originalConfiguration;
			});
			const mapping = propertyMapper.getMapping('virtual');
			mapping.afterCreate = async () => {
				stages.push('catalog');
				if (phase === 'catalog') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exact unknown rejection.
					return Promise.reject(cause);
				}
			};
			propertyMapper.registerMapping(mapping);
			const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
			jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
				stages.push('configuration');
				finalHydration = true;
				const result = await afterCommit(...args);
				// These were captured before ACK and must no longer alias settlement or fallback.
				originalDevice.name = 'shared entity mutated';
				(originalDevice.createdAt as Date).setFullYear(2000);
				originalConfiguration.reasons.push('shared configuration mutated');
				if (phase === 'configuration') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy rejection by presence.
					return Promise.reject(cause);
				}
				return result;
			});
			const find = devices.findOne.bind(devices) as DevicesService['findOne'];
			jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				if (finalHydration) stages.push('hydration');
				const result = await find(...args);
				if (finalHydration && result) result.name = 'later successful candidate';
				if (finalHydration && phase === 'hydration') {
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Falsy rejection by presence.
					return Promise.reject(cause);
				}
				return result;
			});
			const run = DeviceCreationContext.runPinned;
			let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
			jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
				settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
				return run(...args);
			});
			const created = await authoring.create(input);
			expect(responseWire(created)).toEqual(originalWire);
			originalDevice.channels[0].properties[0].permissions.push(PermissionType.READ_WRITE);
			originalConfiguration.policy.heatingSetpoint = 99;
			expect(responseWire(created)).toEqual(originalWire);
			expect(stages.filter((stage) => stage !== 'catalog')).toEqual(['snapshot', 'configuration', 'hydration']);
			expect(stages.filter((stage) => stage === 'catalog')).toHaveLength(
				input.device.channels.reduce((count, channel) => count + channel.properties.length, 0),
			);
			expect(settlement.outcome).toBe('committed');
			expect(settlement.legacyPublicationFailure?.cause).toBe(phase === 'catalog' ? cause : undefined);
			expectImmutableResponse(settlement.result.value);
			const response = thermostatCreationResponse.pin();
			expect(responseWire(response.materialize(settlement.result.value))).toEqual(originalWire);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
			expect(values.write).toHaveBeenCalledTimes(input.configuration.settings.length);
		},
	);

	it.each(['copy', 'materialization'] as const)(
		'isolates candidate %s failure and keeps one hydration with the full original native result',
		async (phase) => {
			const input = request(relayId),
				find = devices.findOne.bind(devices) as DevicesService['findOne'];
			const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
			let finalHydration = false,
				finalReads = 0;
			jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
				const result = await afterCommit(...args);
				finalHydration = true;
				return result;
			});
			const hydrate = jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				const result = await find(...args);
				if (finalHydration) finalReads++;
				if (finalHydration && phase === 'copy') {
					result.name = {
						valueOf: () => {
							throw new Error('must not coerce');
						},
					} as never;
				}
				return result;
			});
			let materializationAttempts = 0;
			if (phase === 'materialization') {
				const define = Object.defineProperty;
				jest.spyOn(Object, 'defineProperty').mockImplementation((target, key, descriptor) => {
					if (target instanceof VirtualCreatedThermostatModel && key === 'device' && ++materializationAttempts === 1)
						throw new Error('candidate materialization failed');
					return define(target, key, descriptor);
				});
			}
			const result = await authoring.create(input);
			expect(result.device.name).toBe(input.device.name);
			if (phase === 'materialization') expect(materializationAttempts).toBe(2);
			expect(hydrate).toHaveBeenCalledTimes(2);
			expect(finalReads).toBe(1);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		},
	);

	it.each(
		(['V0', 'Before', 'After'] as const).flatMap((phase) =>
			[undefined, null, false, 0, '', new Error('original proof rejection')].map((cause, index) => ({
				phase,
				cause,
				index,
			})),
		),
	)('keeps original proof rejection by presence at $phase cause$index', async ({ phase, cause }) => {
		const input = request(relayId);
		const sourceQuery = database.query.bind(database) as SqliteDataSource['query'];
		const target = { V0: 1, Before: 2, After: 3 }[phase];
		let observed = 0,
			finalPhase = false,
			finalHydrations = 0;
		jest.spyOn(database, 'query').mockImplementation((async (...args: Parameters<SqliteDataSource['query']>) => {
			if (args[0].startsWith('WITH root AS') && ++observed === target) {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Exact finite falsy/native cause fixture.
				return Promise.reject(cause);
			}
			const raw: unknown = await sourceQuery(...args);
			return raw;
		}) as SqliteDataSource['query']);
		const afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			finalPhase = true;
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
			const selected = await find(...args);
			if (finalPhase && args[0] === input.device.id) {
				finalHydrations++;
				if (selected) selected.name = 'later successful candidate';
			}
			return selected;
		});
		const run = DeviceCreationContext.runPinned;
		let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
		jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
			settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
			return run(...args);
		});
		if (phase === 'V0') {
			let failure: { cause: unknown } | undefined;
			try {
				await authoring.create(input);
			} catch (caught) {
				failure = { cause: caught };
			}
			expect(failure).toBeDefined();
			expect(failure.cause).toBe(cause);
			expect(settlement.outcome).toBe('rolled_back');
			expect(finalHydrations).toBe(0);
			await expectAbsent(input);
		} else {
			const created = await authoring.create(input);
			expect(settlement.outcome).toBe('committed');
			expect(responseWire(created)).toEqual(
				responseWire(thermostatCreationResponse.pin().materialize(settlement.result.value)),
			);
			expect(created.device.name).toBe(input.device.name);
			expect(finalHydrations).toBe(1);
			expectImmutableResponse(settlement.result.value);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		}
		expect(observed).toBe(target);
	});
	it('keeps latest ordinary hydration on uninterrupted success without rewriting the native original', async () => {
		const input = request(relayId),
			afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			await devices.update(
				input.device.id,
				plainToInstance(UpdateVirtualDeviceDto, { type: 'virtual', name: 'latest supported edit' }),
			);
			return result;
		});
		const run = DeviceCreationContext.runPinned;
		let settlement: CreationSettlement<RetainedOriginalCreatedResponse>;
		jest.spyOn(DeviceCreationContext, 'runPinned').mockImplementation((...args) => {
			settlement = args[4] as CreationSettlement<RetainedOriginalCreatedResponse>;
			return run(...args);
		});
		const created = await authoring.create(input);
		expect(created.device.name).toBe('latest supported edit');
		expect(settlement.result.value.fullWire.device.name).toBe(input.device.name);
		expectImmutableResponse(settlement.result.value);
		expect(settlement.legacyPublicationFailure).toBeUndefined();
	});

	it('keeps the original device without a retry when final ordinary hydration resolves null', async () => {
		const input = request(relayId),
			afterCommit = configs.afterCommit.bind(configs) as VirtualThermostatConfigService['afterCommit'];
		let finalPhase = false;
		jest.spyOn(configs, 'afterCommit').mockImplementation(async (...args) => {
			const result = await afterCommit(...args);
			finalPhase = true;
			return result;
		});
		const find = devices.findOne.bind(devices) as DevicesService['findOne'];
		const read = jest
			.spyOn(devices, 'findOne')
			.mockImplementation((...args) => (finalPhase ? Promise.resolve(null) : find(...args)));
		const created = await authoring.create(input);
		expect(created.device.name).toBe(input.device.name);
		expect(created.configuration.controller).toBe(input.device.id);
		expect(read).toHaveBeenCalledTimes(2); // Original catalog deferred read, then exactly one final hydrate.
		expect(values.write).toHaveBeenCalledTimes(input.configuration.settings.length);
	});

	it('pins the finite response getters before traversing the caller DTO', async () => {
		const input = request(relayId),
			original = Object.getOwnPropertyDescriptor(VirtualDeviceEntity.prototype, 'type');
		const replacement = jest.fn(() => 'replacement'),
			name = input.device.name;
		Object.defineProperty(input.device, 'name', {
			enumerable: true,
			get() {
				Object.defineProperty(VirtualDeviceEntity.prototype, 'type', { ...original, get: replacement });
				return name;
			},
		});
		try {
			await expect(authoring.create(input)).rejects.toThrow('expired');
			expect(replacement).not.toHaveBeenCalled();
			await expectAbsent(input);
		} finally {
			Object.defineProperty(VirtualDeviceEntity.prototype, 'type', original);
		}
	});

	it('treats original response capture failure as a body error before COMMIT', async () => {
		const input = request(relayId),
			snapshot = configs.snapshot.bind(configs) as VirtualThermostatConfigService['snapshot'];
		jest.spyOn(configs, 'snapshot').mockImplementation(async (...args) => {
			const configuration = await snapshot(...args);
			configuration.reasons.push({ bad: true } as never);
			return configuration;
		});
		await expect(authoring.create(input)).rejects.toThrow('scalar');
		await expectAbsent(input);
		expect(values.write).not.toHaveBeenCalled();
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
		const original = configs.persist.bind(configs);
		jest.spyOn(configs, 'persist').mockImplementationOnce(async (manager, id, prepared) => {
			await original(manager, id, prepared);
			throw new Error('injected post-persist failure');
		});
		await expect(authoring.create(input)).rejects.toThrow('injected post-persist failure');
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
	function gate() {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		return { promise, resolve };
	}
	async function expectAbsent(input: CreateVirtualThermostatProducerDto, revision = 0) {
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(0);
		for (const channel of input.device.channels) {
			expect(await database.manager.countBy(ChannelEntity, { id: channel.id })).toBe(0);
			for (const property of channel.properties)
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(0);
		}
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(await graph.revision()).toBe(revision);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	}

	it('rolls back actual catalog work on same-object registration replacement inside a real beforeCreate pause', async () => {
		const input = request(relayId),
			entered = gate(),
			resume = gate();
		const mapping = propertyMapper.getMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>('virtual');
		const original = mapping.beforeCreate;
		let paused = false;
		mapping.beforeCreate = async function (...args) {
			expect(this).toBe(mapping);
			await original.call(this, ...args);
			if (!paused) {
				paused = true;
				entered.resolve();
				await resume.promise;
			}
		};
		let expired!: DeviceCreationContext;
		const create = devices.create.bind(devices) as DevicesService['create'];
		jest.spyOn(devices, 'create').mockImplementation((dto, context) => {
			expired = context;
			return create(dto, context);
		});
		const pending = authoring.create(input);
		const rejected = expect(pending).rejects.toThrow('expired');
		try {
			await Promise.race([entered.promise, pending]);
			propertyMapper.registerMapping(mapping);
		} finally {
			resume.resolve();
		}
		await rejected;
		await expectAbsent(input);
		expect(await database.manager.countBy(ChannelPropertyEntity, { id: ambientId })).toBe(1);
		expect(await database.manager.countBy(ChannelPropertyEntity, { id: relayId })).toBe(1);
		const getter = jest.fn(() => {
			throw new Error('expired input');
		});
		const late = Object.defineProperty({}, 'type', { get: getter }) as CreateVirtualDeviceDto;
		await expect(devices.create(late, expired)).rejects.toThrow('not active');
		expect(getter).not.toHaveBeenCalled();
		const fresh = request(relayId);
		expect((await authoring.create(fresh)).device.id).toBe(fresh.device.id);
	});

	it.each(['device', 'configuration', 'expectedGraphRevision', 'nested type'])(
		'captures before the %s getter and snapshots caller data once',
		async (field) => {
			const input = request(relayId);
			const saved = JSON.stringify(input);
			let owner: object = input,
				key = field;
			if (field === 'expectedGraphRevision') {
				owner = input.configuration;
				key = field;
			}
			if (field === 'nested type') {
				owner = input.device.channels[0].properties[0];
				key = 'type';
			}
			const value: unknown = Reflect.get(owner, key);
			const getter = jest.fn(() => {
				propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				return value;
			});
			Object.defineProperty(owner, key, { get: getter, enumerable: true, configurable: true });
			await expect(authoring.create(input)).rejects.toThrow('expired');
			expect(getter).toHaveBeenCalledTimes(1);
			Object.defineProperty(owner, key, { value, enumerable: true, configurable: true, writable: true });
			if (field === 'expectedGraphRevision') Reflect.deleteProperty(owner, key);
			expect(JSON.stringify(input)).toBe(saved);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(0);
		},
	);

	it('refuses the original capture after replacement while queued for the existing lock', async () => {
		const entered = gate(),
			resume = gate();
		const holder = lock.runExclusive(async () => {
			entered.resolve();
			await resume.promise;
		});
		await entered.promise;
		const input = request(relayId);
		const pending = authoring.create(input);
		const rejected = expect(pending).rejects.toThrow('expired');
		propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
		resume.resolve();
		await holder;
		await rejected;
		await expectAbsent(input);
	});

	it('refuses replacement at actual BeforeQuery COMMIT even after all original configuration reads', async () => {
		const input = request(relayId);
		let commits = 0;
		database.subscribers.push({
			beforeQuery: (event) => {
				if (event.query === 'COMMIT' && commits++ === 0)
					propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
			},
		} satisfies EntitySubscriberInterface);
		await expect(authoring.create(input)).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
		expect(commits).toBe(1);
		await expectAbsent(input);
	});

	it.each(['subscriber', 'release'] as const)(
		'retains native ACK and the original result when awaited %s rejects',
		async (phase) => {
			const input = request(relayId),
				cause = new Error('after native ACK');
			let commits = 0;
			database.subscribers.push({
				afterTransactionCommit: (event) => {
					commits++;
					if (phase === 'subscriber') throw cause;
					// The coordinated transaction owns its runner; its real release is the connection
					// lease in withConnection's finally, rather than TypeORM's borrowed-runner release.
					const lease = Reflect.get(event.queryRunner, 'lease') as { release: () => void };
					const release = lease.release;
					lease.release = () => {
						lease.release = release;
						release();
						throw cause;
					};
				},
			});
			const failed = await authoring.create(input).catch((error: unknown) => error);
			expect(failed).toBeInstanceOf(DeviceCreationSettlementError);
			const error = failed as DeviceCreationSettlementError<RetainedOriginalCreatedResponse>;
			expect(error.cause).toBe(cause);
			expect(error.settlement.outcome).toBe('committed');
			expect(error.settlement.result.value).toMatchObject({
				fullWire: { device: { id: input.device.id }, configuration: { revision: 1 } },
				identity: { controller: input.device.id, configurationRevision: 1 },
			});
			expectImmutableResponse(error.settlement.result.value);
			expect(commits).toBe(1);
			expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
			expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
			expect(publications).toEqual([]);
			expect(values.write).not.toHaveBeenCalled();
		},
	);

	it.each([false, true])(
		'keeps B serialized through A configuration publication and hydration, callbackFailure=%s',
		async (callbackFailure) => {
			const input = request(relayId),
				entered = gate(),
				resume = gate(),
				hydration = gate(),
				hydrateResume = gate();
			const writes: unknown[] = [];
			let postCommit = false;
			jest.spyOn(values, 'write').mockImplementation(async (_property, value) => {
				writes.push(value);
				if (value === 20) {
					entered.resolve();
					await resume.promise;
					postCommit = true;
					if (callbackFailure) throw new Error('A publication failed');
				}
				return true as never;
			});
			const find = devices.findOne.bind(devices) as DevicesService['findOne'];
			jest.spyOn(devices, 'findOne').mockImplementation(async (...args) => {
				if (postCommit && args[0] === input.device.id) {
					hydration.resolve();
					await hydrateResume.promise;
				}
				return find(...args);
			});
			const pendingA = authoring.create(input);
			await Promise.race([entered.promise, pendingA]);
			let bDone = false;
			const selected: { lease: boolean; bDone: boolean; published25: boolean }[] = [];
			const define = Object.defineProperty;
			jest.spyOn(Object, 'defineProperty').mockImplementation((target, key, descriptor) => {
				if (target instanceof VirtualCreatedThermostatModel && key === 'configuration')
					selected.push({ lease: lock.hasCurrentStructuralLease(), bDone, published25: writes.includes(25) });
				return define(target, key, descriptor);
			});
			const pendingB = configs
				.configure(input.device.id, {
					...input.configuration,
					expectedRevision: 1,
					policy: { ...input.configuration.policy, heatingSetpoint: 25 },
				})
				.then((result) => {
					bDone = true;
					return result;
				});
			try {
				await new Promise<void>((resolve) => setImmediate(resolve));
				expect(bDone).toBe(false);
				expect(writes).not.toContain(25);
				resume.resolve();
				await Promise.race([hydration.promise, pendingA]);
				expect(bDone).toBe(false);
				expect(writes).not.toContain(25);
			} finally {
				resume.resolve();
				hydrateResume.resolve();
			}
			expect((await pendingA).configuration.revision).toBe(1);
			expect(selected).toEqual([{ lease: true, bDone: false, published25: false }]);
			expect((await pendingB).revision).toBe(2);
			expect(writes.filter((value) => typeof value === 'number')).toEqual([20, 25]);
			expect((await configs.get(input.device.id)).policy.heatingSetpoint).toBe(25);
		},
	);

	it('refuses graph revision overflow atomically', async () => {
		expect(await database.manager.find(VirtualGraphRevisionEntity)).toEqual([{ id: 1, revision: 0 }]);
		const updated = await database.manager.update(
			VirtualGraphRevisionEntity,
			{ id: 1 },
			{ revision: Number.MAX_SAFE_INTEGER },
		);
		expect(updated.affected).toBe(1);
		expect(await database.manager.find(VirtualGraphRevisionEntity)).toEqual([
			{ id: 1, revision: Number.MAX_SAFE_INTEGER },
		]);
		const input = request(relayId);
		await expect(authoring.create(input)).rejects.toThrow('overflow');
		await expectAbsent(input, Number.MAX_SAFE_INTEGER);
	});

	it('drains an actual unawaited Device/Channel/Property traversal through body closure before COMMIT', async () => {
		const input = request(relayId),
			entered = gate(),
			resume = gate();
		const mapping = propertyMapper.getMapping<
			VirtualChannelPropertyEntity,
			CreateVirtualChannelPropertyDto,
			UpdateVirtualChannelPropertyDto
		>('virtual');
		const original = mapping.beforeCreate;
		let paused = false,
			root!: DeviceCreationContext,
			catalogPromise!: Promise<DeviceEntity>;
		mapping.beforeCreate = async function (...args) {
			await original.call(this, ...args);
			if (!paused) {
				paused = true;
				entered.resolve();
				await resume.promise;
			}
		};
		const catalog = devices.captureCreationCatalog('virtual');
		const settlement = new CreationSettlement<number>();
		const pending = lock.runExclusive(() =>
			DeviceCreationContext.runPinned(
				(work, admit) => graph.withCreationWrite(work, undefined, admit),
				catalog,
				AsyncLocalStorage.bind(() => lock.hasCurrentStructuralLease()),
				(context) => {
					root = context;
					catalogPromise = devices.create(input.device, context);
					return Promise.resolve(4);
				},
				settlement,
			),
		);
		try {
			await Promise.race([entered.promise, pending]);
			expect(settlement.outcome).toBe('pending');
			const getter = jest.fn(() => {
				throw new Error('detached input');
			});
			await expect(
				devices.create(Object.defineProperty({}, 'type', { get: getter }) as CreateVirtualDeviceDto, root),
			).rejects.toThrow('not active');
			expect(getter).not.toHaveBeenCalled();
		} finally {
			resume.resolve();
		}
		expect(await pending).toBe(4);
		expect((await catalogPromise).id).toBe(input.device.id);
		expect(settlement.outcome).toBe('committed');
		for (const channel of input.device.channels)
			for (const property of channel.properties)
				expect(await database.manager.countBy(ChannelPropertyEntity, { id: property.id })).toBe(1);
		expect(await graph.revision()).toBe(1);
	});

	it('skips expired original deferred dispatch after ACK without deleting the durable catalog', async () => {
		const input = request(relayId);
		let changed = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				if (!changed) {
					changed = true;
					propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				}
			},
		});
		const created = await authoring.create(input);
		expect(created.device.id).toBe(input.device.id);
		expect(created.configuration.revision).toBe(1);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('rechecks original registration on actual SQLite busy redispatch without an application retry', async () => {
		Object.assign(database.options, { busyErrorRetry: 1 });
		interface Native {
			all(
				sql: string,
				params: unknown[],
				callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
			): unknown;
		}
		const native = (database.driver as SqliteDriver).databaseConnection as Native;
		const original = native.all.bind(native) as Native['all'];
		let attempts = 0;
		jest.spyOn(native, 'all').mockImplementation(function (this: Native, sql, params, callback) {
			if (sql === 'COMMIT' && ++attempts === 1) {
				propertyMapper.registerMapping(propertyMapper.getMapping('virtual'));
				queueMicrotask(() => {
					callback.call(this, new Error('SQLITE_BUSY: original dispatch test'));
				});
				return this;
			}
			return original(sql, params, callback);
		});
		const input = request(relayId);
		await expect(authoring.create(input)).rejects.toMatchObject({ settlement: { outcome: 'refused' } });
		expect(attempts).toBe(1);
		await expectAbsent(input);
	});

	it('authors required explicit floor protection with the actual catalog/configuration/claim transaction', async () => {
		const probe = await createProtectionProbe(database, relayId);
		const input = request(relayId);
		input.configuration.policy.floor = { limit: 30, recoveryHysteresis: 2 };
		input.configuration.actuators[0].protection = {
			schemaVersion: 1,
			kind: 'local_floor',
			sourcePropertyId: probe.sourceId,
			maximumAgeSeconds: 5,
		};
		const result = await authoring.create(input);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			controllerId: input.device.id,
		});
		expect(
			await database.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id }),
		).toMatchObject({ sourcePropertyId: probe.sourceId, revision: 1, maximumAgeSeconds: 5 });
		expect(result.configuration.readiness).toBe('draft');
	});
	it('persists genuine cooled-surface dependencies and exact heating/cooling catalog branches in the creation transaction', async () => {
		const coolingRelay = await actuator(undefined, 'A8032ABE5198');
		await database.manager.update(ShellyNgDeviceEntity, { id: relayDeviceId }, { canonicalMac: 'A8032ABE5198' });
		const surface = await createProtectionProbe(database, coolingRelay);
		const humidityChannel = uuid(),
			humidity = uuid(),
			dewDevice = uuid(),
			dewChannel = uuid(),
			dew = uuid();
		await database.manager.insert(ChannelEntity, {
			id: humidityChannel,
			device: relayDeviceId,
			name: 'Humidity',
			category: ChannelCategory.HUMIDITY,
		} as never);
		await database.manager.insert(ChannelPropertyEntity, {
			id: humidity,
			channel: humidityChannel,
			identifier: 'humidity',
			category: PropertyCategory.HUMIDITY,
			dataType: DataTypeType.FLOAT,
			unit: '%',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		await database.manager.insert(VirtualDeviceEntity, {
			id: dewDevice,
			name: 'Dedicated dew point',
			category: DeviceCategory.SENSOR,
			mode: VirtualDeviceMode.SENSOR_TRANSFORM,
			enabled: true,
		});
		await database.manager.insert(VirtualChannelEntity, {
			id: dewChannel,
			device: dewDevice,
			name: 'Dew point',
			category: ChannelCategory.ANALOG_INPUT,
		} as never);
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: dew,
			channel: dewChannel,
			identifier: 'value',
			category: PropertyCategory.VALUE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			valueOrigin: VirtualValueOrigin.DERIVED,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const dewPoints = new VirtualDewPointConfigService(database, lock, graph, {} as never, events);
		await database.transaction(async (manager) => {
			const prepared = await dewPoints.prepare(manager, dew, {
				schemaVersion: 1,
				formulaVersion: DEW_POINT_FORMULA,
				expectedRevision: 0,
				maximumAgeSeconds: 300,
				maximumSkewSeconds: 60,
				sources: [
					{ role: 'dry_bulb', sourcePropertyId: ambientId },
					{ role: 'relative_humidity', sourcePropertyId: humidity },
				],
			});
			await dewPoints.persist(manager, prepared);
		});
		const input = request(relayId, coolingRelay);
		input.configuration.policy.cooling = { schemaVersion: 1, marginC: 2, recoveryHysteresisC: 1 };
		input.configuration.actuators[1].coolingProtection = {
			schemaVersion: 1,
			purpose: 'cooled_surface',
			dewPointPropertyId: dew,
			surfacePropertyId: surface.sourceId,
			maximumAgeSeconds: 5,
		};
		const result = await authoring.create(input);
		const claim = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, {
			controllerId: input.device.id,
			role: 'cooling',
		});
		expect(
			await database.manager.findOneByOrFail(ThermostatCoolingDependencyEntity, { claimId: claim.id }),
		).toMatchObject({
			dewPointPropertyId: dew,
			surfacePropertyId: surface.sourceId,
			revision: 1,
			maximumAgeSeconds: 5,
		});
		expect(result.configuration.readiness).toBe('draft');
		expect(result.device.channels.map((channel) => channel.category)).toEqual(
			expect.arrayContaining([ChannelCategory.HEATER, ChannelCategory.COOLER]),
		);
		expect(
			await database.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId: input.device.id }),
		).toBe(2);
	});

	it('keeps actual unknown native creation unavailable even when its full catalog/configuration committed', async () => {
		interface Native {
			all(
				sql: string,
				params: unknown[],
				callback: (this: unknown, error: Error | null, rows?: unknown[]) => void,
			): unknown;
		}
		const native = (database.driver as SqliteDriver).databaseConnection as Native;
		const original = native.all.bind(native) as Native['all'];
		const cause = new Error('native ACK unavailable');
		let commits = 0;
		jest.spyOn(native, 'all').mockImplementation((sql, params, callback) => {
			if (sql === 'COMMIT') commits++;
			return original(sql, params, function (error, rows) {
				callback.call(this, sql === 'COMMIT' && !error ? cause : error, rows);
			});
		});
		const input = request(relayId);
		const failed = await authoring.create(input).catch((error: unknown) => error);
		expect(failed).toMatchObject({
			settlement: { outcome: 'unknown', result: { value: { fullWire: { configuration: { revision: 1 } } } } },
			cause: { driverError: cause },
		});
		expectImmutableResponse(
			(failed as DeviceCreationSettlementError<RetainedOriginalCreatedResponse>).settlement.result.value,
		);
		expect(commits).toBe(1);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
		expect(await database.manager.countBy(VirtualThermostatConfigEntity, { controllerId: input.device.id })).toBe(1);
		expect(publications).toEqual([]);
		expect(values.write).not.toHaveBeenCalled();
	});

	it('preserves historical ACK/result and exact later structural settlement cause', async () => {
		const cause = new Error('later structural settlement'),
			input = request(relayId);
		const original = lock.runExclusive.bind(lock) as DeviceStructureLockService['runExclusive'];
		let first = true;
		jest.spyOn(lock, 'runExclusive').mockImplementation(async (work) => {
			const outer = first;
			first = false;
			const result = await original(work);
			if (outer) throw cause;
			return result;
		});
		await expect(authoring.create(input)).rejects.toMatchObject({
			cause,
			settlementCause: cause,
			settlement: { outcome: 'committed', result: { value: { fullWire: { device: { id: input.device.id } } } } },
		});
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
	});

	it('returns the committed response when actual graph refresh fails closed after ACK', async () => {
		let acknowledged = false;
		database.subscribers.push({
			afterTransactionCommit: () => {
				acknowledged = true;
			},
		});
		const edges = graph.edges.bind(graph) as VirtualDependencyGraphService['edges'];
		jest
			.spyOn(graph, 'edges')
			.mockImplementation((manager) =>
				acknowledged ? Promise.reject(new Error('post-ACK validation read failed')) : edges(manager),
			);
		const input = request(relayId),
			result = await authoring.create(input);
		expect(result.device.id).toBe(input.device.id);
		expect(result.configuration.revision).toBe(1);
		expect(graph.isValidated()).toBe(false);
		expect(await database.manager.countBy(DeviceEntity, { id: input.device.id })).toBe(1);
	});
});
