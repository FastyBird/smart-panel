import { BuddyContextDomain, BuddyContextSpaceReference } from '../../models/context-plan.model';

import {
	findExplicitSpaceOccurrences,
	findPatternRanges,
	getActionTargetClause,
	getRetrievalClause,
	hasExplicitSpaceOccurrence,
	hasReferencePronoun,
	normalize,
	removeExplicitSpaceOccurrencesForDomain,
	splitConditionSegments,
	stripContextualScopeReferences,
} from './buddy-context-language';
import {
	ACTION_COMMAND_PATTERN,
	ACTION_CONDITION_STATE_PATTERN,
	ACTION_CONTINUATION_CONNECTOR_PATTERN,
	ACTION_DURATION_PATTERN,
	ACTION_RANGE_PATTERN,
	ACTION_REQUEST_PATTERN,
	ACTION_REQUEST_PREFIX_PATTERN_SOURCE,
	ACTION_SIGNAL_PATTERN_SOURCE,
	CLOCK_TIME_HISTORY_PATTERN,
	COMPOUND_CONNECTOR_PATTERN_SOURCE,
	CONTEXTUAL_SCOPE_PATTERN,
	CURRENT_STATE_PATTERN,
	DOMAIN_ORDER,
	ENERGY_ELLIPSIS_READ_PATTERN,
	ENERGY_ENTITY_NAME_PATTERN,
	ENERGY_PATTERN,
	EXPLICIT_WEATHER_PATTERN,
	FUTURE_TEMPERATURE_PATTERN,
	GENERAL_KNOWLEDGE_INVENTORY_PATTERN,
	GROUNDED_STATE_PATTERN,
	HISTORY_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_INSTALLATION_PATTERN,
	HOME_STATE_PATTERN,
	HOME_VOCABULARY_PATTERN,
	LEADING_CONDITION_PATTERN,
	LEADING_ENERGY_PREDICATE_PATTERN,
	LEADING_UNSUPPORTED_ACTION_TEMPORAL_PATTERN,
	LEADING_WEEKDAY_HISTORY_PATTERN,
	NONNUMERIC_ACTION_DURATION_PATTERN,
	POSSESSIVE_HOME_ENTITY_PATTERN,
	POWER_EVENT_STATE_READ_PATTERN,
	POWER_MEASUREMENT_READ_PATTERN,
	POWER_STATE_READ_PATTERN,
	POWER_USAGE_READ_PATTERN,
	PREDICATE_QUESTION_PATTERN,
	QUALIFIED_ACTION_DURATION_PATTERN,
	READ_PATTERN,
	REPEATED_ENERGY_CONNECTOR_PATTERN,
	SCHEDULED_ACTION_PATTERN,
	SECURITY_ENTITY_NAME_PATTERN,
	SECURITY_PATTERN,
	STATE_SIGNAL_PATTERN,
	TEMPORAL_HISTORY_PATTERN,
	TRIGGER_PATTERN,
	UNSUPPORTED_MEASUREMENT_READ_PATTERN,
	WEATHER_ENTITY_NAME_PATTERN,
	WEATHER_PATTERN,
	WRITE_PATTERN,
} from './buddy-context-planner-grammar';

export function getActionMessage(message: string, trailingActionMatch: RegExpExecArray | null): string {
	if (trailingActionMatch) return message.slice(trailingActionMatch.index);
	if (LEADING_UNSUPPORTED_ACTION_TEMPORAL_PATTERN.test(message)) {
		const action = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(message);

		if (action) return message.slice(action.index);
	}
	if (!LEADING_CONDITION_PATTERN.test(message)) return message;

	const unpunctuatedActionIndex = findLeadingConditionalActionIndex(message);

	return unpunctuatedActionIndex === undefined ? message : message.slice(unpunctuatedActionIndex);
}

export function findLeadingConditionalActionIndex(message: string): number | undefined {
	if (!LEADING_CONDITION_PATTERN.test(message)) return undefined;

	const actionPattern = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'gu');
	const actionMatches = [...message.matchAll(actionPattern)].filter(
		(match) => !/\b(?:are|is|was|were)\s*$/u.test(message.slice(0, match.index)),
	);
	let commandMatch = actionMatches.at(-1);

	for (let index = actionMatches.length - 2; index >= 0 && commandMatch; index -= 1) {
		const candidate = actionMatches[index];
		const connector = message.slice(candidate.index + candidate[0].length, commandMatch.index);

		if (!new RegExp(String.raw`\b(?:a|${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b`, 'u').test(connector)) break;
		commandMatch = candidate;
	}
	if (commandMatch && isConditionalOutcomeQuestion(message, commandMatch.index)) return undefined;

	return commandMatch?.index;
}

