/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualThermostatClaims1000000000031 } from '../../../migrations/1000000000031-AddVirtualThermostatClaims';
import { AddVirtualThermostatRecoveries1000000000034 } from '../../../migrations/1000000000034-AddVirtualThermostatRecoveries';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { nativeVoltmeterVoltageIdentity } from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ConfigureVirtualThermostatDto } from '../dto/thermostat-config.dto';
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
	VirtualThermostatSettingEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';
import { VirtualThermostatOwnershipSubscriber } from '../subscribers/virtual-thermostat-ownership.subscriber';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import {
	ThermostatCommandAuthority,
	ThermostatInstalledQualification,
	VirtualThermostatClaimsService,
} from './virtual-thermostat-claims.service';
import { VirtualThermostatConfigService } from './virtual-thermostat-config.service';

jest.setTimeout(30_000);

describe('thermostat persistent ownership and draft configuration', () => {
	let directory: string;
	let database: SqliteDataSource;
	let second: SqliteDataSource;
	let registry: PropertyCommandAdmissionRegistryService;
	let claims: VirtualThermostatClaimsService;
	let configs: VirtualThermostatConfigService;
	let events: EventEmitter2;
	let values: PropertyValueService;
	let structure: DeviceStructureLockService;
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'vd2-thermostat-'));
		const options = {
			type: 'sqlite' as const,
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		};
		database = await new SqliteDataSource({ ...options, synchronize: true }).initialize();
		second = await new SqliteDataSource(options).initialize();
		await database.query('PRAGMA busy_timeout = 5000');
		await second.query('PRAGMA busy_timeout = 5000');
		registry = new PropertyCommandAdmissionRegistryService();
		events = new EventEmitter2();
		structure = new DeviceStructureLockService();
		const graph = new VirtualDependencyGraphService(database);
		claims = new VirtualThermostatClaimsService(database, structure, graph, registry, events);
		values = {
			write: jest.fn().mockResolvedValue(true),
			readLatest: jest.fn().mockResolvedValue(null),
		} as unknown as PropertyValueService;
		configs = new VirtualThermostatConfigService(database, structure, graph, claims, events, values);
		await claims.onApplicationBootstrap();
		await new VirtualThermostatOwnershipSubscriber(database, claims).onApplicationBootstrap();
	});
	afterEach(async () => {
		claims?.onModuleDestroy();
		if (second?.isInitialized) await second.destroy();
		if (database?.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	const owner = async () => {
		const id = uuid();
		await database.getRepository(VirtualDeviceEntity).insert({
			id,
			name: 'Thermostat',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		return id;
	};
	const ambient = async (mode?: VirtualDeviceMode) => {
		const device = uuid(),
			channel = uuid(),
			property = uuid();
		await database.getRepository(mode ? VirtualDeviceEntity : DeviceEntity).insert({
			id: device,
			name: 'Room temperature',
			category: DeviceCategory.SENSOR,
			enabled: true,
			...(mode ? { mode } : {}),
		} as never);
		await database.getRepository(mode ? VirtualChannelEntity : ChannelEntity).insert({
			id: channel,
			name: 'Temperature',
			identifier: 'temperature',
			device,
			category: ChannelCategory.TEMPERATURE,
		} as never);
		await database.getRepository(mode ? VirtualChannelPropertyEntity : ChannelPropertyEntity).insert({
			id: property,
			channel,
			identifier: 'temperature',
			category: PropertyCategory.TEMPERATURE,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			...(mode ? { valueOrigin: VirtualValueOrigin.DERIVED } : {}),
		} as never);
		return property;
	};
	const actuator = async (mac = 'A8032ABE5084') => {
		const device = uuid(),
			channel = uuid(),
			property = uuid();
		await database.getRepository(ShellyNgDeviceEntity).insert({
			id: device,
			name: '1PM',
			identifier: 'shellyplus1pm-' + mac.toLowerCase(),
			category: DeviceCategory.SWITCHER,
			enabled: true,
			canonicalMac: mac,
		});
		await database.getRepository(ShellyNgChannelEntity).insert({
			id: channel,
			name: 'Switch',
			identifier: 'switch:0',
			device,
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
	};
	const setting = async (controller: string, category: ChannelCategory, propertyCategory: PropertyCategory) => {
		const channel = uuid(),
			property = uuid();
		await database
			.getRepository(VirtualChannelEntity)
			.insert({ id: channel, name: 'Control', category, device: controller } as never);
		await database.getRepository(VirtualChannelPropertyEntity).insert({
			id: property,
			channel,
			category: propertyCategory,
			identifier: propertyCategory,
			dataType: propertyCategory === PropertyCategory.TEMPERATURE ? DataTypeType.FLOAT : DataTypeType.BOOL,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.LOCAL,
		} as never);
		return property;
	};
	const target = async (id: string, value: boolean | number): Promise<IDevicePropertyData> => {
		const property = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property.channel as ChannelEntity;
		return { property, channel, device: channel.device as DeviceEntity, value };
	};
	const dto = (sensor: string, heat: string): ConfigureVirtualThermostatDto => ({
		schemaVersion: 1,
		expectedRevision: 0,
		requestedMode: 'off',
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
		contactOpeningMs: 0,
		contactClosingMs: 0,
		sources: [{ role: 'ambient', sourcePropertyId: sensor, maximumAgeSeconds: 300 }],
		actuators: [{ role: 'heating', sourcePropertyId: heat, leaseSeconds: 30 }],
		settings: [],
	});

	it('previews without writes; OFF and absent hardware evidence retain exclusive reservation and fail energizing closed', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const input = dto(sensor, relay);
		expect((await configs.preview(controller, input)).reasons).toContain('heating_hardware_qualification_missing');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		const entry = registry.capture();
		const result = await configs.configure(controller, input);
		expect(result.readiness).toBe('draft');
		expect(result.actuators[0].state).toBe('reserved');
		expect(entry.isCurrent()).toBe(false);
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
		expect(() => claims.mintAuthority(result.actuators[0].id, 'on')).toThrow('not admitted');
		const off = claims.mintAuthority(result.actuators[0].id, 'off');
		expect(claims.isAuthorized(off, await target(relay, false))).toBe(true);
		expect(claims.isAuthorized({ ...off } as ThermostatCommandAuthority, await target(relay, false))).toBe(false);
		expect(claims.isAuthorized(off, await target(relay, true))).toBe(false);
		expect(() =>
			claims.recordQualifiedRelease(off, {
				outputConfirmedOff: true,
				pendingOnDrained: false,
				evidenceId: 'readback-only',
			}),
		).toThrow('drainage');
	});

	it('arbitrates concurrent controller creation across two SQLite connections and rolls losing config back', async () => {
		const controllerA = await owner(),
			controllerB = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const secondStructure = new DeviceStructureLockService(),
			secondGraph = new VirtualDependencyGraphService(second);
		const secondClaims = new VirtualThermostatClaimsService(
			second,
			secondStructure,
			secondGraph,
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		const secondConfigs = new VirtualThermostatConfigService(
			second,
			secondStructure,
			secondGraph,
			secondClaims,
			new EventEmitter2(),
			values,
		);
		const outcomes = await Promise.allSettled([
			configs.configure(controllerA, dto(sensor, relay)),
			secondConfigs.configure(controllerB, dto(sensor, relay)),
		]);
		expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(await database.manager.count(VirtualThermostatConfigEntity)).toBe(1);
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
	});

	it('merged single-bound setpoint validation rolls back configuration and local value writes', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			heat = await actuator(),
			cool = await actuator('A8032ABE5085');
		const heatSetting = await setting(controller, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE);
		const input = dto(sensor, heat);
		input.policy.coolingSetpoint = 24;
		input.actuators.push({ role: 'cooling', sourcePropertyId: cool, leaseSeconds: 30 });
		input.settings = [{ propertyId: heatSetting, setting: 'heating_setpoint' }];
		await configs.configure(controller, input);
		expect((await target(heatSetting, 22)).property.permissions).toEqual([PermissionType.READ_WRITE]);
		(values.write as jest.Mock).mockClear();
		await expect(configs.command([await target(heatSetting, 23)])).rejects.toThrow('overlapping_setpoints');
		expect((await configs.get(controller)).policy.heatingSetpoint).toBe(20);
		expect(values.write).not.toHaveBeenCalled();
		await expect(configs.command([await target(heatSetting, 22)])).resolves.toBe(true);
		expect((await configs.get(controller)).policy.heatingSetpoint).toBe(22);
		expect(values.write).toHaveBeenCalledTimes(1);
	});

	it('registers only matching local settings and never authorizes arbitrary owned writers', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const arbitrary = await setting(controller, ChannelCategory.THERMOSTAT, PropertyCategory.ON);
		const input = dto(sensor, relay);
		input.settings = [{ propertyId: arbitrary, setting: 'heating_enabled' }];
		await expect(configs.configure(controller, input)).rejects.toThrow('matching its thermostat role');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(0);
		expect(await database.manager.count(VirtualThermostatSettingEntity)).toBe(0);
		await expect(configs.command([await target(arbitrary, true)])).rejects.toThrow('registered');
	});

	it('retains missing physical identity and unresolved claims after source deletion; remap never promotes a successor', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		const original = await configs.configure(controller, dto(sensor, relay));
		const claim = original.actuators[0];
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: relay });
		claims.invalidate();
		await claims.refresh();
		const missing = (await configs.get(controller)).actuators[0];
		expect(missing.source_property).toBeNull();
		expect(missing.physical_identity).toBe(claim.physical_identity);
		expect(missing.source_identity).toBe(relay);
		const replacement = uuid();
		const channel = await database.manager.findOneByOrFail(ShellyNgChannelEntity, { identifier: 'switch:0' });
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: replacement,
			channel: channel.id,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const input = dto(sensor, replacement);
		input.expectedRevision = 1;
		await expect(configs.configure(controller, input)).rejects.toThrow('release');
		await expect(registry.assertAllowed(await target(replacement, true))).rejects.toThrow('reserved');
	});

	it('restores only the same canonical missing endpoint with CAS, audit and fresh qualification', async () => {
		const controller = await owner();
		const sensor = await ambient();
		const oldProperty = await actuator();
		const configured = await configs.configure(controller, dto(sensor, oldProperty));
		const oldClaim = configured.actuators[0];
		const priorQualification: ThermostatInstalledQualification = {
			physicalIdentity: oldClaim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'qualified-test-firmware',
				componentId: 0,
				evidenceId: 'prior-installation',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		};
		claims.recordQualification(priorQualification);
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: oldProperty });
		await claims.refresh();
		const old = await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: oldClaim.id });
		expect(old.sourcePropertyId).toBeNull();
		const channel = await database.manager.findOneByOrFail(ShellyNgChannelEntity, { identifier: 'switch:0' });
		const replacement = uuid();
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: replacement,
			channel: channel.id,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		const restore = {
			expectedRevision: configured.revision,
			expectedClaimRevision: old.revision,
			physicalIdentity: old.physicalIdentity,
			sourcePropertyId: replacement,
			reason: 'Rediscovered the same physical relay after database endpoint loss',
			disconnectionAcknowledged: true as const,
		};
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, expectedClaimRevision: 999 }, 'operator'),
		).rejects.toThrow('revision');
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, physicalIdentity: 'different' }, 'operator'),
		).rejects.toThrow('canonical');
		const foreign = await actuator('A8032ABE5085');
		await expect(
			configs.restoreActuator(controller, old.id, { ...restore, sourcePropertyId: foreign }, 'operator'),
		).rejects.toThrow('same canonical');
		const restored = await configs.restoreActuator(controller, old.id, restore, 'operator');
		expect(restored.requested_mode).toBe('off');
		expect(restored.actuators[0]).toMatchObject({
			id: old.id,
			state: 'reserved',
			source_property: replacement,
			physical_identity: old.physicalIdentity,
			revision: old.revision + 1,
		});
		expect(
			claims.qualification(
				await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: old.id }),
				false,
			),
		).toBeNull();
		await expect(registry.assertAllowed(await target(replacement, true))).rejects.toThrow('reserved');
		const audit = await database.manager.findOneByOrFail(VirtualThermostatRecoveryEntity, { claimId: old.id });
		expect(audit).toMatchObject({
			actorId: 'operator',
			previousPropertyIdentity: oldProperty,
			restoredPropertyId: replacement,
			disconnectionAcknowledged: true,
		});
		await expect(configs.restoreActuator(controller, old.id, restore, 'operator')).rejects.toThrow('revision');
		const restarted = new VirtualThermostatClaimsService(
			second,
			new DeviceStructureLockService(),
			new VirtualDependencyGraphService(second),
			new PropertyCommandAdmissionRegistryService(),
			new EventEmitter2(),
		);
		await restarted.refresh();
		const restoredClaim = await second.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: old.id });
		restarted.recordQualification(priorQualification);
		expect(restarted.qualification(restoredClaim, false)).toBeNull();
		restarted.recordQualification({
			...priorQualification,
			qualificationGeneration: restoredClaim.qualificationGeneration,
			profile: { ...priorQualification.profile, evidenceId: 'new-installation' },
		});
		expect(restarted.qualification(restoredClaim, false)?.profile.evidenceId).toBe('new-installation');
		const restoredTarget = await target(replacement, true);
		expect(() => restarted.assertAllowed(restoredTarget)).toThrow('reserved');
		await expect(second.manager.countBy(VirtualThermostatRecoveryEntity, { claimId: old.id })).resolves.toBe(1);
	});

	it('revokes queued ON sends at restore entry and keeps them revoked after rollback or commit', async () => {
		const controller = await owner();
		const sensor = await ambient();
		const relay = await actuator();
		const input = dto(sensor, relay);
		input.requestedMode = 'heat';
		const configured = await configs.configure(controller, input);
		const claim = configured.actuators[0];
		claims.recordQualification({
			physicalIdentity: claim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'qualified-test-firmware',
				componentId: 0,
				evidenceId: 'prior-installation',
				revision: 1,
				testedLeaseSeconds: { min: 1, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		const alternateProperty = await actuator('A8032ABE5086');
		await expect(
			configs.restoreActuator(
				controller,
				claim.id,
				{
					expectedRevision: configured.revision,
					expectedClaimRevision: claim.revision,
					physicalIdentity: claim.physical_identity,
					sourcePropertyId: alternateProperty,
					reason: 'The old endpoint was disconnected and must be restored',
					disconnectionAcknowledged: true,
				},
				'operator',
			),
		).rejects.toThrow('retained alias reservation');
		const stop = claims.registerRuntimeAdmission(() => true);
		const relayTarget = await target(relay, true);
		const restore = {
			expectedRevision: configured.revision,
			expectedClaimRevision: claim.revision,
			physicalIdentity: claim.physical_identity,
			sourcePropertyId: relay,
			reason: 'The relay was disconnected and has returned under the same endpoint',
			disconnectionAcknowledged: true as const,
		};
		const pendingOn = claims.mintAuthority(claim.id, 'on');
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(true);
		let releaseReader!: () => void;
		let readerEntered!: () => void;
		const readerGate = new Promise<void>((resolve) => (releaseReader = resolve));
		const readerStarted = new Promise<void>((resolve) => (readerEntered = resolve));
		const reader = structure.runShared(async () => {
			readerEntered();
			await readerGate;
		});
		await readerStarted;
		const failedRestore = configs.restoreActuator(
			controller,
			claim.id,
			{ ...restore, expectedClaimRevision: claim.revision + 1 },
			'operator',
		);
		let guardedSends = 0;
		if (claims.isAuthorized(pendingOn, relayTarget)) guardedSends++;
		expect(guardedSends).toBe(0);
		await claims.refresh();
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		releaseReader();
		await reader;
		await expect(failedRestore).rejects.toThrow('revision');
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		const nextOn = claims.mintAuthority(claim.id, 'on');
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(true);
		const secondReaderGate = new Promise<void>((resolve) => (releaseReader = resolve));
		const secondReaderStarted = new Promise<void>((resolve) => (readerEntered = resolve));
		const secondReader = structure.runShared(async () => {
			readerEntered();
			await secondReaderGate;
		});
		await secondReaderStarted;
		const restorePromise = configs.restoreActuator(controller, claim.id, restore, 'operator');
		if (claims.isAuthorized(nextOn, relayTarget)) guardedSends++;
		expect(guardedSends).toBe(0);
		await claims.refresh();
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		releaseReader();
		await secondReader;
		const restored = await restorePromise;
		expect(restored.requested_mode).toBe('off');
		expect(claims.isAuthorized(pendingOn, relayTarget)).toBe(false);
		expect(claims.isAuthorized(nextOn, relayTarget)).toBe(false);
		expect(() => claims.mintAuthority(claim.id, 'on')).toThrow('not admitted');
		stop();
	});

	it('disabled owners demand release and keep reservations; removal requires explicit qualified proof', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const device = await database.manager.findOneByOrFail(VirtualDeviceEntity, { id: controller });
		device.enabled = false;
		await database.manager.save(device);
		await claims.refresh();
		const claim = (await configs.get(controller)).actuators[0];
		expect(claim.state).toBe('releasing');
		const off = claims.mintAuthority(claim.id, 'off');
		expect(claims.isAuthorized(off, await target(relay, false))).toBe(true);
		await expect(database.manager.remove(device)).rejects.toThrow('reserved');
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
	});

	it('refuses detach while release is pending and does not infer proof from user OFF', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const release = await configs.requestRelease(controller, 1);
		expect(release.actuators[0].state).toBe('releasing');
		expect(await database.manager.count(VirtualThermostatActuatorClaimEntity)).toBe(1);
		await expect(
			claims.completeRelease({
				claimId: release.actuators[0].id,
				revision: release.actuators[0].revision,
				evidenceId: 'forged',
			}),
		).rejects.toThrow('Internal release proof');
		await expect(configs.requestRelease(controller, 1)).rejects.toThrow('revision');
	});

	it('accepts ambient aggregate and independent heuristic without physical contacts; rejects derived floor role', async () => {
		const controller = await owner(),
			sensor = await ambient(VirtualDeviceMode.SENSOR_AGGREGATE),
			relay = await actuator();
		const input = dto(sensor, relay);
		input.heuristic = {
			sampleWindowMs: 60000,
			minimumSamples: 3,
			minimumSpanMs: 10000,
			maximumSampleAgeMs: 10000,
			slopeThresholdCPerMinute: 1,
			confirmationMs: 5000,
			recoveryMs: 10000,
			maximumPauseMs: 300000,
			cooldownMs: 10000,
		};
		await expect(configs.configure(controller, input)).resolves.toMatchObject({ readiness: 'draft' });
		input.expectedRevision = 1;
		input.policy.floor = { limit: 30, recoveryHysteresis: 1 };
		input.sources.push({ role: 'floor', sourcePropertyId: sensor, maximumAgeSeconds: 300 });
		await expect(configs.configure(controller, input)).rejects.toThrow('Temperature roles');
	});

	it('SQL guards refuse bulk deletion, metadata changes and relation moves before commit and revoke old admission', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const source = await target(relay, false);
		const other = await target(sensor, false);
		const entry = registry.capture();
		await expect(
			database.getRepository(ChannelPropertyEntity).update(relay, { permissions: [PermissionType.READ_ONLY] }),
		).rejects.toThrow('reserved');
		expect(entry.isCurrent()).toBe(false);
		await expect(database.getRepository(ChannelPropertyEntity).delete(relay)).rejects.toThrow('reserved');
		await expect(
			database.createQueryBuilder().delete().from(ChannelEntity).where('id = :id', { id: source.channel.id }).execute(),
		).rejects.toThrow('reserved');
		await expect(database.getRepository(DeviceEntity).delete(source.device.id)).rejects.toThrow('reserved');
		await expect(
			database.getRepository(ChannelEntity).update(source.channel.id, { device: other.device.id }),
		).rejects.toThrow('reserved');
		await expect(
			database.getRepository(ChannelPropertyEntity).update(relay, { channel: other.channel.id }),
		).rejects.toThrow('reserved');
		source.channel.device = other.device;
		await expect(database.manager.save(source.channel)).rejects.toThrow(/reserved/i);
		const fresh = await target(relay, false);
		expect(fresh.device.id).toBe(source.device.id);
		await expect(registry.assertAllowed(fresh)).rejects.toThrow('reserved');
	});

	it('bulk disable atomically requests release; rollback recovers ownership readiness without reviving old ON authority', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const original = (await configs.get(controller)).actuators[0];
		const authority = claims.mintAuthority(original.id, 'off');
		const snapshot = registry.capture();
		await expect(
			database.transaction(async (manager) => {
				await manager.update(DeviceEntity, { id: controller }, { enabled: false });
				throw new Error('rollback fixture');
			}),
		).rejects.toThrow('rollback fixture');
		expect(snapshot.isCurrent()).toBe(false);
		expect(claims.isAuthorized(authority, await target(relay, false))).toBe(false);
		expect((await configs.get(controller)).actuators[0].state).toBe('reserved');
		expect(claims.isAuthorized(claims.mintAuthority(original.id, 'off'), await target(relay, false))).toBe(true);
		await database.manager.update(DeviceEntity, { id: controller }, { enabled: false });
		expect((await configs.get(controller)).actuators[0].state).toBe('releasing');
		expect((await configs.get(controller)).actuators[0].revision).toBe(original.revision + 1);
		await expect(registry.assertAllowed(await target(relay, false))).rejects.toThrow('reserved');
	});

	it('admits converted qualified volts as a floor while rejecting direct volts and tracking conversion revision', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			transformedFloor = await ambient(VirtualDeviceMode.SENSOR_TRANSFORM),
			relay = await actuator();
		const nativeFloor = uuid(),
			nativeChannel = uuid(),
			nativeDevice = uuid();
		const voltage = nativeVoltmeterVoltageIdentity(
			'voltmeter:100',
			{ id: 100, range: 0, report_thr: 0.1, xvoltage: { expr: null, unit: null } },
			{ voltmeter: { 'voltmeter:100': {} } },
			'A8032ABE5085',
		);
		await database.manager.insert(ShellyNgDeviceEntity, {
			id: nativeDevice,
			name: 'Voltmeter',
			category: DeviceCategory.SENSOR,
			canonicalMac: 'A8032ABE5085',
		} as never);
		await database.manager.insert(ShellyNgChannelEntity, {
			id: nativeChannel,
			name: 'Raw voltage',
			identifier: voltage.channelIdentifier,
			category: ChannelCategory.ANALOG_INPUT,
			device: nativeDevice,
		} as never);
		await database.manager.insert(ShellyNgChannelPropertyEntity, {
			id: nativeFloor,
			channel: nativeChannel,
			identifier: 'voltage',
			category: PropertyCategory.VALUE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		} as never);
		const physical = await database.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: nativeFloor },
			relations: ['channel', 'channel.device'],
		});
		expect(resolvePropertyUnit(physical)).toBe('V');
		await database.manager.insert(VirtualTransformConfigEntity, {
			outputPropertyId: transformedFloor,
			schemaVersion: 1,
			revision: 3,
			maximumAgeSeconds: 300,
			quantity: 'temperature',
			unit: '°C',
			configuredAt: new Date(),
			policy: {
				operator: VirtualNumericTransformOperator.STEINHART_HART,
				inputRange: { minimum: 0, maximum: 10 },
				outputRange: { minimum: -100, maximum: 150 },
				referenceVoltage: 10,
				seriesResistance: 10_000,
				coefficientA: 0.0010351024725298568,
				coefficientB: 0.0002338353574079741,
				coefficientC: 7.917851073336009e-8,
				thermistorLeg: 'low',
			},
		});
		await database.manager.insert(VirtualTransformSourceEntity, {
			id: uuid(),
			outputPropertyId: transformedFloor,
			sourcePropertyId: nativeFloor,
			sourcePropertyIdentity: nativeFloor,
			quantity: 'value',
			unit: 'V',
		});
		const input = dto(sensor, relay);
		input.policy.floor = { limit: 30, recoveryHysteresis: 1 };
		input.sources.push({ role: 'floor', sourcePropertyId: nativeFloor, maximumAgeSeconds: 300 });
		await expect(configs.preview(controller, input)).rejects.toThrow('Temperature roles');
		input.sources.pop();
		input.sources.push({ role: 'floor', sourcePropertyId: transformedFloor, maximumAgeSeconds: 300 });
		const configured = await configs.configure(controller, input);
		const floor = configured.sources.find((source) => source.role === 'floor');
		expect(floor.physical_identity).toBe('property:' + nativeFloor);
		expect(floor.source_identity).toBe(transformedFloor);
		await database.manager.update(
			VirtualTransformConfigEntity,
			{ outputPropertyId: transformedFloor },
			{ revision: 4 },
		);
		input.expectedRevision = 1;
		const revised = await configs.preview(controller, input);
		expect(revised.sources.find((source) => source.role === 'floor').contract_fingerprint).not.toBe(
			floor.contract_fingerprint,
		);
	});

	it('only an internal qualified OFF and drained-ON proof frees a releasing reservation', async () => {
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		const pending = await configs.requestRelease(controller, 1);
		const claim = pending.actuators[0];
		claims.recordQualification({
			physicalIdentity: claim.physical_identity,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'shellyplus1pm-a8032abe5084',
				model: 'SNSW-001P16EU',
				firmware: 'fixture-firmware',
				componentId: 0,
				evidenceId: 'fixture-installed-profile',
				revision: 1,
				testedLeaseSeconds: { min: 10, max: 60 },
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
			},
		});
		const off = claims.mintAuthority(claim.id, 'off');
		expect(() =>
			claims.recordQualifiedRelease(off, {
				outputConfirmedOff: true,
				pendingOnDrained: false,
				evidenceId: 'unrelated-readback',
			}),
		).toThrow('drainage');
		const proof = claims.recordQualifiedRelease(off, {
			outputConfirmedOff: true,
			pendingOnDrained: true,
			evidenceId: 'fixture-ordered-release',
		});
		await claims.completeRelease(proof);
		await expect(registry.assertAllowed(await target(relay, true))).resolves.toBeUndefined();
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).releaseEvidence,
		).toMatchObject({ pendingOnDrained: true });
	});

	it('migration matches synchronized reservation constraints and stable SET NULL foreign keys', async () => {
		const runner = database.createQueryRunner();
		await runner.dropTable('devices_virtual_thermostat_recoveries');
		for (const table of [
			'devices_virtual_thermostat_settings',
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_sources',
			'devices_virtual_thermostat_configs',
		])
			await runner.dropTable(table);
		const migration = new AddVirtualThermostatClaims1000000000031();
		await migration.up(runner);
		const recoveryMigration = new AddVirtualThermostatRecoveries1000000000034();
		await recoveryMigration.up(runner);
		const indexes = await runner.query('PRAGMA index_list("devices_virtual_thermostat_actuator_claims")');
		expect(indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'UQ_virtual_thermostat_physical_reservation', unique: 1, partial: 1 }),
			]),
		);
		const controller = await owner(),
			sensor = await ambient(),
			relay = await actuator();
		await configs.configure(controller, dto(sensor, relay));
		await database.query('DROP TRIGGER "virtual_thermostat_property_delete"');
		await database.manager.delete(ChannelPropertyEntity, { id: relay });
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { controllerId: controller }))
				.sourcePropertyId,
		).toBeNull();
		await recoveryMigration.down(runner);
		await migration.down(runner);
		await runner.release();
	});
});
