import {
	BuddyContextDomain,
	BuddyContextEntityReference,
	BuddyContextQueryPlan,
	BuddyContextScope,
} from '../../models/context-plan.model';

import { buildBuddyContextQueries } from './buddy-context-query-builder';

export interface BuddyContextRetrievalPlannerInput {
	domains: readonly BuddyContextDomain[];
	hasAction: boolean;
	requiresReadForAction: boolean;
	includeCurrentStateForRead: boolean;
	hasActionScopedStateRequirement: boolean;
	hasUnscopedCurrentStateReadClause: boolean;
	hasWholeHomeRead: boolean;
	isGenericExplanation: boolean;
	hasExcessiveExplicitSpaceScope: boolean;
	hasExcessiveReferenceScope: boolean;
	conversationSpaceId?: string;
	querySpaceIds: readonly string[];
	energySpaceIds: readonly (string | undefined)[];
	historySpaceIds: readonly (string | undefined)[];
	resolvedCurrentStateSpaceIds?: readonly (string | undefined)[];
	resolvedIndependentCurrentStateSpaceIds: readonly (string | undefined)[];
	actionScopeIds: readonly string[];
	scopedReferences: readonly BuddyContextEntityReference[];
	includeConversationCurrentState: boolean;
	useIndependentCurrentStateScopes: boolean;
}

export interface BuddyContextRetrievalPlan {
	scope: BuddyContextScope;
	queries: BuddyContextQueryPlan[];
	hasCurrentStateQuery: boolean;
	searchSpaceIds: readonly (string | undefined)[];
	currentStateSpaceIds: readonly (string | undefined)[];
}

export function planBuddyContextRetrieval(input: BuddyContextRetrievalPlannerInput): BuddyContextRetrievalPlan {
	const currentStateSpaceIds = resolveCurrentStateSpaceIds(input);
	const shouldIncludeCurrentStateForRead =
		input.includeCurrentStateForRead && input.resolvedCurrentStateSpaceIds !== undefined;
	const hasCurrentStateQuery = (!input.hasAction && shouldIncludeCurrentStateForRead) || input.requiresReadForAction;
	const homeRetrievalSpaceIds = unique([
		...(hasCurrentStateQuery ? currentStateSpaceIds : []),
		...(input.domains.includes('history') ? input.historySpaceIds : []),
	]);
	const actionSearchSpaceIds: Array<string | undefined> = input.hasAction
		? input.scopedReferences.length > 0
			? []
			: input.actionScopeIds.length > 0
				? [...input.actionScopeIds]
				: [undefined]
		: [];
	const scopedSearchSpaceIds = input.hasAction
		? [...actionSearchSpaceIds, ...homeRetrievalSpaceIds.filter((spaceId) => !actionSearchSpaceIds.includes(spaceId))]
		: hasCurrentStateQuery || input.domains.includes('history')
			? [
					...input.querySpaceIds.filter((spaceId) => homeRetrievalSpaceIds.includes(spaceId)),
					...homeRetrievalSpaceIds.filter((spaceId) => !input.querySpaceIds.includes(spaceId)),
				]
			: [...input.querySpaceIds];
	const searchSpaceIds = unique([
		...(input.hasAction && input.actionScopeIds.length > 0 && input.hasWholeHomeRead ? [undefined] : []),
		...(input.hasAction ? input.scopedReferences.map((reference) => reference.spaceId ?? undefined) : []),
		...scopedSearchSpaceIds,
	]);
	const resolvedReadScopeIds = unique(
		[...input.querySpaceIds, ...searchSpaceIds, ...input.energySpaceIds, ...input.historySpaceIds].filter(
			(spaceId): spaceId is string => spaceId !== undefined,
		),
	);
	const aggregateScopeSpaceIds = input.isGenericExplanation
		? []
		: unique(
				input.hasAction
					? input.actionScopeIds.length > 0
						? input.actionScopeIds
						: input.scopedReferences.length > 0
							? []
							: input.conversationSpaceId
								? [input.conversationSpaceId]
								: []
					: resolvedReadScopeIds,
			);
	const scope: BuddyContextScope = {
		...(aggregateScopeSpaceIds.length === 1
			? { spaceId: aggregateScopeSpaceIds[0] }
			: aggregateScopeSpaceIds.length > 1
				? { spaceIds: aggregateScopeSpaceIds }
				: {}),
		...(input.scopedReferences.length > 0
			? { referencedEntityIds: input.scopedReferences.map((reference) => reference.id) }
			: {}),
	};
	const queries =
		input.hasExcessiveExplicitSpaceScope || input.hasExcessiveReferenceScope
			? []
			: buildBuddyContextQueries({
					domains: input.domains,
					hasAction: input.hasAction,
					requiresReadForAction: input.requiresReadForAction,
					searchSpaceIds,
					includeCurrentStateForRead: shouldIncludeCurrentStateForRead,
					energySpaceIds: input.energySpaceIds,
					currentStateSpaceIds,
					historySpaceIds: input.historySpaceIds,
				});

	return { scope, queries, hasCurrentStateQuery, searchSpaceIds, currentStateSpaceIds };
}

function resolveCurrentStateSpaceIds(input: BuddyContextRetrievalPlannerInput): readonly (string | undefined)[] {
	if (input.useIndependentCurrentStateScopes) return input.resolvedIndependentCurrentStateSpaceIds;

	if (input.hasAction && input.resolvedIndependentCurrentStateSpaceIds.length > 0) {
		return [
			...input.resolvedIndependentCurrentStateSpaceIds,
			...(input.hasActionScopedStateRequirement
				? input.actionScopeIds.filter((spaceId) => !input.resolvedIndependentCurrentStateSpaceIds.includes(spaceId))
				: []),
		];
	}

	if (input.hasUnscopedCurrentStateReadClause) {
		return unique([
			...(input.resolvedCurrentStateSpaceIds ?? []),
			...(input.includeConversationCurrentState && input.conversationSpaceId ? [input.conversationSpaceId] : []),
			undefined,
		]);
	}

	return (
		input.resolvedCurrentStateSpaceIds ??
		(input.hasActionScopedStateRequirement
			? input.actionScopeIds.length > 0
				? input.actionScopeIds
				: input.querySpaceIds
			: [])
	);
}

function unique<T>(values: readonly T[]): T[] {
	return values.filter((value, index) => values.indexOf(value) === index);
}
