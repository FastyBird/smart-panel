import { Injectable } from '@nestjs/common';

import { ToolDefinition } from '../platforms/llm-provider.platform';

import { QUERY_HOME_STATE_TOOL_NAME, SEARCH_HOME_TOOL_NAME } from './home-context-tool-provider.service';

const CONTROL_DEVICE_TOOL_NAME = 'control_device';
const RUN_SCENE_TOOL_NAME = 'run_scene';
const SET_SPACE_LIGHTING_TOOL_NAME = 'set_space_lighting';

const BUILT_IN_TOOL_NAMES = new Set([
	SEARCH_HOME_TOOL_NAME,
	QUERY_HOME_STATE_TOOL_NAME,
	CONTROL_DEVICE_TOOL_NAME,
	RUN_SCENE_TOOL_NAME,
	SET_SPACE_LIGHTING_TOOL_NAME,
]);

const READ_TOOL_NAMES = [SEARCH_HOME_TOOL_NAME, QUERY_HOME_STATE_TOOL_NAME] as const;
const ACTION_TOOL_NAMES = [CONTROL_DEVICE_TOOL_NAME, RUN_SCENE_TOOL_NAME, SET_SPACE_LIGHTING_TOOL_NAME] as const;

const SEARCH_SIGNALS = new Set([
	'find',
	'list',
	'locate',
	'overview',
	'search',
	'show',
	'which',
	'najdi',
	'prehled',
	'ukaž',
	'ukaz',
]);
const STATE_SIGNALS = new Set([
	'all',
	'any',
	'closed',
	'count',
	'current',
	'humidity',
	'open',
	'state',
	'status',
	'temperature',
	'value',
	'vlhkost',
	'otevrene',
	'otevreny',
	'stav',
	'teplota',
	'zavrene',
	'zavreny',
]);
const ACTION_SIGNALS = new Set([
	'activate',
	'adjust',
	'brighten',
	'change',
	'close',
	'decrease',
	'deactivate',
	'dim',
	'increase',
	'lock',
	'lower',
	'make',
	'open',
	'raise',
	'run',
	'set',
	'start',
	'stop',
	'switch',
	'turn',
	'unlock',
	'aktivuj',
	'odemkni',
	'otevri',
	'spust',
	'nastav',
	'sniz',
	'vypni',
	'zamkni',
	'zapni',
	'zavri',
	'zvys',
]);
const ACTION_CLAUSE_PATTERN = new RegExp(
	String.raw`(?:\ba\b|\band\b|\bplus\b|\bpotom\b|\bthen\b|[,;])\s*(?:(?:also|please|take)\s+)*(?:${[...ACTION_SIGNALS].join('|')})\b`,
	'u',
);
const READ_CLAUSE_PATTERN =
	/(?:\ba\b|\band\b|\bplus\b|\bpotom\b|\bthen\b|[,;])\s*(?:check|confirm|determine|ensure|find|make sure|read|report|see|show|tell|verify|what|whether|which)\b/u;
const STATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|do|does|had|has|have|how|is|may|might|what|which|where|why|will|would|was|were|je|jsou|jaka|jaky|ktere|kolik)\b/u;
const PREDICATE_QUESTION_PATTERN =
	/^(?:are|can|could|did|had|has|have|is|may|might|will|would|was|were|(?:what|why) (?:are|did|had|has|have|is|was|were))\b/u;
const UNKNOWN_ACTION_REQUEST_PATTERN = /^(?:(?:can|could|may|might|will|would)\s+you\b|please\b)/u;
const ACTION_REQUEST_AUXILIARIES = new Set(['able', 'possible', 'way']);
const ACTION_REQUEST_MODALS = new Set(['can', 'could', 'may', 'might', 'will', 'would']);
const CONDITION_PATTERN =
	/\b(?:after|as long as|as soon as|assuming(?: that)?|before|if|in case|jakmile|jestlize|kdyz|once|only if|pokud|provided(?: that)?|so long as|unless|until|when|whenever|while)\b/u;
