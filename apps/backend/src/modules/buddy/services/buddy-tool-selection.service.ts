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
	'deactivate',
	'dim',
	'lock',
	'open',
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
	'vypni',
	'zamkni',
	'zapni',
	'zavri',
]);
const ACTION_CLAUSE_PATTERN = new RegExp(
	String.raw`(?:\ba\b|\band\b|\bpotom\b|\bthen\b|[,;])\s*(?:please\s+)?(?:${[...ACTION_SIGNALS].join('|')})\b`,
	'u',
);
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
	'me',
	'morning',
	'tell',
	'the',
	'write',
	'you',
	'your',
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
		const actionTokens = getActionIntentTokens(normalizedMessage, tokens, hasStateSignal);
		const hasHomeSignal = intersects(tokens, HOME_SIGNALS);
		const isGenericExplanation = isGenericHomeExplanation(normalizedMessage, tokens);
		const isStateExplanation =
			hasHomeSignal &&
			(/^explain (?:if|whether)\b/u.test(normalizedMessage) ||
				(/^explain why\b/u.test(normalizedMessage) && intersects(tokens, GROUNDED_STATE_SIGNALS)));

		if (
			isStateExplanation ||
			(!isGenericExplanation && (hasSearchSignal || hasStateSignal || (message.includes('?') && hasHomeSignal)))
		) {
			for (const name of READ_TOOL_NAMES) selected.add(name);
		}

		if (actionTokens) {
			selected.add(SEARCH_HOME_TOOL_NAME);
			this.selectActionTools(actionTokens, selected, ACTION_CLAUSE_PATTERN.test(normalizedMessage));
		}

		if (selected.size === 0 && !isGenericExplanation && (hasHomeSignal || !isClearlyGeneralConversation(tokens))) {
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

		const hasSceneSignal = intersects(tokens, SCENE_SIGNALS);
		const hasLightingSignal = intersects(tokens, LIGHTING_SIGNALS);
		const hasDeviceSignal = intersects(tokens, DEVICE_SIGNALS);
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

function isClearlyGeneralConversation(tokens: Set<string>): boolean {
	if (!intersects(tokens, GENERAL_CONVERSATION_SIGNALS)) return false;

	for (const token of tokens) {
		if (!GENERAL_CONVERSATION_SIGNALS.has(token) && !GENERAL_CONVERSATION_FILLERS.has(token)) return false;
	}

	return true;
}

function isGenericHomeExplanation(normalizedMessage: string, tokens: Set<string>): boolean {
	if (!intersects(tokens, HOME_SIGNALS)) return false;
	if (intersects(tokens, GROUNDED_STATE_SIGNALS)) return false;

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
		hasStateSignal &&
		/^(?:are|do|does|how|is|what|which|where|was|were|je|jsou|jaka|jaky|ktere|kolik)\b/u.test(normalizedMessage);

	if (isStateQuestion) {
		const questionEnd = normalizedMessage.indexOf('?');
		const trailingClause =
			questionEnd >= 0
				? normalizedMessage.slice(questionEnd + 1)
				: sliceAfterFirst(normalizedMessage, /\b(?:and|if not|if so|please|then)\b/u);
		const trailingTokens = tokenize(trailingClause);

		return intersects(trailingTokens, ACTION_SIGNALS) ? trailingTokens : null;
	}

	const trailingCondition = normalizedMessage.search(/\b(?:if|kdyz|pokud|when)\b/u);

	if (trailingCondition > 0) {
		const commandTokens = tokenize(normalizedMessage.slice(0, trailingCondition));

		if (intersects(commandTokens, ACTION_SIGNALS)) return commandTokens;
	}

	if (/^(?:if|kdyz|pokud|when)\b/u.test(normalizedMessage)) {
		const commandTokens = tokenize(sliceAfterFirst(normalizedMessage, /[,;]|\b(?:pak|potom|then)\b/u));

		if (intersects(commandTokens, ACTION_SIGNALS)) return commandTokens;

		return new Set();
	}

	return tokens;
}

function sliceAfterFirst(value: string, delimiter: RegExp): string {
	const match = delimiter.exec(value);

	return match?.index === undefined ? '' : value.slice(match.index + match[0].length);
}
