import { DataSource } from 'typeorm';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
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
import {
	ThermostatGuardSetup,
	ThermostatMemberGuardSetup,
	ThermostatOperatorAttestation,
} from './thermostat-installation.types';
import { VirtualNumericTransformOperator } from './virtual-numeric-transform.utils';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatRuntimeService } from './virtual-thermostat-runtime.service';

@Injectable()
export class ThermostatInstallationService {
	/** The loader owns this synchronous invalidation hook; authoring never supplies machine proof. */
	onChanging?: (claimId: string) => void;
	/** Read-only diagnostic of the loader pause; durable accepted activation is a separate fact. */
	isActivationPaused?: (claimId: string) => boolean;
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
		setup: ThermostatGuardSetup | ThermostatMemberGuardSetup,
		attestations: ThermostatOperatorAttestation[],
		actorId: string,
		authoringFence?: {
			configurationRevision?: number;
			claimRevision?: number;
			qualificationGeneration?: string | null;
		},
	): Promise<void> {
		const release = this.beginMutation(claimId);
		try {
			await this.lock.runExclusive(async () => {
				const binding = await this.bindings.resolve(this.dataSource.manager, claimId);
				if (
					authoringFence &&
					((authoringFence.configurationRevision !== undefined &&
						authoringFence.configurationRevision !== binding.config.revision) ||
						(authoringFence.claimRevision !== undefined && authoringFence.claimRevision !== binding.claim.revision) ||
						('qualificationGeneration' in authoringFence &&
							authoringFence.qualificationGeneration !== binding.claim.qualificationGeneration))
				)
					throw new ConflictException(
						'Reviewed configuration, claim or recovery generation changed; reload installation context.',
					);
				const resolvedSetup = resolveInstallationSetup(setup, binding);
				validateThermostatInstallation(resolvedSetup, attestations, binding);
				const prior = await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId });
				if (
					!Number.isSafeInteger(expectedRevision) ||
					expectedRevision < 0 ||
					(prior?.revision ?? 0) !== expectedRevision
				)
					throw new ConflictException(
						'Installation change rejected; prior stored profile and activation remain unchanged. Reload the current revision and retry.',
					);
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
						setup: resolvedSetup,
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
						if (result.affected !== 1)
							throw new ConflictException(
								'Installation change rejected; prior stored profile and activation remain unchanged. Reload the current revision and retry.',
							);
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
								setup: resolvedSetup,
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
			// Reload closes admission and schedules retry itself; preserve the committed/rejected operation outcome.
			await this.claims.refresh().catch(() => undefined);
		}
	}
	async revoke(claimId: string, expectedRevision: number, actorId: string): Promise<void> {
		const release = this.beginMutation(claimId);
		try {
			await this.lock.runExclusive(async () => {
				const row = await this.dataSource.manager.findOneByOrFail(ThermostatInstallationEntity, { claimId });
				if (row.revision !== expectedRevision)
					throw new ConflictException(
						'Installation change rejected; prior stored profile and activation remain unchanged. Reload the current revision and retry.',
					);
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
					if (result.affected !== 1)
						throw new ConflictException(
							'Installation change rejected; prior stored profile and activation remain unchanged. Reload the current revision and retry.',
						);
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
			// Reload closes admission and schedules retry itself; preserve the committed/rejected operation outcome.
			await this.claims.refresh().catch(() => undefined);
		}
	}
	private beginMutation(claimId: string): () => void {
		const release = this.claims.holdRecoveryFence();
		this.claims.revokeAllQualifications();
		this.onChanging?.(claimId);
		this.runtime.fenceMember?.(claimId);
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
		else if (this.isActivationPaused?.(claimId))
			reasons.push('stored_activation_paused_reload_and_retry_failed_change_or_explicitly_verify');
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

/** Resolve once under the structural lock; validation and stored artifact consume this exact snapshot. */
export function resolveInstallationSetup(
	setup: ThermostatGuardSetup | ThermostatMemberGuardSetup,
	binding: Awaited<ReturnType<ThermostatInstallationBindingsService['resolve']>>,
): ThermostatGuardSetup {
	if (!binding.memberProtection) {
		if (setup.formatVersion !== undefined)
			throw new DevicesValidationException('Member format requires explicit protection adoption.');
		return setup as ThermostatGuardSetup;
	}
	if (setup.formatVersion !== 2 || !binding.protectionSource?.metadata.installationSnapshot)
		throw new DevicesValidationException(
			'Explicit member format and current complete source catalog snapshot required.',
		);
	const allowed = [
		'formatVersion',
		'installedFloorCeilingC',
		'deviceHardwareId',
		'firmware',
		'endpointHostname',
		'scriptId',
		'epochKey',
		'heatingSetpointRange',
		'coolingSetpointRange',
		'minimumLeaseSeconds',
		'maximumLeaseSeconds',
		'watchdogMs',
		'switchConfigurationJson',
	];
	if (Object.keys(setup).some((key) => !allowed.includes(key)))
		throw new DevicesValidationException('Member installation sensor metadata is derived, not authored.');
	const source = binding.protectionSource;
	const [component, id] = source.metadata.componentKey.split(':');
	if (!['temperature', 'input', 'voltmeter'].includes(component))
		throw new DevicesValidationException('Unsupported floor component.');
	const candidate = source.transform?.policy;
	const policy = candidate?.operator === VirtualNumericTransformOperator.STEINHART_HART ? candidate : null;
	return {
		...setup,
		floorDomainC: source.domain,
		effectiveFloorCutoffC: Math.min(binding.config.policy.floor.limit, setup.installedFloorCeilingC),
		floorMaximumAgeMs: binding.floorMaximumAgeMs,
		floorComponentType: component as ThermostatGuardSetup['floorComponentType'],
		floorComponentId: Number(id),
		floorAttribute: source.leaf.identifier as ThermostatGuardSetup['floorAttribute'],
		floorConfigurationJson: JSON.stringify(source.metadata.installationSnapshot.configuration),
		peripheralsJson: JSON.stringify(source.metadata.installationSnapshot.peripherals),
		...(policy
			? {
					floorConversion: {
						kind: 'steinhart_hart' as const,
						referenceVoltage: policy.referenceVoltage,
						seriesResistance: policy.seriesResistance,
						a: policy.coefficientA,
						b: policy.coefficientB,
						c: policy.coefficientC,
						thermistorLeg: policy.thermistorLeg,
						inputRange: policy.inputRange,
						outputRange: policy.outputRange,
					},
				}
			: {}),
	};
}
