import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';

import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { DelegatesManagerService } from '../../devices-shelly-ng/delegates/delegates-manager.service';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	ShellyGuardFenceReadback,
	ShellyGuardRpcSession,
} from '../../devices-shelly-ng/services/shelly-guard-rpc-session';
import { CapturedThermostatReconcileReadiness, SHELLY_GUARDED_PROFILE, SHELLY_GUARDED_PROFILE_VERSION } from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { ThermostatActuationAdapter, VirtualThermostatTransportService } from './virtual-thermostat-transport.service';

describe('thermostat qualified guard bridge and core sample acceptance', () => {
	let target: IDevicePropertyData;
	let qualification: ThermostatInstalledQualification;
	let accepted: QualifiedPropertySample;
	let sourceCurrent: boolean;
	let admission: boolean;
	let readback: ShellyGuardFenceReadback;
	let transport: VirtualThermostatTransportService;
	let session: { fence: jest.Mock; on: jest.Mock };
	let admittedSample: jest.Mock;
	beforeEach(() => {
		const device = Object.assign(new ShellyNgDeviceEntity(), { id: randomUUID(), canonicalMac: '000000000001' });
		const channel = Object.assign(new ShellyNgChannelEntity(), { id: randomUUID(), identifier: 'switch:0', device });
		const property = Object.assign(new ShellyNgChannelPropertyEntity(), {
			id: randomUUID(),
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		target = { device, channel, property, value: false };
		qualification = {
			physicalIdentity: thermostatActuatorIdentity(property, channel, device),
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'physical',
				model: 'SNSW-001P16EU',
				firmware: 'fixture-only',
				componentId: 0,
				evidenceId: 'fixture-only',
				revision: 1,
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
				testedLeaseSeconds: { min: 1, max: 30 },
				guardScript: {
					scriptId: 1,
					sourceHash: 'a'.repeat(64),
					endpointHostname: '127.0.0.1',
					canonicalMac: '000000000001',
					evidenceId: 'fixture-only',
					protocol: 'sp-guard-candidate-1',
					writerIsolationEvidenceId: 'fixture-only',
					commissioningBarrierEvidenceId: 'fixture-only',
					endpointAuthenticationEvidenceId: 'fixture-only',
					restartDrainEvidenceId: 'fixture-only',
					localExecutionBoundsEvidenceId: 'fixture-only',
				},
			},
		};
		const now = new Date();
		sourceCurrent = true;
		admission = true;
		readback = {
			proofId: 'fixture-proof',
			connectionIdentity: 'fixture-connection',
			output: false,
			wasOn: false,
			epoch: 11,
			isCurrent: () => sourceCurrent && admission,
			evidence: {
				sampledAt: now,
				receivedAt: now,
				observedAt: now,
				provenance: 'live',
				isCurrent: () => sourceCurrent && admission,
				sourceIsCurrent: () => sourceCurrent,
			},
		};
		accepted = {
			propertyId: property.id,
			value: false,
			sampledAt: new Date(now.getTime() - 5000),
			receivedAt: new Date(now.getTime() - 5000),
			provenance: 'live',
			quality: 'good',
			reasons: [],
		};
		session = {
			fence: jest.fn().mockResolvedValue(readback),
			on: jest.fn().mockResolvedValue({ outcome: 'accepted', outputConfirmed: false, pendingOnDrained: false }),
		};
		admittedSample = jest.fn((_property, value: ShellyGuardFenceReadback) => {
			accepted = { ...accepted, sampledAt: value.evidence.sampledAt, receivedAt: value.evidence.receivedAt };
			return Promise.resolve();
		});
		const manager = {
			prepareGuardRpcSession: () => session as unknown as ShellyGuardRpcSession,
			admitGuardFenceSample: admittedSample,
		} as unknown as DelegatesManagerService;
		transport = new VirtualThermostatTransportService(
			{ get: () => new ShellyNgDevicePlatform(manager) } as unknown as PlatformRegistryService,
			{ readQualifiedSample: () => accepted } as unknown as PropertyValueService,
		);
	});
	it('exposes the versioned real Shelly profile and refuses unsupported claim profiles', () => {
		const adapter = transport.get(target);
		expect(adapter.contractVersion).toBe(1);
		expect(adapter.providerProfile).toEqual({ id: 'shelly-ng.guarded-switch', version: 1 });
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			providerProfile: 'home-assistant.native-unit',
			providerProfileVersion: 1,
		});
		expect(transport.get(target, claim)).toBeNull();
		claim.providerProfile = 'shelly-ng.guarded-switch';
		claim.providerProfileVersion = 2;
		expect(transport.get(target, claim)).toBeNull();
	});

	it('requires an ordered script qualification before permitting any ON', async () => {
		delete (qualification.profile as unknown as Record<string, unknown>).guardScript;
		const adapter = transport.get(target);
		expect(adapter.canReconcile(target, qualification)).toBe(false);
		expect(
			await adapter.send(
				{ ...target, value: true },
				{ physicalIdentity: qualification.physicalIdentity, leaseSeconds: 5 } as VirtualThermostatActuatorClaimEntity,
				qualification,
				() => true,
			),
		).toMatchObject({ outcome: 'refused' });
		expect(session.on).not.toHaveBeenCalled();
	});
	it('admits newly observed OFF through core storage and matches the accepted sample before constructing scoped proof', async () => {
		const adapter = transport.get(target);
		const old = accepted;
		const scope = {
			controllerId: 'controller',
			controllerRevision: 4,
			claimId: 'claim',
			claimRevision: 2,
			contractFingerprint: 'contract',
			qualification,
		};
		const proof = await adapter.reconcile(target, ['earlier-on'], old, () => admission, scope);
		expect(admittedSample).toHaveBeenCalledWith(target.property, readback);
		expect(proof).toMatchObject({
			scope: { controllerRevision: 4, claimRevision: 2 },
			coveredCommandIds: ['earlier-on'],
			externalWriterBarrier: true,
		});
		expect(proof.offSample.receivedAt.getTime()).toBeGreaterThan(old.receivedAt.getTime());
		sourceCurrent = false;
		expect(proof.isCurrent()).toBe(false);
	});
	it('never mints release proof from unaccepted, retained, or changed-source readback', async () => {
		admittedSample.mockImplementation(() => Promise.resolve());
		const adapter = transport.get(target);
		const scope = {
			controllerId: 'controller',
			controllerRevision: 4,
			claimId: 'claim',
			claimRevision: 2,
			contractFingerprint: 'contract',
			qualification,
		};
		expect(await adapter.reconcile(target, [], accepted, () => true, scope)).toBeNull();
		accepted = {
			...accepted,
			sampledAt: readback.evidence.sampledAt,
			receivedAt: readback.evidence.receivedAt,
			provenance: 'retained' as never,
		};
		expect(await adapter.reconcile(target, [], accepted, () => true, scope)).toBeNull();
		sourceCurrent = false;
		expect(await adapter.reconcile(target, [], accepted, () => true, scope)).toBeNull();
	});
});