export function isConditionalOutcomeQuestion(message: string, actionIndex: number): boolean {
	if (!/\?\s*$/u.test(message)) return false;
	const trailingBoundary = message.slice(actionIndex).search(/[,;]/u);

	if (LEADING_CONDITION_PATTERN.test(message) && trailingBoundary >= 0) {
		const mainClause = message.slice(actionIndex + trailingBoundary + 1).trim();

		if (READ_PATTERN.test(mainClause) || PREDICATE_QUESTION_PATTERN.test(mainClause)) return true;
	}

	const prefix = message.slice(0, actionIndex);
	const clauseBoundary = Math.max(prefix.lastIndexOf(','), prefix.lastIndexOf(';'));
	const outcomePattern =
		/^(?:(?:how|what|when|where|which|who|why)\b(?:\s+\p{Letter}+){0,2}\s+)?(?:(?:can|could|may|might|must|should|will|would)\s+(?!you\b)|(?:are|did|do|does|had|has|have|is|was|were)\b)/u;

	if (clauseBoundary >= 0) return outcomePattern.test(prefix.slice(clauseBoundary + 1).trim());

	const unpunctuatedModalPattern = new RegExp(
		String.raw`(?:(?:how|what|when|where|which|who|why)\b(?:\s+\p{Letter}+){0,2}\s+)?(?:can|could|did|do|does|may|might|must|should|will|would)\s+(?!you\b)`,
		'gu',
	);
	const modalMatch = [...prefix.matchAll(unpunctuatedModalPattern)].at(-1);
	if (!modalMatch) return false;

	return !new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').test(prefix.slice(modalMatch.index));
}

export function getActionReferenceMessage(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): string {
	return splitPlannerClauses(message, explicitSpaces)
		.filter((clause) => ACTION_COMMAND_PATTERN.test(clause))
		.map((clause) => {
			const actionOnlyClause = clause.replace(
				new RegExp(
					String.raw`^[?!,.;\s]*(?:(?:a|${COMPOUND_CONNECTOR_PATTERN_SOURCE}|if so|only|please)\s+)*(?:${ACTION_REQUEST_PREFIX_PATTERN_SOURCE}\s+(?:(?:only|please)\s+)*)?`,
					'u',
				),
				'',
			);

			return getActionTargetClause(actionOnlyClause);
		})
		.join(' and ');
}

