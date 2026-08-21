import { BuddyContextSpaceReference } from '../../models/context-plan.model';

import {
	containsNormalizedPhrase,
	findExplicitSpaceOccurrences,
	getActionConditionClause,
	hasExplicitSpaceOccurrence,
	hasReferencePronoun,
	normalize,
	removeExplicitSpaceOccurrencesForDomain,
	removeNormalizedPhrase,
	splitConditionSegments,
	stripContextualScopeReferences,
} from './buddy-context-language';
import {
	expandConjoinedSpaceIds,
	expandCoordinatedTemporalPropertySpaceIds,
	getMessageEnergyReadClauses,
	hasDomainSignalInClause,
	hasEnergyReadClause,
	hasHistorySignalInClause,
	hasHomeStateReadClause,
	isPowerEventStateRead,
	isPowerStateRead,
	resolveConjoinedTemporalSpaceIds,
	resolveTemporalExplicitSpaceIds,
	splitPlannerClauses,
} from './buddy-context-message-analysis';
import {
	ACTION_COMMAND_PATTERN,
	BUILT_IN_ACTION_SPACE_NAMES,
	CONTEXTUAL_SCOPE_PATTERN,
	CURRENT_STATE_PATTERN,
	GROUNDED_STATE_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_INSTALLATION_PATTERN,
	HOME_STATE_PATTERN,
	HOME_VOCABULARY_PATTERN,
	PREDICATE_QUESTION_PATTERN,
	READ_PATTERN,
	SECURITY_ENTITY_NAME_PATTERN,
	SECURITY_PATTERN,
	STATE_SIGNAL_PATTERN,
	UNSCOPED_AGGREGATE_READ_PATTERN,
	UNSUPPORTED_MEASUREMENT_READ_PATTERN,
	WEATHER_ENTITY_NAME_PATTERN,
	WEATHER_PATTERN,
	WHOLE_HOME_SCOPE_PATTERN,
} from './buddy-context-planner-grammar';

export function resolveConversationSpaceHint(
	message: string,
	conversationSpaceId?: string | null,
	explicitSpaceIds: readonly string[] = [],
): string | undefined {
	if (WHOLE_HOME_SCOPE_PATTERN.test(message)) return undefined;

	const uniqueExplicitSpaceIds = [...new Set(explicitSpaceIds)];

	if (uniqueExplicitSpaceIds.length === 1) return uniqueExplicitSpaceIds[0];
	if (uniqueExplicitSpaceIds.length > 1) return undefined;
	if (UNSCOPED_AGGREGATE_READ_PATTERN.test(message) && !CONTEXTUAL_SCOPE_PATTERN.test(message)) return undefined;
	if (HOME_INSTALLATION_PATTERN.test(message)) return undefined;
	if ([...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(message, spaceName))) {
		return undefined;
	}

	return conversationSpaceId ?? undefined;
}

export function resolveCombinedSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	explicitSpaceIds: readonly string[],
	conversationSpaceId?: string,
): string[] {
	if (!conversationSpaceId) return [...explicitSpaceIds];
	if (!CONTEXTUAL_SCOPE_PATTERN.test(message)) {
		return [...new Set(explicitSpaceIds.length > 0 ? explicitSpaceIds : [conversationSpaceId])];
	}

	const contextualIndex = message.search(CONTEXTUAL_SCOPE_PATTERN);
	const firstExplicitIndex = findExplicitSpaceOccurrences(message, explicitSpaces)
		.map((occurrence) => occurrence.range.start)
		.sort((left, right) => left - right)[0];
	const orderedSpaceIds =
		firstExplicitIndex === undefined || contextualIndex < firstExplicitIndex
			? [conversationSpaceId, ...explicitSpaceIds]
			: [...explicitSpaceIds, conversationSpaceId];

	return [...new Set(orderedSpaceIds)];
}

