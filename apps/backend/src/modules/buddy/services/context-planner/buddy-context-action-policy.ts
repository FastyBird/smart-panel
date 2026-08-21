import {
	BuddyContextActionType,
	BuddyContextAmbiguityRisk,
	BuddyContextDomain,
	BuddyContextEntityReference,
	BuddyContextIntent,
	BuddyContextSpaceReference,
} from '../../models/context-plan.model';

import {
	containsNormalizedPhrase,
	findExplicitSpaceOccurrences,
	findPatternRanges,
	getActionConditionClause,
	getActionObjectClause,
	getActionTargetClause,
	getActionTemporalClause,
	hasExplicitSpaceOccurrence,
	hasPluralReferencePronoun,
	hasReferencePronoun,
	hasSingularReferencePronoun,
	normalize,
	removeNormalizedPhrase,
	resolveRecentReferences,
	stripContextualScopeReferences,
} from './buddy-context-language';
import {
	getActionClausesWithTargetContinuations,
	hasDomainSignalInClause,
	hasHomeActionConditionClause,
	splitPlannerClauses,
} from './buddy-context-message-analysis';
import {
	ACTION_COMMAND_PATTERN,
	ACTION_DURATION_PATTERN,
	ACTION_NON_SCALAR_BOUND_PATTERN,
	ACTION_PROHIBITION_PREFIX_PATTERN,
	ACTION_RANGE_PATTERN,
	ACTION_SIGNAL_PATTERN_SOURCE,
	ACTION_TARGET_NEGATION_PATTERN,
	BARE_GENERIC_ACTION_TARGET_PATTERN,
	CLEAR_NON_HOME_ACTION_OBJECT_PATTERN,
	CONFLICTING_DEVICE_SCENE_QUALIFIER_PATTERN,
	CONTEXTUAL_SCOPE_PATTERN,
	DEVICE_ACTION_TARGET_PATTERN,
	ENERGY_ENTITY_NAME_PATTERN,
	ENERGY_PATTERN,
	EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN,
	EXPLICIT_SCENE_KIND_PREFIX_PATTERN,
	EXPLICIT_SCENE_KIND_SUFFIX_PATTERN,
	GENERIC_ACTION_TARGET_NAMES,
	GENERIC_ACTION_TARGET_PATTERN,
	GROUNDED_STATE_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_STATE_PATTERN,
	HOME_VOCABULARY_PATTERN,
	LEADING_RECURRING_ACTION_PATTERN,
	LEADING_UNSUPPORTED_ACTION_TEMPORAL_PATTERN,
	LIGHTING_GROUP_EXCLUSION_PATTERN,
	LIGHTING_GROUP_PATTERN,
	LIGHTING_PATTERN,
	NONNUMERIC_ACTION_DURATION_PATTERN,
	PARTIAL_LIGHTING_GROUP_PATTERN,
	PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN,
	PLURAL_HOME_TARGET_PATTERN,
	PLURAL_REFERENCE_PRONOUN_PATTERN,
	POWER_ACTION_TAIL_PATTERN_SOURCE,
	POWER_EVENT_STATE_SUBJECT_PATTERN_SOURCE,
	QUALIFIED_ACTION_DURATION_PATTERN,
	QUOTED_ENTITY_TARGET_PATTERN,
	QUOTED_SCENE_TARGET_PATTERN,
	RELATIVE_PATTERN,
	RELATIVE_SCALAR_ADJUSTMENT_PATTERN,
	REPEATED_ACTION_PATTERN,
	SCENE_TARGET_PATTERN,
	SCHEDULED_ACTION_PATTERN,
	SECURITY_ENTITY_NAME_PATTERN,
	SECURITY_PATTERN,
	STATE_SIGNAL_PATTERN,
	TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN,
	UNSUPPORTED_ACTION_TEMPORAL_ADJUNCT_PATTERN,
	UNSUPPORTED_ACTION_TEMPORAL_CALENDAR_PATTERN,
	UNSUPPORTED_ACTION_TEMPORAL_PATTERN,
	UNSUPPORTED_SCENE_INVERSE_PATTERN,
	WEATHER_ENTITY_NAME_PATTERN,
	WEATHER_PATTERN,
	ZERO_QUANTITY_LIGHTING_PATTERN,
} from './buddy-context-planner-grammar';

