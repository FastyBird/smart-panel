import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { BoundedPropertyValueItem, PropertyValueService } from '../../devices/services/property-value.service';
import { resolvePropertyUnit } from '../../devices/utils/property-metadata.utils';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, isFloorZoneCategory } from '../../spaces/spaces.constants';
import {
	HOME_CURRENT_STATE_LIMIT_PROFILES,
	HomeCurrentStateAggregateStatus,
	HomeCurrentStatePartialReason,
} from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { HomeCurrentStateCandidateMetadataError } from '../home-current-state.errors';
import {
	HomeCurrentStatePredicate,
	HomeCurrentStateQuery,
	HomeCurrentStateScalar,
} from '../models/home-current-state-query.model';
import {
	HomeCurrentStateResult,
	HomeCurrentStateResultBase,
	HomeCurrentStateRow,
} from '../models/home-current-state-result.model';
import { homeCurrentStateQuerySchema } from '../schemas/home-current-state-input.schemas';
import { homeCurrentStateResultSchema } from '../schemas/home-current-state-output.schemas';

type PredicateEvaluation = boolean | 'type_mismatch' | 'unit_mismatch';

@Injectable()
export class HomeCurrentStateQueryService {
	constructor(
		private readonly spacesService: SpacesService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly propertyValueService: PropertyValueService,
	) {}

	async queryCurrentState(query: HomeCurrentStateQuery): Promise<HomeCurrentStateResult> {
		const input = homeCurrentStateQuerySchema.parse(query) as HomeCurrentStateQuery;
		const limits = HOME_CURRENT_STATE_LIMIT_PROFILES[input.profile];
		const selectedSpace = input.spaceId ? await this.spacesService.findOne(input.spaceId) : null;

		if (input.spaceId && !selectedSpace) {
			throw new HomeContextSpaceNotFoundError(input.spaceId);
		}

		const stateScope = selectedSpace ? this.resolveStateScope(selectedSpace) : {};
		const candidates = await this.propertiesService.findVisibleReadableStateCandidates({
			limit: limits.maxCandidates,
			offset: 0,
			scope: stateScope.scope,
			roomParentId: stateScope.roomParentId,
			channelCategories: input.channelCategories,
			propertyCategories: input.propertyCategories,
			dataTypes: input.dataTypes,
		});
		const read = await this.propertyValueService.readLatestManyBounded(candidates.properties);
		const itemByPropertyId = new Map(read.items.map((item) => [item.propertyId, item]));
		const partialReasons = new Set<HomeCurrentStatePartialReason>();

		if (candidates.total > candidates.properties.length) {
			partialReasons.add('scan_limit');
		}
		if (read.missingCount > 0) {
			partialReasons.add('missing_values');
		}
		if (read.unprocessedCount > 0) {
			partialReasons.add('unprocessed_values');
		}

		const matchedRows: HomeCurrentStateRow[] = [];
		const counterexampleRows: HomeCurrentStateRow[] = [];
		let evaluated = 0;
		let matched = 0;
		let freshnessUnknownCount = 0;

		for (const property of candidates.properties) {
			const item = itemByPropertyId.get(property.id);

			if (!item || item.status !== 'available') {
				continue;
			}

			const observedAt = item.state.lastUpdated;

			const observedTime = observedAt === null ? Number.NaN : Date.parse(observedAt);

			if (!Number.isFinite(observedTime)) {
				partialReasons.add('unknown_freshness');
				freshnessUnknownCount += 1;
				continue;
			}
			const normalizedObservedAt = new Date(observedTime).toISOString();

			const predicateResult = input.predicate
				? this.evaluatePredicate(item.state.value, resolvePropertyUnit(property), input.predicate)
				: true;

			if (predicateResult === 'type_mismatch') {
				partialReasons.add('type_mismatch');
				continue;
			}
			if (predicateResult === 'unit_mismatch') {
				partialReasons.add('unit_mismatch');
				continue;
			}

			evaluated += 1;

			if (!predicateResult) {
				counterexampleRows.push(this.mapRow(property, item, normalizedObservedAt));
				continue;
			}

			matched += 1;
			matchedRows.push(this.mapRow(property, item, normalizedObservedAt));
		}

		const eligible = candidates.total;
		const unknown = Math.max(eligible - evaluated, 0);
		const complete = unknown === 0;

		if (!complete && partialReasons.size === 0) {
			partialReasons.add('unprocessed_values');
		}

		const rowLimit = input.limit ?? limits.defaultRows;
		const evidenceRows = input.operation === 'all' ? counterexampleRows : matchedRows;
		const rows = evidenceRows.slice(0, rowLimit);
		const base: HomeCurrentStateResultBase = {
			profile: input.profile,
			operation: input.operation,
			predicate: input.predicate ?? null,
			space_id: selectedSpace?.id ?? null,
			rows,
			observed_at: new Date().toISOString(),
			eligible,
			scanned: candidates.properties.length,
			evaluated,
			unknown,
			matched,
			returned: rows.length,
			complete,
			partial: !complete,
			partial_reasons: [...partialReasons],
			truncated: evidenceRows.length > rows.length,
			storage_status: read.storageStatus,
			cache_count: read.cacheCount,
			storage_count: read.storageCount,
			missing_count: read.missingCount,
			unprocessed_count: read.unprocessedCount,
			oldest_last_updated: this.normalizeTimestamp(read.oldestLastUpdated),
			newest_last_updated: this.normalizeTimestamp(read.newestLastUpdated),
			freshness_unknown_count: freshnessUnknownCount,
		};
		const result = this.buildResult(base, evaluated, matched);

		homeCurrentStateResultSchema.parse(result);

		return result;
	}

