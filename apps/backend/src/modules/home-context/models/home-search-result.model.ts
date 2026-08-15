import { HomeSearchEntityKind, HomeSearchMatchReason } from '../home-context.constants';

export interface HomeEntitySearchResultBase {
	kind: HomeSearchEntityKind;
	id: string;
	name: string;
	score: number;
	reasons: HomeSearchMatchReason[];
}

export interface HomeSpaceSearchResult extends HomeEntitySearchResultBase {
	kind: 'space';
	type: string;
	category: string | null;
	parent_id: string | null;
}

export interface HomeDeviceSearchResult extends HomeEntitySearchResultBase {
	kind: 'device';
	identifier: string | null;
	category: string;
	enabled: boolean;
	room_id: string | null;
}

export interface HomePropertySearchResult extends HomeEntitySearchResultBase {
	kind: 'property';
	property_name: string | null;
	identifier: string | null;
	category: string;
	data_type: string;
	permissions: string[];
	device: {
		id: string;
		name: string;
		enabled: boolean;
	};
	channel: {
		id: string;
		name: string;
		category: string;
	};
}

export interface HomeSceneSearchResult extends HomeEntitySearchResultBase {
	kind: 'scene';
	category: string;
	enabled: boolean;
	triggerable: boolean;
	primary_space_id: string | null;
}

export type HomeEntitySearchResult =
	| HomeSpaceSearchResult
	| HomeDeviceSearchResult
	| HomePropertySearchResult
	| HomeSceneSearchResult;

export interface HomeEntitySearchTotalsByKind {
	space: number;
	device: number;
	property: number;
	scene: number;
}

export interface HomeEntitySearchResponse {
	query: string;
	entities: HomeEntitySearchResult[];
	observed_at: string;
	total: number;
	returned: number;
	totals_by_kind: HomeEntitySearchTotalsByKind;
	partial: false;
	truncated: boolean;
	refine_required: boolean;
}
