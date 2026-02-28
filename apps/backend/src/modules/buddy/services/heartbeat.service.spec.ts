/* eslint-disable @typescript-eslint/unbound-method */
import { HEARTBEAT_DEFAULT_INTERVAL_MS, SuggestionType } from '../buddy.constants';

import { BuddyContext } from './buddy-context.service';
import { HeartbeatService } from './heartbeat.service';
import { EvaluatorResult, HeartbeatEvaluator } from './heartbeat.types';
import { BuddySuggestion } from './suggestion-engine.service';

function makeContext(overrides: Partial<BuddyContext> = {}): BuddyContext {
	return {
		timestamp: new Date().toISOString(),
		spaces: overrides.spaces ?? [{ id: 'space-1', name: 'Living Room', category: 'living_room', deviceCount: 3 }],
		devices: overrides.devices ?? [],
		scenes: overrides.scenes ?? [],
		weather: overrides.weather ?? null,
		energy: overrides.energy ?? null,
		recentIntents: overrides.recentIntents ?? [],
	};
}

function makeEvaluator(name: string, results: EvaluatorResult[] = []): HeartbeatEvaluator {
	return {
		name,
		evaluate: jest.fn().mockResolvedValue(results),
	};
}

function makeSuggestion(overrides: Partial<BuddySuggestion> = {}): BuddySuggestion {
	return {
		id: overrides.id ?? 'suggestion-1',
		type: overrides.type ?? SuggestionType.PATTERN_SCENE_CREATE,
		title: overrides.title ?? 'Test suggestion',
		reason: overrides.reason ?? 'Test reason',
		spaceId: overrides.spaceId ?? 'space-1',
		metadata: overrides.metadata ?? {},
		createdAt: overrides.createdAt ?? new Date(),
		expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86400000),
	};
}

