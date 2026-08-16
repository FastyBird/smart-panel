import { Injectable } from '@nestjs/common';

import {
	BuddyContextActionType,
	BuddyContextAmbiguityRisk,
	BuddyContextDomain,
	BuddyContextEntityReference,
	BuddyContextIntent,
	BuddyContextPlan,
	BuddyContextPlannerInput,
	BuddyContextQueryPlan,
	BuddyContextSpaceReference,
	BuddyContextStrategy,
} from '../models/context-plan.model';

import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';

const CONTROL_DEVICE_TOOL_NAME = 'control_device';
const RUN_SCENE_TOOL_NAME = 'run_scene';
const SET_SPACE_LIGHTING_TOOL_NAME = 'set_space_lighting';

const DOMAIN_ORDER: readonly BuddyContextDomain[] = ['general', 'home', 'weather', 'energy', 'security', 'history'];
const WEATHER_PATTERN =
	/\b(?:cloud|cloudy|fog|foggy|forecast|outside|rain|raining|snow|storm|stormy|sun|sunny|thunder|weather|wind)\b/u;
const ENERGY_PATTERN = /\b(?:consumption|energy|kwh|power|production|usage)\b/u;
const SECURITY_PATTERN = /\b(?:alarm|armed|intrusion|secure|security)\b/u;
const HISTORY_PATTERN =
	/\b(?:chart|graph|history|historical|past|trend|yesterday)\b|\b(?:earlier today|last (?:month|night|week|year))\b|\b(?:for|over)\s+\d+\s+(?:hours?|days?)\b|\b\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b|\b\d{4}-\d{2}-\d{2}\b/u;
const CURRENT_STATE_PATTERN = /\b(?:at present|currently|now|right now)\b/u;
const HOME_ENTITY_PATTERN =
	/\b(?:air|blind|blinds|device|door|doors|fan|garage|lamp|light|lighting|lights|room|scene|sensor|switch|thermostat|window|windows)\b/u;
const HOME_STATE_PATTERN = /\b(?:cold|cooling|heating|humidity|temperature|warm)\b/u;
const READ_PATTERN =
	/^(?:are|can you (?:check|fetch|get|report|show|tell)|check|fetch|find|get|how (?:many|much)|is|list|report|search|show|what|which|will)\b/u;
const PREDICATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|do|does|had|has|have|is|may|might|will|would|was|were|(?:how|what|when|where|which|who|why)['’]s|(?:what|why) (?:are|did|do|does|had|has|have|is|was|were))\b/u;
const ACTION_REQUEST_PATTERN =
	/^(?:(?:can|could|may|might|will|would) you\b|are you able to\b|is it possible to\b|is there any way you can\b)/u;
const MODAL_STATE_READ_PATTERN =
	/^(?:can|could|may|might|will|would) you (?:check|confirm|determine|fetch|get|read|report|show|tell|verify)(?: me)?\b.*\b(?:how|if|what|when|where|whether|which|why)\b/u;
const WRITE_PATTERN =
	/\b(?:adjust|brighten|change|close|decrease|dim|increase|lock|lower|make|open|raise|set|switch|turn|unlock)\b/u;
const TRIGGER_PATTERN = /\b(?:activate|deactivate|run|start|stop|trigger)\b/u;
const TARGET_DEPENDENT_ACTION_PATTERN = /\b(?:activate|deactivate|start|stop)\b/u;
const ACTION_COMMAND_PATTERN =
	/^[?!,.;\s]*(?:(?:and|if so|please|then)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)?(?:activate|adjust|brighten|change|close|deactivate|decrease|dim|increase|lock|lower|make|open|raise|run|set|start|stop|switch|trigger|turn|unlock)\b/u;
const CONDITION_PATTERN =
	/\b(?:after|as long as|as soon as|assuming|before|given that|if|in case|once|only if|provided|so long as|unless|until|when|whenever|while)\b/u;
const LEADING_CONDITION_PATTERN =
	/^(?:after|as long as|as soon as|assuming|before|given that|if|in case|once|only if|provided|so long as|unless|until|when|whenever|while)\b/u;
const RELATIVE_PATTERN = /\b(?:brighter|colder|cooler|darker|down|higher|hotter|less|lower|more|times as|up|warmer)\b/u;
const PRONOUN_PATTERN = /\b(?:it|one|that|them|these|this|those)\b/u;
const CAPABILITY_DISCOVERY_PATTERN = /^(?:what|which)\b.*\b(?:am i able to|can i)\b/u;
const CONTEXTUAL_SCOPE_PATTERN = /\b(?:here|in this room|this space)\b/u;
const GENERIC_ACTION_TARGET_PATTERN =
	/\b(?:a|all|an|any|the)\s+(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blind|blinds|device|devices|door|doors|fan|fans|lamp|lamps|light|lights|scene|scenes|switch|switches|thermostat|thermostats|window|windows)\b|\b(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blinds|devices|doors|fans|lamps|lights|scenes|switches|thermostats|windows)\b|^[?!,.;\s]*(?:(?:and|if so|please|then)\s+)*(?:(?:can|could|may|might|will|would) you\s+(?:please\s+)?)?(?:activate|adjust|brighten|change|close|deactivate|decrease|dim|increase|lock|lower|make|open|raise|run|set|start|stop|switch|trigger|turn|unlock)\s+(?:off\s+|on\s+)?(?:blind|device|door|fan|lamp|light|scene|switch|thermostat|window)\b/u;
const GENERIC_ACTION_TARGET_NAMES = [
	'blind',
	'blinds',
	'device',
	'devices',
	'door',
	'doors',
	'fan',
	'fans',
	'lamp',
	'lamps',
	'light',
	'lights',
	'scene',
	'scenes',
	'switch',
	'switches',
	'thermostat',
	'thermostats',
	'window',
	'windows',
] as const;
const BUILT_IN_ACTION_SPACE_NAMES = new Set([
	'bathroom',
	'bedroom',
	'downstairs',
	'garage',
	'hallway',
	'kitchen',
	'living room',
	'office',
	'upstairs',
]);
const EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN =
	/\b(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs) thermostat\b/u;
const WHOLE_HOME_SCOPE_PATTERN =
	/\b(?:entire|whole) (?:home|house)\b|\b(?:across|throughout) (?:the )?(?:home|house)\b/u;
const TRAILING_ACTION_PATTERN =
	/(?:[?!,.;]|\b(?:and|then)\b)\s*(?:(?:if so|please)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)?(?:activate|adjust|brighten|change|close|deactivate|decrease|dim|increase|lock|lower|make|open|raise|run|set|start|stop|switch|trigger|turn|unlock)\b/u;
const TRAILING_READ_PATTERN =
	/(?:[?!,.;]|\b(?:and|then)\b)\s*(?:(?:also|please)\s+)*(?:check|confirm|determine|ensure|fetch|find|get|make sure|read|report|see|show|tell(?: me)?|verify|what|whether|which)\b/u;

@Injectable()
export class BuddyContextPlannerService {
	plan(input: BuddyContextPlannerInput): BuddyContextPlan {
		const normalizedMessage = normalize(input.message);
		const recentEntityReferences = input.recentEntityReferences ?? [];
		const hasRecentReferencePronoun = PRONOUN_PATTERN.test(normalizedMessage) && recentEntityReferences.length > 0;
		const explicitSpaces = findExplicitSpaces(normalizedMessage, input.knownSpaces ?? []);
		const conversationSpaceId = resolveConversationSpaceHint(
			normalizedMessage,
			input.conversationSpaceId,
			explicitSpaces.map((space) => space.id),
		);
		const isGenericExplanation = isGeneralExplanation(normalizedMessage);
		const isPredicateQuestion = isStatePredicateQuestion(normalizedMessage);
		const isWrappedStateRead = MODAL_STATE_READ_PATTERN.test(normalizedMessage);
		const trailingActionMatch =
			isPredicateQuestion || isWrappedStateRead ? TRAILING_ACTION_PATTERN.exec(normalizedMessage) : null;
		const hasTrailingAction = trailingActionMatch !== null;
		const hasTrailingRead = TRAILING_READ_PATTERN.test(normalizedMessage);
		const actionMessage = getActionMessage(normalizedMessage, trailingActionMatch);
		const actionReferenceMessage = getActionReferenceMessage(actionMessage);
		const isReadOnlyPredicate =
			!hasTrailingAction &&
			(isPredicateQuestion ||
				isWrappedStateRead ||
				(READ_PATTERN.test(normalizedMessage) &&
					(CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage) || hasOnlyGroundedActionTokens(normalizedMessage))));
		const hasWrite =
			!isGenericExplanation &&
			!isReadOnlyPredicate &&
			ACTION_COMMAND_PATTERN.test(actionMessage) &&
			(WRITE_PATTERN.test(actionMessage) || TARGET_DEPENDENT_ACTION_PATTERN.test(actionMessage));
		const hasTrigger =
			!isGenericExplanation &&
			!isReadOnlyPredicate &&
			ACTION_COMMAND_PATTERN.test(actionMessage) &&
			TRIGGER_PATTERN.test(actionMessage);
		const hasAction = hasWrite || hasTrigger;
		const referenceActionTypes = getReferenceActionTypes(actionReferenceMessage);
		const domains = classifyDomains(
			normalizedMessage,
			hasAction || isReadOnlyPredicate,
			isGenericExplanation,
			hasRecentReferencePronoun,
		);
		const referenceMessage = hasAction ? actionReferenceMessage : domains.includes('home') ? normalizedMessage : '';
		const references = resolveRecentReferences(referenceMessage, recentEntityReferences);
		const hasRead =
			domains.some((domain) => domain !== 'general') &&
			(((!hasAction || !ACTION_REQUEST_PATTERN.test(normalizedMessage)) &&
				(READ_PATTERN.test(normalizedMessage) || isWrappedStateRead)) ||
				hasTrailingRead ||
				!hasAction);
		const requiresReadForAction =
			hasAction &&
			(CONDITION_PATTERN.test(normalizedMessage) || RELATIVE_PATTERN.test(normalizedMessage) || hasTrailingRead);
		const intent = classifyIntent(hasWrite, hasTrigger, hasRead || requiresReadForAction);
		const ambiguityRisk = classifyAmbiguityRisk(
			normalizedMessage,
			actionReferenceMessage,
			hasWrite,
			hasTrigger,
			referenceActionTypes,
			references,
			conversationSpaceId,
			explicitSpaces,
		);
		const strategy = selectStrategy(intent, ambiguityRisk, domains, input.providerCapabilities);
		const includeCurrentStateForRead = !domains.includes('history') || CURRENT_STATE_PATTERN.test(normalizedMessage);
		const scopedReferences =
			references.length !== 1 ||
			(hasAction && !isActionReferenceCompatible(references[0], hasWrite, hasTrigger, referenceActionTypes))
				? []
				: references;
		const scope = {
			...(conversationSpaceId ? { spaceId: conversationSpaceId } : {}),
			...(scopedReferences.length > 0
				? { referencedEntityIds: scopedReferences.map((reference) => reference.id) }
				: {}),
		};

		return {
			domains,
			intent,
			scope,
			queries: buildQueries(domains, hasAction, requiresReadForAction, conversationSpaceId, includeCurrentStateForRead),
			toolNames: buildToolNames(domains, hasWrite, hasTrigger, strategy, normalizedMessage),
			ambiguityRisk,
			strategy,
		};
	}
}

