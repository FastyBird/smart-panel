export type BuddyContextDomain = 'general' | 'home' | 'weather' | 'energy' | 'security' | 'history';

export type BuddyContextIntent = 'none' | 'read' | 'write' | 'trigger' | 'mixed';

export type BuddyContextAmbiguityRisk = 'none' | 'read' | 'action';

export type BuddyContextStrategy = 'no-home-context' | 'model-tools' | 'prefetch' | 'deterministic-action' | 'clarify';

export type BuddyToolCallingCapability = 'reliable' | 'limited' | 'unsupported';

export type BuddyContextActionType =
	| 'activate'
	| 'adjust'
	| 'change'
	| 'close'
	| 'deactivate'
	| 'dim'
	| 'lock'
	| 'make'
	| 'open'
	| 'run'
	| 'set'
	| 'start'
	| 'stop'
	| 'switch'
	| 'trigger'
	| 'turn'
	| 'unlock';

export type BuddyContextQueryKind =
	| 'search-home'
	| 'current-state'
	| 'weather'
	| 'energy-summary'
	| 'security-status'
	| 'property-timeseries';

export interface BuddyContextProviderCapabilities {
	toolCalling: BuddyToolCallingCapability;
	supportsStructuredToolResults: boolean;
}

export interface BuddyContextEntityReference {
	kind: 'device' | 'space' | 'scene' | 'property';
	id: string;
	name: string;
	compatibleActionTypes: readonly BuddyContextActionType[];
}

export interface BuddyContextSpaceReference {
	id: string;
	name: string;
}

export interface BuddyContextPlannerInput {
	message: string;
	conversationSpaceId?: string | null;
	knownSpaces?: readonly BuddyContextSpaceReference[];
	recentEntityReferences?: readonly BuddyContextEntityReference[];
	providerCapabilities: BuddyContextProviderCapabilities;
}

export interface BuddyContextScope {
	spaceId?: string;
	spaceIds?: string[];
	referencedEntityIds?: string[];
}

export interface BuddyContextQueryPlan {
	kind: BuddyContextQueryKind;
	spaceId?: string;
}

export interface BuddyContextPlan {
	domains: BuddyContextDomain[];
	intent: BuddyContextIntent;
	scope: BuddyContextScope;
	queries: BuddyContextQueryPlan[];
	toolNames: string[];
	ambiguityRisk: BuddyContextAmbiguityRisk;
	strategy: BuddyContextStrategy;
}
