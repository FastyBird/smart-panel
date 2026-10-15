import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createProtectionProbe, memberInstallationSetup } from '../../../../test/support/thermostat-protection-fixture';
import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddThermostatInstallationProfiles1000000000033 } from '../../../migrations/1000000000033-AddThermostatInstallationProfiles';
import { AddThermostatMemberProtection1000000000041 } from '../../../migrations/1000000000041-AddThermostatMemberProtection';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellySampleSourceEntity } from '../../devices-shelly-ng/entities/shelly-sample-source.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { ShellyGuardRpcSession } from '../../devices-shelly-ng/services/shelly-guard-rpc-session';
import {
	ThermostatInstallationAuditEntity,
	ThermostatInstallationEntity,
} from '../entities/thermostat-installation.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatBranchRuntimeEntity,
	VirtualThermostatCommandEntity,
} from '../entities/virtual-thermostat-runtime.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSourceEntity,
} from '../entities/virtual-thermostat.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

import { validateThermostatInstallation } from './thermostat-installation-artifact';
import { ThermostatInstallationBindingsService } from './thermostat-installation-bindings.service';
import { ThermostatInstallationLoaderService } from './thermostat-installation-loader.service';
import { ThermostatInstallationService } from './thermostat-installation.service';
import { THERMOSTAT_ATTESTATION_KINDS, ThermostatGuardSetup } from './thermostat-installation.types';
import { ThermostatMemberProtectionService } from './thermostat-member-protection.service';
import { resolveThermostatProtectionSource } from './thermostat-protection-source.utils';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';