function getActionMessage(message: string, trailingActionMatch: RegExpExecArray | null): string {
	if (trailingActionMatch) return message.slice(trailingActionMatch.index);
	if (!LEADING_CONDITION_PATTERN.test(message)) return message;

	const conditionalActionMatch = TRAILING_ACTION_PATTERN.exec(message);

	return conditionalActionMatch ? message.slice(conditionalActionMatch.index) : message;
}

function getActionReferenceMessage(message: string): string {
	const actionOnlyMessage = message.replace(
		/^[?!,.;\s]*(?:(?:and|if so|please|then)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)/u,
		'',
	);
	const trailingCondition =
		/\b(?:after|as long as|as soon as|assuming|before|given that|if|in case|once|only if|provided|so long as|unless|until|when|whenever|while)\b/u.exec(
			actionOnlyMessage,
		);
	const trailingRead = TRAILING_READ_PATTERN.exec(actionOnlyMessage);
	const boundaryIndexes = [trailingCondition?.index, trailingRead?.index].filter(
		(index): index is number => index !== undefined,
	);

	return boundaryIndexes.length > 0 ? actionOnlyMessage.slice(0, Math.min(...boundaryIndexes)) : actionOnlyMessage;
}

function classifyDomains(
	message: string,
	hasAction: boolean,
	isGenericExplanation: boolean,
	hasRecentReferencePronoun = false,
): BuddyContextDomain[] {
	if (isGenericExplanation) return ['general'];

	const domains = new Set<BuddyContextDomain>();
	const hasWeather = WEATHER_PATTERN.test(message);
	const hasContextualHomeState =
		HOME_STATE_PATTERN.test(message) && (!hasWeather || CONTEXTUAL_SCOPE_PATTERN.test(message));

	if (HOME_ENTITY_PATTERN.test(message) || hasContextualHomeState || hasAction || hasRecentReferencePronoun) {
		domains.add('home');
	}
	if (hasWeather) domains.add('weather');
	if (ENERGY_PATTERN.test(message)) domains.add('energy');
	if (SECURITY_PATTERN.test(message)) domains.add('security');
	if (HISTORY_PATTERN.test(message)) {
		domains.add('home');
		domains.add('history');
	}

	if (domains.size === 0) domains.add('general');

	return DOMAIN_ORDER.filter((domain) => domains.has(domain));
}

