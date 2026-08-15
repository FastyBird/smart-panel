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
const HOME_SIGNALS = new Set([
	'air',
	'bathroom',
	'bedroom',
	'blind',
	'blinds',
	'cooling',
	'device',
	'door',
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
	'heating',
	'humidity',
	'lamp',
	'lock',
	'sensor',
	'switch',
	'temperature',
	'thermostat',
	'window',
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
		const isStateQuestion =
			hasStateSignal &&
			/^(?:are|do|does|how|is|what|which|where|was|were|je|jsou|jaka|jaky|ktere|kolik)\b/u.test(normalizedMessage);
		const hasActionSignal = intersects(tokens, ACTION_SIGNALS) && !isStateQuestion;
		const hasHomeSignal = intersects(tokens, HOME_SIGNALS);

		if (hasSearchSignal || hasStateSignal || (message.includes('?') && hasHomeSignal)) {
			for (const name of READ_TOOL_NAMES) selected.add(name);
		}

		if (hasActionSignal) {
			selected.add(SEARCH_HOME_TOOL_NAME);
			this.selectActionTools(tokens, selected);
		}

		if (selected.size === 0 && (hasHomeSignal || !isClearlyGeneralConversation(tokens))) {
			for (const name of BUILT_IN_TOOL_NAMES) selected.add(name);
		}

		return definitions.filter(
			(definition) => !BUILT_IN_TOOL_NAMES.has(definition.name) || selected.has(definition.name),
		);
	}

	private selectActionTools(tokens: Set<string>, selected: Set<string>): void {
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
