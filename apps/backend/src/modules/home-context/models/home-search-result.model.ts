import { HomeSearchCandidateCapability, HomeSearchEntityKind, HomeSearchMatchReason } from '../home-context.constants';

export interface HomeEntitySearchResultBase {
	kind: HomeSearchEntityKind;
	id: string;
	name: string;
	score: number;
	reasons: HomeSearchMatchReason[];
	candidate_capabilities: HomeSearchCandidateCapability[];
}

export interface HomeSpaceSearchResult extends HomeEntitySearchResultBase {
	kind: 'space';
	candidate_capabilities: [];
	type: string;
	category: string | null;
	parent_id: string | null;
}

export interface HomeDeviceSearchResult extends HomeEntitySearchResultBase {
	kind: 'device';
	candidate_capabilities: [];
	identifier: string | null;
	category: string;
	enabled: boolean;
	room_id: string | null;
}

export interface HomePropertySearchResult extends HomeEntitySearchResultBase {
	kind: 'property';
	candidate_capabilities: Array<'read' | 'write'>;
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
	candidate_capabilities: Array<'trigger'>;
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
	candidate_capability_filter?: HomeSearchCandidateCapability;
	/** Best-effort continuation for the current bounded candidate window, not an authorization artifact. */
	next_cursor?: string;
}