export function resolveEnergySpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId?: string,
): Array<string | undefined> {
	const energyClauses = getMessageEnergyReadClauses(message, explicitSpaces);

	return [
		...new Set(
			energyClauses.flatMap((clause): Array<string | undefined> => {
				const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);
				if (WHOLE_HOME_SCOPE_PATTERN.test(clause) || HOME_INSTALLATION_PATTERN.test(clauseWithoutExplicitSpaces)) {
					return [undefined];
				}

				const directSpaceIds = explicitSpaces
					.filter((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces))
					.map((space) => space.id);
				const explicitSpaceIds = expandConjoinedSpaceIds(clause, explicitSpaces, directSpaceIds);
				if (explicitSpaceIds.length > 0) return explicitSpaceIds;
				if (CONTEXTUAL_SCOPE_PATTERN.test(clause) && conversationSpaceId) return [conversationSpaceId];
				if ([...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName))) {
					return [];
				}

				return [conversationSpaceId];
			}),
		),
	];
}

export function resolveCurrentStateClauseSpaceIds(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId: string | undefined,
): Array<string | undefined> {
	const clauseSpaceIds = explicitSpaces
		.filter((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces))
		.map((space) => space.id);
	if (clauseSpaceIds.length > 0) return clauseSpaceIds;
	if (CONTEXTUAL_SCOPE_PATTERN.test(clause) && conversationSpaceId) return [conversationSpaceId];

	const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);
	if (
		WHOLE_HOME_SCOPE_PATTERN.test(clauseWithoutExplicitSpaces) ||
		UNSCOPED_AGGREGATE_READ_PATTERN.test(clause.trim()) ||
		[...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName))
	) {
		return [undefined];
	}

	return [conversationSpaceId];
}

export function resolveCurrentStateSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId: string | undefined,
	fallbackSpaceIds: readonly string[],
): string[] | undefined {
	const conjoinedTemporalSpaceIds = new Set(resolveConjoinedTemporalSpaceIds(message, explicitSpaces));
	const currentStateClauses = splitPlannerClauses(message, explicitSpaces)
		.flatMap((clause) => {
			const normalizedClause = clause.trim();
			const isReadPredicate = READ_PATTERN.test(normalizedClause) || PREDICATE_QUESTION_PATTERN.test(normalizedClause);
			const retrievalClause =
				ACTION_COMMAND_PATTERN.test(clause) && !isReadPredicate ? (getActionConditionClause(clause) ?? '') : clause;
			const condition = /\b(?:if|when|while)\b/u.exec(retrievalClause);

			return condition && condition.index > 0
				? [retrievalClause.slice(0, condition.index), retrievalClause.slice(condition.index + condition[0].length)]
				: [retrievalClause];
		})
		.filter((clause) => {
			if (hasHistorySignalInClause(clause) && !CURRENT_STATE_PATTERN.test(clause)) return false;
			if (
				!CURRENT_STATE_PATTERN.test(clause) &&
				explicitSpaces.some(
					(space) =>
						conjoinedTemporalSpaceIds.has(space.id) && hasExplicitSpaceOccurrence(clause, space, explicitSpaces),
				)
			) {
				return false;
			}

			const hasHomeSignal =
				HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_INSTALLATION_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				isPowerStateRead(clause) ||
				isPowerEventStateRead(clause, explicitSpaces) ||
				CONTEXTUAL_SCOPE_PATTERN.test(clause) ||
				(hasReferencePronoun(stripContextualScopeReferences(clause)) &&
					(CURRENT_STATE_PATTERN.test(clause) ||
						GROUNDED_STATE_PATTERN.test(clause) ||
						STATE_SIGNAL_PATTERN.test(clause)));
			const hasNonHomeSignal =
				hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasEnergyReadClause(clause, explicitSpaces) ||
				hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) ||
				UNSUPPORTED_MEASUREMENT_READ_PATTERN.test(clause);

			const hasExplicitSpace = explicitSpaces.some((space) =>
				hasExplicitSpaceOccurrence(clause, space, explicitSpaces),
			);
			const clauseWithoutExplicitSpaces = explicitSpaces.reduce(
				(result, space) => removeNormalizedPhrase(result, normalize(space.name)),
				clause,
			);
			const hasIndependentHomeSignal =
				HOME_ENTITY_PATTERN.test(clauseWithoutExplicitSpaces) ||
				HOME_VOCABULARY_PATTERN.test(clauseWithoutExplicitSpaces) ||
				HOME_STATE_PATTERN.test(clauseWithoutExplicitSpaces) ||
				CONTEXTUAL_SCOPE_PATTERN.test(clauseWithoutExplicitSpaces);

			return (
				hasHomeSignal &&
				(!hasNonHomeSignal ||
					CONTEXTUAL_SCOPE_PATTERN.test(clause) ||
					(hasExplicitSpace && hasIndependentHomeSignal) ||
					(hasNonHomeSignal && HOME_ENTITY_PATTERN.test(clauseWithoutExplicitSpaces)))
			);
		});
	if (currentStateClauses.length === 0) return undefined;
	if (
		currentStateClauses.some((clause) => {
			const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);

			return (
				HOME_INSTALLATION_PATTERN.test(clauseWithoutExplicitSpaces) ||
				WHOLE_HOME_SCOPE_PATTERN.test(clauseWithoutExplicitSpaces)
			);
		})
	) {
		return [];
	}

	const explicitCurrentSpaceIds = resolveTemporalExplicitSpaceIds(
		currentStateClauses,
		explicitSpaces,
		CURRENT_STATE_PATTERN,
	);

	if (explicitCurrentSpaceIds.length > 0) return explicitCurrentSpaceIds;
	if (currentStateClauses.some((clause) => CONTEXTUAL_SCOPE_PATTERN.test(clause)) && conversationSpaceId) {
		return [conversationSpaceId];
	}
	if (
		currentStateClauses.some((clause) =>
			[...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName)),
		)
	) {
		return [];
	}
	if (conversationSpaceId) return [conversationSpaceId];
	if (explicitSpaces.length === 1) return [explicitSpaces[0].id];

	return [...fallbackSpaceIds];
}