jest.setTimeout(30000);
describe('durable thermostat installation profiles', () => {
	let db: DataSource,
		directory: string,
		claims: VirtualThermostatClaimsService,
		profiles: ThermostatInstallationService,
		loader: ThermostatInstallationLoaderService,
		events: EventEmitter2,
		setup: ThermostatGuardSetup,
		claim: VirtualThermostatActuatorClaimEntity,
		current: boolean,
		inspect: jest.Mock,
		bindings: ThermostatInstallationBindingsService,
		lock: DeviceStructureLockService;
	const runtime = { request: jest.fn() } as unknown as VirtualThermostatRuntimeService;
	const attestations = () =>
		THERMOSTAT_ATTESTATION_KINDS.filter((kind) => kind !== 'opposed_interlock').map((kind) => ({
			kind,
			equipment: 'offline fixture',
			procedure: 'qualified operator fixture only',
			evidenceReference: 'fixture:' + kind,
			testedAt: '2026-01-01T00:00:00Z',
			...(kind === 'local_execution_bounds' ? { maximumObservedMs: 50 } : {}),
		}));
	/** A distinct physical relay/controller using the same offline native-floor contract. */
	const additionalInstallation = async (suffix: number) => {
		const original = await bindings.resolve(db.manager, claim.id);
		const deviceId = uuid(),
			switchChannel = uuid(),
			propertyId = uuid(),
			floorChannel = uuid(),
			floorProperty = uuid();
		const controllerId = uuid();
		const hardwareId = `fixture-hardware-${suffix}`;
		await db.manager.insert(ShellyNgDeviceEntity, {
			id: deviceId,
			identifier: hardwareId,
			name: `1PM fixture ${suffix}`,
			enabled: true,
			canonicalMac: `00000000000${suffix}`,
			category: DeviceCategory.SWITCHER,
		});
		await db.manager.insert(ShellyNgChannelEntity, {
			id: switchChannel,
			identifier: 'switch:0',
			name: 'Switch',
			category: ChannelCategory.SWITCHER,
			device: deviceId,
		} as never);
		await db.manager.insert(ShellyNgChannelPropertyEntity, {
			id: propertyId,
			identifier: 'output',
			channel: switchChannel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		await db.manager.insert(ShellyNgChannelEntity, {
			id: floorChannel,
			identifier: (original.floorLeaf.channel as ChannelEntity).identifier,
			name: 'Floor',
			category: ChannelCategory.TEMPERATURE,
			device: deviceId,
		} as never);
		await db.manager.insert(ShellyNgChannelPropertyEntity, {
			id: floorProperty,
			identifier: 'tC',
			channel: floorChannel,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		await db.manager.insert(VirtualThermostatConfigEntity, { ...original.config, controllerId });
		const leaf = await db.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: propertyId },
			relations: ['channel', 'channel.device'],
		});
		const channel = leaf.channel as ChannelEntity,
			device = channel.device as ShellyNgDeviceEntity;
		const added = await db.manager.save(
			VirtualThermostatActuatorClaimEntity,
			db.manager.create(VirtualThermostatActuatorClaimEntity, {
				...claim,
				id: uuid(),
				controllerId,
				sourcePropertyId: propertyId,
				sourcePropertyIdentity: propertyId,
				sourceDeviceId: deviceId,
				sourceDeviceIdentity: deviceId,
				physicalIdentity: thermostatActuatorIdentity(leaf, channel, device),
				contractFingerprint: thermostatPropertyContract(leaf, channel, device),
			}),
		);
		await db.manager.insert(VirtualThermostatSourceEntity, {
			controllerId,
			role: 'floor',
			sourcePropertyId: floorProperty,
			sourcePropertyIdentity: floorProperty,
			physicalIdentity: floorProperty,
			contractFingerprint: 'fixture',
			maximumAgeSeconds: 5,
		});
		await profiles.stage(added.id, 0, { ...setup, deviceHardwareId: hardwareId }, attestations(), 'operator');
		return added;
	};
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'thermostat-installation-'));
		db = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'db.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		lock = new DeviceStructureLockService();
		events = new EventEmitter2();
		bindings = new ThermostatInstallationBindingsService();
		claims = new VirtualThermostatClaimsService(
			db,
			lock,
			new VirtualDependencyGraphService(db),
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		profiles = new ThermostatInstallationService(db, lock, bindings, claims, runtime);
		const device = uuid(),
			channel = uuid(),
			property = uuid(),
			floorChannel = uuid(),
			floorProperty = uuid(),
			controllerId = uuid();
		await db.manager.insert(ShellyNgDeviceEntity, {
			id: device,
			identifier: 'fixture-hardware',
			name: '1PM fixture',
			enabled: true,
			canonicalMac: '000000000001',
			category: DeviceCategory.SWITCHER,
		});
		await db.manager.insert(ShellyNgChannelEntity, {
			id: channel,
			identifier: 'switch:0',
			name: 'Switch',
			category: ChannelCategory.SWITCHER,
			device,
		} as never);
		await db.manager.insert(ShellyNgChannelPropertyEntity, {
			id: property,
			identifier: 'output',
			channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		} as never);
		setup = {
			deviceHardwareId: 'fixture-hardware',
			firmware: 'fixture-only-1.7.5',
			endpointHostname: '127.0.0.1',
			scriptId: 2,
			epochKey: 'fixture-epoch',
			heatingSetpointRange: { minimum: 15, maximum: 25 },
			coolingSetpointRange: null,
			minimumLeaseSeconds: 1,
			maximumLeaseSeconds: 30,
			watchdogMs: 100,
			floorMaximumAgeMs: 5000,
			floorComponentType: 'temperature',
			floorComponentId: 100,
			floorAttribute: 'tC',
			floorConfigurationJson: JSON.stringify({ id: 100, offset_C: 0, report_thr_C: 0.1 }),
			switchConfigurationJson: JSON.stringify({ id: 0, initial_state: 'off', in_locked: true, auto_on: false }),
			peripheralsJson: JSON.stringify({ ds18b20: { 'temperature:100': { addr: 'fixture-probe' } } }),
		};
		const identity = nativeTemperatureIdentity(
			'temperature:100',
			JSON.parse(setup.floorConfigurationJson) as Record<string, unknown>,
			JSON.parse(setup.peripheralsJson) as Record<string, unknown>,
		);
		await db.manager.insert(ShellyNgChannelEntity, {
			id: floorChannel,
			identifier: identity.channelIdentifier,
			name: 'Floor',
			category: ChannelCategory.TEMPERATURE,
			device,
		} as never);
		await db.manager.insert(ShellyNgChannelPropertyEntity, {
			id: floorProperty,
			identifier: 'tC',
			channel: floorChannel,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			unit: '°C',
			permissions: [PermissionType.READ_ONLY],
		} as never);
		await db.manager.insert(VirtualThermostatConfigEntity, {
			controllerId,
			revision: 1,
			requestedMode: 'off',
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(),
			policy: {
				heatingSetpoint: 20,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 0,
				changeoverMs: 0,
				floor: { limit: 30, recoveryHysteresis: 2 },
			},
		});
		const leaf = await db.manager.findOneOrFail(ChannelPropertyEntity, {
			where: { id: property },
			relations: ['channel', 'channel.device'],
		});
		const ch = leaf.channel as ChannelEntity,
			dev = ch.device as ShellyNgDeviceEntity;
		claim = await db.manager.save(
			VirtualThermostatActuatorClaimEntity,
			db.manager.create(VirtualThermostatActuatorClaimEntity, {
				controllerId,
				role: 'heating',
				sourcePropertyId: property,
				sourcePropertyIdentity: property,
				sourceDeviceId: device,
				sourceDeviceIdentity: device,
				physicalIdentity: thermostatActuatorIdentity(leaf, ch, dev),
				contractFingerprint: thermostatPropertyContract(leaf, ch, dev),
				revision: 1,
				state: 'reserved',
				leaseSeconds: 10,
			}),
		);
		await db.manager.insert(VirtualThermostatSourceEntity, {
			controllerId,
			role: 'floor',
			sourcePropertyId: floorProperty,
			sourcePropertyIdentity: floorProperty,
			physicalIdentity: floorProperty,
			contractFingerprint: 'fixture',
			maximumAgeSeconds: 5,
		});
		await claims.onApplicationBootstrap();
		current = true;
		inspect = jest
			.fn()
			.mockImplementation((_metadata: unknown, _timeout: number, admitted: () => boolean) =>
				Promise.resolve({ isCurrent: () => current && admitted() }),
			);
		const platform = Object.create(ShellyNgDevicePlatform.prototype) as ShellyNgDevicePlatform;
		platform.prepareGuardRpcSession = () => ({ inspectInstallation: inspect }) as unknown as ShellyGuardRpcSession;
		loader = new ThermostatInstallationLoaderService(
			db,
			bindings,
			profiles,
			claims,
			{ get: () => platform } as unknown as PlatformRegistryService,
			lock,
			runtime,
			events,
		);
	});
	afterEach(async () => {
		loader.onModuleDestroy();
		claims.onModuleDestroy();
		jest.restoreAllMocks();
		jest.useRealTimers();
		await db.destroy();
		await rm(directory, { recursive: true, force: true });
	});
	it('rejects stale authoring configuration, claim and recovery generation without creating a staged record', async () => {
		const binding = await bindings.resolve(db.manager, claim.id);
		const currentFence = {
			configurationRevision: binding.config.revision,
			claimRevision: binding.claim.revision,
			qualificationGeneration: binding.claim.qualificationGeneration,
		};
		for (const stale of [
			{ ...currentFence, configurationRevision: currentFence.configurationRevision + 1 },
			{ ...currentFence, claimRevision: currentFence.claimRevision + 1 },
			{ ...currentFence, qualificationGeneration: 'stale-generation' },
		]) {
			await expect(profiles.stage(claim.id, 0, setup, attestations(), 'operator', stale)).rejects.toThrow(
				'generation changed',
			);
			expect(await db.manager.count(ThermostatInstallationEntity)).toBe(0);
		}
		await profiles.stage(claim.id, 0, setup, [], 'operator', currentFence);
		expect((await profiles.inspect(claim.id)).revision).toBe(1);
	});

	it('persists explicit attestation separately and restarts without trusting old observations', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		expect(claims.qualification(claim, false)).not.toBeNull();
		expect((await profiles.inspect(claim.id)).machine_observation.physicalSafetyCertified).toBe(false);
		loader.onModuleDestroy();
		claims.onModuleDestroy();
		await db.destroy();
		db = await new SqliteDataSource({
			type: 'sqlite',
			database: join(directory, 'db.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		}).initialize();
		claims = new VirtualThermostatClaimsService(
			db,
			lock,
			new VirtualDependencyGraphService(db),
			new PropertyCommandAdmissionRegistryService(),
			events,
		);
		await claims.onApplicationBootstrap();
		profiles = new ThermostatInstallationService(db, lock, bindings, claims, runtime);
		current = false;
		const restarted = new ThermostatInstallationLoaderService(
			db,
			bindings,
			profiles,
			claims,
			{ get: () => null } as unknown as PlatformRegistryService,
			lock,
			runtime,
			events,
		);
		await restarted.onApplicationBootstrap();
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).operator_attestations).toHaveLength(6);
		expect((await profiles.inspect(claim.id)).reasons).toContain('current_machine_verification_missing');
		restarted.onModuleDestroy();
	});
	it('CAS permits only one concurrent revision and audits the accepted author', async () => {
		const result = await Promise.allSettled([
			profiles.stage(claim.id, 0, setup, attestations(), 'first'),
			profiles.stage(claim.id, 0, setup, attestations(), 'second'),
		]);
		expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
		expect(result.find((item) => item.status === 'rejected').reason).toBeInstanceOf(ConflictException);
		expect(await db.manager.count(ThermostatInstallationAuditEntity)).toBe(1);
	});
	it('staging replacement and revocation invalidate captured machine eligibility before DB commit', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.onApplicationBootstrap();
		await loader.verify(claim.id, 1, 'operator');
		const old = claims.qualification(claim, false);
		expect(old.machineLeaseIsCurrent()).toBe(true);
		await profiles.stage(claim.id, 1, { ...setup, epochKey: 'new-epoch' }, attestations(), 'operator');
		expect(old.machineLeaseIsCurrent()).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
		await profiles.revoke(claim.id, 2, 'operator');
		await loader.verify(claim.id, 3, 'operator');
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).reasons).toContain('installation_revoked');
	});
	it('never lets delayed metadata complete after profile replacement', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		let finish: (value: { isCurrent: () => boolean }) => void;
		inspect.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const verification = loader.verify(claim.id, 1, 'operator');
		while (!finish) await new Promise<void>((resolve) => setImmediate(resolve));
		await profiles.stage(claim.id, 1, { ...setup, epochKey: 'replacement' }, attestations(), 'operator');
		finish({ isCurrent: () => true });
		await verification;
		expect(claims.qualification(claim, false)).toBeNull();
		expect(
			(await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id })).lastMachineObservation,
		).toBeNull();
	});
	it('invalidates on connection epoch and refuses changed calibration/contracts', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.onApplicationBootstrap();
		await loader.verify(claim.id, 1, 'operator');
		const old = claims.qualification(claim, false);
		current = false;
		events.emit(EventType.DEVICE_CONNECTION_CHANGED);
		expect(old.machineLeaseIsCurrent()).toBe(false);
		await db.manager.update(VirtualThermostatConfigEntity, { controllerId: claim.controllerId }, { revision: 2 });
		await loader.verify(claim.id, 1, 'operator');
		expect(claims.qualification(claim, false)).toBeNull();
	});
	it('missing human evidence remains blocked and cannot accept public qualified or drain fields', async () => {
		await profiles.stage(claim.id, 0, setup, [], 'operator');
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
		expect(claims.qualification(claim, false)).toBeNull();
		await expect(
			profiles.stage(claim.id, 1, { ...setup, qualified: true } as ThermostatGuardSetup, attestations(), 'operator'),
		).rejects.toThrow('Unknown installation fields');
	});
	it('retains equipment attestations for comfort within installed ranges but requires fresh verification after config events', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.onApplicationBootstrap();
		await loader.verify(claim.id, 1, 'operator');
		const old = claims.qualification(claim, false);
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		config.revision++;
		config.requestedMode = 'heat';
		config.policy.heatingSetpoint = 22;
		await db.manager.save(config);
		events.emit('devices-virtual.thermostat.config.changed', claim.controllerId);
		expect(old.machineLeaseIsCurrent()).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
		await loader.verify(claim.id, 1, 'operator');
		const fresh = claims.qualification(claim, false);
		expect(fresh).not.toBeNull();
		expect(fresh).not.toBe(old);
		expect((await profiles.inspect(claim.id)).operator_attestations).toHaveLength(6);
		config.revision++;
		config.policy.heatingSetpoint = 26;
		await db.manager.save(config);
		events.emit('devices-virtual.thermostat.config.changed', claim.controllerId);
		await loader.verify(claim.id, 1, 'operator');
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).reasons.some((reason) => reason.includes('installed range'))).toBe(true);
	});
	it('requires restaging after floor threshold, lease or source safety changes', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		config.policy.floor.limit++;
		config.revision++;
		await db.manager.save(config);
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
		expect((await profiles.inspect(claim.id)).reasons).toContain('installation_bindings_changed');
		config.policy.floor.limit--;
		await db.manager.save(config);
		await db.manager.update(VirtualThermostatActuatorClaimEntity, { id: claim.id }, { leaseSeconds: 11 });
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
		await db.manager.update(VirtualThermostatActuatorClaimEntity, { id: claim.id }, { leaseSeconds: 10 });
		await db.manager.update(
			VirtualThermostatSourceEntity,
			{ controllerId: claim.controllerId },
			{ maximumAgeSeconds: 4 },
		);
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
	});
	it.each([
		['verified', 'human'],
		['blocked', 'human'],
		['failed', 'human'],
		['verified', 'background'],
		['blocked', 'background'],
		['failed', 'background'],
	] as const)('ignores a stale %s background inspection after fresh %s verification', async (result, newer) => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		let finish: () => void, entered: () => void;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		inspect.mockImplementationOnce(
			() =>
				new Promise((resolve, reject) => {
					finish = () =>
						result === 'failed'
							? reject(new Error('stale inspection failed'))
							: resolve({ isCurrent: () => result === 'verified' });
					entered();
				}),
		);
		const background = loader.verify(claim.id);
		await started;
		try {
			await loader.verify(claim.id, 1, newer === 'human' ? 'operator' : null);
			const fresh = claims.qualification(claim, false);
			expect(fresh).not.toBeNull();
			const accepted = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			const audits = await db.manager.count(ThermostatInstallationAuditEntity);
			finish();
			await background;
			expect(claims.qualification(claim, false)).toBe(fresh);
			expect(fresh.machineLeaseIsCurrent()).toBe(true);
			expect(
				(await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id })).lastMachineObservation,
			).toEqual(accepted.lastMachineObservation);
			expect(await db.manager.count(ThermostatInstallationAuditEntity)).toBe(audits);
		} finally {
			finish();
			await background;
		}
	});
	it.each(['human', 'background'] as const)(
		'a stale background profile-query failure cannot invalidate fresh %s verification',
		async (newer) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			await loader.verify(claim.id, 1, 'operator');
			let fail: () => void;
			const read = jest.spyOn(db.manager, 'findOneByOrFail').mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						fail = () => reject(new Error('stale profile query failed'));
					}),
			);
			const background = loader.verify(claim.id);
			try {
				await loader.verify(claim.id, 1, newer === 'human' ? 'operator' : null);
				const fresh = claims.qualification(claim, false);
				expect(fresh).not.toBeNull();
				fail();
				await background;
				expect(claims.qualification(claim, false)).toBe(fresh);
				expect(fresh.machineLeaseIsCurrent()).toBe(true);
			} finally {
				fail();
				read.mockRestore();
				await background;
			}
		},
	);
	it('background verification skips profile reads until the newest overlapping human operation finishes', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		let entered: () => void;
		let started: Promise<void>;
		const completions: (() => void)[] = [];
		inspect.mockImplementation(
			(_metadata: unknown, _timeout: number, admitted: () => boolean) =>
				new Promise((resolve) => {
					completions.push(() => resolve({ isCurrent: admitted }));
					entered();
				}),
		);
		started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const first = loader.verify(claim.id, 1, 'first');
		await started;
		started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const second = loader.verify(claim.id, 1, 'second');
		await started;
		const read = jest.spyOn(db.manager, 'findOneByOrFail');
		try {
			completions[0]();
			await first;
			await loader.verify(claim.id);
			expect(read).not.toHaveBeenCalled();
			expect(inspect).toHaveBeenCalledTimes(2);
			expect(claims.qualification(claim, false)).toBeNull();
			completions[1]();
			await second;
			expect(claims.qualification(claim, false)).not.toBeNull();
		} finally {
			for (const complete of completions) complete();
			read.mockRestore();
			await Promise.all([first, second]);
		}
	});
	it('a stale background structure-lock failure cannot revoke fresh human activation', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		let fail: () => void, entered: () => void;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const exclusive = jest.spyOn(lock, 'runExclusive').mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = () => reject(new Error('stale structure-lock failure'));
					entered();
				}),
		);
		const background = loader.verify(claim.id);
		await started;
		try {
			await loader.verify(claim.id, 1, 'operator');
			const fresh = claims.qualification(claim, false);
			expect(fresh).not.toBeNull();
			fail();
			await background;
			expect(claims.qualification(claim, false)).toBe(fresh);
			expect(fresh.machineLeaseIsCurrent()).toBe(true);
		} finally {
			fail();
			exclusive.mockRestore();
			await background;
		}
	});
	it('successful background renewals preserve current qualification without reviving expired captured leases', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		let originalLeaseCurrent = true;
		inspect.mockImplementationOnce(() => Promise.resolve({ isCurrent: () => originalLeaseCurrent }));
		await loader.verify(claim.id, 1, 'operator');
		const original = claims.qualification(claim, false);
		await loader.refresh();
		await loader.refresh();
		expect(claims.qualification(claim, false)).toBe(original);
		originalLeaseCurrent = false;
		expect(original.machineLeaseIsCurrent()).toBe(false);
		await loader.refresh();
		const fresh = claims.qualification(claim, false);
		expect(fresh).not.toBeNull();
		expect(fresh).not.toBe(original);
		expect(fresh.machineLeaseIsCurrent()).toBe(true);
		expect(original.machineLeaseIsCurrent()).toBe(false);
	});
	it('contains an actual SQLite renewal failure at startup and later cycles while renewing other claims', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		const healthy = await additionalInstallation(2);
		const expired = await additionalInstallation(3);
		await loader.verify(claim.id, 1, 'operator');
		await loader.verify(healthy.id, 1, 'operator');
		let oldLeaseCurrent = true;
		inspect.mockImplementationOnce(() => Promise.resolve({ isCurrent: () => oldLeaseCurrent }));
		await loader.verify(expired.id, 1, 'operator');
		await loader.refresh();
		const failedLease = claims.qualification(claim, false);
		const healthyLease = claims.qualification(healthy, false);
		const expiredLease = claims.qualification(expired, false);
		oldLeaseCurrent = false;
		await db.manager.update(ThermostatInstallationEntity, { claimId: claim.id }, { lastMachineObservation: null });
		await db.query(
			`CREATE TRIGGER reject_renewal_audit BEFORE INSERT ON devices_virtual_thermostat_installation_audit
			 WHEN NEW.claimId = '${claim.id}' BEGIN SELECT RAISE(ABORT, 'fixture renewal audit failure'); END`,
		);
		const interval = jest.spyOn(global, 'setInterval');
		await expect(loader.onApplicationBootstrap()).resolves.toBeUndefined();
		expect(interval).toHaveBeenCalledTimes(1);
		expect(failedLease.machineLeaseIsCurrent()).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
		expect(claims.qualification(healthy, false)).toBe(healthyLease);
		expect(healthyLease.machineLeaseIsCurrent()).toBe(true);
		const renewed = claims.qualification(expired, false);
		expect(renewed).not.toBeNull();
		expect(renewed).not.toBe(expiredLease);
		expect(renewed.machineLeaseIsCurrent()).toBe(true);
		expect(expiredLease.machineLeaseIsCurrent()).toBe(false);
		// Repeat through the real scheduler catch path: a per-claim error must never reach global invalidation.
		(interval.mock.calls[0][0] as () => void)();
		await loader['queue'];
		expect(claims.qualification(healthy, false)).toBe(healthyLease);
		expect(claims.qualification(expired, false)).toBe(renewed);
		expect(healthyLease.machineLeaseIsCurrent()).toBe(true);
		expect(renewed.machineLeaseIsCurrent()).toBe(true);
		await db.query('DROP TRIGGER reject_renewal_audit');
		await loader.refresh();
		expect(claims.qualification(claim, false)).not.toBeNull();
	});
	it('retains startup renewal timer after a catalog read failure and keeps all old leases revoked', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		const old = claims.qualification(claim, false);
		const read = jest.spyOn(db.manager, 'find').mockRejectedValueOnce(new Error('installation catalog unavailable'));
		const interval = jest.spyOn(global, 'setInterval');
		await expect(loader.onApplicationBootstrap()).resolves.toBeUndefined();
		expect(interval).toHaveBeenCalledTimes(1);
		expect(old.machineLeaseIsCurrent()).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
		read.mockRestore();
		(interval.mock.calls[0][0] as () => void)();
		await loader['queue'];
		const fresh = claims.qualification(claim, false);
		expect(fresh).not.toBeNull();
		expect(fresh).not.toBe(old);
		expect(fresh.machineLeaseIsCurrent()).toBe(true);
		expect(old.machineLeaseIsCurrent()).toBe(false);
		jest.spyOn(db.manager, 'find').mockRejectedValueOnce(new Error('later installation catalog unavailable'));
		(interval.mock.calls[0][0] as () => void)();
		await loader['queue'];
		expect(claims.qualification(claim, false)).toBeNull();
		expect(fresh.machineLeaseIsCurrent()).toBe(false);
	});
	it.each(['stage', 'revoke', 'verify'] as const)(
		'preserves %s commit, validation and SQL rollback outcomes when its cleanup reload fails',
		async (action) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			await loader.verify(claim.id, 1, 'operator');
			const target = { ...(await bindings.resolve(db.manager, claim.id)).target, value: true };
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
			const originalFind = db.manager.find.bind(db.manager) as typeof db.manager.find;
			let failReload = false;
			const holdFence = claims.holdRecoveryFence.bind(claims) as typeof claims.holdRecoveryFence;
			jest.spyOn(claims, 'holdRecoveryFence').mockImplementation(() => {
				failReload = false;
				const release = holdFence();
				return () => {
					release();
					failReload = true;
				};
			});
			jest.spyOn(db.manager, 'find').mockImplementation(async (...args) => {
				if (failReload && args[0] === VirtualThermostatActuatorClaimEntity)
					throw new Error('cleanup reload unavailable');
				return (await originalFind(...args)) as Record<string, unknown>[];
			});
			const operate = (revision: number) =>
				action === 'stage'
					? profiles.stage(claim.id, revision, setup, attestations(), 'operator')
					: action === 'revoke'
						? profiles.revoke(claim.id, revision, 'operator')
						: loader.verify(claim.id, revision, 'operator');
			const retry = async () => {
				expect(() => claims.assertAllowed(target)).toThrow('reconciling');
				expect(() => claims.mintAuthority(claim.id, 'off')).toThrow('not admitted');
				expect(jest.getTimerCount()).toBe(1);
				failReload = false;
				const refresh = jest.spyOn(claims, 'refresh');
				await jest.advanceTimersByTimeAsync(1000);
				expect(refresh).toHaveBeenCalledTimes(1);
				await (refresh.mock.results[0].value as Promise<void>);
				refresh.mockRestore();
				expect(jest.getTimerCount()).toBe(0);
				expect(() => claims.assertAllowed(target)).toThrow('reserved');
				expect(() => claims.mintAuthority(claim.id, 'off')).not.toThrow();
			};
			// A committed transaction stays successful even though subsequent membership reload cannot read.
			await expect(operate(1)).resolves.toBeUndefined();
			let row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			expect(row.revision).toBe(action === 'verify' ? 1 : 2);
			expect(row.armedAt !== null).toBe(action === 'verify');
			expect(row.revokedAt !== null).toBe(action === 'revoke');
			await retry();
			failReload = true;
			// The original conflict must survive the same failing cleanup read.
			const rejected = operate(999);
			await expect(rejected).rejects.toBeInstanceOf(ConflictException);
			await expect(rejected).rejects.toThrow(action === 'verify' ? 'inspect again' : 'Reload the current revision');
			await retry();
			// Real SQLite audit rejection must survive cleanup too, and leave the row/audit transaction rolled back.
			if (action === 'verify') {
				await profiles.stage(claim.id, row.revision, setup, attestations(), 'operator');
				row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
				await retry();
			}
			const audits = await db.manager.count(ThermostatInstallationAuditEntity);
			await db.query(
				"CREATE TRIGGER reject_cleanup_audit BEFORE INSERT ON devices_virtual_thermostat_installation_audit BEGIN SELECT RAISE(ABORT, 'original SQL rollback failure'); END",
			);
			failReload = true;
			await expect(operate(row.revision)).rejects.toThrow('original SQL rollback failure');
			expect(await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id })).toEqual(row);
			expect(await db.manager.count(ThermostatInstallationAuditEntity)).toBe(audits);
			await retry();
		},
	);
	it('requires exact explicit Steinhart-Hart coefficients, domains, leg and physical voltage configuration', async () => {
		const binding = await bindings.resolve(db.manager, claim.id);
		const conversion = {
			kind: 'steinhart_hart' as const,
			referenceVoltage: 10,
			seriesResistance: 10000,
			a: 0.0010351024725298568,
			b: 0.0002338353574079741,
			c: 7.917851073336009e-8,
			thermistorLeg: 'low' as const,
			inputRange: { minimum: 0.1, maximum: 9.9 },
			outputRange: { minimum: -40, maximum: 100 },
		};
		const rawSetup = {
			...setup,
			floorComponentType: 'voltmeter' as const,
			floorAttribute: 'voltage' as const,
			floorConfigurationJson: JSON.stringify({
				id: 100,
				range: 0,
				report_thr: 0.1,
				xvoltage: { expr: null, unit: null },
			}),
			peripheralsJson: JSON.stringify({ voltmeter: { 'voltmeter:100': {} } }),
			floorConversion: conversion,
		};
		const identity = nativeVoltmeterVoltageIdentity(
			'voltmeter:100',
			JSON.parse(rawSetup.floorConfigurationJson) as Record<string, unknown>,
			JSON.parse(rawSetup.peripheralsJson) as Record<string, unknown>,
			'000000000001',
		);
		(binding.floorLeaf.channel as ChannelEntity).identifier = identity.channelIdentifier;
		binding.floorLeaf.identifier = 'voltage';
		binding.floorTransform = Object.assign(new VirtualTransformConfigEntity(), {
			policy: {
				operator: VirtualNumericTransformOperator.STEINHART_HART,
				referenceVoltage: conversion.referenceVoltage,
				seriesResistance: conversion.seriesResistance,
				coefficientA: conversion.a,
				coefficientB: conversion.b,
				coefficientC: conversion.c,
				thermistorLeg: conversion.thermistorLeg,
				inputRange: conversion.inputRange,
				outputRange: conversion.outputRange,
			},
		});
		expect(() => validateThermostatInstallation(rawSetup, attestations(), binding)).not.toThrow();
		for (const changed of [
			{ a: conversion.a * 1.001 },
			{ thermistorLeg: 'high' },
			{ inputRange: { minimum: 0.2, maximum: 9.9 } },
		]) {
			expect(() =>
				validateThermostatInstallation(
					{ ...rawSetup, floorConversion: { ...conversion, ...changed } } as ThermostatGuardSetup,
					attestations(),
					binding,
				),
			).toThrow('calibration');
		}
	});
	it('cannot reload a pre-recovery profile or inject an old generation after restart', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await db.manager.update(
			VirtualThermostatActuatorClaimEntity,
			{ id: claim.id },
			{ revision: 2, qualificationGeneration: uuid() },
		);
		await db.manager.update(VirtualThermostatConfigEntity, { controllerId: claim.controllerId }, { revision: 2 });
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).reasons).toContain('installation_bindings_changed');
	});
	it('refuses an unlocked follow input even when an operator supplied writer attestations', async () => {
		await profiles.stage(
			claim.id,
			0,
			{
				...setup,
				switchConfigurationJson: JSON.stringify({
					id: 0,
					initial_state: 'off',
					in_mode: 'follow',
					in_locked: false,
					auto_on: false,
				}),
			},
			attestations(),
			'operator',
		);
		await loader.verify(claim.id, 1, 'operator');
		expect(inspect).not.toHaveBeenCalled();
		expect((await profiles.inspect(claim.id)).reasons).toContain('native_restart_or_input_writer_not_excluded');
	});
	it('staging while queued behind the structure lock revokes ON before any read, including failed CAS', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		claims.registerRuntimeAdmission(() => true);
		const authority = claims.mintAuthority(claim.id, 'on');
		const target = { ...(await bindings.resolve(db.manager, claim.id)).target, value: true };
		expect(claims.isAuthorized(authority, target)).toBe(true);
		const old = claims.qualification(claim, false);
		let enter: () => void, unlock: () => void;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const pending = new Promise<void>((resolve) => {
			unlock = resolve;
		});
		const held = lock.runExclusive(async () => {
			enter();
			await pending;
		});
		await entered;
		const update = profiles.stage(claim.id, 999, setup, attestations(), 'operator');
		const rejected = expect(update).rejects.toBeInstanceOf(ConflictException);
		const refresh = claims.refresh();
		try {
			expect(claims.isAuthorized(authority, target)).toBe(false);
			expect(old.machineLeaseIsCurrent()).toBe(false);
			expect(() => claims.mintAuthority(claim.id, 'on')).toThrow();
		} finally {
			unlock();
			await held;
			await Promise.all([rejected, refresh]);
		}
		await loader.refresh();
		expect(claims.isAuthorized(authority, target)).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
	});
	it.each(['revoke', 'verify'] as const)(
		'%s revokes ON synchronously while its first profile query is pending',
		async (action) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			await loader.verify(claim.id, 1, 'operator');
			claims.registerRuntimeAdmission(() => true);
			const authority = claims.mintAuthority(claim.id, 'on');
			const target = { ...(await bindings.resolve(db.manager, claim.id)).target, value: true };
			const row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			let releaseRead: () => void;
			const pendingRead = new Promise<void>((resolve) => {
				releaseRead = resolve;
			});
			const read = jest.spyOn(db.manager, 'findOneByOrFail').mockImplementationOnce(async () => {
				await pendingRead;
				return row;
			});
			const operation =
				action === 'revoke' ? profiles.revoke(claim.id, 999, 'operator') : loader.verify(claim.id, 999, 'operator');
			const rejected = expect(operation).rejects.toBeInstanceOf(ConflictException);
			const refresh = claims.refresh();
			try {
				expect(claims.isAuthorized(authority, target)).toBe(false);
				expect(() => claims.mintAuthority(claim.id, 'on')).toThrow();
			} finally {
				releaseRead();
				read.mockRestore();
				await Promise.all([rejected, refresh]);
			}
			await loader.refresh();
			expect(claims.qualification(claim, false)).toBeNull();
			expect(claims.isAuthorized(authority, target)).toBe(false);
		},
	);
	it('an actual SQLite audit failure rolls back staging without restoring any queued ON or prior qualification', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		claims.registerRuntimeAdmission(() => true);
		const authority = claims.mintAuthority(claim.id, 'on');
		const target = { ...(await bindings.resolve(db.manager, claim.id)).target, value: true };
		await db.query(
			"CREATE TRIGGER reject_profile_audit BEFORE INSERT ON devices_virtual_thermostat_installation_audit BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END",
		);
		await expect(
			profiles.stage(claim.id, 1, { ...setup, epochKey: 'rollback' }, attestations(), 'operator'),
		).rejects.toThrow('fixture audit failure');
		const row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
		expect(row.revision).toBe(1);
		expect(row.setup.epochKey).toBe('fixture-epoch');
		expect(claims.isAuthorized(authority, target)).toBe(false);
		expect(claims.qualification(claim, false)).toBeNull();
		await db.query('DROP TRIGGER reject_profile_audit');
		await loader.refresh();
		expect(claims.qualification(claim, false)).toBeNull();
	});
	it('stage and restart never arm intent until explicit user activation commits', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.onApplicationBootstrap();
		await loader.refresh();
		expect(inspect).not.toHaveBeenCalled();
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).activation_requested).toBe(false);
		await loader.verify(claim.id, 1, 'operator');
		expect((await profiles.inspect(claim.id)).activation_requested).toBe(true);
		expect(
			(await db.manager.find(ThermostatInstallationAuditEntity, { where: { claimId: claim.id } })).some(
				(row) => row.action === 'activated' && row.actorId === 'operator',
			),
		).toBe(true);
		await profiles.stage(claim.id, 1, setup, attestations(), 'operator');
		await loader.refresh();
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).activation_requested).toBe(false);
	});
	it('failed activation audit cannot publish qualification or durable armed intent', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await db.query(
			"CREATE TRIGGER reject_activation_audit BEFORE INSERT ON devices_virtual_thermostat_installation_audit BEGIN SELECT RAISE(ABORT, 'activation audit failure'); END",
		);
		await expect(loader.verify(claim.id, 1, 'operator')).rejects.toThrow('activation audit failure');
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id })).armedAt).toBeNull();
	});
	it('machine lease expiry during the activation audit rolls back durable armed intent', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		db.subscribers.push({
			afterInsert: (event) => {
				if (
					event.metadata.target === ThermostatInstallationAuditEntity &&
					(event.entity as ThermostatInstallationAuditEntity).action === 'activated'
				)
					current = false;
			},
		});
		await expect(loader.verify(claim.id, 1, 'operator')).rejects.toThrow('machine lease expired');
		expect(claims.qualification(claim, false)).toBeNull();
		const row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
		expect(row.armedAt).toBeNull();
		expect(row.lastMachineObservation).toBeNull();
		expect(await db.manager.count(ThermostatInstallationAuditEntity)).toBe(1);
	});
	it.each(['profile_update', 'activation_audit'] as const)(
		'verification invalidation during %s rolls back durable armed intent',
		async (step) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			db.subscribers.push({
				afterUpdate: (event) => {
					if (step === 'profile_update' && event.metadata.target === ThermostatInstallationEntity) loader.invalidate();
				},
				afterInsert: (event) => {
					if (step === 'activation_audit' && event.metadata.target === ThermostatInstallationAuditEntity)
						loader.invalidate();
				},
			});
			await expect(loader.verify(claim.id, 1, 'operator')).rejects.toThrow('verification superseded');
			expect(claims.qualification(claim, false)).toBeNull();
			const row = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			expect(row.armedAt).toBeNull();
			expect(row.lastMachineObservation).toBeNull();
			expect(await db.manager.count(ThermostatInstallationAuditEntity)).toBe(1);
		},
	);
	it.each([
		['stage_transaction', 'unchanged'],
		['revoke_cas', 'unchanged'],
		['revoke_transaction', 'unchanged'],
		['revoke_cas', 'floor_changed'],
		['stage_transaction', 'generation_changed'],
	] as const)(
		'cold restart after rejected %s preserves prior accepted intent, with %s safety contract',
		async (failure, drift) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			await loader.verify(claim.id, 1, 'operator');
			claims.registerRuntimeAdmission(() => true);
			const oldQualification = claims.qualification(claim, false);
			if (!oldQualification) throw new Error('Expected the verified installation qualification');
			const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
				controllerId: claim.controllerId,
			});
			const oldAuthority = claims.mintAuthority(claim.id, 'on');
			const target = { ...(await bindings.resolve(db.manager, claim.id)).target, value: true };
			// An opaque server-issued fixture proof belongs to the old process; it is not hardware evidence.
			const oldProof = claims.recordQualifiedRelease(claims.mintAuthority(claim.id, 'off'), {
				outputConfirmedOff: true,
				pendingOnDrained: true,
				evidenceId: 'fixture-old-process-only',
				qualification: oldQualification,
				isCurrent: () =>
					claims.qualification(claim, false) === oldQualification &&
					oldQualification.machineLeaseIsCurrent?.() === true,
				controllerRevision: config.revision,
			});
			const accepted = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			if (failure === 'revoke_cas')
				await expect(profiles.revoke(claim.id, 999, 'operator')).rejects.toThrow(
					'Reload the current revision and retry',
				);
			else {
				await db.query(
					"CREATE TRIGGER reject_restart_change BEFORE INSERT ON devices_virtual_thermostat_installation_audit BEGIN SELECT RAISE(ABORT, 'restart rollback fixture'); END",
				);
				const change =
					failure === 'stage_transaction'
						? profiles.stage(claim.id, 1, { ...setup, epochKey: 'rejected-change' }, attestations(), 'operator')
						: profiles.revoke(claim.id, 1, 'operator');
				await expect(change).rejects.toThrow('restart rollback fixture');
				await db.query('DROP TRIGGER reject_restart_change');
			}
			const retained = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
			expect(retained.revision).toBe(accepted.revision);
			expect(retained.armedAt).toEqual(accepted.armedAt);
			expect(retained.revokedAt).toBeNull();
			expect(retained.setup).toEqual(accepted.setup);
			expect(oldQualification.machineLeaseIsCurrent()).toBe(false);
			expect(claims.isAuthorized(oldAuthority, target)).toBe(false);
			const paused = await profiles.inspect(claim.id);
			expect(paused.activation_requested).toBe(true);
			expect(paused.reasons).toContain('stored_activation_paused_reload_and_retry_failed_change_or_explicitly_verify');
			await loader.refresh();
			expect(claims.qualification(claim, false)).toBeNull();
			if (drift === 'floor_changed') {
				const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
					controllerId: claim.controllerId,
				});
				config.policy.floor.limit++;
				await db.manager.save(config);
			} else if (drift === 'generation_changed')
				await db.manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ id: claim.id },
					{ qualificationGeneration: uuid() },
				);
			loader.onModuleDestroy();
			claims.onModuleDestroy();
			await db.destroy();
			db = await new SqliteDataSource({
				type: 'sqlite',
				database: join(directory, 'db.sqlite'),
				entities: [__dirname + '/../../../**/*.entity.ts'],
			}).initialize();
			lock = new DeviceStructureLockService();
			events = new EventEmitter2();
			claims = new VirtualThermostatClaimsService(
				db,
				lock,
				new VirtualDependencyGraphService(db),
				new PropertyCommandAdmissionRegistryService(),
				events,
			);
			await claims.onApplicationBootstrap();
			profiles = new ThermostatInstallationService(db, lock, bindings, claims, runtime);
			// A restarted runtime has no current OFF/drain fence. Metadata renewal alone must not mint ON.
			claims.registerRuntimeAdmission(() => false);
			let completeInspection: () => void;
			inspect.mockClear();
			inspect.mockImplementation(
				(_metadata: unknown, _timeout: number, admitted: () => boolean) =>
					new Promise((resolve) => {
						completeInspection = () => resolve({ isCurrent: () => current && admitted() });
					}),
			);
			const platform = Object.create(ShellyNgDevicePlatform.prototype) as ShellyNgDevicePlatform;
			platform.prepareGuardRpcSession = () => ({ inspectInstallation: inspect }) as unknown as ShellyGuardRpcSession;
			loader = new ThermostatInstallationLoaderService(
				db,
				bindings,
				profiles,
				claims,
				{ get: () => platform } as unknown as PlatformRegistryService,
				lock,
				runtime,
				events,
			);
			const bootstrap = loader.onApplicationBootstrap();
			if (drift === 'unchanged') {
				while (!completeInspection) await new Promise<void>((resolve) => setImmediate(resolve));
				expect(claims.qualification(claim, false)).toBeNull();
				expect(() => claims.mintAuthority(claim.id, 'on')).toThrow();
				completeInspection();
				await bootstrap;
				const fresh = claims.qualification(claim, false);
				expect(fresh).not.toBeNull();
				expect(fresh).not.toBe(oldQualification);
				expect(fresh.machineLeaseIsCurrent()).toBe(true);
				expect(inspect).toHaveBeenCalledTimes(1);
			} else {
				await bootstrap;
				expect(inspect).not.toHaveBeenCalled();
				expect(claims.qualification(claim, false)).toBeNull();
				expect((await profiles.inspect(claim.id)).reasons).toContain('installation_bindings_changed');
			}
			expect((await profiles.inspect(claim.id)).activation_requested).toBe(true);
			expect(oldQualification.machineLeaseIsCurrent()).toBe(false);
			expect(claims.isAuthorized(oldAuthority, target)).toBe(false);
			expect(() => claims.mintAuthority(claim.id, 'on')).toThrow();
			await expect(claims.completeRelease(oldProof)).rejects.toThrow('Internal release proof');
			await expect(claims.completeRelease({ ...oldProof })).rejects.toThrow('Internal release proof');
		},
	);
	it('migration33 round trips without editing deployed earlier migrations', async () => {
		const runner = db.createQueryRunner(),
			migration = new AddThermostatInstallationProfiles1000000000033();
		await migration.down(runner);
		await migration.up(runner);
		await profiles.stage(claim.id, 0, setup, [], 'operator');
		expect(await db.manager.count(ThermostatInstallationEntity)).toBe(1);
		await runner.release();
	});
	it.each(['reserved', 'missing', 'releasing', 'suspended'] as const)(
		'refuses legacy installation for same-Shelly parallel heating including a %s reservation',
		async (state) => {
			await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
			await loader.verify(claim.id, 1, 'operator');
			const channelId = uuid(),
				propertyId = uuid();
			await db.manager.insert(ShellyNgChannelEntity, {
				id: channelId,
				device: claim.sourceDeviceId,
				identifier: 'switch:1',
				name: 'Same physical Shelly second output',
				category: ChannelCategory.SWITCHER,
			} as never);
			await db.manager.insert(ShellyNgChannelPropertyEntity, {
				id: propertyId,
				channel: channelId,
				identifier: 'output',
				category: PropertyCategory.ON,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
			} as never);
			const target = await db.manager.findOneOrFail(ChannelPropertyEntity, {
				where: { id: propertyId },
				relations: ['channel', 'channel.device'],
			});
			const channel = target.channel as ChannelEntity;
			const sibling = db.manager.create(VirtualThermostatActuatorClaimEntity, {
				...claim,
				id: uuid(),
				physicalIdentity: thermostatActuatorIdentity(target, channel, channel.device as ShellyNgDeviceEntity),
				sourcePropertyId: state === 'missing' ? null : propertyId,
				sourcePropertyIdentity: propertyId,
				contractFingerprint: thermostatPropertyContract(target, channel, channel.device as ShellyNgDeviceEntity),
				state,
			});
			await db.manager.insert(VirtualThermostatActuatorClaimEntity, sibling);
			for (const member of [claim, sibling]) {
				await expect(
					profiles.stage(member.id, member.id === claim.id ? 1 : 0, setup, attestations(), 'operator'),
				).rejects.toThrow('parallel heating');
				await expect(bindings.resolve(db.manager, member.id)).rejects.toThrow('parallel heating');
			}
			expect((await profiles.inspect(claim.id)).readiness).toBe('blocked');
			const inspections = inspect.mock.calls.length;
			await loader.verify(claim.id, 1, 'operator');
			await loader.refresh(); // Background renewal must refuse the same topology before machine inspection.
			expect(inspect).toHaveBeenCalledTimes(inspections);
			expect(claims.qualification(claim, false)).toBeNull();
			expect((await profiles.inspect(claim.id)).reasons.some((reason) => reason.includes('parallel heating'))).toBe(
				true,
			);
			expect(await db.manager.countBy(ThermostatInstallationEntity, { claimId: sibling.id })).toBe(0);
		},
	);
	it('rejects an unreachable effective recovery boundary and accepts the immediately reachable interior domain', async () => {
		await adopt(claim);
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		config.policy.floor = { limit: -53, recoveryHysteresis: 2 };
		await db.manager.save(config);
		await expect(profiles.stage(claim.id, 0, memberInstallationSetup(), attestations(), 'operator')).rejects.toThrow(
			'domains',
		);
		config.policy.floor.limit = -53 + 0.000001;
		await db.manager.save(config);
		await profiles.stage(claim.id, 0, memberInstallationSetup(), attestations(), 'operator');
		expect((await profiles.inspect(claim.id)).source_hash).toHaveLength(64);
	});

	const adopt = async (member: VirtualThermostatActuatorClaimEntity, converted = false) => {
		const probe = await createProtectionProbe(db, member.sourcePropertyId, converted);
		const source = await resolveThermostatProtectionSource(db.manager, probe.sourceId, member.physicalIdentity);
		await db.manager.insert(ThermostatMemberProtectionEntity, {
			claimId: member.id,
			schemaVersion: 1,
			kind: 'local_floor',
			revision: 1,
			sourcePropertyId: probe.sourceId,
			sourcePropertyIdentity: probe.sourceId,
			physicalPropertyIdentity: probe.physicalId,
			contractFingerprint: source.fingerprint,
			maximumAgeSeconds: 5,
		});
		return probe;
	};
	it('upgrades actual legacy SQLite rows without changing artifact, activation, UUID, generation or unresolved ON', async () => {
		claim.qualificationGeneration = uuid();
		await db.manager.save(claim);
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		await loader.verify(claim.id, 1, 'operator');
		await db.manager.insert(VirtualThermostatCommandEntity, {
			id: uuid(),
			controllerId: claim.controllerId,
			claimId: claim.id,
			claimRevision: 1,
			configurationRevision: 1,
			decisionRevision: 7,
			action: 'on',
			status: 'unknown',
			preparedAt: new Date(),
			dispatchedAt: new Date(),
			fault: 'retained-late-on',
		});
		await db.manager.insert(VirtualThermostatBranchRuntimeEntity, {
			claimId: claim.id,
			activity: 'unknown',
			releaseAttempts: 3,
		});
		const beforeBinding = await bindings.resolve(db.manager, claim.id);
		const before = await profiles.inspect(claim.id);
		const runner = db.createQueryRunner();
		await runner.query('DROP TABLE "devices_virtual_thermostat_member_protection"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_branch_runtime" DROP COLUMN "floorLatched"');
		await runner.query('ALTER TABLE "devices_virtual_thermostat_configs" DROP COLUMN "displayFloorClaimId"');
		await runner.query('ALTER TABLE "devices_shelly_ng_sample_sources" DROP COLUMN "installationSnapshot"');
		const tables = [
			'devices_virtual_thermostat_actuator_claims',
			'devices_virtual_thermostat_command_journal',
			'devices_virtual_thermostat_installations',
			'devices_virtual_thermostat_installation_audit',
		];
		const retained = await Promise.all(tables.map((table) => runner.query(`SELECT * FROM "${table}"`)));
		await runner.startTransaction();
		await new AddThermostatMemberProtection1000000000041().up(runner);
		await runner.commitTransaction();
		expect(await Promise.all(tables.map((table) => runner.query(`SELECT * FROM "${table}"`)))).toEqual(retained);
		expect(await db.manager.count(ThermostatMemberProtectionEntity)).toBe(0);
		expect((await bindings.resolve(db.manager, claim.id)).fingerprint).toBe(beforeBinding.fingerprint);
		const after = await profiles.inspect(claim.id);
		expect(after.artifact).toBe(before.artifact);
		expect(after.source_hash).toBe(before.source_hash);
		expect(after.activation_requested).toBe(true);
		await runner.release();
	});
	it('stages two distinct local Shelly probes/converters with independently capped artifacts and mandatory global guard', async () => {
		const sibling = await additionalInstallation(2);
		await db.manager.update(VirtualThermostatActuatorClaimEntity, sibling.id, { controllerId: claim.controllerId });
		sibling.controllerId = claim.controllerId;
		const first = await adopt(claim);
		const second = await adopt(sibling, true);
		await profiles.stage(claim.id, 0, memberInstallationSetup(27), attestations(), 'operator');
		await profiles.stage(sibling.id, 1, memberInstallationSetup(35), attestations(), 'operator');
		const a = await profiles.inspect(claim.id),
			b = await profiles.inspect(sibling.id);
		expect(a.setup.floorComponentType).toBe('temperature');
		expect(b.setup.floorComponentType).toBe('voltmeter');
		expect(a.artifact).toContain('"floorLimitC":27');
		expect(b.artifact).toContain('"floorLimitC":30');
		expect(b.artifact).toContain('"kind":"steinhart_hart"');
		expect(a.artifact).toContain('floorDomainC.minimum');
		expect(a.activation_requested).toBe(false);
		expect(b.activation_requested).toBe(false);
		expect(first.device.canonicalMac).not.toBe(second.device.canonicalMac);
		expect(
			await db.manager.countBy(VirtualThermostatSourceEntity, { controllerId: claim.controllerId, role: 'floor' }),
		).toBe(1);
		await expect(profiles.stage(claim.id, 1, setup, attestations(), 'operator')).rejects.toThrow('member format');
	});
	it('uses conservative per-member latches through strict boundaries, observation gaps, restart and one faulty input', async () => {
		const sibling = await additionalInstallation(2);
		await db.manager.update(VirtualThermostatActuatorClaimEntity, sibling.id, { controllerId: claim.controllerId });
		sibling.controllerId = claim.controllerId;
		const first = await adopt(claim),
			second = await adopt(sibling, true);
		await profiles.stage(claim.id, 0, memberInstallationSetup(27), attestations(), 'operator');
		await profiles.stage(sibling.id, 1, memberInstallationSetup(35), attestations(), 'operator');
		const samples = new Map<string, QualifiedPropertySample>();
		let lease = true;
		const values = {
			readQualifiedSample: (property: ChannelPropertyEntity, age: number, now: Date) => {
				const value = samples.get(property.id);
				return value && now.getTime() - value.sampledAt.getTime() < age ? value : null;
			},
			captureSampleSourceGuard: () => {
				const current = lease;
				return () => current && lease;
			},
		} as unknown as PropertyValueService;
		const service = new ThermostatMemberProtectionService(db, values);
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		const frame = await service.load(config, [claim, sibling]);
		const start = Date.now();
		const report = (probe: typeof first, value: number, time: number) => {
			for (const id of new Set([probe.sourceId, probe.physicalId]))
				samples.set(id, {
					propertyId: id,
					value: id === probe.physicalId && probe.sourceId !== probe.physicalId ? 1.65 : value,
					sampledAt: new Date(time),
					receivedAt: new Date(time),
					quality: 'good',
					provenance: 'live',
					reasons: [],
					...(probe.sourceId !== probe.physicalId && id === probe.sourceId ? { revision: 1 } : {}),
				});
		};
		const recoverAfterRelease = (time: number) => {
			service.acknowledgeRelease(frame, time); // Runtime integration tests establish the required all-leaf proof.
			report(first, 24, time + 1);
			report(second, 27, time + 1);
			expect(service.read(frame, time + 1).every((entry) => entry.ready)).toBe(true);
		};
		expect(service.read(frame, start).every((entry) => entry.latched)).toBe(true);
		report(first, 24, start + 1);
		report(second, 27, start + 1);
		expect(service.read(frame, start + 1).every((entry) => entry.latched)).toBe(true);
		recoverAfterRelease(start + 2);
		report(first, 27, start + 4);
		expect(service.read(frame, start + 4)[0].latched).toBe(true);
		report(first, 24, start + 5);
		expect(service.read(frame, start + 5)[0].latched).toBe(true);
		service.acknowledgeRelease(frame, start + 6);
		expect(service.read(frame, start + 6)[0].latched).toBe(true); // Pre-release recovery report cannot clear.
		report(first, 25, start + 7);
		expect(service.read(frame, start + 7)[0].latched).toBe(true);
		recoverAfterRelease(start + 8);
		service.read(frame, start + 6000);
		report(first, 26, start + 6001);
		report(second, 29, start + 6001);
		expect(service.read(frame, start + 6001).every((entry) => entry.latched)).toBe(true);
		recoverAfterRelease(start + 6002);
		lease = false;
		expect(service.read(frame, start + 6004).every((entry) => entry.latched)).toBe(true);
		lease = true;
		service.read(frame, start + 6005);
		recoverAfterRelease(start + 6006);
		service.reset();
		expect(service.read(frame, start + 6008).every((entry) => entry.latched)).toBe(true);
		recoverAfterRelease(start + 6009);
		samples.delete(second.physicalId);
		expect(service.read(frame, start + 6011)[1].ready).toBe(false);
	});
	it('invalidates every sibling fingerprint on topology and common policy changes without losing reservations', async () => {
		const sibling = await additionalInstallation(2);
		await db.manager.update(VirtualThermostatActuatorClaimEntity, sibling.id, { controllerId: claim.controllerId });
		sibling.controllerId = claim.controllerId;
		await adopt(claim);
		await adopt(sibling);
		await profiles.stage(claim.id, 0, memberInstallationSetup(), attestations(), 'operator');
		await profiles.stage(sibling.id, 1, memberInstallationSetup(), attestations(), 'operator');
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		config.policy.floor.limit = 29;
		config.revision++;
		await db.manager.save(config);
		for (const member of [claim, sibling])
			expect((await profiles.inspect(member.id)).reasons).toContain('installation_bindings_changed');
		expect(await db.manager.countBy(VirtualThermostatActuatorClaimEntity, { controllerId: claim.controllerId })).toBe(
			2,
		);
	});

	it('rejects wrong device, changed peripheral, calibration, source age and converter domain drift', async () => {
		const sibling = await additionalInstallation(2);
		const local = await adopt(claim, true);
		const other = await createProtectionProbe(db, sibling.sourcePropertyId);
		await expect(resolveThermostatProtectionSource(db.manager, other.sourceId, claim.physicalIdentity)).rejects.toThrow(
			'actuator Shelly',
		);
		await profiles.stage(claim.id, 0, memberInstallationSetup(27), attestations(), 'operator');
		const binding = await bindings.resolve(db.manager, claim.id);
		const profile = await db.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId: claim.id });
		for (const change of [
			{ floorMaximumAgeMs: 5001 },
			{ floorDomainC: { minimum: -39, maximum: 100 } },
			{ floorConversion: { ...profile.setup.floorConversion, a: profile.setup.floorConversion.a * 1.001 } },
			{ installedFloorCeilingC: Number.POSITIVE_INFINITY },
			{ effectiveFloorCutoffC: 28 },
		])
			expect(() => validateThermostatInstallation({ ...profile.setup, ...change }, attestations(), binding)).toThrow();
		const metadata = await db.manager.findOneByOrFail(ShellySampleSourceEntity, { propertyId: local.physicalId });
		metadata.installationSnapshot.peripherals = { voltmeter: { 'voltmeter:100': { io: 1 } } };
		await db.manager.save(metadata);
		await expect(bindings.resolve(db.manager, claim.id)).rejects.toThrow('actuator Shelly');
		expect((await profiles.inspect(claim.id)).readiness).toBe('blocked');
	});
	it('keeps staged metadata ineligible after binding CAS, source deletion and topology changes during inspection', async () => {
		const local = await adopt(claim);
		await profiles.stage(claim.id, 0, memberInstallationSetup(), attestations(), 'operator');
		let resume: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		let signal: () => void;
		const entered = new Promise<void>((resolve) => {
			signal = resolve;
		});
		inspect.mockImplementationOnce(async (_metadata: unknown, _timeout: number, admitted: () => boolean) => {
			signal();
			await gate;
			return { isCurrent: () => admitted() };
		});
		const verifying = loader.verify(claim.id, 1, 'operator');
		await entered;
		const binding = await db.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id });
		binding.revision++;
		binding.maximumAgeSeconds = 4;
		await db.manager.save(binding);
		resume();
		await verifying;
		expect(claims.qualification(claim, false)).toBeNull();
		expect((await profiles.inspect(claim.id)).activation_requested).toBe(false);
		await db.manager.delete(ChannelPropertyEntity, { id: local.sourceId });
		const retained = await db.manager.findOneByOrFail(ThermostatMemberProtectionEntity, { claimId: claim.id });
		expect(retained.sourcePropertyId).toBeNull();
		expect(retained.sourcePropertyIdentity).toBe(local.sourceId);
		expect((await profiles.inspect(claim.id)).readiness).toBe('blocked');
		expect(
			(await db.manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: claim.id })).physicalIdentity,
		).toBe(claim.physicalIdentity);
	});
	it('validates the effective cutoff rather than rejecting a higher common request capped by a reviewed member ceiling', async () => {
		await adopt(claim, true);
		const config = await db.manager.findOneByOrFail(VirtualThermostatConfigEntity, {
			controllerId: claim.controllerId,
		});
		config.policy.floor.limit = 110;
		await db.manager.save(config);
		await profiles.stage(claim.id, 0, memberInstallationSetup(27), attestations(), 'operator');
		expect((await profiles.inspect(claim.id)).setup.effectiveFloorCutoffC).toBe(27);
		await expect(profiles.stage(claim.id, 1, memberInstallationSetup(120), attestations(), 'operator')).rejects.toThrow(
			'domains',
		);
	});
});