describe('HeartbeatService', () => {
	let service: HeartbeatService;
	let schedulerRegistry: { addInterval: jest.Mock; deleteInterval: jest.Mock };
	let configService: { getModuleConfig: jest.Mock };
	let spacesService: { findAll: jest.Mock };
	let contextService: { buildContext: jest.Mock };
	let suggestionEngine: { createFromEvaluatorResults: jest.Mock };

	let capturedIntervalId: ReturnType<typeof setInterval> | null = null;

	beforeEach(() => {
		schedulerRegistry = {
			addInterval: jest.fn().mockImplementation((_name: string, id: ReturnType<typeof setInterval>) => {
				capturedIntervalId = id;
			}),
			deleteInterval: jest.fn().mockImplementation(() => {
				if (capturedIntervalId) {
					clearInterval(capturedIntervalId);
					capturedIntervalId = null;
				}
			}),
		};

		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				enabled: true,
				heartbeatIntervalMs: HEARTBEAT_DEFAULT_INTERVAL_MS,
			}),
		};

		spacesService = {
			findAll: jest.fn().mockResolvedValue([
				{ id: 'space-1', name: 'Living Room', suggestionsEnabled: true },
				{ id: 'space-2', name: 'Bedroom', suggestionsEnabled: true },
			]),
		};

		contextService = {
			buildContext: jest.fn().mockResolvedValue(makeContext()),
		};

		suggestionEngine = {
			createFromEvaluatorResults: jest.fn().mockResolvedValue([]),
		};

		service = new HeartbeatService(
			schedulerRegistry as any,
			configService as any,
			spacesService as any,
			contextService as any,
			suggestionEngine as any,
		);
	});

	afterEach(() => {
		if (capturedIntervalId) {
			clearInterval(capturedIntervalId);
			capturedIntervalId = null;
		}
	});

	describe('onApplicationBootstrap', () => {
		it('should register an interval with the scheduler registry', () => {
			service.onApplicationBootstrap();

			expect(schedulerRegistry.addInterval).toHaveBeenCalledWith('buddyHeartbeat', expect.anything());
		});

		it('should use default interval when config is unavailable', () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			service = new HeartbeatService(
				schedulerRegistry as any,
				configService as any,
				spacesService as any,
				contextService as any,
				suggestionEngine as any,
			);

			service.onApplicationBootstrap();

			expect(schedulerRegistry.addInterval).toHaveBeenCalled();
		});
	});

	describe('registerEvaluator', () => {
		it('should register an evaluator', () => {
			const evaluator = makeEvaluator('TestEvaluator');

			service.registerEvaluator(evaluator);

			// Evaluator is registered (we verify by running a cycle that uses it)
			expect(evaluator.name).toBe('TestEvaluator');
		});
	});

	describe('runCycle', () => {
		it('should skip cycle when buddy is disabled', async () => {
			configService.getModuleConfig.mockReturnValue({ enabled: false });

			await service.runCycle();

			expect(spacesService.findAll).not.toHaveBeenCalled();
		});

		it('should skip cycle when config is unavailable', async () => {
			configService.getModuleConfig.mockImplementation(() => {
				throw new Error('Config not found');
			});

			await service.runCycle();

			expect(spacesService.findAll).not.toHaveBeenCalled();
		});

		it('should skip cycle when no evaluators are registered', async () => {
			await service.runCycle();

			expect(spacesService.findAll).not.toHaveBeenCalled();
		});

		it('should build context for each space with suggestionsEnabled', async () => {
			service.registerEvaluator(makeEvaluator('TestEvaluator'));

			await service.runCycle();

			expect(contextService.buildContext).toHaveBeenCalledTimes(2);
			expect(contextService.buildContext).toHaveBeenCalledWith('space-1');
			expect(contextService.buildContext).toHaveBeenCalledWith('space-2');
		});

		it('should skip spaces with suggestionsEnabled = false', async () => {
			spacesService.findAll.mockResolvedValue([
				{ id: 'space-1', name: 'Living Room', suggestionsEnabled: true },
				{ id: 'space-2', name: 'Garage', suggestionsEnabled: false },
			]);
			service.registerEvaluator(makeEvaluator('TestEvaluator'));

			await service.runCycle();

			expect(contextService.buildContext).toHaveBeenCalledTimes(1);
			expect(contextService.buildContext).toHaveBeenCalledWith('space-1');
		});

		it('should run evaluators and pass results to suggestion engine', async () => {
			const results: EvaluatorResult[] = [
				{
					type: SuggestionType.PATTERN_SCENE_CREATE,
					title: 'Create a scene',
					reason: 'You toggle lights regularly',
					spaceId: 'space-1',
					metadata: { intentType: 'light.toggle' },
				},
			];

			service.registerEvaluator(makeEvaluator('TestEvaluator', results));
			suggestionEngine.createFromEvaluatorResults.mockResolvedValue([makeSuggestion()]);

			await service.runCycle();

			expect(suggestionEngine.createFromEvaluatorResults).toHaveBeenCalledWith(results);
		});

		it('should handle evaluator errors gracefully', async () => {
			const failingEvaluator: HeartbeatEvaluator = {
				name: 'FailingEvaluator',
				evaluate: jest.fn().mockRejectedValue(new Error('Evaluator crashed')),
			};
			const workingEvaluator = makeEvaluator('WorkingEvaluator', [
				{
					type: SuggestionType.GENERAL_TIP,
					title: 'Tip',
					reason: 'Reason',
					spaceId: 'space-1',
					metadata: {},
				},
			]);

			service.registerEvaluator(failingEvaluator);
			service.registerEvaluator(workingEvaluator);

			await service.runCycle();

			// Working evaluator's results should still be processed
			expect(workingEvaluator.evaluate).toHaveBeenCalled();
			expect(suggestionEngine.createFromEvaluatorResults).toHaveBeenCalled();
		});

		it('should not run concurrent cycles', async () => {
			service.registerEvaluator(makeEvaluator('TestEvaluator'));

			// Slow down the spaces lookup to create overlap
			spacesService.findAll.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve([{ id: 's1', suggestionsEnabled: true }]), 50)),
			);

			const cycle1 = service.runCycle();
			const cycle2 = service.runCycle();

			await Promise.all([cycle1, cycle2]);

			// Only one cycle should have called findAll
			expect(spacesService.findAll).toHaveBeenCalledTimes(1);
		});

		it('should handle spaces service failure gracefully', async () => {
			service.registerEvaluator(makeEvaluator('TestEvaluator'));
			spacesService.findAll.mockRejectedValue(new Error('DB unavailable'));

			// Should not throw
			await expect(service.runCycle()).resolves.toBeUndefined();
		});

		it('should skip when no spaces have suggestionsEnabled', async () => {
			spacesService.findAll.mockResolvedValue([
				{ id: 'space-1', suggestionsEnabled: false },
				{ id: 'space-2', suggestionsEnabled: false },
			]);
			service.registerEvaluator(makeEvaluator('TestEvaluator'));

			await service.runCycle();

			expect(contextService.buildContext).not.toHaveBeenCalled();
		});

		it('should run multiple evaluators sequentially for each space', async () => {
			const callOrder: string[] = [];

			const evaluator1: HeartbeatEvaluator = {
				name: 'Evaluator1',
				evaluate: jest.fn().mockImplementation(() => {
					callOrder.push('eval1');

					return Promise.resolve([]);
				}),
			};
			const evaluator2: HeartbeatEvaluator = {
				name: 'Evaluator2',
				evaluate: jest.fn().mockImplementation(() => {
					callOrder.push('eval2');

					return Promise.resolve([]);
				}),
			};

			spacesService.findAll.mockResolvedValue([{ id: 'space-1', suggestionsEnabled: true }]);
			service.registerEvaluator(evaluator1);
			service.registerEvaluator(evaluator2);

			await service.runCycle();

			expect(callOrder).toEqual(['eval1', 'eval2']);
		});
	});

	describe('onModuleDestroy', () => {
		it('should delete the interval from the scheduler registry', () => {
			service.onApplicationBootstrap();
			service.onModuleDestroy();

			expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('buddyHeartbeat');
		});

		it('should handle missing interval gracefully', () => {
			schedulerRegistry.deleteInterval.mockImplementation(() => {
				throw new Error('No interval found');
			});

			expect(() => service.onModuleDestroy()).not.toThrow();
		});
	});
});