function isGeneralExplanation(message: string): boolean {
	return (
		/^how (?:can|could|do|does|would)\b.*\b(?:work|works|working|i)\b/u.test(message) ||
		/^(?:explain|show me|tell me) how to\b/u.test(message) ||
		/^what (?:do|does) .+ mean\b/u.test(message) ||
		/^what (?:is|are) (?:a|an)\b/u.test(message)
	);
}

function hasOnlyGroundedActionTokens(message: string): boolean {
	const tokens = new Set(message.split(/[^\p{Letter}\p{Number}]+/u).filter((token) => token.length > 0));
	let hasActionToken = false;

	for (const token of tokens) {
		if (!WRITE_PATTERN.test(token)) continue;
		hasActionToken = true;
		if (!/^(?:close|closed|lock|locked|off|on|open|unlock|unlocked)$/u.test(token)) return false;
	}

	return hasActionToken;
}

function isStatePredicateQuestion(message: string): boolean {
	return (
		PREDICATE_QUESTION_PATTERN.test(message) &&
		(WRITE_PATTERN.test(message) || TRIGGER_PATTERN.test(message)) &&
		!ACTION_REQUEST_PATTERN.test(message)
	);
}

function classifyIntent(hasWrite: boolean, hasTrigger: boolean, hasRead: boolean): BuddyContextIntent {
	if ((hasWrite || hasTrigger) && hasRead) return 'mixed';
	if (hasWrite && hasTrigger) return 'mixed';
	if (hasWrite) return 'write';
	if (hasTrigger) return 'trigger';
	if (hasRead) return 'read';

	return 'none';
}

function classifyAmbiguityRisk(
	message: string,
	actionReferenceMessage: string,
	hasWrite: boolean,
	hasTrigger: boolean,
	requestedActionTypes: readonly BuddyContextActionType[],
	references: readonly BuddyContextEntityReference[],
	conversationSpaceId?: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): BuddyContextAmbiguityRisk {
	const isAction = hasWrite || hasTrigger;

	if (isAction) {
		if (
			PRONOUN_PATTERN.test(actionReferenceMessage) &&
			(references.length !== 1 ||
				!isActionReferenceCompatible(references[0], hasWrite, hasTrigger, requestedActionTypes))
		) {
			return 'action';
		}
		if (hasGenericActionTarget(actionReferenceMessage, explicitSpaces)) {
			return 'action';
		}

		return 'none';
	}

	if (CONTEXTUAL_SCOPE_PATTERN.test(message) && !conversationSpaceId) return 'read';

	return 'none';
}