	private evaluatePredicate(
		value: HomeCurrentStateScalar,
		unit: string | null,
		predicate: HomeCurrentStatePredicate,
	): PredicateEvaluation {
		if (typeof value === 'number' && !Number.isFinite(value)) {
			return 'type_mismatch';
		}
		if (typeof value !== typeof predicate.value) {
			return 'type_mismatch';
		}
		if (typeof predicate.value === 'number' && 'unit' in predicate && unit !== predicate.unit) {
			return 'unit_mismatch';
		}

		switch (predicate.operator) {
			case 'eq':
				return value === predicate.value;
			case 'ne':
				return value !== predicate.value;
			case 'gt':
			case 'gte':
			case 'lt':
			case 'lte':
				if (typeof value !== 'number' || !Number.isFinite(value)) {
					return 'type_mismatch';
				}
				return predicate.operator === 'gt'
					? value > predicate.value
					: predicate.operator === 'gte'
						? value >= predicate.value
						: predicate.operator === 'lt'
							? value < predicate.value
							: value <= predicate.value;
		}
	}

	private resolveStateScope(space: { id: string; type: SpaceType; category?: string | null }): {
		scope?: { roomIds?: string[]; zoneId?: string };
		roomParentId?: string;
	} {
		if (space.type === SpaceType.MASTER) {
			return {};
		}
		if (space.type === SpaceType.ROOM) {
			return { scope: { roomIds: [space.id] } };
		}
		if (space.type === SpaceType.ENTRY || space.type !== SpaceType.ZONE) {
			return { scope: { roomIds: [] } };
		}
		if (isFloorZoneCategory(space.category ?? null)) {
			return { roomParentId: space.id };
		}

		return { scope: { zoneId: space.id } };
	}

	private normalizeTimestamp(value: string | null): string | null {
		const timestamp = value === null ? Number.NaN : Date.parse(value);

		return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
	}

	private mapRow(
		property: ChannelPropertyEntity,
		item: Extract<BoundedPropertyValueItem, { status: 'available' }>,
		observedAt: string,
	): HomeCurrentStateRow {
		const channel = typeof property.channel === 'string' ? null : property.channel;
		const device = channel && typeof channel.device === 'string' ? null : channel?.device;

		if (!channel || !device) {
			throw new HomeCurrentStateCandidateMetadataError(property.id);
		}

		const typedDevice = device as DeviceEntity;

		return {
			property_id: property.id,
			property_name: property.name,
			property_category: property.category,
			data_type: property.dataType,
			unit: resolvePropertyUnit(property),
			value: item.state.value,
			value_observed_at: observedAt,
			freshness: 'known_timestamp',
			source: item.source,
			device: {
				id: typedDevice.id,
				name: typedDevice.name,
				enabled: typedDevice.enabled,
				room_id: typedDevice.roomId,
			},
			channel: {
				id: channel.id,
				name: channel.name,
				category: channel.category,
			},
		};
	}

	private buildResult(base: HomeCurrentStateResultBase, evaluated: number, matched: number): HomeCurrentStateResult {
		if (base.operation === 'rows') {
			return { ...base, operation: 'rows', match_count: base.complete ? matched : null };
		}

		if (base.eligible === 0) {
			return {
				...base,
				operation: base.operation,
				value: null,
				definitive: false,
				status: 'no_eligible',
			};
		}

		if (base.operation === 'count_matches') {
			return {
				...base,
				operation: 'count_matches',
				value: base.complete ? matched : null,
				definitive: base.complete,
				status: base.complete ? 'complete' : 'indeterminate',
			};
		}

		const counterexamples = evaluated - matched;
		const conclusivePartial =
			(base.operation === 'any' && matched > 0) || (base.operation === 'all' && counterexamples > 0);
		const definitive = base.complete || conclusivePartial;
		const status: HomeCurrentStateAggregateStatus = base.complete
			? 'complete'
			: conclusivePartial
				? 'conclusive_partial'
				: 'indeterminate';
		const value = !definitive ? null : base.operation === 'any' ? matched > 0 : counterexamples === 0;

		return { ...base, operation: base.operation, value, definitive, status };
	}
}
