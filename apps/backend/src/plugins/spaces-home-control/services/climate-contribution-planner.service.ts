import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DeviceContributionRegistryService,
	MeasurementContributionCoverage,
} from '../../../modules/devices/services/device-contribution.registry.service';
import { ClimateContributionModel } from '../models/climate-contribution.model';

export interface ClimateContributionPlan {
	/** Read after asynchronous room-state work; coverage and producer freshness are checked again. */
	read: () => { temperature: number | null; diagnostics: ClimateContributionModel };
}

/** Select representatives before reading values. Unavailable composites still own their intended leaves. */
@Injectable()
export class ClimateContributionPlannerService {
	constructor(private readonly registry: DeviceContributionRegistryService) {}

	async plan(properties: readonly ChannelPropertyEntity[]): Promise<ClimateContributionPlan> {
		const candidates = [...new Map(properties.map((property) => [property.id, property])).values()];
		const coverage = new Map<string, MeasurementContributionCoverage>();
		for (const property of candidates) {
			const entry = await this.registry.getMeasurementCoverage(property);
			if (entry) coverage.set(property.id, entry);
		}
		// A transform is a representative too, but an aggregate consuming it supersedes that transform.
		const selected = candidates.filter(
			(property) =>
				![...coverage].some(
					([id, entry]) =>
						id !== property.id &&
						(entry.representedProperties.includes(property.id) ||
							(!coverage.has(property.id) && entry.leaves.includes(property.id))),
				),
		);
		const excludedPropertyIds = candidates
			.filter((property) => !selected.includes(property))
			.map((property) => property.id);
		const owners = new Map<string, Set<string>>();
		const internallyDuplicated = new Set<string>();
		for (const property of selected) {
			const entry = coverage.get(property.id);
			for (const leaf of entry?.leaves ?? [property.id]) {
				if (!owners.has(leaf)) owners.set(leaf, new Set());
				owners.get(leaf).add(property.id);
			}
			for (const leaf of entry?.duplicateLeaves ?? []) internallyDuplicated.add(leaf);
		}
		const conflicts = [...owners]
			.filter(([leaf, ids]) => ids.size > 1 || internallyDuplicated.has(leaf))
			.map(([leafPropertyId, ids]) => ({ leafPropertyId, representativePropertyIds: [...ids].sort() }));
		return {
			read: () => {
				let stale =
					candidates.some((property) => property.type === 'virtual' && !coverage.has(property.id)) ||
					[...coverage.values()].some((entry) => !entry.isCurrent());
				const unavailablePropertyIds: string[] = [];
				const values: number[] = [];
				for (const property of selected) {
					const entry = coverage.get(property.id);
					const value = entry ? entry.readValue() : this.physicalValue(property);
					if (value === null || !Number.isFinite(value)) unavailablePropertyIds.push(property.id);
					else values.push(value);
				}
				// Reading a producer can synchronously emit expiry/invalidation events. Recheck before publishing diagnostics.
				stale ||= [...coverage.values()].some((entry) => !entry.isCurrent());
				return {
					temperature:
						!stale && !conflicts.length && values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
					diagnostics: {
						status: stale ? 'coverage_stale' : conflicts.length ? 'coverage_conflict' : 'ok',
						selectedPropertyIds: selected.map((property) => property.id),
						excludedPropertyIds,
						unavailablePropertyIds,
						conflicts,
					},
				};
			},
		};
	}

	private physicalValue(property: ChannelPropertyEntity): number | null {
		if (property.type === 'virtual') return null;
		const state = property.value;
		if (state?.producer?.quality === 'unavailable') return null;
		if (state?.producer) {
			const expires = Date.parse(state.producer.expiresAt ?? '');
			if (!Number.isFinite(expires) || expires <= Date.now()) return null;
		}
		const value = state?.value;
		const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
		return Number.isFinite(numeric) ? numeric : null;
	}
}