function hasGenericActionTarget(message: string, explicitSpaces: readonly BuddyContextSpaceReference[]): boolean {
	if (EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN.test(message)) return false;
	if (GENERIC_ACTION_TARGET_PATTERN.test(message)) return true;

	return explicitSpaces.some((space) => {
		const normalizedSpaceName = normalize(space.name);

		return (
			!BUILT_IN_ACTION_SPACE_NAMES.has(normalizedSpaceName) &&
			GENERIC_ACTION_TARGET_NAMES.some((target) =>
				containsNormalizedPhrase(message, `${normalizedSpaceName} ${target}`),
			)
		);
	});
}

function isActionReferenceCompatible(
	reference: BuddyContextEntityReference,
	hasWrite: boolean,
	hasTrigger: boolean,
	requestedActionTypes: readonly BuddyContextActionType[],
): boolean {
	if (requestedActionTypes.length === 0) return false;
	if (!requestedActionTypes.every((actionType) => reference.compatibleActionTypes.includes(actionType))) return false;
	if (hasTrigger && hasWrite) return true;
	if (hasTrigger) return reference.kind === 'scene';
	if (hasWrite) return reference.kind !== 'scene';

	return false;
}

function resolveConversationSpaceHint(
	message: string,
	conversationSpaceId?: string | null,
	explicitSpaceIds: readonly string[] = [],
): string | undefined {
	if (WHOLE_HOME_SCOPE_PATTERN.test(message)) return undefined;

	const uniqueExplicitSpaceIds = [...new Set(explicitSpaceIds)];

	if (uniqueExplicitSpaceIds.length === 1) return uniqueExplicitSpaceIds[0];
	if (uniqueExplicitSpaceIds.length > 1) return undefined;

	return conversationSpaceId ?? undefined;
}

function findExplicitSpaces(
	message: string,
	knownSpaces: readonly BuddyContextSpaceReference[],
): BuddyContextSpaceReference[] {
	const matches = knownSpaces
		.map((space) => ({
			space,
			name: normalize(space.name),
			ranges: findNormalizedPhraseRanges(message, normalize(space.name)),
		}))
		.filter((match) => match.ranges.length > 0);

	return matches
		.filter((match) =>
			match.ranges.some(
				(range) =>
					!matches.some(
						(other) =>
							other.name.length > match.name.length &&
							other.ranges.some((otherRange) => otherRange.start <= range.start && otherRange.end >= range.end),
					),
			),
		)
		.map((match) => match.space);
}

function containsNormalizedPhrase(message: string, phrase: string): boolean {
	return findNormalizedPhraseRanges(message, phrase).length > 0;
}

function findNormalizedPhraseRanges(message: string, phrase: string): Array<{ start: number; end: number }> {
	if (phrase.length === 0) return [];

	const ranges: Array<{ start: number; end: number }> = [];

	let offset = 0;

	while (offset <= message.length - phrase.length) {
		const index = message.indexOf(phrase, offset);
		if (index < 0) break;

		const before = index === 0 ? '' : message[index - 1];
		const afterIndex = index + phrase.length;
		const after = afterIndex >= message.length ? '' : message[afterIndex];

		if (!/[\p{Letter}\p{Number}]/u.test(before) && !/[\p{Letter}\p{Number}]/u.test(after)) {
			ranges.push({ start: index, end: afterIndex });
		}

		offset = index + phrase.length;
	}

	return ranges;
}

