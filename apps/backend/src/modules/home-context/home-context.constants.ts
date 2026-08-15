export const HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY = 'mcp-compatibility' as const;

export type HomeContextProfile = typeof HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY;

export interface HomeContextLimitProfile {
	spaces: number;
	devices: number;
	scenes: number;
	forecastDays: number;
	securityAlerts: number;
	securityDevices: number;
	securityChannelsPerDevice: number;
	securityPropertiesPerChannel: number;
	channelsPerDevice: number;
	propertiesPerChannel: number;
	timeseriesRangeDays: number;
	timeseriesPoints: number;
	energyRangeDays: number;
	writableProperties: number;
	writablePropertyCandidates: number;
	triggerScenes: number;
	triggerSpaces: number;
}

export const HOME_CONTEXT_LIMIT_PROFILES: Readonly<Record<HomeContextProfile, Readonly<HomeContextLimitProfile>>> =
	Object.freeze({
		[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY]: Object.freeze({
			spaces: 50,
			devices: 100,
			scenes: 50,
			forecastDays: 5,
			securityAlerts: 20,
			securityDevices: 100,
			securityChannelsPerDevice: 10,
			securityPropertiesPerChannel: 20,
			channelsPerDevice: 20,
			propertiesPerChannel: 40,
			timeseriesRangeDays: 14,
			timeseriesPoints: 500,
			energyRangeDays: 31,
			writableProperties: 100,
			writablePropertyCandidates: 500,
			triggerScenes: 50,
			triggerSpaces: 50,
		}),
	});

export const HOME_TARGET_LIGHTING_MODES = ['off', 'on', 'work', 'relax', 'night'] as const;

export type HomeTargetLightingMode = (typeof HOME_TARGET_LIGHTING_MODES)[number];

export const HOME_SEARCH_PROFILE_BUDDY_V1 = 'buddy-search-v1' as const;

export type HomeSearchProfile = typeof HOME_SEARCH_PROFILE_BUDDY_V1;

export interface HomeSearchLimitProfile {
	defaultResults: number;
	maxResults: number;
	maxCandidatesPerKind: number;
	maxQueryCharacters: number;
	maxQueryTokens: number;
	maxKinds: number;
	maxCategories: number;
}

export const HOME_SEARCH_LIMIT_PROFILES: Readonly<Record<HomeSearchProfile, Readonly<HomeSearchLimitProfile>>> =
	Object.freeze({
		[HOME_SEARCH_PROFILE_BUDDY_V1]: Object.freeze({
			defaultResults: 10,
			maxResults: 20,
			maxCandidatesPerKind: 21,
			maxQueryCharacters: 128,
			maxQueryTokens: 8,
			maxKinds: 4,
			maxCategories: 16,
		}),
	});

export const HOME_SEARCH_ENTITY_KINDS = ['space', 'device', 'property', 'scene'] as const;

export type HomeSearchEntityKind = (typeof HOME_SEARCH_ENTITY_KINDS)[number];

export const HOME_SEARCH_MATCH_REASONS = [
	'exact_id',
	'exact_name',
	'name_prefix',
	'lexical_match',
	'space_filter',
	'category_filter',
] as const;

export type HomeSearchMatchReason = (typeof HOME_SEARCH_MATCH_REASONS)[number];