const LEADING_CONDITION_PATTERN =
	/^(?:after|as long as|as soon as|assuming(?: that)?|before|if|in case|jakmile|jestlize|kdyz|once|only if|pokud|provided(?: that)?|so long as|unless|until|when|whenever|while)\b/u;
const GROUNDED_STATE_SIGNALS = new Set([
	'active',
	'closed',
	'high',
	'inactive',
	'locked',
	'low',
	'off',
	'on',
	'open',
	'unlocked',
]);
const EXPLICIT_STATE_REQUEST_SIGNALS = new Set(['all', 'any', 'count', 'current', 'state', 'status', 'value']);
const RELATIVE_ADJUSTMENT_SIGNALS = new Set([
	'brighten',
	'brighter',
	'colder',
	'cooler',
	'darker',
	'decrease',
	'dim',
	'dimmer',
	'double',
	'down',
	'half',
	'halve',
	'hotter',
	'higher',
	'increase',
	'less',
	'lower',
	'more',
	'raise',
	'triple',
	'twice',
	'up',
	'warmer',
]);
const HOME_SIGNALS = new Set([
	'air',
	'bathroom',
	'bedroom',
	'blind',
	'blinds',
	'cooling',
	'device',
	'door',
	'doors',
	'energy',
	'garage',
	'heating',
	'home',
	'house',
	'humidity',
	'kitchen',
	'lamp',
	'light',
	'lighting',
	'lights',
	'room',
	'scene',
	'security',
	'sensor',
	'switch',
	'temperature',
	'thermostat',
	'window',
	'windows',
	'dvere',
	'dum',
	'energie',
	'garaz',
	'koupelna',
	'kuchyn',
	'lampa',
	'loznice',
	'okno',
	'pokoj',
	'scena',
	'senzor',
	'svetlo',
	'teplota',
	'termostat',
	'topeni',
	'vlhkost',
	'vypinac',
	'zabezpeceni',
	'zaluzie',
	'zarizeni',
]);
const SCENE_SIGNALS = new Set(['automation', 'preset', 'routine', 'scene', 'scena']);
const SCENE_ACTION_SIGNALS = new Set(['run', 'spust']);
const AMBIGUOUS_ACTION_SIGNALS = new Set(['activate', 'deactivate', 'start', 'stop']);
const DEVICE_ACTION_SIGNALS = new Set([
	'adjust',
	'brighten',
	'change',
	'close',
	'decrease',
	'dim',
	'increase',
	'lock',
	'lower',
	'make',
	'nastav',
	'odemkni',
	'open',
	'otevri',
	'raise',
	'set',
	'sniz',
	'switch',
	'turn',
	'unlock',
	'vypni',
	'zamkni',
	'zapni',
	'zavri',
	'zvys',
]);
const LIGHTING_SIGNALS = new Set(['lamp', 'lampa', 'light', 'lighting', 'lights', 'svetla', 'svetlo']);
const SPACE_SIGNALS = new Set([
	'all',
	'bathroom',
	'bedroom',
	'downstairs',
	'garage',
	'kitchen',
	'lighting',
	'lights',
	'room',
	'upstairs',
	'garaz',
	'koupelna',
	'kuchyn',
	'loznice',
	'pokoj',
	'svetla',
]);
const DEVICE_SIGNALS = new Set([
	'air',
	'blind',
	'blinds',
	'cooling',
	'device',
	'door',
	'doors',
	'heating',
	'humidity',
	'lamp',
	'lock',
	'sensor',
	'switch',
	'temperature',
	'thermostat',
	'window',
	'windows',
	'dvere',
	'lampa',
	'okno',
	'senzor',
	'teplota',
	'termostat',
	'topeni',
	'vlhkost',
	'vypinac',
	'zaluzie',
	'zarizeni',
]);
const GENERAL_CONVERSATION_SIGNALS = new Set([
	'hello',
	'hey',
	'hi',
	'how',
	'joke',
	'morning',
	'poem',
	'thank',
	'thanks',
	'who',
	'ahoj',
	'dekuji',
	'diky',
]);
const GENERAL_CONVERSATION_FILLERS = new Set([
	'a',
	'am',
	'are',
	'about',
	'good',
	'i',
	'is',
	'it',
	'its',
	'me',
	'morning',
	'tell',
	'the',
	'write',
	'you',
	'your',
	'if',
	'not',
	'please',
	'so',
	'v',
	'whether',
	'jaky',
	'jak',
	'jsi',
	'mi',
	'rekni',
]);

