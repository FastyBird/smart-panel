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
	CapturedThermostatReconcileReadinessV1,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
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
	let platform: ShellyNgDevicePlatform;
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
		platform = new ShellyNgDevicePlatform(manager);
		const platforms = new PlatformRegistryService();
		platforms.register(platform);
		transport = new VirtualThermostatTransportService(platforms, {
			readQualifiedSample: () => accepted,
		} as unknown as PropertyValueService);
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
	it('retains the original adapter dispatch and cannot dispose or adopt a successor registration', async () => {
		const originalSend = jest.fn().mockResolvedValue({ outcome: 'refused', reasons: ['fixture-only'] });
		const original = { ...transport.get(target), send: originalSend };
		const dispose = transport.register(target.device.type, original);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			providerProfile: 'shelly-ng.guarded-switch',
			providerProfileVersion: 1,
		});
		const captured = transport.capture(target, claim);
		expect(captured.isCurrent()).toBe(true);
		dispose();
		const successorSend = jest.fn();
		const successor = { ...original, send: successorSend };
		const disposeSuccessor = transport.register(target.device.type, successor);
		dispose();
		expect(transport.get(target, claim)).toBe(successor);
		expect(captured.isCurrent()).toBe(false);
		original.send = successorSend;
		await captured.send(target, claim, qualification, () => false, { commandId: 'original-command' });
		expect(originalSend).toHaveBeenCalledTimes(1);
		expect(originalSend.mock.contexts[0]).toBe(original);
		expect(successorSend).not.toHaveBeenCalled();
		disposeSuccessor();
	});

	it('captures the remote native OFF destination before a platform replacement', async () => {
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			physicalIdentity: qualification.physicalIdentity,
			providerProfile: 'shelly-ng.remote-dew-point-lease',
			providerProfileVersion: 1,
			role: 'cooling',
		});
		const original = jest
			.spyOn(platform, 'processProtectiveCommand')
			.mockResolvedValue({ outcome: 'unknown', outputConfirmed: false, pendingOnDrained: false });
		const captured = transport.capture(target, claim, null);
		expect(captured.isCurrent()).toBe(true);
		const replacement = jest.fn();
		platform.processProtectiveCommand = replacement;
		expect(captured.isCurrent()).toBe(false);
		await captured.send(target, claim, null, () => false);
		expect(original).toHaveBeenCalledTimes(1);
		expect(original.mock.contexts[0]).toBe(platform);
		expect(original.mock.calls[0][1]).toEqual({ on: false });
		expect(replacement).not.toHaveBeenCalled();
	});

	it('keeps the original session and OFF callback when replacements arrive during its fence', async () => {
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			physicalIdentity: qualification.physicalIdentity,
			providerProfile: 'shelly-ng.guarded-switch',
			providerProfileVersion: 1,
		});
		let release: (value: ShellyGuardFenceReadback) => void;
		const held = new Promise<ShellyGuardFenceReadback>((resolve) => (release = resolve));
		session.fence.mockReturnValue(held);
		const originalFence = session.fence;
		const captured = transport.capture(target, claim, qualification);
		expect(captured.isCurrent()).toBe(true);
		const operation = captured.send(target, claim, qualification, () => true, { commandId: 'original-off' });
		const successorFence = jest.fn();
		const successorCallback = jest.fn();
		session.fence = successorFence;
		platform.admitGuardFenceSample = successorCallback;
		expect(captured.isCurrent()).toBe(false);
		release(readback);
		expect(await operation).toMatchObject({ outcome: 'accepted', pendingOnDrained: false, outputConfirmed: false });
		expect(originalFence).toHaveBeenCalledTimes(1);
		expect(admittedSample).toHaveBeenCalledTimes(1);
		expect(successorFence).not.toHaveBeenCalled();
		expect(successorCallback).not.toHaveBeenCalled();
	});

	it.each(['prepareGuardRpcSession', 'admitGuardFenceSample', 'matching-owner'] as const)(
		'preserves original held OFF delivery without granting drain proof after %s',
		async (method) => {
			const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
				physicalIdentity: qualification.physicalIdentity,
				providerProfile: 'shelly-ng.guarded-switch',
				providerProfileVersion: 1,
			});
			const prepare = jest.spyOn(platform, 'prepareGuardRpcSession');
			const originalCapture = jest.spyOn(platform, 'captureOwnedGuardFenceSample');
			const protective = jest.spyOn(platform, 'processProtectiveCommand');
			let release: (value: ShellyGuardFenceReadback) => void;
			const held = new Promise<ShellyGuardFenceReadback>((resolve) => (release = resolve));
			session.fence.mockReturnValueOnce(held);
			const captured = transport.capture(target, claim, qualification);
			const guard = () => admission;
			const operation = captured.send(target, claim, qualification, guard, { commandId: 'original-held-off' });
			const replacementPrepare = jest.fn(() => session as unknown as ShellyGuardRpcSession);
			const replacementAdmit = jest.fn().mockResolvedValue(undefined);
			try {
				expect(prepare).toHaveBeenCalledTimes(1);
				expect(prepare).toHaveBeenCalledWith(target, qualification.profile);
				expect(session.fence).toHaveBeenCalledTimes(1);
				expect(session.fence).toHaveBeenCalledWith(1000, guard);
				if (method === 'prepareGuardRpcSession') platform.prepareGuardRpcSession = replacementPrepare;
				if (method === 'admitGuardFenceSample') platform.admitGuardFenceSample = replacementAdmit;
				expect(captured.isCurrent()).toBe(method === 'matching-owner');
				release(readback);
				expect(await operation).toEqual({
					outcome: 'accepted',
					wasOn: false,
					outputConfirmed: false,
					pendingOnDrained: false,
				});
				expect(originalCapture).toHaveBeenCalledTimes(1);
				expect(originalCapture).toHaveBeenCalledWith(target);
				expect(admittedSample).toHaveBeenCalledWith(target.property, readback);
				expect(admittedSample).toHaveBeenCalledTimes(1);
				expect(replacementPrepare).not.toHaveBeenCalled();
				expect(replacementAdmit).not.toHaveBeenCalled();
				expect(protective).not.toHaveBeenCalled();
				expect(session.on).not.toHaveBeenCalled();
			} finally {
				release(readback);
				await operation;
				prepare.mockRestore();
				originalCapture.mockRestore();
				protective.mockRestore();
			}
		},
	);

	// Real platform and manager admission; only the fence and final sample publisher are controlled.
	// This proves forwarding custody, not a network fence, installed qualification or physical release.
	it.each([
		['send', false],
		['reconcile', false],
		['send', true],
		['reconcile', true],
	] as const)('retains actual manager delivery for %s with expired=%s', async (operation, expired) => {
		const reportSample = jest
			.fn<Promise<void>, [string, unknown, ShellyGuardFenceReadback['evidence']]>()
			.mockImplementation((_id, _value, evidence) => {
				accepted = { ...accepted, sampledAt: evidence.sampledAt, receivedAt: evidence.receivedAt };
				return Promise.resolve();
			});
		const manager = new DelegatesManagerService(
			{} as never,
			{} as never,
			{ reportSample } as unknown as ConstructorParameters<typeof DelegatesManagerService>[2],
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
		);
		const prepare = jest
			.spyOn(manager, 'prepareGuardRpcSession')
			.mockReturnValue(session as unknown as ShellyGuardRpcSession);
		const original = jest.spyOn(manager, 'admitGuardFenceSample');
		const successor = jest.fn().mockResolvedValue(undefined);
		const ownedPlatform = new ShellyNgDevicePlatform(manager);
		const capture = jest.spyOn(ownedPlatform, 'captureOwnedGuardFenceSample');
		const registry = new PlatformRegistryService();
		registry.register(ownedPlatform);
		const ownedTransport = new VirtualThermostatTransportService(registry, {
			readQualifiedSample: () => accepted,
		} as unknown as PropertyValueService);
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			physicalIdentity: qualification.physicalIdentity,
			providerProfile: 'shelly-ng.guarded-switch',
			providerProfileVersion: 1,
		});
		let release!: (value: ShellyGuardFenceReadback) => void;
		const held = new Promise<ShellyGuardFenceReadback>((resolve) => (release = resolve));
		session.fence.mockReturnValueOnce(held);
		const captured = ownedTransport.capture(target, claim, qualification);
		const scope = {
			controllerId: 'controller',
			controllerRevision: 4,
			claimId: 'claim',
			claimRevision: 2,
			contractFingerprint: 'contract',
			qualification,
		};
		const pending =
			operation === 'send'
				? captured.send(target, claim, qualification, () => admission, { commandId: 'original-off' })
				: captured.reconcile(target, ['original-on'], accepted, () => admission, scope);
		try {
			expect(session.fence).toHaveBeenCalledTimes(1);
			expect(original).not.toHaveBeenCalled();
			manager.admitGuardFenceSample = successor;
			if (expired) sourceCurrent = false;
			release(readback);
			const result = await pending;
			expect(original).toHaveBeenCalledTimes(1);
			expect(original.mock.contexts[0]).toBe(manager);
			expect(original.mock.calls[0][0]).toBe(target.property);
			expect(original.mock.calls[0][1]).toBe(readback);
			expect(successor).not.toHaveBeenCalled();
			expect(capture).toHaveBeenCalledTimes(1);
			expect(capture.mock.contexts[0]).toBe(ownedPlatform);
			expect(reportSample).toHaveBeenCalledTimes(expired ? 0 : 1);
			if (!expired) expect(reportSample.mock.calls[0][2]).toBe(readback.evidence);
			if (operation === 'send')
				expect(result).toMatchObject({ outcome: 'accepted', outputConfirmed: false, pendingOnDrained: false });
			else if (expired) expect(result).toBeNull();
			else expect(result).toMatchObject({ coveredCommandIds: ['original-on'], externalWriterBarrier: true });
		} finally {
			release(readback);
			await pending;
			prepare.mockRestore();
			original.mockRestore();
			capture.mockRestore();
			ownedTransport.onModuleDestroy();
		}
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
			const original: CapturedThermostatReconcileReadinessV1 = Object.freeze({
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
				CapturedThermostatReconcileReadinessV1 | null,
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

	it.each(['data', 'getter'] as const)(
		'retains original readiness capture after synchronous %s call mutation',
		async (shape) => {
			const f = await fixture(),
				p = f.custom();
			const bypass = jest.fn(() => p.original),
				getter = jest.fn(() => bypass);
			p.captureReadiness.mockReturnValue(null);
			p.canReconcile.mockImplementation(() => {
				Object.defineProperty(
					p.captureReadiness,
					'call',
					shape === 'data' ? { value: bypass, configurable: true } : { get: getter, configurable: true },
				);
				return true;
			});
			try {
				f.transport.register(f.target.device.type, p.adapter);
				expect(f.capture()).toBeNull();
				expect(p.captureReadiness).toHaveBeenCalledTimes(1);
				expect(p.captureReadiness.mock.contexts).toEqual([p.adapter]);
				expect(p.captureReadiness).toHaveBeenCalledWith(f.target, f.qualification);
				expect(bypass).not.toHaveBeenCalled();
				expect(getter).not.toHaveBeenCalled();
				expect(p.send).not.toHaveBeenCalled();
				expect(p.reconcile).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Reflect.deleteProperty(p.captureReadiness, 'call');
				await f.module.close();
			}
		},
	);
	it.each(['data', 'getter'] as const)(
		'retains the original escaped machine predicate after %s call mutation',
		async (shape) => {
			const f = await fixture(),
				p = f.custom();
			const machine = jest.fn(() => f.machine.current);
			Object.assign(f.qualification, { machineLeaseIsCurrent: machine });
			const bypass = jest.fn(() => true),
				getter = jest.fn(() => bypass);
			p.canReconcile.mockImplementation(() => {
				Object.defineProperty(
					machine,
					'call',
					shape === 'data' ? { value: bypass, configurable: true } : { get: getter, configurable: true },
				);
				return true;
			});
			try {
				f.transport.register(f.target.device.type, p.adapter);
				const readiness = f.requiredCapture();
				expect(readiness.isCurrent()).toBe(true);
				f.machine.current = false;
				expect(readiness.isCurrent()).toBe(false);
				expect(machine.mock.calls.length).toBeGreaterThan(1);
				expect(machine.mock.contexts.every((receiver) => receiver === f.qualification)).toBe(true);
				expect(bypass).not.toHaveBeenCalled();
				expect(getter).not.toHaveBeenCalled();
				expect(p.send).not.toHaveBeenCalled();
				expect(p.reconcile).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Reflect.deleteProperty(machine, 'call');
				await f.module.close();
			}
		},
	);
	it.each([
		['readiness', 'data'],
		['readiness', 'getter'],
		['canReconcile', 'data'],
		['canReconcile', 'getter'],
	] as const)('invokes original public %s despite retained function call %s', async (method, mutation) => {
		const f = await fixture();
		const p = f.custom();
		const current = jest.fn(() => p.ready.current);
		const evidence = Object.freeze({ ...p.original, isCurrent: current });
		p.captureReadiness.mockReturnValue(evidence);
		f.transport.register(f.target.device.type, p.adapter);
		const fn = method === 'readiness' ? current : p.canReconcile;
		const originalCall = Object.getOwnPropertyDescriptor(fn, 'call');
		const replacement = jest.fn(() => true);
		const getter = jest.fn(() => replacement);
		try {
			const captured = f.requiredCapture();
			current.mockClear();
			p.canReconcile.mockClear();
			if (method === 'readiness') p.ready.current = false;
			else p.ready.allowed = false;
			Object.defineProperty(fn, 'call', {
				configurable: true,
				...(mutation === 'data' ? { value: replacement } : { get: getter }),
			});
			expect(captured.isCurrent()).toBe(false);
			expect(current).toHaveBeenCalledTimes(1);
			expect(current.mock.contexts[0]).toBe(evidence);
			expect(current.mock.calls[0]).toEqual([]);
			if (method === 'canReconcile') {
				expect(p.canReconcile).toHaveBeenCalledTimes(1);
				expect(p.canReconcile.mock.contexts[0]).toBe(p.adapter);
				expect(p.canReconcile.mock.calls[0][0]).toBe(f.target);
				expect(p.canReconcile.mock.calls[0][1]).toBe(f.qualification);
			} else expect(p.canReconcile).not.toHaveBeenCalled();
			expect(replacement).not.toHaveBeenCalled();
			expect(getter).not.toHaveBeenCalled();
		} finally {
			if (originalCall) Object.defineProperty(fn, 'call', originalCall);
			else Reflect.deleteProperty(fn, 'call');
			await f.module.close();
		}
	});

	it.each([
		['send', 'data'],
		['send', 'getter'],
		['reconcile', 'data'],
		['reconcile', 'getter'],
		['canReconcile', 'data'],
		['canReconcile', 'getter'],
	] as const)('retains original public %s dispatch and result after call %s', async (method, mutation) => {
		const f = await fixture();
		const p = f.custom();
		f.transport.register(f.target.device.type, p.adapter);
		const fn = p.adapter[method];
		const originalCall = Object.getOwnPropertyDescriptor(fn, 'call');
		const replacement = jest.fn(() => undefined);
		const getter = jest.fn(() => replacement);
		try {
			const captured = f.transport.capture(f.target, f.claim, f.qualification);
			expect(captured.isCurrent()).toBe(true);
			Object.defineProperty(fn, 'call', {
				configurable: true,
				...(mutation === 'data' ? { value: replacement } : { get: getter }),
			});
			expect(p.adapter[method]).toBe(fn);
			expect(captured.isCurrent()).toBe(true);
			const guard = () => true;
			let args: unknown[];
			if (method === 'send') {
				const command = { commandId: 'original-captured-command' };
				const result = Promise.resolve({ outcome: 'refused' as const, reasons: ['original'] });
				p.send.mockReturnValueOnce(result);
				expect(captured.send(f.target, f.claim, f.qualification, guard, command)).toBe(result);
				await result;
				args = [f.target, f.claim, f.qualification, guard, command];
			} else if (method === 'reconcile') {
				const ids = ['original-command'];
				const scope = {
					controllerId: f.claim.controllerId,
					controllerRevision: 1,
					claimId: f.claim.id,
					claimRevision: f.claim.revision,
					contractFingerprint: f.claim.contractFingerprint,
					qualification: f.qualification,
				};
				const result = Promise.resolve<Awaited<ReturnType<ThermostatActuationAdapter['reconcile']>>>(null);
				p.reconcile.mockReturnValueOnce(result);
				expect(captured.reconcile(f.target, ids, null, guard, scope)).toBe(result);
				await result;
				args = [f.target, ids, null, guard, scope];
			} else {
				p.ready.allowed = false;
				expect(captured.canReconcile(f.target, f.qualification)).toBe(false);
				args = [f.target, f.qualification];
			}
			const original = method === 'send' ? p.send : method === 'reconcile' ? p.reconcile : p.canReconcile;
			expect(original).toHaveBeenCalledTimes(1);
			expect(original.mock.contexts[0]).toBe(p.adapter);
			expect(original.mock.calls[0]).toHaveLength(args.length);
			args.forEach((arg, index) => expect(original.mock.calls[0][index]).toBe(arg));
			expect(replacement).not.toHaveBeenCalled();
			expect(getter).not.toHaveBeenCalled();
		} finally {
			if (originalCall) Object.defineProperty(fn, 'call', originalCall);
			else Reflect.deleteProperty(fn, 'call');
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
	it('retains readonly original registration and terminal registry teardown without consulting platform getters', async () => {
		const f = await fixture(),
			b = await f.builtin();
		try {
			const type = f.target.device.type;
			const capture = f.registry.captureRegistration(type);
			const readiness = f.requiredCapture();
			expect(Object.isFrozen(capture)).toBe(true);
			expect(Object.isFrozen(capture.identity)).toBe(true);
			expect(Object.keys(capture).sort()).toEqual(['identity', 'isCurrent']);
			const getter = jest.spyOn(b.platform, 'getType').mockImplementation(() => {
				throw new Error('No recapture');
			});
			expect(capture.isCurrent()).toBe(true);
			expect(f.registry.captureRegistration(type).identity).toBe(capture.identity);
			f.registry.onModuleDestroy();
			expect(capture.isCurrent()).toBe(false);
			expect(readiness.isCurrent()).toBe(false);
			expect(f.registry.captureRegistration(type)).toBeNull();
			expect(f.registry.register(b.platform)).toBe(false);
			expect(f.registry.registerOwned(b.platform)).toBeNull();
			expect(getter).not.toHaveBeenCalled();
			b.owner.dispose();
			expect(f.registry.list()).toEqual([]);
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});

	it.each([
		'own-data',
		'own-getter',
		'nearer-getter',
		'canonical-getter',
		'canonical-setter',
		'canonical-flags',
		'other-getter',
		'inherited-data',
	] as const)(
		'refuses readiness metadata %s before a foreign getter, machine predicate or session preparation',
		async (shape) => {
			const f = await fixture(),
				b = await f.builtin();
			const canonical = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');
			const devicePrototype = Object.getPrototypeOf(f.target.device) as object;
			const propertyPrototype = Object.getPrototypeOf(f.target.property) as object;
			const enabled = Object.getOwnPropertyDescriptor(f.target.device, 'enabled');
			const unit = Object.getOwnPropertyDescriptor(f.target.property, 'unit');
			let getters = 0;
			const getter = () => {
				getters++;
				return 'devices-shelly-ng';
			};
			const machine = jest.fn(() => true);
			Object.assign(f.qualification, { machineLeaseIsCurrent: machine });
			try {
				if (shape === 'own-data')
					Object.defineProperty(f.target.device, 'type', { value: 'devices-shelly-ng', configurable: true });
				else if (shape === 'own-getter')
					Object.defineProperty(f.target.device, 'type', { get: getter, configurable: true });
				else if (shape === 'nearer-getter') {
					const nearer = Object.create(devicePrototype) as object;
					Object.defineProperty(nearer, 'type', { get: getter });
					Object.setPrototypeOf(f.target.device, nearer);
				} else if (shape === 'canonical-getter')
					Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, get: getter });
				else if (shape === 'canonical-setter')
					Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', { ...canonical, set: () => undefined });
				else if (shape === 'canonical-flags')
					Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', {
						...canonical,
						enumerable: !canonical.enumerable,
					});
				else if (shape === 'other-getter')
					Object.defineProperty(f.target.device, 'enabled', { get: getter, configurable: true });
				else {
					Reflect.deleteProperty(f.target.property, 'unit');
					const nearer = Object.create(propertyPrototype) as object;
					Object.defineProperty(nearer, 'unit', { value: null });
					Object.setPrototypeOf(f.target.property, nearer);
				}
				expect(f.transport.captureOffMetadata(f.target, f.claim, f.qualification)).toBeNull();
				expect(f.capture()).toBeNull();
				expect(getters).toBe(0);
				expect(machine).not.toHaveBeenCalled();
				expect(b.prepare).not.toHaveBeenCalled();
				expect(b.request).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Reflect.deleteProperty(f.target.device, 'type');
				Object.setPrototypeOf(f.target.device, devicePrototype);
				Object.setPrototypeOf(f.target.property, propertyPrototype);
				Object.defineProperty(ShellyNgDeviceEntity.prototype, 'type', canonical);
				if (enabled) Object.defineProperty(f.target.device, 'enabled', enabled);
				else Reflect.deleteProperty(f.target.device, 'enabled');
				if (unit) Object.defineProperty(f.target.property, 'unit', unit);
				await b.cleanup();
				await f.module.close();
			}
		},
	);
	it.each(['canonical', 'unshadowed-intermediate'] as const)(
		'captures original %s OFF metadata without machine, session or sample work',
		async (shape) => {
			const f = await fixture(),
				b = await f.builtin();
			const prototype = Object.getPrototypeOf(f.target.device) as object;
			const machine = jest.fn(() => {
				throw new Error('Metadata must not invoke machine');
			});
			Object.assign(f.qualification, { machineLeaseIsCurrent: machine });
			try {
				if (shape === 'unshadowed-intermediate')
					Object.setPrototypeOf(f.target.device, Object.create(prototype) as object);
				const metadata = f.transport.captureOffMetadata(f.target, f.claim, f.qualification);
				expect(metadata).not.toBeNull();
				expect(Object.isFrozen(metadata)).toBe(true);
				expect(Object.keys(metadata)).toEqual(['isCurrent']);
				expect(metadata.isCurrent()).toBe(true);
				expect(machine).not.toHaveBeenCalled();
				expect(b.prepare).not.toHaveBeenCalled();
				expect(b.fence).not.toHaveBeenCalled();
				expect(b.on).not.toHaveBeenCalled();
				expect(b.request).not.toHaveBeenCalled();
				expect(f.readSample).not.toHaveBeenCalled();
			} finally {
				Object.setPrototypeOf(f.target.device, prototype);
				await b.cleanup();
				await f.module.close();
			}
		},
	);
	it.each([
		{ name: 'SQL-null claim and omitted evidence', claim: null, evidence: undefined, own: false, opens: true },
		{
			name: 'matching original generation',
			claim: 'synthetic-existing-generation',
			evidence: 'synthetic-existing-generation',
			own: true,
			opens: true,
		},
		{
			name: 'different installed generation',
			claim: 'synthetic-existing-generation',
			evidence: 'different-generation',
			own: true,
			opens: false,
		},
		{
			name: 'generated claim without evidence generation',
			claim: 'synthetic-existing-generation',
			evidence: undefined,
			own: false,
			opens: false,
		},
		{
			name: 'absent claim with generated evidence',
			claim: null,
			evidence: 'synthetic-existing-generation',
			own: true,
			opens: false,
		},
		{ name: 'explicit-null evidence remains malformed', claim: null, evidence: null, own: true, opens: false },
		{ name: 'supplementary loader own-data undefined', claim: null, evidence: undefined, own: true, opens: true },
	])('preserves consumed OFF metadata and built-in readiness generation policy: $name', async (row) => {
		const f = await fixture(),
			b = await f.builtin();
		f.claim.qualificationGeneration = row.claim;
		if (row.own)
			Object.defineProperty(f.qualification, 'qualificationGeneration', {
				value: row.evidence,
				writable: true,
				configurable: true,
				enumerable: true,
			});
		else Reflect.deleteProperty(f.qualification, 'qualificationGeneration');
		const machine = jest.fn(() => true);
		Object.assign(f.qualification, { machineLeaseIsCurrent: machine });
		try {
			const metadata = f.transport.captureOffMetadata(f.target, f.claim, f.qualification);
			expect(metadata !== null).toBe(row.opens);
			if (metadata) expect(metadata.isCurrent()).toBe(true);
			expect(machine).not.toHaveBeenCalled();
			expect(b.prepare).not.toHaveBeenCalled();
			expect(b.fence).not.toHaveBeenCalled();
			expect(b.on).not.toHaveBeenCalled();
			expect(b.request).not.toHaveBeenCalled();
			expect(f.readSample).not.toHaveBeenCalled();
			const readiness = f.capture();
			expect(readiness !== null).toBe(row.opens);
			if (row.opens && row.claim === null) {
				expect(readiness).toMatchObject({ capabilityVersion: 2, qualificationBinding: 'legacy-null-managed-shelly' });
				expect(Object.hasOwn(readiness, 'qualificationGeneration')).toBe(false);
				expect(Object.isFrozen(readiness)).toBe(true);
				expect(Object.isFrozen(readiness.providerProfile)).toBe(true);
				expect(readiness.isCurrent()).toBe(true);
				// Equal values with different presence cannot revive the original capture.
				if (row.own) Reflect.deleteProperty(f.qualification, 'qualificationGeneration');
				else
					Object.defineProperty(f.qualification, 'qualificationGeneration', { value: undefined, configurable: true });
				expect(readiness.isCurrent()).toBe(false);
				expect(metadata.isCurrent()).toBe(false);
			}
			if (!row.opens) {
				expect(machine).not.toHaveBeenCalled();
				expect(b.prepare).not.toHaveBeenCalled();
			}
		} finally {
			await b.cleanup();
			await f.module.close();
		}
	});
	it.each([
		'custom-shadow',
		'remote-profile',
		'cooling-role',
		'missing-claim',
		'undefined-claim',
		'empty',
		'inherited-undefined',
		'inherited-string',
		'inherited-accessor',
		'own-accessor',
	] as const)('refuses legacy %s before provider predicates or session preparation', async (shape) => {
		const f = await fixture(),
			b = await f.builtin(),
			custom = f.custom();
		f.claim.qualificationGeneration = null;
		Reflect.deleteProperty(f.qualification, 'qualificationGeneration');
		const prototype = Object.getPrototypeOf(f.qualification) as object;
		let getters = 0;
		const machine = jest.fn(() => true);
		Object.assign(f.qualification, { machineLeaseIsCurrent: machine });
		try {
			if (shape === 'custom-shadow') f.transport.register(f.target.device.type, custom.adapter);
			else if (shape === 'remote-profile') {
				Object.assign(f.qualification.providerProfile, { id: 'remote' });
				Reflect.set(f.claim, 'providerProfile', 'remote');
			} else if (shape === 'cooling-role') f.claim.role = 'cooling';
			else if (shape === 'missing-claim') Reflect.deleteProperty(f.claim, 'qualificationGeneration');
			else if (shape === 'undefined-claim') Reflect.set(f.claim, 'qualificationGeneration', undefined);
			else if (shape === 'empty') Object.assign(f.qualification, { qualificationGeneration: '' });
			else if (shape === 'own-accessor')
				Object.defineProperty(f.qualification, 'qualificationGeneration', {
					get: () => {
						getters++;
						return undefined;
					},
					configurable: true,
				});
			else {
				const nearer = Object.create(prototype) as object;
				Object.defineProperty(
					nearer,
					'qualificationGeneration',
					shape === 'inherited-accessor'
						? {
								get: () => {
									getters++;
									return undefined;
								},
							}
						: { value: shape === 'inherited-string' ? 'G' : undefined },
				);
				Object.setPrototypeOf(f.qualification, nearer);
			}
			expect(f.capture()).toBeNull();
			expect(getters).toBe(0);
			expect(machine).not.toHaveBeenCalled();
			expect(custom.canReconcile).not.toHaveBeenCalled();
			expect(custom.captureReadiness).not.toHaveBeenCalled();
			expect(b.prepare).not.toHaveBeenCalled();
			expect(f.readSample).not.toHaveBeenCalled();
		} finally {
			Object.setPrototypeOf(f.qualification, prototype);
			await b.cleanup();
			await f.module.close();
		}
	});
});
