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

import {
	BUDDY_ACTION_SIGNALS,
	BUDDY_COMPOUND_CONNECTOR_SIGNALS,
	BUDDY_CONDITION_SIGNALS,
	BUDDY_DEVICE_ACTION_SIGNALS,
	BUDDY_GROUNDED_STATE_SIGNALS,
	BUDDY_HOME_SIGNALS,
	BUDDY_LIGHTING_SIGNALS,
	BUDDY_RELATIVE_ADJUSTMENT_SIGNALS,
	BUDDY_SCENE_ACTION_SIGNALS,
	BUDDY_SPACE_SIGNALS,
	BUDDY_STATE_SIGNALS,
} from './buddy-tool-selection.service';
import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';

const CONTROL_DEVICE_TOOL_NAME = 'control_device';
const RUN_SCENE_TOOL_NAME = 'run_scene';
const SET_SPACE_LIGHTING_TOOL_NAME = 'set_space_lighting';
const ACTION_SIGNAL_PATTERN_SOURCE = [...BUDDY_ACTION_SIGNALS, 'trigger'].join('|');
const COMPOUND_CONNECTOR_PATTERN_SOURCE = [...BUDDY_COMPOUND_CONNECTOR_SIGNALS]
	.sort((left, right) => right.length - left.length)
	.join('|');
const HOME_ENTITY_SIGNAL_PATTERN_SOURCE = [...BUDDY_HOME_SIGNALS]
	.filter((signal) => !['energy', 'energie', 'home', 'house', 'security', 'zabezpeceni'].includes(signal))
	.join('|');
