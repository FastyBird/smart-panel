import { DataSource, EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { ClimateAutomationParticipantTurn } from '../../../modules/devices/contracts/climate-automation.contract';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ClimateAutomationWriterService } from '../../../modules/devices/services/climate-automation-writer.service';
import { DiagnosticSampleData, PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import { ThermostatCoolingDependencyDto } from '../dto/thermostat-config.dto';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import {
	ThermostatProtectionLineageRows,
	ThermostatProtectionSource,
	resolveReservedThermostatProtectionSource,
	resolveThermostatProtectionSource,
	validateThermostatProtectionRows,
} from './thermostat-protection-source.utils';
import { VirtualCoolingPolicy, evaluateCoolingProtection } from './virtual-cooling-policy.utils';
import { ThermostatQualificationDiagnostic, VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { thermostatFingerprint } from './virtual-thermostat-contract.utils';

export interface CoolingBinding {
	claimId: string;
	controllerRevision: number;
	claim: VirtualThermostatActuatorClaimEntity;
	opposed: boolean;
	dependency: ThermostatCoolingDependencyEntity | null;
	dewPoint: ChannelPropertyEntity | null;
	surface: ThermostatProtectionSource | null;
	policy: VirtualCoolingPolicy;
	basis: string;
}
export interface CoolingDiagnostic {
	claim: string;
	dew_point_identity: string | null;
	surface_identity: string | null;
	dew_point: number | null;
	surface: number | null;
	threshold: number | null;
	expires_at: string | null;
	latched: boolean;
	ready: boolean;
	reasons: string[];
}

@Injectable()
export class ThermostatCoolingDependencyService {
	private readonly latches = new Map<
		string,
		{ basis: string; latched: boolean; barrier: number; releaseAfter: number | null; gap: boolean }
	>();
	private readonly controllerClaims = new Map<string, Set<string>>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly values: PropertyValueService,
		private readonly claims?: VirtualThermostatClaimsService,
	) {}
	reset(): void {
		this.latches.clear();
		this.controllerClaims.clear();
	}

	async prepare(
		manager: EntityManager,
		claim: VirtualThermostatActuatorClaimEntity,
		dto: ThermostatCoolingDependencyDto,
		versionFree?: Readonly<{ writer: ClimateAutomationWriterService; turn: ClimateAutomationParticipantTurn }>,
	): Promise<ThermostatCoolingDependencyEntity> {
		const check = (): void => {
			if (versionFree) versionFree.writer.assertParticipantTurn(manager, versionFree.turn, ['NORMALIZE']);
		};
		check();
		const fail = (): never => {
			throw new DevicesValidationException(
				'Cooling requires dedicated dew point and a separate local cooled-surface dependency.',
			);
		};
		if (
			!dto ||
			dto.schemaVersion !== 1 ||
			dto.purpose !== 'cooled_surface' ||
			!Number.isInteger(dto.maximumAgeSeconds) ||
			dto.maximumAgeSeconds < 1 ||
			dto.maximumAgeSeconds > 86400 ||
			claim.role !== 'cooling'
		)
			return fail();
		const old =
			versionFree && typeof claim.id !== 'string'
				? null
				: versionFree
					? await manager
							.createQueryBuilder(ThermostatCoolingDependencyEntity, 'row')
							.where('row.claimId = :id', { id: claim.id })
							.callListeners(false)
							.getOne()
					: await manager.findOneBy(ThermostatCoolingDependencyEntity, { claimId: claim.id });
		check();
		if (dto.dewPointPropertyId === undefined || dto.surfacePropertyId === undefined) return fail();
		const row = manager.create(ThermostatCoolingDependencyEntity, {
			...old,
			claimId: claim.id,
			schemaVersion: 1,
			purpose: 'cooled_surface',
			revision: versionFree ? (old?.revision ?? 0) : (old?.revision ?? 0) + 1,
			maximumAgeSeconds: dto.maximumAgeSeconds,
		});
		if (dto.dewPointPropertyId === null) {
			if (!old || old.dewPointPropertyId !== null) return fail();
		} else {
			const dew = versionFree
				? await manager
						.createQueryBuilder(VirtualDewPointConfigEntity, 'row')
						.where('row.outputPropertyId = :id', { id: dto.dewPointPropertyId })
						.callListeners(false)
						.getOne()
				: await manager.findOneBy(VirtualDewPointConfigEntity, { outputPropertyId: dto.dewPointPropertyId });
			check();
			if (!dew) return fail();
			const sources = versionFree
				? await manager
						.createQueryBuilder(VirtualDewPointSourceEntity, 'row')
						.where('row.outputPropertyId = :id', { id: dew.outputPropertyId })
						.callListeners(false)
						.getMany()
				: await manager.findBy(VirtualDewPointSourceEntity, { outputPropertyId: dew.outputPropertyId });
			check();
			row.dewPointPropertyId = dew.outputPropertyId;
			row.dewPointIdentity = dew.outputPropertyId;
			row.dewPointFingerprint = thermostatFingerprint({
				dew,
				sources: sources.sort((a, b) => a.role.localeCompare(b.role)),
			});
		}
		if (dto.surfacePropertyId === null) {
			if (!old || old.surfacePropertyId !== null) return fail();
		} else {
			const surface = versionFree
				? await resolveReservedThermostatProtectionSource(
						manager,
						versionFree.writer,
						versionFree.turn,
						dto.surfacePropertyId,
						claim.physicalIdentity,
					)
				: await resolveThermostatProtectionSource(manager, dto.surfacePropertyId, claim.physicalIdentity);
			check();
			row.surfacePropertyId = surface.property.id;
			row.surfaceIdentity = surface.property.id;
			row.physicalSurfaceIdentity = surface.leaf.id;
			row.surfaceFingerprint = surface.fingerprint;
		}
		check();
		return row;
	}

	async load(
		config: VirtualThermostatConfigEntity,
		claims: VirtualThermostatActuatorClaimEntity[],
		proposed?: ThermostatCoolingDependencyEntity[],
	): Promise<CoolingBinding[]> {
		const result: CoolingBinding[] = [];
		const active = new Set(claims.map((c) => c.id));
		for (const id of this.controllerClaims.get(config.controllerId) ?? []) if (!active.has(id)) this.latches.delete(id);
		this.controllerClaims.set(config.controllerId, active);
		if (!this.dataSource.hasMetadata?.(ThermostatCoolingDependencyEntity)) return result;
		for (const claim of claims.filter((c) => c.role === 'cooling')) {
			const dependency =
				proposed?.find((row) => row.claimId === claim.id) ??
				(await this.dataSource.manager.findOneBy(ThermostatCoolingDependencyEntity, { claimId: claim.id }));
			if (!config.policy.cooling && !dependency) continue;
			let dewPoint: ChannelPropertyEntity | null = null;
			let surface: ThermostatProtectionSource | null = null;
			try {
				if (dependency?.dewPointPropertyId) {
					const dew = await this.dataSource.manager.findOneBy(VirtualDewPointConfigEntity, {
						outputPropertyId: dependency.dewPointPropertyId,
					});
					const sources = await this.dataSource.manager.findBy(VirtualDewPointSourceEntity, {
						outputPropertyId: dependency.dewPointPropertyId,
					});
					if (
						dew &&
						dependency.dewPointFingerprint ===
							thermostatFingerprint({ dew, sources: sources.sort((a, b) => a.role.localeCompare(b.role)) })
					)
						dewPoint = await this.dataSource.manager.findOneBy(ChannelPropertyEntity, { id: dew.outputPropertyId });
				}
				if (dependency?.surfacePropertyId)
					surface = await resolveThermostatProtectionSource(
						this.dataSource.manager,
						dependency.surfacePropertyId,
						claim.physicalIdentity,
					);
				if (surface?.fingerprint !== dependency?.surfaceFingerprint) surface = null;
			} catch {
				surface = null;
			}
			result.push({
				claimId: claim.id,
				controllerRevision: config.revision,
				claim,
				opposed: claims.some((c) => c.role === 'heating'),
				dependency,
				dewPoint,
				surface,
				policy: config.policy.cooling,
				basis: thermostatFingerprint({
					dependency,
					policy: config.policy.cooling,
					revision: config.revision,
					claim: claim.revision,
					generation: claim.qualificationGeneration,
					dew: !!dewPoint,
					surface: surface?.fingerprint,
				}),
			});
		}
		return result;
	}

	requiredReleaseAfter(bindings: CoolingBinding[]): number | null {
		const times = bindings.map((b) => this.latches.get(b.claimId)?.releaseAfter).filter((t): t is number => t != null);
		return times.length ? Math.max(...times) : null;
	}
	/** Called only after current actual OFF/readback and every earlier ON has drained. */
	acknowledgeRelease(bindings: CoolingBinding[]): void {
		for (const binding of bindings) {
			const state = this.latches.get(binding.claimId);
			if (state?.basis === binding.basis && state.releaseAfter !== null) {
				state.releaseAfter = null;
				state.barrier = this.values.currentSampleGeneration();
				state.gap = true;
			}
		}
	}

	/** Capture one immutable threshold/evidence lease before any remote challenge/status/send await. */
	capture(
		entry: CoolingBinding,
		now = Date.now(),
	): {
		threshold: number;
		expiresAt: number;
		controllerRevision: number;
		protectionFingerprint: string;
		isCurrent: () => boolean;
	} | null {
		const diagnostic = this.read([entry], now)[0];
		if (
			!diagnostic?.ready ||
			diagnostic.threshold === null ||
			!diagnostic.expires_at ||
			!entry.dewPoint ||
			!entry.surface
		)
			return null;
		const dew = this.values.captureIncorporatedSample(entry.dewPoint),
			surface = this.values.captureIncorporatedSample(entry.surface.property);
		if (!dew || !surface) return null;
		const expiry = Date.parse(diagnostic.expires_at);
		return Object.freeze({
			threshold: diagnostic.threshold,
			expiresAt: expiry,
			controllerRevision: entry.controllerRevision,
			protectionFingerprint: entry.basis,
			isCurrent: () =>
				Date.now() < expiry &&
				this.values.incorporatedEvidenceCurrent([dew, surface]) &&
				this.read([entry], Date.now())[0]?.ready === true,
		});
	}

	read(bindings: CoolingBinding[], now: number): CoolingDiagnostic[] {
		return bindings.map((entry) => {
			let state = this.latches.get(entry.claimId);
			if (!state || state.basis !== entry.basis) {
				state = {
					basis: entry.basis,
					latched: true,
					barrier: this.values.currentSampleGeneration(),
					releaseAfter: now,
					gap: true,
				};
				this.latches.set(entry.claimId, state);
			}
			const maxAge = (entry.dependency?.maximumAgeSeconds ?? 0) * 1000;
			const dew = entry.dewPoint && this.values.readQualifiedSample(entry.dewPoint, maxAge, new Date(now));
			const surface =
				entry.surface?.enabled && this.values.readQualifiedSample(entry.surface.property, maxAge, new Date(now));
			const dewEvidence = dew && this.values.captureIncorporatedSample(entry.dewPoint);
			const surfaceEvidence = surface && this.values.captureIncorporatedSample(entry.surface.property);
			const fresh = (e: typeof dewEvidence): boolean =>
				!!e && (e.producer ? !!e.sources?.length && e.sources.every(fresh) : e.acceptanceGeneration > state.barrier);
			const evidenceCurrent =
				!!dew &&
				!!surface &&
				dew.quality === 'good' &&
				surface.quality === 'good' &&
				!!dewEvidence &&
				!!surfaceEvidence &&
				this.values.incorporatedEvidenceCurrent([dewEvidence, surfaceEvidence]);
			const qualification = this.claims?.qualification(entry.claim, entry.opposed);
			const remote =
				qualification?.providerProfile?.id === REMOTE_DEW_POINT_PROFILE ? qualification.profile.remoteDewPoint : null;
			const reasons = coolingObservationReasons(
				entry,
				dew || null,
				surface || null,
				evidenceCurrent,
				remote
					? {
							providerProfile: REMOTE_DEW_POINT_PROFILE,
							protectionFingerprint: remote.artifact.binding.protectionFingerprint,
							remoteLineageFingerprint: remote.artifact.binding.remoteLineageFingerprint,
							localSurfaceFingerprint: remote.artifact.binding.localSurface.calibrationFingerprint,
						}
					: null,
			);
			const sourceGap = reasons.length > 0;
			if (sourceGap && !state.gap) {
				state.barrier = this.values.currentSampleGeneration();
				state.releaseAfter ??= now;
			}
			if (!fresh(dewEvidence) || !fresh(surfaceEvidence)) reasons.push('cooling_fresh_report_required');
			const result = evaluateCoolingProtection(
				entry.policy,
				reasons.length ? null : (dew.value as number),
				reasons.length ? null : (surface.value as number),
				state.latched,
			);
			if (
				entry.surface &&
				result.threshold !== null &&
				result.threshold + entry.policy.recoveryHysteresisC >= entry.surface.domain.maximum
			)
				reasons.push('cooling_recovery_outside_surface_domain');
			const inhibited = result.latched || reasons.length > 0;
			if (inhibited && !state.latched) state.releaseAfter ??= now;
			// Recovery cannot clear the latch before actual OFF/drain. Otherwise the first
			// post-release freshness wait would look like a new trip and re-arm release forever.
			state.latched = inhibited || state.releaseAfter !== null;
			// Waiting for post-release reports is not a new physical release event on every read.
			state.gap = sourceGap;
			if (state.releaseAfter !== null) reasons.push('cooling_pending_release');

			return {
				claim: entry.claimId,
				dew_point_identity: entry.dependency?.dewPointIdentity ?? null,
				surface_identity: entry.dependency?.surfaceIdentity ?? null,
				dew_point: typeof dew?.value === 'number' ? dew.value : null,
				surface: typeof surface?.value === 'number' ? surface.value : null,
				threshold: result.threshold,
				expires_at:
					dew && surface
						? new Date(
								Math.min(
									dew.sampledAt.getTime() + maxAge,
									surface.sampledAt.getTime() + maxAge,
									dewEvidence?.producer?.expiresAt ?? Infinity,
									surfaceEvidence?.producer?.expiresAt ?? Infinity,
								),
							).toISOString()
						: null,
				latched: state.latched,
				ready: result.ready && !reasons.length && state.releaseAfter === null,
				reasons: [...reasons, ...result.reasons],
			};
		});
	}
}

/** Response-local observations only. No runtime latch, machine lease, sample read or clock is created here. */
export function evaluateThermostatCoolingResponse(
	entry: CoolingBinding,
	dew: DiagnosticSampleData,
	surface: DiagnosticSampleData,
	qualification: ThermostatQualificationDiagnostic | null,
	barrier: number,
	now: number,
): CoolingDiagnostic {
	if (!Number.isFinite(now) || !Number.isSafeInteger(barrier) || barrier < 0)
		throw new Error('Finite original cooling response observation required');
	const reasons = coolingObservationReasons(
		entry,
		dew.sample,
		surface.sample,
		dew.evidence !== null && surface.evidence !== null,
		qualification,
	);
	const fresh = (evidence: DiagnosticSampleData['evidence']): boolean =>
		!!evidence &&
		(evidence.producer
			? !!evidence.sources?.length && evidence.sources.every(fresh)
			: typeof evidence.acceptanceGeneration === 'number' && evidence.acceptanceGeneration > barrier);
	if (!fresh(dew.evidence) || !fresh(surface.evidence)) reasons.push('cooling_fresh_report_required');
	const result = evaluateCoolingProtection(
		entry.policy,
		reasons.length || typeof dew.sample?.value !== 'number' ? null : dew.sample.value,
		reasons.length || typeof surface.sample?.value !== 'number' ? null : surface.sample.value,
		true,
	);
	if (
		entry.surface &&
		result.threshold !== null &&
		result.threshold + entry.policy.recoveryHysteresisC >= entry.surface.domain.maximum
	)
		reasons.push('cooling_recovery_outside_surface_domain');
	// A fresh response has never acknowledged a physical release; it cannot inherit a runtime clear latch.
	reasons.push('cooling_pending_release');
	const maxAge = (entry.dependency?.maximumAgeSeconds ?? 0) * 1000;
	return {
		claim: entry.claimId,
		dew_point_identity: entry.dependency?.dewPointIdentity ?? null,
		surface_identity: entry.dependency?.surfaceIdentity ?? null,
		dew_point: typeof dew.sample?.value === 'number' ? dew.sample.value : null,
		surface: typeof surface.sample?.value === 'number' ? surface.sample.value : null,
		threshold: result.threshold,
		expires_at:
			dew.sample && surface.sample
				? new Date(
						Math.min(
							dew.sample.sampledAt.getTime() + maxAge,
							surface.sample.sampledAt.getTime() + maxAge,
							dew.evidence?.producer?.expiresAt ?? Infinity,
							surface.evidence?.producer?.expiresAt ?? Infinity,
						),
					).toISOString()
				: null,
		latched: true,
		ready: false,
		reasons: [...reasons, ...result.reasons],
	};
}
function coolingObservationReasons(
	entry: CoolingBinding,
	dew: DiagnosticSampleData['sample'],
	surface: DiagnosticSampleData['sample'],
	evidenceCurrent: boolean,
	qualification: ThermostatQualificationDiagnostic | null,
): string[] {
	const reasons: string[] = [];
	if (!entry.dependency || !entry.dewPoint) reasons.push('cooling_dew_point_missing_or_changed');
	if (!entry.surface || entry.dependency?.purpose !== 'cooled_surface')
		reasons.push('cooling_local_surface_missing_or_changed');
	if (!dew || !surface || dew.quality !== 'good' || surface.quality !== 'good' || !evidenceCurrent)
		reasons.push('cooling_lineage_quality_or_age');
	if (!qualification || qualification.providerProfile !== REMOTE_DEW_POINT_PROFILE)
		reasons.push('cooling_remote_profile_installation_unqualified');
	else if (
		qualification.protectionFingerprint !== entry.basis ||
		qualification.remoteLineageFingerprint !== entry.dependency?.dewPointFingerprint ||
		qualification.localSurfaceFingerprint !== entry.surface?.fingerprint
	)
		reasons.push('cooling_artifact_or_protection_mismatch');
	return reasons;
}

export interface ThermostatCoolingResponseRows {
	readonly config: VirtualThermostatConfigEntity;
	readonly claims: readonly VirtualThermostatActuatorClaimEntity[];
	readonly dependencies: readonly ThermostatCoolingDependencyEntity[];
	readonly properties: readonly ChannelPropertyEntity[];
	readonly dewConfigurations: readonly VirtualDewPointConfigEntity[];
	readonly dewSources: readonly VirtualDewPointSourceEntity[];
	readonly protectionLineages: readonly ThermostatProtectionLineageRows[];
}
/** Complete same-manager A rows only. This never loads/installs runtime latches or looks up latest B. */
export function thermostatCoolingResponseBindings(rows: ThermostatCoolingResponseRows): readonly CoolingBinding[] {
	const result: CoolingBinding[] = [];
	for (const claim of rows.claims.filter((candidate) => candidate.role === 'cooling')) {
		const dependency = rows.dependencies.find((candidate) => candidate.claimId === claim.id) ?? null;
		if (!rows.config.policy.cooling && !dependency) continue;
		let dewPoint: ChannelPropertyEntity | null = null,
			surface: ThermostatProtectionSource | null = null;
		try {
			if (dependency?.dewPointPropertyId) {
				const dew = rows.dewConfigurations.find(
					(candidate) => candidate.outputPropertyId === dependency.dewPointPropertyId,
				);
				const sources = rows.dewSources.filter(
					(candidate) => candidate.outputPropertyId === dependency.dewPointPropertyId,
				);
				if (
					dew &&
					dependency.dewPointFingerprint ===
						thermostatFingerprint({ dew, sources: [...sources].sort((a, b) => a.role.localeCompare(b.role)) })
				)
					dewPoint = rows.properties.find((candidate) => candidate.id === dew.outputPropertyId) ?? null;
			}
			if (dependency?.surfacePropertyId) {
				const lineage = rows.protectionLineages.find(
					(candidate) => candidate.property?.id === dependency.surfacePropertyId,
				);
				if (lineage) surface = validateThermostatProtectionRows(lineage, claim.physicalIdentity);
			}
			if (surface?.fingerprint !== dependency?.surfaceFingerprint) surface = null;
		} catch {
			surface = null;
		}
		result.push({
			claimId: claim.id,
			controllerRevision: rows.config.revision,
			claim,
			opposed: rows.claims.some((candidate) => candidate.role === 'heating'),
			dependency,
			dewPoint,
			surface,
			policy: rows.config.policy.cooling,
			basis: thermostatFingerprint({
				dependency,
				policy: rows.config.policy.cooling,
				revision: rows.config.revision,
				claim: claim.revision,
				generation: claim.qualificationGeneration,
				dew: !!dewPoint,
				surface: surface?.fingerprint,
			}),
		});
	}
	return Object.freeze(result);
}