function getRequestedActionTypes(message: string): BuddyContextActionType[] {
	const actions = new Set<BuddyContextActionType>();
	const mappings: readonly [RegExp, BuddyContextActionType][] = [
		[/\bactivate\b/u, 'activate'],
		[/\b(?:adjust|brighten|decrease|increase|lower|raise)\b/u, 'adjust'],
		[/\bchange\b/u, 'change'],
		[/\bclose\b/u, 'close'],
		[/\bdeactivate\b/u, 'deactivate'],
		[/\bdim\b/u, 'dim'],
		[/\block\b/u, 'lock'],
		[/\bmake\b/u, 'make'],
		[/\bopen\b/u, 'open'],
		[/\brun\b/u, 'run'],
		[/\bset\b/u, 'set'],
		[/\bstart\b/u, 'start'],
		[/\bstop\b/u, 'stop'],
		[/\bswitch\b/u, 'switch'],
		[/\btrigger\b/u, 'trigger'],
		[/\bturn\b/u, 'turn'],
		[/\bunlock\b/u, 'unlock'],
	];

	for (const [pattern, action] of mappings) {
		if (pattern.test(message)) actions.add(action);
	}

	return [...actions];
}

function getReferenceActionTypes(message: string): BuddyContextActionType[] {
	const clauses = message.split(/(?:[?!,.;]|\b(?:and|then)\b)/u);
	const actionTypes = new Set<BuddyContextActionType>();

	for (const clause of clauses) {
		if (!PRONOUN_PATTERN.test(clause)) continue;
		for (const actionType of getRequestedActionTypes(clause)) actionTypes.add(actionType);
	}

	return [...actionTypes];
}

function selectStrategy(
	intent: BuddyContextIntent,
	ambiguityRisk: BuddyContextAmbiguityRisk,
	domains: readonly BuddyContextDomain[],
	providerCapabilities: BuddyContextPlannerInput['providerCapabilities'],
): BuddyContextStrategy {
	if (intent === 'none') return 'no-home-context';
	if (ambiguityRisk !== 'none') return 'clarify';

	const hasAction = intent === 'write' || intent === 'trigger' || intent === 'mixed';
	const canUseModelTools =
		providerCapabilities.toolCalling === 'reliable' &&
		providerCapabilities.supportsStructuredToolResults &&
		domains.every((domain) => domain === 'general' || domain === 'home');

	if (hasAction) return canUseModelTools ? 'model-tools' : 'deterministic-action';

	return canUseModelTools ? 'model-tools' : 'prefetch';
}

function buildQueries(
	domains: readonly BuddyContextDomain[],
	hasAction: boolean,
	requiresReadForAction: boolean,
	spaceId?: string,
	includeCurrentStateForRead = true,
): BuddyContextQueryPlan[] {
	const queries: BuddyContextQueryPlan[] = [];
	const scoped = spaceId ? { spaceId } : {};

	if (domains.includes('home')) {
		queries.push({ kind: 'search-home', ...scoped });
		if ((!hasAction && includeCurrentStateForRead) || requiresReadForAction) {
			queries.push({ kind: 'current-state', ...scoped });
		}
	}
	if (domains.includes('weather')) queries.push({ kind: 'weather' });
	if (domains.includes('energy')) queries.push({ kind: 'energy-summary', ...scoped });
	if (domains.includes('security')) queries.push({ kind: 'security-status' });
	if (domains.includes('history')) queries.push({ kind: 'property-timeseries', ...scoped });

	return queries;
}

function buildToolNames(
	domains: readonly BuddyContextDomain[],
	hasWrite: boolean,
	hasTrigger: boolean,
	strategy: BuddyContextStrategy,
	message: string,
): string[] {
	if (strategy !== 'model-tools') return [];

	const names: string[] = [];

	if (domains.includes('home')) names.push(SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME);
	if (hasWrite) {
		names.push(CONTROL_DEVICE_TOOL_NAME);
		if (/\b(?:all|lighting|lights|room)\b/u.test(message)) names.push(SET_SPACE_LIGHTING_TOOL_NAME);
	}
	if (hasTrigger) names.push(RUN_SCENE_TOOL_NAME);

	return names;
}

function resolveRecentReferences(
	message: string,
	references: readonly BuddyContextEntityReference[],
): BuddyContextEntityReference[] {
	if (!PRONOUN_PATTERN.test(message)) return [];

	const unique = new Map<string, BuddyContextEntityReference>();

	for (const reference of references) unique.set(reference.id, reference);

	return [...unique.values()];
}

function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{Mark}/gu, '')
		.toLocaleLowerCase('en-US')
		.trim();
}
