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
	) {}
	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on') return;
		this.installations.onChanged = () => this.changed();
		for (const event of EVENTS) this.events.on(event, this.changed);
		await this.refresh();
		this.timer = setInterval(() => this.schedule(), 10000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		this.stopped = true;
		clearInterval(this.timer);
		for (const event of EVENTS) this.events.off(event, this.changed);
		this.installations.onChanged = undefined;
		this.invalidate();
	}
	private schedule(): void {
		if (this.scheduled || this.stopped) return;
		this.scheduled = true;
		this.queue = this.queue
			.then(() => (this.stopped ? undefined : this.refresh()))
			.catch(() => this.invalidate())
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
	/** Explicit operator action, limited to metadata reads. Runtime fencing is a separate release action. */
	async verify(claimId: string, expectedRevision?: number, actorId: string | null = null): Promise<void> {
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
		await this.lock
			.runExclusive(async () => {
				const current = await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId });
				if (!current || current.revision !== row.revision || epoch !== this.epoch || this.stopped) return;
				try {
					const verifiedBinding = await this.bindings.resolve(this.dataSource.manager, claimId);
					if (verifiedConfigurationRevision !== verifiedBinding.config.revision)
						reasons.push('configuration_changed_during_inspection');
					if (verifiedBinding.fingerprint !== row.bindingFingerprint)
						reasons.push('installation_bindings_changed_during_inspection');
				} catch {
					reasons.push('installation_bindings_unavailable');
				}
				const existing = this.active.get(claimId);
				if (reasons.length || !lease?.isCurrent()) {
					this.claims.revokeQualification(row.physicalIdentity);
					this.active.delete(claimId);
					if (existing) this.runtime.request(row.controllerId);
				} else {
					const binding = await this.bindings.resolve(this.dataSource.manager, claimId);
					const entry = {
						revision: row.revision,
						configurationRevision: verifiedConfigurationRevision,
						identity: row.physicalIdentity,
						controllerId: row.controllerId,
						isCurrent: lease.isCurrent,
					};
					this.active.set(claimId, entry);
					if (
						!existing ||
						existing.revision !== row.revision ||
						existing.configurationRevision !== verifiedConfigurationRevision ||
						!existing.isCurrent()
					) {
						const artifact = thermostatInstallationArtifact(row, binding);
						this.claims.recordQualification({
							physicalIdentity: row.physicalIdentity,
							qualificationGeneration: binding.claim.qualificationGeneration ?? undefined,
							profile: artifact.qualification,
							upstreamWritersExcluded: true,
							opposedOutputsInterlocked:
								!binding.opposed || row.attestations.some((item) => item.kind === 'opposed_interlock'),
							machineLeaseIsCurrent: () =>
								epoch === this.epoch &&
								this.active.get(claimId)?.revision === row.revision &&
								this.active.get(claimId).isCurrent(),
						});
						this.runtime.request(row.controllerId);
					}
				}
				const observation: ThermostatMachineObservation = {
					observedAt: new Date().toISOString(),
					configurationRevision: verifiedConfigurationRevision,
					state: reasons.length ? 'blocked' : 'verified_metadata',
					reasons,
					...(reasons.length === 0 && lease?.isCurrent() ? { scriptHash: hash, firmware: row.setup.firmware } : {}),
					physicalSafetyCertified: false,
				};
				// Avoid ten-second duplicate audit entries while retaining explicit inspections and transitions.
				if (
					actorId ||
					JSON.stringify({ ...current.lastMachineObservation, observedAt: null }) !==
						JSON.stringify({ ...observation, observedAt: null })
				) {
					await this.dataSource.transaction(async (manager) => {
						await manager.update(
							ThermostatInstallationEntity,
							{ claimId, revision: row.revision },
							{ lastMachineObservation: observation },
						);
						await manager.save(
							ThermostatInstallationAuditEntity,
							manager.create(ThermostatInstallationAuditEntity, {
								claimId,
								revision: row.revision,
								action: observation.state === 'blocked' ? 'metadata_blocked' : 'metadata_verified',
								actorId,
								occurredAt: new Date(),
								snapshot: {
									setup: row.setup,
									attestations: row.attestations,
									bindingFingerprint: row.bindingFingerprint,
									observation,
								},
							}),
						);
					});
				}
			})
			.catch((error: unknown) => {
				this.invalidate();
				throw error;
			});
	}
}
