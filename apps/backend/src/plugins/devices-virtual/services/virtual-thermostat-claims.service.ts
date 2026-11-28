import { AsyncResource } from 'node:async_hooks';
import { DataSource, Not, QueryRunner } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import {
	PropertyCommandAdmissionRegistryService,
	PropertyCommandAdmissionSnapshot,
} from '../../../modules/devices/services/property-command-admission.registry.service';
import {
	SUPERVISED_SWITCH_PROFILE,
	SUPERVISED_SWITCH_PROFILE_VERSION,
	ThermostatProtectiveQualification,
	thermostatHasOpposedBranches,
} from '../contracts/thermostat-actuation.contract';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import { ThermostatActuationRegistry } from './thermostat-actuation-registry.service';
import {
	captureThermostatBindings,
	publishThermostatBindings,
	thermostatActuatorBinding,
} from './thermostat-binding-events';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { thermostatActuatorIdentity, thermostatPropertyContract } from './virtual-thermostat-contract.utils';

/** Never accepted in a public request. The registry validates object identity, not a supplied JSON shape. */
export interface ThermostatCommandAuthority {
	readonly controllerId: string;
	readonly claimId: string;
	readonly revision: number;
	readonly physicalIdentity: string;
	readonly action: 'on' | 'off';
}
export type ThermostatInstalledQualification<Profile extends object = object> =
	ThermostatProtectiveQualification<Profile>;
export interface ThermostatReleaseProof {
	readonly claimId: string;
	readonly revision: number;
	readonly evidenceId: string;
}

