import { DataSource } from 'typeorm';

import { ConflictException, Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { ShellyNgDevicePlatform } from '../../devices-shelly-ng/platforms/shelly-ng.device.platform';
import {
	ThermostatInstallationAuditEntity,
	ThermostatInstallationEntity,
} from '../entities/thermostat-installation.entity';

import {
	installationAttestationReasons,
	thermostatInstallationArtifact,
	validateThermostatInstallation,
} from './thermostat-installation-artifact';
import { ThermostatInstallationBindingsService } from './thermostat-installation-bindings.service';
import { ThermostatInstallationService } from './thermostat-installation.service';
import { ThermostatMachineObservation } from './thermostat-installation.types';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';

const EVENTS = [
	THERMOSTAT_CONFIG_CHANGED,
	EventType.DEVICE_CONNECTION_CHANGED,
	EventType.DEVICE_UPDATED,
	EventType.DEVICE_DELETED,
	EventType.CHANNEL_UPDATED,
	EventType.CHANNEL_DELETED,
	EventType.CHANNEL_PROPERTY_UPDATED,
	EventType.CHANNEL_PROPERTY_DELETED,
];
/** Durable expected installation and human attestations never substitute for a fresh captured provider lease. */
@Injectable()
export class ThermostatInstallationLoaderService implements OnApplicationBootstrap, OnModuleDestroy {
	private epoch = 0;
	private stopped = false;
	private timer?: ReturnType<typeof setInterval>;
	private queue: Promise<void> = Promise.resolve();
	private scheduled = false;
	private readonly pausedClaims = new Set<string>();
	private readonly verifications = new Map<string, symbol>();
	private readonly humanVerifications = new Map<string, symbol>();
	private readonly active = new Map<
		string,
		{
			revision: number;
			configurationRevision: number;
			identity: string;
			controllerId: string;
			isCurrent: () => boolean;
		}
	>();
	private readonly changed = () => {
		this.invalidate();
		this.schedule();
	};
	constructor(
		private readonly dataSource: DataSource,
		private readonly bindings: ThermostatInstallationBindingsService,
		private readonly installations: ThermostatInstallationService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly platforms: PlatformRegistryService,
		private readonly lock: DeviceStructureLockService,
		private readonly runtime: VirtualThermostatRuntimeService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: ConfigService = new ConfigService(),
	) {
		this.installations.isActivationPaused = (claimId) => this.pausedClaims.has(claimId);
		this.installations.onChanging = (claimId) => {
			this.pausedClaims.add(claimId);
			this.invalidate();
		};
	}
	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		for (const event of EVENTS) this.events.on(event, this.changed);
		await this.refresh();
		this.timer = setInterval(() => this.schedule(), 10000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.stopped = true;
		clearInterval(this.timer);
		for (const event of EVENTS) this.events.off(event, this.changed);
		this.installations.onChanging = undefined;
		this.installations.isActivationPaused = undefined;
		this.invalidate();
	}
	private schedule(): void {
		if (this.scheduled || this.stopped) return;
		this.scheduled = true;
		this.queue = this.queue
			.then(async () => {
				if (this.stopped) return;
				const epoch = this.epoch;
				try {
					await this.refresh();
				} catch {
					if (epoch === this.epoch) this.invalidate();
				}
			})
			.finally(() => {
				this.scheduled = false;
			});
	}
	invalidate(): void {
		this.epoch++;
		for (const entry of this.active.values()) {
			this.claims.revokeQualification(entry.identity);
			this.runtime.request(entry.controllerId);
		}
		this.active.clear();
	}
	async refresh(): Promise<void> {
		const rows = await this.dataSource.manager.find(ThermostatInstallationEntity);
		for (const row of rows) await this.verify(row.claimId, undefined, null);
	}
	/** Explicit human activation fences before every await; background refresh only renews already armed intent. */
	async verify(claimId: string, expectedRevision?: number, actorId: string | null = null): Promise<void> {
		// A renewal cannot supersede the human operation that is still establishing armed intent.
		if (actorId === null && this.humanVerifications.has(claimId)) return;
		let release: (() => void) | undefined;
		if (actorId !== null) {
			release = this.claims.holdRecoveryFence();
			this.claims.revokeAllQualifications();
			this.pausedClaims.add(claimId);
			this.invalidate();
		}
		const operation = Symbol();
		const epoch = this.epoch;
		this.verifications.set(claimId, operation);
		if (actorId !== null) this.humanVerifications.set(claimId, operation);
		const isCurrent = () => epoch === this.epoch && this.verifications.get(claimId) === operation && !this.stopped;
		try {
			await this.verifyProfile(claimId, expectedRevision, actorId, isCurrent);
		} catch (error) {
			const current = isCurrent();
			if (current) this.invalidate();
			if (actorId !== null || current) throw error;
		} finally {
			if (this.verifications.get(claimId) === operation) this.verifications.delete(claimId);
			if (this.humanVerifications.get(claimId) === operation) this.humanVerifications.delete(claimId);
			if (release) {
				release();
				await this.claims.refresh();
			}
		}
	}
	private async verifyProfile(
		claimId: string,
		expectedRevision: number | undefined,
		actorId: string | null,
		isCurrent: () => boolean,
	): Promise<void> {
		const epoch = this.epoch;
		const row = await this.dataSource.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId });
		if (expectedRevision !== undefined && row.revision !== expectedRevision)
			throw new ConflictException('Installation revision changed; inspect again.');
		let lease: { isCurrent: () => boolean } | null = null;
		const reasons: string[] = [];
		let hash: string;
		let verifiedConfigurationRevision: number;
		try {
			const binding = await this.bindings.resolve(this.dataSource.manager, claimId);
			verifiedConfigurationRevision = binding.config.revision;
			if (row.revokedAt) reasons.push('installation_revoked');
			if (actorId === null && (!row.armedAt || this.pausedClaims.has(claimId)))
				reasons.push('operator_activation_required');
			if (binding.fingerprint !== row.bindingFingerprint || binding.claim.revision !== row.claimRevision)
				reasons.push('installation_bindings_changed');
			validateThermostatInstallation(row.setup, row.attestations, binding);
			reasons.push(...installationAttestationReasons(row, binding.opposed));
			if (reasons.length === 0) {
				const artifact = thermostatInstallationArtifact(row, binding);
				hash = artifact.sourceHash;
				if (hash !== row.expectedScriptHash) throw new Error('reviewed_artifact_version_changed');
				const platform = this.platforms.get(binding.target.device);
				if (!(platform instanceof ShellyNgDevicePlatform)) reasons.push('managed_shelly_provider_unavailable');
				else {
					const session = platform.prepareGuardRpcSession(binding.target, artifact.qualification);
					lease =
						(await session?.inspectInstallation(
							{
								componentType: row.setup.floorComponentType,
								componentId: row.setup.floorComponentId,
								configurationJson: row.setup.floorConfigurationJson,
								switchConfigurationJson: row.setup.switchConfigurationJson,
								peripheralsJson: row.setup.peripheralsJson,
							},
							5000,
							() => epoch === this.epoch && !this.stopped,
						)) ?? null;
					if (!lease?.isCurrent()) reasons.push('actual_device_code_floor_switch_or_connection_not_verified');
				}
			}
		} catch (error) {
			reasons.push(error instanceof Error ? error.message : 'installation_verification_failed');
		}
		await this.lock.runExclusive(async () => {
			const current = await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId });
			if (!current || current.revision !== row.revision || !isCurrent()) return;
			let verifiedBinding: Awaited<ReturnType<ThermostatInstallationBindingsService['resolve']>>;
			try {
				verifiedBinding = await this.bindings.resolve(this.dataSource.manager, claimId);
				if (verifiedConfigurationRevision !== verifiedBinding.config.revision)
					reasons.push('configuration_changed_during_inspection');
				if (verifiedBinding.fingerprint !== row.bindingFingerprint)
					reasons.push('installation_bindings_changed_during_inspection');
			} catch {
				reasons.push('installation_bindings_unavailable');
			}
			if (!isCurrent()) return;
			if (!lease?.isCurrent() && reasons.length === 0) reasons.push('machine_lease_expired');
			const observation: ThermostatMachineObservation = {
				observedAt: new Date().toISOString(),
				configurationRevision: verifiedConfigurationRevision,
				state: reasons.length ? 'blocked' : 'verified_metadata',
				reasons,
				...(reasons.length === 0 ? { scriptHash: hash, firmware: row.setup.firmware } : {}),
				physicalSafetyCertified: false,
			};
			// Qualification is published only after durable observation/explicit activation commit succeeds.
			if (
				actorId ||
				JSON.stringify({ ...current.lastMachineObservation, observedAt: null }) !==
					JSON.stringify({ ...observation, observedAt: null })
			) {
				await this.dataSource.transaction(async (manager) => {
					const result = await manager.update(
						ThermostatInstallationEntity,
						{ claimId, revision: row.revision },
						{
							lastMachineObservation: observation,
							...(actorId && reasons.length === 0 ? { armedAt: current.armedAt ?? new Date() } : {}),
						},
					);
					if (result.affected !== 1) throw new ConflictException('Installation revision changed during verification.');
					if (!isCurrent()) throw new ConflictException('Installation verification superseded.');
					await manager.save(
						ThermostatInstallationAuditEntity,
						manager.create(ThermostatInstallationAuditEntity, {
							claimId,
							revision: row.revision,
							action: reasons.length ? 'metadata_blocked' : actorId ? 'activated' : 'metadata_verified',
							actorId,
							occurredAt: new Date(),
							snapshot: {
								setup: row.setup,
								attestations: row.attestations,
								bindingFingerprint: row.bindingFingerprint,
								expectedScriptHash: row.expectedScriptHash,
								observation,
							},
						}),
					);
					if (!isCurrent()) throw new ConflictException('Installation verification superseded.');
					if (reasons.length === 0 && !lease?.isCurrent())
						throw new ConflictException('Installation machine lease expired during verification.');
				});
			}
			if (!isCurrent()) return;
			const existing = this.active.get(claimId);
			if (reasons.length || !lease?.isCurrent()) {
				this.claims.revokeQualification(row.physicalIdentity);
				this.active.delete(claimId);
				if (existing) this.runtime.request(row.controllerId);
				return;
			}
			if (actorId) this.pausedClaims.delete(claimId);
			if (this.pausedClaims.has(claimId)) return;
			const entry = {
				revision: row.revision,
				configurationRevision: verifiedConfigurationRevision,
				identity: row.physicalIdentity,
				controllerId: row.controllerId,
				isCurrent: lease.isCurrent,
			};
			if (
				!existing ||
				existing.revision !== row.revision ||
				existing.configurationRevision !== verifiedConfigurationRevision ||
				!existing.isCurrent()
			) {
				this.active.set(claimId, entry);
				const artifact = thermostatInstallationArtifact(row, verifiedBinding);
				this.claims.recordQualification({
					physicalIdentity: row.physicalIdentity,
					qualificationGeneration: verifiedBinding.claim.qualificationGeneration ?? undefined,
					profile: artifact.qualification,
					upstreamWritersExcluded: true,
					opposedOutputsInterlocked:
						!verifiedBinding.opposed || row.attestations.some((item) => item.kind === 'opposed_interlock'),
					machineLeaseIsCurrent: () =>
						epoch === this.epoch &&
						!this.pausedClaims.has(claimId) &&
						this.active.get(claimId) === entry &&
						entry.isCurrent(),
				});
				this.runtime.request(row.controllerId);
			}
		});
	}
}
