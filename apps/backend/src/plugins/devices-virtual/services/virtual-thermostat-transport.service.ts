import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { captureCreation, invokeCreation } from '../../../modules/devices/services/creation-capture';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ShellyNgDeviceEntity } from '../../devices-shelly-ng/entities/devices-shelly-ng.entity';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import {
	CapturedThermostatReconcileReadiness,
	ThermostatActuationAdapter as ProviderActuationAdapter,
	ThermostatReconciliationScope as ProviderReconciliationScope,
	ThermostatReleaseOrderingEvidence as ProviderReleaseOrderingEvidence,
	SHELLY_GUARDED_PROFILE,
	SHELLY_GUARDED_PROFILE_VERSION,
} from '../contracts/thermostat-actuation.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { RemoteCoolingFrame, ThermostatRemoteCoolingAdapter } from './thermostat-remote-cooling-adapter';
import { ThermostatInstalledQualification } from './virtual-thermostat-claims.service';
import {
	thermostatActuatorIdentity,
	thermostatFingerprint,
	thermostatPropertyContract,
} from './virtual-thermostat-contract.utils';

export type ThermostatReconciliationScope = ProviderReconciliationScope<ThermostatInstalledQualification>;
export type ThermostatReleaseOrderingEvidence = ProviderReleaseOrderingEvidence<ThermostatInstalledQualification>;
export type ThermostatActuationAdapter = ProviderActuationAdapter<ThermostatInstalledQualification>;

const originalShellyType = Object.getOwnPropertyDescriptor(ShellyNgDeviceEntity.prototype, 'type');

/** Provider seam is internal; no HTTP payload can register an adapter or supply ordering evidence. */
@Injectable()
export class VirtualThermostatTransportService implements OnModuleDestroy {
	private destroyed = false;
	private readonly registrationEpochs = new Map<string, object>();
	private readonly adapters = new Map<string, { readonly adapter: ThermostatActuationAdapter }>();
	private readonly adapterOwners = new WeakMap<ThermostatActuationAdapter, () => boolean>();
	private remoteCooling?: ThermostatRemoteCoolingAdapter;
	private coolingFrameReader?: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null;
	registerCoolingFrameReader(
		reader: (claim: VirtualThermostatActuatorClaimEntity) => RemoteCoolingFrame | null,
	): () => void {
		if (this.coolingFrameReader) throw new Error('Cooling evidence reader already registered');
		this.coolingFrameReader = reader;
		return () => {
			if (this.coolingFrameReader === reader) this.coolingFrameReader = undefined;
		};
	}

	constructor(
		private readonly platforms: PlatformRegistryService,
		private readonly values: PropertyValueService,
	) {}
	register(type: string, adapter: ThermostatActuationAdapter): () => void {
		if (this.destroyed) throw new Error('Thermostat transport is destroyed');
		if (
			adapter.contractVersion !== 1 ||
			!adapter.providerProfile.id ||
			!Number.isSafeInteger(adapter.providerProfile.version) ||
			adapter.providerProfile.version < 1
		)
			throw new Error('Unsupported thermostat actuation contract/profile');
		if (this.adapters.has(type)) throw new Error('Thermostat transport already registered');
		const registration = Object.freeze({ adapter });
		this.adapters.set(type, registration);
		this.registrationEpochs.set(type, registration);
		return () => {
			if (this.adapters.get(type) === registration) {
				this.adapters.delete(type);
				this.registrationEpochs.set(type, Object.freeze({}));
			}
		};
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.adapters.clear();
		this.registrationEpochs.clear();
	}