export function classifyDomains(
	message: string,
	hasHomeActionOrPredicate: boolean,
	isGenericExplanation: boolean,
	hasRecentReferencePronoun = false,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
	hasAction = false,
	hasConversationSpace = false,
): BuddyContextDomain[] {
	if (isGenericExplanation) return ['general'];

	const domains = new Set<BuddyContextDomain>();
	const clauses = splitPlannerClauses(message, explicitSpaces);
	const hasWeather = clauses.some(
		(clause) =>
			!isScopedIndoorFutureTemperatureClause(clause, explicitSpaces) &&
			hasDomainSignalInClause(
				removeExplicitSpaceOccurrencesForDomain(getRetrievalClause(clause), explicitSpaces),
				WEATHER_PATTERN,
				WEATHER_ENTITY_NAME_PATTERN,
			),
	);
	const hasEnergy = clauses.some((clause) => hasEnergyReadClause(clause, explicitSpaces));
	const hasSecurity = hasDomainSignalOutsideEntityName(
		message,
		SECURITY_PATTERN,
		SECURITY_ENTITY_NAME_PATTERN,
		explicitSpaces,
	);
	const inheritedEnergyClauses = new Set(
		getMessageEnergyReadClauses(message, explicitSpaces).map((clause) => clause.trim()),
	);
	const hasOnlyEnergyReads = clauses.every((clause) => inheritedEnergyClauses.has(clause.trim()));
	const conjoinedEnergySpaceIds = new Set(resolveConjoinedEnergySpaceIds(message, explicitSpaces));
	const hasHomeEntity = clauses.some((clause) => {
		const retrievalClause = removeExplicitSpaceOccurrencesForDomain(
			getRetrievalClause(clause),
			explicitSpaces.filter((space) => conjoinedEnergySpaceIds.has(space.id)),
		);
		const hasHomeSignal = HOME_ENTITY_PATTERN.test(retrievalClause) || HOME_VOCABULARY_PATTERN.test(retrievalClause);
		const hasNonHomeSignal =
			hasDomainSignalInClause(retrievalClause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(retrievalClause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(retrievalClause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) ||
			UNSUPPORTED_MEASUREMENT_READ_PATTERN.test(retrievalClause) ||
			inheritedEnergyClauses.has(clause.trim());

		const hasDeviceSpecificDomainRead = hasNonHomeSignal && HOME_ENTITY_PATTERN.test(retrievalClause);

		return (
			hasHomeSignal &&
			(!hasNonHomeSignal || CONTEXTUAL_SCOPE_PATTERN.test(retrievalClause) || hasDeviceSpecificDomainRead)
		);
	});
	const hasInstallationHome = clauses.some(
		(clause) =>
			HOME_INSTALLATION_PATTERN.test(clause) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN),
	);
	const hasContextualHomeState = clauses.some(
		(clause) =>
			HOME_STATE_PATTERN.test(clause) &&
			(!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				CONTEXTUAL_SCOPE_PATTERN.test(clause)),
	);
	const hasRecentReferenceHome =
		hasRecentReferencePronoun &&
		(hasAction ||
			clauses.some((clause) => {
				const referenceClause = stripContextualScopeReferences(clause);

				return (
					hasReferencePronoun(referenceClause) &&
					!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
					!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
					!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
				);
			}));
	const hasCategoryFreeHomeState = clauses.some((clause) => {
		const normalizedClause = clause.trim();
		if (hasPowerStateReadSegment(normalizedClause) || isPowerEventStateRead(normalizedClause, explicitSpaces))
			return true;

		return (
			PREDICATE_QUESTION_PATTERN.test(normalizedClause) &&
			(GROUNDED_STATE_PATTERN.test(normalizedClause) || STATE_SIGNAL_PATTERN.test(normalizedClause)) &&
			(hasConversationSpace || hasRecentReferencePronoun || explicitSpaces.length > 0) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
		);
	});
	const hasExplicitHomeSpace = explicitSpaces.some((space) =>
		clauses.some((clause) => {
			if (!hasExplicitSpaceOccurrence(clause, space, explicitSpaces)) return false;

			const clauseWithoutSpace = removeExplicitSpaceOccurrencesForDomain(
				clause,
				conjoinedEnergySpaceIds.has(space.id)
					? explicitSpaces.filter((candidate) => conjoinedEnergySpaceIds.has(candidate.id))
					: [space],
			);
			const hasNonHomeSignal =
				hasDomainSignalInClause(clauseWithoutSpace, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clauseWithoutSpace, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clauseWithoutSpace, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) ||
				UNSUPPORTED_MEASUREMENT_READ_PATTERN.test(clauseWithoutSpace) ||
				inheritedEnergyClauses.has(clause.trim());
			const hasHomeSignal =
				HOME_ENTITY_PATTERN.test(clauseWithoutSpace) ||
				HOME_VOCABULARY_PATTERN.test(clauseWithoutSpace) ||
				HOME_STATE_PATTERN.test(clauseWithoutSpace) ||
				CONTEXTUAL_SCOPE_PATTERN.test(clauseWithoutSpace);
			if (conjoinedEnergySpaceIds.has(space.id) && !hasHomeSignal) return false;

			return !hasNonHomeSignal || hasHomeSignal;
		}),
	);

	if (
		!hasOnlyEnergyReads &&
		(hasHomeEntity ||
			hasContextualHomeState ||
			hasHomeActionOrPredicate ||
			hasRecentReferenceHome ||
			hasCategoryFreeHomeState ||
			hasExplicitHomeSpace ||
			hasInstallationHome)
	) {
		domains.add('home');
	}
	if (hasWeather) domains.add('weather');
	if (hasEnergy) domains.add('energy');
	if (hasSecurity) domains.add('security');
	if (clauses.some((clause) => hasHistorySignalInClause(clause))) {
		const historySegments = clauses.flatMap((clause) => splitConditionSegments(clause));
		const hasHomeSpecificHistory = historySegments.some((clause) => {
			if (!hasHistorySignalInClause(clause)) return false;

			const hasExplicitSpace = explicitSpaces.some((space) =>
				hasExplicitSpaceOccurrence(clause, space, explicitSpaces),
			);
			const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces);
			const hasHomeSignal =
				HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_INSTALLATION_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				hasExplicitSpace ||
				(hasRecentReferenceHome && hasReferencePronoun(clause));
			const hasIndependentHomeSignal =
				HOME_ENTITY_PATTERN.test(clauseWithoutExplicitSpaces) ||
				HOME_VOCABULARY_PATTERN.test(clauseWithoutExplicitSpaces) ||
				HOME_INSTALLATION_PATTERN.test(clauseWithoutExplicitSpaces) ||
				HOME_STATE_PATTERN.test(clauseWithoutExplicitSpaces) ||
				(hasRecentReferenceHome && hasReferencePronoun(clauseWithoutExplicitSpaces));
			const hasNonHomeSignal =
				hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasEnergyReadClause(clause, explicitSpaces) ||
				hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);

			return (
				hasHomeSignal &&
				(!hasNonHomeSignal || CONTEXTUAL_SCOPE_PATTERN.test(clause) || (hasExplicitSpace && hasIndependentHomeSignal))
			);
		});

		if (hasHomeSpecificHistory) {
			domains.add('home');
			domains.add('history');
		}
	}

	if (domains.size === 0) domains.add('general');

	return DOMAIN_ORDER.filter((domain) => domains.has(domain));
}

export function hasDomainSignalOutsideEntityName(
	message: string,
	domainPattern: RegExp,
	entityNamePattern: RegExp,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	return splitPlannerClauses(message, explicitSpaces).some((clause) =>
		hasDomainSignalInClause(
			removeExplicitSpaceOccurrencesForDomain(getRetrievalClause(clause), explicitSpaces),
			domainPattern,
			entityNamePattern,
		),
	);
}

export function hasEnergyReadClause(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	return getEnergyReadClauses(clause, explicitSpaces).length > 0;
}

export function getEnergyReadClauses(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): string[] {
	const retrievalClause = getRetrievalClause(clause);

	return splitConditionSegments(retrievalClause).filter((segment) =>
		hasDirectEnergyReadClause(segment, explicitSpaces),
	);
}

export function getMessageEnergyReadClauses(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): string[] {
	const energyClauses: string[] = [];
	let hasPriorEnergyRead = false;

	for (const clause of splitPlannerClauses(message, explicitSpaces)) {
		const directEnergyClauses = getEnergyReadClauses(clause, explicitSpaces);
		if (directEnergyClauses.length > 0) {
			energyClauses.push(...directEnergyClauses);
			hasPriorEnergyRead = true;
			continue;
		}

		const retrievalClause = getRetrievalClause(clause).trim();
		if (hasPriorEnergyRead && isEnergyEllipsisReadClause(retrievalClause, explicitSpaces)) {
			energyClauses.push(retrievalClause);
			continue;
		}

		hasPriorEnergyRead = false;
	}

	return energyClauses;
}

