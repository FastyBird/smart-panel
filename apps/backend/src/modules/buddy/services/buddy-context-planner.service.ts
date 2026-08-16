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
const WEATHER_PATTERN = /\b(?:forecast|outside|rain|raining|snow|weather|wind)\b/u;
const ENERGY_PATTERN = /\b(?:consumption|energy|kwh|power|production|usage)\b/u;
const SECURITY_PATTERN = /\b(?:alarm|armed|intrusion|secure|security)\b/u;
const HISTORY_PATTERN = /\b(?:chart|graph|history|historical|past|trend)\b|\b(?:for|over)\s+\d+\s+(?:hours?|days?)\b/u;
const HOME_PATTERN =
	/\b(?:blind|blinds|cold|device|door|doors|fan|garage|humidity|lamp|light|lights|room|scene|sensor|switch|temperature|thermostat|warm|window|windows)\b/u;
const READ_PATTERN =
	/^(?:are|can you (?:check|fetch|get|report|show|tell)|check|fetch|find|get|how (?:many|much)|is|list|report|search|show|what|which|will)\b/u;
const PREDICATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|had|has|have|is|may|might|will|would|was|were|(?:how|what|when|where|which|who|why)['’]s|(?:what|why) (?:are|did|had|has|have|is|was|were))\b/u;
const ACTION_REQUEST_PATTERN =
	/^(?:(?:can|could|may|might|will|would) you\b|are you able to\b|is it possible to\b|is there any way you can\b)/u;
const WRITE_PATTERN =
	/\b(?:adjust|brighten|close|decrease|dim|increase|lock|lower|open|raise|set|switch|turn|unlock)\b/u;
const TRIGGER_PATTERN = /\b(?:activate|run|start|trigger)\b/u;
const TARGET_DEPENDENT_ACTION_PATTERN = /\b(?:activate|start)\b/u;
const CONDITION_PATTERN = /\b(?:after|assuming|before|given that|if|provided|unless|until|when|whenever|while)\b/u;
const RELATIVE_PATTERN = /\b(?:brighter|colder|cooler|darker|down|higher|hotter|less|lower|more|times as|up|warmer)\b/u;
const PRONOUN_PATTERN = /\b(?:it|one|that|them|these|this|those)\b/u;
const ACTION_PRONOUN_PATTERN =
	/\b(?:activate|adjust|close|dim|lock|lower|open|raise|run|set|start|switch|trigger|turn|unlock)\s+(?:it|one|that|them|these|this|those)\b/u;
const CAPABILITY_DISCOVERY_PATTERN = /^(?:what|which)\b.*\b(?:am i able to|can i)\b/u;
const CONTEXTUAL_SCOPE_PATTERN = /\b(?:here|in this room|this space)\b/u;
const AMBIGUOUS_TARGET_PATTERN = /\b(?:device|fan|lamp|light|scene|switch|thermostat)\b/u;
const EXPLICIT_SPACE_PATTERN =
	/\b(?:bathroom|bedroom|downstairs|garage|hallway|kitchen|living room|office|upstairs)\b/u;
const WHOLE_HOME_SCOPE_PATTERN =
	/\b(?:entire|whole) (?:home|house)\b|\b(?:across|throughout) (?:the )?(?:home|house)\b/u;
const TRAILING_ACTION_PATTERN =
	/(?:[?;,]|\b(?:and|then)\b)\s*(?:(?:if so|please)\s+)*(?:activate|adjust|brighten|close|decrease|dim|increase|lock|lower|open|raise|run|set|start|switch|trigger|turn|unlock)\b/u;

@Injectable()
export class BuddyContextPlannerService {
	plan(input: BuddyContextPlannerInput): BuddyContextPlan {
		const normalizedMessage = normalize(input.message);
		const explicitSpace = findExplicitSpace(normalizedMessage, input.knownSpaces ?? []);
		const conversationSpaceId = resolveConversationSpaceHint(
			normalizedMessage,
			input.conversationSpaceId,
			explicitSpace?.id,
		);
		const isGenericExplanation = isGeneralExplanation(normalizedMessage);
		const hasTrailingAction = TRAILING_ACTION_PATTERN.test(normalizedMessage);
		const isReadOnlyPredicate =
			!hasTrailingAction &&
			(isStatePredicateQuestion(normalizedMessage) ||
				(READ_PATTERN.test(normalizedMessage) &&
					(CAPABILITY_DISCOVERY_PATTERN.test(normalizedMessage) || hasOnlyGroundedActionTokens(normalizedMessage))));
		const hasWrite =
			!isGenericExplanation &&
			!isReadOnlyPredicate &&
			(WRITE_PATTERN.test(normalizedMessage) || TARGET_DEPENDENT_ACTION_PATTERN.test(normalizedMessage));
		const hasTrigger = !isGenericExplanation && !isReadOnlyPredicate && TRIGGER_PATTERN.test(normalizedMessage);
		const hasAction = hasWrite || hasTrigger;
		const requestedActionTypes = getRequestedActionTypes(normalizedMessage);
		const domains = classifyDomains(normalizedMessage, hasAction || isReadOnlyPredicate, isGenericExplanation);
		const references = resolveRecentReferences(normalizedMessage, input.recentEntityReferences ?? []);
		const hasRead =
			domains.some((domain) => domain !== 'general') && (READ_PATTERN.test(normalizedMessage) || !hasAction);
		const requiresReadForAction =
			hasAction && (CONDITION_PATTERN.test(normalizedMessage) || RELATIVE_PATTERN.test(normalizedMessage));
		const intent = classifyIntent(hasWrite, hasTrigger, hasRead || requiresReadForAction);
		const ambiguityRisk = classifyAmbiguityRisk(
			normalizedMessage,
			hasWrite,
			hasTrigger,
			requestedActionTypes,
			references,
			conversationSpaceId,
			explicitSpace !== undefined,
		);
		const strategy = selectStrategy(intent, ambiguityRisk, input.providerCapabilities);
		const scope = {
			...(conversationSpaceId ? { spaceId: conversationSpaceId } : {}),
			...(references.length > 0 ? { referencedEntityIds: references.map((reference) => reference.id) } : {}),
		};

		return {
			domains,
			intent,
			scope,
			queries: buildQueries(domains, hasAction, requiresReadForAction, conversationSpaceId),
			toolNames: buildToolNames(domains, hasWrite, hasTrigger, strategy, normalizedMessage),
			ambiguityRisk,
			strategy,
		};
	}
}

function classifyDomains(message: string, hasAction: boolean, isGenericExplanation: boolean): BuddyContextDomain[] {
	if (isGenericExplanation) return ['general'];

	const domains = new Set<BuddyContextDomain>();

	if (HOME_PATTERN.test(message) || hasAction) domains.add('home');
	if (WEATHER_PATTERN.test(message)) domains.add('weather');
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
	hasWrite: boolean,
	hasTrigger: boolean,
	requestedActionTypes: readonly BuddyContextActionType[],
	references: readonly BuddyContextEntityReference[],
	conversationSpaceId?: string,
	hasExplicitKnownSpace = false,
): BuddyContextAmbiguityRisk {
	const isAction = hasWrite || hasTrigger;

	if (isAction) {
		if (
			ACTION_PRONOUN_PATTERN.test(message) &&
			(references.length !== 1 ||
				!isActionReferenceCompatible(references[0], hasWrite, hasTrigger, requestedActionTypes))
		) {
			return 'action';
		}
		if (AMBIGUOUS_TARGET_PATTERN.test(message) && !EXPLICIT_SPACE_PATTERN.test(message) && !hasExplicitKnownSpace) {
			return 'action';
		}

		return 'none';
	}

	if (CONTEXTUAL_SCOPE_PATTERN.test(message) && !conversationSpaceId) return 'read';

	return 'none';
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
	explicitSpaceId?: string,
): string | undefined {
	if (
		!conversationSpaceId ||
		WHOLE_HOME_SCOPE_PATTERN.test(message) ||
		(explicitSpaceId !== undefined && explicitSpaceId !== conversationSpaceId)
	) {
		return undefined;
	}

	return conversationSpaceId;
}

function findExplicitSpace(
	message: string,
	knownSpaces: readonly BuddyContextSpaceReference[],
): { id: string; name: string } | undefined {
	return knownSpaces.find((space) => containsNormalizedPhrase(message, normalize(space.name)));
}

function containsNormalizedPhrase(message: string, phrase: string): boolean {
	if (phrase.length === 0) return false;

	const index = message.indexOf(phrase);
	if (index < 0) return false;

	const before = index === 0 ? '' : message[index - 1];
	const afterIndex = index + phrase.length;
	const after = afterIndex >= message.length ? '' : message[afterIndex];

	return !/[\p{Letter}\p{Number}]/u.test(before) && !/[\p{Letter}\p{Number}]/u.test(after);
}

function getRequestedActionTypes(message: string): BuddyContextActionType[] {
	const actions = new Set<BuddyContextActionType>();
	const mappings: readonly [RegExp, BuddyContextActionType][] = [
		[/\bactivate\b/u, 'activate'],
		[/\b(?:adjust|brighten|decrease|increase|lower|raise)\b/u, 'adjust'],
		[/\bclose\b/u, 'close'],
		[/\bdim\b/u, 'dim'],
		[/\block\b/u, 'lock'],
		[/\bopen\b/u, 'open'],
		[/\brun\b/u, 'run'],
		[/\bset\b/u, 'set'],
		[/\bstart\b/u, 'start'],
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

function selectStrategy(
	intent: BuddyContextIntent,
	ambiguityRisk: BuddyContextAmbiguityRisk,
	providerCapabilities: BuddyContextPlannerInput['providerCapabilities'],
): BuddyContextStrategy {
	if (intent === 'none') return 'no-home-context';
	if (ambiguityRisk !== 'none') return 'clarify';

	const hasAction = intent === 'write' || intent === 'trigger' || intent === 'mixed';
	const canUseModelTools =
		providerCapabilities.toolCalling === 'reliable' && providerCapabilities.supportsStructuredToolResults;

	if (hasAction) return canUseModelTools ? 'model-tools' : 'deterministic-action';

	return canUseModelTools ? 'model-tools' : 'prefetch';
}

function buildQueries(
	domains: readonly BuddyContextDomain[],
	hasAction: boolean,
	requiresReadForAction: boolean,
	spaceId?: string,
): BuddyContextQueryPlan[] {
	const queries: BuddyContextQueryPlan[] = [];
	const scoped = spaceId ? { spaceId } : {};

	if (domains.includes('home')) {
		queries.push({ kind: 'search-home', ...scoped });
		if (!hasAction || requiresReadForAction) queries.push({ kind: 'current-state', ...scoped });
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
