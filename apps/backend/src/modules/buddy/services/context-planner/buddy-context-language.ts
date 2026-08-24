import { BuddyContextEntityReference, BuddyContextSpaceReference } from '../../models/context-plan.model';

import {
	ACTION_COMMAND_PATTERN,
	ACTION_COMMAND_PREFIX_PATTERN_SOURCE,
	ACTION_SIGNAL_PATTERN_SOURCE,
	AGGREGATE_DEVICE_CATEGORY_PATTERN_SOURCE,
	COMPOUND_CONNECTOR_PATTERN_SOURCE,
	CONDITION_PATTERN,
	CONTEXTUAL_SCOPE_REFERENCE_PATTERN,
	DEVICE_ACTION_TARGET_PATTERN,
	ENERGY_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_STATE_PATTERN,
	LEADING_CONDITION_PATTERN,
	LOCALIZED_REFERENCE_PRONOUN_PATTERN,
	LOCALIZED_STATE_REFERENCE_PRONOUN_PATTERN,
	PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN,
	PLURAL_REFERENCE_PRONOUN_PATTERN,
	PREDICATE_QUESTION_PATTERN,
	PRONOUN_PATTERN,
	READ_PATTERN,
	RELATIVE_REFERENCE_ANTECEDENT_PATTERN,
	RELATIVE_REFERENCE_PRONOUN_PATTERN,
	SCENE_TARGET_PATTERN,
	SECURITY_PATTERN,
	SINGULAR_REFERENCE_PRONOUN_PATTERN,
	TEMPORAL_THIS_REFERENCE_PATTERN,
	TRAILING_ACTION_PREFIX_PATTERN_SOURCE,
	WEATHER_PATTERN,
} from './buddy-context-planner-grammar';

const CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE = String.raw`(?:am|are(?:n't)?|can(?:not|'t)?|could(?:n't)?|did(?:n't)?|do|does|don't|doesn't|had(?:n't)?|has(?:n't)?|have(?:n't)?|is(?:n't)?|may|might(?:n't)?|must(?:n't)?|should(?:n't)?|was(?:n't)?|were(?:n't)?|will|won't|would(?:n't)?)`;
const CONDITIONAL_OUTCOME_PREDICATE_PATTERN_SOURCE = String.raw`(?:appears?|changes?|fails?|happens?|improves?|looks?|remains?|seems?|stays?|wakes?|works?)`;
const CONDITIONAL_OUTCOME_PREDICATE_ADJUNCT_PATTERN_SOURCE = String.raw`(?:again|altogether|now|once|still|today|tonight|[\p{Letter}'’-]+ly)`;
const CONDITIONAL_OUTCOME_PHRASAL_PREDICATE_PATTERN_SOURCE = String.raw`(?:becomes?|keeps?|starts?|stops?)\s+(?:(?:being|far|much|on|quite|really|to|very)\s+)?[\p{Letter}\p{Number}'’-]+(?:\s+${CONDITIONAL_OUTCOME_PREDICATE_ADJUNCT_PATTERN_SOURCE})?`;
const CONDITIONAL_OUTCOME_TRANSITIVE_ACTION_GERUND_PATTERN_SOURCE = String.raw`(?:activating|adjusting|brightening|changing|closing|deactivating|decreasing|disabling|dimming|enabling|increasing|locking|lowering|making|opening|raising|setting|switching|triggering|turning|unlocking)`;
const CONDITIONAL_OUTCOME_SUBJECT_TOKEN_PATTERN_SOURCE = String.raw`(?!to\b)[\p{Letter}\p{Number}'’-]+`;
const CONDITIONAL_OUTCOME_BARE_SUBJECT_COMMAND_PATTERN_SOURCE = String.raw`(?:${ACTION_SIGNAL_PATTERN_SOURCE}|ask|get|have|help|let|tell)`;
const CONDITIONAL_OUTCOME_SUBJECT_PREFIX_EXCLUSION_PATTERN_SOURCE = String.raw`(?!(?:as|because|so|that|to|where|which|who|whose)\b|${CONDITION_PATTERN.source}|(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)`;
const CONDITIONAL_OUTCOME_DETERMINED_SUBJECT_PATTERN_SOURCE = String.raw`(?:a|an|her|his|its|my|our|the|their|this|these|those|your)\s+${CONDITIONAL_OUTCOME_SUBJECT_TOKEN_PATTERN_SOURCE}(?:\s+${CONDITIONAL_OUTCOME_SUBJECT_TOKEN_PATTERN_SOURCE}){0,3}`;
const CONDITIONAL_OUTCOME_BARE_SUBJECT_PATTERN_SOURCE = String.raw`(?!(?:${CONDITIONAL_OUTCOME_BARE_SUBJECT_COMMAND_PATTERN_SOURCE})\b)${CONDITIONAL_OUTCOME_SUBJECT_TOKEN_PATTERN_SOURCE}`;
const CONDITIONAL_OUTCOME_SUBJECT_PATTERN_SOURCE = String.raw`${CONDITIONAL_OUTCOME_SUBJECT_PREFIX_EXCLUSION_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_DETERMINED_SUBJECT_PATTERN_SOURCE}|${CONDITIONAL_OUTCOME_BARE_SUBJECT_PATTERN_SOURCE}(?:\s+${CONDITIONAL_OUTCOME_SUBJECT_TOKEN_PATTERN_SOURCE})?)`;
const CONDITIONAL_OUTCOME_POST_CONNECTOR_SUBJECT_PATTERN_SOURCE = String.raw`${CONDITIONAL_OUTCOME_SUBJECT_PREFIX_EXCLUSION_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_DETERMINED_SUBJECT_PATTERN_SOURCE}|${CONDITIONAL_OUTCOME_BARE_SUBJECT_PATTERN_SOURCE})`;
const CONDITIONAL_OUTCOME_SPOKEN_SCALAR_VALUE_PATTERN_SOURCE = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?|one\s+hundred)`;
const CONDITIONAL_OUTCOME_ACTION_COMPLEMENT_PATTERN_SOURCE = String.raw`(?:active|blue|brighter|closed|cooler|dimmer|down|eco|green|higher|inactive|locked|lower|off|on|open|red|unlocked|up|warmer|white|(?:at|by|to)\s+(?:[-+]?\d+(?:\.\d+)?|(?:(?:minus|negative)\s+)?${CONDITIONAL_OUTCOME_SPOKEN_SCALAR_VALUE_PATTERN_SOURCE})\s*(?:%|celsius|degrees?|fahrenheit|k|kelvin|percent|°\s*(?:c|f))?)`;
const CONDITIONAL_OUTCOME_ACTION_TARGET_PATTERN_SOURCE = String.raw`(?:${AGGREGATE_DEVICE_CATEGORY_PATTERN_SOURCE}|${DEVICE_ACTION_TARGET_PATTERN.source}|${HOME_ENTITY_PATTERN.source}|${PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.source}|${PRONOUN_PATTERN.source}|${SCENE_TARGET_PATTERN.source})`;
const CONDITIONAL_OUTCOME_PHRASAL_QUESTION_PATTERN = new RegExp(
	String.raw`^(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b[^?]{0,120}\b${CONDITIONAL_OUTCOME_ACTION_TARGET_PATTERN_SOURCE}\b\s+(?:${CONDITIONAL_OUTCOME_ACTION_COMPLEMENT_PATTERN_SOURCE}\s+)?(?:(?:(?:and\s+)?then\s+)${CONDITIONAL_OUTCOME_POST_CONNECTOR_SUBJECT_PATTERN_SOURCE}|${CONDITIONAL_OUTCOME_SUBJECT_PATTERN_SOURCE})\s+${CONDITIONAL_OUTCOME_PHRASAL_PREDICATE_PATTERN_SOURCE}\s*\?\s*$`,
	'u',
);
const CONDITIONAL_OUTCOME_ZERO_RELATIVE_TARGET_PATTERN = new RegExp(
	String.raw`^(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b[^?]{0,120}\b${CONDITIONAL_OUTCOME_ACTION_TARGET_PATTERN_SOURCE}\b\s+(?:${CONDITIONAL_OUTCOME_ACTION_COMPLEMENT_PATTERN_SOURCE}\s+)?${CONDITIONAL_OUTCOME_SUBJECT_PATTERN_SOURCE}\s+(?:keeps?|starts?|stops?)\s+(?:(?:being|on|to)\s+)?${CONDITIONAL_OUTCOME_TRANSITIVE_ACTION_GERUND_PATTERN_SOURCE}(?:\s+${CONDITIONAL_OUTCOME_PREDICATE_ADJUNCT_PATTERN_SOURCE})?\s*\?\s*$`,
	'u',
);
const CONDITIONAL_OUTCOME_RELATIVE_ADVERB_PATTERN_SOURCE = String.raw`(?:already|currently|maybe|never|often|perhaps|still|very|[\p{Letter}'’-]+ly)`;
const CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE = String.raw`(?:(?:${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_PATTERN_SOURCE})\s+){0,2}`;
const CONDITIONAL_OUTCOME_DETERMINED_REPORT_SUBJECT_PATTERN_SOURCE = String.raw`(?:he|i|it|she|they|we|you|${CONDITIONAL_OUTCOME_DETERMINED_SUBJECT_PATTERN_SOURCE})`;
const CONDITIONAL_OUTCOME_REPORTING_PREDICATE_PATTERN_SOURCE = String.raw`${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}(?:believes?|claims?|expects?|reports?|says?|thinks?)\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}`;
const CONDITIONAL_OUTCOME_RELATIVE_PRONOUN_PATTERN = new RegExp(
	String.raw`\b(?:(?:that|which)\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}|that\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_SUBJECT_PATTERN_SOURCE})\s+${CONDITIONAL_OUTCOME_REPORTING_PREDICATE_PATTERN_SOURCE}|which\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_DETERMINED_REPORT_SUBJECT_PATTERN_SOURCE})\s+${CONDITIONAL_OUTCOME_REPORTING_PREDICATE_PATTERN_SOURCE})$`,
	'u',
);
const CONDITIONAL_OUTCOME_COORDINATED_RELATIVE_PREFIX_PATTERN = new RegExp(
	String.raw`\b(?:that|which)\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_PREDICATE_PATTERN_SOURCE}|${CONDITIONAL_OUTCOME_PHRASAL_PREDICATE_PATTERN_SOURCE})\s+(?:and|but|or)\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}$`,
	'u',
);
const CONDITIONAL_OUTCOME_WHERE_RELATIVE_PREFIX_PATTERN = new RegExp(
	String.raw`\bwhere\s+${CONDITIONAL_OUTCOME_SUBJECT_PATTERN_SOURCE}\s*$`,
	'u',
);
const CONDITIONAL_OUTCOME_WHO_PREFIX_PATTERN = new RegExp(
	String.raw`\bwho\s+(?:(?:${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_PATTERN_SOURCE})\s+){0,2}$`,
	'u',
);
const CONDITIONAL_OUTCOME_DIRECT_WHO_SUBJECT_PATTERN = new RegExp(
	String.raw`^(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b(?:(?!\b${CONDITIONAL_OUTCOME_ACTION_TARGET_PATTERN_SOURCE}\b)[^?]){0,120}\b${CONDITIONAL_OUTCOME_ACTION_TARGET_PATTERN_SOURCE}\b(?:\s+${CONDITIONAL_OUTCOME_ACTION_COMPLEMENT_PATTERN_SOURCE})?(?:\s*,?\s+(?:and\s+)?then)?\s*$`,
	'u',
);
const CONDITIONAL_OUTCOME_WH_SUBJECT_AUXILIARY_TAIL_PATTERN = new RegExp(
	String.raw`^${CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE}\s+${CONDITIONAL_OUTCOME_RELATIVE_ADVERB_SEQUENCE_PATTERN_SOURCE}(?:${CONDITIONAL_OUTCOME_PREDICATE_PATTERN_SOURCE}|${CONDITIONAL_OUTCOME_PHRASAL_PREDICATE_PATTERN_SOURCE})\s*\?\s*$`,
	'u',
);

function hasConditionalOutcomeRelativePrefix(prefix: string): boolean {
	if (CONDITIONAL_OUTCOME_RELATIVE_PRONOUN_PATTERN.test(prefix)) return true;
	if (CONDITIONAL_OUTCOME_COORDINATED_RELATIVE_PREFIX_PATTERN.test(prefix)) return true;
	if (CONDITIONAL_OUTCOME_WHERE_RELATIVE_PREFIX_PATTERN.test(prefix)) return true;

	const whoMatch = CONDITIONAL_OUTCOME_WHO_PREFIX_PATTERN.exec(prefix);
	if (!whoMatch) return false;

	return !CONDITIONAL_OUTCOME_DIRECT_WHO_SUBJECT_PATTERN.test(prefix.slice(0, whoMatch.index));
}

export function findLeadingConditionalActionIndex(
	message: string,
	actionPatternSource = ACTION_SIGNAL_PATTERN_SOURCE,
): number | undefined {
	if (!LEADING_CONDITION_PATTERN.test(message)) return undefined;

	const actionPattern = new RegExp(String.raw`\b(?:${actionPatternSource})\b`, 'gu');
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

function isConditionalOutcomeQuestion(message: string, actionIndex: number): boolean {
	if (!/\?\s*$/u.test(message)) return false;
	if (
		/\b(?:how\s+about\b[^?]*|what\s+(?:about\b[^?]*|changes?|happens?|next\b|occurs?))\s*\?\s*$/u.test(
			message.slice(actionIndex),
		)
	) {
		return true;
	}
	const actionMessage = message.slice(actionIndex);
	const subjectFirstOutcomeMatch = new RegExp(
		String.raw`\b(?:(?:a|an|my|our|the|their|this|these|those|your)\s+)?[\p{Letter}\p{Number}'’-]+(?:\s+[\p{Letter}\p{Number}'’-]+){0,3}\s+(?:(?:already|currently|still)\s+)?${CONDITIONAL_OUTCOME_PREDICATE_PATTERN_SOURCE}\s*\?\s*$`,
		'u',
	).exec(actionMessage);

	if (subjectFirstOutcomeMatch && !/\b(?:that|where|which|who)\b/u.test(subjectFirstOutcomeMatch[0])) {
		return true;
	}
	if (
		CONDITIONAL_OUTCOME_PHRASAL_QUESTION_PATTERN.test(actionMessage) &&
		!CONDITIONAL_OUTCOME_ZERO_RELATIVE_TARGET_PATTERN.test(actionMessage)
	) {
		return true;
	}
	const auxiliaryOutcomeTailPattern = new RegExp(
		String.raw`^${CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE}\s+(?:(?:a|an|my|our|the|their|this|these|those|your)\s+|(?:he|i|it|she|they|we|you)\s+|[\p{Letter}][\p{Letter}'’-]*\s+)[^?]*\?\s*$`,
		'u',
	);
	const auxiliaryOutcomeMatch = [
		...actionMessage.matchAll(new RegExp(String.raw`\b${CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE}\b`, 'gu')),
	].find(
		(match) =>
			!hasConditionalOutcomeRelativePrefix(actionMessage.slice(0, match.index)) &&
			(auxiliaryOutcomeTailPattern.test(actionMessage.slice(match.index)) ||
				CONDITIONAL_OUTCOME_WH_SUBJECT_AUXILIARY_TAIL_PATTERN.test(actionMessage.slice(match.index))),
	);

	if (auxiliaryOutcomeMatch) return true;
	const trailingBoundary = message.slice(actionIndex).search(/[,;]/u);

	if (LEADING_CONDITION_PATTERN.test(message) && trailingBoundary >= 0) {
		const mainClause = message.slice(actionIndex + trailingBoundary + 1).trim();

		if (
			READ_PATTERN.test(mainClause) ||
			PREDICATE_QUESTION_PATTERN.test(mainClause) ||
			(/\?\s*$/u.test(mainClause) && !ACTION_COMMAND_PATTERN.test(mainClause))
		) {
			return true;
		}
	}

	const prefix = message.slice(0, actionIndex);
	const clauseBoundary = Math.max(prefix.lastIndexOf(','), prefix.lastIndexOf(';'));
	const outcomePattern = new RegExp(
		String.raw`^(?:(?:how|what|when|where|which|who|why)\b(?:\s+\p{Letter}+){0,2}\s+)?${CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE}\s+(?!you\b)`,
		'u',
	);

	if (clauseBoundary >= 0) return outcomePattern.test(prefix.slice(clauseBoundary + 1).trim());

	const unpunctuatedModalPattern = new RegExp(
		String.raw`(?:(?:how|what|when|where|which|who|why)\b(?:\s+\p{Letter}+){0,2}\s+)?${CONDITIONAL_OUTCOME_AUXILIARY_PATTERN_SOURCE}\s+(?!you\b)`,
		'gu',
	);
	const modalMatch = [...prefix.matchAll(unpunctuatedModalPattern)].at(-1);
	if (!modalMatch) return false;

	return !new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').test(prefix.slice(modalMatch.index));
}

export function splitConditionSegments(clause: string): string[] {
	const conditionMarkers = [...clause.matchAll(/\b(?:if|when|while)\b/gu)].filter((marker) => marker.index > 0);
	if (conditionMarkers.length === 0) return [clause.trim()].filter((segment) => segment.length > 0);

	const segments: string[] = [];
	let segmentStart = 0;
	for (const marker of conditionMarkers) {
		segments.push(clause.slice(segmentStart, marker.index).trim());
		segmentStart = marker.index + marker[0].length;
	}
	segments.push(clause.slice(segmentStart).trim());

	return segments.filter((segment) => segment.length > 0);
}

export function getRetrievalClause(clause: string): string {
	if (!ACTION_COMMAND_PATTERN.test(clause)) return clause;

	const condition = CONDITION_PATTERN.exec(clause);

	return condition ? clause.slice(condition.index) : '';
}

export function findPatternRanges(message: string, pattern: RegExp): Array<{ start: number; end: number }> {
	const globalFlags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;

	return [...message.matchAll(new RegExp(pattern.source, globalFlags))].map((match) => ({
		start: match.index,
		end: match.index + match[0].length,
	}));
}

export function getActionTargetClause(clause: string): string {
	const conditionIndex = findActionConditionIndex(clause);

	return conditionIndex === undefined ? clause : clause.slice(0, conditionIndex);
}

export function hasImmediateActionCondition(clause: string): boolean {
	const action = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(clause);
	const conditionIndex = findActionConditionIndex(clause);
	if (!action || conditionIndex === undefined) return false;

	return (
		clause
			.slice(action.index + action[0].length, conditionIndex)
			.replace(/\b(?:a|an|please|the)\b/gu, ' ')
			.trim().length === 0
	);
}

export function getActionConditionClause(clause: string): string | undefined {
	const conditionIndex = findActionConditionIndex(clause);

	return conditionIndex === undefined ? undefined : clause.slice(conditionIndex);
}

export function findActionConditionIndex(clause: string): number | undefined {
	const action = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(clause);
	if (!action) return undefined;

	const conditionPattern = new RegExp(CONDITION_PATTERN.source, 'gu');
	for (const condition of clause.matchAll(conditionPattern)) {
		if (condition.index <= action.index) continue;
		if (condition[0] === 'once' && /\bat\s*$/u.test(clause.slice(0, condition.index))) continue;

		if (!isActionEntityTitleCondition(clause, action.index + action[0].length, condition)) return condition.index;
	}

	return undefined;
}

export function getActionTemporalClause(clause: string): string {
	const action = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(clause);
	if (!action) return clause;
	const actionEnd = action.index + action[0].length;
	const targetNoun = [
		...clause
			.slice(actionEnd)
			.matchAll(
				new RegExp(String.raw`\b(?:${DEVICE_ACTION_TARGET_PATTERN.source}|${SCENE_TARGET_PATTERN.source})\b`, 'gu'),
			),
	].find((match) => !isInsideDoubleQuotes(clause, actionEnd + match.index));
	if (targetNoun) {
		const targetEnd = actionEnd + targetNoun.index + targetNoun[0].length;
		const conditionsBeforeTarget = [
			...clause.slice(0, targetEnd).matchAll(new RegExp(CONDITION_PATTERN.source, 'gu')),
		].filter((condition) => condition.index > action.index);

		if (conditionsBeforeTarget.every((condition) => isActionEntityTitleCondition(clause, actionEnd, condition))) {
			return `${clause.slice(0, actionEnd)} ${clause.slice(targetEnd)}`;
		}
	}

	const conditionPattern = new RegExp(CONDITION_PATTERN.source, 'gu');
	const titleConditions = [...clause.matchAll(conditionPattern)].filter(
		(condition) =>
			condition.index > action.index &&
			isActionEntityTitleCondition(clause, action.index + action[0].length, condition),
	);

	return titleConditions
		.reverse()
		.reduce(
			(result, condition) =>
				`${result.slice(0, condition.index)} ${result.slice(condition.index + condition[0].length)}`,
			clause,
		);
}

export function isActionEntityTitleCondition(clause: string, actionEnd: number, condition: RegExpMatchArray): boolean {
	const rawBeforeCondition = clause.slice(actionEnd, condition.index);
	const beforeCondition = rawBeforeCondition
		.replace(/\b(?:a|an|please|the)\b/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
	const afterCondition = clause.slice(condition.index + condition[0].length);
	if (isInsideDoubleQuotes(clause, condition.index)) return true;
	if (!/^(?:after|before|once|until)$/u.test(condition[0])) return false;
	const hasLeadingTitleArticle = /\b(?:a|an|the)\s*$/u.test(rawBeforeCondition);
	const conditionStartsPredicate = /^\s*(?:a|an|the)\b/u.test(afterCondition);

	return (
		beforeCondition.length === 0 &&
		(hasLeadingTitleArticle || !conditionStartsPredicate) &&
		(DEVICE_ACTION_TARGET_PATTERN.test(afterCondition) || SCENE_TARGET_PATTERN.test(afterCondition))
	);
}

export function isInsideDoubleQuotes(value: string, index: number): boolean {
	return (value.slice(0, index).match(/"/gu)?.length ?? 0) % 2 === 1;
}

export function getActionObjectClause(clause: string): string {
	const targetClause = getActionTargetClause(clause);
	const action = new RegExp(String.raw`\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`, 'u').exec(targetClause);

	return action ? targetClause.slice(action.index + action[0].length) : targetClause;
}

export function findExplicitSpaces(
	message: string,
	knownSpaces: readonly BuddyContextSpaceReference[],
): BuddyContextSpaceReference[] {
	const spaces = new Map<string, BuddyContextSpaceReference>();

	for (const occurrence of findExplicitSpaceOccurrences(message, knownSpaces)) {
		spaces.set(occurrence.space.id, occurrence.space);
	}

	return [...spaces.values()];
}

export function findExcludedOnlyExplicitSpaceIds(
	message: string,
	spaces: readonly BuddyContextSpaceReference[],
): Set<string> {
	const occurrences = findExplicitSpaceOccurrences(message, spaces);
	const distinctRanges = [
		...new Map(
			occurrences.map((occurrence) => [`${occurrence.range.start}:${occurrence.range.end}`, occurrence.range]),
		).values(),
	].sort((left, right) => left.start - right.start);
	const excludedRanges = new Set<string>();
	const excludedOnlyIds = new Set<string>();

	for (const [index, range] of distinctRanges.entries()) {
		const previousRange = distinctRanges[index - 1];
		const followsExcludedRange =
			previousRange !== undefined &&
			excludedRanges.has(`${previousRange.start}:${previousRange.end}`) &&
			/^\s*(?:,\s*)?(?:(?:and|or)\s+)?(?:(?:in|the)\s+)*$/u.test(message.slice(previousRange.end, range.start));

		if (isExcludedExplicitSpaceOccurrence(message, range.start) || followsExcludedRange) {
			excludedRanges.add(`${range.start}:${range.end}`);
		}
	}

	for (const space of spaces) {
		const spaceOccurrences = occurrences.filter((occurrence) => occurrence.space.id === space.id);

		if (
			spaceOccurrences.length > 0 &&
			spaceOccurrences.every((occurrence) => excludedRanges.has(`${occurrence.range.start}:${occurrence.range.end}`))
		) {
			excludedOnlyIds.add(space.id);
		}
	}

	return excludedOnlyIds;
}

export function isExcludedExplicitSpaceOccurrence(message: string, occurrenceStart: number): boolean {
	const precedingClause =
		message
			.slice(0, occurrenceStart)
			.split(/[?!,.;]/u)
			.at(-1) ?? '';

	return /\b(?:apart from|but not|but|except|excluding|krome|other than|save for|save|with(?: the)? exception of|without)\s+(?:(?:in|the)\s+)*$/u.test(
		precedingClause,
	);
}

export function findDuplicateNameSpaceIds(spaces: readonly BuddyContextSpaceReference[]): Set<string> {
	const spacesByName = new Map<string, BuddyContextSpaceReference[]>();

	for (const space of spaces) {
		const name = getNormalizedPhraseTokens(normalize(space.name)).join(' ');

		spacesByName.set(name, [...(spacesByName.get(name) ?? []), space]);
	}

	return new Set(
		[...spacesByName.values()]
			.filter((sameNameSpaces) => sameNameSpaces.length > 1)
			.flatMap((sameNameSpaces) => sameNameSpaces.map((space) => space.id)),
	);
}

export function findExplicitSpaceOccurrences(
	message: string,
	spaces: readonly BuddyContextSpaceReference[],
): Array<{ space: BuddyContextSpaceReference; range: { start: number; end: number } }> {
	const occurrences = spaces.flatMap((space) => {
		const name = normalize(space.name);

		return getNormalizedSpaceNameVariants(name).flatMap((variant) =>
			findNormalizedPhraseRanges(message, variant).map((range) => ({ space, name, range })),
		);
	});
	const unambiguousOccurrences = occurrences.filter(
		(occurrence) =>
			explicitSpaceOccurrenceScore(message, occurrence.range) > 0 || !isDomainSignalSpaceName(occurrence.name),
	);

	return unambiguousOccurrences
		.filter(
			(occurrence) =>
				!unambiguousOccurrences.some(
					(other) =>
						other.name.length > occurrence.name.length &&
						other.range.start <= occurrence.range.start &&
						other.range.end >= occurrence.range.end,
				),
		)
		.map(({ space, range }) => ({ space, range }));
}

export function isDomainSignalSpaceName(name: string): boolean {
	return [WEATHER_PATTERN, ENERGY_PATTERN, SECURITY_PATTERN].some((pattern) =>
		new RegExp(String.raw`^(?:${pattern.source})$`, 'u').test(name),
	);
}

export function getNormalizedSpaceNameVariants(name: string): string[] {
	return name.endsWith('ice') ? [name, `${name.slice(0, -1)}i`] : [name];
}

export function hasExplicitSpaceOccurrence(
	message: string,
	space: BuddyContextSpaceReference,
	spaces: readonly BuddyContextSpaceReference[],
): boolean {
	return findExplicitSpaceOccurrences(message, spaces).some((occurrence) => occurrence.space.id === space.id);
}

export function containsNormalizedPhrase(message: string, phrase: string): boolean {
	return findNormalizedPhraseRanges(message, phrase).length > 0;
}

export function removeNormalizedPhrase(message: string, phrase: string): string {
	return findNormalizedPhraseRanges(message, phrase)
		.reverse()
		.reduce((result, range) => `${result.slice(0, range.start)} ${result.slice(range.end)}`, message);
}

export function removeExplicitSpaceOccurrencesForDomain(
	message: string,
	spaces: readonly BuddyContextSpaceReference[],
): string {
	const rangesByName = new Map<string, Array<{ start: number; end: number }>>();

	for (const occurrence of findExplicitSpaceOccurrences(message, spaces)) {
		const name = normalize(occurrence.space.name);
		const ranges = rangesByName.get(name) ?? [];

		if (!ranges.some((range) => range.start === occurrence.range.start && range.end === occurrence.range.end)) {
			ranges.push(occurrence.range);
			rangesByName.set(name, ranges);
		}
	}

	const rangesToRemove = [...rangesByName.values()].flatMap((ranges) => {
		const syntacticRanges = ranges.filter((range) => explicitSpaceOccurrenceScore(message, range) > 0);

		if (syntacticRanges.length > 0) return syntacticRanges;

		return [
			[...ranges].sort((left, right) => {
				const leftScore = explicitSpaceOccurrenceScore(message, left);
				const rightScore = explicitSpaceOccurrenceScore(message, right);

				return rightScore - leftScore || right.start - left.start;
			})[0],
		];
	});

	return rangesToRemove
		.sort((left, right) => right.start - left.start)
		.reduce((result, range) => `${result.slice(0, range.start)} ${result.slice(range.end)}`, message);
}

export function explicitSpaceOccurrenceScore(message: string, range: { start: number; end: number }): number {
	const prefix = message.slice(0, range.start);
	const suffix = message.slice(range.end);

	if (/\b(?:at|did|does|for|from|in|inside|of|was|were)\s+(?:the\s+)?$/u.test(prefix)) return 2;
	if (new RegExp(String.raw`^\s*(?:${HOME_ENTITY_PATTERN.source}|${HOME_STATE_PATTERN.source})`, 'u').test(suffix)) {
		return 1;
	}

	return 0;
}

export function findNormalizedPhraseRanges(message: string, phrase: string): Array<{ start: number; end: number }> {
	if (phrase.length === 0) return [];

	const ranges: Array<{ start: number; end: number }> = [];
	const searchableTokens = getNormalizedPhraseTokens(phrase);
	if (searchableTokens.length === 0) return [];
	const flexiblePhrase = searchableTokens
		.map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
		.join(String.raw`[\s\p{Dash_Punctuation}'’]+`);
	const phrasePattern = new RegExp(flexiblePhrase, 'gu');

	for (const match of message.matchAll(phrasePattern)) {
		const index = match.index;
		const before = index === 0 ? '' : message[index - 1];
		const afterIndex = index + match[0].length;
		const after = afterIndex >= message.length ? '' : message[afterIndex];

		if (!/[\p{Letter}\p{Number}]/u.test(before) && !/[\p{Letter}\p{Number}]/u.test(after)) {
			ranges.push({ start: index, end: afterIndex });
		}
	}

	return ranges;
}

export function getNormalizedPhraseTokens(phrase: string): string[] {
	return phrase.split(/[^\p{Letter}\p{Number}]+/u).filter((token) => token.length > 0);
}

export function resolveRecentReferences(
	message: string,
	references: readonly BuddyContextEntityReference[],
): BuddyContextEntityReference[] {
	if (!hasReferencePronoun(stripContextualScopeReferences(message))) return [];

	const unique = new Map<string, BuddyContextEntityReference>();

	for (const reference of references) unique.set(reference.id, reference);

	return [...unique.values()];
}

export function stripContextualScopeReferences(message: string): string {
	return message.replace(CONTEXTUAL_SCOPE_REFERENCE_PATTERN, ' ');
}

export function hasReferencePronoun(message: string): boolean {
	const referenceMessage = stripRelativeReferencePronouns(message);

	return (
		PRONOUN_PATTERN.test(referenceMessage) ||
		LOCALIZED_REFERENCE_PRONOUN_PATTERN.test(referenceMessage) ||
		LOCALIZED_STATE_REFERENCE_PRONOUN_PATTERN.test(referenceMessage)
	);
}

export function hasSingularReferencePronoun(message: string): boolean {
	const referenceMessage = stripRelativeReferencePronouns(message);

	return (
		SINGULAR_REFERENCE_PRONOUN_PATTERN.test(referenceMessage) ||
		LOCALIZED_REFERENCE_PRONOUN_PATTERN.test(referenceMessage) ||
		LOCALIZED_STATE_REFERENCE_PRONOUN_PATTERN.test(referenceMessage)
	);
}

export function hasPluralReferencePronoun(message: string): boolean {
	return PLURAL_REFERENCE_PRONOUN_PATTERN.test(stripRelativeReferencePronouns(message));
}

export function stripRelativeReferencePronouns(message: string): string {
	return message
		.replace(RELATIVE_REFERENCE_PRONOUN_PATTERN, (match: string, offset: number) => {
			const prefix = message.slice(0, offset).trimEnd();

			return RELATIVE_REFERENCE_ANTECEDENT_PATTERN.test(prefix) ? ' ' : match;
		})
		.replace(TEMPORAL_THIS_REFERENCE_PATTERN, ' ');
}

export function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{Mark}/gu, '')
		.replace(/[‘’]/gu, "'")
		.toLocaleLowerCase('en-US')
		.trim();
}

export function normalizeGerundActionRequest(message: string): string {
	const gerundActions: Readonly<Record<string, string>> = {
		activating: 'activate',
		adjusting: 'adjust',
		brightening: 'brighten',
		changing: 'change',
		closing: 'close',
		deactivating: 'deactivate',
		decreasing: 'decrease',
		disabling: 'disable',
		dimming: 'dim',
		enabling: 'enable',
		increasing: 'increase',
		locking: 'lock',
		lowering: 'lower',
		making: 'make',
		opening: 'open',
		raising: 'raise',
		running: 'run',
		setting: 'set',
		starting: 'start',
		stopping: 'stop',
		switching: 'switch',
		triggering: 'trigger',
		turning: 'turn',
		unlocking: 'unlock',
	};
	const gerundPattern = Object.keys(gerundActions).join('|');
	const politeGerundRequest = new RegExp(
		String.raw`\b(?:(would you)\s+mind|((?:can|could|will|would) you)(?:\s+please)?\s+try)\s+(${gerundPattern})\b`,
		'gu',
	);

	const normalizedGerundRequest = message.replace(
		politeGerundRequest,
		(_match, mindPrefix, tryPrefix, gerund: string) => {
			return `${mindPrefix ?? tryPrefix} ${gerundActions[gerund]}`;
		},
	);
	const shutCommandPattern =
		/(^[?!,.;\s]*(?:(?:can|could|may|might|will|would) you\s+(?:please\s+)?)?|(?:[?!,.;]|\b(?:and|then)\b)\s*)shut\s+(?:down|off)\b/gu;

	const normalizedShutRequest = normalizedGerundRequest.replace(shutCommandPattern, '$1turn off');
	const binaryStateCommandPattern = new RegExp(
		String.raw`(${ACTION_COMMAND_PREFIX_PATTERN_SOURCE}|${TRAILING_ACTION_PREFIX_PATTERN_SOURCE})(enable|disable)\b`,
		'gu',
	);
	const binaryLabelConnectorPatternSource = String.raw`(?:or|${COMPOUND_CONNECTOR_PATTERN_SOURCE})`;
	const binaryTargetTokenPatternSource = String.raw`[\p{Letter}\p{Number}'’-]+`;
	const binaryDeviceTargetPatternSource = String.raw`(?:(?:my|our|the|your)\s+(?:${binaryTargetTokenPatternSource}\s+){0,7}|(?:${binaryTargetTokenPatternSource}\s+){1,7})${DEVICE_ACTION_TARGET_PATTERN.source}`;
	const binaryRelativeTargetPattern = new RegExp(
		String.raw`^\s+(?:(?:${binaryTargetTokenPatternSource}\s+){0,7}${DEVICE_ACTION_TARGET_PATTERN.source}|(?:(?:my|our|the|your)\s+)?${PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.source})\s+(?:that|which)\b`,
		'u',
	);
	const binaryStateTargetPattern = new RegExp(
		String.raw`^\s+(?:${binaryDeviceTargetPatternSource}|(?:(?:my|our|the|your)\s+)?${PLAUSIBLE_CUSTOM_HOME_TARGET_PATTERN.source})`,
		'u',
	);
	const leadingConditionalActionIndex = findLeadingConditionalActionIndex(
		normalizedShutRequest,
		String.raw`${ACTION_SIGNAL_PATTERN_SOURCE}|enable|disable`,
	);
	const normalizeBinaryStateCommands = (value: string): string =>
		value.replace(binaryStateCommandPattern, (match, prefix: string, action: string, offset: number) => {
			const actionTail = value.slice(offset + match.length);
			const coordinatedActionMatch = /^\s*(?:(?:,\s*)?(?:and\s+)?then|and)\s+(?:disable|enable)\b/u.exec(actionTail);
			const hasCoordinatedBinaryAction =
				coordinatedActionMatch !== null &&
				(/then\b/u.test(coordinatedActionMatch[0]) ||
					binaryStateTargetPattern.test(actionTail.slice(coordinatedActionMatch[0].length)));
			const hasDirectBinaryTarget = binaryStateTargetPattern.test(actionTail);
			const hasRelativeBinaryTarget = binaryRelativeTargetPattern.test(actionTail);

			if (/\ba\s*$/u.test(prefix)) return match;
			if (
				!hasRelativeBinaryTarget &&
				/^\s+(?:[\p{Letter}\p{Number}'’-]+\s+){1,4}(?:appear|appears|are|is|look|looks|remain|remains|seem|seems|stay|stays|was|were)\b/u.test(
					actionTail,
				)
			) {
				return match;
			}
			if (
				new RegExp(
					String.raw`^\s+([\p{Letter}\p{Number}-]+)\s+${binaryLabelConnectorPatternSource}\s+(?:disable|enable)\s+\1\b`,
					'u',
				).test(value.slice(offset + match.length))
			) {
				return match;
			}
			if (
				!hasCoordinatedBinaryAction &&
				new RegExp(String.raw`^\s*(?:[?!,.;]|${binaryLabelConnectorPatternSource}\b|$)`, 'u').test(actionTail)
			) {
				return match;
			}
			if (
				!hasDirectBinaryTarget &&
				new RegExp(String.raw`\b${binaryLabelConnectorPatternSource}\b`, 'u').test(prefix) &&
				/\b(?:disable|enable)\s*$/u.test(value.slice(0, offset))
			) {
				return match;
			}

			return `${prefix}turn ${action === 'enable' ? 'on' : 'off'}`;
		});
	const normalizedConditionalRequest =
		leadingConditionalActionIndex === undefined
			? normalizedShutRequest
			: `${normalizedShutRequest.slice(0, leadingConditionalActionIndex)}${normalizeBinaryStateCommands(
					normalizedShutRequest.slice(leadingConditionalActionIndex),
				)}`;

	return normalizeBinaryStateCommands(normalizedConditionalRequest);
}