export function isEnergyEllipsisReadClause(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	const clauseWithoutSpaces = removeExplicitSpaceOccurrencesForDomain(clause, explicitSpaces)
		.replace(/[?!.]/gu, ' ')
		.trim();
	if (
		ENERGY_ELLIPSIS_READ_PATTERN.test(clause) &&
		/^how\s+much\s+(?:(?:did|does|has|have|it|they|we|you)\s+)*(?:consume|consumed|consumes|produce|produced|produces|use|used|uses)\b/u.test(
			clauseWithoutSpaces,
		)
	) {
		return true;
	}
	if (!explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces))) return false;

	return /^(?:what\s+about)?$/u.test(clauseWithoutSpaces);
}

export function hasDirectEnergyReadClause(
	retrievalClause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	if (POWER_USAGE_READ_PATTERN.test(retrievalClause)) return true;
	if (isPowerEventStateRead(retrievalClause, explicitSpaces)) return false;

	const energyClause = isPowerStateRead(retrievalClause)
		? retrievalClause.replace(/\bpower\b/gu, ' ')
		: retrievalClause;

	return hasDomainSignalInClause(
		removeExplicitSpaceOccurrencesForDomain(energyClause, explicitSpaces),
		ENERGY_PATTERN,
		ENERGY_ENTITY_NAME_PATTERN,
	);
}

export function isPowerStateRead(message: string): boolean {
	return (
		POWER_STATE_READ_PATTERN.test(message) &&
		!POWER_USAGE_READ_PATTERN.test(message) &&
		!POWER_MEASUREMENT_READ_PATTERN.test(message)
	);
}

export function hasPowerStateReadSegment(message: string): boolean {
	return splitConditionSegments(message).some((segment) => isPowerStateRead(segment));
}

export function isPowerEventStateRead(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	if (!POWER_EVENT_STATE_READ_PATTERN.test(message) || POWER_USAGE_READ_PATTERN.test(message)) return false;

	const withoutPowerEvent = removeExplicitSpaceOccurrencesForDomain(
		message.replace(new RegExp(POWER_EVENT_STATE_READ_PATTERN.source, 'gu'), ' '),
		explicitSpaces,
	);

	return !hasDomainSignalInClause(withoutPowerEvent, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN);
}

export function hasDomainSignalInClause(clause: string, domainPattern: RegExp, entityNamePattern: RegExp): boolean {
	return domainPattern.test(clause.replace(entityNamePattern, ' '));
}

export function isScopedIndoorFutureTemperatureClause(
	clause: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): boolean {
	return (
		FUTURE_TEMPERATURE_PATTERN.test(clause) &&
		!EXPLICIT_WEATHER_PATTERN.test(clause) &&
		explicitSpaces.some((space) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces))
	);
}

export function hasHistorySignalInClause(clause: string): boolean {
	const historyClause = ACTION_COMMAND_PATTERN.test(clause) ? clause.replace(ACTION_DURATION_PATTERN, ' ') : clause;

	return (
		HISTORY_PATTERN.test(historyClause) ||
		LEADING_WEEKDAY_HISTORY_PATTERN.test(historyClause) ||
		(!ACTION_COMMAND_PATTERN.test(clause) && CLOCK_TIME_HISTORY_PATTERN.test(historyClause))
	);
}

export function splitPlannerClauses(
	message: string,
	protectedSpaces: readonly BuddyContextSpaceReference[] = [],
): string[] {
	const protectedRanges = [
		...findExplicitSpaceOccurrences(message, protectedSpaces).map((occurrence) => occurrence.range),
		...findConjoinedSpaceTargetRanges(message, protectedSpaces),
		...findPatternRanges(message, CLOCK_TIME_HISTORY_PATTERN),
		...findPatternRanges(message, ACTION_RANGE_PATTERN),
		...findPatternRanges(message, ACTION_DURATION_PATTERN),
		...findPatternRanges(
			message,
			/\b(?:current|currently|now|today)\s+and\s+(?:yesterday|(?:last|previous)\s+(?:day|hour|month|night|week|weekend|year))\b/u,
		),
		...findPatternRanges(message, /\d+\.\d+/u),
	];
	const separatorPattern = new RegExp(
		String.raw`(?:,\s*(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})(?:\s+then)?\b|[?!,.;]|\band\s+then\b|\b(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b|\ba\b(?=\s*(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b))`,
		'gu',
	);
	const clauses: string[] = [];
	let clauseStart = 0;

	for (const separator of message.matchAll(separatorPattern)) {
		const separatorStart = separator.index;
		const separatorEnd = separatorStart + separator[0].length;

		if (protectedRanges.some((range) => range.start <= separatorStart && range.end >= separatorEnd)) continue;

		clauses.push(message.slice(clauseStart, separatorStart));
		clauseStart = separatorEnd;
	}

	clauses.push(message.slice(clauseStart));

	const preservesConditionalOutcomeQuestion =
		LEADING_CONDITION_PATTERN.test(message) &&
		/\?\s*$/u.test(message) &&
		findLeadingConditionalActionIndex(message) === undefined;
	const conditionalClauses = preservesConditionalOutcomeQuestion
		? clauses
		: clauses.flatMap((clause) => {
				const actionIndex = findLeadingConditionalActionIndex(clause);

				return actionIndex === undefined || actionIndex === 0
					? [clause]
					: [clause.slice(0, actionIndex), clause.slice(actionIndex)];
			});

	return mergeActionTargetDurationContinuations(mergeLeadingTemporalAdjuncts(conditionalClauses));
}