/**
 * Selects built-in Buddy schemas for the current message.
 *
 * This is a conservative prompt-size optimization, not an authorization boundary. Unknown extension tools remain
 * advertised, and every model-emitted call still goes through the registry and provider safety checks.
 */
@Injectable()
export class BuddyToolSelectionService {
	select(message: string, definitions: ToolDefinition[]): ToolDefinition[] {
		const normalizedMessage = normalize(message);
		const tokens = tokenize(normalizedMessage);
		const selected = new Set<string>();
		const hasSearchSignal = intersects(tokens, SEARCH_SIGNALS);
		const hasStateSignal = intersects(tokens, STATE_SIGNALS);
		const hasAuxiliaryActionRequest = hasActionRequestAuxiliary(normalizedMessage, tokens);
		const hasStateReadSignal = hasStateSignal && !hasAuxiliaryActionRequest;
		const actionTokens = getActionIntentTokens(normalizedMessage, tokens, hasStateReadSignal);
		const hasConditionalAction = actionTokens !== null && CONDITION_PATTERN.test(normalizedMessage);
		const hasTrailingReadClause = actionTokens !== null && READ_CLAUSE_PATTERN.test(normalizedMessage);
		const questionEnd = normalizedMessage.indexOf('?');
		const trailingQuestionClause = questionEnd >= 0 ? normalizedMessage.slice(questionEnd + 1).trim() : '';
		const trailingQuestionTokens = tokenize(trailingQuestionClause);
		const hasUnrecognizedTrailingIntent =
			actionTokens === null &&
			trailingQuestionClause.length > 0 &&
			!isClearlyGeneralConversation(trailingQuestionClause, trailingQuestionTokens);
		const hasStateFirstAction =
			actionTokens !== null &&
			questionEnd >= 0 &&
			intersects(tokenize(normalizedMessage.slice(questionEnd + 1)), ACTION_SIGNALS);
		const hasGroundedStateFirstAction =
			actionTokens !== null &&
			/^(?:are|is|je|jsou)\b/u.test(normalizedMessage) &&
			intersects(tokens, GROUNDED_STATE_SIGNALS) &&
			/[,;]/u.test(normalizedMessage);
		const hasPredicateStateFirstAction =
			actionTokens !== null &&
			isSyntacticPredicateQuestion(normalizedMessage, tokens) &&
			/[,;]/u.test(normalizedMessage);
		const hasHomeSignal = intersects(tokens, HOME_SIGNALS);
		const hasInterrogativeHomeQuestion =
			hasHomeSignal &&
			actionTokens === null &&
			STATE_QUESTION_PATTERN.test(normalizedMessage) &&
			(message.includes('?') || isSyntacticPredicateQuestion(normalizedMessage, tokens));
		const hasLiveStatusRequest =
			hasHomeSignal && actionTokens === null && /\b(?:currently|right now)\b/u.test(normalizedMessage);
		const hasExplicitStateQuestion = isExplicitStateQuestion(normalizedMessage);
		const hasLeadingReadRequest =
			hasHomeSignal && /^(?:check|confirm|determine|ensure|find out|read|see|show|verify)\b/u.test(normalizedMessage);
		const hasRelativeAdjustment = actionTokens !== null && intersects(tokens, RELATIVE_ADJUSTMENT_SIGNALS);
		const isGenericExplanation = isGenericHomeExplanation(normalizedMessage, tokens);
		const hasUnrecognizedStateIntent =
			hasStateReadSignal &&
			actionTokens === null &&
			!hasSearchSignal &&
			(!message.includes('?') || UNKNOWN_ACTION_REQUEST_PATTERN.test(normalizedMessage)) &&
			!/^(?:explain|tell)\b/u.test(normalizedMessage);
		const hasUnknownModalRequest =
			actionTokens === null &&
			hasHomeSignal &&
			UNKNOWN_ACTION_REQUEST_PATTERN.test(normalizedMessage) &&
			!hasExplicitStateQuestion;
		const hasUnrecognizedReadCompound =
			actionTokens === null &&
			(hasSearchSignal || hasStateReadSignal) &&
			(hasUnknownTrailingClause(normalizedMessage) || hasUnknownLeadingIntentBeforeRead(normalizedMessage));
		const isStateExplanation =
			hasHomeSignal &&
			(/^explain (?:if|whether)\b/u.test(normalizedMessage) ||
				(/^explain why\b/u.test(normalizedMessage) && !/\bwork(?:s|ing)?\b/u.test(normalizedMessage)) ||
				/^explain how\b.*\b(?:are|is)\.?$/u.test(normalizedMessage));

		if (
			isStateExplanation ||
			(!isGenericExplanation &&
				(hasSearchSignal ||
					hasStateReadSignal ||
					hasConditionalAction ||
					hasTrailingReadClause ||
					hasStateFirstAction ||
					hasGroundedStateFirstAction ||
					hasPredicateStateFirstAction ||
					hasInterrogativeHomeQuestion ||
					hasLiveStatusRequest ||
					hasExplicitStateQuestion ||
					hasLeadingReadRequest ||
					hasRelativeAdjustment ||
					(actionTokens === null &&
						message.includes('?') &&
						hasHomeSignal &&
						intersects(tokens, GROUNDED_STATE_SIGNALS))))
		) {
			for (const name of READ_TOOL_NAMES) selected.add(name);
		}

		if (actionTokens) {
			selected.add(SEARCH_HOME_TOOL_NAME);
			this.selectActionTools(
				actionTokens,
				selected,
				ACTION_CLAUSE_PATTERN.test(normalizedMessage) || hasUnknownTrailingClause(normalizedMessage),
			);
		}

		if (hasUnrecognizedStateIntent) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		if (hasUnknownModalRequest) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		if (hasUnrecognizedTrailingIntent) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		if (hasUnrecognizedReadCompound) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		if (
			selected.size === 0 &&
			!isGenericExplanation &&
			(hasHomeSignal || !isClearlyGeneralConversation(normalizedMessage, tokens))
		) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		return definitions.filter(
			(definition) => !BUILT_IN_TOOL_NAMES.has(definition.name) || selected.has(definition.name),
		);
	}

