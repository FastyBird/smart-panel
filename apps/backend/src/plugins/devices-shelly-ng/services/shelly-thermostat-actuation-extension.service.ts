import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	CapturedThermostatReconcileReadinessV1,
	RemoteCoolingFrame,
	ThermostatActuationAdapter,
} from '../../devices-virtual/contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../../devices-virtual/entities/virtual-thermostat.entity';
import { ThermostatActuationRegistry } from '../../devices-virtual/services/thermostat-actuation-registry.service';
import { thermostatActuatorIdentity } from '../../devices-virtual/services/virtual-thermostat-contract.utils';
import { SHELLY_GUARDED_PROFILE, SHELLY_GUARDED_PROFILE_VERSION } from '../contracts/thermostat-actuation.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../platforms/shelly-ng.device.platform';

import { REMOTE_DEW_POINT_PROFILE } from './remote-dew-point-lease.contract';
import {
	ShellyThermostatQualification,
	allowsShellyThermostat,
	qualifyShellyThermostat,
} from './shelly-thermostat-qualification';
import { ThermostatRemoteCoolingAdapter } from './thermostat-remote-cooling-adapter';

const originalShellyType = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');

function captureShellyTarget(target: IDevicePropertyData) {
	const { device } = target;
	const chain: object[] = [];
	for (let owner: object | null = device; owner; owner = Object.getPrototypeOf(owner) as object | null) {
		chain.push(owner);
		const descriptor = Object.getOwnPropertyDescriptor(owner, 'type');
		if (!descriptor) continue;
		if (
			owner !== ShellyNgDeviceEntity.prototype ||
			!originalShellyType ||
			descriptor.get !== originalShellyType.get ||
			descriptor.set !== originalShellyType.set ||
			descriptor.enumerable !== originalShellyType.enumerable ||
			descriptor.configurable !== originalShellyType.configurable
		)
			return null;
		break;
	}
	if (chain.at(-1) !== ShellyNgDeviceEntity.prototype) return null;
	const typeCurrent = () =>
		chain.every((owner, index) => {
			const descriptor = Object.getOwnPropertyDescriptor(owner, 'type');
			return index < chain.length - 1
				? !descriptor && Object.getPrototypeOf(owner) === chain[index + 1]
				: descriptor?.get === originalShellyType.get &&
						descriptor?.set === originalShellyType.set &&
						descriptor?.enumerable === originalShellyType.enumerable &&
						descriptor?.configurable === originalShellyType.configurable;
		});
	const hardware = captureCreation(device as ShellyNgDeviceEntity, ['canonicalMac']);
	return { isCurrent: () => typeCurrent() && hardware.current() };
}

@Injectable()
export class ShellyThermostatActuationExtension implements OnModuleInit, OnModuleDestroy {
	private disposers: (() => void)[] = [];
	private remoteCooling?: ThermostatRemoteCoolingAdapter;
	constructor(
		private readonly extensions: ThermostatActuationRegistry,
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
	) {}

	onModuleInit(): void {
		this.disposers.push(
			this.extensions.register({
				profile: { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION },
				captureTargetMetadata: captureShellyTarget,
				qualify: qualifyShellyThermostat,
				allows: allowsShellyThermostat,
				captureReadiness: (target, evidence) =>
					this.captureReadiness(target, evidence as ShellyThermostatQualification),
				captureAdapter: (target, _claim, evidence) =>
					this.captureGuard(target, evidence as ShellyThermostatQualification | null | undefined),
			}),
		);
		this.disposers.push(
			this.extensions.register({
				profile: { id: REMOTE_DEW_POINT_PROFILE, version: 1 },
				captureTargetMetadata: captureShellyTarget,
				qualify: qualifyShellyThermostat,
				allows: allowsShellyThermostat,
				captureAdapter: (target, claim, evidence, cooling) =>
					claim.role === 'cooling'
						? this.captureCooling(target, claim, evidence as ShellyThermostatQualification | null | undefined, cooling)
						: null,
			}),
		);
	}

	onModuleDestroy(): void {
		for (const dispose of this.disposers.splice(0)) dispose();
	}