/** Synthetic provider/session boundary only; no installed qualification, device, sample or network proof. */
describe('captured thermostat transport readiness continuity', () => {
	const fixture = async () => {
		const registry = new PlatformRegistryService();
		const readSample = jest.fn();
		const module = await Test.createTestingModule({ providers: [
			VirtualThermostatTransportService,
			{ provide: PlatformRegistryService, useValue: registry },
			{ provide: PropertyValueService, useValue: { readQualifiedSample: readSample } },
		] }).compile();
		const transport = module.get(VirtualThermostatTransportService);
		const device = Object.assign(new ShellyNgDeviceEntity(), { id: randomUUID(), identifier: 'synthetic-device', canonicalMac: '000000000001' });
		const channel = Object.assign(new ShellyNgChannelEntity(), { id: randomUUID(), identifier: 'switch:0', device });
		const property = Object.assign(new ShellyNgChannelPropertyEntity(), { id: randomUUID(), channel, identifier: 'output', category: PropertyCategory.ON, dataType: DataTypeType.BOOL, permissions: [PermissionType.READ_WRITE] });
		const target: IDevicePropertyData = { device, channel, property, value: false };
		const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
		if (!physicalIdentity) throw new Error('Expected synthetic canonical actuator identity');
		const machine = { current: true };
		const qualificationGeneration = 'synthetic-existing-generation';
		const providerProfile = { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION };
		const qualification: ThermostatInstalledQualification = {
			contractVersion: 1, providerProfile, physicalIdentity, qualificationGeneration,
			machineLeaseIsCurrent: () => machine.current, upstreamWritersExcluded: true, opposedOutputsInterlocked: false,
			profile: { deviceId: 'synthetic-device', model: 'SNSW-001P16EU', firmware: 'synthetic-only', componentId: 0,
				evidenceId: 'synthetic-not-installed', revision: 1, releaseOrderingQualified: true, independentProtectionQualified: true,
				testedLeaseSeconds: { min: 1, max: 30 },
				guardScript: { scriptId: 1, sourceHash: 'a'.repeat(64), endpointHostname: '127.0.0.1', canonicalMac: '000000000001',
					evidenceId: 'synthetic-not-installed', protocol: 'sp-guard-candidate-1', writerIsolationEvidenceId: 'synthetic-only',
					commissioningBarrierEvidenceId: 'synthetic-only', endpointAuthenticationEvidenceId: 'synthetic-only', restartDrainEvidenceId: 'synthetic-only', localExecutionBoundsEvidenceId: 'synthetic-only' },
			},
		};
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), { id: randomUUID(), controllerId: randomUUID(), revision: 1,
			role: 'heating', state: 'reserved', providerProfile: providerProfile.id, providerProfileVersion: providerProfile.version,
			physicalIdentity, qualificationGeneration, leaseSeconds: 5,
			sourcePropertyId: property.id, sourcePropertyIdentity: property.id, sourceDeviceId: device.id, sourceDeviceIdentity: device.id,
			contractFingerprint: thermostatPropertyContract(property, channel, device) });
		const capture = () => transport.captureReconcileReadiness(target, claim, qualification);
		const requiredCapture = () => { const result = capture(); if (!result) throw new Error('Expected original transport capture'); return result; };
		const custom = () => {
			const ready = { current: true, allowed: true };
			const original: CapturedThermostatReconcileReadiness = Object.freeze({ capabilityVersion: 1,
				providerProfile: Object.freeze({ ...providerProfile }), physicalIdentity, qualificationGeneration,
				isCurrent: () => ready.current });
			const canReconcile = jest.fn<boolean, [IDevicePropertyData, ThermostatInstalledQualification]>(() => ready.allowed);
			const captureReadiness = jest.fn<CapturedThermostatReconcileReadiness | null, [IDevicePropertyData, ThermostatInstalledQualification]>(() => original);
			const send = jest.fn<ReturnType<ThermostatActuationAdapter['send']>, Parameters<ThermostatActuationAdapter['send']>>().mockResolvedValue({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
			const reconcile = jest.fn<ReturnType<ThermostatActuationAdapter['reconcile']>, Parameters<ThermostatActuationAdapter['reconcile']>>().mockResolvedValue(null);
			const adapter: ThermostatActuationAdapter = { contractVersion: 1, providerProfile: { ...providerProfile }, canReconcile, captureReconcileReadiness: captureReadiness, send, reconcile };
			return { adapter, ready, original, canReconcile, captureReadiness, send, reconcile };
		};
		const builtin = async () => {
			// Actual session metadata guard with an explicitly synthetic delegate/provider lease.
			// Auto-mocked RPC constructor opens no WebSocket and grants no installed authority.
			const { GuardedShellyRpcHandler: MockRpc } = jest.createMockFromModule<typeof import('../../devices-shelly-ng/services/guarded-shelly-rpc')>('../../devices-shelly-ng/services/guarded-shelly-rpc');
			const rpc = new MockRpc('127.0.0.1', { clientId: 'synthetic-only', requestTimeout: 1, pingInterval: 0, reconnectInterval: 0 });
			Object.defineProperty(rpc, 'connected', { value: true });
			Object.defineProperty(rpc, 'hostname', { value: '127.0.0.1' });
			const firstState = { current: true };
			let session = new ShellyGuardRpcSession(rpc, 0, qualification.profile, () => firstState.current);
			const originalSession = session;
			const on = jest.spyOn(session, 'on');
			const fence = jest.spyOn(session, 'fence');
			const prepare = jest.fn<ShellyGuardRpcSession | null, Parameters<DelegatesManagerService['prepareGuardRpcSession']>>(() => session);
			const providerModule = await Test.createTestingModule({ providers: [ShellyNgDevicePlatform,
				{ provide: DelegatesManagerService, useValue: { prepareGuardRpcSession: prepare } },
			] }).compile();
			const platform = providerModule.get(ShellyNgDevicePlatform);
			const owner = registry.registerOwned(platform);
			if (!owner) throw new Error('Expected actual platform registration');
			return { platform, owner, prepare, rpc, on, fence, firstState, originalSession,
				replaceSession: () => { session = new ShellyGuardRpcSession(rpc, 0, qualification.profile, () => true); return session; },
				cleanup: () => providerModule.close() };
		};
		return { module, transport, registry, readSample, target, claim, qualification, machine, capture, requiredCapture, custom, builtin };
	};

	it('returns only frozen read-only evidence for a trusted optional capture and never sends, reconciles or reads samples', async () => {
		const f = await fixture();
		try {
			const p = f.custom(); f.transport.register(f.target.device.type, p.adapter);
			const original = f.requiredCapture();
			expect(Object.isFrozen(original)).toBe(true); expect(Object.isFrozen(original.providerProfile)).toBe(true);
			expect(Object.keys(original).sort()).toEqual(['capabilityVersion', 'isCurrent', 'physicalIdentity', 'providerProfile', 'qualificationGeneration']);
			expect(original.isCurrent()).toBe(true); expect(original.isCurrent()).toBe(true);
			expect(p.captureReadiness).toHaveBeenCalledTimes(1);
			expect(f.transport.get(f.target, f.claim)).toBe(p.adapter);
			expect(original.isCurrent()).toBe(true); // Ordinary get/capture has no registration mutation.
			expect(p.send).not.toHaveBeenCalled(); expect(p.reconcile).not.toHaveBeenCalled(); expect(f.readSample).not.toHaveBeenCalled();
			p.ready.current = false; expect(original.isCurrent()).toBe(false);
		} finally { await f.module.close(); }
	});

	it('keeps legacy adapters ordinary-compatible but bridge-closed without the optional pure capability', async () => {
		const f = await fixture();
		try {
			const p = f.custom(); delete p.adapter.captureReconcileReadiness;
			f.transport.register(f.target.device.type, p.adapter);
			expect(f.transport.get(f.target, f.claim)).toBe(p.adapter);
			expect(f.capture()).toBeNull(); expect(p.canReconcile).not.toHaveBeenCalled();
			expect(p.send).not.toHaveBeenCalled(); expect(p.reconcile).not.toHaveBeenCalled();
		} finally { await f.module.close(); }
	});

	it('refuses false trusted readiness, incompatible profiles and missing original capabilities', async () => {
		const f = await fixture();
		try {
			const p = f.custom(); f.transport.register(f.target.device.type, p.adapter);
			p.ready.allowed = false; expect(f.capture()).toBeNull(); expect(p.captureReadiness).not.toHaveBeenCalled();
			p.ready.allowed = true; p.captureReadiness.mockReturnValueOnce(null); expect(f.capture()).toBeNull();
			p.captureReadiness.mockReturnValueOnce({ ...p.original, qualificationGeneration: 'unmatched' }); expect(f.capture()).toBeNull();
			Object.assign(p.adapter.providerProfile, { version: 2 }); expect(f.capture()).toBeNull();
		} finally { await f.module.close(); }
	});

	it.each(['qualification-generation', 'claim-generation', 'machine-guard', 'physical-identity'] as const)('fails closed for missing or mismatched %s', async (missing) => {
		const f = await fixture();
		try {
			const p = f.custom(); f.transport.register(f.target.device.type, p.adapter);
			if (missing === 'qualification-generation') Object.assign(f.qualification, { qualificationGeneration: undefined });
			else if (missing === 'claim-generation') f.claim.qualificationGeneration = 'other-generation';
			else if (missing === 'machine-guard') Object.assign(f.qualification, { machineLeaseIsCurrent: undefined });
			else Object.assign(f.qualification, { physicalIdentity: 'unmatched' });
			expect(f.capture()).toBeNull(); expect(p.captureReadiness).not.toHaveBeenCalled();
		} finally { await f.module.close(); }
	});

	it.each(['same-object', 'different-object'] as const)('scopes old unregister to original owner across %s ABA and duplicate refusal', async (replacement) => {
		const f = await fixture();
		try {
			const a = f.custom(), b = replacement === 'same-object' ? a : f.custom();
			const disposeA = f.transport.register(f.target.device.type, a.adapter), original = f.requiredCapture();
			expect(() => f.transport.register(f.target.device.type, b.adapter)).toThrow('already registered');
			expect(original.isCurrent()).toBe(true);
			disposeA(); expect(original.isCurrent()).toBe(false);
			f.transport.register(f.target.device.type, b.adapter); const successor = f.requiredCapture();
			disposeA(); disposeA(); expect(original.isCurrent()).toBe(false); expect(successor.isCurrent()).toBe(true);
			expect(f.transport.get(f.target)).toBe(b.adapter);
		} finally { await f.module.close(); }
	});

	it('captures one original builtin session rather than comparing newly allocated ordinary wrappers', async () => {
		const f = await fixture(), b = await f.builtin();
		try {
			const original = f.requiredCapture(); expect(b.prepare).toHaveBeenCalledTimes(1);
			const wrapperA = f.transport.get(f.target), wrapperB = f.transport.get(f.target);
			expect(wrapperA).not.toBe(wrapperB); expect(original.isCurrent()).toBe(true); expect(original.isCurrent()).toBe(true);
			expect(b.prepare).toHaveBeenCalledTimes(1);
			expect(b.rpc.request).not.toHaveBeenCalled(); expect(b.on).not.toHaveBeenCalled(); expect(b.fence).not.toHaveBeenCalled(); expect(f.readSample).not.toHaveBeenCalled();
		} finally { await b.cleanup(); await f.module.close(); }
	});

	it('cannot rescue original session A with a fresh session B even when ordinary canReconcile is true', async () => {
		const f = await fixture(), b = await f.builtin();
		try {
			const original = f.requiredCapture(); b.firstState.current = false; b.replaceSession();
			expect(f.transport.get(f.target).canReconcile(f.target, f.qualification)).toBe(true);
			const afterOrdinary = b.prepare.mock.calls.length;
			expect(original.isCurrent()).toBe(false); expect(b.prepare).toHaveBeenCalledTimes(afterOrdinary);
			const successor = f.requiredCapture(); expect(successor.isCurrent()).toBe(true); expect(original.isCurrent()).toBe(false);
		} finally { await b.cleanup(); await f.module.close(); }
	});

	it.each(['missing-session', 'missing-script', 'upstream', 'release-ordering', 'independent-protection'] as const)('requires actual builtin %s readiness without I/O', async (missing) => {
		const f = await fixture(), b = await f.builtin();
		try {
			if (missing === 'missing-session') b.prepare.mockReturnValueOnce(null);
			else if (missing === 'missing-script') Object.assign(f.qualification.profile, { guardScript: undefined });
			else if (missing === 'upstream') Object.assign(f.qualification, { upstreamWritersExcluded: false });
			else if (missing === 'release-ordering') Object.assign(f.qualification.profile, { releaseOrderingQualified: false });
			else Object.assign(f.qualification.profile, { independentProtectionQualified: false });
			expect(f.capture()).toBeNull(); expect(b.rpc.request).not.toHaveBeenCalled();
			expect(b.on).not.toHaveBeenCalled(); expect(b.fence).not.toHaveBeenCalled(); expect(f.readSample).not.toHaveBeenCalled();
		} finally { await b.cleanup(); await f.module.close(); }
	});

	it('invalidates builtin A on actual platform owner disposal and same-object re-registration', async () => {
		const f = await fixture(), b = await f.builtin();
		try {
			const original = f.requiredCapture(); b.owner.dispose(); expect(original.isCurrent()).toBe(false);
			const ownerB = f.registry.registerOwned(b.platform); if (!ownerB) throw new Error('Expected platform B owner');
			const successor = f.requiredCapture(); b.owner.dispose();
			expect(original.isCurrent()).toBe(false); expect(successor.isCurrent()).toBe(true);
		} finally { await b.cleanup(); await f.module.close(); }
	});

	it('invalidates builtin A across custom shadow then unshadow even when platform and session are unchanged', async () => {
		const f = await fixture(), b = await f.builtin();
		try {
			const original = f.requiredCapture(), p = f.custom();
			const remove = f.transport.register(f.target.device.type, p.adapter); expect(original.isCurrent()).toBe(false);
			remove(); expect(original.isCurrent()).toBe(false); expect(f.requiredCapture().isCurrent()).toBe(true);
		} finally { await b.cleanup(); await f.module.close(); }
	});

	it.each(['qualification-profile', 'qualification-generation', 'provider-profile', 'target-identity', 'claim-revision', 'machine-revoked'] as const)('rejects changed original %s without recapture', async (mutation) => {
		const f = await fixture();
		try {
			const p = f.custom(); f.transport.register(f.target.device.type, p.adapter); const original = f.requiredCapture();
			if (mutation === 'qualification-profile') Object.assign(f.qualification.profile, { revision: 2 });
			else if (mutation === 'qualification-generation') Object.assign(f.qualification, { qualificationGeneration: 'new' });
			else if (mutation === 'provider-profile') Object.assign(p.adapter.providerProfile, { version: 2 });
			else if (mutation === 'target-identity') f.target.property.id = randomUUID();
			else if (mutation === 'claim-revision') f.claim.revision++;
			else f.machine.current = false;
			expect(original.isCurrent()).toBe(false); expect(p.captureReadiness).toHaveBeenCalledTimes(1);
		} finally { await f.module.close(); }
	});

	it('fails closed for unknown/missing builtin session and terminal destroy cannot revive captures', async () => {
		const f = await fixture();
		try {
			expect(f.capture()).toBeNull(); const p = f.custom(); f.transport.register(f.target.device.type, p.adapter);
			const original = f.requiredCapture(); f.transport.onModuleDestroy(); f.transport.onModuleDestroy();
			expect(original.isCurrent()).toBe(false); expect(f.capture()).toBeNull(); expect(f.transport.get(f.target)).toBeNull();
			expect(() => f.transport.register(f.target.device.type, p.adapter)).toThrow('destroyed');
		} finally { await f.module.close(); }
	});
});
