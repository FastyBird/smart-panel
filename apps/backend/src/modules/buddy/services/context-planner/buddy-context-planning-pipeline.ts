import { BuddyContextPlan, BuddyContextPlannerInput } from '../../models/context-plan.model';

import {
	classifyAmbiguityRisk,
	classifyIntent,
	getReferenceActionTypes,
	hasActionProhibition,
	hasAmbiguousPowerEventTarget,
	hasExplicitSceneKindTarget,
	hasMultiSpaceLightingTarget,
	hasPlausibleCustomActionTarget,
	hasPositiveDeviceActionEvidence,
	hasPositiveSceneActionEvidence,
	isActionReferenceCompatible,
	isClearlyNonHomeActionClause,
	targetsDeviceActionClause,
} from './buddy-context-action-policy';
import {
	findDuplicateNameSpaceIds,
	findExcludedOnlyExplicitSpaceIds,
	findExplicitSpaces,
	getActionConditionClause,
	getActionObjectClause,
	getActionTargetClause,
	hasExplicitSpaceOccurrence,
	hasImmediateActionCondition,
	hasReferencePronoun,
	hasSingularReferencePronoun,
	normalize,
	normalizeGerundActionRequest,
	removeExplicitSpaceOccurrencesForDomain,
	resolveRecentReferences,
	stripContextualScopeReferences,
} from './buddy-context-language';
import {
	classifyDomains,
	findLeadingConditionalActionIndex,
	getActionClausesWithTargetContinuations,
	getActionMessage,
	getActionReferenceMessage,
	getActionSourceClausesWithTargetContinuations,
	hasCurrentStateReadClause,
	hasDomainSignalInClause,
	hasEnergyReadClause,
	hasHistorySignalInClause,
	hasHomeActionConditionClause,
	hasHomeStateReadClause,
	hasOnlyGroundedActionTokens,
	hasSupportedActionConditionClause,
	isGeneralExplanation,
	isScopedIndoorFutureTemperatureClause,
	isStatePredicateQuestion,
	splitPlannerClauses,
} from './buddy-context-message-analysis';
import { buildBuddyContextToolCatalog, selectBuddyContextStrategy } from './buddy-context-plan-policy';
import {
	ACTION_CANCELLATION_PATTERN,
	ACTION_COMMAND_PATTERN,
	ACTION_DURATION_PATTERN,
	ACTION_REQUEST_PATTERN,
	ACTION_SIGNAL_PATTERN_SOURCE,
	ANYWHERE_ELSE_PATTERN,
	CAPABILITY_DISCOVERY_PATTERN,
	CONTEXTUAL_SCOPE_PATTERN,
	CURRENT_STATE_PATTERN,
	DEVICE_ACTION_TARGET_PATTERN,
	DEVICE_RUN_TARGET_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_STATE_PATTERN,
	HOME_VOCABULARY_PATTERN,
	LEADING_CONDITION_PATTERN,
	LIGHTING_GROUP_EXCLUSION_PATTERN,
	LIGHTING_GROUP_PATTERN,
	LIGHTING_PATTERN,
	MAX_EXPLICIT_SPACE_SCOPES,
	MAX_RECENT_ENTITY_REFERENCES,
	MODAL_STATE_READ_PATTERN,
	NONNUMERIC_ACTION_DURATION_PATTERN,
	POSSESSIVE_HOME_ENTITY_PATTERN,
	QUALIFIED_ACTION_DURATION_PATTERN,
	READ_PATTERN,
	RELATIVE_PATTERN,
	SCENE_RUN_PATTERN,
	SECURITY_ENTITY_NAME_PATTERN,
	SECURITY_PATTERN,
	TARGET_DEPENDENT_ACTION_PATTERN,
	TEMPORAL_HISTORY_PATTERN,
	TRAILING_ACTION_PATTERN,
	TRAILING_READ_PATTERN,
	TRIGGER_PATTERN,
	UNSCOPED_AGGREGATE_READ_PATTERN,
	UNSUPPORTED_MEASUREMENT_READ_PATTERN,
	WEATHER_ENTITY_NAME_PATTERN,
	WEATHER_PATTERN,
	WHOLE_HOME_SCOPE_PATTERN,
	WRITE_PATTERN,
} from './buddy-context-planner-grammar';
import { planBuddyContextRetrieval } from './buddy-context-retrieval-planner';
import {
	resolveCombinedSpaceIds,
	resolveConversationSpaceHint,
	resolveCurrentStateClauseSpaceIds,
	resolveCurrentStateSpaceIds,
	resolveEnergySpaceIds,
	resolveTemporalHomeSpaceIds,
} from './buddy-context-scope-resolver';