export function mergeLeadingTemporalAdjuncts(clauses: string[]): string[] {
	const merged = [...clauses];

	while (
		merged.length > 1 &&
		hasHistorySignalInClause(merged[0].trim()) &&
		!HOME_ENTITY_PATTERN.test(merged[0]) &&
		!HOME_STATE_PATTERN.test(merged[0]) &&
		!hasDomainSignalInClause(merged[0], WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
		!hasDomainSignalInClause(merged[0], ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
		!hasDomainSignalInClause(merged[0], SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) &&
		!ACTION_COMMAND_PATTERN.test(merged[0])
	) {
		merged.splice(0, 2, `${merged[0]} ${merged[1]}`);
	}

	return merged;
}

export function mergeActionTargetDurationContinuations(clauses: string[]): string[] {
	const merged: string[] = [];

	for (const clause of clauses) {
		const previousClause = merged.at(-1);
		const isDurationContinuation =
			previousClause !== undefined &&
			ACTION_COMMAND_PATTERN.test(previousClause) &&
			WRITE_PATTERN.test(previousClause) &&
			!ACTION_COMMAND_PATTERN.test(clause) &&
			!READ_PATTERN.test(clause.trim()) &&
			!PREDICATE_QUESTION_PATTERN.test(clause.trim()) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) &&
			(HOME_ENTITY_PATTERN.test(clause) || HOME_VOCABULARY_PATTERN.test(clause)) &&
			GROUNDED_STATE_PATTERN.test(clause) &&
			(ACTION_DURATION_PATTERN.test(clause) ||
				NONNUMERIC_ACTION_DURATION_PATTERN.test(clause) ||
				QUALIFIED_ACTION_DURATION_PATTERN.test(clause));

		if (isDurationContinuation) {
			merged[merged.length - 1] = `${previousClause} and ${clause}`;
			continue;
		}

		merged.push(clause);
	}

	return merged;
}

export function getActionClausesWithTargetContinuations(clauses: readonly string[], sourceMessage: string): string[] {
	return getActionClauseSelection(clauses, sourceMessage).map(({ validationClause }) => validationClause);
}

export function getActionSourceClausesWithTargetContinuations(
	clauses: readonly string[],
	sourceMessage: string,
): string[] {
	return getActionClauseSelection(clauses, sourceMessage).map(({ sourceClause }) => sourceClause);
}

export function getActionClauseSelection(
	clauses: readonly string[],
	sourceMessage: string,
): Array<{ sourceClause: string; validationClause: string }> {
	const actionClauses: Array<{ sourceClause: string; validationClause: string }> = [];
	let inheritedAction: string | undefined;
	let previousClauseEnd = 0;
	let searchStart = 0;

	for (const clause of clauses) {
		const clauseStart = sourceMessage.indexOf(clause, searchStart);
		const connector = clauseStart >= 0 ? sourceMessage.slice(previousClauseEnd, clauseStart) : '';
		const hasContinuationConnector = ACTION_CONTINUATION_CONNECTOR_PATTERN.test(connector);
		if (clauseStart >= 0) {
			previousClauseEnd = clauseStart + clause.length;
			searchStart = previousClauseEnd;
		}

		const prefixedActionClause = getTemporallyPrefixedActionClause(clause);

		if (ACTION_COMMAND_PATTERN.test(clause) || prefixedActionClause) {
			actionClauses.push({ sourceClause: clause, validationClause: clause });
			inheritedAction = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(
				prefixedActionClause ?? clause,
			)?.[0];
			continue;
		}

		const isActionTargetContinuation = Boolean(
			inheritedAction &&
			hasContinuationConnector &&
			!READ_PATTERN.test(clause.trim()) &&
			!PREDICATE_QUESTION_PATTERN.test(clause.trim()) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) &&
			(HOME_ENTITY_PATTERN.test(clause) || HOME_VOCABULARY_PATTERN.test(clause)) &&
			hasActionTargetContinuationValue(clause),
		);

		if (isActionTargetContinuation && inheritedAction) {
			actionClauses.push({ sourceClause: clause, validationClause: `${inheritedAction} ${clause}` });
		}
		if (!isActionTargetContinuation) inheritedAction = undefined;
	}

	return actionClauses;
}

function getTemporallyPrefixedActionClause(clause: string): string | undefined {
	const actionSignal = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(clause);

	if (!actionSignal || actionSignal.index === 0) return undefined;

	const temporalPrefix = clause.slice(0, actionSignal.index).trim();
	const actionClause = clause.slice(actionSignal.index);

	return SCHEDULED_ACTION_PATTERN.test(temporalPrefix) && ACTION_COMMAND_PATTERN.test(actionClause)
		? actionClause
		: undefined;
}

