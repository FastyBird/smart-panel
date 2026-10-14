import { DataSource, Not } from 'typeorm';

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
import { guardScriptReadiness } from '../../devices-shelly-ng/contracts/guard-script.contract';
import { ShellyProtectiveQualification } from '../../devices-shelly-ng/contracts/protective-switch.contract';
import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

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
export interface ThermostatInstalledQualification {
	readonly physicalIdentity: string;
	/** Must match the retained claim after an operator restore; older durable profiles cannot be replayed. */
	readonly qualificationGeneration?: string;
	readonly profile: ShellyProtectiveQualification;
	readonly upstreamWritersExcluded: boolean;
	readonly opposedOutputsInterlocked: boolean;
}
export interface ThermostatReleaseProof {
	readonly claimId: string;
	readonly revision: number;
	readonly evidenceId: string;
}

/** Durable reservations are independent of intent, device enabled state and expiry of command windows. */
@Injectable()
export class VirtualThermostatClaimsService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly authorities = new WeakSet<object>();
	private readonly authorityEpochs = new WeakMap<object, number>();
	private readonly proofs = new WeakSet<object>();
	private readonly qualifications = new Map<string, ThermostatInstalledQualification>();
	private readonly reservations = new Map<string, VirtualThermostatActuatorClaimEntity>();
	private readonly byProperty = new Map<string, VirtualThermostatActuatorClaimEntity>();
	private epoch = 0;
	private ready = false;
	private recoveryFences = 0;
	private unregister?: () => void;
	private refreshQueue: Promise<void> = Promise.resolve();
	private readonly onStructure = () => {
		// Revoke captured absence and owner leases synchronously before any asynchronous reload.
		this.invalidate();
		this.refreshQueue = this.refreshQueue.then(() => this.refresh()).catch(() => this.invalidate());
	};
	private runtimeAdmission?: (claim: VirtualThermostatActuatorClaimEntity) => boolean;

	constructor(
		private readonly dataSource: DataSource,
		private readonly structureLock: DeviceStructureLockService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly admission: PropertyCommandAdmissionRegistryService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
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
	invalidate(): void {
		this.ready = false;
		this.epoch++;
	}
	/** Keep command admission closed from restore entry until its commit or rollback has been reloaded. */
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
		const epoch = this.epoch;
		const rows = await this.dataSource.manager.find(VirtualThermostatActuatorClaimEntity, {
			where: { state: Not('released') },
		});
		if (epoch !== this.epoch) return;
		this.reservations.clear();
		this.byProperty.clear();
		for (const row of rows) {
			this.reservations.set(row.physicalIdentity, row);
			this.byProperty.set(row.sourcePropertyIdentity, row);
		}
		this.ready = this.recoveryFences === 0;
	}
	/** Captures absence and ownership; unrelated leaves do not depend on catalog reconciliation. */
	capture(): PropertyCommandAdmissionSnapshot {
		const epoch = this.epoch;
		const ready = this.ready;
		const claimedProperties = new Set(this.byProperty.keys());
		const isCurrent = (update?: IDevicePropertyData) =>
			!!update && !claimedProperties.has(update.property.id) && !this.requiresGuardedDispatch(update)
				? true
				: ready && this.ready && epoch === this.epoch;
		return {
			isCurrent,
			isRequestCurrent: () => true,
			assertAllowed: async (update: IDevicePropertyData): Promise<void> => {
				if (!isCurrent(update))
					throw new DevicesValidationException('Actuator ownership changed before dispatch; retry the command.');
				await this.assertAllowed(update);
			},
		};
	}
	/** Claimable hardware and reserved property aliases require transport-time admission guards. */
	requiresGuardedDispatch(update: IDevicePropertyData): boolean {
		return (
			!!thermostatActuatorIdentity(update.property, update.channel, update.device) ||
			this.byProperty.has(update.property.id)
		);
	}
	/** Rejects ordinary commands to reserved leaves and closes claimable outputs during reconciliation. */
	assertAllowed(update: IDevicePropertyData): Promise<void> {
		if (!this.requiresGuardedDispatch(update)) return Promise.resolve();
		if (!this.ready) throw new DevicesValidationException('Actuator ownership is reconciling; retry the command.');
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
		const profile = evidence.profile;
		if (
			!evidence.physicalIdentity ||
			!profile.evidenceId ||
			!profile.firmware ||
			!profile.deviceId ||
			profile.model !== 'SNSW-001P16EU' ||
			!profile.releaseOrderingQualified ||
			!profile.independentProtectionQualified ||
			!evidence.upstreamWritersExcluded ||
			(profile.guardScript !== undefined &&
				(guardScriptReadiness(profile.guardScript).length > 0 ||
					profile.guardScript.evidenceId !== profile.evidenceId)) ||
			!Number.isSafeInteger(profile.revision) ||
			profile.revision < 1 ||
			!Number.isFinite(profile.testedLeaseSeconds.min) ||
			!Number.isFinite(profile.testedLeaseSeconds.max) ||
			profile.testedLeaseSeconds.min <= 0 ||
			profile.testedLeaseSeconds.max < profile.testedLeaseSeconds.min
		)
			throw new DevicesValidationException('Installed actuator qualification is incomplete.');
		this.qualifications.set(
			evidence.physicalIdentity,
			Object.freeze({
				...evidence,
				profile: Object.freeze({
					...profile,
					testedLeaseSeconds: Object.freeze({ ...profile.testedLeaseSeconds }),
					...(profile.guardScript ? { guardScript: Object.freeze({ ...profile.guardScript }) } : {}),
				}),
			}),
		);
		this.epoch++;
	}
	/** Recovery changes the binding contract. Old installation evidence cannot qualify the restored leaf. */
	revokeQualification(physicalIdentity: string): void {
		this.qualifications.delete(physicalIdentity);
		this.invalidate();
	}
	qualification(
		claim: VirtualThermostatActuatorClaimEntity,
		opposed: boolean,
	): ThermostatInstalledQualification | null {
		const evidence = this.qualifications.get(claim.physicalIdentity);
		opposed ||= [...this.reservations.values()].filter((row) => row.controllerId === claim.controllerId).length > 1;
		if (
			!evidence ||
			(!!claim.qualificationGeneration && evidence.qualificationGeneration !== claim.qualificationGeneration) ||
			(opposed && !evidence.opposedOutputsInterlocked) ||
			claim.leaseSeconds < evidence.profile.testedLeaseSeconds.min ||
			claim.leaseSeconds > evidence.profile.testedLeaseSeconds.max
		)
			return null;
		return evidence;
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
				(claim.state !== 'reserved' || !this.qualification(claim, false) || !this.runtimeAdmission?.(claim)))
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
					!!this.qualification(claim, false) &&
					!!this.runtimeAdmission?.(claim)))
		);
	}

	/** Accepted transport/OFF readback alone cannot construct proof: durable runtime must also prove ON drainage. */
	recordQualifiedRelease(
		authority: ThermostatCommandAuthority,
		evidence: { outputConfirmedOff: boolean; pendingOnDrained: boolean; evidenceId: string },
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
			!this.qualification(claim, false) ||
			!evidence.outputConfirmedOff ||
			!evidence.pendingOnDrained ||
			!evidence.evidenceId
		)
			throw new DevicesValidationException('Qualified OFF and pending ON drainage proof is required.');
		const proof = Object.freeze({ claimId: claim.id, revision: claim.revision, evidenceId: evidence.evidenceId });
		this.proofs.add(proof);
		return proof;
	}
	async completeRelease(proof: ThermostatReleaseProof): Promise<void> {
		if (!this.proofs.has(proof)) throw new DevicesValidationException('Internal release proof is required.');
		await this.structureLock.runExclusive(async () => {
			await this.graph.withStructuralWrite(async (manager) => {
				const claim = await manager.findOneByOrFail(VirtualThermostatActuatorClaimEntity, { id: proof.claimId });
				if (claim.revision !== proof.revision || claim.state !== 'releasing')
					throw new DevicesValidationException('Claim revision or release state changed.');
				await manager.update(
					VirtualThermostatActuatorClaimEntity,
					{ id: claim.id, revision: proof.revision },
					{
						state: claim.reason === 'device_disabled' ? 'suspended' : 'released',
						revision: claim.revision + 1,
						releasedAt: new Date(),
						releaseEvidence: { evidenceId: proof.evidenceId, outputConfirmedOff: true, pendingOnDrained: true },
					},
				);
			});
			this.proofs.delete(proof);
			this.invalidate();
			await this.refresh();
		});
	}
}