export function classifyIntent(hasWrite: boolean, hasTrigger: boolean, hasRead: boolean): BuddyContextIntent {
	if ((hasWrite || hasTrigger) && hasRead) return 'mixed';
	if (hasWrite && hasTrigger) return 'mixed';
	if (hasWrite) return 'write';
	if (hasTrigger) return 'trigger';
	if (hasRead) return 'read';

	return 'none';
}

export function classifyAmbiguityRisk(
	message: string,
	actionMessage: string,
	actionReferenceMessage: string,
	hasWrite: boolean,
	hasTrigger: boolean,
	requestedActionTypes: readonly BuddyContextActionType[],
	references: readonly BuddyContextEntityReference[],
	domains: readonly BuddyContextDomain[],
	actionScopeIds: readonly string[] = [],
	hasResolvedContextualScope = false,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
	hasUnrepresentableSpaceExclusion = false,
	hasDuplicateNameSpaceAmbiguity = false,
	hasExcessiveExplicitSpaceScope = false,
	hasExcessiveReferenceScope = false,
	hasUnsupportedScopedFutureTemperature = false,
	hasUnsupportedScopedSecurityRead = false,
	hasUnsupportedHistoricalDomainRead = false,
	hasUnresolvedNamedAction = false,
): BuddyContextAmbiguityRisk {
	const isAction = hasWrite || hasTrigger;
	if (hasUnsupportedScopedFutureTemperature) return isAction ? 'action' : 'read';
	if (hasUnsupportedScopedSecurityRead) return isAction ? 'action' : 'read';
	if (hasUnsupportedHistoricalDomainRead) return isAction ? 'action' : 'read';

	if (isAction) {
		const splitActionClauses = splitPlannerClauses(actionMessage, explicitSpaces);
		const firstActionClauseIndex = splitActionClauses.findIndex((clause) => ACTION_COMMAND_PATTERN.test(clause));
		const leadingActionAdjuncts = firstActionClauseIndex > 0 ? splitActionClauses.slice(0, firstActionClauseIndex) : [];
		const scopedActionClauses = getActionClausesWithTargetContinuations(splitActionClauses, actionMessage);
		const actionTargetClauses = scopedActionClauses.map((clause) => getActionTargetClause(clause));
		if (hasNegatedAction(message, actionMessage, explicitSpaces)) return 'action';
		if (hasUnresolvedNamedAction) return 'action';
		if (hasTrigger && UNSUPPORTED_SCENE_INVERSE_PATTERN.test(actionMessage)) return 'action';
		if (
			actionScopeIds.length > 0 &&
			references.length > 0 &&
			(references.length !== 1 ||
				actionScopeIds.length !== 1 ||
				references[0].spaceId === undefined ||
				references[0].spaceId === null ||
				!actionScopeIds.includes(references[0].spaceId))
		) {
			return 'action';
		}
		if (hasDuplicateNameSpaceAmbiguity || hasExcessiveExplicitSpaceScope || hasExcessiveReferenceScope) {
			return 'action';
		}
		if (
			(hasPluralReferencePronoun(stripContextualScopeReferences(actionReferenceMessage)) &&
				!hasPluralReferenceAntecedent(message) &&
				!hasPluralReferenceTarget(references)) ||
			(hasReferencePronoun(stripContextualScopeReferences(actionReferenceMessage)) &&
				(references.length !== 1 ||
					!isActionReferenceCompatible(references[0], hasWrite, hasTrigger, requestedActionTypes)))
		) {
			return 'action';
		}
		if (/\bor\b/u.test(actionReferenceMessage)) return 'action';
		if (scopedActionClauses.some((clause) => REPEATED_ACTION_PATTERN.test(getActionTemporalClause(clause)))) {
			return 'action';
		}
		if (actionTargetClauses.some((clause) => ACTION_RANGE_PATTERN.test(clause))) return 'action';
		if (actionTargetClauses.some((clause) => ACTION_NON_SCALAR_BOUND_PATTERN.test(clause))) return 'action';
		if (actionTargetClauses.some(hasMissingRequiredActionValue)) return 'action';
		if (
			actionTargetClauses.some(hasConflictingDeviceSceneTarget) ||
			CONFLICTING_DEVICE_SCENE_QUALIFIER_PATTERN.test(actionMessage)
		) {
			return 'action';
		}
		if (
			scopedActionClauses.some((clause) => {
				const conditionClause = getActionConditionClause(clause);
				const temporalClause = (
					conditionClause && hasHomeActionConditionClause(conditionClause, explicitSpaces)
						? getActionTargetClause(clause)
						: getActionTemporalClause(clause)
				).replace(RELATIVE_SCALAR_ADJUSTMENT_PATTERN, ' ');

				return (
					SCHEDULED_ACTION_PATTERN.test(temporalClause) ||
					ACTION_DURATION_PATTERN.test(temporalClause) ||
					NONNUMERIC_ACTION_DURATION_PATTERN.test(temporalClause) ||
					QUALIFIED_ACTION_DURATION_PATTERN.test(temporalClause) ||
					UNSUPPORTED_ACTION_TEMPORAL_PATTERN.test(temporalClause) ||
					UNSUPPORTED_ACTION_TEMPORAL_ADJUNCT_PATTERN.test(temporalClause) ||
					UNSUPPORTED_ACTION_TEMPORAL_CALENDAR_PATTERN.test(temporalClause)
				);
			}) ||
			leadingActionAdjuncts.some(
				(clause) =>
					SCHEDULED_ACTION_PATTERN.test(clause.trim()) ||
					ACTION_DURATION_PATTERN.test(clause.trim()) ||
					NONNUMERIC_ACTION_DURATION_PATTERN.test(clause.trim()) ||
					QUALIFIED_ACTION_DURATION_PATTERN.test(clause.trim()) ||
					UNSUPPORTED_ACTION_TEMPORAL_PATTERN.test(clause.trim()) ||
					UNSUPPORTED_ACTION_TEMPORAL_ADJUNCT_PATTERN.test(clause.trim()) ||
					UNSUPPORTED_ACTION_TEMPORAL_CALENDAR_PATTERN.test(clause.trim()),
			) ||
			LEADING_RECURRING_ACTION_PATTERN.test(message) ||
			LEADING_UNSUPPORTED_ACTION_TEMPORAL_PATTERN.test(message)
		) {
			return 'action';
		}
		if (ZERO_QUANTITY_LIGHTING_PATTERN.test(actionMessage)) return 'action';
		const hasUnsafeGenericActionClause = splitPlannerClauses(actionReferenceMessage, explicitSpaces).some(
			(clause) =>
				hasGenericActionTargetClause(clause, explicitSpaces, actionScopeIds.length > 0) &&
				!hasBothExplicitSpaceLightingTarget(clause, explicitSpaces),
		);
		if (hasUnsafeGenericActionClause) {
			return 'action';
		}

		return 'none';
	}
	if (
		hasUnrepresentableSpaceExclusion ||
		hasDuplicateNameSpaceAmbiguity ||
		hasExcessiveExplicitSpaceScope ||
		hasExcessiveReferenceScope
	) {
		return 'read';
	}
	const hasSingularHomeReference = splitPlannerClauses(message, explicitSpaces).some(
		(clause) =>
			hasSingularReferencePronoun(stripContextualScopeReferences(clause)) &&
			(HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				GROUNDED_STATE_PATTERN.test(clause) ||
				STATE_SIGNAL_PATTERN.test(clause)) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN),
	);
	const hasPluralHomeReference = splitPlannerClauses(message, explicitSpaces).some(
		(clause) =>
			hasPluralReferencePronoun(stripContextualScopeReferences(clause)) &&
			(HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				GROUNDED_STATE_PATTERN.test(clause) ||
				STATE_SIGNAL_PATTERN.test(clause)) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN),
	);
	if (
		domains.includes('home') &&
		hasSingularHomeReference &&
		references.length !== 1 &&
		!(hasResolvedContextualScope && CONTEXTUAL_SCOPE_PATTERN.test(message))
	) {
		return 'read';
	}
	if (
		domains.includes('home') &&
		hasPluralHomeReference &&
		!hasPluralReferenceTarget(references) &&
		!hasPluralReferenceAntecedent(message) &&
		!(hasResolvedContextualScope && CONTEXTUAL_SCOPE_PATTERN.test(message))
	) {
		return 'read';
	}

	if (CONTEXTUAL_SCOPE_PATTERN.test(message) && !hasResolvedContextualScope) return 'read';

	return 'none';
}