	/** Read-only OFF observation. No provider, session, machine predicate or sample is invoked. */
	captureOffMetadata(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	): Readonly<{ isCurrent: () => boolean }> | null {
		const metadata = this.captureReadinessMetadata(target, claim, qualification);
		return metadata ? Object.freeze({ isCurrent: metadata.isCurrent }) : null;
	}
	private captureReadinessMetadata(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	) {
		try {
			if (this.destroyed || !qualification) return null;
			const targetPin = captureCreation(target, ['device', 'channel', 'property']);
			const { device, channel, property } = targetPin.values;
			// Only the original canonical getter is trusted, with no shadow getter invocation.
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
			const devicePin = captureCreation(device, ['id', 'enabled', 'identifier']);
			const macPin = captureCreation(device as ShellyNgDeviceEntity, ['canonicalMac']);
			const channelPin = captureCreation(channel, ['id', 'identifier', 'category', 'device']);
			const propertyKeys = [
				'id',
				'identifier',
				'category',
				'dataType',
				'permissions',
				'unit',
				'format',
				'channel',
			] as const;
			if (propertyKeys.some((key) => key in property && !Object.hasOwn(property, key))) return null;
			const propertyPin = captureCreation(property, propertyKeys);
			const claimPin = captureCreation(claim, [
				'id',
				'controllerId',
				'revision',
				'role',
				'state',
				'physicalIdentity',
				'providerProfile',
				'providerProfileVersion',
				'qualificationGeneration',
				'leaseSeconds',
				'sourcePropertyId',
				'sourceDeviceId',
				'sourcePropertyIdentity',
				'sourceDeviceIdentity',
				'contractFingerprint',
			]);
			const qualificationPin = captureCreation(qualification, [
				'contractVersion',
				'providerProfile',
				'physicalIdentity',
				'qualificationGeneration',
				'profile',
				'machineLeaseIsCurrent',
				'upstreamWritersExcluded',
				'opposedOutputsInterlocked',
			]);
			const generationDescriptor = Object.getOwnPropertyDescriptor(qualification, 'qualificationGeneration');
			if ('qualificationGeneration' in qualification && (!generationDescriptor || !('value' in generationDescriptor)))
				return null;
			if (!Object.hasOwn(claim, 'qualificationGeneration')) return null;
			const profile = qualificationPin.values.providerProfile;
			const local = qualificationPin.values.profile;
			if (!profile || !local) return null;
			const profilePin = captureCreation(profile, ['id', 'version']);
			const localPin = captureCreation(local, Object.keys(local) as (keyof typeof local)[]);
			const script = localPin.values.guardScript;
			const scriptPin = script && captureCreation(script, Object.keys(script) as (keyof typeof script)[]);
			const metadata = scriptPin?.values.installationMetadata;
			const metadataPin = metadata && captureCreation(metadata, Object.keys(metadata) as (keyof typeof metadata)[]);
			const bounds = localPin.values.testedLeaseSeconds;
			const boundsPin = bounds && captureCreation(bounds, ['min', 'max']);
			const permissionsPin = captureCreation(
				property.permissions,
				Object.keys(property.permissions) as (keyof typeof property.permissions)[],
			);
			const channelDevice = channelPin.values.device;
			const propertyChannel = propertyPin.values.channel;
			const channelDevicePin =
				typeof channelDevice === 'object' && channelDevice ? captureCreation(channelDevice, ['id']) : null;
			const propertyChannelPin =
				typeof propertyChannel === 'object' && propertyChannel ? captureCreation(propertyChannel, ['id']) : null;
			const physicalIdentity = thermostatActuatorIdentity(property, channel, device);
			const generation = qualificationPin.values.qualificationGeneration;
			const legacy = claimPin.values.qualificationGeneration === null && generation === undefined;
			const generated =
				typeof generation === 'string' &&
				generation.length > 0 &&
				claimPin.values.qualificationGeneration === generation;
			const machine = qualificationPin.values.machineLeaseIsCurrent;
			if (
				!physicalIdentity ||
				qualification.contractVersion !== 1 ||
				(!legacy && !generated) ||
				typeof machine !== 'function' ||
				!profile.id ||
				!Number.isSafeInteger(profile.version) ||
				profile.version < 1 ||
				qualification.physicalIdentity !== physicalIdentity ||
				claim.physicalIdentity !== physicalIdentity ||
				claim.providerProfile !== profile.id ||
				claim.providerProfileVersion !== profile.version ||
				!claim.id ||
				!claim.controllerId ||
				!Number.isSafeInteger(claim.revision) ||
				claim.revision < 1 ||
				claim.state !== 'reserved' ||
				claim.sourcePropertyId !== property.id ||
				claim.sourcePropertyIdentity !== property.id ||
				claim.sourceDeviceId !== device.id ||
				claim.sourceDeviceIdentity !== device.id ||
				(typeof channelDevice === 'string' ? channelDevice : channelDevicePin?.values.id) !== device.id ||
				(typeof propertyChannel === 'string' ? propertyChannel : propertyChannelPin?.values.id) !== channel.id ||
				claim.contractFingerprint !== thermostatPropertyContract(property, channel, device)
			)
				return null;
			const pins = [
				targetPin,
				devicePin,
				macPin,
				channelPin,
				propertyPin,
				claimPin,
				qualificationPin,
				profilePin,
				localPin,
				scriptPin,
				metadataPin,
				boundsPin,
				permissionsPin,
				channelDevicePin,
				propertyChannelPin,
			].filter((pin) => !!pin);
			const snapshot = () =>
				thermostatFingerprint({ contract: thermostatPropertyContract(property, channel, device), local });
			const image = snapshot();
			const isCurrent = () => {
				try {
					return !this.destroyed && typeCurrent() && pins.every((pin) => pin.current()) && snapshot() === image;
				} catch {
					return false;
				}
			};
			return { device, profile, local, generation, legacy, physicalIdentity, machine, isCurrent };
		} catch {
			return null;
		}
	}

