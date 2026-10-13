import { DataSource } from 'typeorm';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
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
import { ThermostatGuardSetup, ThermostatOperatorAttestation } from './thermostat-installation.types';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';

@Injectable()
export class ThermostatInstallationService {
	/** The loader owns this synchronous invalidation hook; authoring never supplies machine proof. */
	onChanging?: (claimId: string) => void;
	constructor(
		private readonly dataSource: DataSource,
		private readonly lock: DeviceStructureLockService,
		private readonly bindings: ThermostatInstallationBindingsService,
		private readonly claims: VirtualThermostatClaimsService,
		private readonly runtime: VirtualThermostatRuntimeService,
	) {}
	async stage(
		claimId: string,
		expectedRevision: number,
		setup: ThermostatGuardSetup,
		attestations: ThermostatOperatorAttestation[],
		actorId: string,
	): Promise<void> {
		const release = this.beginMutation(claimId);
		try {
			await this.lock.runExclusive(async () => {
				const binding = await this.bindings.resolve(this.dataSource.manager, claimId);
				validateThermostatInstallation(setup, attestations, binding);
				const prior = await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId });
				if (
					!Number.isSafeInteger(expectedRevision) ||
					expectedRevision < 0 ||
					(prior?.revision ?? 0) !== expectedRevision
				)
					throw new ConflictException('Installation revision changed; inspect again.');
				this.invalidate(binding.claim.physicalIdentity, binding.claim.controllerId);
				await this.dataSource.transaction(async (manager) => {
					const row = manager.create(ThermostatInstallationEntity, {
						claimId,
						revision: expectedRevision + 1,
						controllerId: binding.claim.controllerId,
						physicalIdentity: binding.claim.physicalIdentity,
						claimRevision: binding.claim.revision,
						configurationRevision: binding.config.revision,
						bindingFingerprint: binding.fingerprint,
						setup,
						attestations,
						updatedBy: actorId,
						updatedAt: new Date(),
						revokedAt: null,
						armedAt: null,
						lastMachineObservation: null,
					});
					const artifact = thermostatInstallationArtifact(row, binding);
					row.expectedScriptHash = artifact.sourceHash;
					row.artifactSource = artifact.source;
					if (prior) {
						const result = await manager.update(
							ThermostatInstallationEntity,
							{ claimId, revision: expectedRevision },
							row,
						);
						if (result.affected !== 1) throw new ConflictException('Installation revision changed.');
					} else await manager.insert(ThermostatInstallationEntity, row);
					await manager.save(
						ThermostatInstallationAuditEntity,
						manager.create(ThermostatInstallationAuditEntity, {
							claimId,
							revision: row.revision,
							action: 'staged',
							actorId,
							occurredAt: new Date(),
							snapshot: {
								setup,
								attestations,
								bindingFingerprint: binding.fingerprint,
								expectedScriptHash: row.expectedScriptHash,
							},
						}),
					);
				});
			});
		} finally {
			release();
			await this.claims.refresh();
		}
	}
	async revoke(claimId: string, expectedRevision: number, actorId: string): Promise<void> {
		const release = this.beginMutation(claimId);
		try {
			await this.lock.runExclusive(async () => {
				const row = await this.dataSource.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId });
				if (row.revision !== expectedRevision)
					throw new ConflictException('Installation revision changed; inspect again.');
				this.invalidate(row.physicalIdentity, row.controllerId);
				await this.dataSource.transaction(async (manager) => {
					const result = await manager.update(
						ThermostatInstallationEntity,
						{ claimId, revision: expectedRevision },
						{
							revision: expectedRevision + 1,
							revokedAt: new Date(),
							armedAt: null,
							updatedAt: new Date(),
							updatedBy: actorId,
							lastMachineObservation: null,
						},
					);
					if (result.affected !== 1) throw new ConflictException('Installation revision changed.');
					await manager.save(
						ThermostatInstallationAuditEntity,
						manager.create(ThermostatInstallationAuditEntity, {
							claimId,
							revision: expectedRevision + 1,
							action: 'revoked',
							actorId,
							occurredAt: new Date(),
							snapshot: {
								setup: row.setup,
								attestations: row.attestations,
								bindingFingerprint: row.bindingFingerprint,
							},
						}),
					);
				});
			});
		} finally {
			release();
			await this.claims.refresh();
		}
	}
	private beginMutation(claimId: string): () => void {
		const release = this.claims.holdRecoveryFence();
		this.claims.revokeAllQualifications();
		this.onChanging?.(claimId);
		return release;
	}
	private invalidate(identity: string, controllerId: string): void {
		this.claims.revokeQualification(identity);
		this.runtime.request(controllerId);
	}
	async inspect(claimId: string) {
		const row = await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId });
		if (!row) throw new NotFoundException('No installation profile; stage equipment details first.');
		const reasons: string[] = [];
		try {
			const binding = await this.bindings.resolve(this.dataSource.manager, claimId);
			if (binding.fingerprint !== row.bindingFingerprint || binding.claim.revision !== row.claimRevision)
				reasons.push('installation_bindings_changed');
			validateThermostatInstallation(row.setup, row.attestations, binding);
			reasons.push(...installationAttestationReasons(row, binding.opposed));
			const artifact = thermostatInstallationArtifact(row, binding);
			if (artifact.sourceHash !== row.expectedScriptHash) reasons.push('reviewed_artifact_version_changed');
			if (!this.claims.qualification(binding.claim, binding.opposed))
				reasons.push('current_machine_verification_missing');
		} catch (error) {
			reasons.push(error instanceof Error ? error.message : 'installation_bindings_unavailable');
		}
		if (row.revokedAt) reasons.push('installation_revoked');
		if (!row.armedAt) reasons.push('operator_activation_required');
		return {
			claim: row.claimId,
			revision: row.revision,
			activation_requested: row.armedAt !== null,
			setup: row.setup,
			operator_attestations: row.attestations,
			machine_observation: row.lastMachineObservation,
			physical_safety_certified: false as const,
			readiness: reasons.length ? ('blocked' as const) : ('metadata_verified_runtime_fence_required' as const),
			reasons,
			artifact: row.artifactSource,
			source_hash: row.expectedScriptHash,
			audit: await this.dataSource.manager.find(ThermostatInstallationAuditEntity, {
				where: { claimId },
				order: { occurredAt: 'DESC' },
				take: 100,
			}),
		};
	}
}