export function hasActionTargetContinuationValue(clause: string): boolean {
	const targetRange = findPatternRanges(clause, HOME_ENTITY_PATTERN).at(-1);
	if (!targetRange) return false;

	const value = clause.slice(targetRange.end).trim();
	const directStatePattern = new RegExp(String.raw`^(?:${GROUNDED_STATE_PATTERN.source})$`, 'u');

	return (
		directStatePattern.test(value) ||
		/^(?:at|by|to)\s+[^?!,.;]{1,40}$/u.test(value) ||
		/^[-+]?\d+(?:\.\d+)?\s*(?:%|celsius\b|degrees?\b|fahrenheit\b|percent\b|°\s*(?:c|f)?)?$/u.test(value)
	);
}

export function findConjoinedSpaceTargetRanges(
	message: string,
	spaces: readonly BuddyContextSpaceReference[],
): Array<{ start: number; end: number }> {
	const occurrences = findExplicitSpaceOccurrences(message, spaces).sort(
		(left, right) => left.range.start - right.range.start,
	);
	const sharedTargetPattern = new RegExp(
		String.raw`^\s*(?:temperatures?\b|${HOME_ENTITY_PATTERN.source}|${HOME_STATE_PATTERN.source}|${ENERGY_PATTERN.source}|${SECURITY_PATTERN.source}|${EXPLICIT_WEATHER_PATTERN.source})`,
		'u',
	);
	const precedingSharedTargetPattern = new RegExp(
		String.raw`(?:temperatures?|${HOME_ENTITY_PATTERN.source}|${HOME_STATE_PATTERN.source}|${ENERGY_PATTERN.source}|${SECURITY_PATTERN.source}|${EXPLICIT_WEATHER_PATTERN.source})\b[^?!,.;]{0,40}$`,
		'u',
	);
	const ranges: Array<{ start: number; end: number }> = [];

	for (let index = 0; index < occurrences.length - 1; index += 1) {
		const left = occurrences[index];
		const right = occurrences[index + 1];
		const connector = message.slice(left.range.end, right.range.start);
		const hasRepeatedEnergyPredicate =
			REPEATED_ENERGY_CONNECTOR_PATTERN.test(connector) &&
			LEADING_ENERGY_PREDICATE_PATTERN.test(message.slice(right.range.end)) &&
			hasDomainSignalInClause(
				removeExplicitSpaceOccurrencesForDomain(message.slice(0, left.range.start), spaces),
				ENERGY_PATTERN,
				ENERGY_ENTITY_NAME_PATTERN,
			);

		if (hasRepeatedEnergyPredicate) {
			ranges.push({ start: left.range.end, end: right.range.start });
			continue;
		}

		if (!/^\s*(?:,\s*|,?\s+(?:and|or)\s+)$/u.test(connector)) continue;
		let chainEndIndex = index + 1;
		while (chainEndIndex < occurrences.length - 1) {
			const chainLeft = occurrences[chainEndIndex];
			const chainRight = occurrences[chainEndIndex + 1];
			if (!/^\s*(?:,\s*|,?\s+(?:and|or)\s+)$/u.test(message.slice(chainLeft.range.end, chainRight.range.start))) {
				break;
			}
			chainEndIndex += 1;
		}
		const chainEnd = occurrences[chainEndIndex];
		if (
			!sharedTargetPattern.test(message.slice(chainEnd.range.end)) &&
			!precedingSharedTargetPattern.test(message.slice(0, left.range.start))
		) {
			continue;
		}

		ranges.push({ start: left.range.end, end: right.range.start });
	}

	return ranges;
}

export function hasCurrentStateReadClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	const conjoinedTemporalSpaceIds = new Set(resolveConjoinedTemporalSpaceIds(message, explicitSpaces));

	return splitPlannerClauses(message, explicitSpaces).some((clause) => {
		const normalizedClause = clause.trim();

		if (hasHistorySignalInClause(normalizedClause) && !CURRENT_STATE_PATTERN.test(normalizedClause)) return false;
		if (
			!CURRENT_STATE_PATTERN.test(normalizedClause) &&
			explicitSpaces.some(
				(space) =>
					conjoinedTemporalSpaceIds.has(space.id) &&
					hasExplicitSpaceOccurrence(normalizedClause, space, explicitSpaces),
			)
		) {
			return false;
		}

		return (
			CURRENT_STATE_PATTERN.test(normalizedClause) ||
			READ_PATTERN.test(normalizedClause) ||
			PREDICATE_QUESTION_PATTERN.test(normalizedClause)
		);
	});
}