	/** Pure, original registration/session continuity; never calls send, reconcile or sample storage. */
	captureReconcileReadiness(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification: ThermostatInstalledQualification,
	): CapturedThermostatReconcileReadiness | null {
		try {
			const metadata = this.captureReadinessMetadata(target, claim, qualification);
			if (!metadata) return null;
			const { device, profile, local, generation, legacy, physicalIdentity, machine } = metadata;
			const type = device.type;
			const epoch = this.registrationEpochs.get(type);
			const registration = this.adapters.get(type);
			if (
				legacy &&
				(registration ||
					claim.role !== 'heating' ||
					profile.id !== SHELLY_GUARDED_PROFILE ||
					profile.version !== SHELLY_GUARDED_PROFILE_VERSION)
			)
				return null;
			let providerCurrent: () => boolean;
			if (registration) {
				const adapter = registration.adapter;
				const methods = captureCreation(adapter, [
					'captureReconcileReadiness',
					'canReconcile',
					'contractVersion',
					'providerProfile',
				]);
				const suppliedProfile = captureCreation(methods.values.providerProfile, ['id', 'version']);
				if (
					!methods.values.captureReconcileReadiness ||
					methods.values.contractVersion !== 1 ||
					suppliedProfile.values.id !== profile.id ||
					suppliedProfile.values.version !== profile.version ||
					machine.call(qualification) !== true ||
					methods.values.canReconcile.call(adapter, target, qualification) !== true
				)
					return null;
				const original = methods.values.captureReconcileReadiness.call(adapter, target, qualification);
				if (!original) return null;
				const evidence = captureCreation(original, [
					'capabilityVersion',
					'providerProfile',
					'physicalIdentity',
					'qualificationGeneration',
					'isCurrent',
				]);
				const evidenceProfile = captureCreation(evidence.values.providerProfile, ['id', 'version']);
				if (
					evidence.values.capabilityVersion !== 1 ||
					evidence.values.physicalIdentity !== physicalIdentity ||
					evidence.values.qualificationGeneration !== generation ||
					evidenceProfile.values.id !== profile.id ||
					evidenceProfile.values.version !== profile.version ||
					typeof evidence.values.isCurrent !== 'function'
				)
					return null;
				providerCurrent = () =>
					methods.current() &&
					suppliedProfile.current() &&
					evidence.current() &&
					evidenceProfile.current() &&
					evidence.values.isCurrent.call(original) === true &&
					methods.values.canReconcile.call(adapter, target, qualification) === true;
			} else {
				if (
					profile.id !== SHELLY_GUARDED_PROFILE ||
					profile.version !== SHELLY_GUARDED_PROFILE_VERSION ||
					qualification.upstreamWritersExcluded !== true ||
					local.releaseOrderingQualified !== true ||
					local.independentProtectionQualified !== true ||
					machine.call(qualification) !== true
				)
					return null;
				const registry = captureCreation(this.platforms, ['captureRegistration', 'get']);
				const lease = registry.values.captureRegistration.call(this.platforms, type);
				if (!lease) return null;
				const platform = registry.values.get.call(this.platforms, device);
				if (!(platform instanceof ShellyNgDevicePlatform)) return null;
				const prepare = captureCreation(platform, ['prepareGuardRpcSession']);
				const session = prepare.values.prepareGuardRpcSession.call(platform, target, local);
				if (!session) return null;
				const sessionPin = captureCreation(session, ['isCurrent']);
				providerCurrent = () =>
					registry.current() &&
					lease.isCurrent() &&
					prepare.current() &&
					sessionPin.current() &&
					sessionPin.values.isCurrent.call(session) === true;
			}
			const isCurrent = () => {
				try {
					return (
						!this.destroyed &&
						metadata.isCurrent() &&
						this.registrationEpochs.get(type) === epoch &&
						this.adapters.get(type) === registration &&
						machine.call(qualification) === true &&
						providerCurrent()
					);
				} catch {
					return false;
				}
			};
			if (!isCurrent()) return null;
			if (legacy)
				return Object.freeze({
					capabilityVersion: 2,
					qualificationBinding: 'legacy-null-managed-shelly',
					providerProfile: Object.freeze({ id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION }),
					physicalIdentity,
					isCurrent,
				});
			if (typeof generation !== 'string') return null;
			return Object.freeze({
				capabilityVersion: 1,
				providerProfile: Object.freeze({ id: profile.id, version: profile.version }),
				physicalIdentity,
				qualificationGeneration: generation,
				isCurrent,
			});
		} catch {
			return null;
		}
	}

