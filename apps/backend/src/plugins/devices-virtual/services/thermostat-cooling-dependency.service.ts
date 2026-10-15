import { REMOTE_DEW_POINT_PROFILE } from '../../devices-shelly-ng/services/remote-dew-point-lease.contract';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { DataSource, EntityManager } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ThermostatCoolingDependencyDto } from '../dto/thermostat-config.dto';
import { ThermostatCoolingDependencyEntity } from '../entities/thermostat-cooling-dependency.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import { ThermostatProtectionSource, resolveThermostatProtectionSource } from './thermostat-protection-source.utils';
import { VirtualCoolingPolicy, evaluateCoolingProtection } from './virtual-cooling-policy.utils';
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
	): Promise<ThermostatCoolingDependencyEntity> {
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
		const old = await manager.findOneBy(ThermostatCoolingDependencyEntity, { claimId: claim.id });
		if (dto.dewPointPropertyId === undefined || dto.surfacePropertyId === undefined) return fail();
		const row = manager.create(ThermostatCoolingDependencyEntity, {
			...old,
			claimId: claim.id,
			schemaVersion: 1,
			purpose: 'cooled_surface',
			revision: (old?.revision ?? 0) + 1,
			maximumAgeSeconds: dto.maximumAgeSeconds,
		});
		if (dto.dewPointPropertyId === null) {
			if (!old || old.dewPointPropertyId !== null) return fail();
		} else {
			const dew = await manager.findOneBy(VirtualDewPointConfigEntity, { outputPropertyId: dto.dewPointPropertyId });
			if (!dew) return fail();
			const sources = await manager.findBy(VirtualDewPointSourceEntity, { outputPropertyId: dew.outputPropertyId });
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
			const surface = await resolveThermostatProtectionSource(manager, dto.surfacePropertyId, claim.physicalIdentity);
			row.surfacePropertyId = surface.property.id;
			row.surfaceIdentity = surface.property.id;
			row.physicalSurfaceIdentity = surface.leaf.id;
			row.surfaceFingerprint = surface.fingerprint;
		}
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
				claim, opposed: claims.some((c) => c.role === 'heating'),
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
	capture(entry: CoolingBinding, now = Date.now()): { threshold: number; expiresAt: number; controllerRevision: number; protectionFingerprint: string; isCurrent: () => boolean } | null {
		const diagnostic = this.read([entry], now)[0];
		if (!diagnostic?.ready || diagnostic.threshold === null || !diagnostic.expires_at || !entry.dewPoint || !entry.surface) return null;
		const dew = this.values.captureIncorporatedSample(entry.dewPoint), surface = this.values.captureIncorporatedSample(entry.surface.property);
		if (!dew || !surface) return null;
		const expiry = Date.parse(diagnostic.expires_at);
		return Object.freeze({ threshold: diagnostic.threshold, expiresAt: expiry, controllerRevision: entry.controllerRevision, protectionFingerprint: entry.basis,
			isCurrent: () => Date.now() < expiry && this.values.incorporatedEvidenceCurrent([dew, surface]) &&
				this.read([entry], Date.now())[0]?.ready === true });
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
			const reasons: string[] = [];
			const fresh = (e: typeof dewEvidence): boolean =>
				!!e && (e.producer ? !!e.sources?.length && e.sources.every(fresh) : e.acceptanceGeneration > state.barrier);
			if (!entry.dependency || !entry.dewPoint) reasons.push('cooling_dew_point_missing_or_changed');
			if (!entry.surface || entry.dependency?.purpose !== 'cooled_surface')
				reasons.push('cooling_local_surface_missing_or_changed');
			if (
				!dew ||
				!surface ||
				dew.quality !== 'good' ||
				surface.quality !== 'good' ||
				!dewEvidence ||
				!surfaceEvidence ||
				!this.values.incorporatedEvidenceCurrent([dewEvidence, surfaceEvidence])
			)
				reasons.push('cooling_lineage_quality_or_age');
			if (!fresh(dewEvidence) || !fresh(surfaceEvidence)) reasons.push('cooling_fresh_report_required');
			const result = evaluateCoolingProtection(
				entry.policy,
				reasons.length ? null : (dew.value as number),
				reasons.length ? null : (surface.value as number),
				state.latched,
			);
			if (result.latched && !state.latched) state.releaseAfter = now;
			if (entry.surface && result.threshold !== null &&
				result.threshold + entry.policy.recoveryHysteresisC >= entry.surface.domain.maximum) reasons.push('cooling_recovery_outside_surface_domain');
			state.latched = result.latched;
			if (reasons.length) {
				state.latched = true;
				state.releaseAfter ??= now;
				if (!state.gap) state.barrier = this.values.currentSampleGeneration();
			}
			state.gap = reasons.length > 0;
			if (state.releaseAfter !== null) reasons.push('cooling_pending_release');
			// Only the separately registered, current installed remote profile can clear this gate.
			// Public flags, legacy heating bytes, adapter registration and ACKs do not supply it.
			const qualification = this.claims?.qualification(entry.claim, entry.opposed);
			const remote = qualification?.providerProfile?.id === REMOTE_DEW_POINT_PROFILE ? qualification.profile.remoteDewPoint : null;
			if (!remote) reasons.push('cooling_remote_profile_installation_unqualified');
			else if (remote.artifact.binding.protectionFingerprint !== entry.basis ||
				remote.artifact.binding.remoteLineageFingerprint !== entry.dependency?.dewPointFingerprint ||
				remote.artifact.binding.localSurface.calibrationFingerprint !== entry.surface?.fingerprint)
				reasons.push('cooling_artifact_or_protection_mismatch');

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
