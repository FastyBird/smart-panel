import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import {
	HomeCurrentStateAggregateStatus,
	HomeCurrentStateOperation,
	HomeCurrentStatePartialReason,
	HomeCurrentStateProfile,
} from '../home-context.constants';

import { HomeCurrentStatePredicate, HomeCurrentStateScalar } from './home-current-state-query.model';

export type HomeCurrentStateValueSource = 'cache' | 'storage';
export type HomeCurrentStateStorageStatus = 'not_needed' | 'available' | 'disconnected' | 'failed' | 'timed_out';

export interface HomeCurrentStateRow {
	property_id: string;
	property_name: string | null;
	property_category: PropertyCategory;
	data_type: DataTypeType;
	unit: string | null;
	value: HomeCurrentStateScalar;
	value_observed_at: string;
	freshness: 'known_timestamp';
	source: HomeCurrentStateValueSource;
	device: {
		id: string;
		name: string;
		enabled: boolean;
		room_id: string | null;
	};
	channel: {
		id: string;
		name: string;
		category: ChannelCategory;
	};
}

export interface HomeCurrentStateResultBase {
	profile: HomeCurrentStateProfile;
	operation: HomeCurrentStateOperation;
	predicate: HomeCurrentStatePredicate | null;
	space_id: string | null;
	rows: HomeCurrentStateRow[];
	observed_at: string;
	eligible: number;
	scanned: number;
	evaluated: number;
	unknown: number;
	matched: number;
	returned: number;
	complete: boolean;
	partial: boolean;
	partial_reasons: HomeCurrentStatePartialReason[];
	truncated: boolean;
	storage_status: HomeCurrentStateStorageStatus;
	cache_count: number;
	storage_count: number;
	missing_count: number;
	unprocessed_count: number;
	oldest_last_updated: string | null;
	newest_last_updated: string | null;
	freshness_unknown_count: number;
}

export interface HomeCurrentStateRowsResult extends HomeCurrentStateResultBase {
	operation: 'rows';
	match_count: number | null;
}

export interface HomeCurrentStateBooleanResult extends HomeCurrentStateResultBase {
	operation: 'any' | 'all';
	value: boolean | null;
	definitive: boolean;
	status: HomeCurrentStateAggregateStatus;
}

export interface HomeCurrentStateCountResult extends HomeCurrentStateResultBase {
	operation: 'count_matches';
	value: number | null;
	definitive: boolean;
	status: HomeCurrentStateAggregateStatus;
}

export type HomeCurrentStateResult =
	| HomeCurrentStateRowsResult
	| HomeCurrentStateBooleanResult
	| HomeCurrentStateCountResult;
