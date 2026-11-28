import { DataSource, In } from 'typeorm';

import {
	ConflictException,
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnModuleDestroy,
	Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { DeviceBindingsEvent } from '../../../modules/devices/contracts/device-bindings.event';
import { EventType } from '../../../modules/devices/devices.constants';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { VIRTUAL_DEVICE_BINDINGS_CHANGED } from '../../devices-virtual/contracts/virtual-device-bindings.event';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../../devices-virtual/devices-virtual.constants';
import { VirtualThermostatClaimsService } from '../../devices-virtual/services/virtual-thermostat-claims.service';
import { THERMOSTAT_CONFIG_CHANGED } from '../../devices-virtual/services/virtual-thermostat-config.service';
import { VirtualThermostatRuntimeService } from '../../devices-virtual/services/virtual-thermostat-runtime.service';
import { SHELLY_GUARDED_PROFILE, SHELLY_GUARDED_PROFILE_VERSION } from '../contracts/thermostat-actuation.constants';
import {
	ThermostatInstallationAuditEntity,
	ThermostatInstallationEntity,
} from '../entities/thermostat-installation.entity';
import { ShellyNgDevicePlatform } from '../platforms/shelly-ng.device.platform';

import { REMOTE_DEW_POINT_PROFILE } from './remote-dew-point-lease.contract';
import {
	installationAttestationReasons,
	thermostatInstallationArtifact,
	validateThermostatInstallation,
} from './thermostat-installation-artifact';
import { ThermostatInstallationBindingsService } from './thermostat-installation-bindings.service';
import { ThermostatInstallationService } from './thermostat-installation.service';
import { ThermostatMachineObservation } from './thermostat-installation.types';

const EVENTS = [
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
	private readonly logger = new Logger(ThermostatInstallationLoaderService.name);
	private epoch = 0;
	private stopped = false;
	private timer?: ReturnType<typeof setInterval>;
	private queue: Promise<void> = Promise.resolve();
	private scheduled = false;
	private refreshAll = false;
	private readonly refreshClaims = new Set<string>();
	private readonly pendingOwners = new Map<string, string>();
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
	private readonly bindingsChanged = (event: DeviceBindingsEvent) => {
		if (event.producer !== DEVICES_VIRTUAL_PLUGIN_NAME || event.kind !== 'thermostat') return;
		const selected = [...event.bindings, ...(event.removedBindings ?? [])].filter(
			(binding) =>
				binding.claimId &&
				(binding.providerProfile === SHELLY_GUARDED_PROFILE || binding.providerProfile === REMOTE_DEW_POINT_PROFILE),
		);
		// Remote cooling evidence may come from a separate installed verifier with no local staged guard row.
		for (const binding of selected) {
			if (binding.providerProfile === REMOTE_DEW_POINT_PROFILE && binding.physicalIdentity)
				this.claims.revokeQualification(binding.physicalIdentity, REMOTE_DEW_POINT_PROFILE);
		}
		this.invalidateController(
			event.deviceId,
			selected.map((binding) => binding.claimId),
		);
	};
	private readonly configChanged = (controllerId: string) => this.invalidateController(controllerId, []);

	private invalidateController(controllerId: string, changedClaims: string[]): void {
		const affected = new Set(changedClaims);
		for (const [claimId, owner] of this.pendingOwners) if (owner === controllerId) affected.add(claimId);
		for (const [claimId, entry] of this.active) if (entry.controllerId === controllerId) affected.add(claimId);
		if (!affected.size) return;
		for (const claimId of affected) {
			this.verifications.delete(claimId);
			this.invalidateClaim(claimId);
		}
		this.schedule(affected);
	}

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
		this.events.on(VIRTUAL_DEVICE_BINDINGS_CHANGED, this.bindingsChanged);
		this.events.on(THERMOSTAT_CONFIG_CHANGED, this.configChanged);
		for (const event of EVENTS) this.events.on(event, this.changed);
		const epoch = this.epoch;
		try {
			await this.refresh();
		} catch (error) {
			if (epoch === this.epoch) this.invalidate();
			this.logger.error('Installation renewal failed during startup; retrying on the next cycle', error);
		}
		this.timer = setInterval(() => this.schedule(), 10000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.stopped = true;
		clearInterval(this.timer);
		this.events.off(VIRTUAL_DEVICE_BINDINGS_CHANGED, this.bindingsChanged);
		this.events.off(THERMOSTAT_CONFIG_CHANGED, this.configChanged);
		for (const event of EVENTS) this.events.off(event, this.changed);
		this.installations.onChanging = undefined;
		this.installations.isActivationPaused = undefined;
		this.invalidate();
	}
	private schedule(affected?: Set<string>): void {
		if (this.stopped) return;
		if (affected) for (const id of affected) this.refreshClaims.add(id);
		else this.refreshAll = true;
		if (this.scheduled) return;
		this.scheduled = true;
		this.queue = this.queue.then(async () => {
			this.scheduled = false;
			if (this.stopped) return;
			const ids = this.refreshAll ? undefined : [...this.refreshClaims];
			this.refreshAll = false;
			this.refreshClaims.clear();
			const epoch = this.epoch;
			try {
				await this.refresh(ids);
			} catch {
				if (epoch !== this.epoch) return;
				if (ids) for (const id of ids) this.invalidateClaim(id);
				else this.invalidate();
			}
		});
	}
	invalidate(): void {
		this.epoch++;
		for (const entry of this.active.values()) {
			this.claims.revokeQualification(entry.identity, SHELLY_GUARDED_PROFILE);
			void this.runtime.request(entry.controllerId);
		}
		this.active.clear();
	}
	async refresh(claimIds?: string[]): Promise<void> {
		const rows = claimIds
			? await this.dataSource.manager.find(ThermostatInstallationEntity, { where: { claimId: In(claimIds) } })
			: await this.dataSource.manager.find(ThermostatInstallationEntity);
		for (const row of rows) {
			try {
				await this.verify(row.claimId, undefined, null);
			} catch (error) {
				// verify revokes only the current failing claim; other renewals must continue.
				this.logger.error(`Installation renewal failed for claim=${row.claimId}`, error);
			}
		}
	}
	/** Explicit human activation fences before every await; background refresh only renews already armed intent. */
	async verify(claimId: string, expectedRevision?: number, actorId: string | null = null): Promise<void> {
		// A renewal cannot supersede the human operation that is still establishing armed intent.
		if (actorId === null && this.humanVerifications.has(claimId)) return;
		let release: (() => void) | undefined;
		if (actorId !== null) {
			release = this.claims.holdRecoveryFence();
			this.claims.revokeAllQualifications(SHELLY_GUARDED_PROFILE);
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
			if (current) {
				if (actorId !== null) this.invalidate();
				else this.invalidateClaim(claimId);
			}
			if (actorId !== null || current) throw error;
		} finally {
			if (this.verifications.get(claimId) === operation) this.verifications.delete(claimId);
			if (!this.verifications.has(claimId)) this.pendingOwners.delete(claimId);
			if (this.humanVerifications.get(claimId) === operation) this.humanVerifications.delete(claimId);
			if (release) {
				release();
				// Reload closes admission and schedules retry itself; preserve the verification outcome.
				await this.claims.refresh().catch(() => undefined);
			}
		}
	}
	private invalidateClaim(claimId: string): void {
		const entry = this.active.get(claimId);
		if (!entry) return;
		this.active.delete(claimId);
		this.claims.revokeQualification(entry.identity, SHELLY_GUARDED_PROFILE);
		void this.runtime.request(entry.controllerId);
	}
	private async verifyProfile(
		claimId: string,
		expectedRevision: number | undefined,
		actorId: string | null,
		isCurrent: () => boolean,
	): Promise<void> {
		const epoch = this.epoch;
		const row = await this.dataSource.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId });
		if (!isCurrent()) return;
		this.pendingOwners.set(claimId, row.controllerId);
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
				this.claims.revokeQualification(row.physicalIdentity, SHELLY_GUARDED_PROFILE);
				this.active.delete(claimId);
				if (existing) void this.runtime.request(row.controllerId);
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
					contractVersion: 1,
					providerProfile: { id: SHELLY_GUARDED_PROFILE, version: SHELLY_GUARDED_PROFILE_VERSION },
					physicalIdentity: row.physicalIdentity,
					qualificationGeneration: verifiedBinding.claim.qualificationGeneration,
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
				void this.runtime.request(row.controllerId);
			}
		});
	}
}