	private selectActionTools(tokens: Set<string>, selected: Set<string>, hasAdditionalActionClause: boolean): void {
		if (hasAdditionalActionClause) {
			for (const name of ACTION_TOOL_NAMES) selected.add(name);

			return;
		}

		if (intersects(tokens, AMBIGUOUS_ACTION_SIGNALS)) {
			for (const name of ACTION_TOOL_NAMES) selected.add(name);

			return;
		}

		const hasExplicitSceneSignal = intersects(tokens, SCENE_SIGNALS);
		const hasSceneActionSignal = intersects(tokens, SCENE_ACTION_SIGNALS);

		if (hasSceneActionSignal && !hasExplicitSceneSignal) {
			for (const name of ACTION_TOOL_NAMES) selected.add(name);

			return;
		}

		const hasSceneSignal = hasExplicitSceneSignal || hasSceneActionSignal;
		const hasLightingSignal = intersects(tokens, LIGHTING_SIGNALS);
		const hasDeviceTargetSignal = intersects(tokens, DEVICE_SIGNALS);
		const hasDeviceActionSignal = intersects(tokens, DEVICE_ACTION_SIGNALS);

		if (hasDeviceActionSignal && !hasDeviceTargetSignal && !hasExplicitSceneSignal && !hasLightingSignal) {
			for (const name of ACTION_TOOL_NAMES) selected.add(name);

			return;
		}

		const hasDeviceSignal = hasDeviceTargetSignal || hasDeviceActionSignal;
		let selectedSpecificAction = false;

		if (hasSceneSignal) {
			selected.add(RUN_SCENE_TOOL_NAME);
			selectedSpecificAction = true;
		}

		if (hasLightingSignal) {
			selected.add(CONTROL_DEVICE_TOOL_NAME);
			if (intersects(tokens, SPACE_SIGNALS)) selected.add(SET_SPACE_LIGHTING_TOOL_NAME);
			selectedSpecificAction = true;
		} else if (hasDeviceSignal) {
			selected.add(CONTROL_DEVICE_TOOL_NAME);
			selectedSpecificAction = true;
		}

		if (!selectedSpecificAction) {
			for (const name of ACTION_TOOL_NAMES) selected.add(name);
		}
	}
}