export function hasPluralReferenceAntecedent(message: string): boolean {
	const pluralReference = PLURAL_REFERENCE_PRONOUN_PATTERN.exec(message);

	return (
		pluralReference !== null &&
		pluralReference.index > 0 &&
		PLURAL_HOME_TARGET_PATTERN.test(message.slice(0, pluralReference.index))
	);
}

export function hasPluralReferenceTarget(references: readonly BuddyContextEntityReference[]): boolean {
	return (
		references.length > 1 || (references.length === 1 && PLURAL_HOME_TARGET_PATTERN.test(normalize(references[0].name)))
	);
}

export function hasGenericActionTargetClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	hasConversationSpace: boolean,
): boolean {
	const clauseSpaces = explicitSpaces.filter((space) => hasExplicitSpaceOccurrence(message, space, explicitSpaces));
	const hasClauseSpace = clauseSpaces.length > 0;
	const hasResolvedContextualSpace = hasConversationSpace && CONTEXTUAL_SCOPE_PATTERN.test(message);

	if (LIGHTING_GROUP_EXCLUSION_PATTERN.test(message)) return true;
	if (PARTIAL_LIGHTING_GROUP_PATTERN.test(message)) return true;
	if (clauseSpaces.length > 1 && /\bor\b/u.test(message)) return true;
	if (
		(hasClauseSpace || hasResolvedContextualSpace) &&
		LIGHTING_PATTERN.test(message) &&
		LIGHTING_GROUP_PATTERN.test(message)
	) {
		return false;
	}
	if (EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN.test(message)) return false;
	if (QUOTED_ENTITY_TARGET_PATTERN.test(message)) return false;
	if (/\bpower\s+(?:heater|switch)\s+(?:off|on)(?:\s+(?:now|please))?[?!,.]*$/u.test(message)) return false;
	if (GENERIC_ACTION_TARGET_PATTERN.test(message) || BARE_GENERIC_ACTION_TARGET_PATTERN.test(message)) return true;
	if (
		!hasClauseSpace &&
		!hasResolvedContextualSpace &&
		DEVICE_ACTION_TARGET_PATTERN.test(getActionObjectClause(message)) &&
		!TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN.test(getActionObjectClause(message))
	) {
		return true;
	}

	return explicitSpaces.some((space) => {
		const normalizedSpaceName = normalize(space.name);

		return GENERIC_ACTION_TARGET_NAMES.some((target) =>
			containsNormalizedPhrase(message, `${normalizedSpaceName} ${target}`),
		);
	});
}