	private captureReadiness(
		target: IDevicePropertyData,
		qualification: ShellyThermostatQualification,
	): CapturedThermostatReconcileReadinessV1 | null {
		const { profile } = qualification;
		if (
			!(target.device instanceof ShellyNgDeviceEntity) ||
			!qualification.upstreamWritersExcluded ||
			!profile.independentProtectionQualified ||
			!profile.releaseOrderingQualified ||
			!qualification.machineLeaseIsCurrent?.()
		)
			return null;
		const registry = captureCreation(this.platforms, ['captureRegistration', 'get']);
		const lease = registry.values.captureRegistration.call(this.platforms, target.device.type);
		if (!lease) return null;
		const platform = registry.values.get.call(this.platforms, target.device);
		if (!(platform instanceof ShellyNgDevicePlatform)) return null;
		const prepare = captureCreation(platform, ['prepareGuardRpcSession']);
		const session = prepare.values.prepareGuardRpcSession.call(platform, target, profile);
		if (!session) return null;
		const original = captureCreation(session, ['isCurrent']);
		return Object.freeze({
			capabilityVersion: 1,
			providerProfile: qualification.providerProfile,
			physicalIdentity: qualification.physicalIdentity,
			qualificationGeneration: qualification.qualificationGeneration,
			isCurrent: () =>
				registry.current() &&
				lease.isCurrent() &&
				prepare.current() &&
				original.current() &&
				invokeCreation(original.values.isCurrent, session),
		});
	}