/** Durable reservations are independent of intent, device enabled state and expiry of command windows. */
@Injectable()
export class VirtualThermostatClaimsService implements OnApplicationBootstrap, OnModuleDestroy {
	readonly allowsStructureLockedDispatch = true;
	private readonly authorities = new WeakSet<object>();
	private readonly authorityEpochs = new WeakMap<object, number>();
	private readonly proofs = new WeakMap<
		object,
		{
			authority: ThermostatCommandAuthority;
			qualification: ThermostatInstalledQualification;
			isCurrent: () => boolean;
			controllerRevision: number;
			sourcePropertyId: string;
			sourceDeviceId: string;
			contractFingerprint: string;
		}
	>();
	private readonly qualifications = new Map<string, Map<string, ThermostatInstalledQualification>>();
	private readonly qualifiedRegistrations = new WeakMap<ThermostatInstalledQualification, object>();
	private readonly supervised = new Map<string, ThermostatInstalledQualification>();
	private readonly releaseWrites = new WeakMap<QueryRunner, { query: string; parameters: readonly unknown[] }>();
	private readonly reservations = new Map<string, VirtualThermostatActuatorClaimEntity>();
	private readonly byProperty = new Map<string, VirtualThermostatActuatorClaimEntity>();
	/** Stays valid across comfort publications, until a write could change the reserved outputs. */
	private reservationGeneration?: object;
	private readonly pendingReservationWrites = new Set<{ readonly pending: boolean }>();
	private epoch = 0;
	private ready = false;
	private recoveryFences = 0;
	private unregister?: () => void;
	private refreshInFlight?: Promise<void>;
	private retryTimer?: ReturnType<typeof setTimeout>;
	private retryDelay = 1000;
	private destroyed = false;
	// Retry callbacks must not inherit an exclusive writer's re-entrant structure-lock lease.
	private readonly retryContext = new AsyncResource('thermostat-claims-retry');
	private readonly onStructure = () => {
		// Revoke captured absence and owner leases synchronously before any asynchronous reload.
		this.invalidate();
		void this.refresh().catch(() => undefined);
	};
	private runtimeAdmission?: (claim: VirtualThermostatActuatorClaimEntity) => boolean;

	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly admission: PropertyCommandAdmissionRegistryService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
		private readonly extensions: ThermostatActuationRegistry = new ThermostatActuationRegistry(),
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.unregister = this.admission.register(this);
		for (const event of [
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
		])
			this.events.on(event, this.onStructure);
		await this.refresh();
	}
	onModuleDestroy(): void {
		this.destroyed = true;
		this.qualifications.clear();
		this.supervised.clear();
		this.pendingReservationWrites.clear();
		this.cancelRetry();
		this.retryContext.emitDestroy();
		this.unregister?.();
		for (const event of [
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
		])
			this.events.off(event, this.onStructure);
		this.invalidate();
	}
	invalidate(scope: 'ownership' | 'actuation' = 'ownership', write?: { readonly pending: boolean }): void {
		if (scope === 'ownership') this.reservationGeneration = undefined;
		if (write) this.pendingReservationWrites.add(write);
		this.ready = false;
		this.epoch++;
	}
	/** Keep command admission closed from ownership/installation operation entry through reloaded commit or rollback. */
	holdRecoveryFence(): () => void {
		this.recoveryFences++;
		this.invalidate();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.recoveryFences--;
			this.invalidate();
		};
	}
	async refresh(): Promise<void> {
		// Acquire before coalescing: a writer's post-commit refresh must never join a reader queued behind it.
		await this.structureLock.runShared(async () => {
			if (this.destroyed) return;
			// An in-transaction read cannot prove the final ownership held after commit or rollback.
			for (const write of this.pendingReservationWrites) if (write.pending) return;
			if (this.refreshInFlight !== undefined) return this.refreshInFlight;
			const epoch = this.epoch;
			const refresh = this.reload(epoch);
			this.refreshInFlight = refresh;
			try {
				await refresh;
			} finally {
				this.refreshInFlight = undefined;
			}
		});
	}
	private async reload(epoch: number): Promise<void> {
		try {
			const rows = await this.dataSource.manager.find(VirtualThermostatActuatorClaimEntity, {
				where: { state: Not('released') },
			});
			if (this.destroyed) return;
			if (epoch !== this.epoch) {
				this.scheduleRetry();
				return;
			}
			const active = new Map(rows.map((row) => [row.id, row]));
			for (const [id, evidence] of this.supervised) {
				const row = active.get(id);
				if (
					!row ||
					row.providerProfile !== SUPERVISED_SWITCH_PROFILE ||
					row.qualificationGeneration !== evidence.qualificationGeneration ||
					row.physicalIdentity !== evidence.physicalIdentity
				)
					this.supervised.delete(id);
			}
			const sameReservations =
				this.reservations.size === rows.length &&
				rows.every(
					(row) =>
						this.reservations.get(row.physicalIdentity)?.id === row.id &&
						this.byProperty.get(row.sourcePropertyIdentity)?.id === row.id,
				);
			this.reservations.clear();
			this.byProperty.clear();
			for (const row of rows) {
				this.reservations.set(row.physicalIdentity, row);
				this.byProperty.set(row.sourcePropertyIdentity, row);
			}
			this.ready = this.recoveryFences === 0;
			if (!this.ready) this.reservationGeneration = undefined;
			else if (!this.reservationGeneration || !sameReservations) this.reservationGeneration = {};
			this.pendingReservationWrites.clear();
			// Retry completion tracks fresh membership, independently of the recovery admission fence.
			this.cancelRetry();
			this.retryDelay = 1000;
		} catch (error) {
			if (!this.destroyed && epoch === this.epoch) {
				this.invalidate();
				this.scheduleRetry();
			} else if (!this.destroyed) {
				this.scheduleRetry();
			}
			throw error;
		}
	}
	private scheduleRetry(): void {
		if (this.destroyed || this.retryTimer || getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		const delay = this.retryDelay;
		this.retryDelay = Math.min(delay * 2, 30000);
		this.retryTimer = this.retryContext.runInAsyncScope(() =>
			setTimeout(() => {
				this.retryTimer = undefined;
				if (!this.destroyed) void this.refresh().catch(() => undefined);
			}, delay),
		);
		this.retryTimer.unref();
	}
	private cancelRetry(): void {
		if (this.retryTimer) clearTimeout(this.retryTimer);
		this.retryTimer = undefined;
	}
	/** Captures absence and ownership; unrelated leaves do not depend on catalog reconciliation. */
	capture(): PropertyCommandAdmissionSnapshot {
		const epoch = this.epoch;
		const ready = this.ready;
		const reservations = this.reservationGeneration;
		const claimedProperties = new Set(this.byProperty.keys());
		const isCurrent = (update?: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>) => {
			if (!update) return ready && this.ready && epoch === this.epoch;
			if (!claimedProperties.has(update.property.id) && !this.requiresGuardedDispatch(update)) return true;
			return (
				!this.pendingReservationWrites.size && reservations !== undefined && reservations === this.reservationGeneration
			);
		};
		return {
			isCurrent,
			isEffectCurrent: isCurrent,
			assertEffectAllowed: async (effect): Promise<void> => {
				if (!isCurrent(effect))
					throw new DevicesValidationException('Actuator effect ownership changed before dispatch');
				await this.assertAllowed(effect);
			},
			isRequestCurrent: () => true,
			assertAllowed: async (update: IDevicePropertyData): Promise<void> => {
				if (!isCurrent(update))
					throw new DevicesValidationException('Actuator ownership changed before dispatch; retry the command.');
				await this.assertAllowed(update);
			},
		};
	}
	/** Claimable hardware and reserved property aliases require transport-time admission guards. */
	requiresGuardedDispatch(update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): boolean {
		return (
			!!thermostatActuatorIdentity(update.property, update.channel, update.device) ||
			this.byProperty.has(update.property.id)
		);
	}
	/** Rejects ordinary commands to reserved leaves and closes claimable outputs during reconciliation. */
	assertAllowed(update: Pick<IDevicePropertyData, 'device' | 'channel' | 'property'>): Promise<void> {
		if (!this.requiresGuardedDispatch(update)) return Promise.resolve();
		if (!this.reservationGeneration || this.pendingReservationWrites.size)
			throw new DevicesValidationException('Actuator ownership is reconciling; retry the command.');
		const identity = thermostatActuatorIdentity(update.property, update.channel, update.device);
		const claim = (identity && this.reservations.get(identity)) || this.byProperty.get(update.property.id);
		if (claim)
			throw new DevicesValidationException(
				`Actuator is reserved by thermostat ${claim.controllerId}; repair or release its claim first.`,
			);
		return Promise.resolve();
	}

	/** Only an explicit hardware qualification task may install evidence; no public DTO exposes this method. */
	recordQualification(evidence: ThermostatInstalledQualification): void {
		const registration = this.extensions.get(evidence.providerProfile?.id, evidence.providerProfile?.version);
		if (
			!registration ||
			evidence.contractVersion !== 1 ||
			!evidence.qualificationGeneration ||
			!evidence.physicalIdentity
		)
			throw new DevicesValidationException(
				'The selected thermostat safety extension or its installed evidence is missing.',
			);
		const qualified = registration.extension.qualify(evidence);
		if (
			qualified.contractVersion !== evidence.contractVersion ||
			qualified.providerProfile.id !== evidence.providerProfile.id ||
			qualified.providerProfile.version !== evidence.providerProfile.version ||
			qualified.physicalIdentity !== evidence.physicalIdentity ||
			qualified.qualificationGeneration !== evidence.qualificationGeneration
		)
			throw new DevicesValidationException('Installed thermostat safety evidence changed its binding.');
		const profiles =
			this.qualifications.get(qualified.physicalIdentity) ?? new Map<string, ThermostatInstalledQualification>();
		profiles.set(registration.key, qualified);
		this.qualifications.set(qualified.physicalIdentity, profiles);
		this.qualifiedRegistrations.set(qualified, registration);
		this.epoch++;
	}

	/** Revoke dispatch leases without discarding unchanged durable reservations. Recovery invalidates its bindings separately. */
	revokeQualification(physicalIdentity: string, profileId?: string): void {
		if (profileId === undefined) this.qualifications.delete(physicalIdentity);
		else if (!this.removeProfile(physicalIdentity, profileId)) return;
		this.epoch++;
	}
	private removeProfile(physicalIdentity: string, profileId: string): boolean {
		const profiles = this.qualifications.get(physicalIdentity);
		if (!profiles) return false;
		let removed = false;
		for (const [key, installed] of profiles) {
			if (installed.providerProfile.id !== profileId) continue;
			profiles.delete(key);
			removed = true;
		}
		if (!profiles.size) this.qualifications.delete(physicalIdentity);
		return removed;
	}
	/** Installation operations revoke every captured qualification before entering any async lock/read. */
	revokeAllQualifications(profileId?: string): void {
		if (profileId === undefined) this.qualifications.clear();
		else {
			let removed = false;
			for (const identity of this.qualifications.keys()) if (this.removeProfile(identity, profileId)) removed = true;
			if (!removed) return;
		}
		this.epoch++;
	}
	qualification(
		claim: VirtualThermostatActuatorClaimEntity,
		opposed: boolean,
	): ThermostatInstalledQualification | null {
		if (claim.providerProfile === SUPERVISED_SWITCH_PROFILE) {
			const reservation = this.reservations.get(claim.physicalIdentity);
			if (
				claim.providerProfileVersion !== SUPERVISED_SWITCH_PROFILE_VERSION ||
				!reservation ||
				reservation.id !== claim.id ||
				reservation.revision !== claim.revision ||
				reservation.providerProfile !== claim.providerProfile ||
				reservation.providerProfileVersion !== claim.providerProfileVersion ||
				reservation.qualificationGeneration !== claim.qualificationGeneration ||
				!claim.qualificationGeneration
			)
				return null;
			let installed = this.supervised.get(claim.id);
			if (
				!installed ||
				installed.physicalIdentity !== claim.physicalIdentity ||
				installed.qualificationGeneration !== claim.qualificationGeneration
			) {
				installed = Object.freeze({
					contractVersion: 1,
					physicalIdentity: claim.physicalIdentity,
					qualificationGeneration: claim.qualificationGeneration,
					providerProfile: Object.freeze({ id: SUPERVISED_SWITCH_PROFILE, version: SUPERVISED_SWITCH_PROFILE_VERSION }),
					profile: Object.freeze({}),
					// Supervision only makes promises about the panel's own commands.
					upstreamWritersExcluded: false,
					opposedOutputsInterlocked: false,
					machineLeaseIsCurrent: () => this.supervised.get(claim.id) === installed,
				});
				this.supervised.set(claim.id, installed);
			}
			return installed;
		}
		const registration = this.extensions.get(claim.providerProfile, claim.providerProfileVersion);
		const evidence = registration && this.qualifications.get(claim.physicalIdentity)?.get(registration.key);
		opposed ||= thermostatHasOpposedBranches(
			[...this.reservations.values()].filter((row) => row.controllerId === claim.controllerId),
		);
		return evidence &&
			registration &&
			this.qualifiedRegistrations.get(evidence) === registration &&
			claim.qualificationGeneration &&
			evidence.qualificationGeneration === claim.qualificationGeneration &&
			(!evidence.machineLeaseIsCurrent || evidence.machineLeaseIsCurrent()) &&
			(!opposed || evidence.opposedOutputsInterlocked) &&
			registration.extension.allows(claim, evidence, opposed)
			? evidence
			: null;
	}

	/** VD2-8 supplies durable startup/interlock admission. Until then energizing remains closed. */
	registerRuntimeAdmission(admission: (claim: VirtualThermostatActuatorClaimEntity) => boolean): () => void {
		if (this.runtimeAdmission) throw new Error('Thermostat runtime admission already registered');
		this.runtimeAdmission = admission;
		this.epoch++;
		return () => {
			this.runtimeAdmission = undefined;
			this.epoch++;
		};
	}
	mintAuthority(claimId: string, action: 'on' | 'off'): ThermostatCommandAuthority {
		const claim = [...this.reservations.values()].find((row) => row.id === claimId);
		if (
			!this.ready ||
			!claim ||
			(action === 'on' &&
				(claim.state !== 'reserved' ||
					(claim.providerProfile === SUPERVISED_SWITCH_PROFILE && !claim.independentProtectionAcknowledged) ||
					!this.qualification(claim, false) ||
					!this.runtimeAdmission?.(claim)))
		)
			throw new DevicesValidationException('Thermostat actuator is not admitted for this action.');
		const authority = Object.freeze({
			controllerId: claim.controllerId,
			claimId: claim.id,
			revision: claim.revision,
			physicalIdentity: claim.physicalIdentity,
			action,
		});
		this.authorities.add(authority);
		this.authorityEpochs.set(authority, this.epoch);
		return authority;
	}
	isAuthorized(authority: ThermostatCommandAuthority, update: IDevicePropertyData): boolean {
		const claim = this.reservations.get(authority?.physicalIdentity);
		return (
			this.ready &&
			this.authorities.has(authority) &&
			this.authorityEpochs.get(authority) === this.epoch &&
			!!claim &&
			claim.id === authority.claimId &&
			claim.revision === authority.revision &&
			claim.controllerId === authority.controllerId &&
			claim.sourcePropertyId === update.property.id &&
			claim.sourceDeviceId === update.device.id &&
			claim.physicalIdentity === thermostatActuatorIdentity(update.property, update.channel, update.device) &&
			claim.contractFingerprint === thermostatPropertyContract(update.property, update.channel, update.device) &&
			update.value === (authority.action === 'on') &&
			(authority.action === 'off' ||
				(claim.state === 'reserved' &&
					update.device.enabled &&
					(claim.providerProfile !== SUPERVISED_SWITCH_PROFILE || claim.independentProtectionAcknowledged) &&
					!!this.qualification(claim, false) &&
					!!this.runtimeAdmission?.(claim)))
		);
	}

	/** Bind durable ON drainage to the original qualification and live proof guard; OFF readback alone cannot release ownership. */
	recordQualifiedRelease(
		authority: ThermostatCommandAuthority,
		evidence: {
			outputConfirmedOff: boolean;
			pendingOnDrained: boolean;
			evidenceId: string;
			qualification: ThermostatInstalledQualification;
			isCurrent: () => boolean;
			controllerRevision: number;
		},
	): ThermostatReleaseProof {
		const claim = this.reservations.get(authority?.physicalIdentity);
		if (
			!this.ready ||
			!this.authorities.has(authority) ||
			this.authorityEpochs.get(authority) !== this.epoch ||
			authority.action !== 'off' ||
			!claim ||
			claim.id !== authority.claimId ||
			claim.revision !== authority.revision ||
			!evidence.qualification ||
			this.qualification(claim, false) !== evidence.qualification ||
			typeof evidence.isCurrent !== 'function' ||
			!evidence.isCurrent() ||
			!Number.isSafeInteger(evidence.controllerRevision) ||
			evidence.controllerRevision < 1 ||
			!evidence.outputConfirmedOff ||
			!evidence.pendingOnDrained ||
			!evidence.evidenceId
		)
			throw new DevicesValidationException('Qualified OFF and pending ON drainage proof is required.');
		const proof = Object.freeze({ claimId: claim.id, revision: claim.revision, evidenceId: evidence.evidenceId });
		this.proofs.set(proof, {
			authority,
			qualification: evidence.qualification,
			isCurrent: evidence.isCurrent,
			controllerRevision: evidence.controllerRevision,
			sourcePropertyId: claim.sourcePropertyId,
			sourceDeviceId: claim.sourceDeviceId,
			contractFingerprint: claim.contractFingerprint,
		});
		return proof;
	}
	/** Only the exact guarded release statement may retain its own admission during the awaited SQL write. */
	isQualifiedReleaseWrite(runner: QueryRunner, query: string, parameters: readonly unknown[] = []): boolean {
		const write = this.releaseWrites.get(runner);
		return (
			!!write &&
			write.query === query &&
			write.parameters.length === parameters.length &&
			write.parameters.every((parameter, index) => Object.is(parameter, parameters[index]))
		);
	}
	/** Consume one bound proof and roll back if its live source or installed qualification changes during release. */
	async completeRelease(proof: ThermostatReleaseProof): Promise<void> {
		const binding = this.proofs.get(proof);
		if (!binding) throw new DevicesValidationException('Internal release proof is required.');
		// An attempted release consumes this proof even when its transaction rolls back; retry needs fresh evidence.
		this.proofs.delete(proof);
		const assertCurrent = (claim: VirtualThermostatActuatorClaimEntity): void => {
			if (
				!this.ready ||
				this.authorityEpochs.get(binding.authority) !== this.epoch ||
				claim.revision !== proof.revision ||
				claim.state !== 'releasing' ||
				claim.physicalIdentity !== binding.authority.physicalIdentity ||
				claim.controllerId !== binding.authority.controllerId ||
				claim.sourcePropertyId !== binding.sourcePropertyId ||
				claim.sourceDeviceId !== binding.sourceDeviceId ||
				claim.contractFingerprint !== binding.contractFingerprint ||
				this.qualification(claim, false) !== binding.qualification ||
				!binding.isCurrent()
			)
				throw new DevicesValidationException('Qualified release proof is no longer current.');
		};
		await this.structureLock.runExclusive(async () => {
			const membership = await this.graph.withStructuralWrite(async (manager) => {
				const claim = await manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: proof.claimId });
				const config = await manager.findOneBy(VirtualThermostatConfigEntity, { controllerId: claim.controllerId });
				if (config?.revision !== binding.controllerRevision)
					throw new DevicesValidationException('Qualified release configuration scope changed.');
				assertCurrent(claim);
				const state = claim.reason === 'device_disabled' ? 'suspended' : 'released';
				const update = manager
					.createQueryBuilder()
					.update(VirtualThermostatActuatorClaimEntity)
					.set({
						state,
						revision: claim.revision + 1,
						releasedAt: new Date(),
						releaseEvidence: { evidenceId: proof.evidenceId, outputConfirmedOff: true, pendingOnDrained: true },
					})
					.where({ id: claim.id, revision: proof.revision, state: 'releasing' });
				const [query, parameters] = update.getQueryAndParameters();
				const runner = manager.queryRunner;
				if (!runner) throw new DevicesValidationException('Release transaction is required.');
				this.releaseWrites.set(runner, { query, parameters });
				try {
					const result = await update.execute();
					assertCurrent(claim);
					if (result.affected !== 1) throw new DevicesValidationException('Claim revision or release state changed.');
				} finally {
					this.releaseWrites.delete(runner);
				}
				if (state === 'suspended') return null;
				const event = await captureThermostatBindings(manager, config, 'updated', [thermostatActuatorBinding(claim)]);
				assertCurrent(claim);
				return event;
			});
			this.invalidate();
			if (membership) publishThermostatBindings(this.events, membership);
			await this.refresh();
		});
	}
}