export function resolveTemporalHomeSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId: string | undefined,
	temporalPattern: RegExp,
): Array<string | undefined> {
	const temporalClauses = splitPlannerClauses(message, explicitSpaces).flatMap((clause) => {
		const segments = splitConditionSegments(clause);
		const mainHasTemporalSignal = temporalPattern.test(segments[0]);

		return segments.filter(
			(segment, index) =>
				temporalPattern.test(segment) ||
				(index > 0 && mainHasTemporalSignal && isHistoricalHomeConditionSegment(segment, explicitSpaces)),
		);
	});

	return [
		...new Set(
			temporalClauses.flatMap((clause): Array<string | undefined> => {
				if (WHOLE_HOME_SCOPE_PATTERN.test(clause)) return [undefined];

				const directSpaceIds = resolveTemporalExplicitSpaceIds([clause], explicitSpaces, temporalPattern);
				const coordinatedSpaceIds = expandCoordinatedTemporalPropertySpaceIds(message, explicitSpaces, directSpaceIds);
				const explicitSpaceIds = expandConjoinedSpaceIds(message, explicitSpaces, coordinatedSpaceIds);
				if (explicitSpaceIds.length > 0) return explicitSpaceIds;
				if (CONTEXTUAL_SCOPE_PATTERN.test(clause) && conversationSpaceId) return [conversationSpaceId];
				if ([...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName))) {
					return [];
				}

				return [conversationSpaceId];
			}),
		),
	];
}

export function isHistoricalHomeConditionSegment(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	return (
		/\b(?:had|remained|stayed|turned|was|were)\b/u.test(clause) &&
		hasHomeStateReadClause(clause, explicitSpaces) &&
		!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
		!hasEnergyReadClause(clause, explicitSpaces) &&
		!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
	);
}
