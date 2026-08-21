import { BuddyContextEntityReference, BuddyContextSpaceReference } from '../../models/context-plan.model';

import {
	ACTION_COMMAND_PATTERN,
	ACTION_COMMAND_PREFIX_PATTERN_SOURCE,
	ACTION_SIGNAL_PATTERN_SOURCE,
	CONDITION_PATTERN,
	CONTEXTUAL_SCOPE_REFERENCE_PATTERN,
	DEVICE_ACTION_TARGET_PATTERN,
	ENERGY_PATTERN,
	HOME_ENTITY_PATTERN,
	HOME_STATE_PATTERN,
	LOCALIZED_REFERENCE_PRONOUN_PATTERN,
	LOCALIZED_STATE_REFERENCE_PRONOUN_PATTERN,
	PLURAL_REFERENCE_PRONOUN_PATTERN,
	PRONOUN_PATTERN,
	RELATIVE_REFERENCE_PRONOUN_PATTERN,
	SCENE_TARGET_PATTERN,
	SECURITY_PATTERN,
	SINGULAR_REFERENCE_PRONOUN_PATTERN,
	TEMPORAL_THIS_REFERENCE_PATTERN,
	TRAILING_ACTION_PREFIX_PATTERN_SOURCE,
	WEATHER_PATTERN,
} from './buddy-context-planner-grammar';

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
	return message.replace(RELATIVE_REFERENCE_PRONOUN_PATTERN, ' ').replace(TEMPORAL_THIS_REFERENCE_PATTERN, ' ');
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

	return normalizedShutRequest.replace(binaryStateCommandPattern, (_match, prefix: string, action: string) => {
		return `${prefix}turn ${action === 'enable' ? 'on' : 'off'}`;
	});
}
