import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';

import { Injectable, Logger, Optional } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationCreationFacts, ClimateAutomationCreationPlan, ClimateAutomationCreationRequest, ClimateAutomationCreationRow, ClimateAutomationWriteError, ClimateAutomationJson, ClimateAutomationParticipantTurn, climateAutomationCanonical, climateAutomationJson } from '../../../modules/devices/contracts/climate-automation.contract';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { ChannelsTypeMapperService } from '../../../modules/devices/services/channels-type-mapper.service';
import { ChannelsPropertiesTypeMapperService } from '../../../modules/devices/services/channels.properties-type-mapper.service';
import { PropertyProducerRegistryService } from '../../../modules/devices/services/property-producer.registry.service';
import { DeviceCreationContext, DeviceCreationEnvironment, DeviceCreationPublicationEngine, creationHasDataMethod, creationMethodCurrent } from '../../../modules/devices/services/device-creation-context';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VirtualThermostatActuatorClaimEntity, VirtualThermostatConfigEntity, VirtualThermostatSettingEntity, VirtualThermostatSourceEntity } from '../entities/virtual-thermostat.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';

import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { buildDeviceGraphQuery } from '../../../modules/devices/utils/device-graph-query.utils';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType, isFloorZoneCategory } from '../../../modules/spaces/spaces.constants';
import { CreateVirtualDeviceDto } from '../dto/create-device.dto';
import { CreateVirtualThermostatProducerDto } from '../dto/thermostat-authoring.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualCreatedThermostatModel } from '../models/thermostat-authoring-response.model';
import { VirtualThermostatConfigurationModel } from '../models/thermostat-response.model';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatConfigService } from './virtual-thermostat-config.service';

interface AuthoringCall<R, A extends unknown[], V> { readonly call: (receiver: R, ...args: A) => V; }

const fail = (message: string): never => {
	throw new DevicesValidationException(message);
};