function tokenize(value: string): Set<string> {
	return new Set(value.split(/[^\p{Letter}\p{Number}]+/u).filter((token) => token.length > 0));
}

function normalize(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{Mark}/gu, '')
		.toLocaleLowerCase('en-US')
		.trim();
}

function intersects(tokens: Set<string>, signals: Set<string>): boolean {
	for (const token of tokens) {
		if (signals.has(token)) return true;
	}

	return false;
}

function isClearlyGeneralConversation(normalizedMessage: string, tokens: Set<string>): boolean {
	if (!intersects(tokens, GENERAL_CONVERSATION_SIGNALS)) return false;
	if (
		(tokens.size === 1 && !tokens.has('hello') && !tokens.has('hey') && !tokens.has('hi') && !tokens.has('thanks')) ||
		(tokens.size <= 2 && (tokens.has('morning') || normalizedMessage === 'thank you'))
	) {
		return false;
	}
	if (/^(?:(?:how|who) is|tell me about)\b/u.test(normalizedMessage)) return false;

	for (const token of tokens) {
		if (!GENERAL_CONVERSATION_SIGNALS.has(token) && !GENERAL_CONVERSATION_FILLERS.has(token)) return false;
	}

	return true;
}

function hasUnknownTrailingClause(normalizedMessage: string): boolean {
	const trailingClause = sliceAfterFirst(normalizedMessage, /[.!?,;]|\b(?:and|plus|potom|then)\b/u);

	if (trailingClause.length === 0) return false;

	for (const token of tokenize(trailingClause)) {
		if (
			!SEARCH_SIGNALS.has(token) &&
			!STATE_SIGNALS.has(token) &&
			!GROUNDED_STATE_SIGNALS.has(token) &&
			!HOME_SIGNALS.has(token) &&
			!GENERAL_CONVERSATION_FILLERS.has(token)
		) {
			return true;
		}
	}

	return false;
}

function hasUnknownLeadingIntentBeforeRead(normalizedMessage: string): boolean {
	const readClauseIndex = normalizedMessage.search(READ_CLAUSE_PATTERN);

	if (readClauseIndex <= 0) return false;

	const [firstToken] = tokenize(normalizedMessage.slice(0, readClauseIndex));

	return (
		firstToken !== undefined &&
		!SEARCH_SIGNALS.has(firstToken) &&
		!STATE_SIGNALS.has(firstToken) &&
		!ACTION_SIGNALS.has(firstToken) &&
		!GENERAL_CONVERSATION_FILLERS.has(firstToken)
	);
}

function isGenericHomeExplanation(normalizedMessage: string, tokens: Set<string>): boolean {
	if (!intersects(tokens, HOME_SIGNALS)) return false;
	if (intersects(tokens, GROUNDED_STATE_SIGNALS)) return false;
	if (intersects(tokens, EXPLICIT_STATE_REQUEST_SIGNALS)) return false;
	if (/\b(?:currently|right now)\b/u.test(normalizedMessage)) return false;
	if (intersects(tokens, STATE_SIGNALS) && /^explain what\b.*\b(?:are|is)\??$/u.test(normalizedMessage)) return false;

	return (
		/^how (?:do|does) .+ work(?:s|ing)?\b/u.test(normalizedMessage) ||
		/^what (?:do|does) .+ mean\b/u.test(normalizedMessage) ||
		/^what (?:is|are) (?:a|an)\b/u.test(normalizedMessage) ||
		/^explain (?:how|what|why)\b/u.test(normalizedMessage)
	);
}