export function hasHomeStateReadClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	return splitPlannerClauses(message, explicitSpaces).some((clause) => {
		const normalizedClause = clause.trim();
		if (hasPowerStateReadSegment(normalizedClause) || isPowerEventStateRead(normalizedClause, explicitSpaces))
			return true;
		const clauseWithoutExplicitSpaces = removeExplicitSpaceOccurrencesForDomain(normalizedClause, explicitSpaces);
		const clauseWithoutDomainEntityNames = clauseWithoutExplicitSpaces
			.replace(WEATHER_ENTITY_NAME_PATTERN, ' ')
			.replace(ENERGY_ENTITY_NAME_PATTERN, ' ')
			.replace(SECURITY_ENTITY_NAME_PATTERN, ' ');
		const hasNonHomeDomainSignal =
			hasDomainSignalInClause(normalizedClause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(normalizedClause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(normalizedClause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN) ||
			UNSUPPORTED_MEASUREMENT_READ_PATTERN.test(normalizedClause);
		const hasExplicitWeatherSignal = EXPLICIT_WEATHER_PATTERN.test(clauseWithoutDomainEntityNames);
		const hasIndependentHomeSignal =
			HOME_ENTITY_PATTERN.test(clauseWithoutDomainEntityNames) ||
			(!hasExplicitWeatherSignal &&
				(HOME_VOCABULARY_PATTERN.test(clauseWithoutDomainEntityNames) ||
					HOME_STATE_PATTERN.test(clauseWithoutDomainEntityNames))) ||
			CONTEXTUAL_SCOPE_PATTERN.test(clauseWithoutDomainEntityNames);
		if (hasNonHomeDomainSignal && !hasIndependentHomeSignal) return false;

		return (
			HOME_ENTITY_PATTERN.test(normalizedClause) ||
			HOME_VOCABULARY_PATTERN.test(normalizedClause) ||
			HOME_STATE_PATTERN.test(normalizedClause) ||
			CONTEXTUAL_SCOPE_PATTERN.test(normalizedClause) ||
			(PREDICATE_QUESTION_PATTERN.test(normalizedClause) && GROUNDED_STATE_PATTERN.test(normalizedClause))
		);
	});
}

export function hasHomeActionConditionClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	if (hasHomeStateReadClause(message, explicitSpaces)) return true;
	if (
		!GROUNDED_STATE_PATTERN.test(message) &&
		!STATE_SIGNAL_PATTERN.test(message) &&
		!ACTION_CONDITION_STATE_PATTERN.test(message)
	) {
		return false;
	}

	return (
		!hasDomainSignalInClause(message, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
		!hasDomainSignalInClause(message, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
		!hasDomainSignalInClause(message, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
	);
}

export function hasSupportedActionConditionClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	return (
		hasHomeActionConditionClause(message, explicitSpaces) ||
		hasDomainSignalInClause(message, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
		hasEnergyReadClause(message, explicitSpaces) ||
		hasDomainSignalInClause(message, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
	);
}

export function isGeneralExplanation(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	const indefiniteDefinitionSubject =
		/^what (?:is|are) (?:a|an)\s+([\p{Letter}\p{Number}][\p{Letter}\p{Number}\s-]*?)[?!.]*$/u
			.exec(message)?.[1]
			?.trim();
	if (
		indefiniteDefinitionSubject &&
		explicitSpaces.some((space) => normalize(space.name) === indefiniteDefinitionSubject)
	) {
		return true;
	}
	if (explicitSpaces.length > 0 || POSSESSIVE_HOME_ENTITY_PATTERN.test(message)) return false;
	if (/\b(?:my|our)\b/u.test(message) && /\b(?:energy|power|secure|security|weather)\b/u.test(message)) return false;
	const isConceptualDomainRequest =
		/^(?:define|describe|explain|tell me about|what (?:is|are))\b/u.test(message) &&
		/\b(?:energy|power|security|weather)\b/u.test(message) &&
		!HOME_ENTITY_PATTERN.test(message) &&
		!/\b(?:alarm|armed|consumption|current|currently|forecast|now|outside|production|rain|today|tonight|usage)\b/u.test(
			message,
		);

	return (
		GENERAL_KNOWLEDGE_INVENTORY_PATTERN.test(message) ||
		isConceptualDomainRequest ||
		/^(?:explain|tell me about)\b.*\b(?:energy conservation|website security)\b/u.test(message) ||
		/^what is (?:electrical|kinetic|potential|renewable) (?:energy|power)[?!.]*$/u.test(message) ||
		/^what is (?:security|weather)[?!.]*$/u.test(message) ||
		/^(?:explain|is)\b.*\b(?:password|website)\b.*\b(?:secure|security)\b/u.test(message) ||
		/^what (?:is|are) (?:smart )?(?:device|devices|home|home automation|lighting|scene|scenes|sensor|sensors|thermostat|thermostats)[?!.]*$/u.test(
			message,
		) ||
		/^how (?:can|could|did|do|does|would)\b.*\b(?:work|works|working|i)\b/u.test(message) ||
		/^explain (?:how|what|why)\b/u.test(message) ||
		/^(?:explain|show me|tell me) how to\b/u.test(message) ||
		/^what (?:do|does) (?:a|an)\b.*\bdo\b/u.test(message) ||
		/^what (?:do|does) .+ mean\b/u.test(message) ||
		/^what (?:is|are) (?:a|an)\b/u.test(message)
	);
}

export function hasOnlyGroundedActionTokens(message: string): boolean {
	const tokens = new Set(message.split(/[^\p{Letter}\p{Number}]+/u).filter((token) => token.length > 0));
	let hasActionToken = false;

	for (const token of tokens) {
		if (!WRITE_PATTERN.test(token)) continue;
		hasActionToken = true;
		if (!/^(?:close|closed|lock|locked|off|on|open|unlock|unlocked)$/u.test(token)) return false;
	}

	return hasActionToken;
}

export function isStatePredicateQuestion(message: string): boolean {
	return (
		PREDICATE_QUESTION_PATTERN.test(message) &&
		(WRITE_PATTERN.test(message) || TRIGGER_PATTERN.test(message)) &&
		!ACTION_REQUEST_PATTERN.test(message)
	);
}

export function resolveConjoinedTemporalSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): string[] {
	const temporalClauses = splitPlannerClauses(message, explicitSpaces).filter((clause) =>
		hasHistorySignalInClause(clause),
	);
	const directlyTemporalSpaceIds = resolveTemporalExplicitSpaceIds(
		temporalClauses,
		explicitSpaces,
		TEMPORAL_HISTORY_PATTERN,
	);

	const coordinatedTemporalSpaceIds = expandCoordinatedTemporalPropertySpaceIds(
		message,
		explicitSpaces,
		directlyTemporalSpaceIds,
	);

	return expandConjoinedSpaceIds(message, explicitSpaces, coordinatedTemporalSpaceIds).filter(
		(spaceId) => !directlyTemporalSpaceIds.includes(spaceId),
	);
}

export function expandCoordinatedTemporalPropertySpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	selectedSpaceIds: readonly string[],
): string[] {
	const occurrences = findExplicitSpaceOccurrences(message, explicitSpaces).sort(
		(left, right) => left.range.start - right.range.start,
	);
	const selectedIds = new Set(selectedSpaceIds);
	const propertySource = HOME_STATE_PATTERN.source;
	const coordinatedPropertyConnector = new RegExp(String.raw`^\s*(?:${propertySource})\s*,?\s+(?:and|or)\s+$`, 'u');
	const trailingTemporalProperty = new RegExp(
		String.raw`^\s*(?:${propertySource})\b[^?!,.;]*${TEMPORAL_HISTORY_PATTERN.source}`,
		'u',
	);

	for (let index = occurrences.length - 2; index >= 0; index -= 1) {
		const left = occurrences[index];
		const right = occurrences[index + 1];
		if (!selectedIds.has(right.space.id)) continue;
		if (!coordinatedPropertyConnector.test(message.slice(left.range.end, right.range.start))) continue;
		if (!trailingTemporalProperty.test(message.slice(right.range.end))) continue;

		selectedIds.add(left.space.id);
	}

	return explicitSpaces.filter((space) => selectedIds.has(space.id)).map((space) => space.id);
}

export function resolveConjoinedEnergySpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): string[] {
	const energyClauses = getMessageEnergyReadClauses(message, explicitSpaces);
	const directlyEnergySpaceIds = explicitSpaces
		.filter((space) => energyClauses.some((clause) => hasExplicitSpaceOccurrence(clause, space, explicitSpaces)))
		.map((space) => space.id);

	return expandConjoinedSpaceIds(message, explicitSpaces, directlyEnergySpaceIds);
}

export function expandConjoinedSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	selectedSpaceIds: readonly string[],
): string[] {
	const occurrences = findExplicitSpaceOccurrences(message, explicitSpaces).sort(
		(left, right) => left.range.start - right.range.start,
	);
	const selectedIds = new Set(selectedSpaceIds);
	let changed = true;

	while (changed) {
		changed = false;

		for (let index = 0; index < occurrences.length - 1; index += 1) {
			const left = occurrences[index];
			const right = occurrences[index + 1];
			const connector = message.slice(left.range.end, right.range.start);

			if (!/^\s*(?:,\s*|,?\s+(?:and|or)\s+)$/u.test(connector)) continue;
			if (selectedIds.has(left.space.id) === selectedIds.has(right.space.id)) continue;

			selectedIds.add(left.space.id);
			selectedIds.add(right.space.id);
			changed = true;
		}
	}

	return explicitSpaces.filter((space) => selectedIds.has(space.id)).map((space) => space.id);
}

