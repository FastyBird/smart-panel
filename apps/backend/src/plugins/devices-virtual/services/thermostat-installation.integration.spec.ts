import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddThermostatInstallationProfiles1000000000033 } from '../../../migrations/1000000000033-AddThermostatInstallationProfiles';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import {
	nativeTemperatureIdentity,
	nativeVoltmeterVoltageIdentity,
} from '../../devices-shelly-ng/contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { ShellyGuardRpcSession } from '../../devices-shelly-ng/services/shelly-guard-rpc-session';
import {
	ThermostatInstallationAuditEntity,
	ThermostatInstallationEntity,
} from '../entities/thermostat-installation.entity';
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
		await db.destroy();
		await rm(directory, { recursive: true, force: true });
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
	it('a stale background profile-query failure cannot invalidate fresh human activation', async () => {
		await profiles.stage(claim.id, 0, setup, attestations(), 'operator');
		let fail: () => void;
		const read = jest.spyOn(db.manager, 'findOneByOrFail').mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = () => reject(new Error('stale profile query failed'));
				}),
		);
		const background = loader.verify(claim.id);
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
			read.mockRestore();
			await background;
		}
	});
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
});
