import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { ThermostatInstallationEntity } from '../entities/thermostat-installation.entity';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import {
	ThermostatProtectionSource,
	protectionBoundsValid,
	resolveThermostatProtectionSource,
} from './thermostat-protection-source.utils';
import { thermostatFingerprint } from './virtual-thermostat-contract.utils';

export interface ThermostatMemberProtectionBinding {
	claimId: string;
	binding: ThermostatMemberProtectionEntity | null;
	source: ThermostatProtectionSource | null;
	cutoff: number | null;
	hysteresis: number | null;
	basis: string;
}
export interface ThermostatMemberProtectionDiagnostic {
	claim: string;
	source_property: string | null;
	source_identity: string | null;
	physical_property: string | null;
	maximum_age_seconds: number | null;
	status: 'fresh' | 'stale' | 'missing' | 'incompatible' | 'unavailable';
	quality: 'good' | 'degraded' | 'unavailable';
	expires_at: string | null;
	temperature: number | null;
	sampled_at: string | null;
	age_seconds: number | null;
	effective_cutoff: number | null;
	latched: boolean;
	ready: boolean;
	reasons: string[];
}
/** Process-local latches deliberately never restore persisted clear authority. Bounded by active claims. */
@Injectable()
export class ThermostatMemberProtectionService {
	private readonly latches = new Map<
		string,
		{ basis: string; latched: boolean; after: number; expires: number; sourceGuard?: () => boolean }
	>();
	private boundary = Date.now();
	private readonly controllerClaims = new Map<string, Set<string>>();
	private readonly dependencies = new Map<string, Set<string>>();
	constructor(
		private readonly dataSource: DataSource,
		private readonly values: PropertyValueService,
	) {}
	reset(): void {
		this.latches.clear();
		this.dependencies.clear();
		this.controllerClaims.clear();
		this.boundary = Date.now();
	}
	invalidateSource(propertyId: string): void {
		for (const claimId of this.dependencies.get(propertyId) ?? []) {
			const state = this.latches.get(claimId);
			if (state) {
				state.latched = true;
				state.after = Date.now();
				state.expires = 0;
			}
		}
	}
	async load(
		config: VirtualThermostatConfigEntity,
		claims: VirtualThermostatActuatorClaimEntity[],
	): Promise<ThermostatMemberProtectionBinding[]> {
		const result: ThermostatMemberProtectionBinding[] = [];
		// Replace this controller's bounded consumer index; released claims cannot retain live latch authority.
		const activeIds = new Set(claims.map((claim) => claim.id));
		const oldIds = this.controllerClaims.get(config.controllerId) ?? new Set<string>();
		for (const id of oldIds) if (!activeIds.has(id)) this.latches.delete(id);
		for (const [property, ids] of this.dependencies) {
			for (const id of oldIds) ids.delete(id);
			if (!ids.size) this.dependencies.delete(property);
		}
		this.controllerClaims.set(config.controllerId, activeIds);
		const heating = claims.filter((claim) => claim.role === 'heating');
		for (const claim of heating) {
			const binding = await this.dataSource.manager.findOneBy(ThermostatMemberProtectionEntity, { claimId: claim.id });
			if (!binding && heating.length === 1) continue; // Exact legacy singleton semantics.
			let source: ThermostatProtectionSource | null = null;
			try {
				if (binding?.sourcePropertyId)
					source = await resolveThermostatProtectionSource(
						this.dataSource.manager,
						binding.sourcePropertyId,
						claim.physicalIdentity,
					);
				if (source?.fingerprint !== binding?.contractFingerprint) source = null;
			} catch {
				source = null;
			}
			for (const id of new Set([binding?.sourcePropertyIdentity, binding?.physicalPropertyIdentity].filter(Boolean))) {
				const consumers = this.dependencies.get(id) ?? new Set<string>();
				consumers.add(claim.id);
				this.dependencies.set(id, consumers);
			}
			const installation =
				binding && (await this.dataSource.manager.findOneBy(ThermostatInstallationEntity, { claimId: claim.id }));
			const ceiling = installation?.setup.formatVersion === 2 ? installation.setup.installedFloorCeilingC : null;
			const cutoff =
				config.policy.floor && Number.isFinite(ceiling) ? Math.min(config.policy.floor.limit, ceiling) : null;
			const hysteresis = config.policy.floor?.recoveryHysteresis ?? null;
			result.push({
				claimId: claim.id,
				binding,
				source,
				cutoff,
				hysteresis,
				basis: thermostatFingerprint({
					binding,
					source: source?.fingerprint,
					cutoff,
					hysteresis,
					config: config.revision,
					claim: claim.revision,
					generation: claim.qualificationGeneration,
					installation: installation?.revision,
				}),
			});
		}
		return result;
	}
	read(bindings: ThermostatMemberProtectionBinding[], now: number): ThermostatMemberProtectionDiagnostic[] {
		return bindings.map((entry) => {
			const { binding, source, cutoff, hysteresis } = entry;
			let state = this.latches.get(entry.claimId);
			if (!state || state.basis !== entry.basis) {
				state = { basis: entry.basis, latched: true, after: Math.max(this.boundary, now), expires: 0 };
				this.latches.set(entry.claimId, state);
			}
			const freshness =
				source && binding
					? this.values.readSampleFreshness?.(source.property, binding.maximumAgeSeconds * 1000, new Date(now))
					: null;
			const sample =
				source?.enabled &&
				binding &&
				this.values.readQualifiedSample(source.property, binding.maximumAgeSeconds * 1000, new Date(now));
			const leaf =
				source?.enabled &&
				binding &&
				this.values.readQualifiedSample(source.leaf, binding.maximumAgeSeconds * 1000, new Date(now));
			const reasons: string[] = [];
			if (!binding) reasons.push('member_protection_required');
			if (!source) reasons.push('member_protection_source_incompatible');
			if (
				!sample ||
				!leaf ||
				sample.quality !== 'good' ||
				leaf.quality !== 'good' ||
				(source?.transform && sample.revision !== source.transform.revision) ||
				typeof sample.value !== 'number' ||
				!Number.isFinite(sample.value) ||
				(source && (sample.value < source.domain.minimum || sample.value > source.domain.maximum))
			)
				reasons.push('member_protection_sample_unavailable');
			if (
				cutoff === null ||
				hysteresis === null ||
				!source ||
				!protectionBoundsValid(source.domain, cutoff, hysteresis)
			)
				reasons.push('member_protection_profile_required');
			if (state.sourceGuard?.() === false) {
				state.latched = true;
				state.after = Math.max(state.after, now);
				state.expires = 0;
				state.sourceGuard = undefined;
			}
			const expired = state.expires > 0 && now >= state.expires;
			// A gap cannot be healed by recomputing an older retained report. Require a post-gap live report.
			if (expired) {
				state.latched = true;
				state.after = Math.max(state.after, state.expires);
				state.expires = 0;
			}
			if (reasons.length) {
				state.latched = true;
				state.after = Math.max(state.after, now);
				state.expires = 0;
			} else {
				state.sourceGuard = this.values.captureSampleSourceGuard(source.leaf);
				const value = sample.value as number;
				const observed = Math.min(sample.receivedAt.getTime(), leaf.receivedAt.getTime());
				if (value >= cutoff) state.latched = true;
				else if (value < cutoff - hysteresis && observed > state.after) state.latched = false;
				state.expires =
					Math.min(
						sample.sampledAt.getTime(),
						leaf.sampledAt.getTime(),
						sample.receivedAt.getTime(),
						leaf.receivedAt.getTime(),
					) +
					binding.maximumAgeSeconds * 1000;
			}
			if (state.latched) reasons.push('member_floor_latched');
			return {
				claim: entry.claimId,
				source_property: binding?.sourcePropertyId ?? null,
				source_identity: binding?.sourcePropertyIdentity ?? null,
				physical_property: binding?.physicalPropertyIdentity ?? null,
				maximum_age_seconds: binding?.maximumAgeSeconds ?? null,
				status: !binding
					? 'missing'
					: !source
						? 'incompatible'
						: freshness?.status === 'stale'
							? 'stale'
							: sample
								? 'fresh'
								: 'unavailable',
				quality: sample?.quality ?? 'unavailable',
				expires_at: freshness?.expires_at ?? null,
				temperature: typeof sample?.value === 'number' ? sample.value : null,
				sampled_at: sample?.sampledAt.toISOString() ?? freshness?.sampled_at ?? null,
				age_seconds: sample ? (now - sample.sampledAt.getTime()) / 1000 : (freshness?.age_seconds ?? null),
				effective_cutoff: cutoff,
				latched: state.latched,
				ready: reasons.length === 0,
				reasons,
			};
		});
	}
}
