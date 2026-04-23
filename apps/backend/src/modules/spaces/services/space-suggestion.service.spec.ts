import { v4 as uuid } from 'uuid';

import { ResolvedSuggestionRule } from '../../../plugins/spaces-home-control/spec/intent-spec.types';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceType, SuggestionType } from '../spaces.constants';

import {
	SuggestionContext,
	evaluateSuggestionRules,
	isBedroomSpace,
	lastEmittedSuggestions,
	spaceCooldowns,
} from './space-suggestion.service';

/**
 * Default bedroom patterns matching the builtin suggestions.yaml
 */
const BEDROOM_PATTERNS = ['bedroom', 'schlafzimmer', 'ložnice', 'chambre'];

/**
 * Default suggestion rules matching the builtin suggestions.yaml
 */
const DEFAULT_RULES: ResolvedSuggestionRule[] = [
	{
		id: 'lighting_night',
		title: 'Night lighting',
		reason: 'Late evening - switch to night mode for better sleep',
		hourFrom: 22,
		hourTo: null,
		lightsOn: true,
		minBrightness: null,
		spaceIsBedroom: true,
		intentType: 'set_mode',
		intentMode: 'night',
	},
	{
		id: 'lighting_relax',
		title: 'Relax lighting',
		reason: 'Evening time - switch to a calmer lighting mode',
		hourFrom: 17,
		hourTo: 23,
		lightsOn: true,
		minBrightness: 70,
		spaceIsBedroom: null,
		intentType: 'set_mode',
		intentMode: 'relax',
	},
	{
		id: 'lighting_off',
		title: 'Turn off lights',
		reason: 'Late night - consider turning off the lights',
		hourFrom: 23,
		hourTo: null,
		lightsOn: true,
		minBrightness: null,
		spaceIsBedroom: false,
		intentType: 'off',
		intentMode: null,
	},
];