export function targetsDeviceActionClause(clause: string, references: readonly BuddyContextEntityReference[]): boolean {
	if (hasExplicitSceneKindTarget(getActionObjectClause(clause))) return false;
	if (DEVICE_ACTION_TARGET_PATTERN.test(getActionObjectClause(clause))) return true;

	const resolvedReferences = resolveRecentReferences(clause, references);

	return resolvedReferences.length === 1 && ['device', 'property'].includes(resolvedReferences[0].kind);
}

export function hasAmbiguousPowerEventTarget(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	const power = /\bpower\b/u.exec(clause);
	if (!power) return false;
	const powerEvent = new RegExp(String.raw`\b${POWER_EVENT_STATE_SUBJECT_PATTERN_SOURCE}\b`, 'u').exec(
		clause.slice(power.index + power[0].length),
	);
	if (powerEvent) {
		const eventEnd = power.index + power[0].length + powerEvent.index + powerEvent[0].length;
		const laterTargetStarts = [
			...findExplicitSpaceOccurrences(clause, explicitSpaces).map((occurrence) => occurrence.range.start),
			...findPatternRanges(clause, TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN).map((range) => range.start),
			...findPatternRanges(clause, PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN).map((range) => range.start),
			...findPatternRanges(clause, DEVICE_ACTION_TARGET_PATTERN).map((range) => range.start),
			...findPatternRanges(clause, /\b(?:it|them)\b/u).map((range) => range.start),
		]
			.filter((start) => start >= eventEnd)
			.sort((left, right) => left - right);
		const laterTargetStart = laterTargetStarts[0];
		if (laterTargetStart !== undefined && clause.slice(eventEnd, laterTargetStart).trim().length > 0) return true;
	}
	const primaryTargetStarts = [
		...findExplicitSpaceOccurrences(clause, explicitSpaces).map((occurrence) => occurrence.range.start),
		...findPatternRanges(clause, TRUSTED_UNSCOPED_DEVICE_TARGET_PATTERN).map((range) => range.start),
		...findPatternRanges(clause, PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN).map((range) => range.start),
		...findPatternRanges(clause, /\b(?:it|them)\b/u).map((range) => range.start),
	]
		.filter((start) => start > power.index)
		.sort((left, right) => left - right);
	const deviceTargetStarts = findPatternRanges(clause, DEVICE_ACTION_TARGET_PATTERN)
		.map((range) => range.start)
		.filter((start) => start > power.index)
		.sort((left, right) => left - right);
	const targetStart = primaryTargetStarts[0] ?? deviceTargetStarts[0];
	if (targetStart === undefined) return false;

	const prefix = clause
		.slice(power.index + power[0].length, targetStart)
		.replace(/^\s*(?:off|on)\b/u, ' ')
		.replace(
			/\b(?:a|air|all|an|blind|blinds|device|devices|door|doors|fan|fans|heater|heaters|in|inside|lamp|lamps|light|lights|my|our|purifier|sensor|sensors|switch|switches|television|the|thermostat|thermostats|tv|within|window|windows|your)\b/gu,
			' ',
		)
		.replace(/\s+/gu, ' ')
		.trim();

	return prefix.length > 0;
}