	private captureCooling(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		capturedQualification: ShellyThermostatQualification | null | undefined,
		cooling: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null,
	) {
		const remote = (this.remoteCooling ??= new ThermostatRemoteCoolingAdapter(
			this.values,
			() => null,
			async (leaf, current) => {
				const platform = this.platforms.get(leaf.device);
				if (!(leaf.device instanceof ShellyNgDeviceEntity) || !(platform instanceof ShellyNgDevicePlatform))
					return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
				return platform.processProtectiveCommand(
					{ device: leaf.device, channel: leaf.channel, property: leaf.property },
					{ on: false },
					1000,
					current,
				);
			},
		));
		if (capturedQualification === undefined) {
			// A policy read asks whether the qualification it supplies now can reconcile. Only
			// a journaled dispatch pins the installation, session and cooling frame up front.
			const dynamic: ThermostatActuationAdapter<ShellyThermostatQualification> = {
				contractVersion: remote.contractVersion,
				providerProfile: remote.providerProfile,
				canReconcile: (leaf, installed) => remote.canReconcile(leaf, installed),
				send: (leaf, source, installed, admitted, command) =>
					remote.capture(leaf, source, installed, cooling).send(leaf, source, installed, admitted, command),
				reconcile: (leaf, commands, off, admitted, scope) =>
					remote.capture(leaf, claim, scope.qualification, cooling).reconcile(leaf, commands, off, admitted, scope),
			};
			return dynamic;
		}
		const registry = captureCreation(this.platforms, ['get']);
		const platform = registry.values.get.call(registry.receiver, target.device);
		const original =
			platform instanceof ShellyNgDevicePlatform ? captureCreation(platform, ['processProtectiveCommand']) : null;
		const captured = remote.capture(target, claim, capturedQualification, cooling, async (leaf, current) => {
			if (!(leaf.device instanceof ShellyNgDeviceEntity) || !original)
				return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
			return original.values.processProtectiveCommand.call(
				original.receiver,
				{ device: leaf.device, channel: leaf.channel, property: leaf.property },
				{ on: false },
				1000,
				current,
			);
		});
		return {
			...captured,
			isCurrent: () =>
				registry.current() &&
				registry.values.get.call(registry.receiver, target.device) === platform &&
				(original?.current() ?? true) &&
				captured.isCurrent(),
		};
	}
	private captureGuard(
		target: IDevicePropertyData,
		capturedQualification: ShellyThermostatQualification | null | undefined,
	) {
		const platform = this.platforms.get(target.device);
		if (!(platform instanceof ShellyNgDevicePlatform)) return null;
		const registry = captureCreation(this.platforms, ['get']);
		const original = captureCreation(platform, [
			'prepareGuardRpcSession',
			'admitGuardFenceSample',
			'captureOwnedGuardFenceSample',
			'processProtectiveCommand',
		]);
		const valueReader = captureCreation(this.values, ['readQualifiedSample']);
		const capturedSession = capturedQualification
			? original.values.prepareGuardRpcSession.call(platform, target, capturedQualification.profile)
			: null;
		const sessionMethods = capturedSession && captureCreation(capturedSession, ['on', 'fence']);
		const sessionFor = (input: ShellyThermostatQualification) => {
			if (capturedQualification === undefined)
				return original.values.prepareGuardRpcSession.call(platform, target, input.profile);
			if (input !== capturedQualification || !sessionMethods) return null;
			return {
				on: (...args: Parameters<typeof capturedSession.on>) => sessionMethods.values.on.call(capturedSession, ...args),
				fence: (...args: Parameters<typeof capturedSession.fence>) =>
					sessionMethods.values.fence.call(capturedSession, ...args),
			};
		};
		const adapter: ThermostatActuationAdapter<ShellyThermostatQualification> = {
			contractVersion: 1,
			providerProfile: { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION },
			canReconcile: (target, qualification) =>
				qualification.upstreamWritersExcluded &&
				qualification.profile.releaseOrderingQualified &&
				qualification.profile.independentProtectionQualified &&
				qualification.physicalIdentity === thermostatActuatorIdentity(target.property, target.channel, target.device) &&
				!!sessionFor(qualification),
			/** Refuse ON before energizing or report a possible send as unknown; OFF acceptance alone cannot release a claim. */
			send: async (target, claim, qualification, isAdmitted) => {
				if (!(target.device instanceof ShellyNgDeviceEntity))
					return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
				const session = qualification && sessionFor(qualification);
				if (target.value === true) {
					if (
						!session ||
						!qualification.upstreamWritersExcluded ||
						!qualification.profile.releaseOrderingQualified ||
						!qualification.profile.independentProtectionQualified ||
						qualification.physicalIdentity !== claim.physicalIdentity
					)
						return { outcome: 'refused', reasons: ['ordered_script_qualification_missing'] };
					return session.on(claim.leaseSeconds, 1000, isAdmitted);
				}
				if (session) {
					const deliver = invokeCreation(original.values.captureOwnedGuardFenceSample, platform, target);
					const readback = await session.fence(1000, isAdmitted);
					if (readback) {
						await invokeCreation(deliver, undefined, readback);
						return { outcome: 'accepted', wasOn: readback.wasOn, outputConfirmed: false, pendingOnDrained: false };
					}
				}
				// An unconfirmed script barrier still permits best-effort absolute native OFF.
				return original.values.processProtectiveCommand.call(
					platform,
					{ device: target.device, channel: target.channel, property: target.property },
					{ on: false },
					1000,
					isAdmitted,
				);
			},
			/** Bind drainage to the installed qualification, live connection lease and freshly admitted OFF sample. */
			reconcile: async (target, commandIds, _off, isCurrent, scope) => {
				const qualification = scope.qualification;
				if (
					!qualification.upstreamWritersExcluded ||
					!qualification.profile.releaseOrderingQualified ||
					!qualification.profile.independentProtectionQualified ||
					qualification.physicalIdentity !== thermostatActuatorIdentity(target.property, target.channel, target.device)
				)
					return null;
				const session = sessionFor(qualification);
				if (!session) return null;
				const deliver = invokeCreation(original.values.captureOwnedGuardFenceSample, platform, target);
				const readback = await session.fence(1000, isCurrent);
				if (!readback || typeof readback.evidence.sourceIsCurrent !== 'function') return null;
				await invokeCreation(deliver, undefined, readback);
				if (!readback.isCurrent()) return null;
				const sample = valueReader.values.readQualifiedSample.call(valueReader.receiver, target.property, 30_000);
				if (
					!sample ||
					sample.value !== false ||
					sample.provenance !== 'live' ||
					sample.quality !== 'good' ||
					sample.sampledAt.getTime() !== readback.evidence.sampledAt.getTime() ||
					sample.receivedAt.getTime() !== readback.evidence.receivedAt.getTime() ||
					!readback.isCurrent()
				)
					return null;
				return {
					proofId: readback.proofId,
					physicalIdentity: qualification.physicalIdentity,
					connectionIdentity: readback.connectionIdentity,
					coveredCommandIds: [...commandIds],
					externalWriterBarrier: true,
					offSample: sample,
					observedAt: readback.evidence.observedAt,
					isCurrent: readback.isCurrent,
					sourceIsCurrent: readback.evidence.sourceIsCurrent,
					scope: {
						controllerId: scope.controllerId,
						controllerRevision: scope.controllerRevision,
						claimId: scope.claimId,
						claimRevision: scope.claimRevision,
						contractFingerprint: scope.contractFingerprint,
					},
				};
			},
		};
		return {
			...adapter,
			isCurrent: () =>
				registry.current() &&
				registry.values.get.call(registry.receiver, target.device) === platform &&
				original.current() &&
				valueReader.current() &&
				(sessionMethods?.current() ?? true),
		};
	}
}
