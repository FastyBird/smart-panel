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
import {
	CapturedThermostatReconcileReadiness,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { RuntimeFeedbackConsumer } from './virtual-thermostat-transport.service';
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
		const module = await Test.createTestingModule({
			providers: [
				VirtualThermostatTransportService,
				{ provide: PlatformRegistryService, useValue: registry },
				{ provide: PropertyValueService, useValue: { readQualifiedSample: readSample } },
			],
		}).compile();
		const transport = module.get(VirtualThermostatTransportService);
		const device = Object.assign(new ShellyNgDeviceEntity(), {
			id: randomUUID(),
			identifier: 'synthetic-device',
			canonicalMac: '000000000001',
		});
		const channel = Object.assign(new ShellyNgChannelEntity(), { id: randomUUID(), identifier: 'switch:0', device });
		const property = Object.assign(new ShellyNgChannelPropertyEntity(), {
			id: randomUUID(),
			channel,
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const target: IDevicePropertyData = { device, channel, property, value: false };
		const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
		if (!physicalIdentity) throw new Error('Expected synthetic canonical actuator identity');
		const machine = { current: true };
		const qualificationGeneration = 'synthetic-existing-generation';
		const providerProfile = { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION };
		const qualification: ThermostatInstalledQualification = {
			contractVersion: 1,
			providerProfile,
			physicalIdentity,
			qualificationGeneration,
			machineLeaseIsCurrent: () => machine.current,
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			profile: {
				deviceId: 'synthetic-device',
				model: 'SNSW-001P16EU',
				firmware: 'synthetic-only',
				componentId: 0,
				evidenceId: 'synthetic-not-installed',
				revision: 1,
				releaseOrderingQualified: true,
				independentProtectionQualified: true,
				testedLeaseSeconds: { min: 1, max: 30 },
				guardScript: {
					scriptId: 1,
					sourceHash: 'a'.repeat(64),
					endpointHostname: '127.0.0.1',
					canonicalMac: '000000000001',
					evidenceId: 'synthetic-not-installed',
					protocol: 'sp-guard-candidate-1',
					writerIsolationEvidenceId: 'synthetic-only',
					commissioningBarrierEvidenceId: 'synthetic-only',
					endpointAuthenticationEvidenceId: 'synthetic-only',
					restartDrainEvidenceId: 'synthetic-only',
					localExecutionBoundsEvidenceId: 'synthetic-only',
				},
			},
		};
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: randomUUID(),
			controllerId: randomUUID(),
			revision: 1,
			role: 'heating',
			state: 'reserved',
			providerProfile: providerProfile.id,
			providerProfileVersion: providerProfile.version,
			physicalIdentity,
			qualificationGeneration,
			leaseSeconds: 5,
			sourcePropertyId: property.id,
			sourcePropertyIdentity: property.id,
			sourceDeviceId: device.id,
			sourceDeviceIdentity: device.id,
			contractFingerprint: thermostatPropertyContract(property, channel, device),
		});
		const capture = () => transport.captureReconcileReadiness(target, claim, qualification);
		const requiredCapture = () => {
			const result = capture();
			if (!result) throw new Error('Expected original transport capture');
			return result;
		};
		const custom = () => {
			const ready = { current: true, allowed: true };
			const original: CapturedThermostatReconcileReadiness = Object.freeze({
				capabilityVersion: 1,
				providerProfile: Object.freeze({ ...providerProfile }),
				physicalIdentity,
				qualificationGeneration,
				isCurrent: () => ready.current,
			});
			const canReconcile = jest.fn<boolean, [IDevicePropertyData, ThermostatInstalledQualification]>(
				() => ready.allowed,
			);
			const captureReadiness = jest.fn<
				CapturedThermostatReconcileReadiness | null,
				[IDevicePropertyData, ThermostatInstalledQualification]
			>(() => original);
			const send = jest
				.fn<ReturnType<ThermostatActuationAdapter['send']>, Parameters<ThermostatActuationAdapter['send']>>()
				.mockResolvedValue({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
			const reconcile = jest
				.fn<ReturnType<ThermostatActuationAdapter['reconcile']>, Parameters<ThermostatActuationAdapter['reconcile']>>()
				.mockResolvedValue(null);
			const adapter: ThermostatActuationAdapter = {
				contractVersion: 1,
				providerProfile: { ...providerProfile },
				canReconcile,
				captureReconcileReadiness: captureReadiness,
				send,
				reconcile,
			};
			return { adapter, ready, original, canReconcile, captureReadiness, send, reconcile };
		};
		const builtin = async () => {
			// Actual session metadata guard with an explicitly synthetic delegate/provider lease.
			// Auto-mocked RPC constructor opens no WebSocket and grants no installed authority.
			const { GuardedShellyRpcHandler: MockRpc } = jest.createMockFromModule<
				typeof import('../../devices-shelly-ng/services/guarded-shelly-rpc')
			>('../../devices-shelly-ng/services/guarded-shelly-rpc');
			const rpc = new MockRpc('127.0.0.1', {
				clientId: 'synthetic-only',
				requestTimeout: 1,
				pingInterval: 0,
				reconnectInterval: 0,
			});
			const request = jest.spyOn(rpc, 'request');
			Object.defineProperty(rpc, 'connected', { value: true });
			Object.defineProperty(rpc, 'hostname', { value: '127.0.0.1' });
			const firstState = { current: true };
			let session = new ShellyGuardRpcSession(rpc, 0, qualification.profile, () => firstState.current);
			const originalSession = session;
			const on = jest.spyOn(session, 'on');
			const fence = jest.spyOn(session, 'fence');
			const prepare = jest.fn<
				ShellyGuardRpcSession | null,
				Parameters<DelegatesManagerService['prepareGuardRpcSession']>
			>(() => session);
			const providerModule = await Test.createTestingModule({
				providers: [
					ShellyNgDevicePlatform,
					{ provide: DelegatesManagerService, useValue: { prepareGuardRpcSession: prepare } },
				],
			}).compile();
			const platform = providerModule.get(ShellyNgDevicePlatform);
			const owner = registry.registerOwned(platform);
			if (!owner) throw new Error('Expected actual platform registration');
			return {
				platform,
				owner,
				prepare,
				rpc,
				request,
				on,
				fence,
				firstState,
				originalSession,
				replaceSession: () => {
					session = new ShellyGuardRpcSession(rpc, 0, qualification.profile, () => true);
					return session;
				},
				cleanup: () => providerModule.close(),
			};
		};
		return {
			module,
			transport,
			registry,
			readSample,
			target,
			claim,
			qualification,
			machine,
			capture,
			requiredCapture,
			custom,
			builtin,
		};
	};

	// BEGIN R21 additive source-only drafts (UNRUN)
	it('R21 refuses an unregistered feedback consumer before invoking an existing adapter or evidence read', async () => {
		const f = await fixture(),
			supplied = f.custom();
		try {
			const scope = Object.freeze({
				controllerId: f.claim.controllerId,
				controllerRevision: 1,
				claimId: f.claim.id,
				claimRevision: f.claim.revision,
				contractFingerprint: f.claim.contractFingerprint,
				qualification: f.qualification,
			});
			const neverGuard = (): boolean => {
				throw new Error('A negative origin check must not execute command admission');
			};
			expect(() =>
				f.transport.openRuntimeReconciliationWork(new RuntimeFeedbackConsumer(), scope, supplied.adapter, neverGuard),
			).toThrow();
			expect(supplied.reconcile).not.toHaveBeenCalled();
			expect(supplied.send).not.toHaveBeenCalled();
			expect(f.readSample).not.toHaveBeenCalled();
			expect(f.transport.captureRuntimeFeedbackDelivery(Object.freeze({}))).toBeNull();
			f.transport.closeRuntimeFeedbackConsumer(new RuntimeFeedbackConsumer());
		} finally {
			await f.module.close();
		}
	});
	// BEGIN R31 negative-only transport contract drafts (UNRUN; no synthetic positive origin)
	it.each(['builtin', 'custom', 'on', 'missing-qualification', 'accessor-packet'] satisfies readonly string[])(
		'R31 refuses %s dispatch work from an unregistered consumer without guard/session/sample calls',
		async (kind) => {
			const f = await fixture(),
				native = await f.builtin(),
				custom = f.custom();
			let guards = 0,
				getters = 0;
			const guard = (): boolean => {
				guards++;
				throw new Error('A refused origin must not call a guard');
			};
			const packet =
				kind === 'accessor-packet'
					? Object.freeze({
							get commandId(): string {
								getters++;
								return 'forged';
							},
						})
					: Object.freeze({ commandId: 'forged' });
			try {
				const adapter = kind === 'custom' ? custom.adapter : f.transport.get(f.target, f.claim);
				if (!adapter) throw new Error('Builtin negative fixture missing');
				expect(
					f.transport.openRuntimeOffDispatchWork(
						new RuntimeFeedbackConsumer(),
						adapter,
						kind === 'on' ? { ...f.target, value: true } : f.target,
						f.claim,
						kind === 'missing-qualification' ? null : f.qualification,
						guard,
						packet,
					),
				).toBeNull();
				expect(guards).toBe(0);
				expect(getters).toBe(0);
				expect(native.prepare).not.toHaveBeenCalled();
				expect(native.fence).not.toHaveBeenCalled();
				expect(custom.send).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
				expect(f.transport.captureRuntimeFeedbackDelivery(Object.freeze({}))).toBeNull();
			} finally {
				await native.cleanup();
				await f.module.close();
			}
		},
	);
	// END R31 negative-only transport contract drafts
	// END R21 additive source-only drafts
	it('returns only frozen read-only evidence for a trusted optional capture and never sends, reconciles or reads samples', async () => {
		const f = await fixture();
		try {
			const p = f.custom();
			f.transport.register(f.target.device.type, p.adapter);
			const original = f.requiredCapture();
			expect(Object.isFrozen(original)).toBe(true);
			expect(Object.isFrozen(original.providerProfile)).toBe(true);
			expect(Object.keys(original).sort()).toEqual([
				'capabilityVersion',
				'isCurrent',
				'physicalIdentity',
				'providerProfile',
				'qualificationGeneration',
			]);
			expect(original.isCurrent()).toBe(true);
			expect(original.isCurrent()).toBe(true);
			expect(p.captureReadiness).toHaveBeenCalledTimes(1);
			expect(f.transport.get(f.target, f.claim)).toBe(p.adapter);
			expect(original.isCurrent()).toBe(true); // Ordinary get/capture has no registration mutation.
			expect(p.send).not.toHaveBeenCalled();
			expect(p.reconcile).not.toHaveBeenCalled();
			expect(f.readSample).not.toHaveBeenCalled();
			p.ready.current = false;
			expect(original.isCurrent()).toBe(false);
		} finally {
			await f.module.close();
		}
	});

	it('keeps legacy adapters ordinary-compatible but bridge-closed without the optional pure capability', async () => {
		const f = await fixture();
		try {
			const p = f.custom();
			delete p.adapter.captureReconcileReadiness;
			f.transport.register(f.target.device.type, p.adapter);
			expect(f.transport.get(f.target, f.claim)).toBe(p.adapter);
			expect(f.capture()).toBeNull();
			expect(p.canReconcile).not.toHaveBeenCalled();
			expect(p.send).not.toHaveBeenCalled();
			expect(p.reconcile).not.toHaveBeenCalled();
		} finally {
			await f.module.close();
		}
	});

	it('refuses false trusted readiness, incompatible profiles and missing original capabilities', async () => {
		const f = await fixture();
		try {
			const p = f.custom();
			f.transport.register(f.target.device.type, p.adapter);
			p.ready.allowed = false;
			expect(f.capture()).toBeNull();
			expect(p.captureReadiness).not.toHaveBeenCalled();
			p.ready.allowed = true;
			p.captureReadiness.mockReturnValueOnce(null);
			expect(f.capture()).toBeNull();
			p.captureReadiness.mockReturnValueOnce({ ...p.original, qualificationGeneration: 'unmatched' });
			expect(f.capture()).toBeNull();
			Object.assign(p.adapter.providerProfile, { version: 2 });
			expect(f.capture()).toBeNull();
		} finally {
			await f.module.close();
		}
	});

	it.each(['qualification-generation', 'claim-generation', 'machine-guard', 'physical-identity'] as const)(
		'fails closed for missing or mismatched %s',
		async (missing) => {
			const f = await fixture();
			try {
				const p = f.custom();
				f.transport.register(f.target.device.type, p.adapter);
				if (missing === 'qualification-generation')
					Object.assign(f.qualification, { qualificationGeneration: undefined });
				else if (missing === 'claim-generation') f.claim.qualificationGeneration = 'other-generation';
				else if (missing === 'machine-guard') Object.assign(f.qualification, { machineLeaseIsCurrent: undefined });
				else Object.assign(f.qualification, { physicalIdentity: 'unmatched' });
				expect(f.capture()).toBeNull();
				expect(p.captureReadiness).not.toHaveBeenCalled();
			} finally {
				await f.module.close();
			}
		},
	);

	it.each(['same-object', 'different-object'] as const)(
		'scopes old unregister to original owner across %s ABA and duplicate refusal',
		async (replacement) => {
			const f = await fixture();
			try {
				const a = f.custom(),
					b = replacement === 'same-object' ? a : f.custom();
				const disposeA = f.transport.register(f.target.device.type, a.adapter),
					original = f.requiredCapture();
				expect(() => f.transport.register(f.target.device.type, b.adapter)).toThrow('already registered');
				expect(original.isCurrent()).toBe(true);
				disposeA();
				expect(original.isCurrent()).toBe(false);
				f.transport.register(f.target.device.type, b.adapter);
				const successor = f.requiredCapture();
				disposeA();
				disposeA();
				expect(original.isCurrent()).toBe(false);
				expect(successor.isCurrent()).toBe(true);
				expect(f.transport.get(f.target)).toBe(b.adapter);
			} finally {
				await f.module.close();
			}
		},
	);

	it('captures one original builtin session rather than comparing newly allocated ordinary wrappers', async () => {
		const f = await fixture(),
			b = await f.builtin();
		try {
			const original = f.requiredCapture();
			expect(b.prepare).toHaveBeenCalledTimes(1);
			const wrapperA = f.transport.get(f.target),
				wrapperB = f.transport.get(f.target);
			expect(wrapperA).not.toBe(wrapperB);
			expect(original.isCurrent()).toBe(true);
			expect(original.isCurrent()).toBe(true);
			expect(b.prepare).toHaveBeenCalledTimes(1);
			expect(b.request).not.toHaveBeenCalled();
			expect(b.on).not.toHaveBeenCalled();
			expect(b.fence).not.toHaveBeenCalled();
			expect(f.readSample).not.toHaveBeenCalled();
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});

	it('cannot rescue original session A with a fresh session B even when ordinary canReconcile is true', async () => {
		const f = await fixture(),
			b = await f.builtin();
		try {
			const original = f.requiredCapture();
			b.firstState.current = false;
			b.replaceSession();
			expect(f.transport.get(f.target).canReconcile(f.target, f.qualification)).toBe(true);
			const afterOrdinary = b.prepare.mock.calls.length;
			expect(original.isCurrent()).toBe(false);
			expect(b.prepare).toHaveBeenCalledTimes(afterOrdinary);
			const successor = f.requiredCapture();
			expect(successor.isCurrent()).toBe(true);
			expect(original.isCurrent()).toBe(false);
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});

	it.each(['missing-session', 'missing-script', 'upstream', 'release-ordering', 'independent-protection'] as const)(
		'requires actual builtin %s readiness without I/O',
		async (missing) => {
			const f = await fixture(),
				b = await f.builtin();
			try {
				if (missing === 'missing-session') b.prepare.mockReturnValueOnce(null);
				else if (missing === 'missing-script') Object.assign(f.qualification.profile, { guardScript: undefined });
				else if (missing === 'upstream') Object.assign(f.qualification, { upstreamWritersExcluded: false });
				else if (missing === 'release-ordering')
					Object.assign(f.qualification.profile, { releaseOrderingQualified: false });
				else Object.assign(f.qualification.profile, { independentProtectionQualified: false });
				expect(f.capture()).toBeNull();
				expect(b.request).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(b.fence).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				await b.cleanup();
				await f.module.close();
			}
		},
	);

	it('invalidates builtin A on actual platform owner disposal and same-object re-registration', async () => {
		const f = await fixture(),
			b = await f.builtin();
		try {
			const original = f.requiredCapture();
			b.owner.dispose();
			expect(original.isCurrent()).toBe(false);
			const ownerB = f.registry.registerOwned(b.platform);
			if (!ownerB) throw new Error('Expected platform B owner');
			const successor = f.requiredCapture();
			b.owner.dispose();
			expect(original.isCurrent()).toBe(false);
			expect(successor.isCurrent()).toBe(true);
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});

	it('invalidates builtin A across custom shadow then unshadow even when platform and session are unchanged', async () => {
		const f = await fixture(),
			b = await f.builtin();
		try {
			const original = f.requiredCapture(),
				p = f.custom();
			const remove = f.transport.register(f.target.device.type, p.adapter);
			expect(original.isCurrent()).toBe(false);
			remove();
			expect(original.isCurrent()).toBe(false);
			expect(f.requiredCapture().isCurrent()).toBe(true);
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});

	it.each([
		'qualification-profile',
		'qualification-generation',
		'provider-profile',
		'target-identity',
		'claim-revision',
		'machine-revoked',
	] as const)('rejects changed original %s without recapture', async (mutation) => {
		const f = await fixture();
		try {
			const p = f.custom();
			f.transport.register(f.target.device.type, p.adapter);
			const original = f.requiredCapture();
			if (mutation === 'qualification-profile') Object.assign(f.qualification.profile, { revision: 2 });
			else if (mutation === 'qualification-generation')
				Object.assign(f.qualification, { qualificationGeneration: 'new' });
			else if (mutation === 'provider-profile') Object.assign(p.adapter.providerProfile, { version: 2 });
			else if (mutation === 'target-identity') f.target.property.id = randomUUID();
			else if (mutation === 'claim-revision') f.claim.revision++;
			else f.machine.current = false;
			expect(original.isCurrent()).toBe(false);
			expect(p.captureReadiness).toHaveBeenCalledTimes(1);
		} finally {
			await f.module.close();
		}
	});

	it.each([
		'stable-property',
		'stable-device',
		'property-channel-string',
		'property-channel-entity',
		'channel-device-string',
		'channel-device-entity',
	] as const)('refuses an already-wrong custom baseline %s before invoking any adapter predicate', async (mismatch) => {
		const f = await fixture();
		try {
			const p = f.custom();
			f.transport.register(f.target.device.type, p.adapter);
			if (mismatch === 'stable-property') f.claim.sourcePropertyIdentity = randomUUID();
			else if (mismatch === 'stable-device') f.claim.sourceDeviceIdentity = randomUUID();
			else if (mismatch === 'property-channel-string') f.target.property.channel = randomUUID();
			else if (mismatch === 'property-channel-entity')
				f.target.property.channel = Object.assign(new ShellyNgChannelEntity(), {
					id: randomUUID(),
					device: f.target.device,
				});
			else if (mismatch === 'channel-device-string') f.target.channel.device = randomUUID();
			else
				f.target.channel.device = Object.assign(new ShellyNgDeviceEntity(), {
					id: randomUUID(),
					canonicalMac: '000000000001',
				});
			// An otherwise matching fingerprint cannot establish either stable identity or the back references.
			f.claim.contractFingerprint = thermostatPropertyContract(f.target.property, f.target.channel, f.target.device);
			expect(f.capture()).toBeNull();
			expect(p.canReconcile).not.toHaveBeenCalled();
			expect(p.captureReadiness).not.toHaveBeenCalled();
			expect(p.send).not.toHaveBeenCalled();
			expect(p.reconcile).not.toHaveBeenCalled();
		} finally {
			await f.module.close();
		}
	});

	it.each(['stable-property', 'stable-device'] as const)(
		'rejects an already-wrong builtin claim %s before preparing a session',
		async (mismatch) => {
			const f = await fixture(),
				b = await f.builtin();
			try {
				if (mismatch === 'stable-property') f.claim.sourcePropertyIdentity = randomUUID();
				else f.claim.sourceDeviceIdentity = randomUUID();
				expect(f.capture()).toBeNull();
				expect(b.prepare).not.toHaveBeenCalled();
				expect(b.request).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(b.fence).not.toHaveBeenCalled();
			} finally {
				await b.cleanup();
				await f.module.close();
			}
		},
	);

	it.each(['custom', 'builtin'] as const)(
		'accepts exactly matching string back references for %s without changing ordinary eligibility',
		async (kind) => {
			const f = await fixture();
			const b = kind === 'builtin' ? await f.builtin() : null;
			try {
				if (kind === 'custom') {
					const p = f.custom();
					f.transport.register(f.target.device.type, p.adapter);
				}
				f.target.property.channel = f.target.channel.id;
				f.target.channel.device = f.target.device.id;
				expect(f.requiredCapture().isCurrent()).toBe(true);
			} finally {
				if (b) await b.cleanup();
				await f.module.close();
			}
		},
	);

	it('fails closed for unknown/missing builtin session and terminal destroy cannot revive captures', async () => {
		const f = await fixture();
		try {
			expect(f.capture()).toBeNull();
			const p = f.custom();
			f.transport.register(f.target.device.type, p.adapter);
			const original = f.requiredCapture();
			f.transport.onModuleDestroy();
			f.transport.onModuleDestroy();
			expect(original.isCurrent()).toBe(false);
			expect(f.capture()).toBeNull();
			expect(f.transport.get(f.target)).toBeNull();
			expect(() => f.transport.register(f.target.device.type, p.adapter)).toThrow('destroyed');
		} finally {
			await f.module.close();
		}
	});
	// BEGIN R37 trusted getter metadata drafts (UNRUN; no native acceptance authority)
	// This existing inert provider fixture proves optional metadata eligibility/negative callbacks only.
	it.each(['canonical', 'unshadowed-intermediate'] satisfies readonly string[])(
		'R37 pins the original %s Shelly type chain without guard, session or sample work',
		async (shape) => {
			const f = await fixture(), b = await f.builtin();
			const prototype: object | null = Object.getPrototypeOf(f.target.device);
			const consumer = f.transport.registerRuntimeFeedbackConsumer({
				reconcile: () => undefined,
				dispatch: () => undefined,
				onModuleDestroy: () => undefined,
			});
			let guards = 0;
			const guard = (): boolean => { guards++; throw new Error('Metadata must not invoke guard'); };
			try {
				if (shape === 'unshadowed-intermediate') Object.setPrototypeOf(f.target.device, Object.create(prototype));
				expect(Object.getOwnPropertyDescriptor(f.target.device, 'type')).toBeUndefined();
				const adapter = f.transport.get(f.target, f.claim);
				if (!adapter) throw new Error('Expected builtin metadata adapter');
				const work = f.transport.openRuntimeOffDispatchWork(
					consumer, adapter, f.target, f.claim, f.qualification,
					guard, Object.freeze({ commandId: randomUUID() }),
				);
				expect(work).not.toBeNull();
				if (work) f.transport.closeRuntimeOffDispatchWork(work);
				expect(guards).toBe(0);
				expect(b.prepare).not.toHaveBeenCalled();
				expect(b.fence).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Object.setPrototypeOf(f.target.device, prototype);
				f.transport.closeRuntimeFeedbackConsumer(consumer);
				await b.cleanup();
				await f.module.close();
			}
		},
	);
	it.each([
		'own-data', 'own-getter', 'nearer-getter', 'canonical-getter', 'canonical-setter',
		'canonical-flags', 'other-getter', 'inherited-data',
	] satisfies readonly string[])(
		'R37 refuses %s without invoking its accessor or borrowing native authority',
		async (shape) => {
			const f = await fixture(), b = await f.builtin();
			const adapter = f.transport.get(f.target, f.claim);
			if (!adapter) throw new Error('Expected builtin metadata adapter');
			const canonical = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');
			if (!canonical) throw new Error('Original Shelly getter missing');
			const devicePrototype: object | null = Object.getPrototypeOf(f.target.device),
				propertyPrototype: object | null = Object.getPrototypeOf(f.target.property),
				enabled = Object.getOwnPropertyDescriptor(f.target.device, 'enabled'),
				unit = Object.getOwnPropertyDescriptor(f.target.property, 'unit');
			const consumer = f.transport.registerRuntimeFeedbackConsumer({
				reconcile: () => undefined, dispatch: () => undefined, onModuleDestroy: () => undefined,
			});
			let getters = 0, guards = 0;
			const getter = (): string => { getters++; return 'devices-shelly-ng'; };
			try {
				if (shape === 'own-data') Object.defineProperty(f.target.device, 'type', { value: 'devices-shelly-ng', configurable: true });
				else if (shape === 'own-getter') Object.defineProperty(f.target.device, 'type', { get: getter, configurable: true });
				else if (shape === 'nearer-getter') {
					const nearer: object = Object.create(devicePrototype);
					Object.defineProperty(nearer, 'type', { get: getter, configurable: true });
					Object.setPrototypeOf(f.target.device, nearer);
				} else if (shape === 'canonical-getter') Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, get: getter });
				else if (shape === 'canonical-setter') Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, set: () => undefined });
				else if (shape === 'canonical-flags') Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, enumerable: !canonical.enumerable });
				else if (shape === 'other-getter') Object.defineProperty(f.target.device, 'enabled', { get: () => { getters++; return true; }, configurable: true });
				else {
					Reflect.deleteProperty(f.target.property, 'unit');
					const nearer: object = Object.create(propertyPrototype);
					Object.defineProperty(nearer, 'unit', { value: null, configurable: true });
					Object.setPrototypeOf(f.target.property, nearer);
				}
				expect(f.transport.openRuntimeOffDispatchWork(
					consumer, adapter, f.target, f.claim, f.qualification,
					() => { guards++; throw new Error('Refused metadata must not call guard'); },
					Object.freeze({ commandId: randomUUID() }),
				)).toBeNull();
				expect(getters).toBe(0);
				expect(guards).toBe(0);
				expect(b.prepare).not.toHaveBeenCalled();
				expect(b.fence).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Reflect.deleteProperty(f.target.device, 'type');
				Object.setPrototypeOf(f.target.device, devicePrototype);
				Object.setPrototypeOf(f.target.property, propertyPrototype);
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', canonical);
				if (enabled) Object.defineProperty(f.target.device, 'enabled', enabled);
				else Reflect.deleteProperty(f.target.device, 'enabled');
				if (unit) Object.defineProperty(f.target.property, 'unit', unit);
				else Reflect.deleteProperty(f.target.property, 'unit');
				f.transport.closeRuntimeFeedbackConsumer(consumer);
				await b.cleanup();
				await f.module.close();
			}
		},
	);
	// END R37 trusted getter metadata drafts

	// BEGIN R24 unknown-result additive drafts (UNRUN)
	// Transport-boundary fixture only: the held session readback and admission sink are inert;
	// this exercises the actual builtin adapter/platform pins, not RPC or storage qualification.
	it.each(['prepareGuardRpcSession', 'admitGuardFenceSample', 'matching-owner'])(
		'keeps the held original fence result conservative for %s',
		async (method) => {
			const f = await fixture(),
				b = await f.builtin();
			const originalPrepare = jest.spyOn(b.platform, 'prepareGuardRpcSession');
			const originalAdmit = jest.spyOn(b.platform, 'admitGuardFenceSample').mockResolvedValue(undefined);
			const protective = jest.spyOn(b.platform, 'processProtectiveCommand');
			const fenceGate: { release?: (value: ShellyGuardFenceReadback | null) => void } = {};
			const entryGate: { entered?: () => void } = {};
			const heldFence = new Promise<ShellyGuardFenceReadback | null>((resolve) => {
				fenceGate.release = resolve;
			});
			const entered = new Promise<void>((resolve) => {
				entryGate.entered = resolve;
			});
			b.fence.mockImplementationOnce(() => {
				if (!entryGate.entered) throw new Error('Expected original fence entry gate');
				entryGate.entered();
				return heldFence;
			});
			try {
				const adapter = f.transport.get(f.target, f.claim);
				if (!adapter) throw new Error('Expected actual builtin adapter');
				const admitted = (): boolean => b.originalSession.isCurrent();
				const sending = adapter.send(f.target, f.claim, f.qualification, admitted);
				await entered;
				expect(originalPrepare).toHaveBeenCalledTimes(1);
				expect(originalPrepare).toHaveBeenCalledWith(f.target, f.qualification.profile);
				expect(b.prepare).toHaveBeenCalledTimes(1);
				expect(b.fence).toHaveBeenCalledTimes(1);
				expect(b.fence).toHaveBeenCalledWith(1000, admitted);
				let replacementPrepare: typeof originalPrepare | undefined;
				let replacementAdmit: typeof originalAdmit | undefined;
				if (method === 'prepareGuardRpcSession') {
					originalPrepare.mockRestore();
					replacementPrepare = jest.spyOn(b.platform, 'prepareGuardRpcSession');
				} else if (method === 'admitGuardFenceSample') {
					originalAdmit.mockRestore();
					replacementAdmit = jest.spyOn(b.platform, 'admitGuardFenceSample');
				}
				const now = new Date();
				const readback: ShellyGuardFenceReadback = {
					proofId: 'synthetic-held-fence',
					connectionIdentity: b.originalSession.connectionIdentity,
					output: false,
					wasOn: true,
					epoch: 11,
					isCurrent: admitted,
					evidence: {
						sampledAt: now,
						receivedAt: now,
						observedAt: now,
						provenance: 'live',
						isCurrent: admitted,
						sourceIsCurrent: admitted,
					},
				};
				if (!fenceGate.release) throw new Error('Expected original fence release gate');
				fenceGate.release(readback);
				if (method === 'matching-owner') {
					await expect(sending).resolves.toEqual({
						outcome: 'accepted',
						wasOn: true,
						outputConfirmed: false,
						pendingOnDrained: false,
					});
					expect(originalAdmit).toHaveBeenCalledTimes(1);
					expect(originalAdmit).toHaveBeenCalledWith(f.target, readback);
				} else {
					await expect(sending).resolves.toEqual({
						outcome: 'unknown',
						reasons: ['original_guard_platform_lost'],
						outputConfirmed: false,
						pendingOnDrained: false,
					});
					expect(originalAdmit).not.toHaveBeenCalled();
				}
				if (replacementPrepare) expect(replacementPrepare).not.toHaveBeenCalled();
				if (replacementAdmit) expect(replacementAdmit).not.toHaveBeenCalled();
				expect(b.prepare).toHaveBeenCalledTimes(1);
				expect(b.fence).toHaveBeenCalledTimes(1);
				expect(protective).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(b.request).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				fenceGate.release?.(null);
				b.owner.dispose();
				jest.restoreAllMocks();
				await b.cleanup();
				await f.module.close();
			}
		},
	);
	// END R24 unknown-result additive drafts (UNRUN)
});