export function hasPositiveDeviceActionEvidence(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	references: readonly BuddyContextEntityReference[],
): boolean {
	const targetClause = getActionObjectClause(clause);
	if (hasExplicitSceneKindTarget(targetClause)) return false;
	if (isClearlyNonHomeActionClause(clause)) return false;
	const resolvedReferences = resolveRecentReferences(clause, references);
	if (resolvedReferences.length === 1 && ['device', 'property'].includes(resolvedReferences[0].kind)) {
		return true;
	}

	return (
		DEVICE_ACTION_TARGET_PATTERN.test(targetClause) ||
		explicitSpaces.some((space) => hasScopedDeviceTarget(targetClause, space, explicitSpaces)) ||
		(CONTEXTUAL_SCOPE_PATTERN.test(targetClause) && HOME_VOCABULARY_PATTERN.test(targetClause))
	);
}

export function hasScopedDeviceTarget(
	targetClause: string,
	space: BuddyContextSpaceReference,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	if (!hasExplicitSpaceOccurrence(targetClause, space, explicitSpaces)) return false;

	const residual = removeNormalizedPhrase(targetClause, normalize(space.name))
		.split(/\b(?:at|to)\b/u, 1)[0]
		.replace(
			/\b(?:a|all|an|back|blue|completely|eco|green|in|mode|now|off|on|red|the|white)\b|[-+]?\d+(?:\.\d+)?%?/gu,
			' ',
		)
		.replace(/\s+/gu, ' ')
		.trim();

	return residual.length > 0;
}

export function hasPlausibleCustomActionTarget(clause: string): boolean {
	const targetClause = getActionObjectClause(clause);
	if (PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.test(targetClause)) return true;

	const significantTokens = targetClause
		.split(/[^\p{Letter}\p{Number}]+/u)
		.filter((token) => token.length > 0 && !/^(?:a|all|an|my|off|on|our|the|to|trigger|your)$/u.test(token));

	return significantTokens.length >= 1;
}

export function hasMissingRequiredActionValue(clause: string): boolean {
	if (!/\b(?:adjust|change|set|switch|turn)\b/u.test(clause)) return false;

	const actionObject = getActionObjectClause(clause);
	const hasExplicitValue =
		/\b(?:at|to)\s+\S/u.test(actionObject) ||
		RELATIVE_PATTERN.test(actionObject) ||
		/\b(?:active|blue|closed|cooler|dimmer|eco|green|higher|inactive|locked|lower|off|on|open|red|unlocked|warmer|white)\b/u.test(
			actionObject,
		) ||
		/[-+]?\d+(?:\.\d+)?\s*(?:%|celsius\b|degrees?\b|fahrenheit\b|percent\b|°\s*(?:c|f)?)?/u.test(actionObject);

	return !hasExplicitValue;
}