export function planBuddyContext(input: BuddyContextPlannerInput): BuddyContextPlan {
	const normalizedMessage = normalizeGerundActionRequest(normalize(input.message));
	const recentEntityReferences = input.recentEntityReferences ?? [];
	const hasAnyReferencePronoun = hasReferencePronoun(stripContextualScopeReferences(normalizedMessage));
	const hasRecentReferencePronoun = hasAnyReferencePronoun && recentEntityReferences.length > 0;
	const explicitSpaces = findExplicitSpaces(normalizedMessage, input.knownSpaces ?? []);
	const excludedOnlySpaceIds = findExcludedOnlyExplicitSpaceIds(normalizedMessage, explicitSpaces);
	const duplicateNameSpaceIds = findDuplicateNameSpaceIds(explicitSpaces);
	const scopedExplicitSpaces = explicitSpaces.filter(
		(space) => !excludedOnlySpaceIds.has(space.id) && !duplicateNameSpaceIds.has(space.id),
	);
	const candidateExplicitSpaceIds = [...new Set(scopedExplicitSpaces.map((space) => space.id))];
	const hasExcessiveExplicitSpaceScope = candidateExplicitSpaceIds.length > MAX_EXPLICIT_SPACE_SCOPES;
	const boundedScopedExplicitSpaces = hasExcessiveExplicitSpaceScope ? [] : scopedExplicitSpaces;
	const explicitSpaceIds = hasExcessiveExplicitSpaceScope ? [] : candidateExplicitSpaceIds;
	const hasUnrepresentableSpaceExclusion =
		(excludedOnlySpaceIds.size > 0 && explicitSpaceIds.length === 0) ||
		splitPlannerClauses(normalizedMessage, explicitSpaces).some(
			(clause) =>
				ANYWHERE_ELSE_PATTERN.test(removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces)) &&
				(hasHomeStateReadClause(clause, explicitSpaces) || hasEnergyReadClause(clause, explicitSpaces)),
		);
	const hasDuplicateNameSpaceAmbiguity = duplicateNameSpaceIds.size > 0;
	const conversationSpaceHint =
		hasUnrepresentableSpaceExclusion || hasDuplicateNameSpaceAmbiguity || hasExcessiveExplicitSpaceScope
			? undefined
			: resolveConversationSpaceHint(normalizedMessage, input.conversationSpaceId, explicitSpaceIds);
	const conversationSpaceId = CONTEXTUAL_SCOPE_PATTERN.test(normalizedMessage)
		? (input.conversationSpaceId ?? undefined)
		: conversationSpaceHint;
	const resolvedSpaceIds = resolveCombinedSpaceIds(
		normalizedMessage,
		boundedScopedExplicitSpaces,
		explicitSpaceIds,
		conversationSpaceId,
	);
	const isGenericExplanation = isGeneralExplanation(normalizedMessage, explicitSpaces);
	const isPredicateQuestion = isStatePredicateQuestion(normalizedMessage);
	const isWrappedStateRead = MODAL_STATE_READ_PATTERN.test(normalizedMessage);
	const isConditionalOutcomeRead =
		LEADING_CONDITION_PATTERN.test(normalizedMessage) &&
		/\?\s*$/u.test(normalizedMessage) &&
		new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').test(normalizedMessage) &&
		findLeadingConditionalActionIndex(normalizedMessage) === undefined;
	const hasUnsupportedScopedFutureTemperature = splitPlannerClauses(normalizedMessage, explicitSpaces).some((clause) =>
		isScopedIndoorFutureTemperatureClause(clause, explicitSpaces),
	);
	const trailingActionMatch =
		isPredicateQuestion || isWrappedStateRead || READ_PATTERN.test(normalizedMessage)
			? TRAILING_ACTION_PATTERN.exec(normalizedMessage)
			: null;
	const hasTrailingAction = trailingActionMatch !== null;
	const hasTrailingRead = TRAILING_READ_PATTERN.test(normalizedMessage);
	const actionMessage = getActionMessage(normalizedMessage, trailingActionMatch);
	const actionReferenceMessage = getActionReferenceMessage(actionMessage, explicitSpaces);
	const hasLeadingHomeRead =
		trailingActionMatch !== null &&
		hasHomeStateReadClause(normalizedMessage.slice(0, trailingActionMatch.index), explicitSpaces);
	const isReadOnlyPredicate =
		!hasTrailingAction &&
		(isConditionalOutcomeRead ||
			isPredicateQuestion ||
			isWrappedStateRead ||
			(READ_PATTERN.test(normalizedMessage) &&
				(CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage) || hasOnlyGroundedActionTokens(normalizedMessage))));
	const hasHomeReferenceEvidence =
		explicitSpaces.length > 0 ||
		(input.conversationSpaceId !== undefined && input.conversationSpaceId !== null) ||
		hasRecentReferencePronoun ||
		hasAnyReferencePronoun ||
		HOME_ENTITY_PATTERN.test(normalizedMessage) ||
		HOME_VOCABULARY_PATTERN.test(normalizedMessage) ||
		HOME_STATE_PATTERN.test(normalizedMessage) ||
		POSSESSIVE_HOME_ENTITY_PATTERN.test(normalizedMessage);
	const plannerClauses = splitPlannerClauses(normalizedMessage, explicitSpaces);
	const hasUnsupportedHistoricalDomainRead = plannerClauses.some(
		(clause) =>
			hasHistorySignalInClause(clause) &&
			(hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)),
	);
	const actionMessageClauses = splitPlannerClauses(actionMessage, explicitSpaces);
	const actionClauses = actionMessageClauses.filter((clause) => ACTION_COMMAND_PATTERN.test(clause));
	const plannerActionSourceClauses = getActionSourceClausesWithTargetContinuations(plannerClauses, normalizedMessage);
	const hasProhibitedActionRequest =
		hasActionProhibition(normalizedMessage) || ACTION_CANCELLATION_PATTERN.test(normalizedMessage);
	const independentHomeReadClauses = plannerClauses.filter((clause) => {
		const normalizedClause = clause.trim();
		const isActionStatusRead =
			READ_PATTERN.test(normalizedClause) &&
			/\b(?:if|whether)\b/u.test(normalizedClause) &&
			(WRITE_PATTERN.test(normalizedClause) || TRIGGER_PATTERN.test(normalizedClause));

		return (
			(!plannerActionSourceClauses.includes(clause) ||
				(READ_PATTERN.test(normalizedClause) && !ACTION_REQUEST_PATTERN.test(normalizedClause))) &&
			(hasHomeStateReadClause(clause, explicitSpaces) || isActionStatusRead)
		);
	});
	const leadingActionConditionReadClauses = plannerClauses.filter(
		(clause) =>
			!ACTION_COMMAND_PATTERN.test(clause) &&
			LEADING_CONDITION_PATTERN.test(clause.trim()) &&
			hasHomeActionConditionClause(clause, explicitSpaces),
	);
	const trailingActionConditionReadClauses = actionClauses
		.map((clause) => getActionConditionClause(clause))
		.filter((clause): clause is string => clause !== undefined && hasHomeActionConditionClause(clause, explicitSpaces));
	const actionConditionReadClauses = [
		...new Set([...leadingActionConditionReadClauses, ...trailingActionConditionReadClauses]),
	];
	const hasUnsupportedActionCondition = actionClauses.some((clause) => {
		const conditionClause = getActionConditionClause(clause);
		const hasReadAntecedent =
			conditionClause !== undefined &&
			/^(?:if\s+)?so\b/u.test(conditionClause.trim()) &&
			independentHomeReadClauses.length > 0;

		return (
			conditionClause !== undefined &&
			!hasReadAntecedent &&
			!hasSupportedActionConditionClause(conditionClause, explicitSpaces)
		);
	});
	const homeReadClauses = [...independentHomeReadClauses, ...actionConditionReadClauses];
	const currentStateReadClauses = homeReadClauses.filter(
		(clause) =>
			!CAPABILITY_DISCOVERY_PATTERN.test(clause) &&
			(!hasHistorySignalInClause(clause) || CURRENT_STATE_PATTERN.test(clause)),
	);
	const unscopedHomeReadClauses = homeReadClauses.filter(
		(clause) =>
			!CONTEXTUAL_SCOPE_PATTERN.test(clause) &&
			!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)),
	);
	const hasWholeHomeRead = unscopedHomeReadClauses.some((clause) => {
		const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);

		return (
			WHOLE_HOME_SCOPE_PATTERN.test(clauseWithoutExplicitSpaces) ||
			UNSCOPED_AGGREGATE_READ_PATTERN.test(clause.trim()) ||
			CAPABILITY_DISCOVERY_PATTERN.test(clause)
		);
	});
	const independentCurrentStateSpaceIds: Array<string | undefined> = [
		...new Set(
			currentStateReadClauses.flatMap((clause) =>
				resolveCurrentStateClauseSpaceIds(clause, explicitSpaces, input.conversationSpaceId ?? undefined),
			),
		),
	];
	const hasUnscopedCurrentStateReadClause = currentStateReadClauses.some((clause) => {
		const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);

		return (
			WHOLE_HOME_SCOPE_PATTERN.test(clauseWithoutExplicitSpaces) ||
			(UNSCOPED_AGGREGATE_READ_PATTERN.test(clause.trim()) &&
				!CONTEXTUAL_SCOPE_PATTERN.test(clause) &&
				!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)))
		);
	});
	const isDeviceActionClause = (clause: string): boolean =>
		!hasExplicitSceneKindTarget(getActionObjectClause(clause)) &&
		!hasAmbiguousPowerEventTarget(clause, explicitSpaces) &&
		(((WRITE_PATTERN.test(clause) || TARGET_DEPENDENT_ACTION_PATTERN.test(clause)) &&
			hasPositiveDeviceActionEvidence(clause, explicitSpaces, recentEntityReferences)) ||
			DEVICE_RUN_TARGET_PATTERN.test(clause) ||
			(SCENE_RUN_PATTERN.test(clause) && targetsDeviceActionClause(clause, recentEntityReferences)));
	const isSceneActionClause = (clause: string): boolean =>
		TRIGGER_PATTERN.test(clause) &&
		(!DEVICE_RUN_TARGET_PATTERN.test(clause) || hasExplicitSceneKindTarget(getActionObjectClause(clause))) &&
		!targetsDeviceActionClause(clause, recentEntityReferences) &&
		hasPositiveSceneActionEvidence(clause, recentEntityReferences);
	const hasWrite = !isGenericExplanation && !isReadOnlyPredicate && actionClauses.some(isDeviceActionClause);
	const hasTrigger = !isGenericExplanation && !isReadOnlyPredicate && actionClauses.some(isSceneActionClause);
	const hasUnresolvedActionCandidate =
		(!isGenericExplanation &&
			!isReadOnlyPredicate &&
			actionClauses.some(
				(clause) =>
					!isDeviceActionClause(clause) &&
					!isSceneActionClause(clause) &&
					(!isClearlyNonHomeActionClause(clause) || hasWrite || hasTrigger) &&
					(hasWrite ||
						hasTrigger ||
						hasImmediateActionCondition(clause) ||
						hasReferencePronoun(clause) ||
						explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)) ||
						DEVICE_ACTION_TARGET_PATTERN.test(getActionObjectClause(clause)) ||
						hasPlausibleCustomActionTarget(clause)),
			)) ||
		hasProhibitedActionRequest ||
		hasUnsupportedActionCondition;
	const hasUnresolvedWrite = hasUnresolvedActionCandidate && actionClauses.some((clause) => WRITE_PATTERN.test(clause));
	const hasUnresolvedTrigger =
		hasUnresolvedActionCandidate &&
		actionClauses.some((clause) => SCENE_RUN_PATTERN.test(clause) || TARGET_DEPENDENT_ACTION_PATTERN.test(clause));
	const effectiveHasWrite = hasWrite || hasProhibitedActionRequest || (hasUnresolvedWrite && !hasUnresolvedTrigger);
	const effectiveHasTrigger = hasTrigger || hasUnresolvedTrigger;
	const hasAction = effectiveHasWrite || effectiveHasTrigger;
	const referenceActionTypes = getReferenceActionTypes(actionReferenceMessage);
	const domains = classifyDomains(
		normalizedMessage,
		hasAction ||
			(isReadOnlyPredicate &&
				hasHomeReferenceEvidence &&
				!UNSUPPORTED_MEASUREMENT_READ_PATTERN.test(
					removeExplicitSpaceOccurrencesForDomain(normalizedMessage, explicitSpaces),
				)),
		isGenericExplanation,
		hasAnyReferencePronoun,
		explicitSpaces,
		hasAction,
		input.conversationSpaceId !== undefined && input.conversationSpaceId !== null,
	);
	const hasUnsupportedScopedSecurityRead = plannerClauses.some((clause) => {
		const securityClause = ACTION_COMMAND_PATTERN.test(clause) ? (getActionConditionClause(clause) ?? '') : clause;

		return (
			hasDomainSignalInClause(
				removeExplicitSpaceOccurrencesForDomain(securityClause, explicitSpaces),
				SECURITY_PATTERN,
				SECURITY_ENTITY_NAME_PATTERN,
			) &&
			(CONTEXTUAL_SCOPE_PATTERN.test(securityClause) ||
				explicitSpaces.some((space) => hasExplicitSpaceOccurrence(securityClause, space, explicitSpaces)))
		);
	});
	const referenceMessage = hasAction ? actionReferenceMessage : domains.includes('home') ? normalizedMessage : '';
	const references = resolveRecentReferences(referenceMessage, recentEntityReferences);
	const hasExcessiveReferenceScope = references.length > MAX_RECENT_ENTITY_REFERENCES;
	const hasNonHomeRetrievalForAction =
		hasAction && domains.some((domain) => ['energy', 'history', 'security', 'weather'].includes(domain));
	const hasRead =
		domains.some((domain) => domain !== 'general') &&
		(((!hasAction || !ACTION_REQUEST_PATTERN.test(normalizedMessage)) &&
			(READ_PATTERN.test(normalizedMessage) || isWrappedStateRead)) ||
			hasTrailingRead ||
			hasNonHomeRetrievalForAction ||
			!hasAction);
	const hasActionScopedStateRequirement =
		hasAction &&
		actionClauses.some((clause) => {
			const actionTargetClause = getActionTargetClause(clause)
				.replace(ACTION_DURATION_PATTERN, ' ')
				.replace(NONNUMERIC_ACTION_DURATION_PATTERN, ' ')
				.replace(QUALIFIED_ACTION_DURATION_PATTERN, ' ');

			return (
				RELATIVE_PATTERN.test(actionTargetClause) ||
				/\b(?:that|which)\s+(?:are|is|was|were)\s+(?:active|closed|high|inactive|locked|low|off|on|open|unlocked)\b/u.test(
					actionTargetClause,
				)
			);
		});
	const requiresReadForAction =
		hasAction &&
		(actionConditionReadClauses.length > 0 || hasActionScopedStateRequirement || currentStateReadClauses.length > 0);
	const intent = classifyIntent(effectiveHasWrite, effectiveHasTrigger, hasRead || requiresReadForAction);
	const actionScopeClauses = getActionClausesWithTargetContinuations(actionMessageClauses, actionMessage);
	const actionTargetScopeClauses = actionScopeClauses.map((clause) => getActionTargetClause(clause));
	const actionScopeIds = [
		...new Set([
			...explicitSpaces
				.filter((space) =>
					actionTargetScopeClauses.some((clause) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)),
				)
				.map((space) => space.id),
			...(actionTargetScopeClauses.some((clause) => CONTEXTUAL_SCOPE_PATTERN.test(clause)) && input.conversationSpaceId
				? [input.conversationSpaceId]
				: []),
		]),
	];
	const referenceActionClauses = actionClauses
		.filter((clause) => hasReferencePronoun(clause))
		.map((clause) => getActionTargetClause(clause));
	const referenceActionScopeIds = [
		...new Set([
			...explicitSpaces
				.filter((space) =>
					referenceActionClauses.some((clause) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)),
				)
				.map((space) => space.id),
			...(referenceActionClauses.some((clause) => CONTEXTUAL_SCOPE_PATTERN.test(clause)) && input.conversationSpaceId
				? [input.conversationSpaceId]
				: []),
		]),
	];
	const ambiguityRisk = classifyAmbiguityRisk(
		normalizedMessage,
		actionMessage,
		actionReferenceMessage,
		effectiveHasWrite,
		effectiveHasTrigger,
		referenceActionTypes,
		references,
		domains,
		referenceActionScopeIds,
		CONTEXTUAL_SCOPE_PATTERN.test(normalizedMessage) && conversationSpaceId !== undefined,
		explicitSpaces,
		hasUnrepresentableSpaceExclusion,
		hasDuplicateNameSpaceAmbiguity,
		hasExcessiveExplicitSpaceScope,
		hasExcessiveReferenceScope,
		hasUnsupportedScopedFutureTemperature,
		hasUnsupportedScopedSecurityRead,
		hasUnsupportedHistoricalDomainRead,
		hasUnresolvedActionCandidate,
	);
	const strategy = selectBuddyContextStrategy(intent, ambiguityRisk, domains, input.providerCapabilities);
	const includeCurrentStateForRead =
		(!domains.includes('history') || hasCurrentStateReadClause(normalizedMessage, explicitSpaces)) &&
		(!CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage) || hasTrailingRead || hasLeadingHomeRead);
	const scopedReferences = hasExcessiveReferenceScope
		? []
		: hasAction
			? references.length === 1 &&
				isActionReferenceCompatible(references[0], effectiveHasWrite, effectiveHasTrigger, referenceActionTypes)
				? references
				: []
			: hasSingularReferencePronoun(stripContextualScopeReferences(normalizedMessage)) && references.length !== 1
				? []
				: references;
	const referencedConditionSpaceId =
		scopedReferences.length === 1 &&
		scopedReferences[0].spaceId &&
		actionConditionReadClauses.some(
			(clause) =>
				hasSingularReferencePronoun(stripContextualScopeReferences(clause)) &&
				!CONTEXTUAL_SCOPE_PATTERN.test(clause) &&
				!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)),
		)
			? scopedReferences[0].spaceId
			: undefined;
	const resolvedIndependentCurrentStateSpaceIds = referencedConditionSpaceId
		? [
				...new Set(
					currentStateReadClauses.flatMap((clause) => {
						const isReferencedCondition =
							actionConditionReadClauses.includes(clause) &&
							hasSingularReferencePronoun(stripContextualScopeReferences(clause)) &&
							!CONTEXTUAL_SCOPE_PATTERN.test(clause) &&
							!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces));

						return isReferencedCondition
							? [referencedConditionSpaceId]
							: resolveCurrentStateClauseSpaceIds(clause, explicitSpaces, input.conversationSpaceId ?? undefined);
					}),
				),
			]
		: independentCurrentStateSpaceIds;
	const querySpaceIds = scopedReferences.length > 0 && explicitSpaceIds.length === 0 ? [] : resolvedSpaceIds;
	const energySpaceIds = resolveEnergySpaceIds(
		normalizedMessage,
		boundedScopedExplicitSpaces,
		input.conversationSpaceId ?? undefined,
	);
	const hasMixedRetrievalDomain = domains.some((domain) => domain !== 'general' && domain !== 'home');
	const resolvedCurrentStateSpaceIds = hasMixedRetrievalDomain
		? resolveCurrentStateSpaceIds(
				normalizedMessage,
				boundedScopedExplicitSpaces,
				input.conversationSpaceId ?? undefined,
				querySpaceIds,
			)
		: querySpaceIds;
	const historySpaceIds = domains.includes('history')
		? resolveTemporalHomeSpaceIds(
				normalizedMessage,
				boundedScopedExplicitSpaces,
				scopedReferences.length > 0 ? undefined : (input.conversationSpaceId ?? undefined),
				TEMPORAL_HISTORY_PATTERN,
			)
		: querySpaceIds;
	const includeConversationCurrentState =
		input.conversationSpaceId !== undefined &&
		input.conversationSpaceId !== null &&
		currentStateReadClauses.some(
			(clause) =>
				!WHOLE_HOME_SCOPE_PATTERN.test(clause) &&
				!UNSCOPED_AGGREGATE_READ_PATTERN.test(clause.trim()) &&
				!CONTEXTUAL_SCOPE_PATTERN.test(clause) &&
				!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)),
		);
	const retrieval = planBuddyContextRetrieval({
		domains,
		hasAction,
		requiresReadForAction,
		includeCurrentStateForRead,
		hasActionScopedStateRequirement,
		hasUnscopedCurrentStateReadClause,
		hasWholeHomeRead,
		isGenericExplanation,
		hasExcessiveExplicitSpaceScope,
		hasExcessiveReferenceScope,
		conversationSpaceId,
		querySpaceIds,
		energySpaceIds,
		historySpaceIds,
		resolvedCurrentStateSpaceIds,
		resolvedIndependentCurrentStateSpaceIds,
		actionScopeIds,
		scopedReferences,
		includeConversationCurrentState,
		useIndependentCurrentStateScopes: !hasAction && currentStateReadClauses.length > 1,
	});
	const hasLightingGroupTarget =
		splitPlannerClauses(normalizedMessage, explicitSpaces).some(
			(clause) =>
				ACTION_COMMAND_PATTERN.test(clause) &&
				LIGHTING_PATTERN.test(clause) &&
				LIGHTING_GROUP_PATTERN.test(clause) &&
				!LIGHTING_GROUP_EXCLUSION_PATTERN.test(clause),
		) || hasMultiSpaceLightingTarget(normalizedMessage, explicitSpaces);

	return {
		domains,
		intent,
		scope: retrieval.scope,
		queries: retrieval.queries,
		toolNames: buildBuddyContextToolCatalog({
			domains,
			hasWrite: effectiveHasWrite,
			hasTrigger: effectiveHasTrigger,
			strategy,
			includeCurrentState: retrieval.hasCurrentStateQuery,
			hasLightingGroupTarget,
		}),
		ambiguityRisk,
		strategy,
	};
}
