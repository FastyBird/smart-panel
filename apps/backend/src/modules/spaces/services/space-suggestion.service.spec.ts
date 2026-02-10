import { v4 as uuid } from 'uuid';

import { SpaceEntity } from '../entities/space.entity';
import { LightingMode, SpaceType, SuggestionType } from '../spaces.constants';

import {
	SuggestionContext,
	clearAllCooldowns,
	clearCooldown,
	evaluateSuggestionRules,
	isBedroomSpace,
	isOnCooldown,
	setCooldown,
} from './space-suggestion.service';

describe('SpaceSuggestionService - Pure Functions', () => {
	beforeEach(() => {
		clearAllCooldowns();
	});

	describe('isBedroomSpace', () => {
		it('should return true for bedroom names', () => {
			expect(isBedroomSpace('Bedroom')).toBe(true);
			expect(isBedroomSpace('Master Bedroom')).toBe(true);
			expect(isBedroomSpace('Kids Bedroom')).toBe(true);
		});

		it('should return true for German bedroom names', () => {
			expect(isBedroomSpace('Schlafzimmer')).toBe(true);
			expect(isBedroomSpace('Main Schlafzimmer')).toBe(true);
		});

		it('should return true for Czech bedroom names', () => {
			expect(isBedroomSpace('Ložnice')).toBe(true);
		});

		it('should return true for French bedroom names', () => {
			expect(isBedroomSpace('Chambre')).toBe(true);
			expect(isBedroomSpace('Grande Chambre')).toBe(true);
		});

		it('should be case insensitive', () => {
			expect(isBedroomSpace('BEDROOM')).toBe(true);
			expect(isBedroomSpace('BedRoom')).toBe(true);
			expect(isBedroomSpace('bedroom')).toBe(true);
		});

		it('should return false for non-bedroom spaces', () => {
			expect(isBedroomSpace('Living Room')).toBe(false);
			expect(isBedroomSpace('Kitchen')).toBe(false);
			expect(isBedroomSpace('Bathroom')).toBe(false);
			expect(isBedroomSpace('Office')).toBe(false);
		});
	});

	describe('Cooldown Functions', () => {
		const roomId = uuid();
		const suggestionType = SuggestionType.LIGHTING_RELAX;

		describe('isOnCooldown', () => {
			it('should return false when no cooldown is set', () => {
				expect(isOnCooldown(roomId, suggestionType)).toBe(false);
			});

			it('should return true when cooldown is active', () => {
				const now = Date.now();
				setCooldown(roomId, suggestionType, 30000, now); // 30 second cooldown

				expect(isOnCooldown(roomId, suggestionType, now + 10000)).toBe(true);
			});

			it('should return false when cooldown has expired', () => {
				const now = Date.now();
				setCooldown(roomId, suggestionType, 30000, now); // 30 second cooldown

				expect(isOnCooldown(roomId, suggestionType, now + 60000)).toBe(false);
			});
		});

		describe('clearCooldown', () => {
			it('should clear a specific cooldown', () => {
				const now = Date.now();
				setCooldown(roomId, suggestionType, 30000, now);

				expect(isOnCooldown(roomId, suggestionType, now)).toBe(true);

				clearCooldown(roomId, suggestionType);

				expect(isOnCooldown(roomId, suggestionType, now)).toBe(false);
			});
		});

		describe('clearAllCooldowns', () => {
			it('should clear all cooldowns', () => {
				const roomId1 = uuid();
				const roomId2 = uuid();
				const now = Date.now();

				setCooldown(roomId1, SuggestionType.LIGHTING_RELAX, 30000, now);
				setCooldown(roomId2, SuggestionType.LIGHTING_NIGHT, 30000, now);

				clearAllCooldowns();

				expect(isOnCooldown(roomId1, SuggestionType.LIGHTING_RELAX, now)).toBe(false);
				expect(isOnCooldown(roomId2, SuggestionType.LIGHTING_NIGHT, now)).toBe(false);
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
			headerWidgets: null,
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

				const result = evaluateSuggestionRules(context);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
				expect(result?.lightingMode).toBe(LightingMode.NIGHT);
				expect(result?.title).toBe('Night lighting');
			});

			it('should not suggest Night mode in bedroom before 22:00', () => {
				const context = createContext({
					space: createSpace('Master Bedroom'),
					currentHour: 21,
					lightsOn: true,
					averageBrightness: 80,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_RELAX);
				expect(result?.lightingMode).toBe(LightingMode.RELAX);
				expect(result?.title).toBe('Relax lighting');
			});

			it('should suggest Relax mode at exactly 70% brightness', () => {
				const context = createContext({
					space: createSpace('Office'),
					currentHour: 20,
					lightsOn: true,
					averageBrightness: 70,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode before 17:00', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 16,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode after 22:00 (night rule takes over)', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 22,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result).toBeNull();
			});

			it('should not suggest Relax mode when brightness is unknown', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 19,
					lightsOn: true,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result).not.toBeNull();
				expect(result?.type).toBe(SuggestionType.LIGHTING_OFF);
				expect(result?.lightingMode).toBeNull(); // OFF intent, not a mode
				expect(result?.title).toBe('Turn off lights');
			});

			it('should not suggest Lights off in bedroom after 23:00 (Night mode takes over)', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 23,
					lightsOn: true,
					averageBrightness: 50,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result).toBeNull();
			});

			it('should return null when all lights are off', () => {
				const context = createContext({
					space: createSpace('Living Room'),
					currentHour: 20,
					lightsOn: false,
					averageBrightness: null,
				});

				const result = evaluateSuggestionRules(context);

				expect(result).toBeNull();
			});

			it('should return null in the morning', () => {
				const context = createContext({
					space: createSpace('Bedroom'),
					currentHour: 8,
					lightsOn: true,
					averageBrightness: 100,
				});

				const result = evaluateSuggestionRules(context);

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

				const result = evaluateSuggestionRules(context);

				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});

			it('should prioritize Night mode over Lights off in bedroom at 23:00', () => {
				const context = createContext({
					space: createSpace('Master Bedroom'),
					currentHour: 23,
					lightsOn: true,
					averageBrightness: 30, // Would trigger Lights off in other rooms
				});

				const result = evaluateSuggestionRules(context);

				expect(result?.type).toBe(SuggestionType.LIGHTING_NIGHT);
			});
		});
	});
});