@Injectable()
export class VirtualThermostatAuthoringService {
	private readonly logger = new Logger(VirtualThermostatAuthoringService.name);
	// Weak provenance only for restoring this concrete route's original KNOWN-rollback callback errors.
	private readonly creationCallbackFailures = new WeakSet<Error>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly devices: DevicesService,
		private readonly validation: DeviceValidationService,
		private readonly configurations: VirtualThermostatConfigService,
		@Optional() private readonly writer?: ClimateAutomationWriterService,
		@Optional() private readonly deviceMappings?: DevicesTypeMapperService,
		@Optional() private readonly channelMappings?: ChannelsTypeMapperService,
		@Optional() private readonly propertyMappings?: ChannelsPropertiesTypeMapperService,
		@Optional() private readonly producers?: PropertyProducerRegistryService,
		@Optional() private readonly storage?: StorageService,
		@Optional() private readonly events?: EventEmitter2,
	) {}

	async preview(dto: CreateVirtualThermostatProducerDto): Promise<VirtualThermostatConfigurationModel> {
		return this.lock.runExclusive(async () => {
			const draft = await this.draft(this.dataSource.manager, dto);
			const revision = await this.graph.revision();
			if (dto.configuration.expectedGraphRevision !== undefined && dto.configuration.expectedGraphRevision !== revision)
				fail('Virtual dependency graph revision changed; reload and retry.');
			const prepared = await this.configurations.prepare(
				this.dataSource.manager,
				draft.dto.id,
				dto.configuration,
				draft.device,
			);
			return this.configurations.describe(prepared);
		});
	}

	async create(dto: CreateVirtualThermostatProducerDto): Promise<VirtualCreatedThermostatModel> {
		if (!this.writer) fail('The admitted thermostat creation writer is unavailable.');
		let result;
		try {
			result = await this.writer.createVirtualThermostatV1({ kind: 'create-virtual-thermostat:v1', get device() { return dto.device; }, get configuration() { return dto.configuration; } });
		} catch (error) {
			// Preserve original public validation/callback failure only after KNOWN whole rollback.
			// Core ledger/native/finalizer errors are not this callback; UNKNOWN/REFUSED/ACK errors stay exact.
			if (error instanceof ClimateAutomationWriteError && error.commitOutcome === 'rolled_back' &&
				(error.cause instanceof DevicesValidationException || (error.cause instanceof Error && this.creationCallbackFailures.has(error.cause)))) throw error.cause;
			throw error;
		}
		if (result.outcome !== 'applied') fail('Thermostat creation refused; reload and retry.');
		return plainToInstance(VirtualCreatedThermostatModel, result.result);
	}

	captureCreationMethodPins(): () => boolean {
		const holders: readonly Readonly<{ receiver: object | undefined; keys: readonly string[] }>[] = [
			{ receiver: this, keys: ['draft', 'captureCreationEnvironment', 'readCreationFacts', 'prepareCreation', 'applyCreation', 'creationRawRow', 'creationCatalog', 'holdCreationAtEntry'] },
			{ receiver: this.configurations, keys: ['prepare', 'persistCreated', 'createdPrepared', 'describeCreated', 'publishCreatedConfiguration', 'holdCreationAtEntry'] },
			{ receiver: this.devices, keys: ['create'] },
			{ receiver: this.deviceMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.channelMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.propertyMappings, keys: ['getMapping', 'captureMapping'] },
			{ receiver: this.validation, keys: ['validateDeviceStructure'] },
			{ receiver: this.lock, keys: ['runExclusive', 'runExclusiveReleased', 'runShared', 'hasCurrentStructuralLease'] },
		];
		const pins: Readonly<{ receiver: object; key: string; method: unknown }>[] = [];
		for (const { receiver, keys } of holders) {
			if (!receiver) fail('Original creation pipeline unavailable.');
			for (const key of keys) {
				if (!creationHasDataMethod(receiver, key)) fail('Original creation method unavailable.');
				const method: unknown = Reflect.get(receiver, key);
				pins.push(Object.freeze({ receiver, key, method }));
			}
		}
		return () => pins.every(({ receiver, key, method }) => creationMethodCurrent(receiver, key, method));
	}

	holdCreationAtEntry() { return this.configurations.holdCreationAtEntry(); }

	captureCreationEnvironment(): DeviceCreationEnvironment {
		const { writer, deviceMappings, channelMappings, propertyMappings, producers, storage, events } = this;
		if (!writer || !deviceMappings || !channelMappings || !propertyMappings || !producers || !storage || !events)
			fail('The original creation pipeline is unavailable.');
		const pipelineCurrent = this.captureCreationMethodPins();
		const devices = deviceMappings.captureMapping('virtual');
		const channels = channelMappings.captureMapping('virtual');
		const properties = propertyMappings.captureMapping('virtual');
		const information = DeviceCreationPublicationEngine.captureInformation(events);
		if (!devices || !channels || !properties || !information) fail('Original creation registrations are unavailable.');
		const engineKeys = ['beginCreationObservation', 'isCreationObservationCurrent', 'closeCreationObservation'];
		if (engineKeys.some((key) => !creationHasDataMethod(producers, key))) fail('Original producer observer unavailable.');
		const { beginCreationObservation: begin, isCreationObservationCurrent: observerCurrent, closeCreationObservation: close } = producers;
		const beginCall: AuthoringCall<PropertyProducerRegistryService, [readonly string[]], ReturnType<PropertyProducerRegistryService['beginCreationObservation']>> = begin;
		const observerCall: AuthoringCall<PropertyProducerRegistryService, Parameters<PropertyProducerRegistryService['isCreationObservationCurrent']>, boolean> = observerCurrent;
		const closeCall: AuthoringCall<PropertyProducerRegistryService, Parameters<PropertyProducerRegistryService['closeCreationObservation']>, void> = close;
		if (!creationHasDataMethod(storage, 'captureCreationDestinations') || !creationHasDataMethod(storage, 'areCreationDestinationsCurrent') || !creationHasDataMethod(storage, 'writeCreatedPoints')) fail('Original storage engine unavailable.');
		const { captureCreationDestinations: capture, areCreationDestinationsCurrent: destinationsCurrent, writeCreatedPoints: write } = storage;
		const captureCall: AuthoringCall<StorageService, [], ReturnType<StorageService['captureCreationDestinations']>> = capture;
		const currentCall: AuthoringCall<StorageService, Parameters<StorageService['areCreationDestinationsCurrent']>, boolean> = destinationsCurrent;
		const destinations = captureCall.call(storage);
		let observation: ReturnType<PropertyProducerRegistryService['beginCreationObservation']> | undefined;
		const identities: string[] = [];
		const { publishCreatedConfiguration: publish } = this.configurations;
		const graphGuard = this.graph.capturePublishGuard;
		let active = true;
		const current = (): boolean => active && pipelineCurrent() && devices.isCurrent() && channels.isCurrent() && properties.isCurrent() &&
			creationMethodCurrent(producers, 'beginCreationObservation', begin) && creationMethodCurrent(producers, 'isCreationObservationCurrent', observerCurrent) && creationMethodCurrent(producers, 'closeCreationObservation', close) && (observation === undefined || observerCall.call(producers, observation)) &&
			creationMethodCurrent(storage, 'captureCreationDestinations', capture) && creationMethodCurrent(storage, 'areCreationDestinationsCurrent', destinationsCurrent) && creationMethodCurrent(storage, 'writeCreatedPoints', write) && currentCall.call(storage, destinations) &&
			creationMethodCurrent(this.configurations, 'publishCreatedConfiguration', publish) && creationMethodCurrent(this.graph, 'capturePublishGuard', graphGuard) && DeviceCreationPublicationEngine.informationCurrent(information);
		return Object.freeze({ source: this.dataSource, events, information, producers, producerObservation: () => { if (!observation) fail('Original fixed observation required.'); return observation; }, identities,
			admitIdentities: (ids: readonly string[]) => {
				if (!active || observation || identities.length || !current()) fail('Creation identities already closed.');
				identities.push(...ids);
				Object.freeze(identities);
				observation = beginCall.call(producers, identities);
			},
			graphGuardSource: this.graph, destinations,
			isCurrent: current,
			mappingCurrent: (kind, mapping) => current() && (kind === 'device' ? devices.mapping === mapping : kind === 'channel' ? channels.mapping === mapping : properties.mapping === mapping),
			publishConfiguration: async (lease, plan) => {
				if (!current()) fail('Original creation publication unavailable.');
				const call: AuthoringCall<VirtualThermostatConfigService, Parameters<VirtualThermostatConfigService['publishCreatedConfiguration']>, Promise<void>> = publish;
				await call.call(this.configurations, lease, plan);
			},
			close: () => { if (!active) return; active = false; if (observation) closeCall.call(producers, observation); },
		});
	}

	/** Complete raw domain rows, not C0's absent-config shortcut or a hydrated getter projection. */
	async readCreationFacts(manager: EntityManager, turn: ClimateAutomationParticipantTurn): Promise<ClimateAutomationCreationFacts> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
		const tables: Record<string, readonly Readonly<Record<string, ClimateAutomationJson>>[]> = {};
		const names = [...new Set(this.dataSource.entityMetadatas.map((meta) => meta.tableName))].filter((name) =>
			(name.startsWith('devices_module_') || name.startsWith('devices_virtual_') || name === 'devices_shelly_ng_sample_sources' || name === 'spaces_module_spaces') &&
			!name.includes('climate_automation') && name !== 'devices_virtual_graph_revision' && name !== 'devices_module_property_value_locks').sort();
		for (const name of names) {
			this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
			if (!/^[a-z][a-z0-9_]+$/.test(name)) fail('Invalid creation metadata.');
			const rows = await manager.query<Record<string, unknown>[]>(`SELECT * FROM "${name}"`);
			this.writer.assertParticipantTurn(manager, turn, ['READ_BEFORE', 'READ_AFTER', 'FINAL_READ']);
			tables[name] = Object.freeze(rows.map((row) => {
				const owned: Record<string, ClimateAutomationJson> = {};
				for (const key of Object.keys(row).sort()) owned[key] = climateAutomationJson(row[key]);
				return Object.freeze(owned);
			}).sort((a, b) => climateAutomationCanonical(a).localeCompare(climateAutomationCanonical(b))));
		}
		return Object.freeze({ tables: Object.freeze(tables) });
	}

	async prepareCreation(manager: EntityManager, turn: ClimateAutomationParticipantTurn, request: ClimateAutomationCreationRequest, before: ClimateAutomationCreationFacts, graphRevision: number): Promise<ClimateAutomationCreationPlan> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const dto = plainToInstance(CreateVirtualThermostatProducerDto, request);
		const draft = await this.draft(manager, dto);
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const ids = new Set([draft.device.id, ...draft.device.channels.map((row) => row.id), ...draft.device.channels.flatMap((row) => row.properties.map((property) => property.id))]);
		// Retained controller data is NOT a new controller, even if catalog rows were removed.
		for (const [table, rows] of Object.entries(before.tables)) {
			if (table === 'devices_virtual_thermostat_recoveries') continue; // retained, mandatory and never rewritten
			for (const row of rows) {
				if (row.controllerId === draft.device.id || row.ownerDeviceId === draft.device.id || row.deviceId === draft.device.id || row.outputPropertyId && ids.has(String(row.outputPropertyId)))
					fail('Retained controller state prevents trusted new creation.');
			}
		}
		if (dto.configuration.expectedGraphRevision !== undefined && dto.configuration.expectedGraphRevision !== graphRevision)
			fail('Virtual dependency graph revision changed; reload and retry.');
		// Exactly ONE actual prepare; its allocated UUIDs/time/qualifications are retained below.
		const prepared = await this.configurations.prepare(manager, draft.dto.id, dto.configuration, draft.device);
		this.writer.assertParticipantTurn(manager, turn, ['NORMALIZE']);
		const createdAt = prepared.config.configuredAt.toISOString();
		const stamp = (row: DeviceEntity | ChannelEntity | ChannelPropertyEntity): void => { row.createdAt = new Date(createdAt); Reflect.set(row, 'updatedAt', null); };
		stamp(draft.device);
		for (const channel of draft.device.channels) { stamp(channel); for (const property of channel.properties) stamp(property); }
		const inserts: ClimateAutomationCreationRow[] = [];
		const add = <T extends object>(type: EntityTarget<T>, row: T): void => { inserts.push(this.creationRawRow(type, row)); };
		add(VirtualDeviceEntity, draft.device);
		for (const channel of draft.device.channels) {
			add(VirtualChannelEntity, channel);
			for (const property of channel.properties) {
				if (prepared.settings.some((setting) => setting.propertyId === property.id)) property.permissions = [PermissionType.READ_WRITE];
				add(VirtualChannelPropertyEntity, property);
				property.permissions = [PermissionType.READ_ONLY];
			}
		}
		for (const zoneId of draft.dto.zone_ids ?? []) add(DeviceZoneEntity, Object.assign(new DeviceZoneEntity(), { deviceId: draft.device.id, zoneId, createdAt: new Date(createdAt) }));
		add(VirtualThermostatConfigEntity, prepared.config);
		for (const row of prepared.sources) add(VirtualThermostatSourceEntity, row);
		for (const row of prepared.actuators) add(VirtualThermostatActuatorClaimEntity, row);
		for (const row of prepared.settings) add(VirtualThermostatSettingEntity, row);
		for (const row of prepared.protections) add(ThermostatMemberProtectionEntity, row);
		for (const row of prepared.coolingDependencies) add(ThermostatCoolingDependencyEntity, row);
		const catalog = this.creationCatalog(inserts, draft.device.id);
		const configuration = this.configurations.describeCreated(prepared, graphRevision + 1);
		const response = climateAutomationJson(instanceToPlain(Object.assign(new VirtualCreatedThermostatModel(), { device: catalog, configuration })));
		return Object.freeze({ version: 1, controllerId: draft.device.id, createdAt, outputIds: Object.freeze(draft.device.channels.flatMap((channel) => channel.properties.map((property) => property.id))),
			device: climateAutomationJson(instanceToPlain(draft.dto)), prepared: climateAutomationJson({ configuration }), inserts: Object.freeze(inserts), response });
	}

	private creationRawRow<T extends object>(type: EntityTarget<T>, entity: T): ClimateAutomationCreationRow {
		const metadata = this.dataSource.getMetadata(type);
		const columns = new Map<string, import('typeorm/metadata/ColumnMetadata').ColumnMetadata>();
		for (const item of this.dataSource.entityMetadatas) if (item.tableName === metadata.tableName) for (const column of item.columns) columns.set(column.databaseName, column);
		const row: Record<string, ClimateAutomationJson> = {};
		for (const [name, column] of columns) {
			let value: unknown = column.isDiscriminator ? metadata.discriminatorValue : column.getEntityValue(entity);
			if (value === undefined) {
				if (column.default !== undefined && typeof column.default !== 'function') value = column.default;
				else if (column.isNullable) value = null;
				else fail(`Missing retained creation column ${name}.`);
			}
			const persisted: unknown = this.dataSource.driver.preparePersistentValue(value, column);
			row[name] = climateAutomationJson(persisted);
		}
		return Object.freeze({ table: metadata.tableName, row: Object.freeze(row) });
	}

	private creationCatalog(rows: readonly ClimateAutomationCreationRow[], controllerId: string): VirtualDeviceEntity {
		const hydrate = <T extends object>(type: EntityTarget<T>, raw: Readonly<Record<string, ClimateAutomationJson>>): T => {
			const metadata = this.dataSource.getMetadata(type);
			const entity = this.dataSource.getRepository(type).create();
			for (const column of metadata.columns) column.setEntityValue(entity, this.dataSource.driver.prepareHydratedValue(raw[column.databaseName], column));
			return entity;
		};
		const deviceRows = rows.filter((item) => item.table === this.dataSource.getMetadata(VirtualDeviceEntity).tableName);
		if (deviceRows.length !== 1 || deviceRows[0].row.id !== controllerId) fail('Original creation catalog required.');
		const device = hydrate(VirtualDeviceEntity, deviceRows[0].row);
		device.channels = rows.filter((item) => item.table === this.dataSource.getMetadata(VirtualChannelEntity).tableName).map((item) => hydrate(VirtualChannelEntity, item.row));
		for (const channel of device.channels) {
			channel.device = device.id;
			channel.controls = [];
			channel.properties = rows.filter((item) => item.table === this.dataSource.getMetadata(VirtualChannelPropertyEntity).tableName && item.row.channelId === channel.id).map((item) => hydrate(VirtualChannelPropertyEntity, item.row));
			for (const property of channel.properties) { property.channel = channel.id; property.value = null; }
		}
		device.controls = [];
		device.deviceZones = rows.filter((item) => item.table === this.dataSource.getMetadata(DeviceZoneEntity).tableName).map((item) => hydrate(DeviceZoneEntity, item.row));
		return device;
	}

	async applyCreation(manager: EntityManager, turn: ClimateAutomationParticipantTurn, plan: ClimateAutomationCreationPlan, context: DeviceCreationContext): Promise<void> {
		if (!this.writer) fail('Original creation writer unavailable.');
		this.writer.assertParticipantTurn(manager, turn, ['APPLY']);
		context.assertOriginalAdmission();
		if (context.manager !== manager) fail('Original creation manager required.');
		try {
			const dto = plainToInstance(CreateVirtualDeviceDto, plan.device);
			await this.devices.create<VirtualDeviceEntity, CreateVirtualDeviceDto>(dto, context);
			context.assertOriginalAdmission();
			const prepared = this.configurations.createdPrepared(plan);
			await this.configurations.persistCreated(context, prepared);
			context.assertOriginalAdmission();
			context.fixCatalogJobs(this.creationCatalog(plan.inserts, plan.controllerId));
		} catch (cause) {
			if (cause instanceof Error) this.creationCallbackFailures.add(cause);
			throw cause;
		}
	}

	async propertyBinding(id: string): Promise<{ property: string; channel: string; device: string } | null> {
		const property = await this.dataSource.manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property?.channel;
		if (!channel || typeof channel === 'string' || typeof channel.device === 'string' || !channel.device) return null;
		return { property: property.id, channel: channel.id, device: channel.device.id };
	}

	private async draft(manager: EntityManager, request: CreateVirtualThermostatProducerDto) {
		if (!request?.device || !request.configuration)
			fail('A complete thermostat device and configuration are required.');
		const dto = plainToInstance(CreateVirtualDeviceDto, request.device);
		if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
			fail('Proposed thermostat device data are invalid.');
		if (
			!dto.id ||
			dto.type !== 'virtual' ||
			dto.category !== DeviceCategory.THERMOSTAT ||
			dto.mode !== VirtualDeviceMode.CLIMATE_CONTROLLER ||
			dto.controls?.length
		)
			fail('Thermostat creation requires an explicit climate-controller thermostat identity without controls.');
		const requiredChannels = [
			ChannelCategory.TEMPERATURE,
			ChannelCategory.THERMOSTAT,
			ChannelCategory.DEVICE_INFORMATION,
		];
		if (request.configuration.policy.heatingSetpoint !== null) requiredChannels.push(ChannelCategory.HEATER);
		if (request.configuration.policy.coolingSetpoint !== null) requiredChannels.push(ChannelCategory.COOLER);
		if (
			dto.channels?.length !== requiredChannels.length ||
			new Set(dto.channels.map((channel) => channel.category)).size !== requiredChannels.length ||
			dto.channels.some(
				(channel) =>
					!requiredChannels.includes(channel.category) || !channel.id || channel.controls?.length || channel.parent,
			)
		)
			fail('Thermostat channels must exactly match required temperature, policy, information and comfort branches.');
		const deviceFields = Object.fromEntries(
			Object.entries(dto).filter(([key]) => !['type', 'channels', 'zone_ids'].includes(key)),
		);
		const device = toInstance(VirtualDeviceEntity, deviceFields);
		device.channels = dto.channels.map((channelDto) => {
			const channelFields = Object.fromEntries(
				Object.entries(channelDto).filter(([key]) => !['type', 'properties'].includes(key)),
			);
			const channel = Object.assign(toInstance(VirtualChannelEntity, channelFields), { device });
			const expected =
				channel.category === ChannelCategory.TEMPERATURE
					? [PropertyCategory.TEMPERATURE]
					: channel.category === ChannelCategory.THERMOSTAT
						? [PropertyCategory.LOCKED]
						: channel.category === ChannelCategory.DEVICE_INFORMATION
							? [...getRequiredProperties(ChannelCategory.DEVICE_INFORMATION), PropertyCategory.STATUS]
							: [PropertyCategory.ON, PropertyCategory.TEMPERATURE, PropertyCategory.STATUS];
			if (
				channelDto.properties?.length !== expected.length ||
				new Set(channelDto.properties.map((property) => property.category)).size !== expected.length
			)
				fail(`Thermostat ${channel.category} channel must contain its exact local property template.`);
			channel.properties = channelDto.properties.map((propertyDto) => {
				const metadata = getPropertyMetadata(channel.category, propertyDto.category);
				if (
					!propertyDto.id ||
					!expected.includes(propertyDto.category) ||
					!metadata ||
					propertyDto.data_type !== metadata.data_type ||
					JSON.stringify(propertyDto.format ?? null) !== JSON.stringify(metadata.format ?? null) ||
					propertyDto.permissions?.length !== 1 ||
					propertyDto.permissions[0] !== PermissionType.READ_ONLY ||
					propertyDto.value_origin !== VirtualValueOrigin.LOCAL ||
					propertyDto.source_property ||
					propertyDto.value != null
				)
					fail(`Thermostat ${channel.category}/${propertyDto.category} must be an unseeded local readonly spec slot.`);
				const propertyFields = Object.fromEntries(Object.entries(propertyDto).filter(([key]) => key !== 'type'));
				return Object.assign(toInstance(VirtualChannelPropertyEntity, propertyFields), { channel });
			});
			return channel;
		});
		const requiredSettings = [
			{ setting: 'locked', channel: ChannelCategory.THERMOSTAT, property: PropertyCategory.LOCKED },
			...(request.configuration.policy.heatingSetpoint === null
				? []
				: [
						{ setting: 'heating_enabled', channel: ChannelCategory.HEATER, property: PropertyCategory.ON },
						{ setting: 'heating_setpoint', channel: ChannelCategory.HEATER, property: PropertyCategory.TEMPERATURE },
					]),
			...(request.configuration.policy.coolingSetpoint === null
				? []
				: [
						{ setting: 'cooling_enabled', channel: ChannelCategory.COOLER, property: PropertyCategory.ON },
						{ setting: 'cooling_setpoint', channel: ChannelCategory.COOLER, property: PropertyCategory.TEMPERATURE },
					]),
		];
		if (
			request.configuration.settings?.length !== requiredSettings.length ||
			requiredSettings.some((required) => {
				const property = device.channels
					.find((channel) => channel.category === required.channel)
					?.properties.find((entry) => entry.category === required.property);
				return (
					request.configuration.settings.filter(
						(setting) => setting.setting === required.setting && setting.propertyId === property?.id,
					).length !== 1
				);
			})
		)
			fail('Every thermostat command slot must be registered against its exact local branch property.');
		const shape = this.validation.validateDeviceStructure({
			category: dto.category,
			// The request intentionally creates command slots RO. Registration makes precisely these
			// properties RW in the same transaction; judge the committed shape without mutating the draft.
			channels: device.channels.map((channel) => ({
				category: channel.category,
				properties: channel.properties.map((property) => ({
					...property,
					permissions: request.configuration.settings.some((setting) => setting.propertyId === property.id)
						? [PermissionType.READ_WRITE]
						: property.permissions,
				})),
			})),
		});
		if (!shape.isValid || shape.issues.length)
			fail(
				`Proposed thermostat does not match its device specification: ${shape.issues.map((issue) => issue.message).join('; ')}`,
			);
		for (const [entity, ids] of [
			[DeviceEntity, [dto.id]],
			[ChannelEntity, device.channels.map((channel) => channel.id)],
			[ChannelPropertyEntity, device.channels.flatMap((channel) => channel.properties.map((property) => property.id))],
		] as const) {
			if (new Set(ids).size !== ids.length || ids.some((id) => !id))
				fail('Every catalog UUID must be explicit and distinct.');
			for (const id of ids)
				if (
					await manager.createQueryBuilder(entity, 'row').where('row.id = :id', { id }).callListeners(false).getCount()
				)
					fail(`Catalog UUID ${id} already exists.`);
		}
		if (dto.room_id) {
			const room = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id: dto.room_id })
				.callListeners(false)
				.getOne();
			if (!room || room.type !== SpaceType.ROOM) fail('Room assignment is not a room.');
		}
		for (const id of dto.zone_ids ?? []) {
			const zone = await manager
				.createQueryBuilder(SpaceEntity, 'space')
				.where('space.id = :id', { id })
				.callListeners(false)
				.getOne();
			if (
				!zone ||
				zone.type !== SpaceType.ZONE ||
				isFloorZoneCategory((zone as { category?: string | null }).category ?? null)
			)
				fail('Zone assignment is not an assignable zone.');
		}
		return { dto, device };
	}
}