export function isClearlyNonHomeActionClause(clause: string): boolean {
	return CLEAR_NON_HOME_ACTION_OBJECT_PATTERN.test(getActionObjectClause(clause).trim());
}

export function hasPositiveSceneActionEvidence(
	clause: string,
	references: readonly BuddyContextEntityReference[],
): boolean {
	if (SCENE_TARGET_PATTERN.test(getActionObjectClause(clause))) return true;

	const resolvedReferences = resolveRecentReferences(clause, references);

	return resolvedReferences.length === 1 && resolvedReferences[0].kind === 'scene';
}

export function hasExplicitSceneKindTarget(targetClause: string): boolean {
	if (
		QUOTED_SCENE_TARGET_PATTERN.test(targetClause) ||
		EXPLICIT_SCENE_KIND_PREFIX_PATTERN.test(targetClause) ||
		EXPLICIT_SCENE_KIND_SUFFIX_PATTERN.test(targetClause)
	) {
		return true;
	}

	const sceneKind = [...targetClause.matchAll(new RegExp(SCENE_TARGET_PATTERN.source, 'gu'))].at(-1);
	const deviceKind = [...targetClause.matchAll(new RegExp(DEVICE_ACTION_TARGET_PATTERN.source, 'gu'))].at(-1);
	if (!sceneKind) return false;
	if (!deviceKind) return true;
	if (sceneKind.index <= deviceKind.index) return false;

	const separator = targetClause.slice(deviceKind.index + deviceKind[0].length, sceneKind.index);
	const suffix = targetClause.slice(sceneKind.index + sceneKind[0].length);

	return separator.trim().length === 0 && !/^\s+mode\b/u.test(suffix);
}

export function hasConflictingDeviceSceneTarget(targetClause: string): boolean {
	const sceneKind = [...targetClause.matchAll(new RegExp(SCENE_TARGET_PATTERN.source, 'gu'))].at(-1);
	const deviceKind = [...targetClause.matchAll(new RegExp(DEVICE_ACTION_TARGET_PATTERN.source, 'gu'))].at(-1);

	return Boolean(
		sceneKind && deviceKind && sceneKind.index > deviceKind.index && !hasExplicitSceneKindTarget(targetClause),
	);
}

export function hasNegatedAction(
	message: string,
	actionMessage: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	const actionClauses = getActionClausesWithTargetContinuations(
		splitPlannerClauses(actionMessage, explicitSpaces),
		actionMessage,
	).map((clause) => clause.trim());
	if (hasActionProhibition(message)) return true;

	return (
		ACTION_TARGET_NEGATION_PATTERN.test(actionMessage) ||
		actionClauses.some((clause) => ACTION_TARGET_NEGATION_PATTERN.test(getActionTargetClause(clause)))
	);
}

export function hasActionProhibition(message: string): boolean {
	if (
		/^(?:avoid|refrain\s+from)\s+(?:activating|adjusting|changing|closing|deactivating|dimming|locking|lowering|opening|raising|running|setting|starting|stopping|switching|triggering|turning|unlocking)\b/u.test(
			message,
		)
	) {
		return true;
	}
	const actionPattern = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'gu');

	return [...message.matchAll(actionPattern)].some((action) => {
		const prefix = message.slice(0, action.index);
		const sentencePrefix = prefix.slice(
			Math.max(prefix.lastIndexOf('.'), prefix.lastIndexOf(';'), prefix.lastIndexOf('?')) + 1,
		);

		return sentencePrefix
			.split(',')
			.map((segment) => segment.trim())
			.some((segment) => ACTION_PROHIBITION_PREFIX_PATTERN.test(segment));
	});
}

export function isActionReferenceCompatible(
	reference: BuddyContextEntityReference,
	hasWrite: boolean,
	hasTrigger: boolean,
	requestedActionTypes: readonly BuddyContextActionType[],
): boolean {
	if (reference.kind === 'space') return false;
	if (requestedActionTypes.length === 0) return false;
	if (!requestedActionTypes.every((actionType) => reference.compatibleActionTypes.includes(actionType))) return false;
	if (hasTrigger && hasWrite) return true;
	if (hasTrigger) return reference.kind === 'scene';
	if (hasWrite) return reference.kind !== 'scene';

	return false;
}

