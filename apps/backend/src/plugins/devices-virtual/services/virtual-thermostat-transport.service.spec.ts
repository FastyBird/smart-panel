import { randomUUID } from 'node:crypto';

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
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import { thermostatActuatorIdentity } from './virtual-thermostat-contract.utils';
import { VirtualThermostatTransportService } from './virtual-thermostat-transport.service';

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