const GROUNDED_STATE_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_GROUNDED_STATE_SIGNALS].join('|')})\b`, 'u');
const STATE_SIGNAL_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_STATE_SIGNALS].join('|')})\b`, 'u');
const LIGHTING_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_LIGHTING_SIGNALS].join('|')})\b`, 'u');
const LIGHTING_GROUP_PATTERN = new RegExp(
	String.raw`\b(?:every|${[...BUDDY_SPACE_SIGNALS]
		.filter((signal) => ['all', 'lighting', 'lights', 'pokoj', 'room', 'svetla'].includes(signal))
		.join('|')})\b`,
	'u',
);

const DOMAIN_ORDER: readonly BuddyContextDomain[] = ['general', 'home', 'weather', 'energy', 'security', 'history'];
const WEATHER_PATTERN =
	/\b(?:cloud|cloudy|fog|foggy|forecast|outside|rain|raining|snow|storm|stormy|sun|sunny|thunder|weather|wind)\b/u;
const ENERGY_PATTERN = /\b(?:consumption|electricity|energy|kwh|power|production|usage)\b/u;
const DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE =
	'device|devices|fan|fans|lamp|lamps|light|lights|sensor|sensors|switch|switches';
const WEATHER_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\boutside\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
const ENERGY_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\bpower\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
const SECURITY_PATTERN = /\b(?:alarm|armed|intrusion|secure|security)\b/u;
const SECURITY_ENTITY_NAME_PATTERN = new RegExp(
	String.raw`\b(?:alarm|security)\s+(?:${DOMAIN_ENTITY_CATEGORY_PATTERN_SOURCE})\b`,
	'gu',
);
const HISTORY_PATTERN =
	/\b(?:chart|graph|history|historical|past|trend|yesterday)\b|\b(?:earlier today|last (?:day|hour|minute|month|night|week|year))\b|\b(?:last|since)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:did|was|were)\b.*\btoday\b|\b(?:has|have)\b.*\bbeen\b.*\btoday\b|\btoday\b.*\b(?:did|was|were)\b|\btoday\b.*\b(?:has|have)\b.*\bbeen\b|\b(?:for|last|over)\s+\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\b|\b(?:(?:a|an|one)\s+|\d+\s*)(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:[12]?\d|3[01])(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b|\b(?:[12]?\d|3[01])(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/u;
const CURRENT_STATE_PATTERN = /\b(?:at present|current|currently|now|right now)\b/u;
const HOME_ENTITY_PATTERN =
	/\b(?:air|blind|blinds|device|devices|door|doors|fan|fans|garage|heater|heaters|lamp|light|lighting|lights|room|scene|scenes|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)\b/u;
const HOME_VOCABULARY_PATTERN = new RegExp(String.raw`\b(?:${HOME_ENTITY_SIGNAL_PATTERN_SOURCE})\b`, 'u');
const POSSESSIVE_HOME_ENTITY_PATTERN =
	/\b(?:my|our)\s+(?:air|blind|blinds|device|devices|door|doors|fan|fans|garage|heater|heaters|lamp|light|lighting|lights|room|scene|scenes|sensor|sensors|switch|switches|thermostat|thermostats|window|windows)\b/u;
const GENERAL_KNOWLEDGE_INVENTORY_PATTERN = /^how (?:many|much)\b.*\b(?:does|do) (?:a|an)\b/u;
const HOME_INSTALLATION_PATTERN = /\b(?:home|house)\b/u;
const HOME_STATE_PATTERN = /\b(?:cold|cooling|heating|humidity|temperature|warm)\b/u;
const READ_PATTERN =
	/^(?:are|can you (?:check|confirm|determine|fetch|get|read|report|show|tell|verify)|check|confirm|determine|ensure|fetch|find|get|how (?:many|much)|is|list|make sure|read|report|search|see|show|tell(?: me)?|verify|what|which|will)\b/u;
const PREDICATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|do|does|had|has|have|is|may|might|will|would|was|were|je|jsou|jaka|jaky|ktere|kolik|(?:how|what|when|where|which|who|why)['’]s|(?:what|why) (?:are|did|do|does|had|has|have|is|was|were))\b/u;
const ACTION_REQUEST_PATTERN =
	/^(?:(?:can|could|may|might|will|would) you\b|are you able to\b|is it possible to\b|is there any way you can\b)/u;
const MODAL_STATE_READ_PATTERN =
	/^(?:can|could|may|might|will|would) you (?:check|confirm|determine|fetch|get|read|report|show|tell|verify)(?: me)?\b.*\b(?:how|if|what|when|where|whether|which|why)\b/u;
const WRITE_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_DEVICE_ACTION_SIGNALS].join('|')})\b`, 'u');
const TRIGGER_PATTERN = new RegExp(
	String.raw`\b(?:activate|deactivate|start|stop|trigger|${[...BUDDY_SCENE_ACTION_SIGNALS].join('|')})\b`,
	'u',
);
const TARGET_DEPENDENT_ACTION_PATTERN = /\b(?:activate|deactivate|start|stop)\b/u;
const DEVICE_RUN_TARGET_PATTERN = /\brun\b.*\b(?:device|fan|switch)\b/u;
const ACTION_COMMAND_PATTERN = new RegExp(
	String.raw`^[?!,.;\s]*(?:(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE}|if so|please)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)?(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
const CONDITION_PATTERN = new RegExp(String.raw`\b(?:${[...BUDDY_CONDITION_SIGNALS].join('|')})\b`, 'u');
const LEADING_CONDITION_PATTERN = new RegExp(String.raw`^(?:${[...BUDDY_CONDITION_SIGNALS].join('|')})\b`, 'u');
const RELATIVE_PATTERN = new RegExp(
	String.raw`\b(?:${[...BUDDY_RELATIVE_ADJUSTMENT_SIGNALS].join('|')}|times as)\b`,
	'u',
);
const PRONOUN_PATTERN = /\b(?:ho|it|its|that|them|these|they|this|those)\b|\bthe one\b/u;
const SINGULAR_REFERENCE_PRONOUN_PATTERN = /\b(?:ho|it|its|that|this)\b|\bthe one\b/u;
const LOCALIZED_REFERENCE_PRONOUN_PATTERN =
	/\b(?:aktivuj|nastav|odemkni|otevri|sniz|spust|vypni|zamkni|zapni|zavri|zvys)\s+(?:ho|to)\b/u;
const CAPABILITY_DISCOVERY_PATTERN = new RegExp(
	String.raw`^(?:(?:what|which)\b|(?:can|could|would) you (?:show|tell)(?: me)?\b).*\b(?:am i able to|can i|i can)\b.*\b(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
const CONTEXTUAL_SCOPE_PATTERN = /\b(?:here|in this room|this space)\b/u;
const CONTEXTUAL_SCOPE_REFERENCE_PATTERN = /\b(?:in this room|this space)\b/gu;
const GENERIC_ACTION_TARGET_PATTERN =
	/\b(?:a|all|an|any|every|the)\s+(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blind|blinds|device|devices|door|doors|fan|fans|heater|heaters|lamp|lamps|light|lights|scene|scenes|switch|switches|thermostat|thermostats|window|windows)\b|\b(?:(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\s+)?(?:blinds|devices|doors|fans|heaters|lamps|lights|scenes|switches|thermostats|windows)\b|^[?!,.;\s]*(?:(?:and(?: also)?|as well as|if so|please|plus|then)\s+)*(?:(?:can|could|may|might|will|would) you\s+(?:please\s+)?)?(?:activate|adjust|brighten|change|close|deactivate|decrease|dim|increase|lock|lower|make|open|raise|run|set|start|stop|switch|trigger|turn|unlock)\s+(?:off\s+|on\s+)?(?:blind|device|door|fan|heater|lamp|light|scene|switch|thermostat|window)\b/u;
const GENERIC_ACTION_TARGET_NAMES = [
	'blind',
	'blinds',
	'device',
	'devices',
	'door',
	'doors',
	'fan',
	'fans',
	'heater',
	'heaters',
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
	'dvere',
	'lampa',
	'okno',
	'scena',
	'senzor',
	'svetlo',
	'termostat',
	'vypinac',
	'zaluzie',
	'zarizeni',
] as const;
const BARE_GENERIC_ACTION_TARGET_PATTERN = new RegExp(
	String.raw`^[?!,.;\s]*(?:${[...BUDDY_ACTION_SIGNALS].join('|')})\s+(?:${GENERIC_ACTION_TARGET_NAMES.join('|')})\b`,
	'u',
);
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
const TRAILING_ACTION_PATTERN = new RegExp(
	String.raw`(?:[?!,.;]|\b(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)\s*(?:(?:if so|please)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)?(?:${ACTION_SIGNAL_PATTERN_SOURCE})\b`,
	'u',
);
const TRAILING_READ_PATTERN = new RegExp(
	String.raw`(?:[?!,.;]|\b(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)\s*(?:(?:also|please)\s+)*(?:are|can|check|confirm|could|determine|did|do|does|ensure|fetch|find|get|had|has|have|how|is|make sure|may|might|read|report|see|show|tell(?: me)?|verify|was|were|what|whether|which|will|would)\b`,
	'u',
);

@Injectable()
export class BuddyContextPlannerService {
	plan(input: BuddyContextPlannerInput): BuddyContextPlan {
		const normalizedMessage = normalize(input.message);
		const recentEntityReferences = input.recentEntityReferences ?? [];
		const hasRecentReferencePronoun =
			hasReferencePronoun(stripContextualScopeReferences(normalizedMessage)) && recentEntityReferences.length > 0;
		const explicitSpaces = findExplicitSpaces(normalizedMessage, input.knownSpaces ?? []);
		const explicitSpaceIds = [...new Set(explicitSpaces.map((space) => space.id))];
		const conversationSpaceId = resolveConversationSpaceHint(
			normalizedMessage,
			input.conversationSpaceId,
			explicitSpaceIds,
		);
		const resolvedSpaceIds =
			explicitSpaceIds.length > 1 ? explicitSpaceIds : conversationSpaceId ? [conversationSpaceId] : [];
		const isGenericExplanation = isGeneralExplanation(normalizedMessage, explicitSpaces.length > 0);
		const isPredicateQuestion = isStatePredicateQuestion(normalizedMessage);
		const isWrappedStateRead = MODAL_STATE_READ_PATTERN.test(normalizedMessage);
		const trailingActionMatch =
			isPredicateQuestion || isWrappedStateRead || READ_PATTERN.test(normalizedMessage)
				? TRAILING_ACTION_PATTERN.exec(normalizedMessage)
				: null;
		const hasTrailingAction = trailingActionMatch !== null;
		const hasTrailingRead = TRAILING_READ_PATTERN.test(normalizedMessage);
		const actionMessage = getActionMessage(normalizedMessage, trailingActionMatch);
		const actionReferenceMessage = getActionReferenceMessage(actionMessage);
		const hasLeadingHomeRead =
			trailingActionMatch !== null && hasHomeStateReadClause(normalizedMessage.slice(0, trailingActionMatch.index));
		const isReadOnlyPredicate =
			!hasTrailingAction &&
			(isPredicateQuestion ||
				isWrappedStateRead ||
				(READ_PATTERN.test(normalizedMessage) &&
					(CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage) || hasOnlyGroundedActionTokens(normalizedMessage))));
		const hasWrite =
			!isGenericExplanation &&
			!isReadOnlyPredicate &&
			splitPlannerClauses(actionReferenceMessage).some(
				(clause) =>
					ACTION_COMMAND_PATTERN.test(clause) &&
					(WRITE_PATTERN.test(clause) ||
						TARGET_DEPENDENT_ACTION_PATTERN.test(clause) ||
						DEVICE_RUN_TARGET_PATTERN.test(clause)),
			);
		const hasTrigger =
			!isGenericExplanation &&
			!isReadOnlyPredicate &&
			ACTION_COMMAND_PATTERN.test(actionMessage) &&
			splitPlannerClauses(actionMessage).some(
				(clause) =>
					ACTION_COMMAND_PATTERN.test(clause) &&
					TRIGGER_PATTERN.test(clause) &&
					!DEVICE_RUN_TARGET_PATTERN.test(clause),
			);
		const hasAction = hasWrite || hasTrigger;
		const referenceActionTypes = getReferenceActionTypes(actionReferenceMessage);
		const domains = classifyDomains(
			normalizedMessage,
			hasAction || isReadOnlyPredicate,
			isGenericExplanation,
			hasRecentReferencePronoun,
			explicitSpaces,
			hasAction,
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
			(CONDITION_PATTERN.test(normalizedMessage) ||
				RELATIVE_PATTERN.test(normalizedMessage) ||
				hasTrailingRead ||
				hasLeadingHomeRead);
		const intent = classifyIntent(hasWrite, hasTrigger, hasRead || requiresReadForAction);
		const ambiguityRisk = classifyAmbiguityRisk(
			normalizedMessage,
			actionReferenceMessage,
			hasWrite,
			hasTrigger,
			referenceActionTypes,
			references,
			domains,
			conversationSpaceId,
			explicitSpaces,
		);
		const strategy = selectStrategy(intent, ambiguityRisk, domains, input.providerCapabilities);
		const includeCurrentStateForRead =
			(!domains.includes('history') || hasCurrentStateReadClause(normalizedMessage, explicitSpaces)) &&
			!CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage);
		const scopedReferences = hasAction
			? references.length === 1 &&
				isActionReferenceCompatible(references[0], hasWrite, hasTrigger, referenceActionTypes)
				? references
				: []
			: hasSingularReferencePronoun(stripContextualScopeReferences(normalizedMessage)) && references.length !== 1
				? []
				: references;
		const querySpaceIds = scopedReferences.length > 0 && explicitSpaceIds.length === 0 ? [] : resolvedSpaceIds;
		const energySpaceIds = resolveEnergySpaceIds(
			normalizedMessage,
			explicitSpaces,
			input.conversationSpaceId ?? undefined,
		);
		const hasMixedRetrievalDomain = domains.some((domain) => domain !== 'general' && domain !== 'home');
		const currentStateSpaceIds = hasMixedRetrievalDomain
			? resolveCurrentStateSpaceIds(
					normalizedMessage,
					explicitSpaces,
					input.conversationSpaceId ?? undefined,
					querySpaceIds,
				)
			: querySpaceIds;
		const historySpaceIds = domains.includes('history')
			? resolveTemporalHomeSpaceIds(
					normalizedMessage,
					explicitSpaces,
					scopedReferences.length > 0 ? undefined : (input.conversationSpaceId ?? undefined),
					HISTORY_PATTERN,
				)
			: querySpaceIds;
		const hasCurrentStateQuery = (!hasAction && includeCurrentStateForRead) || requiresReadForAction;
		const homeRetrievalSpaceIds = [
			...new Set([
				...(hasCurrentStateQuery ? currentStateSpaceIds : []),
				...(domains.includes('history') ? historySpaceIds : []),
			]),
		];
		const searchSpaceIds =
			hasCurrentStateQuery || domains.includes('history')
				? [
						...querySpaceIds.filter((spaceId) => homeRetrievalSpaceIds.includes(spaceId)),
						...homeRetrievalSpaceIds.filter((spaceId) => !querySpaceIds.includes(spaceId)),
					]
				: querySpaceIds;
		const scope = {
			...(querySpaceIds.length === 1
				? { spaceId: querySpaceIds[0] }
				: querySpaceIds.length > 1
					? { spaceIds: querySpaceIds }
					: {}),
			...(scopedReferences.length > 0
				? { referencedEntityIds: scopedReferences.map((reference) => reference.id) }
				: {}),
		};

		return {
			domains,
			intent,
			scope,
			queries: buildQueries(
				domains,
				hasAction,
				requiresReadForAction,
				searchSpaceIds,
				includeCurrentStateForRead,
				energySpaceIds,
				currentStateSpaceIds,
				historySpaceIds,
			),
			toolNames: buildToolNames(domains, hasWrite, hasTrigger, strategy, normalizedMessage, explicitSpaces),
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
	return splitPlannerClauses(message)
		.filter((clause) => ACTION_COMMAND_PATTERN.test(clause))
		.map((clause) => {
			const actionOnlyClause = clause.replace(
				new RegExp(
					String.raw`^[?!,.;\s]*(?:(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE}|if so|please)\s+)*(?:(?:(?:can|could|may|might|will|would) you|are you able to|is it possible to|is there any way you can)\s+(?:please\s+)?)`,
					'u',
				),
				'',
			);
			const trailingCondition =
				/\b(?:after|as long as|as soon as|assuming|before|given that|if|in case|once|only if|provided|so long as|unless|until|when|whenever|while)\b/u.exec(
					actionOnlyClause,
				);

			return trailingCondition ? actionOnlyClause.slice(0, trailingCondition.index) : actionOnlyClause;
		})
		.join(' and ');
}

function classifyDomains(
	message: string,
	hasHomeActionOrPredicate: boolean,
	isGenericExplanation: boolean,
	hasRecentReferencePronoun = false,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
	hasAction = false,
): BuddyContextDomain[] {
	if (isGenericExplanation) return ['general'];

	const domains = new Set<BuddyContextDomain>();
	const hasWeather = hasDomainSignalOutsideEntityName(message, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN);
	const hasEnergy = hasDomainSignalOutsideEntityName(message, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN);
	const hasSecurity = hasDomainSignalOutsideEntityName(message, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);
	const clauses = splitPlannerClauses(message);
	const hasHomeEntity = clauses.some((clause) => {
		const retrievalClause = getRetrievalClause(clause);
		const hasHomeSignal = HOME_ENTITY_PATTERN.test(retrievalClause) || HOME_VOCABULARY_PATTERN.test(retrievalClause);
		const hasNonHomeSignal =
			hasDomainSignalInClause(retrievalClause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(retrievalClause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(retrievalClause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);

		return hasHomeSignal && (!hasNonHomeSignal || CONTEXTUAL_SCOPE_PATTERN.test(retrievalClause));
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

		return (
			PREDICATE_QUESTION_PATTERN.test(normalizedClause) &&
			(GROUNDED_STATE_PATTERN.test(normalizedClause) || STATE_SIGNAL_PATTERN.test(normalizedClause)) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN)
		);
	});
	const hasExplicitHomeSpace = explicitSpaces.some((space) =>
		clauses.some((clause) => {
			if (!containsNormalizedPhrase(clause, normalize(space.name))) return false;

			const clauseWithoutSpace = removeNormalizedPhrase(clause, normalize(space.name));
			const hasNonHomeSignal =
				hasDomainSignalInClause(clauseWithoutSpace, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clauseWithoutSpace, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clauseWithoutSpace, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);
			const hasHomeSignal =
				HOME_ENTITY_PATTERN.test(clauseWithoutSpace) ||
				HOME_VOCABULARY_PATTERN.test(clauseWithoutSpace) ||
				HOME_STATE_PATTERN.test(clauseWithoutSpace) ||
				CONTEXTUAL_SCOPE_PATTERN.test(clauseWithoutSpace);

			return !hasNonHomeSignal || hasHomeSignal;
		}),
	);

	if (
		hasHomeEntity ||
		hasContextualHomeState ||
		hasHomeActionOrPredicate ||
		hasRecentReferenceHome ||
		hasCategoryFreeHomeState ||
		hasExplicitHomeSpace ||
		hasInstallationHome
	) {
		domains.add('home');
	}
	if (hasWeather) domains.add('weather');
	if (hasEnergy) domains.add('energy');
	if (hasSecurity) domains.add('security');
	if (HISTORY_PATTERN.test(message)) {
		const hasHomeSpecificHistory = clauses.some((clause) => {
			if (!HISTORY_PATTERN.test(clause)) return false;

			const hasExplicitSpace = explicitSpaces.some((space) => containsNormalizedPhrase(clause, normalize(space.name)));
			const hasHomeSignal =
				HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_INSTALLATION_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				hasExplicitSpace ||
				(hasRecentReferenceHome && hasReferencePronoun(clause));
			const hasNonHomeSignal =
				hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
				hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);

			return hasHomeSignal && (!hasNonHomeSignal || hasExplicitSpace || CONTEXTUAL_SCOPE_PATTERN.test(clause));
		});

		if (hasHomeSpecificHistory) {
			domains.add('home');
			domains.add('history');
		}
	}

	if (domains.size === 0) domains.add('general');

	return DOMAIN_ORDER.filter((domain) => domains.has(domain));
}

function hasDomainSignalOutsideEntityName(message: string, domainPattern: RegExp, entityNamePattern: RegExp): boolean {
	return splitPlannerClauses(message).some((clause) =>
		hasDomainSignalInClause(getRetrievalClause(clause), domainPattern, entityNamePattern),
	);
}

function getRetrievalClause(clause: string): string {
	if (!ACTION_COMMAND_PATTERN.test(clause)) return clause;

	const condition = CONDITION_PATTERN.exec(clause);

	return condition ? clause.slice(condition.index) : '';
}

function hasDomainSignalInClause(clause: string, domainPattern: RegExp, entityNamePattern: RegExp): boolean {
	return domainPattern.test(clause.replace(entityNamePattern, ' '));
}

function splitPlannerClauses(message: string): string[] {
	return message.split(new RegExp(String.raw`(?:[?!,.;]|\b(?:${COMPOUND_CONNECTOR_PATTERN_SOURCE})\b)`, 'u'));
}

function hasCurrentStateReadClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): boolean {
	const conjoinedTemporalSpaceIds = new Set(resolveConjoinedTemporalSpaceIds(message, explicitSpaces));

	return splitPlannerClauses(message).some((clause) => {
		const normalizedClause = clause.trim();

		if (HISTORY_PATTERN.test(normalizedClause) && !CURRENT_STATE_PATTERN.test(normalizedClause)) return false;
		if (
			!CURRENT_STATE_PATTERN.test(normalizedClause) &&
			explicitSpaces.some(
				(space) =>
					conjoinedTemporalSpaceIds.has(space.id) && containsNormalizedPhrase(normalizedClause, normalize(space.name)),
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

function hasHomeStateReadClause(message: string): boolean {
	return splitPlannerClauses(message).some((clause) => {
		const normalizedClause = clause.trim();

		return (
			HOME_ENTITY_PATTERN.test(normalizedClause) ||
			HOME_VOCABULARY_PATTERN.test(normalizedClause) ||
			HOME_STATE_PATTERN.test(normalizedClause) ||
			CONTEXTUAL_SCOPE_PATTERN.test(normalizedClause) ||
			(PREDICATE_QUESTION_PATTERN.test(normalizedClause) && GROUNDED_STATE_PATTERN.test(normalizedClause))
		);
	});
}

function isGeneralExplanation(message: string, hasExplicitSpace = false): boolean {
	if (hasExplicitSpace || POSSESSIVE_HOME_ENTITY_PATTERN.test(message)) return false;

	return (
		GENERAL_KNOWLEDGE_INVENTORY_PATTERN.test(message) ||
		/^how (?:can|could|do|does|would)\b.*\b(?:work|works|working|i)\b/u.test(message) ||
		/^explain (?:how|what|why)\b/u.test(message) ||
		/^(?:explain|show me|tell me) how to\b/u.test(message) ||
		/^what (?:do|does) (?:a|an)\b.*\bdo\b/u.test(message) ||
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
	domains: readonly BuddyContextDomain[],
	conversationSpaceId?: string,
	explicitSpaces: readonly BuddyContextSpaceReference[] = [],
): BuddyContextAmbiguityRisk {
	const isAction = hasWrite || hasTrigger;

	if (isAction) {
		if (
			hasReferencePronoun(stripContextualScopeReferences(actionReferenceMessage)) &&
			(references.length !== 1 ||
				!isActionReferenceCompatible(references[0], hasWrite, hasTrigger, requestedActionTypes))
		) {
			return 'action';
		}
		if (
			hasGenericActionTarget(actionReferenceMessage, explicitSpaces, conversationSpaceId !== undefined) &&
			!hasMultiSpaceLightingTarget(message, explicitSpaces)
		) {
			return 'action';
		}

		return 'none';
	}
	const hasSingularHomeReference = splitPlannerClauses(message).some(
		(clause) =>
			hasSingularReferencePronoun(stripContextualScopeReferences(clause)) &&
			(HOME_ENTITY_PATTERN.test(clause) ||
				HOME_VOCABULARY_PATTERN.test(clause) ||
				HOME_STATE_PATTERN.test(clause) ||
				GROUNDED_STATE_PATTERN.test(clause)) &&
			!hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) &&
			!hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN),
	);
	if (
		domains.includes('home') &&
		hasSingularHomeReference &&
		references.length !== 1 &&
		!(conversationSpaceId && CONTEXTUAL_SCOPE_PATTERN.test(message))
	) {
		return 'read';
	}

	if (CONTEXTUAL_SCOPE_PATTERN.test(message) && !conversationSpaceId) return 'read';

	return 'none';
}

function hasGenericActionTarget(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	hasConversationSpace = false,
): boolean {
	const clauses = message
		.split(/(?:[?!,.;]|\b(?:and(?: also)?|as well as|plus|then)\b)/u)
		.filter((clause) => clause.trim().length > 0);

	return clauses.some((clause) => hasGenericActionTargetClause(clause, explicitSpaces, hasConversationSpace));
}

function hasGenericActionTargetClause(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	hasConversationSpace: boolean,
): boolean {
	const clauseSpaces = explicitSpaces.filter((space) => containsNormalizedPhrase(message, normalize(space.name)));
	const hasClauseSpace = clauseSpaces.length > 0;
	const hasResolvedContextualSpace = hasConversationSpace && CONTEXTUAL_SCOPE_PATTERN.test(message);

	if (clauseSpaces.length > 1 && /\bor\b/u.test(message)) return true;
	if (
		(hasClauseSpace || hasResolvedContextualSpace) &&
		LIGHTING_PATTERN.test(message) &&
		LIGHTING_GROUP_PATTERN.test(message)
	) {
		return false;
	}
	if (EXACT_BUILT_IN_THERMOSTAT_TARGET_PATTERN.test(message)) return false;
	if (GENERIC_ACTION_TARGET_PATTERN.test(message) || BARE_GENERIC_ACTION_TARGET_PATTERN.test(message)) return true;

	return explicitSpaces.some((space) => {
		const normalizedSpaceName = normalize(space.name);

		return GENERIC_ACTION_TARGET_NAMES.some((target) =>
			containsNormalizedPhrase(message, `${normalizedSpaceName} ${target}`),
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
	if (HOME_INSTALLATION_PATTERN.test(message)) return undefined;
	if ([...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(message, spaceName))) {
		return undefined;
	}

	return conversationSpaceId ?? undefined;
}

function resolveEnergySpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId?: string,
): string[] {
	const energyClauses = splitPlannerClauses(message).filter((clause) =>
		hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN),
	);

	if (energyClauses.some((clause) => HOME_INSTALLATION_PATTERN.test(clause) || WHOLE_HOME_SCOPE_PATTERN.test(clause))) {
		return [];
	}

	const explicitEnergySpaceIds = [
		...new Set(
			explicitSpaces
				.filter((space) => energyClauses.some((clause) => containsNormalizedPhrase(clause, normalize(space.name))))
				.map((space) => space.id),
		),
	];

	if (explicitEnergySpaceIds.length > 0) return explicitEnergySpaceIds;
	if (
		energyClauses.some((clause) =>
			[...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName)),
		)
	) {
		return [];
	}

	return conversationSpaceId ? [conversationSpaceId] : [];
}

function resolveCurrentStateSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId: string | undefined,
	fallbackSpaceIds: readonly string[],
): string[] {
	const conjoinedTemporalSpaceIds = new Set(resolveConjoinedTemporalSpaceIds(message, explicitSpaces));
	const currentStateClauses = splitPlannerClauses(message).filter((clause) => {
		if (HISTORY_PATTERN.test(clause) && !CURRENT_STATE_PATTERN.test(clause)) return false;
		if (
			!CURRENT_STATE_PATTERN.test(clause) &&
			explicitSpaces.some(
				(space) => conjoinedTemporalSpaceIds.has(space.id) && containsNormalizedPhrase(clause, normalize(space.name)),
			)
		) {
			return false;
		}

		const hasHomeSignal =
			HOME_ENTITY_PATTERN.test(clause) ||
			HOME_VOCABULARY_PATTERN.test(clause) ||
			HOME_INSTALLATION_PATTERN.test(clause) ||
			HOME_STATE_PATTERN.test(clause) ||
			CONTEXTUAL_SCOPE_PATTERN.test(clause);
		const hasNonHomeSignal =
			hasDomainSignalInClause(clause, WEATHER_PATTERN, WEATHER_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(clause, ENERGY_PATTERN, ENERGY_ENTITY_NAME_PATTERN) ||
			hasDomainSignalInClause(clause, SECURITY_PATTERN, SECURITY_ENTITY_NAME_PATTERN);

		const hasExplicitSpace = explicitSpaces.some((space) => containsNormalizedPhrase(clause, normalize(space.name)));
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
			(!hasNonHomeSignal || CONTEXTUAL_SCOPE_PATTERN.test(clause) || (hasExplicitSpace && hasIndependentHomeSignal))
		);
	});
	if (
		currentStateClauses.some(
			(clause) => HOME_INSTALLATION_PATTERN.test(clause) || WHOLE_HOME_SCOPE_PATTERN.test(clause),
		)
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

function resolveTemporalHomeSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	conversationSpaceId: string | undefined,
	temporalPattern: RegExp,
): string[] {
	const temporalClauses = splitPlannerClauses(message).filter((clause) => temporalPattern.test(clause));

	if (temporalClauses.some((clause) => WHOLE_HOME_SCOPE_PATTERN.test(clause))) return [];

	const explicitTemporalSpaceIds = expandConjoinedTemporalSpaceIds(
		message,
		explicitSpaces,
		resolveTemporalExplicitSpaceIds(temporalClauses, explicitSpaces, temporalPattern),
	);

	if (explicitTemporalSpaceIds.length > 0) return explicitTemporalSpaceIds;
	if (
		temporalClauses.some((clause) =>
			[...BUILT_IN_ACTION_SPACE_NAMES].some((spaceName) => containsNormalizedPhrase(clause, spaceName)),
		)
	) {
		return [];
	}
	if (conversationSpaceId) return [conversationSpaceId];
	if (explicitSpaces.length === 1) return [explicitSpaces[0].id];

	return [];
}

function resolveConjoinedTemporalSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): string[] {
	const temporalClauses = splitPlannerClauses(message).filter((clause) => HISTORY_PATTERN.test(clause));
	const directlyTemporalSpaceIds = resolveTemporalExplicitSpaceIds(temporalClauses, explicitSpaces, HISTORY_PATTERN);

	return expandConjoinedTemporalSpaceIds(message, explicitSpaces, directlyTemporalSpaceIds).filter(
		(spaceId) => !directlyTemporalSpaceIds.includes(spaceId),
	);
}

function expandConjoinedTemporalSpaceIds(
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
	selectedSpaceIds: readonly string[],
): string[] {
	const occurrences = explicitSpaces
		.flatMap((space) => findNormalizedPhraseRanges(message, normalize(space.name)).map((range) => ({ space, range })))
		.sort((left, right) => left.range.start - right.range.start);
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

function resolveTemporalExplicitSpaceIds(
	clauses: readonly string[],
	explicitSpaces: readonly BuddyContextSpaceReference[],
	temporalPattern: RegExp,
): string[] {
	const spaceIds: string[] = [];

	for (const clause of clauses) {
		const clauseSpaces = explicitSpaces
			.map((space) => ({ space, ranges: findNormalizedPhraseRanges(clause, normalize(space.name)) }))
			.filter(({ ranges }) => ranges.length > 0);

		if (!CURRENT_STATE_PATTERN.test(clause) || !HISTORY_PATTERN.test(clause) || clauseSpaces.length <= 1) {
			spaceIds.push(...clauseSpaces.map(({ space }) => space.id));
			continue;
		}

		const globalFlags = temporalPattern.flags.includes('g') ? temporalPattern.flags : `${temporalPattern.flags}g`;
		const matches = clause.matchAll(new RegExp(temporalPattern.source, globalFlags));

		for (const match of matches) {
			const start = match.index;
			const temporalCenter = start + match[0].length / 2;
			const nearestSpace = clauseSpaces
				.flatMap(({ space, ranges }) =>
					ranges.map((range) => ({
						space,
						distance: Math.abs((range.start + range.end) / 2 - temporalCenter),
					})),
				)
				.sort((left, right) => left.distance - right.distance)[0]?.space;

			if (nearestSpace) spaceIds.push(nearestSpace.id);
		}
	}

	return [...new Set(spaceIds)];
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

function removeNormalizedPhrase(message: string, phrase: string): string {
	return findNormalizedPhraseRanges(message, phrase)
		.reverse()
		.reduce((result, range) => `${result.slice(0, range.start)} ${result.slice(range.end)}`, message);
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
		[/\b(?:activate|aktivuj)\b/u, 'activate'],
		[/\b(?:adjust|brighten|decrease|increase|lower|raise|sniz|zvys)\b/u, 'adjust'],
		[/\bchange\b/u, 'change'],
		[/\b(?:close|zavri)\b/u, 'close'],
		[/\bdeactivate\b/u, 'deactivate'],
		[/\bdim\b/u, 'dim'],
		[/\b(?:lock|zamkni)\b/u, 'lock'],
		[/\bmake\b/u, 'make'],
		[/\b(?:open|otevri)\b/u, 'open'],
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

function getReferenceActionTypes(message: string): BuddyContextActionType[] {
	const clauses = message.split(/(?:[?!,.;]|\b(?:and(?: also)?|as well as|plus|then)\b)/u);
	const actionTypes = new Set<BuddyContextActionType>();

	for (const clause of clauses) {
		if (!hasReferencePronoun(stripContextualScopeReferences(clause))) continue;
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
	spaceIds: readonly string[] = [],
	includeCurrentStateForRead = true,
	energySpaceIds: readonly string[] = spaceIds,
	currentStateSpaceIds: readonly string[] = spaceIds,
	historySpaceIds: readonly string[] = spaceIds,
): BuddyContextQueryPlan[] {
	const queries: BuddyContextQueryPlan[] = [];
	const scopes = spaceIds.length > 0 ? spaceIds.map((spaceId) => ({ spaceId })) : [{}];
	const energyScopes = energySpaceIds.length > 0 ? energySpaceIds.map((spaceId) => ({ spaceId })) : [{}];
	const currentStateScopes =
		currentStateSpaceIds.length > 0 ? currentStateSpaceIds.map((spaceId) => ({ spaceId })) : [{}];
	const historyScopes = historySpaceIds.length > 0 ? historySpaceIds.map((spaceId) => ({ spaceId })) : [{}];

	if (domains.includes('home')) {
		for (const scoped of scopes) queries.push({ kind: 'search-home', ...scoped });
		if ((!hasAction && includeCurrentStateForRead) || requiresReadForAction) {
			for (const scoped of currentStateScopes) queries.push({ kind: 'current-state', ...scoped });
		}
	}
	if (domains.includes('weather')) queries.push({ kind: 'weather' });
	if (domains.includes('energy')) {
		for (const scoped of energyScopes) queries.push({ kind: 'energy-summary', ...scoped });
	}
	if (domains.includes('security')) queries.push({ kind: 'security-status' });
	if (domains.includes('history')) {
		for (const scoped of historyScopes) queries.push({ kind: 'property-timeseries', ...scoped });
	}

	return queries;
}

function buildToolNames(
	domains: readonly BuddyContextDomain[],
	hasWrite: boolean,
	hasTrigger: boolean,
	strategy: BuddyContextStrategy,
	message: string,
	explicitSpaces: readonly BuddyContextSpaceReference[],
): string[] {
	if (strategy !== 'model-tools') return [];

	const names: string[] = [];

	if (domains.includes('home')) names.push(SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME);
	if (hasWrite) {
		names.push(CONTROL_DEVICE_TOOL_NAME);
		const hasLightingGroupTarget =
			splitPlannerClauses(message).some(
				(clause) =>
					ACTION_COMMAND_PATTERN.test(clause) && LIGHTING_PATTERN.test(clause) && LIGHTING_GROUP_PATTERN.test(clause),
			) || hasMultiSpaceLightingTarget(message, explicitSpaces);

		if (hasLightingGroupTarget) names.push(SET_SPACE_LIGHTING_TOOL_NAME);
	}
	if (hasTrigger) names.push(RUN_SCENE_TOOL_NAME);

	return names;
}

function hasMultiSpaceLightingTarget(message: string, explicitSpaces: readonly BuddyContextSpaceReference[]): boolean {
	if (explicitSpaces.length < 2 || !ACTION_COMMAND_PATTERN.test(message) || !LIGHTING_PATTERN.test(message)) {
		return false;
	}

	const spaceRanges = explicitSpaces
		.flatMap((space) => findNormalizedPhraseRanges(message, normalize(space.name)))
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
		/^\s*(?:lamps|lighting|lights|svetla)\b/u.test(targetSuffix)
	);
}

function resolveRecentReferences(
	message: string,
	references: readonly BuddyContextEntityReference[],
): BuddyContextEntityReference[] {
	if (!hasReferencePronoun(stripContextualScopeReferences(message))) return [];

	const unique = new Map<string, BuddyContextEntityReference>();

	for (const reference of references) unique.set(reference.id, reference);

	return [...unique.values()];
}

function stripContextualScopeReferences(message: string): string {
	return message.replace(CONTEXTUAL_SCOPE_REFERENCE_PATTERN, ' ');
}

function hasReferencePronoun(message: string): boolean {
	return PRONOUN_PATTERN.test(message) || LOCALIZED_REFERENCE_PRONOUN_PATTERN.test(message);
}

function hasSingularReferencePronoun(message: string): boolean {
	return SINGULAR_REFERENCE_PRONOUN_PATTERN.test(message) || LOCALIZED_REFERENCE_PRONOUN_PATTERN.test(message);
}

function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{Mark}/gu, '')
		.toLocaleLowerCase('en-US')
		.trim();
}