export function getRequestedActionTypes(message: string): BuddyContextActionType[] {
	const actions = new Set<BuddyContextActionType>();
	const mappings: readonly [RegExp, BuddyContextActionType][] = [
		[/\b(?:activate|aktivuj)\b/u, 'activate'],
		[/\b(?:adjust|brighten|decrease|increase|lower|raise|sniz|zvys)\b/u, 'adjust'],
		[/\bchange\b/u, 'change'],
		[/\b(?:close|zavri)\b/u, 'close'],
		[/\bdeactivate\b/u, 'deactivate'],
		[/\bdim\b/u, 'dim'],
		[/\b(?:lock|zamkni)\b/u, 'lock'],
		[/\bmake\b/u, 'make'],
		[/\b(?:open|otevri)\b/u, 'open'],
		[new RegExp(String.raw`\bpower${POWER_ACTION_TAIL_PATTERN_SOURCE}`, 'u'), 'turn'],
		[/\b(?:run|spust)\b/u, 'run'],
		[/\b(?:set|nastav)\b/u, 'set'],
		[/\bstart\b/u, 'start'],
		[/\bstop\b/u, 'stop'],
		[/\bswitch\b/u, 'switch'],
		[/\btrigger\b/u, 'trigger'],
		[/\b(?:turn|vypni|zapni)\b/u, 'turn'],
		[/\b(?:unlock|odemkni)\b/u, 'unlock'],
	];

	for (const [pattern, action] of mappings) {
		if (pattern.test(message)) actions.add(action);
	}

	return [...actions];
}

export function getReferenceActionTypes(message: string): BuddyContextActionType[] {
	const clauses = message.split(/(?:[?!,.;]|\b(?:and(?: also)?|as well as|plus|then)\b)/u);
	const actionTypes = new Set<BuddyContextActionType>();

	for (const clause of clauses) {
		if (!hasReferencePronoun(stripContextualScopeReferences(clause))) continue;
		for (const actionType of getRequestedActionTypes(clause)) actionTypes.add(actionType);
	}

	return [...actionTypes];
}

export function hasMultiSpaceLightingTarget(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	if (
		explicitSpaces.length < 2 ||
		!ACTION_COMMAND_PATTERN.test(message) ||
		!LIGHTING_PATTERN.test(message) ||
		LIGHTING_GROUP_EXCLUSION_PATTERN.test(message)
	) {
		return false;
	}

	const spaceRanges = findExplicitSpaceOccurrences(message, explicitSpaces)
		.map((occurrence) => occurrence.range)
		.sort((left, right) => left.start - right.start);

	if (spaceRanges.length < 2) return false;

	const firstSpace = spaceRanges[0];
	const lastSpace = spaceRanges[spaceRanges.length - 1];
	const targetPrefix = message.slice(0, firstSpace.start);
	const targetConjunction = message.slice(firstSpace.end, lastSpace.start);
	const targetSuffix = message.slice(lastSpace.end);

	return (
		ACTION_COMMAND_PATTERN.test(targetPrefix) &&
		/\band\b/u.test(targetConjunction) &&
		!/\bor\b/u.test(targetConjunction) &&
		/^\s*(?:lamps|lighting|lights|svetla)\b/u.test(targetSuffix)
	);
}

function hasBothExplicitSpaceLightingTarget(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	if (!hasMultiSpaceLightingTarget(message, explicitSpaces)) return false;

	const spaceOccurrences = findExplicitSpaceOccurrences(message, explicitSpaces).sort(
		(left, right) => left.range.start - right.range.start,
	);
	const uniqueSpaceIds = new Set(spaceOccurrences.map((occurrence) => occurrence.space.id));

	if (uniqueSpaceIds.size !== 2 || spaceOccurrences.length < 2) return false;

	const targetPrefix = message.slice(0, spaceOccurrences[0].range.start);

	if (!/\bboth(?:\s+of(?:\s+the)?)?\s*$/u.test(targetPrefix)) return false;

	return !PARTIAL_LIGHTING_GROUP_PATTERN.test(message.replace(/\bboth(?:\s+of(?:\s+the)?)?\b/u, ' '));
}
