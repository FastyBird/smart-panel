/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IntentType } from '../../intents/intents.constants';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SuggestionFeedback } from '../../spaces/spaces.constants';
import { EventType, SuggestionType } from '../buddy.constants';
import { BuddySuggestionEntity, SuggestionStatus } from '../entities/buddy-suggestion.entity';
import { BuddySuggestionNotFoundException } from '../buddy.exceptions';

import { DetectedPattern, PatternDetectorService } from './pattern-detector.service';
import { BuddySuggestion, SuggestionEngineService } from './suggestion-engine.service';

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

/**
 * In-memory mock for TypeORM Repository<BuddySuggestionEntity>.
 * Simulates basic CRUD so the service can be tested without a database.
 */
function createMockRepository() {
	const store = new Map<string, BuddySuggestionEntity>();

	return {
		_store: store,
		create: jest.fn((data: Partial<BuddySuggestionEntity>) => ({ ...data }) as BuddySuggestionEntity),
		save: jest.fn(async (entity: BuddySuggestionEntity) => {
			store.set(entity.id, { ...entity, createdAt: entity.createdAt ?? new Date() });

			return entity;
		}),
		findOne: jest.fn(async ({ where }: any) => {
			if (where?.id) {
				return store.get(where.id) ?? null;
			}

			// Find by spaceId + type + status + feedbackAt (cooldown check)
			for (const entity of store.values()) {
				let match = true;

				if (where?.spaceId && entity.spaceId !== where.spaceId) match = false;
				if (where?.type && entity.type !== where.type) match = false;

				if (where?.status?._type === 'not' && entity.status === where.status._value) match = false;
				else if (where?.status && typeof where.status === 'string' && entity.status !== where.status) match = false;

				if (match) return entity;
			}

			return null;
		}),
		find: jest.fn(async ({ where, order }: any = {}) => {
			let results = [...store.values()];

			if (where) {
				results = results.filter((e) => {
					if (where.spaceId && e.spaceId !== where.spaceId) return false;
					if (where.type && e.type !== where.type) return false;
					if (where.status && typeof where.status === 'string' && e.status !== where.status) return false;

					return true;
				});

				// Filter active non-expired
				if (where.expiresAt?._type === 'moreThan') {
					const cutoff = where.expiresAt._value as Date;
					results = results.filter((e) => e.expiresAt.getTime() > cutoff.getTime());
				}
			}

			if (order?.createdAt === 'DESC') {
				results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			}

			return results;
		}),
		count: jest.fn(async ({ where }: any = {}) => {
			let count = 0;

			for (const entity of store.values()) {
				if (where?.status && entity.status !== where.status) continue;
				count++;
			}

			return count;
		}),
		update: jest.fn(async (criteria: any, update: any) => {
			let affected = 0;

			for (const entity of store.values()) {
				if (criteria.status && entity.status !== criteria.status) continue;
				if (criteria.expiresAt?._type === 'lessThanOrEqual') {
					const cutoff = criteria.expiresAt._value as Date;

					if (entity.expiresAt.getTime() > cutoff.getTime()) continue;
				}

				Object.assign(entity, update);
				affected++;
			}

			return { affected };
		}),
	};
}

describe('SuggestionEngineService', () => {
	let service: SuggestionEngineService;
	let patternDetector: { detectPatterns: jest.Mock };
	let spacesService: { findOne: jest.Mock };
	let eventEmitter: jest.Mocked<EventEmitter2>;
	let mockRepo: ReturnType<typeof createMockRepository>;

	beforeEach(() => {
		patternDetector = {
			detectPatterns: jest.fn().mockReturnValue([]),
		};

		spacesService = {
			findOne: jest.fn().mockResolvedValue({ name: 'Living Room' }),
		};

		eventEmitter = {
			emit: jest.fn(),
		} as any;

		mockRepo = createMockRepository();

		service = new SuggestionEngineService(
			mockRepo as any,
			patternDetector as unknown as PatternDetectorService,
			spacesService as unknown as SpacesService,
			eventEmitter,
		);
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

			const active = await service.getActiveSuggestions();

			expect(active).toHaveLength(1);
		});

		it('should filter by space ID when provided', async () => {
			patternDetector.detectPatterns.mockReturnValue([
				makePattern({ spaceId: 'living-room' }),
				makePattern({ spaceId: 'bedroom', intentType: IntentType.SCENE_RUN }),
			]);
			await service.generateSuggestions();

			const active = await service.getActiveSuggestions('living-room');

			expect(active).toHaveLength(1);
			expect(active[0].spaceId).toBe('living-room');
		});

		it('should return empty array when no suggestions exist', async () => {
			const active = await service.getActiveSuggestions();

			expect(active).toHaveLength(0);
		});
	});

	describe('getSuggestionOrThrow', () => {
		it('should return a suggestion by ID', async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);
			const created = await service.generateSuggestions();

			const suggestion = await service.getSuggestionOrThrow(created[0].id);

			expect(suggestion.id).toBe(created[0].id);
		});

		it('should throw BuddySuggestionNotFoundException for unknown ID', async () => {
			await expect(service.getSuggestionOrThrow('nonexistent')).rejects.toThrow(BuddySuggestionNotFoundException);
		});
	});

	describe('recordFeedback', () => {
		let createdSuggestion: BuddySuggestion;

		beforeEach(async () => {
			patternDetector.detectPatterns.mockReturnValue([makePattern()]);
			const created = await service.generateSuggestions();

			createdSuggestion = created[0];
		});

		it('should return success for applied feedback', async () => {
			const result = await service.recordFeedback(createdSuggestion.id, SuggestionFeedback.APPLIED);

			expect(result.success).toBe(true);
		});

		it('should return success for dismissed feedback', async () => {
			const result = await service.recordFeedback(createdSuggestion.id, SuggestionFeedback.DISMISSED);

			expect(result.success).toBe(true);
		});

		it('should throw for non-existent suggestion ID', async () => {
			await expect(service.recordFeedback('nonexistent', SuggestionFeedback.APPLIED)).rejects.toThrow(
				BuddySuggestionNotFoundException,
			);
		});
	});
});