describe('SpaceSuggestionService - Pure Functions', () => {
	beforeEach(() => {
		spaceCooldowns.clearAll();
		lastEmittedSuggestions.clear();
	});

	describe('isBedroomSpace', () => {
		it('should return true for bedroom names', () => {
			expect(isBedroomSpace('Bedroom', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('Master Bedroom', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('Kids Bedroom', BEDROOM_PATTERNS)).toBe(true);
		});

		it('should return true for German bedroom names', () => {
			expect(isBedroomSpace('Schlafzimmer', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('Main Schlafzimmer', BEDROOM_PATTERNS)).toBe(true);
		});

		it('should return true for Czech bedroom names', () => {
			expect(isBedroomSpace('Ložnice', BEDROOM_PATTERNS)).toBe(true);
		});

		it('should return true for French bedroom names', () => {
			expect(isBedroomSpace('Chambre', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('Grande Chambre', BEDROOM_PATTERNS)).toBe(true);
		});

		it('should be case insensitive', () => {
			expect(isBedroomSpace('BEDROOM', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('BedRoom', BEDROOM_PATTERNS)).toBe(true);
			expect(isBedroomSpace('bedroom', BEDROOM_PATTERNS)).toBe(true);
		});

		it('should return false for non-bedroom spaces', () => {
			expect(isBedroomSpace('Living Room', BEDROOM_PATTERNS)).toBe(false);
			expect(isBedroomSpace('Kitchen', BEDROOM_PATTERNS)).toBe(false);
			expect(isBedroomSpace('Bathroom', BEDROOM_PATTERNS)).toBe(false);
			expect(isBedroomSpace('Office', BEDROOM_PATTERNS)).toBe(false);
		});
	});

	describe('Cooldown Functions', () => {
		const roomId = uuid();
		const suggestionType = SuggestionType.LIGHTING_RELAX;

		describe('isOnCooldown', () => {
			it('should return false when no cooldown is set', () => {
				expect(spaceCooldowns.isOnCooldown(roomId, suggestionType)).toBe(false);
			});

			it('should return true when cooldown is active', () => {
				const now = Date.now();
				spaceCooldowns.setCooldown(roomId, suggestionType, 30000, now); // 30 second cooldown

				expect(spaceCooldowns.isOnCooldown(roomId, suggestionType, now + 10000)).toBe(true);
			});

			it('should return false when cooldown has expired', () => {
				const now = Date.now();
				spaceCooldowns.setCooldown(roomId, suggestionType, 30000, now); // 30 second cooldown

				expect(spaceCooldowns.isOnCooldown(roomId, suggestionType, now + 60000)).toBe(false);
			});
		});

		describe('clearCooldown', () => {
			it('should clear a specific cooldown', () => {
				const now = Date.now();
				spaceCooldowns.setCooldown(roomId, suggestionType, 30000, now);

				expect(spaceCooldowns.isOnCooldown(roomId, suggestionType, now)).toBe(true);

				spaceCooldowns.clearCooldown(roomId, suggestionType);

				expect(spaceCooldowns.isOnCooldown(roomId, suggestionType, now)).toBe(false);
			});
		});

		describe('clearAllCooldowns', () => {
			it('should clear all cooldowns', () => {
				const roomId1 = uuid();
				const roomId2 = uuid();
				const now = Date.now();

				spaceCooldowns.setCooldown(roomId1, SuggestionType.LIGHTING_RELAX, 30000, now);
				spaceCooldowns.setCooldown(roomId2, SuggestionType.LIGHTING_NIGHT, 30000, now);

				spaceCooldowns.clearAll();

				expect(spaceCooldowns.isOnCooldown(roomId1, SuggestionType.LIGHTING_RELAX, now)).toBe(false);
				expect(spaceCooldowns.isOnCooldown(roomId2, SuggestionType.LIGHTING_NIGHT, now)).toBe(false);
			});
		});
	});

	describe('evaluateSuggestionRules', () => {
		const createSpace = (name: string): SpaceEntity => ({
			id: uuid(),
			name,
			description: null,
			type: SpaceType.ROOM,
			category: null,
			icon: null,
			displayOrder: 0,
			suggestionsEnabled: true,
			statusWidgets: null,
			lastActivityAt: null,
			parentId: null,
			parent: null,
			children: [],
			createdAt: new Date(),
			updatedAt: null,
		});

		const createContext = (overrides: Partial<SuggestionContext>): SuggestionContext => ({
			space: createSpace('Living Room'),
			currentHour: 12,
			lightsOn: false,
			averageBrightness: null,
			...overrides,
		});

		describe('Rule 1: Evening in bedroom -> Night mode', () => {
			it('should suggest Night mode after 22:00 in bedroom with lights on', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
				expect(result?.intentMode).toBe('night');
				expect(result?.title).toBe('Night lighting');
			});

			it('should not suggest Night mode in bedroom before 22:00', () => {
				const context = createContext({
					space: createSpace('Master Bedroom'),
					currentHour: 21,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				// May get relax suggestion instead if brightness is high
				expect(result?.type !== SuggestionType.LIGHTING_NIGHT || result === null).toBe(true);
			});

			it('should not suggest Night mode in non-bedroom after 22:00', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				// May get lights off suggestion instead
				expect(result?.type !== SuggestionType.LIGHTING_NIGHT || result === null).toBe(true);
			});

			it('should not suggest Night mode in bedroom with lights off', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 22,
					lightsOn: false,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});
		});

		describe('Rule 2: Evening with high brightness -> Relax mode', () => {
			it('should suggest Relax mode after 17:00 with high brightness', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 19,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_RELAX);
				expect(result?.intentMode).toBe('relax');
				expect(result?.title).toBe('Relax lighting');
			});

			it('should suggest Relax mode at exactly 70% brightness', () => {
				const context = createContext({
					space: createSpace('Office'),
					currentHour: 20,
					lightsOn: true,
					averageBrightness: 70,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_RELAX);
			});

			it('should not suggest Relax mode with low brightness', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 19,
					lightsOn: true,
					averageBrightness: 50,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode before 17:00', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 16,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode after 22:00 (night rule takes over)', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				// Night mode takes precedence in bedrooms at 22:00
				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should not suggest Relax mode with lights off', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 19,
					lightsOn: false,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode when brightness is unknown', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 19,
					lightsOn: true,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});
		});

		describe('Rule 3: Late night -> Lights off', () => {
			it('should suggest Lights off after 23:00 with lights on in non-bedroom', () => {
				const context = createContext({
					space: createSpace('Kitchen'),
					currentHour: 23,
					lightsOn: true,
					averageBrightness: 50,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_OFF);
				expect(result?.intentType).toBe('off');
				expect(result?.intentMode).toBeNull();
				expect(result?.title).toBe('Turn off lights');
			});

			it('should not suggest Lights off in bedroom after 23:00 (Night mode takes over)', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 23,
					lightsOn: true,
					averageBrightness: 50,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				// Night mode takes precedence in bedrooms
				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should not suggest Lights off before 23:00', () => {
				const context = createContext({
					space: createSpace('Kitchen'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 50,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				// No suggestion at 22:00 for kitchen (not bedroom, not high brightness)
				expect(result).toBeNull();
			});

			it('should not suggest Lights off with lights already off', () => {
				const context = createContext({
					space: createSpace('Kitchen'),
					currentHour: 23,
					lightsOn: false,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});
		});

		describe('No suggestion scenarios', () => {
			it('should return null during daytime with normal brightness', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 14,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should return null when all lights are off', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 20,
					lightsOn: false,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should return null in the morning', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 8,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});
		});

		describe('Rule priority', () => {
			it('should prioritize Night mode over Relax mode in bedroom at 22:00', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 100, // Would trigger Relax, but Night takes precedence
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should prioritize Night mode over Lights off in bedroom at 23:00', () => {
				const context = createContext({
					space: createSpace('Master Bedroom'),
					currentHour: 23,
					lightsOn: true,
					averageBrightness: 30, // Would trigger Lights off in other rooms
				});

				const result = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);

				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});
		});

		describe('lastEmittedSuggestions tracker', () => {
			it('should track last emitted entry per space', () => {
				const spaceId = uuid();
				const entry = { type: SuggestionType.LIGHTING_RELAX, emittedAt: Date.now(), dismissed: false };

				lastEmittedSuggestions.set(spaceId, entry);

				expect(lastEmittedSuggestions.get(spaceId)?.type).toBe(SuggestionType.LIGHTING_RELAX);
				expect(lastEmittedSuggestions.get(spaceId)?.dismissed).toBe(false);
			});

			it('should allow clearing when conditions change', () => {
				const spaceId = uuid();

				lastEmittedSuggestions.set(spaceId, {
					type: SuggestionType.LIGHTING_RELAX,
					emittedAt: Date.now(),
					dismissed: false,
				});
				lastEmittedSuggestions.delete(spaceId);

				expect(lastEmittedSuggestions.get(spaceId)).toBeUndefined();
			});

			it('should track different types per space independently', () => {
				const spaceId1 = uuid();
				const spaceId2 = uuid();

				lastEmittedSuggestions.set(spaceId1, {
					type: SuggestionType.LIGHTING_RELAX,
					emittedAt: Date.now(),
					dismissed: false,
				});
				lastEmittedSuggestions.set(spaceId2, {
					type: SuggestionType.LIGHTING_NIGHT,
					emittedAt: Date.now(),
					dismissed: false,
				});

				expect(lastEmittedSuggestions.get(spaceId1)?.type).toBe(SuggestionType.LIGHTING_RELAX);
				expect(lastEmittedSuggestions.get(spaceId2)?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should update when a different type is emitted', () => {
				const spaceId = uuid();

				lastEmittedSuggestions.set(spaceId, {
					type: SuggestionType.LIGHTING_RELAX,
					emittedAt: Date.now(),
					dismissed: false,
				});
				lastEmittedSuggestions.set(spaceId, {
					type: SuggestionType.LIGHTING_NIGHT,
					emittedAt: Date.now(),
					dismissed: false,
				});

				expect(lastEmittedSuggestions.get(spaceId)?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should support dismissed flag to prevent re-emission', () => {
				const spaceId = uuid();
				const entry = { type: SuggestionType.LIGHTING_RELAX, emittedAt: Date.now(), dismissed: false };

				lastEmittedSuggestions.set(spaceId, entry);
				entry.dismissed = true;

				expect(lastEmittedSuggestions.get(spaceId)?.dismissed).toBe(true);
			});
		});

		describe('Custom rules', () => {
			it('should work with empty rules array', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context, [], BEDROOM_PATTERNS);

				expect(result).toBeNull();
			});

			it('should work with custom bedroom patterns', () => {
				const context = createContext({
					space: createSpace('Dormitorio'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 80,
				});

				// Default patterns don't match
				const result1 = evaluateSuggestionRules(context, DEFAULT_RULES, BEDROOM_PATTERNS);
				expect(result1?.type).not.toBe(SuggestionType.LIGHTING_NIGHT);

				// Custom Spanish pattern matches
				const result2 = evaluateSuggestionRules(context, DEFAULT_RULES, ['dormitorio']);
				expect(result2?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});
		});
	});
});