function getActionIntentTokens(
	normalizedMessage: string,
	tokens: Set<string>,
	hasStateSignal: boolean,
): Set<string> | null {
	if (!intersects(tokens, ACTION_SIGNALS)) return null;

	const isStateQuestion =
		isExplicitStateQuestion(normalizedMessage) ||
		(hasStateSignal &&
			!hasActionRequestAuxiliary(normalizedMessage, tokens) &&
			STATE_QUESTION_PATTERN.test(normalizedMessage)) ||
		isSyntacticPredicateQuestion(normalizedMessage, tokens);

	if (isStateQuestion) {
		const questionEnd = normalizedMessage.indexOf('?');
		const questionBody = questionEnd >= 0 ? normalizedMessage.slice(0, questionEnd) : normalizedMessage;
		const trailingClause = [
			sliceAfterFirst(
				questionBody,
				/[,;]|\b(?:a|after|and|assuming(?: that)?|before|if not|if so|once|please|plus|potom|then|until|when|while)\b/u,
			),
			questionEnd >= 0 ? normalizedMessage.slice(questionEnd + 1) : '',
		].join(' ');
		const trailingTokens = tokenize(trailingClause);

		return intersects(trailingTokens, ACTION_SIGNALS) ? trailingTokens : null;
	}

	const trailingCondition = normalizedMessage.search(CONDITION_PATTERN);

	if (trailingCondition > 0) {
		const commandTokens = tokenize(normalizedMessage.slice(0, trailingCondition));

		if (intersects(commandTokens, ACTION_SIGNALS)) return commandTokens;

		return new Set();
	}

	if (LEADING_CONDITION_PATTERN.test(normalizedMessage)) {
		const commandTokens = tokenize(sliceAfterFirst(normalizedMessage, /[,;]|\b(?:pak|potom|then)\b/u));

		if (intersects(commandTokens, ACTION_SIGNALS)) return commandTokens;

		return new Set();
	}

	const trailingReadClause = normalizedMessage.search(READ_CLAUSE_PATTERN);

	if (trailingReadClause > 0) {
		const commandTokens = tokenize(normalizedMessage.slice(0, trailingReadClause));

		if (intersects(commandTokens, ACTION_SIGNALS)) return commandTokens;
	}

	return tokens;
}

function isExplicitStateQuestion(normalizedMessage: string): boolean {
	const requestPattern =
		/^(?:(?:can|could|may|might|will|would)\s+you\s+)?(?:please\s+)?(?:(?:show|tell) me|check|confirm|determine|ensure|find out|see|verify)\b/u;

	if (!requestPattern.test(normalizedMessage)) return false;
	if (/\b(?:if|whether)\b/u.test(normalizedMessage)) return true;

	return /\b(?:how|what|when|where|which|why)\b.*\b(?:are|did|do|does|had|has|have|is|was|were)\b/u.test(
		normalizedMessage,
	);
}

function isSyntacticPredicateQuestion(normalizedMessage: string, tokens: Set<string>): boolean {
	if (!PREDICATE_QUESTION_PATTERN.test(normalizedMessage) || !intersects(tokens, ACTION_SIGNALS)) return false;

	return !hasActionRequestAuxiliary(normalizedMessage, tokens);
}

function hasActionRequestAuxiliary(normalizedMessage: string, tokens: Set<string>): boolean {
	if (!intersects(tokens, ACTION_SIGNALS)) return false;

	const actionMatch = new RegExp(String.raw`\b(?:${[...ACTION_SIGNALS].join('|')})\b`, 'u').exec(normalizedMessage);
	const prefix = actionMatch === null ? '' : normalizedMessage.slice(0, actionMatch.index);
	const prefixTokens = tokenize(prefix);
	const [firstPrefixToken] = prefixTokens;

	return (
		actionMatch !== null &&
		(intersects(prefixTokens, ACTION_REQUEST_AUXILIARIES) ||
			(firstPrefixToken !== undefined && ACTION_REQUEST_MODALS.has(firstPrefixToken) && /^\w+\s+you\b/u.test(prefix)))
	);
}

function sliceAfterFirst(value: string, delimiter: RegExp): string {
	const match = delimiter.exec(value);

	return match?.index === undefined ? '' : value.slice(match.index + match[0].length);
}