export function resolveTemporalExplicitSpaceIds(
	clauses: readonly string[],
	explicitSpaces: readonly BuddyContextSpaceReference[],
	temporalPattern: RegExp,
): string[] {
	const spaceIds: string[] = [];

	for (const clause of clauses) {
		const clauseOccurrences = findExplicitSpaceOccurrences(clause, explicitSpaces);
		const clauseSpaces = explicitSpaces
			.map((space) => ({
				space,
				ranges: clauseOccurrences
					.filter((occurrence) => occurrence.space.id === space.id)
					.map((occurrence) => occurrence.range),
			}))
			.filter(({ ranges }) => ranges.length > 0);

		if (!CURRENT_STATE_PATTERN.test(clause) || !hasHistorySignalInClause(clause) || clauseSpaces.length <= 1) {
			spaceIds.push(...clauseSpaces.map(({ space }) => space.id));
			continue;
		}

		const globalFlags = temporalPattern.flags.includes('g') ? temporalPattern.flags : `${temporalPattern.flags}g`;
		const matches = clause.matchAll(new RegExp(temporalPattern.source, globalFlags));

		for (const match of matches) {
			const start = match.index;
			const temporalCenter = start + match[0].length / 2;
			const spaceRanges = clauseSpaces.flatMap(({ space, ranges }) => ranges.map((range) => ({ space, range })));
			const precedingSpace = spaceRanges
				.filter(({ range }) => range.end <= start)
				.sort((left, right) => right.range.end - left.range.end)[0]?.space;
			const nearestSpace = spaceRanges
				.map(({ space, range }) => ({
					space,
					distance: Math.abs((range.start + range.end) / 2 - temporalCenter),
				}))
				.sort((left, right) => left.distance - right.distance)[0]?.space;

			const selectedSpace = precedingSpace ?? nearestSpace;

			if (selectedSpace) spaceIds.push(selectedSpace.id);
		}
	}

	return [...new Set(spaceIds)];
}
