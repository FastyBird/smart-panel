/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentType } from '../../intents/intents.constants';
import { SuggestionFeedback } from '../../spaces/spaces.constants';
import { EventType, SuggestionType } from '../buddy.constants';
import { BuddySuggestionNotFoundException } from '../buddy.exceptions';

import { DetectedPattern } from './pattern-detector.service';
import { BuddySuggestion, buddyCooldowns, SuggestionEngineService } from './suggestion-engine.service';

function makePattern(overrides: Partial<DetectedPattern> = {}): DetectedPattern {
	return {
		intentType: overrides.intentType ?? IntentType.LIGHT_TOGGLE,
		spaceId: overrides.spaceId ?? 'space-1',
		timeOfDay: overrides.timeOfDay ?? { hour: 23, minute: 0 },
		occurrences: overrides.occurrences ?? 5,
		confidence: overrides.confidence ?? 0.71,
		firstSeen: overrides.firstSeen ?? new Date('2025-01-01'),
		lastSeen: overrides.lastSeen ?? new Date('2025-01-05'),
	};
}

describe('SuggestionEngineService', () => {
	let service: SuggestionEngineService;
	let patternDetector: { detectPatterns: jest.Mock };
	let spacesService: { findOne: jest.Mock };
	let eventEmitter: jest.Mocked<EventEmitter2>;

	beforeEach(() => {
		// Clear global cooldowns before each test
		buddyCooldowns.clearAll();

		patternDetector = {
			detectPatterns: jest.fn().mockReturnValue([]),
		};

		spacesService = {
			findOne: jest.fn().mockResolvedValue({ name: 'Living Room' }),
		};

		eventEmitter = {
			emit: jest.fn(),
		} as any;

		service = new SuggestionEngineService(patternDetector as any, spacesService as any, eventEmitter);
	});

	afterEach(() => {
		service.onModuleDestroy();
	});

	describe('generateSuggestions', () => {
		it('should create a suggestion from a detected pattern', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);

			const suggestions = await service.generateSuggestions();

			expect(suggestions).toHaveLength(1);
			expect(suggestions[0].type).toBe(SuggestionType.PATTERN_SCENE_CREATE);
			expect(suggestions[0].spaceId).toBe('space-1');
			expect(suggestions[0].title).toBe('Create a scene for this?');
			expect(suggestions[0].reason).toContain('Living Room');
			expect(suggestions[0].reason).toContain('11 PM');
		});

		it('should emit SUGGESTION_CREATED event for each new suggestion', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);

			const suggestions = await service.generateSuggestions();

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.SUGGESTION_CREATED, suggestions[0]);
		});

		it('should not create duplicate suggestions for the same pattern', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);

			await service.generateSuggestions();
			const second = await service.generateSuggestions();

			expect(second).toHaveLength(0);
		});

		it('should skip patterns that are on cooldown', async () => {
			buddyCooldowns.setCooldown('space-1', SuggestionType.PATTERN_SCENE_CREATE, 60_000);
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);

			const suggestions = await service.generateSuggestions();

			expect(suggestions).toHaveLength(0);
		});

		it('should return empty array when no patterns are detected', async () => {
			patternDetector.detectPatterns.mockReturnValue([]);

			const suggestions = await service.generateSuggestions();

			expect(suggestions).toHaveLength(0);
		});

		it('should create suggestions for multiple different patterns', async () => {
			patternDetector.detectPatterns.mockReturnValue([
				makePattern({ spaceId: 'living-room', intentType: IntentType.LIGHT_TOGGLE }),
				makePattern({ spaceId: 'bedroom', intentType: IntentType.SPACE_LIGHTING_OFF }),
			]);

			const suggestions = await service.generateSuggestions();

			expect(suggestions).toHaveLength(2);
		});

		it('should handle space service failure gracefully', async () => {
			spacesService.findOne.mockRejectedValue(new Error('DB error'));
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);

			const suggestions = await service.generateSuggestions();

			expect(suggestions).toHaveLength(1);
			expect(suggestions[0].reason).toContain('unknown space');
		});
	});

	describe('getActiveSuggestions', () => {
		it('should return active (non-expired) suggestions', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);
			await service.generateSuggestions();

			const active = service.getActiveSuggestions();

			expect(active).toHaveLength(1);
		});

		it('should filter by space ID when provided', async () => {
			patternDetector.detectPatterns.mockReturnValue([
				makePattern({ spaceId: 'living-room' }),
				makePattern({ spaceId: 'bedroom', intentType: IntentType.SCENE_RUN }),
			]);
			await service.generateSuggestions();

			const active = service.getActiveSuggestions('living-room');

			expect(active).toHaveLength(1);
			expect(active[0].spaceId).toBe('living-room');
		});

		it('should return empty array when no suggestions exist', () => {
			const active = service.getActiveSuggestions();

			expect(active).toHaveLength(0);
		});

		it('should sort suggestions by creation date (newest first)', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern({ spaceId: 'a' })]);
			await service.generateSuggestions();

			// Small delay to ensure different createdAt
			await new Promise((resolve) => setTimeout(resolve, 10));

			patternDetector.detectPatterns.mockReturnValue([makePattern({ spaceId: 'b' })]);
			await service.generateSuggestions();

			const active = service.getActiveSuggestions();

			expect(active).toHaveLength(2);
			expect(active[0].spaceId).toBe('b');
			expect(active[1].spaceId).toBe('a');
		});
	});

	describe('getSuggestionOrThrow', () => {
		it('should return a suggestion by ID', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);
			const created = await service.generateSuggestions();

			const suggestion = service.getSuggestionOrThrow(created[0].id);

			expect(suggestion.id).toBe(created[0].id);
		});

		it('should throw BuddySuggestionNotFoundException for unknown ID', () => {
			expect(() => service.getSuggestionOrThrow('nonexistent')).toThrow(BuddySuggestionNotFoundException);
		});
	});

	describe('recordFeedback', () => {
		let createdSuggestion: BuddySuggestion;

		beforeEach(async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);
			const created = await service.generateSuggestions();

			createdSuggestion = created[0];
		});

		it('should return success for applied feedback', () => {
			const result = service.recordFeedback(createdSuggestion.id, SuggestionFeedback.APPLIED);

			expect(result.success).toBe(true);
		});

		it('should return success for dismissed feedback', () => {
			const result = service.recordFeedback(createdSuggestion.id, SuggestionFeedback.DISMISSED);

			expect(result.success).toBe(true);
		});

		it('should remove the suggestion after feedback', () => {
			service.recordFeedback(createdSuggestion.id, SuggestionFeedback.APPLIED);

			expect(() => service.getSuggestionOrThrow(createdSuggestion.id)).toThrow(
				BuddySuggestionNotFoundException,
			);
		});

		it('should set cooldown after applied feedback', () => {
			service.recordFeedback(createdSuggestion.id, SuggestionFeedback.APPLIED);

			expect(buddyCooldowns.isOnCooldown('space-1', SuggestionType.PATTERN_SCENE_CREATE)).toBe(true);
		});

		it('should set cooldown after dismissed feedback', () => {
			service.recordFeedback(createdSuggestion.id, SuggestionFeedback.DISMISSED);

			expect(buddyCooldowns.isOnCooldown('space-1', SuggestionType.PATTERN_SCENE_CREATE)).toBe(true);
		});

		it('should throw for non-existent suggestion ID', () => {
			expect(() => service.recordFeedback('nonexistent', SuggestionFeedback.APPLIED)).toThrow(
				BuddySuggestionNotFoundException,
			);
		});
	});
});