	/** Capture the actual command adapter before journal I/O; a later registration cannot receive it. */
	capture(
		target: IDevicePropertyData,
		claim: VirtualThermostatActuatorClaimEntity,
		qualification?: ThermostatInstalledQualification | null,
	) {
		const dispatch = captureCreation(this, ['get']);
		const registrations = this.adapters;
		const type = target.device.type;
		const registration = registrations.get(type);
		const adapter = dispatch.values.get.call(dispatch.receiver, target, claim, qualification);
		if (!adapter) return null;
		const owner = this.adapterOwners.get(adapter);
		const methods = captureCreation(adapter, [
			'send',
			'reconcile',
			'canReconcile',
			'providerProfile',
			'contractVersion',
		]);
		const profile = captureCreation(methods.values.providerProfile, ['id', 'version']);
		const isCurrent = () =>
			dispatch.current() &&
			methods.current() &&
			profile.current() &&
			(owner?.() ?? true) &&
			this.adapters === registrations &&
			registrations.get(type) === registration;
		return Object.freeze({
			isCurrent,
			send: (...args: Parameters<ThermostatActuationAdapter['send']>) =>
				methods.values.send.call(methods.receiver, ...args),
			reconcile: (...args: Parameters<ThermostatActuationAdapter['reconcile']>) =>
				methods.values.reconcile.call(methods.receiver, ...args),
			canReconcile: (...args: Parameters<ThermostatActuationAdapter['canReconcile']>) =>
				methods.values.canReconcile.call(methods.receiver, ...args),
		});
	}
	get(
		target: IDevicePropertyData,
		claim?: VirtualThermostatActuatorClaimEntity,
		capturedQualification?: ThermostatInstalledQualification | null,
	): ThermostatActuationAdapter | null {
		if (this.destroyed) return null;
		if (
			claim?.providerProfile === REMOTE_DEW_POINT_PROFILE &&
			claim.providerProfileVersion === 1 &&
			claim.role === 'cooling'
		) {
			const remote = (this.remoteCooling ??= new ThermostatRemoteCoolingAdapter(
				this.values,
				(member) => this.coolingFrameReader?.(member) ?? null,
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
			if (capturedQualification === undefined) return remote;
			const reader = this.coolingFrameReader;
			const registry = captureCreation(this.platforms, ['get']);
			const platform = registry.values.get.call(registry.receiver, target.device);
			const original =
				platform instanceof ShellyNgDevicePlatform ? captureCreation(platform, ['processProtectiveCommand']) : null;
			const captured = remote.capture(
				target,
				claim,
				capturedQualification,
				(member) => (reader ? invokeCreation(reader, this, member) : null),
				async (leaf, current) => {
					if (!(leaf.device instanceof ShellyNgDeviceEntity) || !original)
						return { outcome: 'refused', reasons: ['unsupported_protective_leaf'] };
					return original.values.processProtectiveCommand.call(
						original.receiver,
						{ device: leaf.device, channel: leaf.channel, property: leaf.property },
						{ on: false },
						1000,
						current,
					);
				},
			);
			this.adapterOwners.set(
				captured,
				() =>
					this.coolingFrameReader === reader &&
					registry.current() &&
					registry.values.get.call(registry.receiver, target.device) === platform &&
					(original?.current() ?? true) &&
					captured.isCurrent(),
			);
			return captured;
		}

		const supplied = this.adapters.get(target.device.type)?.adapter;
		if (supplied)
			return !claim ||
				(supplied.contractVersion === 1 &&
					supplied.providerProfile.id === (claim.providerProfile ?? SHELLY_GUARDED_PROFILE) &&
					supplied.providerProfile.version === (claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION))
				? supplied
				: null;
		if (
			claim &&
			((claim.providerProfile ?? SHELLY_GUARDED_PROFILE) !== SHELLY_GUARDED_PROFILE ||
				(claim.providerProfileVersion ?? SHELLY_GUARDED_PROFILE_VERSION) !== SHELLY_GUARDED_PROFILE_VERSION)
		)
			return null;
		const platform = this.platforms.get(target.device);
		if (!(platform instanceof ShellyNgDevicePlatform)) return null;
		const registry = captureCreation(this.platforms, ['get']);
		const original = captureCreation(platform, [
			'prepareGuardRpcSession',
			'admitGuardFenceSample',
			'processProtectiveCommand',
		]);
		const valueReader = captureCreation(this.values, ['readQualifiedSample']);
		const capturedSession = capturedQualification
			? original.values.prepareGuardRpcSession.call(platform, target, capturedQualification.profile)
			: null;
		const sessionMethods = capturedSession && captureCreation(capturedSession, ['on', 'fence']);
		const sessionFor = (input: ThermostatInstalledQualification) => {
			if (capturedQualification === undefined)
				return original.values.prepareGuardRpcSession.call(platform, target, input.profile);
			if (input !== capturedQualification || !sessionMethods) return null;
			return {
				on: (...args: Parameters<typeof capturedSession.on>) => sessionMethods.values.on.call(capturedSession, ...args),
				fence: (...args: Parameters<typeof capturedSession.fence>) =>
					sessionMethods.values.fence.call(capturedSession, ...args),
			};
		};
		const adapter: ThermostatActuationAdapter = {
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
					const readback = await session.fence(1000, isAdmitted);
					if (readback) {
						await original.values.admitGuardFenceSample.call(platform, target, readback);
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
				const readback = await session.fence(1000, isCurrent);
				if (!readback || !readback.isCurrent() || typeof readback.evidence.sourceIsCurrent !== 'function') return null;
				await original.values.admitGuardFenceSample.call(platform, target, readback);
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
		this.adapterOwners.set(
			adapter,
			() =>
				registry.current() &&
				registry.values.get.call(registry.receiver, target.device) === platform &&
				original.current() &&
				valueReader.current() &&
				(sessionMethods?.current() ?? true),
		);
		return adapter;
	}
}
